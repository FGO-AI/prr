import {
  buildFeasibleNbaRotation,
  estimateParticipationFromEvidence,
  incrementalImpactBeyondBaseline,
  marginalizeScenarios,
  synthesizeJointScenarios
} from "../core/availabilityScenarios";
import {
  AvailabilityScenario,
  CanonicalGame,
  ModelDriver,
  PlayerAvailabilityRecord,
  RotationEntry,
  TravelRestMetrics,
  VenueMetadata
} from "../core/types";
import { EspnTeamStandingStats } from "../providers/espnAdapter";
import { clampProb, LogisticParameters, predictWithLogisticModel, sigmoid } from "./calibration";

export const NBA_MODEL_VERSION = "nba_netrtg_rotation_v2.1.0";

export const NBA_EFFICIENCY_DEFINITION =
  "ORtg = Points scored per 100 possessions; DRtg = Points allowed per 100 possessions; NetRtg = ORtg - DRtg; Pace = Estimated possessions per 48 minutes.";

export const NBA_FEATURE_NAMES = [
  "net_rtg_diff", // (homeNetRtg - awayNetRtg) per 100 possessions
  "win_pct_diff",
  "home_court_flag", // 1 if non-neutral home venue
  "rest_diff", // homeRestDays - awayRestDays
  "b2b_penalty_diff", // awayIsB2B - homeIsB2B
  "travel_tz_eastbound_penalty" // away eastbound TZ shifts
];

export interface NbaModelInputs {
  game: CanonicalGame;
  venue: VenueMetadata | null;
  travelRest: TravelRestMetrics;
  homeStanding: EspnTeamStandingStats | null;
  awayStanding: EspnTeamStandingStats | null;
  injuries: PlayerAvailabilityRecord[];
  homeRosterBase: Array<{ playerName: string; position: string; baselineMinutes: number; role: string }>;
  awayRosterBase: Array<{ playerName: string; position: string; baselineMinutes: number; role: string }>;
  learnedParams?: LogisticParameters | null;
  customOverrides?: {
    homeNetRtg?: number;
    awayNetRtg?: number;
    pace?: number;
    isB2B?: boolean;
    missingStarHome?: boolean;
    missingStarAway?: boolean;
    isPlayoff?: boolean;
  };
}

export interface NbaModelOutput {
  homeWinProb: number;
  awayWinProb: number;
  tieProb: number; // Always 0 for NBA
  projectedMargin: number;
  projectedTotal: number | null;
  marginStdDev: number;
  scenarios: AvailabilityScenario[];
  homeRotation: RotationEntry[];
  awayRotation: RotationEntry[];
  homeMinutesTotal: number;
  awayMinutesTotal: number;
  rotationsFeasible: boolean;
  topDrivers: ModelDriver[];
  notes: string[];
}

export function extractNbaFeatureVector(params: {
  homeNetRtg: number | null;
  awayNetRtg: number | null;
  homeWinPct: number | null;
  awayWinPct: number | null;
  neutralSite: boolean;
  homeRestDays: number | null;
  awayRestDays: number | null;
  homeIsB2B: boolean;
  awayIsB2B: boolean;
  awayEastboundTzPenalty: number;
}): Array<number | null> {
  return [
    params.homeNetRtg !== null && params.awayNetRtg !== null ? params.homeNetRtg - params.awayNetRtg : null,
    params.homeWinPct !== null && params.awayWinPct !== null ? params.homeWinPct - params.awayWinPct : null,
    params.neutralSite ? 0 : 1,
    params.homeRestDays !== null && params.awayRestDays !== null
      ? Math.max(-4, Math.min(4, params.homeRestDays - params.awayRestDays))
      : 0,
    (params.awayIsB2B ? 1 : 0) - (params.homeIsB2B ? 1 : 0),
    params.awayEastboundTzPenalty
  ];
}

