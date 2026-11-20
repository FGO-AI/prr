import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { americanToDecimal, rawImpliedFromAmerican, removeMarginProportional, settleMarketOutcome } from "../core/marketPricing";
import { LeagueCode } from "../core/types";
import { computeTimezoneShift, getVenueForGame, haversineMiles, normalizeTeam } from "../core/venues";
import {
  CalibrationBin,
  EvaluationMetricsSummary,
  fitFoldLocalLogisticModel,
  fitPlattCalibration,
  LogisticParameters,
  predictWithLogisticModel,
  sigmoid,
  summarizeProbMetrics
} from "../models/calibration";
import { extractNbaFeatureVector, NBA_FEATURE_NAMES, NBA_MODEL_VERSION } from "../models/nbaModel";
import { extractNflFeatureVector, NFL_FEATURE_NAMES, NFL_MODEL_VERSION } from "../models/nflModel";
import { fetchEspnScoreboard } from "../providers/espnAdapter";
import { fetchMlbHydratedSchedule } from "../providers/mlbStatsAdapter";
import {
  computeNflRollingMetricsBeforeDate,
  loadNflverseGames,
  loadNflverseTeamWeekStats
} from "../providers/nflverseAdapter";

export interface AblationResult {
  variant: string;
  brierScore: number;
  logLoss: number;
  accuracy: number;
  deltaBrierVsBaseline: number;
}

export interface LeagueEvaluationReport {
  runId: string;
  league: LeagueCode;
  createdUtc: string;
  modelVersion: string;
  baselineVersion: string;
  trainWindow: string;
  valWindow: string;
  testWindow: string;
  baselineMetrics: EvaluationMetricsSummary;
  legacyMetrics: EvaluationMetricsSummary;
  candidateMetrics: EvaluationMetricsSummary;
  marketBaselineMetrics: EvaluationMetricsSummary | null;
  calibrationBins: CalibrationBin[];
  ablations: AblationResult[];
  learnedParams: LogisticParameters;
  bettingEvaluation: {
    available: boolean;
    sampleSize: number;
    wins: number;
    losses: number;
    pushes: number;
    netUnits: number;
    roiPct: number | null;
    note: string;
  };
  historicalCoverageGaps: string[];
}

const CACHE_DIR = path.join(process.cwd(), "data", "cache");

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

