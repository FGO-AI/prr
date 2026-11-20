import { DatabaseSync } from "node:sqlite";
import { logMonitoringEvent } from "../db/database";
import {
  CanonicalGame,
  CompetitionPhase,
  GameStatus,
  LeagueCode,
  PlayerAvailabilityRecord
} from "../core/types";
import { getVenueForGame, normalizeTeam } from "../core/venues";

const SPORT_PATHS: Record<LeagueCode, string> = {
  NBA: "basketball/nba",
  NFL: "football/nfl",
  MLB: "baseball/mlb"
};

interface CachedPayload {
  data: any;
  fetchedUtc: string;
  expiresAtMs: number;
}

const memCache = new Map<string, CachedPayload>();

async function fetchWithRetry(url: string, ttlSeconds: number, db?: DatabaseSync, league?: LeagueCode): Promise<{ data: any; fetchedUtc: string } | null> {
  const cached = memCache.get(url);
  if (cached && Date.now() < cached.expiresAtMs) {
    return { data: cached.data, fetchedUtc: cached.fetchedUtc };
  }

  let lastErr: any = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "sports-analytics-engine/1.0" },
        signal: AbortSignal.timeout(7000)
      });
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      const fetchedUtc = new Date().toISOString();
      memCache.set(url, { data, fetchedUtc, expiresAtMs: Date.now() + ttlSeconds * 1000 });
      return { data, fetchedUtc };
    } catch (err) {
      lastErr = err;
    }
  }

  if (db) {
    logMonitoringEvent(db, {
      severity: "warn",
      source: "espn_api",
      league: league || null,
      eventType: "feed_fetch_failed",
      message: `ESPN fetch failed for ${url}: ${lastErr?.message || "unknown error"}`
    });
  }
  return null;
}

function mapEspnStatus(stateName: string | undefined, shortDetail: string | undefined): GameStatus {
  const s = (stateName || "").toLowerCase();
  const d = (shortDetail || "").toLowerCase();
  if (d.includes("postponed") || d.includes("ppd")) return "postponed";
  if (d.includes("cancel")) return "canceled";
  if (d.includes("suspend")) return "suspended";
  if (s === "post" || d.includes("final")) return "final";
  if (s === "in") return "in_progress";
  return "scheduled";
}

function mapEspnSeasonType(seasonType: number | undefined): CompetitionPhase {
  if (seasonType === 1) return "preseason";
  if (seasonType === 2) return "regular";
  if (seasonType === 3) return "postseason";
  if (seasonType === 5) return "playin";
  return "unknown";
}