export function nbaMarginToWinProbs(margin: number, marginStdDev: number = 12.2): {
  home: number;
  away: number;
  tie: number;
} {
  // Empirical NBA margin dispersion ~12.2 points; logistic k ~ 0.145
  const scale = 12.2 / Math.max(8, marginStdDev);
  const home = Number(clampProb(sigmoid(0.145 * scale * margin), 0.02).toFixed(4));
  const away = Number((1 - home).toFixed(4));
  return { home, away, tie: 0 };
}

export function runNbaModel(inputs: NbaModelInputs): NbaModelOutput {
  const notes: string[] = [
    "Indoor NBA venue: outdoor weather adjustments explicitly marked not_applicable."
  ];
  const drivers: ModelDriver[] = [];
  const isPlayoff = inputs.game.competitionPhase === "postseason" || Boolean(inputs.customOverrides?.isPlayoff);
  const marginStdDev = isPlayoff ? 11.4 : 12.4;

  // Estimate Net Rating per 100 possessions (if ESPN PPG/OppPPG available, scale by standard ~98.5 pace)
  const estPace = inputs.customOverrides?.pace ?? 98.5;
  const homeNetRtg =
    inputs.homeStanding?.pointDiffPerGame !== null && inputs.homeStanding?.pointDiffPerGame !== undefined
      ? Number(((inputs.homeStanding.pointDiffPerGame / estPace) * 100).toFixed(2))
      : inputs.customOverrides?.homeNetRtg ?? null;
  const awayNetRtg =
    inputs.awayStanding?.pointDiffPerGame !== null && inputs.awayStanding?.pointDiffPerGame !== undefined
      ? Number(((inputs.awayStanding.pointDiffPerGame / estPace) * 100).toFixed(2))
      : inputs.customOverrides?.awayNetRtg ?? null;

  let baseMargin = inputs.game.neutralSite ? 0 : 2.55; // Empirical NBA home court ~2.5 pts
  let baseTotal: number | null = null;

  if (homeNetRtg !== null && awayNetRtg !== null) {
    // Shrink extreme NetRtg diffs slightly toward 0 (mean-reversion + SOS caution)
    const shrunkDiff = (homeNetRtg - awayNetRtg) * 0.88;
    const netRtgMargin = (shrunkDiff * estPace) / 100;
    baseMargin += netRtgMargin;

    drivers.push({
      factorId: "NBA02/U01",
      name: "Net Rating Differential (per 100 poss.)",
      impactOnHomeWinProb: Number((netRtgMargin * 0.035).toFixed(3)),
      impactOnMargin: Number(netRtgMargin.toFixed(2)),
      direction: netRtgMargin >= 0 ? "home" : "away",
      evidenceSource: inputs.homeStanding ? "ESPN Standings Points Differential (pace-normalized)" : "User Parameters",
      status: inputs.homeStanding ? "confirmed" : "estimated",
      explanation: `${inputs.game.homeTeamAbbr} NetRtg ${homeNetRtg >= 0 ? "+" : ""}${homeNetRtg} vs ${inputs.game.awayTeamAbbr} ${awayNetRtg >= 0 ? "+" : ""}${awayNetRtg} across ~${estPace} possessions.`
    });
  } else {
    notes.push("Team NetRtg unavailable; using neutral rating prior + venue advantage.");
  }

  if (inputs.homeStanding?.pointsForPerGame && inputs.awayStanding?.pointsForPerGame &&
      inputs.homeStanding?.pointsAgainstPerGame && inputs.awayStanding?.pointsAgainstPerGame) {
    const homeExp = (inputs.homeStanding.pointsForPerGame + inputs.awayStanding.pointsAgainstPerGame) / 2;
    const awayExp = (inputs.awayStanding.pointsForPerGame + inputs.homeStanding.pointsAgainstPerGame) / 2;
    baseTotal = Number((homeExp + awayExp).toFixed(1));
  }

  // Altitude nuance for Denver / Utah indoor arenas (physiological acclimatization effect, NOT outdoor weather)
  if ((inputs.venue?.altitudeFt ?? 0) >= 4000 && !inputs.game.neutralSite) {
    baseMargin += 0.65;
    notes.push(`High-altitude arena (${inputs.venue?.altitudeFt} ft): +0.65 pts home conditioning adjustment applied.`);
  }

  // Fatigue, Back-to-Backs & Travel
  let restDelta = 0;
  const homeB2B = inputs.travelRest.homeIsB2B || Boolean(inputs.customOverrides?.isB2B);
  const awayB2B = inputs.travelRest.awayIsB2B;
  if (homeB2B) restDelta -= 1.85;
  if (awayB2B) restDelta += 1.85;
  if (inputs.travelRest.homeRestDays !== null && inputs.travelRest.awayRestDays !== null) {
    const restDiff = Math.max(-3, Math.min(3, inputs.travelRest.homeRestDays - inputs.travelRest.awayRestDays));
    restDelta += restDiff * 0.45;
  }
  const eastboundTz =
    inputs.travelRest.awayTravelDirection === "eastbound" ? (inputs.travelRest.awayTimezonesCrossed ?? 0) : 0;
  if (eastboundTz >= 2) restDelta += 0.55;
  baseMargin += restDelta;

  if (Math.abs(restDelta) >= 0.3) {
    drivers.push({
      factorId: "NBA13/U08/U09",
      name: "Schedule Fatigue, B2B & Travel",
      impactOnHomeWinProb: Number((restDelta * 0.035).toFixed(3)),
      impactOnMargin: Number(restDelta.toFixed(2)),
      direction: restDelta >= 0 ? "home" : "away",
      evidenceSource: "Canonical schedule & venue timezone shifts",
      status: inputs.travelRest.status,
      explanation: `Rest/B2B/travel adjustment ${restDelta >= 0 ? "+" : ""}${restDelta.toFixed(2)} pts (Home B2B: ${homeB2B}, Away B2B: ${awayB2B}).`
    });
  }

  // Injuries, Rest & Illness + Linked Rotation Redistribution (no double-counting!)
  const homeInj = inputs.injuries.filter(i => i.teamAbbr === inputs.game.homeTeamAbbr);
  const awayInj = inputs.injuries.filter(i => i.teamAbbr === inputs.game.awayTeamAbbr);

  if (inputs.customOverrides?.missingStarHome) {
    homeInj.push({
      playerId: "override_star_home",
      playerName: inputs.homeRosterBase[0]?.playerName || "Home Primary Creator",
      teamAbbr: inputs.game.homeTeamAbbr,
      position: "G",
      role: "key_rotation",
      gameDesignation: "Out",
      injuryOrReason: "Missing Star toggle",
      confirmedParticipationProb: 0,
      expectedWorkloadPct: 0,
      replacementDropoffPoints: 3.2,
      alreadyReflectedInBaselinePct: 0,
      source: "user_override",
      sourcePublishedUtc: null,
      ingestedUtc: new Date().toISOString(),
      status: "confirmed"
    });
  }
  if (inputs.customOverrides?.missingStarAway) {
    awayInj.push({
      playerId: "override_star_away",
      playerName: inputs.awayRosterBase[0]?.playerName || "Away Primary Creator",
      teamAbbr: inputs.game.awayTeamAbbr,
      position: "G",
      role: "key_rotation",
      gameDesignation: "Out",
      injuryOrReason: "Missing Star toggle",
      confirmedParticipationProb: 0,
      expectedWorkloadPct: 0,
      replacementDropoffPoints: 3.2,
      alreadyReflectedInBaselinePct: 0,
      source: "user_override",
      sourcePublishedUtc: null,
      ingestedUtc: new Date().toISOString(),
      status: "confirmed"
    });
  }

  // Enforce feasible 240-min rotations for both teams
  const homeRot = buildFeasibleNbaRotation({
    startersAndBench: inputs.homeRosterBase,
    absences: homeInj,
    isPlayoff
  });
  const awayRot = buildFeasibleNbaRotation({
    startersAndBench: inputs.awayRosterBase,
    absences: awayInj,
    isPlayoff
  });

  let confirmedHomeDelta = 0;
  let confirmedAwayDelta = 0;
  const uncertainHome: PlayerAvailabilityRecord[] = [];
  const uncertainAway: PlayerAvailabilityRecord[] = [];

  for (const r of homeInj) {
    const est = estimateParticipationFromEvidence(r, "NBA");
    if (est.absentProb >= 0.99) {
      confirmedHomeDelta -= incrementalImpactBeyondBaseline(r.replacementDropoffPoints, r.alreadyReflectedInBaselinePct);
    } else if (est.absentProb > 0.01) {
      uncertainHome.push(r);
    }
  }
  for (const r of awayInj) {
    const est = estimateParticipationFromEvidence(r, "NBA");
    if (est.absentProb >= 0.99) {
      confirmedAwayDelta -= incrementalImpactBeyondBaseline(r.replacementDropoffPoints, r.alreadyReflectedInBaselinePct);
    } else if (est.absentProb > 0.01) {
      uncertainAway.push(r);
    }
  }

  let modelShift = 0;
  if (inputs.learnedParams && homeNetRtg !== null && awayNetRtg !== null) {
    const feat = extractNbaFeatureVector({
      homeNetRtg,
      awayNetRtg,
      homeWinPct: inputs.homeStanding?.winPct ?? null,
      awayWinPct: inputs.awayStanding?.winPct ?? null,
      neutralSite: inputs.game.neutralSite,
      homeRestDays: inputs.travelRest.homeRestDays,
      awayRestDays: inputs.travelRest.awayRestDays,
      homeIsB2B: homeB2B,
      awayIsB2B: awayB2B,
      awayEastboundTzPenalty: eastboundTz >= 2 ? 1 : 0
    });
    const learnedProb = predictWithLogisticModel(inputs.learnedParams, feat);
    const learnedMargin = Math.log(clampProb(learnedProb) / (1 - clampProb(learnedProb))) / 0.145;
    modelShift = (learnedMargin - baseMargin) * 0.55;
  }

  const scenarios = synthesizeJointScenarios({
    league: "NBA",
    baseMargin: baseMargin + modelShift,
    baseTotal,
    marginStdDev,
    marginToHomeWinProb: m => nbaMarginToWinProbs(m, marginStdDev),
    homeUncertain: uncertainHome,
    awayUncertain: uncertainAway,
    confirmedHomeDelta,
    confirmedAwayDelta
  });

  const marg = marginalizeScenarios(scenarios);
  const expectedMargin = Number(
    scenarios.reduce((acc, s) => acc + s.probability * s.conditionalMargin, 0).toFixed(2)
  );

  if (Math.abs(confirmedHomeDelta - confirmedAwayDelta) > 0.1 || uncertainHome.length + uncertainAway.length > 0) {
    const netInj = confirmedHomeDelta - confirmedAwayDelta;
    drivers.push({
      factorId: "NBA01/NBA03/U03/U04",
      name: "Rotations, Shot Creation & Replacement",
      impactOnHomeWinProb: Number((netInj * 0.035).toFixed(3)),
      impactOnMargin: Number(netInj.toFixed(2)),
      direction: netInj >= 0 ? "home" : "away",
      evidenceSource: "ESPN NBA Injury Report + 240-min Rotation Redistribution",
      status: "confirmed",
      explanation: `Feasible 240-min rotation shift accounts for creator loss & bench minutes once (Net incremental impact: ${netInj >= 0 ? "+" : ""}${netInj.toFixed(2)} pts).`
    });
  }

  return {
    homeWinProb: marg.homeWinProb,
    awayWinProb: marg.awayWinProb,
    tieProb: 0,
    projectedMargin: expectedMargin,
    projectedTotal: baseTotal,
    marginStdDev,
    scenarios,
    homeRotation: homeRot.rotation,
    awayRotation: awayRot.rotation,
    homeMinutesTotal: homeRot.totalMinutes,
    awayMinutesTotal: awayRot.totalMinutes,
    rotationsFeasible: homeRot.feasible && awayRot.feasible,
    topDrivers: drivers.slice(0, 5),
    notes
  };
}
