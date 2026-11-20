import {
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
  TravelRestMetrics,
  VenueMetadata,
  WeatherForecastVintage
} from "../core/types";
import { NflTeamRollingMetrics } from "../providers/nflverseAdapter";
import { EspnTeamStandingStats } from "../providers/espnAdapter";
import { clampProb, LogisticParameters, predictWithLogisticModel, sigmoid } from "./calibration";

export const NFL_MODEL_VERSION = "nfl_epa_matchup_v2.1.0";

export const NFL_EPA_DEFINITION =
  "EPA (Expected Points Added) = Change in Expected Points (EP_after - EP_before) per play using the nflverse/nflfastR down-distance-yardline-clock EP model.";
export const NFL_SUCCESS_RATE_DEFINITION =
  "Play-level success rate in nflfastR is EPA > 0; at team-week aggregate granularity without full PBP streaming, measured via First-Down Conversion Efficiency = (passing_first_downs + rushing_first_downs) / (attempts + sacks_suffered + carries).";

export const NFL_FEATURE_NAMES = [
  "net_epa_diff", // (homeOffEpa - awayDefEpa) - (awayOffEpa - homeDefEpa)
  "pass_matchup_diff", // (homePassEpa - awayPassDefEpa) - (awayPassEpa - homePassDefEpa)
  "rush_matchup_diff", // (homeRushEpa - awayRushDefEpa) - (awayRushEpa - homeRushDefEpa)
  "ol_vs_pass_rush_interaction", // (awayPressureRate * homeSackAllowed) - (homePressureRate * awaySackAllowed)
  "turnover_skill_diff", // interception rate diff (excluding high-variance fumble recovery luck)
  "special_teams_penalties_diff", // FG% & penalty yardage diff
  "rest_advantage", // homeRestDays - awayRestDays (capped)
  "is_non_neutral_home" // 1 if true home venue, 0 if neutral site
];

export interface NflModelInputs {
  game: CanonicalGame;
  venue: VenueMetadata | null;
  weather: WeatherForecastVintage | null;
  travelRest: TravelRestMetrics;
  homeRolling: NflTeamRollingMetrics | null;
  awayRolling: NflTeamRollingMetrics | null;
  homeStanding: EspnTeamStandingStats | null;
  awayStanding: EspnTeamStandingStats | null;
  injuries: PlayerAvailabilityRecord[];
  learnedParams?: LogisticParameters | null;
  customOverrides?: {
    homeDVOA?: number;
    awayDVOA?: number;
    isBackupQBHome?: boolean;
    isBackupQBAway?: boolean;
    isOffByeHome?: boolean;
    isOffByeAway?: boolean;
    isShortWeekHome?: boolean;
    isShortWeekAway?: boolean;
    windMph?: number;
  };
}

export interface NflModelOutput {
  homeWinProb: number;
  awayWinProb: number;
  tieProb: number;
  projectedMargin: number;
  projectedTotal: number | null;
  marginStdDev: number;
  scenarios: AvailabilityScenario[];
  topDrivers: ModelDriver[];
  olVsPassRushInteractionHome: number | null;
  olVsPassRushInteractionAway: number | null;
  homeOffEpaPerPlay: number | null;
  awayOffEpaPerPlay: number | null;
  homeDefEpaPerPlay: number | null;
  awayDefEpaPerPlay: number | null;
  notes: string[];
}

