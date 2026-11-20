import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import {
  SCENARIO_ARITHMETIC_FIXTURE,
  marginalizeScenarios,
  estimateParticipationFromEvidence,
  incrementalImpactBeyondBaseline,
  buildFeasibleNbaRotation,
  buildCoherentMlbPitchingPlan
} from "../server/core/availabilityScenarios";
import {
  isAvailableAtCutoff,
  checkFreshnessStatus,
  makeProvenancedValue
} from "../server/core/cutoffGuard";
import {
  americanToDecimal,
  decimalToAmerican,
  rawImpliedFromDecimal,
  rawImpliedFromAmerican,
  removeMarginProportional,
  expectedValuePerUnit,
  validateComparableSnapshots,
  settleMarketOutcome,
  analyzeMarketPricing
} from "../server/core/marketPricing";
import { COVERAGE_MATRIX } from "../server/core/coverageMatrix";
import { FEATURE_REGISTRY } from "../server/core/featureRegistry";
import { getVenueForGame, haversineMiles, computeTimezoneShift } from "../server/core/venues";
import { createDatabase } from "../server/db/database";
import { fetchNwsVenueWeather } from "../server/providers/nwsWeatherAdapter";
import {
  computeBrierScore,
  computeLogLoss,
  computeCalibrationBins,
  fitFoldLocalLogisticModel,
  predictWithLogisticModel
} from "../server/models/calibration";
import { runNflModel } from "../server/models/nflModel";
import { runNbaModel } from "../server/models/nbaModel";
import { runMlbModel } from "../server/models/mlbModel";
import { computeNflRollingMetricsBeforeDate, NflverseGameRow, NflverseTeamWeekRow } from "../server/providers/nflverseAdapter";
import { generatePrediction, getPredictionVersionsForGame, reconcileCompletedGames } from "../server/engine/predictionOrchestrator";
import { CanonicalGame, MarketSnapshot, PlayerAvailabilityRecord } from "../server/core/types";

test("1. Availability scenario marginalization arithmetic & baseline non-double-counting", () => {
  assert.equal(SCENARIO_ARITHMETIC_FIXTURE.isTestFixture, true);
  const res = marginalizeScenarios(
    SCENARIO_ARITHMETIC_FIXTURE.scenarios.map(s => ({
      probability: s.probability,
      conditionalHomeWinProb: s.conditionalWinProb
    }))
  );
  // 0.60 * 0.64 + 0.40 * 0.49 = 0.384 + 0.196 = 0.580
  assert.ok(Math.abs(res.homeWinProb - 0.58) < 1e-6);
  assert.ok(Math.abs(res.homeWinProb + res.awayWinProb + res.tieProb - 1.0) < 1e-6);

  // Rejects invalid weights not summing to 1 or negative weights
  assert.throws(() => marginalizeScenarios([{ probability: 0.7, conditionalHomeWinProb: 0.6 }]));
  assert.throws(() =>
    marginalizeScenarios([
      { probability: -0.1, conditionalHomeWinProb: 0.5 },
      { probability: 1.1, conditionalHomeWinProb: 0.5 }
    ])
  );

  // Incremental injury impact scales by (1 - alreadyReflectedInBaselinePct)
  assert.ok(Math.abs(incrementalImpactBeyondBaseline(6.0, 0.75) - 1.5) < 1e-6);

  // NFL practice status distinguishes Questionable+FP vs Questionable+DNP
  const qFp: PlayerAvailabilityRecord = {
    playerId: "p1",
    playerName: "WR1",
    teamAbbr: "KC",
    position: "WR",
    role: "starter",
    practiceStatus: "FP",
    gameDesignation: "Questionable",
    injuryOrReason: "Ankle",
    confirmedParticipationProb: null,
    expectedWorkloadPct: 1,
    replacementDropoffPoints: 2.0,
    alreadyReflectedInBaselinePct: 0,
    source: "espn",
    sourcePublishedUtc: "2025-10-10T18:00:00Z",
    ingestedUtc: "2025-10-10T18:05:00Z",
    status: "confirmed"
  };
  const qDnp = { ...qFp, practiceStatus: "DNP" as const };
  const estFp = estimateParticipationFromEvidence(qFp, "NFL");
  const estDnp = estimateParticipationFromEvidence(qDnp, "NFL");
  assert.ok(estFp.fullProb > estDnp.fullProb);
});

