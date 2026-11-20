import { DatabaseSync } from "node:sqlite";
import { CanonicalGame, CompetitionPhase, DataStatus, GameStatus } from "../core/types";
import { getVenueForGame, normalizeTeam } from "../core/venues";
import { logMonitoringEvent } from "../db/database";

export interface MlbPitcherProfile {
  playerId: number;
  fullName: string;
  throwsHand: "L" | "R" | "unknown";
  inningsPitched: number;
  gamesStarted: number;
  avgIpPerStart: number;
  k9: number | null;
  bb9: number | null;
  hr9: number | null;
  fip: number | null;
  era: number | null;
  whip: number | null;
  status: DataStatus;
}

export interface MlbScheduleGameDetails {
  game: CanonicalGame;
  homePitcher: MlbPitcherProfile | null;
  awayPitcher: MlbPitcherProfile | null;
  homeLineupConfirmed: boolean;
  awayLineupConfirmed: boolean;
  homeLineupNames: string[];
  awayLineupNames: string[];
  weatherReported: { tempF: number | null; condition: string | null; wind: string | null };
  fetchedUtc: string;
}

const mlbCache = new Map<string, { data: any; fetchedUtc: string; expiresAtMs: number }>();

async function fetchMlbJson(url: string, ttlSec: number, db?: DatabaseSync): Promise<{ data: any; fetchedUtc: string } | null> {
  const c = mlbCache.get(url);
  if (c && Date.now() < c.expiresAtMs) return { data: c.data, fetchedUtc: c.fetchedUtc };
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "sports-analytics-engine/1.0" },
      signal: AbortSignal.timeout(7000)
    });
    if (!res.ok) throw new Error(`MLB Stats API HTTP ${res.status}`);
    const data = await res.json();
    const fetchedUtc = new Date().toISOString();
    mlbCache.set(url, { data, fetchedUtc, expiresAtMs: Date.now() + ttlSec * 1000 });
    return { data, fetchedUtc };
  } catch (err: any) {
    if (db) {
      logMonitoringEvent(db, {
        severity: "warn",
        source: "mlb_stats_api",
        league: "MLB",
        eventType: "feed_fetch_failed",
        message: `MLB Stats API failed: ${err?.message}`
      });
    }
    return null;
  }
}

export function computeFip(params: {
  homeRuns: number;
  walks: number;
  hitBatsmen: number;
  strikeouts: number;
  inningsPitched: number;
  fipConstant?: number;
}): number | null {
  if (!Number.isFinite(params.inningsPitched) || params.inningsPitched <= 0) return null;
  const cFip = params.fipConstant ?? 3.10; // Historical MLB constant ~3.10-3.20
  const raw = (13 * params.homeRuns + 3 * (params.walks + params.hitBatsmen) - 2 * params.strikeouts) / params.inningsPitched + cFip;
  return Number(Math.max(1.0, Math.min(9.0, raw)).toFixed(2));
}

function parseInningsPitched(ipStr: string | number | undefined): number {
  if (typeof ipStr === "number") return ipStr;
  if (!ipStr) return 0;
  const parts = String(ipStr).split(".");
  const whole = Number(parts[0] || 0);
  const thirds = Number(parts[1] || 0);
  return whole + thirds / 3;
}

