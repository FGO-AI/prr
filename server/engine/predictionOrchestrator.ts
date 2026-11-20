import { DatabaseSync } from "node:sqlite";
import { getDb, logMonitoringEvent, stableHash } from "../db/database";
import { checkFreshnessStatus, isAvailableAtCutoff } from "../core/cutoffGuard";
import { FEATURE_REGISTRY_VERSION } from "../core/featureRegistry";
import { analyzeMarketPricing, decimalToAmerican, settleMarketOutcome, SETTLEMENT_RULES_VERSIONS } from "../core/marketPricing";
import {
  CanonicalGame,
  DataStatus,
  LeagueCode,
  MarketSnapshot,
  PlayerAvailabilityRecord,
  PredictionSnapshotOutput,
  TravelRestMetrics,
  VenueMetadata,
  WeatherForecastVintage
} from "../core/types";
import { computeTimezoneShift, formatUtcAndLocal, getVenueForGame, haversineMiles, normalizeTeam } from "../core/venues";
import { clampProb, LogisticParameters } from "../models/calibration";
import { MLB_MODEL_VERSION, runMlbModel } from "../models/mlbModel";
import { NBA_MODEL_VERSION, runNbaModel } from "../models/nbaModel";
import { NFL_EPA_DEFINITION, NFL_MODEL_VERSION, NFL_SUCCESS_RATE_DEFINITION, runNflModel } from "../models/nflModel";
import { EspnTeamStandingStats, fetchEspnInjuries, fetchEspnScoreboard, fetchEspnStandings } from "../providers/espnAdapter";
import { fetchMlbHydratedSchedule, MlbPitcherProfile } from "../providers/mlbStatsAdapter";
import {
  computeNflRollingMetricsBeforeDate,
  loadNflverseGames,
  loadNflverseTeamWeekStats,
  NflverseGameRow,
  NflverseTeamWeekRow
} from "../providers/nflverseAdapter";
import { fetchNwsVenueWeather } from "../providers/nwsWeatherAdapter";
import { fetchOddsSnapshotForGame } from "../providers/oddsApiAdapter";

// In-memory TTL cache for heavy NFLverse CSVs so per-request latency stays low
let nflverseMemCache: { games: NflverseGameRow[]; stats: NflverseTeamWeekRow[]; expiresAt: number } | null = null;

async function getNflverseDataCached(): Promise<{ games: NflverseGameRow[]; stats: NflverseTeamWeekRow[] }> {
  if (nflverseMemCache && Date.now() < nflverseMemCache.expiresAt) {
    return { games: nflverseMemCache.games, stats: nflverseMemCache.stats };
  }
  const currentYear = new Date().getUTCFullYear();
  const seasons = [currentYear - 2, currentYear - 1, currentYear];
  const [games, stats] = await Promise.all([
    loadNflverseGames(),
    loadNflverseTeamWeekStats(seasons)
  ]);
  nflverseMemCache = { games, stats, expiresAt: Date.now() + 15 * 60 * 1000 };
  return { games, stats };
}

function getLearnedParamsForLeague(db: DatabaseSync, league: LeagueCode): {
  params: LogisticParameters | null;
  calibrationVersion: string;
} {
  try {
    const row = db
      .prepare(`SELECT run_id, metrics_json FROM evaluation_runs WHERE league = ? ORDER BY created_utc DESC LIMIT 1`)
      .get(league) as any;
    if (row?.metrics_json) {
      const parsed = JSON.parse(row.metrics_json);
      if (parsed.learnedParams) {
        return { params: parsed.learnedParams, calibrationVersion: row.run_id };
      }
    }
  } catch {
    // Non-fatal
  }
  return { params: null, calibrationVersion: "uncalibrated_prior_v1" };
}

function buildDefaultNbaRotationRoster(teamAbbr: string, topScorers: string[]): Array<{
  playerName: string;
  position: string;
  baselineMinutes: number;
  role: string;
}> {
  const names = [...topScorers];
  const slots = [
    { pos: "PG", mins: 34.5, role: "starter" },
    { pos: "SG", mins: 33.0, role: "starter" },
    { pos: "SF", mins: 32.0, role: "starter" },
    { pos: "PF", mins: 30.5, role: "starter" },
    { pos: "C", mins: 29.0, role: "starter" },
    { pos: "G", mins: 23.0, role: "sixth_man" },
    { pos: "F", mins: 19.5, role: "rotation" },
    { pos: "C", mins: 16.5, role: "backup_big" },
    { pos: "G", mins: 12.5, role: "depth" },
    { pos: "F", mins: 9.5, role: "depth" }
  ];
  return slots.map((s, idx) => ({
    playerName: names[idx] || `${teamAbbr} ${s.pos}${idx + 1}`,
    position: s.pos,
    baselineMinutes: s.mins,
    role: s.role
  }));
}