test("2. Point-in-time cutoff guard blocks future leakage & historical stats stay strictly prior", () => {
  const futureCheck = isAvailableAtCutoff("2025-10-12T19:00:00Z", "2025-10-12T18:00:00Z");
  assert.equal(futureCheck.allowed, false);

  const validCheck = isAvailableAtCutoff("2025-10-12T17:30:00Z", "2025-10-12T18:00:00Z");
  assert.equal(validCheck.allowed, true);

  assert.equal(checkFreshnessStatus("2025-10-12T10:00:00Z", "2025-10-12T18:00:00Z", 120), "stale");
  assert.equal(checkFreshnessStatus("2025-10-12T17:30:00Z", "2025-10-12T18:00:00Z", 120), "confirmed");

  const pv = makeProvenancedValue({
    value: 112.5,
    units: "ORtg",
    source: "test_feed",
    sourcePublishedUtc: "2025-10-12T20:00:00Z",
    eventTimeUtc: "2025-10-12T18:00:00Z",
    cutoffUtc: "2025-10-12T18:00:00Z",
    status: "confirmed"
  });
  assert.equal(pv.value, null);
  assert.equal(pv.status, "missing");

  // Historical rolling computation excludes target date and future games
  const mockGames: NflverseGameRow[] = [
    {
      game_id: "g1",
      season: 2025,
      game_type: "REG",
      week: 1,
      gameday: "2025-09-07",
      gametime: "13:00",
      home_team: "KC",
      away_team: "BAL",
      home_score: 27,
      away_score: 20,
      result: 7,
      total: 47,
      overtime: 0,
      home_rest: 7,
      away_rest: 7,
      location: "Home",
      roof: "outdoors",
      surface: "grass",
      temp: 75,
      wind: 5,
      div_game: 0,
      home_moneyline: -150,
      away_moneyline: 130,
      spread_line: 3,
      total_line: 47.5,
      home_qb_name: "P. Mahomes",
      away_qb_name: "L. Jackson",
      home_coach: "A. Reid",
      away_coach: "J. Harbaugh",
      referee: "C. Cheffers",
      stadium: "Arrowhead"
    },
    {
      game_id: "g2",
      season: 2025,
      game_type: "REG",
      week: 2,
      gameday: "2025-09-14",
      gametime: "16:25",
      home_team: "KC",
      away_team: "BUF",
      home_score: 40,
      away_score: 10,
      result: 30,
      total: 50,
      overtime: 0,
      home_rest: 7,
      away_rest: 7,
      location: "Home",
      roof: "outdoors",
      surface: "grass",
      temp: 72,
      wind: 6,
      div_game: 0,
      home_moneyline: -140,
      away_moneyline: 120,
      spread_line: 2.5,
      total_line: 48.5,
      home_qb_name: "P. Mahomes",
      away_qb_name: "J. Allen",
      home_coach: "A. Reid",
      away_coach: "S. McDermott",
      referee: "B. Allen",
      stadium: "Arrowhead"
    }
  ];
  const mockStats: NflverseTeamWeekRow[] = [
    {
      season: 2025,
      week: 1,
      game_id: "g1",
      team: "KC",
      opponent_team: "BAL",
      passing_epa: 8.0,
      rushing_epa: 2.0,
      passing_cpoe: 3.1,
      attempts: 30,
      carries: 25,
      sacks_suffered: 1,
      passing_first_downs: 12,
      rushing_first_downs: 6,
      passing_interceptions: 0,
      fumbles_lost_total: 0,
      fumble_recovery_opp: 0,
      def_sacks: 3,
      def_qb_hits: 7,
      def_interceptions: 1,
      passing_20: 4,
      rushing_20: 1,
      penalties: 5,
      fg_made: 2,
      fg_att: 2,
      pt_net_yards: 180,
      pt_att: 4,
      penalty_yards: 45
    },
    {
      season: 2025,
      week: 2,
      game_id: "g2",
      team: "KC",
      opponent_team: "BUF",
      passing_epa: 25.0,
      rushing_epa: 10.0,
      passing_cpoe: 6.4,
      attempts: 35,
      carries: 25,
      sacks_suffered: 0,
      passing_first_downs: 18,
      rushing_first_downs: 8,
      passing_interceptions: 0,
      fumbles_lost_total: 0,
      fumble_recovery_opp: 1,
      def_sacks: 5,
      def_qb_hits: 9,
      def_interceptions: 2,
      passing_20: 6,
      rushing_20: 2,
      penalties: 3,
      fg_made: 2,
      fg_att: 2,
      pt_net_yards: 90,
      pt_att: 2,
      penalty_yards: 30
    }
  ];

  const rollingBeforeWk2 = computeNflRollingMetricsBeforeDate({
    teamAbbr: "KC",
    cutoffGameday: "2025-09-14",
    games: mockGames,
    teamWeekStats: mockStats
  });
  assert.ok(rollingBeforeWk2 !== null);
  assert.equal(rollingBeforeWk2!.gamesPlayed, 1);
});