export async function fetchEspnScoreboard(
  league: LeagueCode,
  dateYYYYMMDD?: string,
  db?: DatabaseSync
): Promise<{ games: CanonicalGame[]; oddsByGameId: Record<string, any>; fetchedUtc: string }> {
  const sportPath = SPORT_PATHS[league];
  const qs = dateYYYYMMDD ? `?dates=${dateYYYYMMDD}` : "";
  const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/scoreboard${qs}`;
  const ttl = dateYYYYMMDD ? 3600 : 120; // Historical dates cached 1h, live 2m
  const resp = await fetchWithRetry(url, ttl, db, league);
  if (!resp || !resp.data?.events) {
    return { games: [], oddsByGameId: {}, fetchedUtc: new Date().toISOString() };
  }

  const oddsByGameId: Record<string, any> = {};
  const games: CanonicalGame[] = [];

  for (const e of resp.data.events) {
    const comp = e.competitions?.[0];
    if (!comp) continue;
    const home = comp.competitors?.find((c: any) => c.homeAway === "home");
    const away = comp.competitors?.find((c: any) => c.homeAway === "away");
    if (!home || !away) continue;

    const homeCanon = normalizeTeam(league, home.team?.displayName || home.team?.abbreviation || "");
    const awayCanon = normalizeTeam(league, away.team?.displayName || away.team?.abbreviation || "");
    const homeAbbr = homeCanon?.abbr || home.team?.abbreviation || "HOME";
    const awayAbbr = awayCanon?.abbr || away.team?.abbreviation || "AWAY";
    const homeName = homeCanon?.name || home.team?.displayName || "Home Team";
    const awayName = awayCanon?.name || away.team?.displayName || "Away Team";

    const neutralSite = Boolean(comp.neutralSite);
    const venueNameRaw = comp.venue?.fullName;
    const venueMeta = getVenueForGame(league, homeName, { venueName: venueNameRaw, neutralSite });

    const startUtc = new Date(e.date || comp.date || new Date().toISOString()).toISOString();
    const seasonYear = Number(e.season?.year || new Date(startUtc).getUTCFullYear());
    const phase = mapEspnSeasonType(e.season?.type);
    const status = mapEspnStatus(e.status?.type?.state, e.status?.type?.shortDetail);

    const homeScore = status === "final" || status === "in_progress" ? Number(home.score) : null;
    const awayScore = status === "final" || status === "in_progress" ? Number(away.score) : null;
    const period = Number(e.status?.period || 0);
    const regPeriods = league === "NBA" || league === "NFL" ? 4 : 9;
    const wentOvertime = status === "final" && period > regPeriods;
    const isTie = status === "final" && homeScore !== null && awayScore !== null && homeScore === awayScore;

    const gameId = `${league}_${startUtc.slice(0, 10)}_${awayAbbr}_${homeAbbr}${comp.doubleHeader ? `_G${comp.gameNumber || 1}` : ""}`;

    if (comp.odds?.[0]) {
      oddsByGameId[gameId] = comp.odds[0];
    }

    const game: CanonicalGame = {
      gameId,
      league,
      season: seasonYear,
      competitionPhase: phase,
      homeTeamId: `${league}_${homeAbbr}`,
      awayTeamId: `${league}_${awayAbbr}`,
      homeTeamName: homeName,
      awayTeamName: awayName,
      homeTeamAbbr: homeAbbr,
      awayTeamAbbr: awayAbbr,
      venueId: venueMeta?.venueId || `${league.toLowerCase()}_${homeAbbr.toLowerCase()}`,
      venueName: venueNameRaw || venueMeta?.name || `${homeName} Venue`,
      venueTimezone: venueMeta?.timezone || "America/New_York",
      scheduledStartUtc: startUtc,
      neutralSite,
      doubleheaderGameNum: comp.gameNumber ? Number(comp.gameNumber) : null,
      status,
      homeScore: Number.isFinite(homeScore) ? homeScore : null,
      awayScore: Number.isFinite(awayScore) ? awayScore : null,
      wentOvertime,
      overtimePeriods: wentOvertime ? Math.max(1, period - regPeriods) : 0,
      isTie,
      rescheduledFromUtc: null,
      providerIds: { espn: String(e.id) }
    };

    if (db) {
      db.prepare(
        `INSERT INTO games (
          game_id, league, season, competition_phase, home_team_id, away_team_id,
          home_team_name, away_team_name, home_team_abbr, away_team_abbr,
          venue_id, venue_name, venue_timezone, scheduled_start_utc, neutral_site,
          doubleheader_game_num, status, home_score, away_score, went_overtime,
          overtime_periods, is_tie, rescheduled_from_utc, provider_ids_json, created_utc, updated_utc
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(game_id) DO UPDATE SET
          status=excluded.status,
          home_score=COALESCE(excluded.home_score, games.home_score),
          away_score=COALESCE(excluded.away_score, games.away_score),
          went_overtime=excluded.went_overtime,
          overtime_periods=excluded.overtime_periods,
          is_tie=excluded.is_tie,
          updated_utc=excluded.updated_utc`
      ).run(
        game.gameId, game.league, game.season, game.competitionPhase, game.homeTeamId, game.awayTeamId,
        game.homeTeamName, game.awayTeamName, game.homeTeamAbbr, game.awayTeamAbbr,
        game.venueId, game.venueName, game.venueTimezone, game.scheduledStartUtc, game.neutralSite ? 1 : 0,
        game.doubleheaderGameNum, game.status, game.homeScore, game.awayScore, game.wentOvertime ? 1 : 0,
        game.overtimePeriods, game.isTie ? 1 : 0, game.rescheduledFromUtc, JSON.stringify(game.providerIds),
        resp.fetchedUtc, resp.fetchedUtc
      );
      db.prepare(
        `INSERT INTO provider_mappings (provider, entity_type, provider_id, canonical_id, raw_name, updated_utc)
         VALUES ('espn', 'game', ?, ?, ?, ?)
         ON CONFLICT(provider, entity_type, provider_id) DO UPDATE SET canonical_id=excluded.canonical_id, updated_utc=excluded.updated_utc`
      ).run(String(e.id), game.gameId, `${awayName} @ ${homeName}`, resp.fetchedUtc);
    }

    games.push(game);
  }

  return { games, oddsByGameId, fetchedUtc: resp.fetchedUtc };
}

export interface EspnTeamStandingStats {
  teamAbbr: string;
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  pointsForPerGame: number | null;
  pointsAgainstPerGame: number | null;
  pointDiffPerGame: number | null;
  homeRecord: string | null;
  awayRecord: string | null;
  streak: string | null;
  fetchedUtc: string;
}

export async function fetchEspnStandings(
  league: LeagueCode,
  db?: DatabaseSync
): Promise<Record<string, EspnTeamStandingStats>> {
  const sportPath = SPORT_PATHS[league];
  const url = `https://site.api.espn.com/apis/v2/sports/${sportPath}/standings`;
  const resp = await fetchWithRetry(url, 600, db, league); // 10 min cache
  const result: Record<string, EspnTeamStandingStats> = {};
  if (!resp?.data) return result;

  const extractEntries = (node: any) => {
    if (node?.standings?.entries && Array.isArray(node.standings.entries)) {
      for (const entry of node.standings.entries) {
        const teamName = entry.team?.displayName || "";
        const canon = normalizeTeam(league, teamName || entry.team?.abbreviation || "");
        const abbr = canon?.abbr || entry.team?.abbreviation || "";
        if (!abbr) continue;

        const statsMap: Record<string, any> = {};
        for (const st of entry.stats || []) {
          statsMap[st.name] = st;
        }
        const wins = Number(statsMap.wins?.value ?? 0);
        const losses = Number(statsMap.losses?.value ?? 0);
        const ties = Number(statsMap.ties?.value ?? 0);
        const gp = wins + losses + ties;
        const winPct = Number(statsMap.winPercent?.value ?? (gp > 0 ? wins / gp : 0.5));
        const pf = statsMap.avgPointsFor?.value ?? (statsMap.pointsFor?.value !== undefined && gp > 0 ? Number(statsMap.pointsFor.value) / gp : null);
        const pa = statsMap.avgPointsAgainst?.value ?? (statsMap.pointsAgainst?.value !== undefined && gp > 0 ? Number(statsMap.pointsAgainst.value) / gp : null);
        const diff = statsMap.differential?.value ?? (pf !== null && pa !== null ? pf - pa : null);

        result[abbr] = {
          teamAbbr: abbr,
          teamName: canon?.name || teamName,
          wins,
          losses,
          ties,
          winPct,
          pointsForPerGame: pf !== null ? Number(Number(pf).toFixed(2)) : null,
          pointsAgainstPerGame: pa !== null ? Number(Number(pa).toFixed(2)) : null,
          pointDiffPerGame: diff !== null ? Number(Number(diff).toFixed(2)) : null,
          homeRecord: statsMap.Home?.displayValue || null,
          awayRecord: statsMap.Road?.displayValue || statsMap.Away?.displayValue || null,
          streak: statsMap.streak?.displayValue || null,
          fetchedUtc: resp.fetchedUtc
        };
      }
    }
    if (Array.isArray(node?.children)) {
      for (const c of node.children) extractEntries(c);
    }
  };

  extractEntries(resp.data);
  return result;
}

function parseNflPracticeFromComment(comment: string): "DNP" | "LP" | "FP" | "UNKNOWN" {
  const c = comment.toLowerCase();
  if (c.includes("did not practice") || c.includes("not able to practice") || c.includes("dnp") || c.includes("missed practice")) return "DNP";
  if (c.includes("limited practice") || c.includes("limited participant") || c.includes("worked on a limited basis")) return "LP";
  if (c.includes("full practice") || c.includes("full participant") || c.includes("practiced in full")) return "FP";
  return "UNKNOWN";
}

function estimateDropoffByPosition(league: LeagueCode, position: string, roleHint: string): { role: PlayerAvailabilityRecord["role"]; dropoff: number } {
  const pos = position.toUpperCase();
  const hint = roleHint.toLowerCase();
  if (league === "NFL") {
    if (pos === "QB") return { role: "qb1", dropoff: 5.8 };
    if (pos === "OT" || pos === "T" || pos === "LT" || pos === "RT") return { role: "starter", dropoff: 1.4 };
    if (pos === "WR" || pos === "TE") return { role: "starter", dropoff: 1.2 };
    if (pos === "EDGE" || pos === "DE" || pos === "CB") return { role: "starter", dropoff: 1.1 };
    if (pos === "RB") return { role: "starter", dropoff: 0.9 };
    return { role: "depth", dropoff: 0.5 };
  }
  if (league === "NBA") {
    if (hint.includes("star") || hint.includes("leading") || pos === "PG" || pos === "G" || pos === "F" || pos === "C") {
      return { role: "key_rotation", dropoff: 2.2 };
    }
    return { role: "depth", dropoff: 0.9 };
  }
  // MLB
  if (pos === "SP" || pos === "P") return { role: "sp", dropoff: 0.45 };
  return { role: "lineup", dropoff: 0.2 };
}

export async function fetchEspnInjuries(
  league: LeagueCode,
  teamAbbrFilter?: string,
  db?: DatabaseSync
): Promise<{ records: PlayerAvailabilityRecord[]; publishedUtc: string | null; ingestedUtc: string }> {
  const sportPath = SPORT_PATHS[league];
  const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/injuries`;
  const resp = await fetchWithRetry(url, 300, db, league); // 5 min cache
  const ingestedUtc = resp?.fetchedUtc || new Date().toISOString();
  if (!resp?.data?.injuries) {
    return { records: [], publishedUtc: null, ingestedUtc };
  }

  const publishedUtc: string | null = resp.data.timestamp ? new Date(resp.data.timestamp).toISOString() : null;
  const records: PlayerAvailabilityRecord[] = [];

  for (const teamGroup of resp.data.injuries) {
    const teamDisplay = teamGroup.displayName || "";
    const canon = normalizeTeam(league, teamDisplay);
    const abbr = canon?.abbr || "";
    if (teamAbbrFilter && abbr !== teamAbbrFilter) continue;

    for (const inj of teamGroup.injuries || []) {
      const athlete = inj.athlete || {};
      const playerName = athlete.displayName || "Unknown Player";
      const pos = athlete.position?.abbreviation || "";
      const comment = inj.shortComment || inj.longComment || "";
      const rawStatus = inj.status || "Questionable";
      const detailType = inj.details?.type || "";

      const isRestOrPersonal = /rest|personal|suspension|suspended|illness/i.test(`${comment} ${detailType} ${rawStatus}`);
      const est = estimateDropoffByPosition(league, pos, comment);
      const practiceStatus = league === "NFL" ? parseNflPracticeFromComment(comment) : null;

      let gameDesig: PlayerAvailabilityRecord["gameDesignation"] = "Questionable";
      const sl = rawStatus.toLowerCase();
      if (sl.includes("out")) gameDesig = "Out";
      else if (sl.includes("doubtful")) gameDesig = "Doubtful";
      else if (sl.includes("day-to-day")) gameDesig = "Day-To-Day";
      else if (sl.includes("injured reserve") || sl === "ir") gameDesig = "IR";
      else if (sl.includes("suspend")) gameDesig = "Suspended";
      else if (/rest/i.test(detailType) || /rest/i.test(comment)) gameDesig = "Rest";
      else if (sl.includes("questionable")) gameDesig = "Questionable";
      else if (sl.includes("probable")) gameDesig = "Probable";

      // If player is on IR or long-term out (return date weeks away), baseline stats already reflect absence (~70%)
      const alreadyInBaseline = gameDesig === "IR" || /weeks|month|season/i.test(comment) ? 0.70 : 0.15;

      records.push({
        playerId: String(athlete.id || `${abbr}_${playerName}`),
        playerName,
        teamAbbr: abbr || teamDisplay,
        position: pos,
        role: est.role,
        practiceStatus,
        gameDesignation: gameDesig,
        injuryOrReason: detailType ? `${detailType}: ${comment}` : comment || (isRestOrPersonal ? "Rest / Illness / Status" : "Injury listed"),
        confirmedParticipationProb: null,
        expectedWorkloadPct: gameDesig === "Out" || gameDesig === "IR" || gameDesig === "Suspended" ? 0 : 1.0,
        replacementName: `${abbr} ${pos || "Rotation"} Backup`,
        replacementDropoffPoints: est.dropoff,
        alreadyReflectedInBaselinePct: alreadyInBaseline,
        source: "espn_injuries_feed",
        sourcePublishedUtc: inj.date ? new Date(inj.date).toISOString() : publishedUtc,
        ingestedUtc,
        status: "confirmed"
      });
    }
  }

  return { records, publishedUtc, ingestedUtc };
}
