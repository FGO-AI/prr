import {
  buildCoherentMlbPitchingPlan,
  marginalizeScenarios,
  synthesizeJointScenarios
} from "../core/availabilityScenarios";
import {
  AvailabilityScenario,
  CanonicalGame,
  ModelDriver,
  PitchingPlanEntry,
  PlayerAvailabilityRecord,
  TravelRestMetrics,
  VenueMetadata,
  WeatherForecastVintage
} from "../core/types";
import { EspnTeamStandingStats } from "../providers/espnAdapter";
import { MlbPitcherProfile } from "../providers/mlbStatsAdapter";
import { clampProb, LogisticParameters, predictWithLogisticModel, sigmoid } from "./calibration";

export const MLB_MODEL_VERSION = "mlb_fip_workload_park_v2.1.0";

export const MLB_FEATURE_NAMES = [
  "sp_fip_diff", // awaySpFip - homeSpFip (positive favors home)
  "team_run_diff_pg", // homeRunDiffPG - awayRunDiffPG
  "park_air_adj", // relative park & air density factor
  "home_field_flag"
];

export interface MlbModelInputs {
  game: CanonicalGame;
  venue: VenueMetadata | null;
  weather: WeatherForecastVintage | null;
  travelRest: TravelRestMetrics;
  homePitcher: MlbPitcherProfile | null;
  awayPitcher: MlbPitcherProfile | null;
  homeLineupConfirmed: boolean;
  awayLineupConfirmed: boolean;
  homeStanding: EspnTeamStandingStats | null;
  awayStanding: EspnTeamStandingStats | null;
  injuries: PlayerAvailabilityRecord[];
  learnedParams?: LogisticParameters | null;
  customOverrides?: {
    homeWrc?: number;
    awayWrc?: number;
    homeSpxFip?: number;
    awaySpxFip?: number;
    ballparkRunFactor?: number;
    bullpenEraContrib?: number;
    windSpeed?: number;
  };
}

export interface MlbModelOutput {
  homeWinProb: number;
  awayWinProb: number;
  tieProb: number; // Always 0 for MLB (extra innings resolve ties)
  projectedMargin: number;
  projectedTotal: number | null;
  marginStdDev: number;
  scenarios: AvailabilityScenario[];
  homeStaff: PitchingPlanEntry[];
  awayStaff: PitchingPlanEntry[];
  homeInningsTotal: number;
  awayInningsTotal: number;
  topDrivers: ModelDriver[];
  notes: string[];
}

export function mlbMarginToWinProbs(runMargin: number, runStdDev: number = 3.15): {
  home: number;
  away: number;
  tie: number;
} {
  // MLB average run differential dispersion ~3.1-3.2 runs; extra innings ghost-runner resolves ties to 50/50
  const scale = 3.15 / Math.max(2.0, runStdDev);
  const home = Number(clampProb(sigmoid(0.56 * scale * runMargin), 0.05).toFixed(4));
  const away = Number((1 - home).toFixed(4));
  return { home, away, tie: 0 };
}

/**
 * Computes relative wind-out vs wind-in multiplier for MLB home runs/runs
 * using stadium home-plate-to-CF azimuth and meteorological wind direction ("blowing from").
 */
function computeWindOutComponent(windDirFromDeg: number | null, windMph: number | null, cfAzimuthDeg: number | undefined): number {
  if (windDirFromDeg === null || windMph === null || cfAzimuthDeg === undefined) return 0;
  // Wind blowing TOWARD direction = (windDirFromDeg + 180) % 360
  const blowingToward = (windDirFromDeg + 180) % 360;
  const angleRad = ((blowingToward - cfAzimuthDeg) * Math.PI) / 180;
  // cos(angleRad) = +1 blowing straight out to CF, -1 blowing straight in from CF
  return Number((Math.cos(angleRad) * windMph).toFixed(2));
}