test("3. Market odds conversions, proportional margin removal, push-aware EV & comparable snapshot validation", () => {
  assert.ok(Math.abs(americanToDecimal(-150) - 1.666667) < 1e-4);
  assert.ok(Math.abs(americanToDecimal(150) - 2.5) < 1e-6);
  assert.equal(decimalToAmerican(2.5), 150);
  assert.equal(decimalToAmerican(1.5), -200);

  assert.ok(Math.abs(rawImpliedFromAmerican(-150) - 0.6) < 1e-6);
  assert.ok(Math.abs(rawImpliedFromDecimal(2.5) - 0.4) < 1e-6);

  const novig = removeMarginProportional([0.6, 0.434783]);
  assert.equal(novig.method, "proportional_normalization_approx");
  assert.ok(Math.abs(novig.normalized[0] + novig.normalized[1] - 1.0) < 1e-6);
  assert.ok(novig.overround > 0.03);

  // Push-aware EV: E = pWin*(d-1) - pLoss (ties push and return 1 unit -> 0 net)
  const ev = expectedValuePerUnit({ pWin: 0.55, pLoss: 0.44, pPush: 0.01, decimalOdds: 2.0 });
  assert.ok(Math.abs(ev - 0.11) < 1e-6);

  // Comparable snapshot validation prevents comparing mismatched rules or periods
  const snapA: MarketSnapshot = {
    oddsId: "o1",
    gameId: "g1",
    league: "NFL",
    sportsbook: "bookA",
    marketType: "h2h",
    period: "full_game",
    line: null,
    homePriceAmerican: -140,
    awayPriceAmerican: 120,
    overPriceAmerican: null,
    underPriceAmerican: null,
    homeDecimal: 1.714,
    awayDecimal: 2.2,
    settlementRulesVersion: "v1",
    capturedUtc: "2025-10-01T12:00:00Z",
    source: "test",
    isUserSupplied: false,
    status: "confirmed"
  };
  const snapB: MarketSnapshot = { ...snapA, period: "first_half" };
  assert.equal(validateComparableSnapshots([snapA, snapB]).comparable, false);

  // Settlement rules: NFL tie pushes 2-way ML; spread push returns 0; canceled voids
  assert.equal(
    settleMarketOutcome({
      marketType: "h2h",
      side: "home",
      line: null,
      homeScore: 24,
      awayScore: 24,
      gameStatus: "final",
      decimalOdds: 1.91
    }).outcome,
    "push"
  );
  assert.equal(
    settleMarketOutcome({
      marketType: "spread",
      side: "home",
      line: -3.0,
      homeScore: 27,
      awayScore: 24,
      gameStatus: "final",
      decimalOdds: 1.91
    }).outcome,
    "push"
  );
  assert.equal(
    settleMarketOutcome({
      marketType: "h2h",
      side: "home",
      line: null,
      homeScore: null,
      awayScore: null,
      gameStatus: "canceled",
      decimalOdds: 1.91
    }).outcome,
    "void"
  );

  // Missing market odds returns honest unavailable notice (isMarketInformedModel always false)
  const marketMissing = analyzeMarketPricing({
    league: "NBA",
    modelHomeWinProb: 0.62,
    modelAwayWinProb: 0.38,
    modelTieProb: 0,
    snapshot: null,
    isMarketInformedModel: false
  });
  assert.equal(marketMissing.available, false);
  assert.equal(marketMissing.isMarketInformedModel, false);
});