export async function runNflWalkForwardEvaluation(db?: DatabaseSync): Promise<LeagueEvaluationReport> {
  const games = await loadNflverseGames();
  const teamStats = await loadNflverseTeamWeekStats([2023, 2024, 2025]);

  const completed = games
    .filter(g => g.game_type === "REG" && [2023, 2024, 2025].includes(g.season) && g.home_score !== null && g.away_score !== null)
    .sort((a, b) => a.gameday.localeCompare(b.gameday));

  const trainRows: Array<{ feat: Array<number | null>; y: number }> = [];
  const valRows: Array<{ feat: Array<number | null>; y: number }> = [];
  const testRows: Array<{
    feat: Array<number | null>;
    y: number;
    legacyProb: number;
    marketProb: number | null;
    homeMl: number | null;
    awayMl: number | null;
    homeScore: number;
    awayScore: number;
  }> = [];

  for (const g of completed) {
    // Only use games where teams have prior history before this gameday (point-in-time cutoff)
    const hr = computeNflRollingMetricsBeforeDate({
      teamAbbr: g.home_team,
      cutoffGameday: g.gameday,
      games,
      teamWeekStats: teamStats,
      lookbackGames: 12
    });
    const ar = computeNflRollingMetricsBeforeDate({
      teamAbbr: g.away_team,
      cutoffGameday: g.gameday,
      games,
      teamWeekStats: teamStats,
      lookbackGames: 12
    });

    if (!hr || !ar || hr.gamesPlayed < 2 || ar.gamesPlayed < 2) continue;

    const feat = extractNflFeatureVector({
      homeRolling: hr,
      awayRolling: ar,
      homeRestDays: g.home_rest,
      awayRestDays: g.away_rest,
      neutralSite: g.location !== "Home"
    });

    const y = g.home_score! > g.away_score! ? 1 : g.home_score! < g.away_score! ? 0 : 0.5;

    if (g.season === 2023 || (g.season === 2024 && g.week <= 12)) {
      trainRows.push({ feat, y });
    } else if (g.season === 2024 && g.week > 12) {
      valRows.push({ feat, y });
    } else if (g.season === 2025) {
      // Legacy heuristic baseline (fixed 2.75 HFA + simple EPA diff)
      const legacyMargin = (feat[0] ?? 0) * 20 + 2.75;
      const legacyProb = sigmoid(0.1554 * legacyMargin);

      let marketProb: number | null = null;
      if (g.home_moneyline && g.away_moneyline) {
        const rHome = rawImpliedFromAmerican(g.home_moneyline);
        const rAway = rawImpliedFromAmerican(g.away_moneyline);
        marketProb = removeMarginProportional([rHome, rAway]).normalized[0];
      }

      testRows.push({
        feat,
        y,
        legacyProb,
        marketProb,
        homeMl: g.home_moneyline,
        awayMl: g.away_moneyline,
        homeScore: g.home_score!,
        awayScore: g.away_score!
      });
    }
  }

  // Fit fold-local logistic model ONLY on training fold
  const learnedParams = fitFoldLocalLogisticModel({
    rawFeatures: trainRows.map(r => r.feat),
    outcomes: trainRows.map(r => r.y),
    featureNames: NFL_FEATURE_NAMES,
    l2Lambda: 18.0
  });

  // Fit Platt calibration ONLY on validation fold
  const valRawProbs = valRows.map(r => predictWithLogisticModel(learnedParams, r.feat));
  const platt = fitPlattCalibration(valRawProbs, valRows.map(r => r.y));
  learnedParams.plattA = platt.plattA;
  learnedParams.plattB = platt.plattB;

  // Evaluate untouched 2025 holdout
  const trainBaseRate = trainRows.reduce((a, r) => a + r.y, 0) / Math.max(1, trainRows.length);
  const testOutcomes = testRows.map(r => r.y);
  const baselineProbs = testRows.map(() => trainBaseRate);
  const legacyProbs = testRows.map(r => r.legacyProb);
  const candidateProbs = testRows.map(r => predictWithLogisticModel(learnedParams, r.feat));

  const marketTest = testRows.filter(r => r.marketProb !== null);
  const marketBaselineMetrics =
    marketTest.length > 0
      ? summarizeProbMetrics(
          marketTest.map(r => r.marketProb!),
          marketTest.map(r => r.y)
        )
      : null;

  const baselineMetrics = summarizeProbMetrics(baselineProbs, testOutcomes);
  const legacyMetrics = summarizeProbMetrics(legacyProbs, testOutcomes);
  const candidateMetrics = summarizeProbMetrics(candidateProbs, testOutcomes);

  const { computeCalibrationBins } = await import("../models/calibration");
  const { bins } = computeCalibrationBins(candidateProbs, testOutcomes, 10);

  // Feature-group ablation on untouched holdout (models re-fit on training fold ONLY)
  const ablationSpecs: Array<{ name: string; dropIndices: number[] }> = [
    { name: "Without OL-vs-Pass-Rush Interaction (NFL02)", dropIndices: [3] },
    { name: "Without Turnover Skill & Special Teams/Penalties", dropIndices: [4, 5] },
    { name: "Without Rest & Neutral-Site Adjustments", dropIndices: [6, 7] },
    { name: "Team Net EPA Only", dropIndices: [1, 2, 3, 4, 5, 6, 7] }
  ];

  const ablations: AblationResult[] = [];
  for (const spec of ablationSpecs) {
    const keepIdx = NFL_FEATURE_NAMES.map((_, i) => i).filter(i => !spec.dropIndices.includes(i));
    const subModel = fitFoldLocalLogisticModel({
      rawFeatures: trainRows.map(r => keepIdx.map(i => r.feat[i])),
      outcomes: trainRows.map(r => r.y),
      featureNames: keepIdx.map(i => NFL_FEATURE_NAMES[i]),
      l2Lambda: 18.0
    });
    const subValProbs = valRows.map(r => predictWithLogisticModel(subModel, keepIdx.map(i => r.feat[i])));
    const subPlatt = fitPlattCalibration(subValProbs, valRows.map(r => r.y));
    subModel.plattA = subPlatt.plattA;
    subModel.plattB = subPlatt.plattB;

    const subTestProbs = testRows.map(r => predictWithLogisticModel(subModel, keepIdx.map(i => r.feat[i])));
    const m = summarizeProbMetrics(subTestProbs, testOutcomes);
    ablations.push({
      variant: spec.name,
      brierScore: m.brierScore,
      logLoss: m.logLoss,
      accuracy: m.accuracy,
      deltaBrierVsBaseline: Number((m.brierScore - candidateMetrics.brierScore).toFixed(5))
    });
  }

  // Betting evaluation using actual moneyline prices in nflverse (threshold >= +3% EV)
  let wins = 0, losses = 0, pushes = 0, netUnits = 0, betCount = 0;
  for (let i = 0; i < testRows.length; i++) {
    const r = testRows[i];
    if (!r.homeMl || !r.awayMl) continue;
    const pHome = candidateProbs[i];
    const pAway = 1 - pHome;
    const decHome = americanToDecimal(r.homeMl);
    const decAway = americanToDecimal(r.awayMl);
    const evHome = pHome * (decHome - 1) - pAway;
    const evAway = pAway * (decAway - 1) - pHome;

    if (evHome >= 0.03 || evAway >= 0.03) {
      const side = evHome >= evAway ? "home" : "away";
      const dec = side === "home" ? decHome : decAway;
      const res = settleMarketOutcome({
        marketType: "h2h",
        side,
        line: null,
        homeScore: r.homeScore,
        awayScore: r.awayScore,
        gameStatus: "final",
        decimalOdds: dec
      });
      betCount++;
      if (res.outcome === "win") wins++;
      else if (res.outcome === "loss") losses++;
      else if (res.outcome === "push") pushes++;
      netUnits += res.netProfitPerUnit;
    }
  }

  const report: LeagueEvaluationReport = {
    runId: `eval_nfl_${Date.now()}`,
    league: "NFL",
    createdUtc: new Date().toISOString(),
    modelVersion: NFL_MODEL_VERSION,
    baselineVersion: "nfl_home_rate_and_legacy_v1",
    trainWindow: `2023 REG + 2024 W1-12 (n=${trainRows.length})`,
    valWindow: `2024 W13-18 (n=${valRows.length})`,
    testWindow: `2025 REG Untouched Holdout (n=${testRows.length})`,
    baselineMetrics,
    legacyMetrics,
    candidateMetrics,
    marketBaselineMetrics,
    calibrationBins: bins,
    ablations,
    learnedParams,
    bettingEvaluation: {
      available: true,
      sampleSize: betCount,
      wins,
      losses,
      pushes,
      netUnits: Number(netUnits.toFixed(2)),
      roiPct: betCount > 0 ? Number(((netUnits / betCount) * 100).toFixed(2)) : null,
      note: "Flat 1-unit moneyline wagers where candidate model EV >= +3.0% vs nflverse market price; includes ties as pushes."
    },
    historicalCoverageGaps: [
      "Historical weekly injury practice/game designations (NFL01/U03) are not archived per-cutoff in nflverse games.csv; tested features reflect team-week EPA, CPOE, OL/pass-rush interaction, turnovers, ST, penalties, and rest.",
      "Play-by-play neutral-script filtering uses team-week EPA aggregates rather than down-and-distance PBP files (~98MB/season) to stay within memory limits."
    ]
  };

  if (db) persistEvaluationRun(db, report);
  return report;
}