export function extractNflFeatureVector(params: {
  homeRolling: NflTeamRollingMetrics | null;
  awayRolling: NflTeamRollingMetrics | null;
  homeRestDays: number | null;
  awayRestDays: number | null;
  neutralSite: boolean;
}): Array<number | null> {
  const hr = params.homeRolling;
  const ar = params.awayRolling;
  if (!hr || !ar) {
    return [
      null,
      null,
      null,
      null,
      null,
      null,
      params.homeRestDays !== null && params.awayRestDays !== null
        ? Math.max(-7, Math.min(7, params.homeRestDays - params.awayRestDays))
        : 0,
      params.neutralSite ? 0 : 1
    ];
  }

  const homeOffTotal = hr.offPassEpaPerPlay * 0.68 + hr.offRushEpaPerPlay * 0.32;
  const awayOffTotal = ar.offPassEpaPerPlay * 0.68 + ar.offRushEpaPerPlay * 0.32;
  const homeDefTotal = hr.defPassEpaAllowedPerPlay * 0.68 + hr.defRushEpaAllowedPerPlay * 0.32;
  const awayDefTotal = ar.defPassEpaAllowedPerPlay * 0.68 + ar.defRushEpaAllowedPerPlay * 0.32;

  const netEpaDiff = (homeOffTotal - awayDefTotal) - (awayOffTotal - homeDefTotal);
  const passMatchupDiff = (hr.offPassEpaPerPlay - ar.defPassEpaAllowedPerPlay) - (ar.offPassEpaPerPlay - hr.defPassEpaAllowedPerPlay);
  const rushMatchupDiff = (hr.offRushEpaPerPlay - ar.defRushEpaAllowedPerPlay) - (ar.offRushEpaPerPlay - hr.defRushEpaAllowedPerPlay);

  // Explicit interaction term: opponent pass-rush pressure rate * own OL sack allowed rate
  const olInteraction = (ar.defPressureProxyRate * hr.sackAllowedRate) - (hr.defPressureProxyRate * ar.sackAllowedRate);

  // Separate persistent INT rate from volatile fumble recovery luck
  const turnoverDiff = -(hr.interceptionRate - ar.interceptionRate);
  const stPenDiff = (hr.fgPct - ar.fgPct) * 10 - (hr.penaltyYardsPerGame - ar.penaltyYardsPerGame) / 50;
  const restAdv =
    params.homeRestDays !== null && params.awayRestDays !== null
      ? Math.max(-7, Math.min(7, params.homeRestDays - params.awayRestDays))
      : 0;

  return [
    Number(netEpaDiff.toFixed(5)),
    Number(passMatchupDiff.toFixed(5)),
    Number(rushMatchupDiff.toFixed(5)),
    Number(olInteraction.toFixed(5)),
    Number(turnoverDiff.toFixed(5)),
    Number(stPenDiff.toFixed(5)),
    restAdv,
    params.neutralSite ? 0 : 1
  ];
}

/**
 * Converts expected margin to exhaustive (homeWin, awayWin, tie) probabilities for NFL.
 * Regular season NFL ties occur in ~0.55%-0.8% of close games (zero regulation tie rate ~6% * ~10% OT tie rate).
 * Postseason NFL games have 0 tie probability.
 */
export function nflMarginToExhaustiveProbs(
  margin: number,
  marginStdDev: number,
  isPostseason: boolean
): { home: number; away: number; tie: number } {
  // Logistic conversion calibrated to NFL score dispersion (~13.45 pts SD)
  const scale = 13.45 / Math.max(8, marginStdDev);
  const rawHomeConditional = sigmoid(0.148 * scale * margin);

  let tieProb = 0;
  if (!isPostseason) {
    // Regulation ends tied roughly proportional to density at 0, and ~7.5% of OT games end tied
    const regTieDensity = Math.exp(-0.5 * (margin / marginStdDev) ** 2) / (marginStdDev * Math.sqrt(2 * Math.PI));
    tieProb = Number(Math.min(0.025, Math.max(0.0005, regTieDensity * 2.2 * 0.085)).toFixed(4));
  }

  const remaining = 1 - tieProb;
  const home = Number((rawHomeConditional * remaining).toFixed(4));
  const away = Number((1 - home - tieProb).toFixed(4));
  return { home, away, tie: tieProb };
}