test("4. Missing-vs-zero integrity & indoor NBA weather exclusion", async () => {
  const nbaVenue = getVenueForGame("NBA", "Boston Celtics");
  assert.ok(nbaVenue !== null);
  const wx = await fetchNwsVenueWeather({
    gameId: "nba_test_1",
    venue: nbaVenue,
    scheduledStartUtc: new Date(Date.now() + 3600 * 1000).toISOString()
  });
  assert.equal(wx.status, "not_applicable");
  assert.equal(wx.roofStatus, "indoor");

  // Historical outdoor game >24h ago without archived forecast returns explicit 'missing', NOT fabricated 70F clear skies
  const mlbVenue = getVenueForGame("MLB", "Chicago Cubs");
  const histWx = await fetchNwsVenueWeather({
    gameId: "mlb_hist_none",
    venue: mlbVenue,
    scheduledStartUtc: "2024-06-15T18:20:00Z"
  });
  assert.equal(histWx.status, "missing");
  assert.equal(histWx.tempF, null);
});

test("5. NFL tie probability & outcome simplex sum to 1.0 across regular season vs postseason", () => {
  const venue = getVenueForGame("NFL", "Kansas City Chiefs");
  const baseGame: CanonicalGame = {
    gameId: "nfl_test_tie",
    league: "NFL",
    season: 2025,
    competitionPhase: "regular",
    homeTeamId: "nfl_KC",
    awayTeamId: "nfl_BUF",
    homeTeamName: "Kansas City Chiefs",
    awayTeamName: "Buffalo Bills",
    homeTeamAbbr: "KC",
    awayTeamAbbr: "BUF",
    venueId: venue!.venueId,
    venueName: venue!.name,
    venueTimezone: venue!.timezone,
    scheduledStartUtc: "2025-11-16T21:25:00Z",
    neutralSite: false,
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

  const regOut = runNflModel({
    game: baseGame,
    venue,
    weather: null,
    travelRest: {
      homeRestDays: 7, awayRestDays: 7, homeIsB2B: false, awayIsB2B: false,
      homeShortWeek: false, awayShortWeek: false, homeOffBye: false, awayOffBye: false,
      awayTravelMilesFromPrev: 1100, homeTravelMilesFromPrev: 0, awayTimezonesCrossed: 1,
      awayTravelDirection: "westbound", awayRoadTripGameNum: 1, arrivalTimingStatus: "unknown",
      scheduleDensityLast7DaysHome: 1, scheduleDensityLast7DaysAway: 1, status: "confirmed"
    },
    homeRolling: null,
    awayRolling: null,
    homeStanding: null,
    awayStanding: null,
    injuries: []
  });
  assert.ok(regOut.tieProb > 0);
  assert.ok(Math.abs(regOut.homeWinProb + regOut.awayWinProb + regOut.tieProb - 1.0) < 1e-4);

  const postOut = runNflModel({
    game: { ...baseGame, competitionPhase: "postseason" },
    venue,
    weather: null,
    travelRest: {
      homeRestDays: 7, awayRestDays: 7, homeIsB2B: false, awayIsB2B: false,
      homeShortWeek: false, awayShortWeek: false, homeOffBye: false, awayOffBye: false,
      awayTravelMilesFromPrev: 1100, homeTravelMilesFromPrev: 0, awayTimezonesCrossed: 1,
      awayTravelDirection: "westbound", awayRoadTripGameNum: 1, arrivalTimingStatus: "unknown",
      scheduleDensityLast7DaysHome: 1, scheduleDensityLast7DaysAway: 1, status: "confirmed"
    },
    homeRolling: null,
    awayRolling: null,
    homeStanding: null,
    awayStanding: null,
    injuries: []
  });
  assert.equal(postOut.tieProb, 0);
  assert.ok(Math.abs(postOut.homeWinProb + postOut.awayWinProb + postOut.tieProb - 1.0) < 1e-4);
});

test("6. NBA 240-minute rotation conservation & per-player ceiling under missing starter", () => {
  const roster = [
    { playerName: "Star PG", position: "PG", baselineMinutes: 35, role: "starter" },
    { playerName: "Wing SG", position: "SG", baselineMinutes: 33, role: "starter" },
    { playerName: "Forward SF", position: "SF", baselineMinutes: 32, role: "starter" },
    { playerName: "Forward PF", position: "PF", baselineMinutes: 31, role: "starter" },
    { playerName: "Center C", position: "C", baselineMinutes: 29, role: "starter" },
    { playerName: "Sixth Man", position: "G", baselineMinutes: 24, role: "sixth_man" },
    { playerName: "Bench F", position: "F", baselineMinutes: 20, role: "rotation" },
    { playerName: "Backup C", position: "C", baselineMinutes: 16, role: "backup_big" },
    { playerName: "Depth G", position: "G", baselineMinutes: 11, role: "depth" },
    { playerName: "Depth F", position: "F", baselineMinutes: 9, role: "depth" }
  ];
  const outAbsence: PlayerAvailabilityRecord = {
    playerId: "p_out",
    playerName: "Star PG",
    teamAbbr: "BOS",
    position: "PG",
    role: "starter",
    gameDesignation: "Out",
    injuryOrReason: "Rest",
    confirmedParticipationProb: 0,
    expectedWorkloadPct: 0,
    replacementDropoffPoints: 4.5,
    alreadyReflectedInBaselinePct: 0,
    source: "espn",
    sourcePublishedUtc: null,
    ingestedUtc: new Date().toISOString(),
    status: "confirmed"
  };

  const regRot = buildFeasibleNbaRotation({ startersAndBench: roster, absences: [outAbsence], isPlayoff: false });
  assert.equal(regRot.feasible, true);
  assert.ok(Math.abs(regRot.totalMinutes - 240.0) <= 0.2);
  assert.equal(regRot.rotation.find(r => r.playerName === "Star PG")?.projectedMinutes, 0);
  assert.ok(regRot.rotation.every(r => r.projectedMinutes <= 39.0));
});

test("7. MLB 9-inning pitching conservation, rain delay curtailment, doubleheader bullpen fatigue & park/wind check", () => {
  const plan = buildCoherentMlbPitchingPlan({
    starterName: "Ace Pitcher",
    starterFip: 3.1,
    starterK9: 10.5,
    starterBb9: 2.1,
    expectedStarterInnings: 6.2,
    isPitchLimited: false,
    delayRiskScore: 0.7, // High rain delay risk curtails SP expected innings
    bullpenFip: 3.85,
    tiredRelieversCount: 2, // Doubleheader game 2 fatigue penalty
    starterStatus: "confirmed"
  });
  assert.ok(Math.abs(plan.totalInnings - 9.0) < 0.11);
  const sp = plan.staff.find(s => s.role === "starter")!;
  assert.ok(sp.projectedInnings < 5.5);

  // Full MLB model returns normalized probs and wind direction check
  const chcVenue = getVenueForGame("MLB", "Chicago Cubs");
  const mlbGame: CanonicalGame = {
    gameId: "mlb_test_wx",
    league: "MLB",
    season: 2025,
    competitionPhase: "regular",
    homeTeamId: "mlb_CHC",
    awayTeamId: "mlb_LAD",
    homeTeamName: "Chicago Cubs",
    awayTeamName: "Los Angeles Dodgers",
    homeTeamAbbr: "CHC",
    awayTeamAbbr: "LAD",
    venueId: chcVenue!.venueId,
    venueName: chcVenue!.name,
    venueTimezone: chcVenue!.timezone,
    scheduledStartUtc: "2025-07-04T18:20:00Z",
    neutralSite: false,
    doubleheaderGameNum: 2,
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    wentOvertime: false,
    overtimePeriods: 0,
    isTie: false,
    rescheduledFromUtc: null,
    providerIds: {}
  };
  const mlbWindOut = runMlbModel({
    game: mlbGame,
    venue: chcVenue,
    weather: {
      forecastId: "wx_out", gameId: mlbGame.gameId, venueId: chcVenue!.venueId, source: "nws",
      issuedUtc: "2025-07-04T15:00:00Z", validUtc: mlbGame.scheduledStartUtc, ingestedUtc: "2025-07-04T15:05:00Z",
      tempF: 85, windMph: 20, windGustMph: 26, windDirDeg: 217, precipProb: 5, precipIn: 0,
      roofStatus: "open", surface: "grass", altitudeFt: 600, airDensityIndex: 0.96, delayRiskScore: 0.05, status: "confirmed"
    },
    travelRest: {
      homeRestDays: 1, awayRestDays: 1, homeIsB2B: true, awayIsB2B: true,
      homeShortWeek: false, awayShortWeek: false, homeOffBye: false, awayOffBye: false,
      awayTravelMilesFromPrev: 2000, homeTravelMilesFromPrev: 0, awayTimezonesCrossed: 2,
      awayTravelDirection: "eastbound", awayRoadTripGameNum: 3, arrivalTimingStatus: "unknown",
      scheduleDensityLast7DaysHome: 6, scheduleDensityLast7DaysAway: 6, status: "confirmed"
    },
    homePitcher: null,
    awayPitcher: null,
    homeLineupConfirmed: true,
    awayLineupConfirmed: false,
    homeStanding: null,
    awayStanding: null,
    injuries: []
  });
  const mlbWindIn = runMlbModel({
    game: mlbGame,
    venue: chcVenue,
    weather: {
      forecastId: "wx_in", gameId: mlbGame.gameId, venueId: chcVenue!.venueId, source: "nws",
      issuedUtc: "2025-07-04T15:00:00Z", validUtc: mlbGame.scheduledStartUtc, ingestedUtc: "2025-07-04T15:05:00Z",
      tempF: 85, windMph: 20, windGustMph: 26, windDirDeg: 37, precipProb: 5, precipIn: 0,
      roofStatus: "open", surface: "grass", altitudeFt: 600, airDensityIndex: 0.96, delayRiskScore: 0.05, status: "confirmed"
    },
    travelRest: {
      homeRestDays: 1, awayRestDays: 1, homeIsB2B: true, awayIsB2B: true,
      homeShortWeek: false, awayShortWeek: false, homeOffBye: false, awayOffBye: false,
      awayTravelMilesFromPrev: 2000, homeTravelMilesFromPrev: 0, awayTimezonesCrossed: 2,
      awayTravelDirection: "eastbound", awayRoadTripGameNum: 3, arrivalTimingStatus: "unknown",
      scheduleDensityLast7DaysHome: 6, scheduleDensityLast7DaysAway: 6, status: "confirmed"
    },
    homePitcher: null,
    awayPitcher: null,
    homeLineupConfirmed: true,
    awayLineupConfirmed: false,
    homeStanding: null,
    awayStanding: null,
    injuries: []
  });
  assert.ok(mlbWindOut.projectedTotal! > mlbWindIn.projectedTotal!);
  assert.equal(mlbWindOut.tieProb, 0);
});

test("8. SQLite schema migrations, immutable prediction version increment & outcome scoring", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "quant-engine-test-"));
  const dbPath = path.join(tmpDir, "test_engine.db");
  const db = createDatabase(dbPath);

  const migRow = db.prepare(`SELECT COUNT(*) as c FROM schema_migrations`).get() as { c: number };
  assert.ok(migRow.c >= 1);

  const p1 = await generatePrediction({
    league: "NBA",
    homeTeam: "Boston Celtics",
    awayTeam: "Miami Heat",
    gameId: "test_immutable_nba_1",
    db
  });
  const p2 = await generatePrediction({
    league: "NBA",
    homeTeam: "Boston Celtics",
    awayTeam: "Miami Heat",
    gameId: "test_immutable_nba_1",
    customParams: { missingStarHome: true },
    db
  });

  assert.equal(p1.engineSnapshot.versionNum, 1);
  assert.equal(p2.engineSnapshot.versionNum, 2);
  assert.notEqual(p1.engineSnapshot.predictionId, p2.engineSnapshot.predictionId);

  const versions = await getPredictionVersionsForGame("test_immutable_nba_1", db);
  assert.equal(versions.length, 2);
  // Star out scenario shifts Celtics win probability downward vs full-strength v1
  assert.ok(p2.engineSnapshot.homeWinProb < p1.engineSnapshot.homeWinProb);

  // Mark synthetic test game final in DB & ensure prediction_outcomes scores both versions cleanly
  db.prepare(`UPDATE games SET status = 'final', home_score = 112, away_score = 104 WHERE game_id = ?`).run(
    "test_immutable_nba_1"
  );
  const rec = await reconcileCompletedGames(db);
  assert.ok(rec.settledCount >= 2);

  const outRows = db
    .prepare(`SELECT * FROM prediction_outcomes WHERE game_id = ?`)
    .all("test_immutable_nba_1") as Array<any>;
  assert.equal(outRows.length, 2);
  assert.equal(outRows[0].winner, "home");
  assert.ok(outRows[0].brier_score >= 0 && outRows[0].brier_score <= 1);

  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("9. Coverage Matrix includes every factor ID (U01-U16, NFL01-NFL14, NBA01-NBA15, MLB01-MLB16, W01-W08) & Feature Registry", () => {
  const expectedIds = [
    ...Array.from({ length: 16 }, (_, i) => `U${String(i + 1).padStart(2, "0")}`),
    ...Array.from({ length: 14 }, (_, i) => `NFL${String(i + 1).padStart(2, "0")}`),
    ...Array.from({ length: 15 }, (_, i) => `NBA${String(i + 1).padStart(2, "0")}`),
    ...Array.from({ length: 16 }, (_, i) => `MLB${String(i + 1).padStart(2, "0")}`),
    ...Array.from({ length: 8 }, (_, i) => `W${String(i + 1).padStart(2, "0")}`)
  ];

  const matrixIds = new Set(COVERAGE_MATRIX.map(c => c.factorId));
  for (const id of expectedIds) {
    assert.ok(matrixIds.has(id), `Missing factor ID in COVERAGE_MATRIX: ${id}`);
  }
  assert.equal(COVERAGE_MATRIX.length, 69);

  // Weak signals must not be falsely promoted to implemented_validated
  const weakRows = COVERAGE_MATRIX.filter(c => c.category === "WeakSignal");
  assert.equal(weakRows.length, 8);
  assert.ok(weakRows.every(w => w.status === "excluded"));

  assert.ok(FEATURE_REGISTRY.length >= 10);
  assert.ok(FEATURE_REGISTRY.some(f => f.kind === "observation"));
  assert.ok(FEATURE_REGISTRY.some(f => f.kind === "model_derived_estimate"));
});