export async function runNbaWalkForwardEvaluation(db?: DatabaseSync): Promise<LeagueEvaluationReport> {
  ensureCacheDir();
  const cacheFile = path.join(CACHE_DIR, "espn_nba_hist_daily_2025.json");
  let gamesList: any[] = [];

  if (fs.existsSync(cacheFile)) {
    gamesList = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  } else {
    // Fetch consecutive daily dates across 2024-25 NBA regular season (Nov 15, 2024 - Apr 10, 2025)
    // Consecutive dates ensure B2B (1 day rest) and travel routes are observed without missing intermediate games.
    const allDates: string[] = [];
    const start = new Date("2024-11-15T12:00:00Z");
    for (let day = 0; day < 146; day++) {
      const d = new Date(start.getTime() + day * 86400 * 1000);
      allDates.push(d.toISOString().slice(0, 10).replace(/-/g, ""));
    }
    const seen = new Set<string>();
    for (let i = 0; i < allDates.length; i += 12) {
      const slice = allDates.slice(i, i + 12);
      const batches = await Promise.all(slice.map(dt => fetchEspnScoreboard("NBA", dt)));
      for (const b of batches) {
        for (const g of b.games) {
          if (g.status === "final" && g.homeScore !== null && g.awayScore !== null && g.competitionPhase === "regular" && !seen.has(g.gameId)) {
            seen.add(g.gameId);
            gamesList.push(g);
          }
        }
      }
    }
    gamesList.sort((a, b) => a.scheduledStartUtc.localeCompare(b.scheduledStartUtc));
    if (gamesList.length > 0) fs.writeFileSync(cacheFile, JSON.stringify(gamesList), "utf8");
  }

  // Rolling chronological state per team (no future leakage)
  const teamHistory = new Map<string, Array<{ dateMs: number; margin: number; venueTz: string }>>();
  const rows: Array<{ feat: Array<number | null>; y: number; legacyProb: number }> = [];

  for (const g of gamesList) {
    const hHist = teamHistory.get(g.homeTeamAbbr) || [];
    const aHist = teamHistory.get(g.awayTeamAbbr) || [];
    const curMs = Date.parse(g.scheduledStartUtc);

    if (hHist.length >= 3 && aHist.length >= 3) {
      const hLast15 = hHist.slice(-15);
      const aLast15 = aHist.slice(-15);
      const hAvgMargin = hLast15.reduce((s, x) => s + x.margin, 0) / hLast15.length;
      const aAvgMargin = aLast15.reduce((s, x) => s + x.margin, 0) / aLast15.length;
      const hWinPct = hLast15.filter(x => x.margin > 0).length / hLast15.length;
      const aWinPct = aLast15.filter(x => x.margin > 0).length / aLast15.length;

      const hRestDays = Math.round((curMs - hHist[hHist.length - 1].dateMs) / 86400000);
      const aRestDays = Math.round((curMs - aHist[aHist.length - 1].dateMs) / 86400000);
      const homeVenue = getVenueForGame("NBA", g.homeTeamName);
      const awayPrevTz = aHist[aHist.length - 1].venueTz;
      const tzShift = homeVenue ? computeTimezoneShift(awayPrevTz, homeVenue.timezone) : { hoursDiff: 0, direction: "neutral" as const };

      const feat = extractNbaFeatureVector({
        homeNetRtg: hAvgMargin * 1.015, // approx per-100 scaling
        awayNetRtg: aAvgMargin * 1.015,
        homeWinPct: hWinPct,
        awayWinPct: aWinPct,
        neutralSite: g.neutralSite,
        homeRestDays: Math.min(6, hRestDays),
        awayRestDays: Math.min(6, aRestDays),
        homeIsB2B: hRestDays <= 1,
        awayIsB2B: aRestDays <= 1,
        awayEastboundTzPenalty: tzShift.direction === "eastbound" && tzShift.hoursDiff >= 2 ? 1 : 0
      });

      const legacyMargin = (hAvgMargin - aAvgMargin) / 2 + 2.75;
      rows.push({
        feat,
        y: g.homeScore > g.awayScore ? 1 : 0,
        legacyProb: sigmoid(0.1554 * legacyMargin)
      });
    }

    // Append current completed game AFTER extracting pre-game features
    const margin = g.homeScore - g.awayScore;
    hHist.push({ dateMs: curMs, margin, venueTz: g.venueTimezone });
    aHist.push({ dateMs: curMs, margin: -margin, venueTz: g.venueTimezone });
    teamHistory.set(g.homeTeamAbbr, hHist);
    teamHistory.set(g.awayTeamAbbr, aHist);
  }

  const n = rows.length;
  const trainEnd = Math.floor(n * 0.55);
  const valEnd = Math.floor(n * 0.75);
  const trainRows = rows.slice(0, trainEnd);
  const valRows = rows.slice(trainEnd, valEnd);
  const testRows = rows.slice(valEnd);

  const learnedParams = fitFoldLocalLogisticModel({
    rawFeatures: trainRows.map(r => r.feat),
    outcomes: trainRows.map(r => r.y),
    featureNames: NBA_FEATURE_NAMES,
    l2Lambda: 14.0
  });

  const valProbs = valRows.map(r => predictWithLogisticModel(learnedParams, r.feat));
  const platt = fitPlattCalibration(valProbs, valRows.map(r => r.y));
  learnedParams.plattA = platt.plattA;
  learnedParams.plattB = platt.plattB;

  const trainBaseRate = trainRows.reduce((a, r) => a + r.y, 0) / Math.max(1, trainRows.length);
  const testY = testRows.map(r => r.y);
  const candidateProbs = testRows.map(r => predictWithLogisticModel(learnedParams, r.feat));

  const baselineMetrics = summarizeProbMetrics(testRows.map(() => trainBaseRate), testY);
  const legacyMetrics = summarizeProbMetrics(testRows.map(r => r.legacyProb), testY);
  const candidateMetrics = summarizeProbMetrics(candidateProbs, testY);

  const { computeCalibrationBins } = await import("../models/calibration");
  const { bins } = computeCalibrationBins(candidateProbs, testY, 10);

  // Ablation
  const ablations: AblationResult[] = [];
  for (const spec of [
    { name: "Without Rest, B2B & Travel TZ", keep: [0, 1, 2] },
    { name: "NetRtg Differential Only", keep: [0, 2] }
  ]) {
    const subModel = fitFoldLocalLogisticModel({
      rawFeatures: trainRows.map(r => spec.keep.map(i => r.feat[i])),
      outcomes: trainRows.map(r => r.y),
      featureNames: spec.keep.map(i => NBA_FEATURE_NAMES[i]),
      l2Lambda: 14.0
    });
    const subTest = testRows.map(r => predictWithLogisticModel(subModel, spec.keep.map(i => r.feat[i])));
    const m = summarizeProbMetrics(subTest, testY);
    ablations.push({
      variant: spec.name,
      brierScore: m.brierScore,
      logLoss: m.logLoss,
      accuracy: m.accuracy,
      deltaBrierVsBaseline: Number((m.brierScore - candidateMetrics.brierScore).toFixed(5))
    });
  }

  const report: LeagueEvaluationReport = {
    runId: `eval_nba_${Date.now()}`,
    league: "NBA",
    createdUtc: new Date().toISOString(),
    modelVersion: NBA_MODEL_VERSION,
    baselineVersion: "nba_home_rate_and_legacy_v1",
    trainWindow: `2024-25 Early-Mid Season (n=${trainRows.length})`,
    valWindow: `2024-25 Calibration Fold (n=${valRows.length})`,
    testWindow: `2024-25 Late-Season Untouched Holdout (n=${testRows.length})`,
    baselineMetrics,
    legacyMetrics,
    candidateMetrics,
    marketBaselineMetrics: null,
    calibrationBins: bins,
    ablations,
    learnedParams,
    bettingEvaluation: {
      available: false,
      sampleSize: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
      netUnits: 0,
      roiPct: null,
      note: "Historical NBA sportsbook closing moneyline odds are unavailable in free ESPN scoreboard archive; betting ROI withheld rather than fabricated."
    },
    historicalCoverageGaps: [
      "Historical pre-tipoff NBA injury reports and historical closing market odds are unavailable from free public APIs; historical evaluation covers rolling point differential, home court, rest/B2B, and timezone travel.",
      "Shot-profile/rim-protection/PnR tracking stats (stats.nba.com) returned HTTP 500 from server environment and are excluded from historical backtest."
    ]
  };

  if (db) persistEvaluationRun(db, report);
  return report;
}