export function runNflModel(inputs: NflModelInputs): NflModelOutput {
  const notes: string[] = [];
  const drivers: ModelDriver[] = [];
  const isPostseason = inputs.game.competitionPhase === "postseason";
  const hr = inputs.homeRolling;
  const ar = inputs.awayRolling;
  const marginStdDev = 13.45;

  let baseMargin = inputs.game.neutralSite ? 0.0 : 1.85; // Empirical post-2020 NFL HFA ~1.8-2.0 pts
  let baseTotal: number | null = 44.5;

  // 1. Primary efficiency signal: nflverse EPA/play (or fallback to ESPN point differential)
  let olInteractionHome: number | null = null;
  let olInteractionAway: number | null = null;

  if (hr && ar) {
    const featVec = extractNflFeatureVector({
      homeRolling: hr,
      awayRolling: ar,
      homeRestDays: inputs.travelRest.homeRestDays,
      awayRestDays: inputs.travelRest.awayRestDays,
      neutralSite: inputs.game.neutralSite
    });

    const netEpaDiff = featVec[0] ?? 0;
    const passDiff = featVec[1] ?? 0;
    const rushDiff = featVec[2] ?? 0;
    const olInt = featVec[3] ?? 0;
    const toDiff = featVec[4] ?? 0;
    const stDiff = featVec[5] ?? 0;

    // 1 EPA/play differential ~ 24-28 expected game points
    const epaMarginDelta = netEpaDiff * 24.5;
    baseMargin += epaMarginDelta;
    // Penalize OL vulnerability interacting with opponent pressure
    const homeTackleOut = inputs.injuries.some(
      i => i.teamAbbr === inputs.game.homeTeamAbbr && /^(OT|LT|RT|T)$/i.test(i.position) && (i.gameDesignation === "Out" || i.gameDesignation === "IR")
    );
    const awayTackleOut = inputs.injuries.some(
      i => i.teamAbbr === inputs.game.awayTeamAbbr && /^(OT|LT|RT|T)$/i.test(i.position) && (i.gameDesignation === "Out" || i.gameDesignation === "IR")
    );
    olInteractionHome = Number((ar.defPressureProxyRate * hr.sackAllowedRate * (homeTackleOut ? 1.45 : 1.0)).toFixed(4));
    olInteractionAway = Number((hr.defPressureProxyRate * ar.sackAllowedRate * (awayTackleOut ? 1.45 : 1.0)).toFixed(4));
    const protectionMargin = (olInteractionAway - olInteractionHome) * 42.0;
    baseMargin += protectionMargin;

    // Turnover regression: regress net fumble recovery luck back toward 0, retain persistent INT skill
    const intMargin = toDiff * 14.0;
    const fumbleRegressionAdj = -(hr.fumbleLuckNet - ar.fumbleLuckNet) * 0.12;
    baseMargin += intMargin + fumbleRegressionAdj;
    baseMargin += stDiff * 0.45;

    // Expected total from combined offensive/defensive EPA
    const expHomePts = 22.3 + (hr.offPassEpaPerPlay * 0.65 + hr.offRushEpaPerPlay * 0.35 - (ar.defPassEpaAllowedPerPlay * 0.65 + ar.defRushEpaAllowedPerPlay * 0.35)) * 12.5;
    const expAwayPts = 22.3 + (ar.offPassEpaPerPlay * 0.65 + ar.offRushEpaPerPlay * 0.35 - (hr.defPassEpaAllowedPerPlay * 0.65 + hr.defRushEpaAllowedPerPlay * 0.35)) * 12.5;
    baseTotal = Number(Math.max(30, Math.min(62, expHomePts + expAwayPts)).toFixed(1));

    drivers.push({
      factorId: "NFL05/NFL06",
      name: "Opponent-Context EPA/Play Matchup",
      impactOnHomeWinProb: Number((epaMarginDelta * 0.032).toFixed(3)),
      impactOnMargin: Number(epaMarginDelta.toFixed(2)),
      direction: epaMarginDelta >= 0 ? "home" : "away",
      evidenceSource: `nflverse team-week EPA (${hr.gamesPlayed}g / ${ar.gamesPlayed}g)`,
      status: "confirmed",
      explanation: `${inputs.game.homeTeamAbbr} Off EPA ${(hr.offPassEpaPerPlay * 0.68 + hr.offRushEpaPerPlay * 0.32).toFixed(3)} vs ${inputs.game.awayTeamAbbr} Off EPA ${(ar.offPassEpaPerPlay * 0.68 + ar.offRushEpaPerPlay * 0.32).toFixed(3)} (pass diff ${passDiff >= 0 ? "+" : ""}${passDiff.toFixed(3)}, rush diff ${rushDiff >= 0 ? "+" : ""}${rushDiff.toFixed(3)}).`
    });

    drivers.push({
      factorId: "NFL02",
      name: "Offensive Line vs Pass Rush Interaction",
      impactOnHomeWinProb: Number((protectionMargin * 0.032).toFixed(3)),
      impactOnMargin: Number(protectionMargin.toFixed(2)),
      direction: protectionMargin >= 0 ? "home" : "away",
      evidenceSource: "nflverse pressure/sack rates + OL injury interaction",
      status: "confirmed",
      explanation: `Protection interaction index Home ${(olInteractionHome * 100).toFixed(2)}% vs Away ${(olInteractionAway * 100).toFixed(2)}%${homeTackleOut || awayTackleOut ? " (amplified by confirmed tackle absence)" : ""}.`
    });

    if (Math.abs(hr.fumbleLuckNet - ar.fumbleLuckNet) >= 3) {
      drivers.push({
        factorId: "NFL09",
        name: "Turnover Skill vs Fumble-Luck Regression",
        impactOnHomeWinProb: Number((fumbleRegressionAdj * 0.032).toFixed(3)),
        impactOnMargin: Number((intMargin + fumbleRegressionAdj).toFixed(2)),
        direction: intMargin + fumbleRegressionAdj >= 0 ? "home" : "away",
        evidenceSource: "nflverse INT & fumble recovery splits",
        status: "confirmed",
        explanation: `Separates persistent INT rate from volatile fumble recoveries (Net Fumble Luck: ${inputs.game.homeTeamAbbr} ${hr.fumbleLuckNet >= 0 ? "+" : ""}${hr.fumbleLuckNet}, ${inputs.game.awayTeamAbbr} ${ar.fumbleLuckNet >= 0 ? "+" : ""}${ar.fumbleLuckNet}).`
      });
    }
  } else if (inputs.homeStanding?.pointDiffPerGame !== null && inputs.homeStanding?.pointDiffPerGame !== undefined &&
             inputs.awayStanding?.pointDiffPerGame !== null && inputs.awayStanding?.pointDiffPerGame !== undefined) {
    const diffMargin = (inputs.homeStanding.pointDiffPerGame - inputs.awayStanding.pointDiffPerGame) * 0.45;
    baseMargin += diffMargin;
    notes.push("nflverse weekly EPA unavailable for current week cutoff; using ESPN standings point-differential baseline.");
    drivers.push({
      factorId: "U01",
      name: "Scoring Differential Baseline",
      impactOnHomeWinProb: Number((diffMargin * 0.032).toFixed(3)),
      impactOnMargin: Number(diffMargin.toFixed(2)),
      direction: diffMargin >= 0 ? "home" : "away",
      evidenceSource: "ESPN Standings",
      status: "projected",
      explanation: `Scoring diff ${inputs.homeStanding.pointDiffPerGame} vs ${inputs.awayStanding.pointDiffPerGame} PPG.`
    });
  } else if (inputs.customOverrides?.homeDVOA !== undefined && inputs.customOverrides?.awayDVOA !== undefined) {
    const dvoaMargin = (inputs.customOverrides.homeDVOA - inputs.customOverrides.awayDVOA) * 0.15;
    baseMargin += dvoaMargin;
    notes.push("Using user-supplied DVOA parameters as fallback baseline.");
  } else {
    notes.push("Team EPA and standings missing; reverting to venue home-field prior.");
  }

  // 2. Rest, Bye, Short Week & Travel
  let restTravelDelta = 0;
  if (inputs.travelRest.homeOffBye || inputs.customOverrides?.isOffByeHome) restTravelDelta += 1.4;
  if (inputs.travelRest.awayOffBye || inputs.customOverrides?.isOffByeAway) restTravelDelta -= 1.4;
  if (inputs.travelRest.homeShortWeek || inputs.customOverrides?.isShortWeekHome) restTravelDelta -= 0.9;
  if (inputs.travelRest.awayShortWeek || inputs.customOverrides?.isShortWeekAway) restTravelDelta += 0.9;
  if ((inputs.travelRest.awayTimezonesCrossed ?? 0) >= 2) {
    restTravelDelta += inputs.travelRest.awayTravelDirection === "eastbound" ? 0.7 : 0.35;
  }
  baseMargin += restTravelDelta;
  if (Math.abs(restTravelDelta) >= 0.3) {
    drivers.push({
      factorId: "U08/U09/NFL13",
      name: "Rest, Bye & Travel Impact",
      impactOnHomeWinProb: Number((restTravelDelta * 0.032).toFixed(3)),
      impactOnMargin: Number(restTravelDelta.toFixed(2)),
      direction: restTravelDelta >= 0 ? "home" : "away",
      evidenceSource: "Canonical schedule & venue coordinates",
      status: inputs.travelRest.status,
      explanation: `Rest/travel differential yields ${restTravelDelta >= 0 ? "+" : ""}${restTravelDelta.toFixed(2)} pts toward home.`
    });
  }

  // 3. Stadium Weather (outdoor only)
  const wx = inputs.weather;
  if (wx && wx.status !== "not_applicable" && wx.status !== "missing" && wx.roofStatus === "open") {
    const wind = inputs.customOverrides?.windMph ?? wx.windMph ?? 0;
    if (wind >= 15 && baseTotal !== null) {
      const windTotalCut = Math.min(5.5, (wind - 12) * 0.32);
      baseTotal = Number((baseTotal - windTotalCut).toFixed(1));
      // Strong wind dampens passing EPA advantage slightly toward balanced/run teams
      if (hr && ar) {
        const passHeavyEdge = (hr.offPassEpaPerPlay - ar.offPassEpaPerPlay) * 4.5;
        baseMargin -= passHeavyEdge * Math.min(0.4, (wind - 14) / 25);
      }
      drivers.push({
        factorId: "NFL12/U10",
        name: "Outdoor Wind & Conditions",
        impactOnHomeWinProb: 0,
        impactOnMargin: 0,
        direction: "neutral",
        evidenceSource: `NWS Forecast (issued ${wx.issuedUtc.slice(0, 16)})`,
        status: wx.status,
        explanation: `${wind} mph wind at ${inputs.venue?.name || "stadium"} reduces projected scoring total by ${windTotalCut.toFixed(1)} pts.`
      });
    }
  } else if (wx?.roofStatus === "dome") {
    notes.push("Indoor dome stadium: outdoor wind/precipitation adjustments set to N/A.");
  }

  // 4. Personnel Availability Scenarios (Confirmed vs Uncertain QBs & Key Starters)
  const homeInj = inputs.injuries.filter(i => i.teamAbbr === inputs.game.homeTeamAbbr);
  const awayInj = inputs.injuries.filter(i => i.teamAbbr === inputs.game.awayTeamAbbr);

  if (inputs.customOverrides?.isBackupQBHome) {
    homeInj.push({
      playerId: "override_qb_home",
      playerName: "Starting QB (Home)",
      teamAbbr: inputs.game.homeTeamAbbr,
      position: "QB",
      role: "qb1",
      practiceStatus: "DNP",
      gameDesignation: "Out",
      injuryOrReason: "Backup QB toggle enabled",
      confirmedParticipationProb: 0,
      expectedWorkloadPct: 0,
      replacementName: "Backup QB",
      replacementDropoffPoints: 5.8,
      alreadyReflectedInBaselinePct: 0,
      source: "user_override",
      sourcePublishedUtc: null,
      ingestedUtc: new Date().toISOString(),
      status: "confirmed"
    });
  }
  if (inputs.customOverrides?.isBackupQBAway) {
    awayInj.push({
      playerId: "override_qb_away",
      playerName: "Starting QB (Away)",
      teamAbbr: inputs.game.awayTeamAbbr,
      position: "QB",
      role: "qb1",
      practiceStatus: "DNP",
      gameDesignation: "Out",
      injuryOrReason: "Backup QB toggle enabled",
      confirmedParticipationProb: 0,
      expectedWorkloadPct: 0,
      replacementName: "Backup QB",
      replacementDropoffPoints: 5.8,
      alreadyReflectedInBaselinePct: 0,
      source: "user_override",
      sourcePublishedUtc: null,
      ingestedUtc: new Date().toISOString(),
      status: "confirmed"
    });
  }

  let confirmedHomeDelta = 0;
  let confirmedAwayDelta = 0;
  const uncertainHome: PlayerAvailabilityRecord[] = [];
  const uncertainAway: PlayerAvailabilityRecord[] = [];

  for (const r of homeInj) {
    const est = estimateParticipationFromEvidence(r, "NFL");
    if (est.absentProb >= 0.99) {
      confirmedHomeDelta -= incrementalImpactBeyondBaseline(r.replacementDropoffPoints, r.alreadyReflectedInBaselinePct);
    } else if (est.absentProb > 0.01) {
      uncertainHome.push(r);
    }
  }
  for (const r of awayInj) {
    const est = estimateParticipationFromEvidence(r, "NFL");
    if (est.absentProb >= 0.99) {
      confirmedAwayDelta -= incrementalImpactBeyondBaseline(r.replacementDropoffPoints, r.alreadyReflectedInBaselinePct);
    } else if (est.absentProb > 0.01) {
      uncertainAway.push(r);
    }
  }

  // Blend learned logistic probabilities if provided and valid
  let modelShift = 0;
  if (inputs.learnedParams && hr && ar) {
    const feat = extractNflFeatureVector({
      homeRolling: hr,
      awayRolling: ar,
      homeRestDays: inputs.travelRest.homeRestDays,
      awayRestDays: inputs.travelRest.awayRestDays,
      neutralSite: inputs.game.neutralSite
    });
    const learnedHomeProb = predictWithLogisticModel(inputs.learnedParams, feat);
    // Convert learned prob back into equivalent margin logit for coherent scenario marginalization
    const learnedMargin = Math.log(clampProb(learnedHomeProb) / (1 - clampProb(learnedHomeProb))) / 0.148;
    modelShift = (learnedMargin - baseMargin) * 0.55;
  }

  const scenarios = synthesizeJointScenarios({
    league: "NFL",
    baseMargin: baseMargin + modelShift,
    baseTotal,
    marginStdDev,
    marginToHomeWinProb: m => nflMarginToExhaustiveProbs(m, marginStdDev, isPostseason),
    homeUncertain: uncertainHome,
    awayUncertain: uncertainAway,
    confirmedHomeDelta,
    confirmedAwayDelta
  });

  const marg = marginalizeScenarios(scenarios);
  const expectedMargin = Number(
    scenarios.reduce((acc, s) => acc + s.probability * s.conditionalMargin, 0).toFixed(2)
  );

  if (Math.abs(confirmedHomeDelta) > 0.1 || Math.abs(confirmedAwayDelta) > 0.1 || uncertainHome.length > 0 || uncertainAway.length > 0) {
    const netInjDelta = confirmedHomeDelta - confirmedAwayDelta;
    drivers.push({
      factorId: "NFL01/U03/U04",
      name: "Personnel Availability & Replacement",
      impactOnHomeWinProb: Number((netInjDelta * 0.032).toFixed(3)),
      impactOnMargin: Number(netInjDelta.toFixed(2)),
      direction: netInjDelta >= 0 ? "home" : "away",
      evidenceSource: "ESPN NFL Injury Feed (practice vs game status)",
      status: "confirmed",
      explanation: `Confirmed incremental absence impact: ${netInjDelta >= 0 ? "+" : ""}${netInjDelta.toFixed(2)} pts after avoiding baseline double-count; ${uncertainHome.length + uncertainAway.length} uncertain scenario(s) marginalized.`
    });
  }

  return {
    homeWinProb: marg.homeWinProb,
    awayWinProb: marg.awayWinProb,
    tieProb: marg.tieProb,
    projectedMargin: expectedMargin,
    projectedTotal: baseTotal,
    marginStdDev,
    scenarios,
    topDrivers: drivers.slice(0, 5),
    olVsPassRushInteractionHome: olInteractionHome,
    olVsPassRushInteractionAway: olInteractionAway,
    homeOffEpaPerPlay: hr ? Number((hr.offPassEpaPerPlay * 0.68 + hr.offRushEpaPerPlay * 0.32).toFixed(4)) : null,
    awayOffEpaPerPlay: ar ? Number((ar.offPassEpaPerPlay * 0.68 + ar.offRushEpaPerPlay * 0.32).toFixed(4)) : null,
    homeDefEpaPerPlay: hr ? Number((hr.defPassEpaAllowedPerPlay * 0.68 + hr.defRushEpaAllowedPerPlay * 0.32).toFixed(4)) : null,
    awayDefEpaPerPlay: ar ? Number((ar.defPassEpaAllowedPerPlay * 0.68 + ar.defRushEpaAllowedPerPlay * 0.32).toFixed(4)) : null,
    notes
  };
}