test("10. Proper scoring rules (Brier, LogLoss, ECE, Binomial SE) & fold-local logistic preprocessing", () => {
  const probs = [0.8, 0.2, 0.7, 0.3];
  const outcomes = [1, 0, 1, 0];
  assert.ok(Math.abs(computeBrierScore(probs, outcomes) - 0.065) < 1e-5);
  assert.ok(computeLogLoss(probs, outcomes) < 0.3);

  const { bins, ece } = computeCalibrationBins(probs, outcomes, 5);
  assert.equal(bins.length, 5);
  assert.ok(ece >= 0);

  // Binomial SE check on bin [0.6-0.8): p=0.5 empirical example check
  const seTest = computeCalibrationBins([0.7, 0.7], [1, 0], 5);
  const nonEmpty = seTest.bins.find(b => b.count === 2)!;
  assert.ok(Math.abs(nonEmpty.stdError - 0.3536) < 1e-3);

  // Fold-local fit handles nulls without NaN propagation & separates clear linear signal
  const rawX: Array<Array<number | null>> = [];
  const y: number[] = [];
  for (let i = 0; i < 60; i++) {
    const s = i % 2 === 0 ? 1.5 : -1.5;
    rawX.push([s, i % 5 === 0 ? null : s * 0.5]);
    y.push(i % 2 === 0 ? 1 : 0);
  }
  const fitted = fitFoldLocalLogisticModel({ rawFeatures: rawX, outcomes: y, featureNames: ["f1", "f2"], l2Lambda: 0.5, epochs: 300 });
  const pPos = predictWithLogisticModel(fitted, [1.5, null]);
  const pNeg = predictWithLogisticModel(fitted, [-1.5, null]);
  assert.ok(pPos > 0.75);
  assert.ok(pNeg < 0.25);

  // Haversine & timezone check (LAL to BOS eastbound +3 TZ)
  const lalVenue = getVenueForGame("NBA", "Los Angeles Lakers")!;
  const bosVenue = getVenueForGame("NBA", "Boston Celtics")!;
  const miles = haversineMiles(lalVenue.lat, lalVenue.lon, bosVenue.lat, bosVenue.lon);
  assert.ok(miles > 2400 && miles < 2700);
  const tz = computeTimezoneShift(lalVenue.timezone, bosVenue.timezone);
  assert.equal(tz.direction, "eastbound");
  assert.equal(tz.hoursDiff, 3);
});