export async function runMlbWalkForwardEvaluation(db?: DatabaseSync): Promise<LeagueEvaluationReport> {
  ensureCacheDir();
  const cacheFile = path.join(CACHE_DIR, "mlb_stats_hist_2025.json");
  let gamesList: any[] = [];

  if (fs.existsSync(cacheFile)) {
    gamesList = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  } else {
    const windows = [
      ["2025-05-01", "2025-05-20"],
      ["2025-06-10", "2025-06-30"],
      ["2025-07-15", "2025-08-05"],
      ["2025-08-15", "2025-09-05"],
      ["2025-09-06", "2025-09-25"]
    ];
    for (const [s, e] of windows) {
      const sched = await fetchMlbHydratedSchedule({ startDate: s, endDate: e, hydratePitcherStats: false });
      for (const item of sched) {
        if (item.game.status === "final" && item.game.homeScore !== null && item.game.awayScore !== null) {
          gamesList.push(item.game);
        }
      }
    }
    gamesList.sort((a, b) => a.scheduledStartUtc.localeCompare(b.scheduledStartUtc));
    if (gamesList.length > 0) fs.writeFileSync(cacheFile, JSON.stringify(gamesList), "utf8");
  }

  const teamRuns = new Map<string, Array<{ dateMs: number; runDiff: number }>>();
  const rows: Array<{ feat: Array<number | null>; y: number; legacyProb: number }> = [];
  const featureNames = ["run_diff_pg", "home_win_pct_diff", "park_run_factor_rel", "doubleheader_flag"];

  for (const g of gamesList) {
    const hHist = teamRuns.get(g.homeTeamAbbr) || [];
    const aHist = teamRuns.get(g.awayTeamAbbr) || [];
    const curMs = Date.parse(g.scheduledStartUtc);

    if (hHist.length >= 5 && aHist.length >= 5) {
      const hL20 = hHist.slice(-20);
      const aL20 = aHist.slice(-20);
      const hRd = hL20.reduce((s, x) => s + x.runDiff, 0) / hL20.length;
      const aRd = aL20.reduce((s, x) => s + x.runDiff, 0) / aL20.length;
      const hWp = hL20.filter(x => x.runDiff > 0).length / hL20.length;
      const aWp = aL20.filter(x => x.runDiff > 0).length / aL20.length;
      const venue = getVenueForGame("MLB", g.homeTeamName);
      const parkRel = (venue?.parkRunIndex100 ?? 100) / 100 - 1.0;

      rows.push({
        feat: [hRd - aRd, hWp - aWp, parkRel, g.doubleheaderGameNum ? 1 : 0],
        y: g.homeScore > g.awayScore ? 1 : 0,
        legacyProb: sigmoid(0.55 * ((hRd - aRd) * 0.5 + 0.24))
      });
    }

    const rd = g.homeScore - g.awayScore;
    hHist.push({ dateMs: curMs, runDiff: rd });
    aHist.push({ dateMs: curMs, runDiff: -rd });
    teamRuns.set(g.homeTeamAbbr, hHist);
    teamRuns.set(g.awayTeamAbbr, aHist);
  }

  const n = rows.length;
  const trainEnd = Math.floor(n * 0.55);
  const valEnd = Math.floor(n * 0.75);
  const trainRows = rows.slice(0, trainEnd);
  const valRows = rows.slice(trainEnd, valEnd);
  const testRows = rows.slice(valEnd);

  const learnedParams = fitFoldLocalLogisticModel({
    rawFeatures: trainRows.map(r => r.feat),
    outcomes: trainRows.map(r => r.y),
    featureNames,
    l2Lambda: 22.0
  });
  const valProbs = valRows.map(r => predictWithLogisticModel(learnedParams, r.feat));
  const platt = fitPlattCalibration(valProbs, valRows.map(r => r.y));
  learnedParams.plattA = platt.plattA;
  learnedParams.plattB = platt.plattB;

  const trainBaseRate = trainRows.reduce((a, r) => a + r.y, 0) / Math.max(1, trainRows.length);
  const testY = testRows.map(r => r.y);
  const candidateProbs = testRows.map(r => predictWithLogisticModel(learnedParams, r.feat));

  const baselineMetrics = summarizeProbMetrics(testRows.map(() => trainBaseRate), testY);
  const legacyMetrics = summarizeProbMetrics(testRows.map(r => r.legacyProb), testY);
  const candidateMetrics = summarizeProbMetrics(candidateProbs, testY);

  const { computeCalibrationBins } = await import("../models/calibration");
  const { bins } = computeCalibrationBins(candidateProbs, testY, 10);

  const ablations: AblationResult[] = [];
  for (const spec of [
    { name: "Without Park Factor & Doubleheader Flag", keep: [0, 1] },
    { name: "Run Differential Only", keep: [0] }
  ]) {
    const subModel = fitFoldLocalLogisticModel({
      rawFeatures: trainRows.map(r => spec.keep.map(i => r.feat[i])),
      outcomes: trainRows.map(r => r.y),
      featureNames: spec.keep.map(i => featureNames[i]),
      l2Lambda: 22.0
    });
    const subTest = testRows.map(r => predictWithLogisticModel(subModel, spec.keep.map(i => r.feat[i])));
    const m = summarizeProbMetrics(subTest, testY);
    ablations.push({
      variant: spec.name,
      brierScore: m.brierScore,
      logLoss: m.logLoss,
      accuracy: m.accuracy,
      deltaBrierVsBaseline: Number((m.brierScore - candidateMetrics.brierScore).toFixed(5))
    });
  }

  const report: LeagueEvaluationReport = {
    runId: `eval_mlb_${Date.now()}`,
    league: "MLB",
    createdUtc: new Date().toISOString(),
    modelVersion: "mlb_run_diff_park_eval_v2.1.0",
    baselineVersion: "mlb_home_rate_and_legacy_v1",
    trainWindow: `2025 May-Jul MLB Sample (n=${trainRows.length})`,
    valWindow: `2025 Aug MLB Calibration Fold (n=${valRows.length})`,
    testWindow: `2025 Sep Untouched Holdout (n=${testRows.length})`,
    baselineMetrics,
    legacyMetrics,
    candidateMetrics,
    marketBaselineMetrics: null,
    calibrationBins: bins,
    ablations,
    learnedParams,
    bettingEvaluation: {
      available: false,
      sampleSize: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
      netUnits: 0,
      roiPct: null,
      note: "Historical MLB closing odds are not included in MLB Stats API schedules; ROI withheld."
    },
    historicalCoverageGaps: [
      "Point-in-time historical starting pitcher FIP before each game date, historical NWS weather forecast vintages, and historical closing odds are unavailable without paid historical archives.",
      "Live MLB inference integrates real MLB Stats API pitcher FIP/workload + NWS venue forecasts + ballpark factors; the historical backtest evaluates team run differential, park factors, and doubleheader flags."
    ]
  };

  if (db) persistEvaluationRun(db, report);
  return report;
}

export function persistEvaluationRun(db: DatabaseSync, report: LeagueEvaluationReport) {
  db.prepare(
    `INSERT OR REPLACE INTO evaluation_runs (
      run_id, league, created_utc, model_version, baseline_version,
      train_window, val_window, test_window, metrics_json, ablation_json, calibration_bins_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    report.runId,
    report.league,
    report.createdUtc,
    report.modelVersion,
    report.baselineVersion,
    report.trainWindow,
    report.valWindow,
    report.testWindow,
    JSON.stringify({
      baseline: report.baselineMetrics,
      legacy: report.legacyMetrics,
      candidate: report.candidateMetrics,
      market: report.marketBaselineMetrics,
      bettingEvaluation: report.bettingEvaluation,
      learnedParams: report.learnedParams,
      historicalCoverageGaps: report.historicalCoverageGaps
    }),
    JSON.stringify(report.ablations),
    JSON.stringify(report.calibrationBins)
  );
}