export async function listCanonicalSchedule(league: LeagueCode, db?: DatabaseSync): Promise<{
  games: CanonicalGame[];
  legacyGames: Array<Record<string, any>>;
  fetchedUtc: string;
}> {
  const database = db || getDb();
  const { games: espnGames, oddsByGameId, fetchedUtc } = await fetchEspnScoreboard(league, undefined, database);

  // If MLB, also enrich with MLB Stats API today's schedule for probable pitchers & doubleheaders
  let mlbDetailsByTeamKey = new Map<string, { homeSp: string | null; awaySp: string | null; dhNum: number | null; status: CanonicalGame["status"] }>();
  if (league === "MLB") {
    const todayStr = new Date().toISOString().slice(0, 10);
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const mlbSched = await fetchMlbHydratedSchedule({ startDate: todayStr, endDate: tomorrowStr, db: database, hydratePitcherStats: false });
    for (const item of mlbSched) {
      const key = `${item.game.awayTeamAbbr}_${item.game.homeTeamAbbr}`;
      mlbDetailsByTeamKey.set(key, {
        homeSp: item.homePitcher?.fullName || null,
        awaySp: item.awayPitcher?.fullName || null,
        dhNum: item.game.doubleheaderGameNum,
        status: item.game.status
      });
    }
  }

  const legacyGames = espnGames.map(g => {
    const times = formatUtcAndLocal(g.scheduledStartUtc, g.venueTimezone);
    const espnOdds = oddsByGameId[g.gameId];
    const bookSpread = typeof espnOdds?.spread === "number" ? espnOdds.spread : league === "MLB" ? -1.5 : league === "NFL" ? -3.0 : -4.5;
    const bookTotal = typeof espnOdds?.overUnder === "number" ? espnOdds.overUnder : league === "MLB" ? 8.5 : league === "NFL" ? 45.5 : 222.0;

    // Extract actual book moneylines ONLY if present on feed — never invent them!
    const rawHomeMl = espnOdds?.homeTeamOdds?.moneyLine ?? null;
    const rawAwayMl = espnOdds?.awayTeamOdds?.moneyLine ?? null;
    const hasLiveMarketOdds = typeof rawHomeMl === "number" && typeof rawAwayMl === "number";

    const mlbExtra = mlbDetailsByTeamKey.get(`${g.awayTeamAbbr}_${g.homeTeamAbbr}`);

    return {
      id: g.gameId,
      homeTeam: g.homeTeamName,
      awayTeam: g.awayTeamName,
      gameTime: times.local,
      utcStart: times.utc,
      localStart: times.local,
      venueName: g.venueName,
      venueTimezone: g.venueTimezone,
      neutralSite: g.neutralSite,
      doubleheaderGameNum: mlbExtra?.dhNum ?? g.doubleheaderGameNum,
      status: mlbExtra?.status ?? g.status,
      competitionPhase: g.competitionPhase,
      bookSpread,
      bookTotal,
      bookHomeML: hasLiveMarketOdds ? rawHomeMl : undefined,
      bookAwayML: hasLiveMarketOdds ? rawAwayMl : undefined,
      hasLiveMarketOdds,
      homeProbablePitcher: mlbExtra?.homeSp ?? null,
      awayProbablePitcher: mlbExtra?.awaySp ?? null,
      canonicalGame: g
    };
  });

  return { games: espnGames, legacyGames, fetchedUtc };
}

export function computeTravelAndRestFromHistory(params: {
  league: LeagueCode;
  homeAbbr: string;
  awayAbbr: string;
  targetStartUtc: string;
  targetVenue: VenueMetadata | null;
  db: DatabaseSync;
  nflGames?: NflverseGameRow[];
}): TravelRestMetrics {
  const targetMs = Date.parse(params.targetStartUtc);
  const cutoffIso = params.targetStartUtc;
  const sevenDaysAgoIso = new Date(targetMs - 7 * 86400000).toISOString();

  // Query prior games from SQLite strictly before targetStartUtc
  const queryRecent = (teamAbbr: string) =>
    params.db
      .prepare(
        `SELECT game_id, home_team_abbr, away_team_abbr, home_team_name, venue_id, venue_timezone, scheduled_start_utc, neutral_site
         FROM games
         WHERE league = ? AND (home_team_abbr = ? OR away_team_abbr = ?)
           AND scheduled_start_utc < ? AND status IN ('final', 'scheduled', 'in_progress')
         ORDER BY scheduled_start_utc DESC LIMIT 10`
      )
      .all(params.league, teamAbbr, teamAbbr, cutoffIso) as Array<any>;

  let homePrior = queryRecent(params.homeAbbr);
  let awayPrior = queryRecent(params.awayAbbr);

  // If NFL and DB has sparse history, supplement from nflverse games strictly before gameday
  if (params.league === "NFL" && params.nflGames && (homePrior.length === 0 || awayPrior.length === 0)) {
    const cutoffDate = params.targetStartUtc.slice(0, 10);
    const mapNfl = (abbr: string) =>
      params.nflGames!
        .filter(g => g.gameday < cutoffDate && (normalizeTeam("NFL", g.home_team)?.abbr === abbr || normalizeTeam("NFL", g.away_team)?.abbr === abbr))
        .sort((a, b) => b.gameday.localeCompare(a.gameday))
        .slice(0, 5)
        .map(g => {
          const hCanon = normalizeTeam("NFL", g.home_team);
          return {
            game_id: g.game_id,
            home_team_abbr: hCanon?.abbr || g.home_team,
            away_team_abbr: normalizeTeam("NFL", g.away_team)?.abbr || g.away_team,
            home_team_name: hCanon?.name || g.home_team,
            venue_timezone: hCanon?.venue.timezone || "America/New_York",
            scheduled_start_utc: `${g.gameday}T${g.gametime || "18:00"}:00Z`,
            neutral_site: g.location !== "Home" ? 1 : 0
          };
        });
    if (homePrior.length === 0) homePrior = mapNfl(params.homeAbbr);
    if (awayPrior.length === 0) awayPrior = mapNfl(params.awayAbbr);
  }

  const calcRest = (rows: any[]) => {
    if (rows.length === 0) return null;
    const prevMs = Date.parse(rows[0].scheduled_start_utc);
    return Math.max(0, Math.round((targetMs - prevMs) / 86400000));
  };

  const homeRestDays = calcRest(homePrior);
  const awayRestDays = calcRest(awayPrior);
  const homeIsB2B = params.league !== "NFL" && homeRestDays !== null && homeRestDays <= 1;
  const awayIsB2B = params.league !== "NFL" && awayRestDays !== null && awayRestDays <= 1;
  const homeShortWeek = params.league === "NFL" && homeRestDays !== null && homeRestDays <= 5;
  const awayShortWeek = params.league === "NFL" && awayRestDays !== null && awayRestDays <= 5;
  const homeOffBye = params.league === "NFL" && homeRestDays !== null && homeRestDays >= 10;
  const awayOffBye = params.league === "NFL" && awayRestDays !== null && awayRestDays >= 10;

  let awayTravelMilesFromPrev: number | null = null;
  let homeTravelMilesFromPrev: number | null = null;
  let awayTimezonesCrossed: number | null = null;
  let awayTravelDirection: TravelRestMetrics["awayTravelDirection"] = "unknown";

  if (params.targetVenue && awayPrior.length > 0) {
    const prevVenue = getVenueForGame(params.league, awayPrior[0].home_team_name);
    if (prevVenue) {
      awayTravelMilesFromPrev = haversineMiles(prevVenue.lat, prevVenue.lon, params.targetVenue.lat, params.targetVenue.lon);
      const tz = computeTimezoneShift(prevVenue.timezone, params.targetVenue.timezone);
      awayTimezonesCrossed = tz.hoursDiff;
      awayTravelDirection = tz.direction;
    }
  }
  if (params.targetVenue && homePrior.length > 0) {
    const prevVenue = getVenueForGame(params.league, homePrior[0].home_team_name);
    if (prevVenue) {
      homeTravelMilesFromPrev = haversineMiles(prevVenue.lat, prevVenue.lon, params.targetVenue.lat, params.targetVenue.lon);
    }
  }

  let roadTripNum: number | null = null;
  if (awayPrior.length > 0) {
    let count = 1;
    for (const r of awayPrior) {
      if (r.away_team_abbr === params.awayAbbr) count++;
      else break;
    }
    roadTripNum = count;
  }

  const densityHome = homePrior.filter(r => r.scheduled_start_utc >= sevenDaysAgoIso).length;
  const densityAway = awayPrior.filter(r => r.scheduled_start_utc >= sevenDaysAgoIso).length;

  const hasAny = homePrior.length > 0 || awayPrior.length > 0;
  return {
    homeRestDays,
    awayRestDays,
    homeIsB2B,
    awayIsB2B,
    homeShortWeek,
    awayShortWeek,
    homeOffBye,
    awayOffBye,
    awayTravelMilesFromPrev,
    homeTravelMilesFromPrev,
    awayTimezonesCrossed,
    awayTravelDirection,
    awayRoadTripGameNum: roadTripNum,
    arrivalTimingStatus: "unknown", // Intentionally never invented
    scheduleDensityLast7DaysHome: homePrior.length > 0 ? densityHome : null,
    scheduleDensityLast7DaysAway: awayPrior.length > 0 ? densityAway : null,
    status: hasAny ? "confirmed" : "missing"
  };
}