test("11. NBA quick model run emits valid simplex and feasible 240-min rotations", () => {
  const bos = getVenueForGame("NBA", "Boston Celtics");
  const out = runNbaModel({
    game: {
      gameId: "nba_m_1", league: "NBA", season: 2025, competitionPhase: "regular",
      homeTeamId: "nba_BOS", awayTeamId: "nba_MIA", homeTeamName: "Boston Celtics", awayTeamName: "Miami Heat",
      homeTeamAbbr: "BOS", awayTeamAbbr: "MIA", venueId: bos!.venueId, venueName: bos!.name,
      venueTimezone: bos!.timezone, scheduledStartUtc: "2025-11-20T00:30:00Z", neutralSite: false,
      doubleheaderGameNum: null, status: "scheduled", homeScore: null, awayScore: null,
      wentOvertime: false, overtimePeriods: 0, isTie: false, rescheduledFromUtc: null, providerIds: {}
    },
    venue: bos,
    travelRest: {
      homeRestDays: 2, awayRestDays: 1, homeIsB2B: false, awayIsB2B: true,
      homeShortWeek: false, awayShortWeek: false, homeOffBye: false, awayOffBye: false,
      awayTravelMilesFromPrev: 1200, homeTravelMilesFromPrev: 0, awayTimezonesCrossed: 0,
      awayTravelDirection: "neutral", awayRoadTripGameNum: 1, arrivalTimingStatus: "unknown",
      scheduleDensityLast7DaysHome: 3, scheduleDensityLast7DaysAway: 4, status: "confirmed"
    },
    homeStanding: { teamName: "Boston Celtics", teamAbbr: "BOS", wins: 12, losses: 3, ties: 0, winPct: 0.8, pointsForPerGame: 118, pointsAgainstPerGame: 108, pointDiffPerGame: 10, streak: "W3", homeRecord: "6-1", awayRecord: "6-2", fetchedUtc: new Date().toISOString() },
    awayStanding: { teamName: "Miami Heat", teamAbbr: "MIA", wins: 7, losses: 7, ties: 0, winPct: 0.5, pointsForPerGame: 109, pointsAgainstPerGame: 110, pointDiffPerGame: -1, streak: "L1", homeRecord: "4-3", awayRecord: "3-4", fetchedUtc: new Date().toISOString() },
    injuries: [],
    homeRosterBase: [
      { playerName: "S1", position: "PG", baselineMinutes: 35, role: "starter" },
      { playerName: "S2", position: "SG", baselineMinutes: 34, role: "starter" },
      { playerName: "S3", position: "SF", baselineMinutes: 33, role: "starter" },
      { playerName: "S4", position: "PF", baselineMinutes: 31, role: "starter" },
      { playerName: "S5", position: "C", baselineMinutes: 29, role: "starter" },
      { playerName: "B1", position: "G", baselineMinutes: 24, role: "sixth_man" },
      { playerName: "B2", position: "F", baselineMinutes: 20, role: "rotation" },
      { playerName: "B3", position: "C", baselineMinutes: 16, role: "backup_big" },
      { playerName: "B4", position: "G", baselineMinutes: 10, role: "depth" },
      { playerName: "B5", position: "F", baselineMinutes: 8, role: "depth" }
    ],
    awayRosterBase: [
      { playerName: "A1", position: "PG", baselineMinutes: 35, role: "starter" },
      { playerName: "A2", position: "SG", baselineMinutes: 34, role: "starter" },
      { playerName: "A3", position: "SF", baselineMinutes: 33, role: "starter" },
      { playerName: "A4", position: "PF", baselineMinutes: 31, role: "starter" },
      { playerName: "A5", position: "C", baselineMinutes: 29, role: "starter" },
      { playerName: "AB1", position: "G", baselineMinutes: 24, role: "sixth_man" },
      { playerName: "AB2", position: "F", baselineMinutes: 20, role: "rotation" },
      { playerName: "AB3", position: "C", baselineMinutes: 16, role: "backup_big" },
      { playerName: "AB4", position: "G", baselineMinutes: 10, role: "depth" },
      { playerName: "AB5", position: "F", baselineMinutes: 8, role: "depth" }
    ]
  });
  assert.equal(out.tieProb, 0);
  assert.ok(Math.abs(out.homeWinProb + out.awayWinProb - 1.0) < 1e-4);
  assert.ok(out.homeWinProb > 0.65);
  assert.equal(out.rotationsFeasible, true);
  assert.ok(Math.abs(out.homeMinutesTotal - 240) <= 0.5);
});