export async function fetchMlbPitcherSeasonProfile(
  playerId: number,
  fullName: string,
  season: number,
  db?: DatabaseSync
): Promise<MlbPitcherProfile> {
  const url = `https://statsapi.mlb.com/api/v1/people/${playerId}?hydrate=stats(group=[pitching],type=[season],season=${season})`;
  const resp = await fetchMlbJson(url, 1800, db);
  const person = resp?.data?.people?.[0];
  const stat = person?.stats?.[0]?.splits?.[0]?.stat;

  if (!stat) {
    return {
      playerId,
      fullName,
      throwsHand: person?.pitchHand?.code === "L" ? "L" : person?.pitchHand?.code === "R" ? "R" : "unknown",
      inningsPitched: 0,
      gamesStarted: 0,
      avgIpPerStart: 5.2,
      k9: null,
      bb9: null,
      hr9: null,
      fip: null,
      era: null,
      whip: null,
      status: "missing"
    };
  }

  const ip = parseInningsPitched(stat.inningsPitched);
  const gs = Number(stat.gamesStarted || stat.gamesPlayed || 1);
  const hr = Number(stat.homeRuns || 0);
  const bb = Number(stat.baseOnBalls || 0);
  const hbp = Number(stat.hitByPitch || 0);
  const k = Number(stat.strikeOuts || 0);

  return {
    playerId,
    fullName,
    throwsHand: person?.pitchHand?.code === "L" ? "L" : person?.pitchHand?.code === "R" ? "R" : "unknown",
    inningsPitched: Number(ip.toFixed(1)),
    gamesStarted: gs,
    avgIpPerStart: ip > 0 && gs > 0 ? Number(Math.min(7.2, Math.max(3.0, ip / gs)).toFixed(2)) : 5.2,
    k9: ip > 0 ? Number(((k * 9) / ip).toFixed(2)) : null,
    bb9: ip > 0 ? Number(((bb * 9) / ip).toFixed(2)) : null,
    hr9: ip > 0 ? Number(((hr * 9) / ip).toFixed(2)) : null,
    fip: computeFip({ homeRuns: hr, walks: bb, hitBatsmen: hbp, strikeouts: k, inningsPitched: ip }),
    era: stat.era !== undefined ? Number(stat.era) : null,
    whip: stat.whip !== undefined ? Number(stat.whip) : null,
    status: ip >= 15 ? "confirmed" : "projected"
  };
}

function mapMlbPhase(gameType: string | undefined): CompetitionPhase {
  if (gameType === "S") return "preseason";
  if (gameType === "R") return "regular";
  if (["F", "D", "L", "W"].includes(gameType || "")) return "postseason";
  return "unknown";
}

function mapMlbStatus(abstractState: string | undefined, detailedState: string | undefined): GameStatus {
  const det = (detailedState || "").toLowerCase();
  if (det.includes("postponed")) return "postponed";
  if (det.includes("cancel")) return "canceled";
  if (det.includes("suspend")) return "suspended";
  if (abstractState === "Final" || det.includes("final")) return "final";
  if (abstractState === "Live") return "in_progress";
  return "scheduled";
}