export async function generatePrediction(params: {
  league: LeagueCode;
  homeTeam: string;
  awayTeam: string;
  gameId?: string;
  cutoffUtc?: string;
  bookSpread?: number | null;
  bookTotal?: number | null;
  bookHomeML?: number | null;
  bookAwayML?: number | null;
  customParams?: Record<string, any>;
  db?: DatabaseSync;
}): Promise<{
  legacyResponse: Record<string, any>;
  engineSnapshot: PredictionSnapshotOutput;
}> {
  const database = params.db || getDb();
  const cutoffUtc = params.cutoffUtc || new Date().toISOString();
  const league = params.league;

  const homeCanon = normalizeTeam(league, params.homeTeam);
  const awayCanon = normalizeTeam(league, params.awayTeam);
  const homeAbbr = homeCanon?.abbr || params.homeTeam.slice(0, 3).toUpperCase();
  const awayAbbr = awayCanon?.abbr || params.awayTeam.slice(0, 3).toUpperCase();
  const homeName = homeCanon?.name || params.homeTeam;
  const awayName = awayCanon?.name || params.awayTeam;

  // 1. Resolve Canonical Game from schedule or DB
  let game: CanonicalGame | null = null;
  if (params.gameId) {
    const dbGame = database.prepare(`SELECT * FROM games WHERE game_id = ?`).get(params.gameId) as any;
    if (dbGame) {
      game = {
        gameId: dbGame.game_id,
        league: dbGame.league,
        season: dbGame.season,
        competitionPhase: dbGame.competition_phase,
        homeTeamId: dbGame.home_team_id,
        awayTeamId: dbGame.away_team_id,
        homeTeamName: dbGame.home_team_name,
        awayTeamName: dbGame.away_team_name,
        homeTeamAbbr: dbGame.home_team_abbr,
        awayTeamAbbr: dbGame.away_team_abbr,
        venueId: dbGame.venue_id,
        venueName: dbGame.venue_name,
        venueTimezone: dbGame.venue_timezone,
        scheduledStartUtc: dbGame.scheduled_start_utc,
        neutralSite: Boolean(dbGame.neutral_site),
        doubleheaderGameNum: dbGame.doubleheader_game_num,
        status: dbGame.status,
        homeScore: dbGame.home_score,
        awayScore: dbGame.away_score,
        wentOvertime: Boolean(dbGame.went_overtime),
        overtimePeriods: dbGame.overtime_periods,
        isTie: Boolean(dbGame.is_tie),
        rescheduledFromUtc: dbGame.rescheduled_from_utc,
        providerIds: JSON.parse(dbGame.provider_ids_json || "{}")
      };
    }
  }

  if (!game) {
    const liveSched = await fetchEspnScoreboard(league, undefined, database);
    const matched = liveSched.games.find(
      g => (g.homeTeamAbbr === homeAbbr && g.awayTeamAbbr === awayAbbr) || (params.gameId && g.gameId === params.gameId)
    );
    if (matched) {
      game = matched;
    }
  }

  const venue = getVenueForGame(league, homeName, {
    venueName: game?.venueName,
    neutralSite: game?.neutralSite
  });

  if (!game) {
    const startUtc = new Date(Date.parse(cutoffUtc) + 2 * 3600 * 1000).toISOString();
    game = {
      gameId: params.gameId || `${league}_${cutoffUtc.slice(0, 10)}_${awayAbbr}_${homeAbbr}`,
      league,
      season: new Date(cutoffUtc).getUTCFullYear(),
      competitionPhase: params.customParams?.isPlayoff ? "postseason" : "regular",
      homeTeamId: `${league}_${homeAbbr}`,
      awayTeamId: `${league}_${awayAbbr}`,
      homeTeamName: homeName,
      awayTeamName: awayName,
      homeTeamAbbr: homeAbbr,
      awayTeamAbbr: awayAbbr,
      venueId: venue?.venueId || `${league.toLowerCase()}_${homeAbbr.toLowerCase()}`,
      venueName: venue?.name || `${homeName} Venue`,
      venueTimezone: venue?.timezone || "America/New_York",
      scheduledStartUtc: startUtc,
      neutralSite: Boolean(params.customParams?.neutralSite),
      doubleheaderGameNum: null,
      status: "scheduled",
      homeScore: null,
      awayScore: null,
      wentOvertime: false,
      overtimePeriods: 0,
      isTie: false,
      rescheduledFromUtc: null,
      providerIds: {}
    };
    database
      .prepare(
        `INSERT OR IGNORE INTO games (
          game_id, league, season, competition_phase, home_team_id, away_team_id,
          home_team_name, away_team_name, home_team_abbr, away_team_abbr,
          venue_id, venue_name, venue_timezone, scheduled_start_utc, neutral_site,
          doubleheader_game_num, status, home_score, away_score, went_overtime,
          overtime_periods, is_tie, rescheduled_from_utc, provider_ids_json, created_utc, updated_utc
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        game.gameId, game.league, game.season, game.competitionPhase, game.homeTeamId, game.awayTeamId,
        game.homeTeamName, game.awayTeamName, game.homeTeamAbbr, game.awayTeamAbbr,
        game.venueId, game.venueName, game.venueTimezone, game.scheduledStartUtc, game.neutralSite ? 1 : 0,
        game.doubleheaderGameNum, game.status, null, null, 0, 0, 0, null, "{}", cutoffUtc, cutoffUtc
      );
  }

  // 2. Fetch point-in-time-safe supporting feeds concurrently
  const [weather, injResp, standingsMap, oddsSnap] = await Promise.all([
    fetchNwsVenueWeather({
      gameId: game.gameId,
      venue,
      scheduledStartUtc: game.scheduledStartUtc,
      cutoffUtc,
      db: database
    }),
    fetchEspnInjuries(league, undefined, database),
    fetchEspnStandings(league, database),
    fetchOddsSnapshotForGame({
      league,
      gameId: game.gameId,
      homeTeamName: game.homeTeamName,
      awayTeamName: game.awayTeamName,
      cutoffUtc,
      userSupplied: {
        homePriceAmerican: params.bookHomeML ?? null,
        awayPriceAmerican: params.bookAwayML ?? null,
        spreadLine: params.bookSpread ?? null
      },
      db: database
    })
  ]);

  // Enforce cutoff & freshness on injury records
  const teamInjuries: PlayerAvailabilityRecord[] = [];
  for (const r of injResp.records) {
    if (r.teamAbbr !== game.homeTeamAbbr && r.teamAbbr !== game.awayTeamAbbr) continue;
    const earliest = r.sourcePublishedUtc || r.ingestedUtc;
    if (!isAvailableAtCutoff(earliest, cutoffUtc).allowed) continue;
    const freshness = checkFreshnessStatus(earliest, cutoffUtc, 360);
    teamInjuries.push({ ...r, status: freshness === "stale" ? "stale" : r.status });
  }

  const homeStanding: EspnTeamStandingStats | null = standingsMap[game.homeTeamAbbr] || null;
  const awayStanding: EspnTeamStandingStats | null = standingsMap[game.awayTeamAbbr] || null;

  // League-specific data resolution
  let nflGames: NflverseGameRow[] | undefined;
  let nflStats: NflverseTeamWeekRow[] | undefined;
  if (league === "NFL") {
    try {
      const nv = await getNflverseDataCached();
      nflGames = nv.games;
      nflStats = nv.stats;
    } catch (e: any) {
      logMonitoringEvent(database, {
        severity: "warn",
        source: "nflverse",
        league: "NFL",
        eventType: "nflverse_load_failed",
        message: e?.message || "Failed to load nflverse data"
      });
    }
  }

  const travelRest = computeTravelAndRestFromHistory({
    league,
    homeAbbr: game.homeTeamAbbr,
    awayAbbr: game.awayTeamAbbr,
    targetStartUtc: game.scheduledStartUtc,
    targetVenue: venue,
    db: database,
    nflGames
  });

  const { params: learnedParams, calibrationVersion } = getLearnedParamsForLeague(database, league);

  // 3. Persist immutable input snapshot
  const snapshotPayload = {
    game,
    cutoffUtc,
    weatherForecastId: weather.forecastId,
    weatherStatus: weather.status,
    injuryCount: teamInjuries.length,
    homeStanding: homeStanding ? { winPct: homeStanding.winPct, pointDiff: homeStanding.pointDiffPerGame } : null,
    awayStanding: awayStanding ? { winPct: awayStanding.winPct, pointDiff: awayStanding.pointDiffPerGame } : null,
    travelRest,
    oddsId: oddsSnap?.oddsId || null
  };
  const inputHash = stableHash(snapshotPayload);
  const snapshotId = `snap_${game.gameId}_${inputHash}_${Date.now()}`;
  const earliestKnownUtc = injResp.publishedUtc || weather.issuedUtc || cutoffUtc;

  database
    .prepare(
      `INSERT OR IGNORE INTO input_snapshots (
        snapshot_id, game_id, league, cutoff_utc, source, source_published_utc,
        event_time_utc, ingested_utc, earliest_known_utc, status, input_hash, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      snapshotId,
      game.gameId,
      league,
      cutoffUtc,
      "multi_provider_orchestrator",
      injResp.publishedUtc || weather.issuedUtc || null,
      game.scheduledStartUtc,
      new Date().toISOString(),
      earliestKnownUtc <= cutoffUtc ? earliestKnownUtc : cutoffUtc,
      homeStanding && awayStanding ? "confirmed" : "projected",
      inputHash,
      JSON.stringify(snapshotPayload)
    );

  // 4. Execute sport-specific quantitative model
  let homeWinProb = 0.5;
  let awayWinProb = 0.5;
  let tieProb = 0;
  let projectedMargin: number | null = 0;
  let projectedTotal: number | null = null;
  let uncertaintySigmaMargin: number | null = null;
  let modelVersion = "";
  let scenarios: PredictionSnapshotOutput["scenarios"] = [];
  let topDrivers: PredictionSnapshotOutput["topDrivers"] = [];
  let leagueNotes: string[] = [];
  let nbaRotations: PredictionSnapshotOutput["nbaRotations"];
  let mlbPitchingPlan: PredictionSnapshotOutput["mlbPitchingPlan"];
  let nflMatchupContext: PredictionSnapshotOutput["nflMatchupContext"];

  const provisionalReasons: string[] = [];

  if (league === "NFL") {
    modelVersion = NFL_MODEL_VERSION;
    const gamedayStr = cutoffUtc.slice(0, 10);
    const hr =
      nflGames && nflStats
        ? computeNflRollingMetricsBeforeDate({
            teamAbbr: game.homeTeamAbbr,
            cutoffGameday: gamedayStr,
            games: nflGames,
            teamWeekStats: nflStats
          })
        : null;
    const ar =
      nflGames && nflStats
        ? computeNflRollingMetricsBeforeDate({
            teamAbbr: game.awayTeamAbbr,
            cutoffGameday: gamedayStr,
            games: nflGames,
            teamWeekStats: nflStats
          })
        : null;

    if (!hr || !ar) {
      provisionalReasons.push("Current-week nflverse EPA unavailable prior to cutoff; falling back to ESPN standings differential.");
    }

    const nflOut = runNflModel({
      game,
      venue,
      weather,
      travelRest,
      homeRolling: hr,
      awayRolling: ar,
      homeStanding,
      awayStanding,
      injuries: teamInjuries,
      learnedParams,
      customOverrides: {
        homeDVOA: params.customParams?.homeDVOA,
        awayDVOA: params.customParams?.awayDVOA,
        isBackupQBHome: params.customParams?.isBackupQBHome,
        isBackupQBAway: params.customParams?.isBackupQBAway,
        isOffByeHome: params.customParams?.isOffByeHome,
        isOffByeAway: params.customParams?.isOffByeAway,
        isShortWeekHome: params.customParams?.isShortWeekHome,
        isShortWeekAway: params.customParams?.isShortWeekAway,
        windMph: params.customParams?.weatherWindNFL
      }
    });

    homeWinProb = nflOut.homeWinProb;
    awayWinProb = nflOut.awayWinProb;
    tieProb = nflOut.tieProb;
    projectedMargin = nflOut.projectedMargin;
    projectedTotal = nflOut.projectedTotal;
    uncertaintySigmaMargin = nflOut.marginStdDev;
    scenarios = nflOut.scenarios;
    topDrivers = nflOut.topDrivers;
    leagueNotes = nflOut.notes;
    nflMatchupContext = {
      epaDefinition: NFL_EPA_DEFINITION,
      successRateDefinition: NFL_SUCCESS_RATE_DEFINITION,
      homeOffEpaPerPlay: nflOut.homeOffEpaPerPlay,
      awayOffEpaPerPlay: nflOut.awayOffEpaPerPlay,
      homeDefEpaPerPlay: nflOut.homeDefEpaPerPlay,
      awayDefEpaPerPlay: nflOut.awayDefEpaPerPlay,
      olVsPassRushInteractionHome: nflOut.olVsPassRushInteractionHome,
      olVsPassRushInteractionAway: nflOut.olVsPassRushInteractionAway
    };
  } else if (league === "NBA") {
    modelVersion = NBA_MODEL_VERSION;
    const nbaOut = runNbaModel({
      game,
      venue,
      travelRest,
      homeStanding,
      awayStanding,
      injuries: teamInjuries,
      homeRosterBase: buildDefaultNbaRotationRoster(game.homeTeamAbbr, []),
      awayRosterBase: buildDefaultNbaRotationRoster(game.awayTeamAbbr, []),
      learnedParams,
      customOverrides: {
        homeNetRtg: params.customParams?.homeNetRtg,
        awayNetRtg: params.customParams?.awayNetRtg,
        pace: params.customParams?.pace,
        isB2B: params.customParams?.isB2B,
        missingStarHome: params.customParams?.missingStarHome,
        missingStarAway: params.customParams?.missingStarAway,
        isPlayoff: params.customParams?.isPlayoff
      }
    });

    homeWinProb = nbaOut.homeWinProb;
    awayWinProb = nbaOut.awayWinProb;
    tieProb = 0;
    projectedMargin = nbaOut.projectedMargin;
    projectedTotal = nbaOut.projectedTotal;
    uncertaintySigmaMargin = nbaOut.marginStdDev;
    scenarios = nbaOut.scenarios;
    topDrivers = nbaOut.topDrivers;
    leagueNotes = nbaOut.notes;
    nbaRotations = {
      homeMinutesTotal: nbaOut.homeMinutesTotal,
      awayMinutesTotal: nbaOut.awayMinutesTotal,
      homeRotation: nbaOut.homeRotation,
      awayRotation: nbaOut.awayRotation,
      feasible: nbaOut.rotationsFeasible
    };
  } else {
    modelVersion = MLB_MODEL_VERSION;
    const targetDay = game.scheduledStartUtc.slice(0, 10);
    const mlbGames = await fetchMlbHydratedSchedule({
      startDate: targetDay,
      endDate: targetDay,
      db: database,
      hydratePitcherStats: true
    });
    const mlbMatch = mlbGames.find(
      m => m.game.homeTeamAbbr === game!.homeTeamAbbr && m.game.awayTeamAbbr === game!.awayTeamAbbr
    );

    const homePitcher: MlbPitcherProfile | null = mlbMatch?.homePitcher ?? null;
    const awayPitcher: MlbPitcherProfile | null = mlbMatch?.awayPitcher ?? null;
    const homeLineupConfirmed = mlbMatch?.homeLineupConfirmed ?? false;
    const awayLineupConfirmed = mlbMatch?.awayLineupConfirmed ?? false;

    if (!homeLineupConfirmed || !awayLineupConfirmed) {
      provisionalReasons.push("Official 9-man MLB batting order(s) not yet posted at prediction cutoff.");
    }
    if (!homePitcher?.fip || !awayPitcher?.fip) {
      provisionalReasons.push("Probable starting pitcher season FIP missing or early-season (<1 IP); projected baseline used.");
    }

    const mlbOut = runMlbModel({
      game,
      venue,
      weather,
      travelRest,
      homePitcher,
      awayPitcher,
      homeLineupConfirmed,
      awayLineupConfirmed,
      homeStanding,
      awayStanding,
      injuries: teamInjuries,
      learnedParams,
      customOverrides: {
        homeWrc: params.customParams?.homeWrc,
        awayWrc: params.customParams?.awayWrc,
        homeSpxFip: params.customParams?.homeSpxFip,
        awaySpxFip: params.customParams?.awaySpxFip,
        ballparkRunFactor: params.customParams?.ballparkRunFactor,
        windSpeed: params.customParams?.windSpeed
      }
    });

    homeWinProb = mlbOut.homeWinProb;
    awayWinProb = mlbOut.awayWinProb;
    tieProb = 0;
    projectedMargin = mlbOut.projectedMargin;
    projectedTotal = mlbOut.projectedTotal;
    uncertaintySigmaMargin = mlbOut.marginStdDev;
    scenarios = mlbOut.scenarios;
    topDrivers = mlbOut.topDrivers;
    leagueNotes = mlbOut.notes;
    mlbPitchingPlan = {
      homeInningsTotal: mlbOut.homeInningsTotal,
      awayInningsTotal: mlbOut.awayInningsTotal,
      homeStaff: mlbOut.homeStaff,
      awayStaff: mlbOut.awayStaff,
      homeLineupConfirmed,
      awayLineupConfirmed
    };
  }

  // Enforce exact probability simplex sum === 1.0
  homeWinProb = Number(clampProb(homeWinProb, 0.005).toFixed(4));
  tieProb = Number(Math.max(0, tieProb).toFixed(4));
  awayWinProb = Number((1 - homeWinProb - tieProb).toFixed(4));

  // 5. Separated Market & Pricing Analysis (never contaminates model probabilities)
  const marketPricing = analyzeMarketPricing({
    league,
    modelHomeWinProb: homeWinProb,
    modelAwayWinProb: awayWinProb,
    modelTieProb: tieProb,
    snapshot: oddsSnap,
    isMarketInformedModel: false
  });

  // 6. Data completeness & provisional status determination
  const trackedStatuses: Array<{ label: string; status: DataStatus }> = [
    { label: "Team Standings/Efficiency", status: homeStanding && awayStanding ? "confirmed" : "missing" },
    { label: "Schedule Rest/Travel", status: travelRest.status },
    { label: "Venue Weather Vintage", status: weather.status },
    { label: "Injury/Availability Feed", status: injResp.records.length > 0 ? "confirmed" : "projected" },
    { label: "Sportsbook Market Odds", status: oddsSnap ? oddsSnap.status : "missing" }
  ];

  let confirmedCount = 0, projectedCount = 0, estimatedCount = 0, missingCount = 0, staleCount = 0, notApplicableCount = 0;
  const essentialMissing: string[] = [];

  for (const item of trackedStatuses) {
    if (item.status === "confirmed") confirmedCount++;
    else if (item.status === "projected") projectedCount++;
    else if (item.status === "estimated") estimatedCount++;
    else if (item.status === "missing") {
      missingCount++;
      if (item.label !== "Sportsbook Market Odds") essentialMissing.push(item.label);
    } else if (item.status === "stale") staleCount++;
    else if (item.status === "not_applicable") notApplicableCount++;
  }

  if (scenarios.length > 1) {
    provisionalReasons.push(`Key player participation uncertain across ${scenarios.length} availability scenarios.`);
  }
  if (!homeStanding || !awayStanding) {
    provisionalReasons.push("Standings/efficiency baseline missing for one or both teams at cutoff.");
  }

  const forecastStatus: PredictionSnapshotOutput["forecastStatus"] =
    provisionalReasons.length > 0 || essentialMissing.length > 0 ? "provisional" : "confirmed";
  const freshnessLabel: PredictionSnapshotOutput["dataCompleteness"]["freshnessLabel"] =
    staleCount > 0 ? "Partially Stale" : essentialMissing.length > 0 || provisionalReasons.length > 0 ? "Incomplete / Provisional" : "Fresh";

  // 7. Persist versioned immutable prediction record
  const prevRows = database
    .prepare(
      `SELECT prediction_id, version_num, created_utc, home_win_prob, away_win_prob, tie_prob, forecast_status
       FROM prediction_versions WHERE game_id = ? ORDER BY version_num DESC LIMIT 8`
    )
    .all(game.gameId) as Array<any>;

  const versionNum = prevRows.length > 0 ? Number(prevRows[0].version_num) + 1 : 1;
  const predictionId = `pred_${game.gameId}_v${versionNum}_${Date.now()}`;
  const createdUtc = new Date().toISOString();

  const previousVersions = prevRows.map(r => ({
    predictionId: r.prediction_id,
    versionNum: r.version_num,
    createdUtc: r.created_utc,
    homeWinProb: r.home_win_prob,
    awayWinProb: r.away_win_prob,
    tieProb: r.tie_prob,
    forecastStatus: r.forecast_status
  }));

  const projHomeScore =
    projectedTotal !== null && projectedMargin !== null ? Number(((projectedTotal + projectedMargin) / 2).toFixed(1)) : null;
  const projAwayScore =
    projectedTotal !== null && projectedMargin !== null ? Number(((projectedTotal - projectedMargin) / 2).toFixed(1)) : null;

  const engineSnapshot: PredictionSnapshotOutput = {
    predictionId,
    versionNum,
    snapshotId,
    game,
    cutoffUtc,
    createdUtc,
    forecastStatus,
    provisionalReasons,
    featureRegistryVersion: FEATURE_REGISTRY_VERSION,
    modelVersion,
    calibrationVersion,
    rulesVersion: SETTLEMENT_RULES_VERSIONS[league],
    isMarketInformed: false,
    homeWinProb,
    awayWinProb,
    tieProb,
    projectedMargin,
    projectedHomeScore: projHomeScore,
    projectedAwayScore: projAwayScore,
    projectedTotal,
    marginEvaluated: false, // Point-in-time backtest validates calibrated win probability; margin/total remain secondary estimates
    totalEvaluated: false,
    uncertaintySigmaMargin,
    scenarios,
    absencesAndReplacements: teamInjuries,
    nbaRotations,
    mlbPitchingPlan,
    nflMatchupContext,
    travelRest,
    weather,
    venue,
    dataCompleteness: {
      confirmedCount,
      projectedCount,
      estimatedCount,
      missingCount,
      staleCount,
      notApplicableCount,
      essentialMissing,
      freshnessLabel
    },
    marketPricing,
    topDrivers,
    leagueNotes,
    previousVersions
  };

  database
    .prepare(
      `INSERT INTO prediction_versions (
        prediction_id, game_id, league, version_num, cutoff_utc, created_utc,
        feature_registry_version, model_version, calibration_version, rules_version,
        snapshot_id, odds_id, forecast_id, forecast_status, is_market_informed,
        home_win_prob, away_win_prob, tie_prob, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      predictionId,
      game.gameId,
      league,
      versionNum,
      cutoffUtc,
      createdUtc,
      FEATURE_REGISTRY_VERSION,
      modelVersion,
      calibrationVersion,
      SETTLEMENT_RULES_VERSIONS[league],
      snapshotId,
      oddsSnap?.oddsId || null,
      weather.forecastId,
      forecastStatus,
      0,
      homeWinProb,
      awayWinProb,
      tieProb,
      JSON.stringify(engineSnapshot)
    );

  // 8. Build backward-compatible legacy fields alongside rich engineSnapshot
  const fairHomeDec = 1 / Math.max(0.01, homeWinProb);
  const fairAwayDec = 1 / Math.max(0.01, awayWinProb);
  const projectedHomeML = decimalToAmerican(Math.max(1.01, fairHomeDec));
  const projectedAwayML = decimalToAmerican(Math.max(1.01, fairAwayDec));

  const winningTeam = homeWinProb >= awayWinProb ? game.homeTeamName : game.awayTeamName;
  const winningChancePct = Number((Math.max(homeWinProb, awayWinProb) * 100).toFixed(1));

  const homeEvPct = marketPricing.homeExpectedValuePerUnit !== null ? Number((marketPricing.homeExpectedValuePerUnit * 100).toFixed(1)) : 0;
  const awayEvPct = marketPricing.awayExpectedValuePerUnit !== null ? Number((marketPricing.awayExpectedValuePerUnit * 100).toFixed(1)) : 0;
  const bestEvPct = Math.max(homeEvPct, awayEvPct);
  const mlEdgeTeam = marketPricing.available
    ? (homeEvPct >= awayEvPct ? game.homeTeamName : game.awayTeamName)
    : winningTeam;

  const spreadDiff = (projectedMargin !== null && params.bookSpread !== undefined && params.bookSpread !== null)
    ? (-projectedMargin - params.bookSpread)
    : 0;
  const edgePoints = Number(Math.abs(spreadDiff).toFixed(2));
  const mlEdgeCategory = !marketPricing.available
    ? "Price N/A"
    : bestEvPct >= 4.0
    ? "Strong edge"
    : bestEvPct >= 1.5
    ? "Moderate edge"
    : "No bet";

  const recommendedPick = !marketPricing.available
    ? `MODEL WIN: ${winningTeam} (${winningChancePct}%)`
    : bestEvPct >= 1.5
    ? `VALUE PRICE: ${mlEdgeTeam} (${bestEvPct > 0 ? `+${bestEvPct}% EV` : "Aligned"})`
    : `MODEL FAVORITE: ${winningTeam} (Market Fair)`;

  const topDriverSummary =
    topDrivers.length > 0
      ? topDrivers.map(d => d.explanation).join(" ")
      : `${winningTeam} projects at ${winningChancePct}% win probability under ${modelVersion}.`;

  const legacyResponse: Record<string, any> = {
    homeTeam: game.homeTeamName,
    awayTeam: game.awayTeamName,
    sport: league,
    edgeTeam: mlEdgeTeam,
    winningTeam,
    winningChancePct,
    edgeReason: topDriverSummary,
    edgeFactors: topDrivers.slice(0, 3).map(d => ({
      factor: `${d.factorId} • ${d.name}`,
      description: d.explanation,
      edgeSide: d.direction === "home" ? "Home" : d.direction === "away" ? "Away" : "Neutral"
    })),
    searchGrounded: false, // Honest: grounded in deterministic statistical + official feed adapters, not generative text
    homeNetRtg: homeStanding?.pointDiffPerGame ?? params.customParams?.homeNetRtg ?? null,
    awayNetRtg: awayStanding?.pointDiffPerGame ?? params.customParams?.awayNetRtg ?? null,
    homePace: params.customParams?.pace ?? 98.5,
    awayPace: params.customParams?.pace ?? 98.5,
    projectedMargin: projectedMargin ?? 0,
    bookSpread: params.bookSpread ?? marketPricing.spreadLine ?? 0,
    bookTotal: params.bookTotal ?? 0,
    projectedTotal,
    edgePoints,
    edgeCategory: mlEdgeCategory,
    recommendedPick,
    confidence: Math.round(winningChancePct),
    projectedHomeWinProb: homeWinProb,
    projectedAwayWinProb: awayWinProb,
    projectedTieProb: tieProb,
    projectedHomeML,
    projectedAwayML,
    bookHomeML: marketPricing.homeAmericanOdds ?? null,
    bookAwayML: marketPricing.awayAmericanOdds ?? null,
    mlEdgeTeam,
    mlEdgePct: bestEvPct,
    mlEdgeCategory,
    injuryReport: teamInjuries.map(
      inj =>
        `${inj.playerName} (${inj.teamAbbr} ${inj.position}) — ${inj.gameDesignation || "Listed"}${
          inj.practiceStatus ? ` [Practice: ${inj.practiceStatus}]` : ""
        }: ${inj.injuryOrReason}`
    ),
    homePlayerStats: [],
    awayPlayerStats: [],
    playerProps: [],
    engineSnapshot
  };

  return { legacyResponse, engineSnapshot };
}

export async function getPredictionVersionsForGame(gameId: string, db?: DatabaseSync) {
  const database = db || getDb();
  const rows = database
    .prepare(
      `SELECT prediction_id, version_num, cutoff_utc, created_utc, model_version, forecast_status,
              home_win_prob, away_win_prob, tie_prob, payload_json
       FROM prediction_versions WHERE game_id = ? ORDER BY version_num DESC`
    )
    .all(gameId) as Array<any>;
  return rows.map(r => JSON.parse(r.payload_json) as PredictionSnapshotOutput);
}

/**
 * Reconciles completed/postponed/canceled/tied games with latest prediction versions
 * and computes realized Brier score, Log Loss, and realized 1-unit moneyline EV.
 */
export async function reconcileCompletedGames(db?: DatabaseSync): Promise<{
  settledCount: number;
  updatedGamesCount: number;
}> {
  const database = db || getDb();
  let updatedGamesCount = 0;

  for (const league of ["NFL", "NBA", "MLB"] as LeagueCode[]) {
    const sb = await fetchEspnScoreboard(league, undefined, database);
    updatedGamesCount += sb.games.length;
  }

  const pending = database
    .prepare(
      `SELECT pv.prediction_id, pv.game_id, pv.league, pv.home_win_prob, pv.away_win_prob, pv.tie_prob,
              pv.odds_id, g.status, g.home_score, g.away_score, g.went_overtime
       FROM prediction_versions pv
       JOIN games g ON g.game_id = pv.game_id
       LEFT JOIN prediction_outcomes po ON po.prediction_id = pv.prediction_id
       WHERE po.prediction_id IS NULL AND g.status IN ('final', 'canceled', 'postponed')`
    )
    .all() as Array<any>;

  let settledCount = 0;
  for (const row of pending) {
    let winner = "void";
    let brier: number | null = null;
    let logLoss: number | null = null;
    let mlEvRealized: number | null = null;

    if (row.status === "final" && row.home_score !== null && row.away_score !== null) {
      const y = row.home_score > row.away_score ? 1 : row.home_score < row.away_score ? 0 : 0.5;
      winner = y === 1 ? "home" : y === 0 ? "away" : "tie";
      const pHome = clampProb(row.home_win_prob, 1e-6);
      brier = Number(((pHome - y) ** 2).toFixed(5));
      logLoss = Number((-(y * Math.log(pHome) + (1 - y) * Math.log(1 - pHome))).toFixed(5));

      if (row.odds_id) {
        const odds = database.prepare(`SELECT * FROM odds_snapshots WHERE odds_id = ?`).get(row.odds_id) as any;
        if (odds?.home_decimal && odds?.away_decimal) {
          const evHome = row.home_win_prob * (odds.home_decimal - 1) - row.away_win_prob;
          const evAway = row.away_win_prob * (odds.away_decimal - 1) - row.home_win_prob;
          const side = evHome >= evAway ? "home" : "away";
          const res = settleMarketOutcome({
            marketType: "h2h",
            side,
            line: null,
            homeScore: row.home_score,
            awayScore: row.away_score,
            gameStatus: row.status,
            decimalOdds: side === "home" ? odds.home_decimal : odds.away_decimal
          });
          mlEvRealized = Number(res.netProfitPerUnit.toFixed(4));
        }
      }
    }

    database
      .prepare(
        `INSERT OR IGNORE INTO prediction_outcomes (
          prediction_id, game_id, league, settled_utc, actual_home_score, actual_away_score,
          winner, went_overtime, brier_score, log_loss, ml_ev_realized
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        row.prediction_id,
        row.game_id,
        row.league,
        new Date().toISOString(),
        row.home_score,
        row.away_score,
        winner,
        row.went_overtime || 0,
        brier,
        logLoss,
        mlEvRealized
      );
    settledCount++;
  }

  return { settledCount, updatedGamesCount };
}

let refreshIntervalHandle: ReturnType<typeof setInterval> | null = null;

export function startBackgroundRefreshScheduler(db?: DatabaseSync) {
  if (refreshIntervalHandle) return;
  const database = db || getDb();

  const runTick = async () => {
    try {
      const nowIso = new Date().toISOString();
      const horizonIso = new Date(Date.now() + 6 * 3600 * 1000).toISOString();
      const upcoming = database
        .prepare(
          `SELECT game_id, league, home_team_name, away_team_name, scheduled_start_utc
           FROM games WHERE status = 'scheduled' AND scheduled_start_utc BETWEEN ? AND ? LIMIT 6`
        )
        .all(nowIso, horizonIso) as Array<any>;

      for (const g of upcoming) {
        const venue = getVenueForGame(g.league, g.home_team_name);
        await fetchNwsVenueWeather({
          gameId: g.game_id,
          venue,
          scheduledStartUtc: g.scheduled_start_utc,
          db: database
        });
      }
    } catch (err: any) {
      logMonitoringEvent(database, {
        severity: "warn",
        source: "scheduler",
        eventType: "background_refresh_error",
        message: err?.message || "Refresh tick error"
      });
    }
  };

  // Every 20 minutes refresh near-tipoff forecasts
  refreshIntervalHandle = setInterval(runTick, 20 * 60 * 1000);
}