export function runMlbModel(inputs: MlbModelInputs): MlbModelOutput {
  const notes: string[] = [
    "Park factors defined on 100-neutral index as relative scoring multipliers (index / 100)."
  ];
  const drivers: ModelDriver[] = [];
  const runStdDev = 3.15;

  const delayRisk = inputs.weather?.delayRiskScore ?? 0;
  const homeSpFip = inputs.homePitcher?.fip ?? inputs.customOverrides?.homeSpxFip ?? 4.10;
  const awaySpFip = inputs.awayPitcher?.fip ?? inputs.customOverrides?.awaySpxFip ?? 4.10;
  const homeSpIp = inputs.homePitcher?.avgIpPerStart ?? 5.4;
  const awaySpIp = inputs.awayPitcher?.avgIpPerStart ?? 5.4;

  const homeBullpenFip = 3.95;
  const awayBullpenFip = 3.95;

  const homePlan = buildCoherentMlbPitchingPlan({
    starterName: inputs.homePitcher?.fullName || "Projected Home SP",
    starterFip: inputs.homePitcher?.fip ?? inputs.customOverrides?.homeSpxFip ?? null,
    starterK9: inputs.homePitcher?.k9 ?? null,
    starterBb9: inputs.homePitcher?.bb9 ?? null,
    expectedStarterInnings: homeSpIp,
    isPitchLimited: false,
    delayRiskScore: delayRisk,
    bullpenFip: homeBullpenFip,
    tiredRelieversCount: inputs.game.doubleheaderGameNum === 2 ? 2 : 0,
    starterStatus: inputs.homePitcher?.status || "projected"
  });

  const awayPlan = buildCoherentMlbPitchingPlan({
    starterName: inputs.awayPitcher?.fullName || "Projected Away SP",
    starterFip: inputs.awayPitcher?.fip ?? inputs.customOverrides?.awaySpxFip ?? null,
    starterK9: inputs.awayPitcher?.k9 ?? null,
    starterBb9: inputs.awayPitcher?.bb9 ?? null,
    expectedStarterInnings: awaySpIp,
    isPitchLimited: false,
    delayRiskScore: delayRisk,
    bullpenFip: awayBullpenFip,
    tiredRelieversCount: inputs.game.doubleheaderGameNum === 2 ? 2 : 0,
    starterStatus: inputs.awayPitcher?.status || "projected"
  });

  // Blended 9-inning team ERA/FIP expectation = sum(innings_i * fip_i) / 9
  const homeStaffFip =
    homePlan.staff.reduce((acc, s) => acc + s.projectedInnings * (s.fip ?? 4.10), 0) / Math.max(1, homePlan.totalInnings);
  const awayStaffFip =
    awayPlan.staff.reduce((acc, s) => acc + s.projectedInnings * (s.fip ?? 4.10), 0) / Math.max(1, awayPlan.totalInnings);

  const pitchingMargin = (awayStaffFip - homeStaffFip) * 0.85; // 1.0 FIP over 9 inn ~ 0.85 runs after regression

  drivers.push({
    factorId: "MLB01/MLB02/MLB08",
    name: "9-Inning Starting Pitcher + Bullpen FIP Plan",
    impactOnHomeWinProb: Number((pitchingMargin * 0.14).toFixed(3)),
    impactOnMargin: Number(pitchingMargin.toFixed(2)),
    direction: pitchingMargin >= 0 ? "home" : "away",
    evidenceSource: inputs.homePitcher?.fip !== null ? "MLB Stats API FIP + Workload Plan" : "League Baseline FIP",
    status: inputs.homePitcher?.status || "projected",
    explanation: `${inputs.game.homeTeamAbbr} staff FIP ${homeStaffFip.toFixed(2)} (${homePlan.staff[0].projectedInnings} SP inn.) vs ${inputs.game.awayTeamAbbr} staff FIP ${awayStaffFip.toFixed(2)} (${awayPlan.staff[0].projectedInnings} SP inn.).`
  });

  // Team offensive baseline from standings runs scored/allowed or wRC+ override
  let offenseMargin = 0;
  let offBaselineRuns = 8.6;
  if (inputs.homeStanding?.pointsForPerGame && inputs.awayStanding?.pointsForPerGame) {
    const homeOffDelta = inputs.homeStanding.pointsForPerGame - 4.45;
    const awayOffDelta = inputs.awayStanding.pointsForPerGame - 4.45;
    offenseMargin = (homeOffDelta - awayOffDelta) * 0.65;
    offBaselineRuns = (inputs.homeStanding.pointsForPerGame + inputs.awayStanding.pointsForPerGame + homeStaffFip + awayStaffFip) / 2;
    drivers.push({
      factorId: "MLB07/U01",
      name: "Team Offensive Quality",
      impactOnHomeWinProb: Number((offenseMargin * 0.14).toFixed(3)),
      impactOnMargin: Number(offenseMargin.toFixed(2)),
      direction: offenseMargin >= 0 ? "home" : "away",
      evidenceSource: "ESPN MLB Standings Runs/Game",
      status: "confirmed",
      explanation: `${inputs.game.homeTeamAbbr} ${inputs.homeStanding.pointsForPerGame} R/G vs ${inputs.game.awayTeamAbbr} ${inputs.awayStanding.pointsForPerGame} R/G.`
    });
  } else if (inputs.customOverrides?.homeWrc && inputs.customOverrides?.awayWrc) {
    offenseMargin = ((inputs.customOverrides.homeWrc - inputs.customOverrides.awayWrc) / 100) * 2.2;
  }

  // Park factor & weather (outdoor/open roof only)
  const parkMult = inputs.venue?.parkRunIndex100 ? inputs.venue.parkRunIndex100 / 100 : (inputs.customOverrides?.ballparkRunFactor ?? 1.0);
  let weatherTotalMult = 1.0;
  if (inputs.weather && inputs.weather.status !== "not_applicable" && inputs.weather.status !== "missing" && inputs.weather.roofStatus === "open") {
    const windOut = computeWindOutComponent(inputs.weather.windDirDeg, inputs.weather.windMph, inputs.venue?.cfAzimuthDeg);
    const tempAdj = inputs.weather.tempF !== null ? (inputs.weather.tempF - 70) * 0.0025 : 0;
    const windAdj = windOut * 0.0075;
    weatherTotalMult = Math.max(0.82, Math.min(1.22, 1.0 + tempAdj + windAdj));
    if (Math.abs(weatherTotalMult - 1.0) >= 0.03) {
      drivers.push({
        factorId: "MLB13/MLB14",
        name: "Ballpark Factor & Wind Vector",
        impactOnHomeWinProb: 0,
        impactOnMargin: 0,
        direction: "neutral",
        evidenceSource: `NWS Forecast + ${inputs.venue?.name || "Ballpark"} Azimuth`,
        status: inputs.weather.status,
        explanation: `Park index ${inputs.venue?.parkRunIndex100 ?? 100} and ${inputs.weather.windMph ?? 0} mph wind (${windOut >= 0 ? "out" : "in"} ${Math.abs(windOut).toFixed(1)} mph) scale expected runs by ${(parkMult * weatherTotalMult).toFixed(3)}x.`
      });
    }
  }

  const hfa = inputs.game.neutralSite ? 0 : 0.24; // Empirical MLB home field ~53.5-54% (~0.24 runs)
  const baseMargin = Number((pitchingMargin + offenseMargin + hfa).toFixed(3));
  const projectedTotal = Number((offBaselineRuns * parkMult * weatherTotalMult).toFixed(2));

  if (!inputs.homeLineupConfirmed || !inputs.awayLineupConfirmed) {
    notes.push("Confirmed 9-man MLB batting order pending; forecast marked provisional until official lineup posting.");
  }
  if (inputs.game.doubleheaderGameNum) {
    notes.push(`Doubleheader Game ${inputs.game.doubleheaderGameNum}: bullpen fatigue & short-rest context reflected.`);
  }

  let modelShift = 0;
  if (inputs.learnedParams) {
    const feat: Array<number | null> = [
      awaySpFip - homeSpFip,
      inputs.homeStanding?.pointDiffPerGame !== null && inputs.awayStanding?.pointDiffPerGame !== null
        ? (inputs.homeStanding?.pointDiffPerGame ?? 0) - (inputs.awayStanding?.pointDiffPerGame ?? 0)
        : 0,
      parkMult * weatherTotalMult - 1.0,
      inputs.game.neutralSite ? 0 : 1
    ];
    const lp = predictWithLogisticModel(inputs.learnedParams, feat);
    const lm = Math.log(clampProb(lp) / (1 - clampProb(lp))) / 0.56;
    modelShift = (lm - baseMargin) * 0.45;
  }

  const scenarios = synthesizeJointScenarios({
    league: "MLB",
    baseMargin: baseMargin + modelShift,
    baseTotal: projectedTotal,
    marginStdDev: runStdDev,
    marginToHomeWinProb: m => mlbMarginToWinProbs(m, runStdDev),
    homeUncertain: [],
    awayUncertain: [],
    confirmedHomeDelta: 0,
    confirmedAwayDelta: 0
  });

  const marg = marginalizeScenarios(scenarios);
  return {
    homeWinProb: marg.homeWinProb,
    awayWinProb: marg.awayWinProb,
    tieProb: 0,
    projectedMargin: Number((baseMargin + modelShift).toFixed(2)),
    projectedTotal,
    marginStdDev: runStdDev,
    scenarios,
    homeStaff: homePlan.staff,
    awayStaff: awayPlan.staff,
    homeInningsTotal: homePlan.totalInnings,
    awayInningsTotal: awayPlan.totalInnings,
    topDrivers: drivers.slice(0, 5),
    notes
  };
}