export async function fetchMlbHydratedSchedule(params: {
  startDate: string; // YYYY-MM-DD
  endDate: string;
  db?: DatabaseSync;
  hydratePitcherStats?: boolean;
}): Promise<MlbScheduleGameDetails[]> {
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${params.startDate}&endDate=${params.endDate}&hydrate=probablePitcher,lineups,venue,weather,team`;
  const resp = await fetchMlbJson(url, params.startDate === params.endDate ? 180 : 3600, params.db);
  if (!resp?.data?.dates) return [];

  const results: MlbScheduleGameDetails[] = [];
  for (const d of resp.data.dates) {
    for (const g of d.games || []) {
      const homeRaw = g.teams?.home?.team?.name || "";
      const awayRaw = g.teams?.away?.team?.name || "";
      const homeCanon = normalizeTeam("MLB", homeRaw);
      const awayCanon = normalizeTeam("MLB", awayRaw);
      const homeAbbr = homeCanon?.abbr || g.teams?.home?.team?.abbreviation || "HOME";
      const awayAbbr = awayCanon?.abbr || g.teams?.away?.team?.abbreviation || "AWAY";
      const homeName = homeCanon?.name || homeRaw;
      const awayName = awayCanon?.name || awayRaw;

      const startUtc = new Date(g.gameDate).toISOString();
      const venueMeta = getVenueForGame("MLB", homeName, { venueName: g.venue?.name });
      const dhNum = g.doubleHeader === "Y" || g.doubleHeader === "S" ? Number(g.gameNumber || 1) : null;
      const status = mapMlbStatus(g.status?.abstractGameState, g.status?.detailedState);
      const season = Number(g.season || startUtc.slice(0, 4));
      const gameId = `MLB_${g.officialDate || startUtc.slice(0, 10)}_${awayAbbr}_${homeAbbr}${dhNum ? `_G${dhNum}` : ""}`;

      const homeScore = g.teams?.home?.score !== undefined ? Number(g.teams.home.score) : null;
      const awayScore = g.teams?.away?.score !== undefined ? Number(g.teams.away.score) : null;

      const game: CanonicalGame = {
        gameId,
        league: "MLB",
        season,
        competitionPhase: mapMlbPhase(g.gameType),
        homeTeamId: `MLB_${homeAbbr}`,
        awayTeamId: `MLB_${awayAbbr}`,
        homeTeamName: homeName,
        awayTeamName: awayName,
        homeTeamAbbr: homeAbbr,
        awayTeamAbbr: awayAbbr,
        venueId: venueMeta?.venueId || `mlb_${homeAbbr.toLowerCase()}`,
        venueName: g.venue?.name || venueMeta?.name || `${homeName} Ballpark`,
        venueTimezone: venueMeta?.timezone || "America/New_York",
        scheduledStartUtc: startUtc,
        neutralSite: false,
        doubleheaderGameNum: dhNum,
        status,
        homeScore: Number.isFinite(homeScore) ? homeScore : null,
        awayScore: Number.isFinite(awayScore) ? awayScore : null,
        wentOvertime: false,
        overtimePeriods: 0,
        isTie: Boolean(g.isTie),
        rescheduledFromUtc: g.rescheduleDate ? new Date(g.rescheduleDate).toISOString() : null,
        providerIds: { mlb_gamePk: String(g.gamePk) }
      };

      let homePitcher: MlbPitcherProfile | null = null;
      let awayPitcher: MlbPitcherProfile | null = null;

      const hp = g.teams?.home?.probablePitcher;
      const ap = g.teams?.away?.probablePitcher;
      if (params.hydratePitcherStats && hp?.id) {
        homePitcher = await fetchMlbPitcherSeasonProfile(hp.id, hp.fullName, season, params.db);
      } else if (hp?.fullName) {
        homePitcher = {
          playerId: Number(hp.id || 0),
          fullName: hp.fullName,
          throwsHand: "unknown",
          inningsPitched: 0,
          gamesStarted: 0,
          avgIpPerStart: 5.5,
          k9: null,
          bb9: null,
          hr9: null,
          fip: null,
          era: null,
          whip: null,
          status: "projected"
        };
      }

      if (params.hydratePitcherStats && ap?.id) {
        awayPitcher = await fetchMlbPitcherSeasonProfile(ap.id, ap.fullName, season, params.db);
      } else if (ap?.fullName) {
        awayPitcher = {
          playerId: Number(ap.id || 0),
          fullName: ap.fullName,
          throwsHand: "unknown",
          inningsPitched: 0,
          gamesStarted: 0,
          avgIpPerStart: 5.5,
          k9: null,
          bb9: null,
          hr9: null,
          fip: null,
          era: null,
          whip: null,
          status: "projected"
        };
      }

      const homeLineupNames = (g.lineups?.homePlayers || []).map((p: any) => p.fullName).filter(Boolean);
      const awayLineupNames = (g.lineups?.awayPlayers || []).map((p: any) => p.fullName).filter(Boolean);

      results.push({
        game,
        homePitcher,
        awayPitcher,
        homeLineupConfirmed: homeLineupNames.length >= 9,
        awayLineupConfirmed: awayLineupNames.length >= 9,
        homeLineupNames,
        awayLineupNames,
        weatherReported: {
          tempF: g.weather?.temp ? Number(g.weather.temp) : null,
          condition: g.weather?.condition || null,
          wind: g.weather?.wind || null
        },
        fetchedUtc: resp.fetchedUtc
      });
    }
  }

  return results;
}
