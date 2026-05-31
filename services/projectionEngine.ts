
import { BetLeg, League } from '../types';

/**
 * Standard Normal Cumulative Distribution Function (CDF)
 */
export const normalCDF = (z: number): number => {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
};

/**
 * Log-Normal Cumulative Distribution Function
 * Better for modeling sports stats which are positive-only and often right-skewed.
 */
export const logNormalCDF = (x: number, mu: number, sigma: number): number => {
  if (x <= 0) return 0;
  // Convert arithmetic mean and sigma to log-space parameters
  const variance = sigma * sigma;
  const logSigma = Math.sqrt(Math.log(1 + (variance / (mu * mu))));
  const logMu = Math.log(mu) - 0.5 * logSigma * logSigma;
  
  const z = (Math.log(x) - logMu) / logSigma;
  return normalCDF(z);
};

/**
 * Factorial for Poisson calculation
 */
const factorial = (n: number): number => {
  if (n <= 1) return 1;
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
};

/**
 * Poisson PMF (Probability Mass Function)
 */
const poissonPMF = (lambda: number, k: number): number => {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
};

/**
 * Poisson CDF (Cumulative Distribution Function)
 * Used for discrete counting stats (Assists, Rebounds, TD passes)
 */
const poissonCDF = (lambda: number, k: number): number => {
  let sum = 0;
  const floorK = Math.floor(k);
  for (let i = 0; i <= floorK; i++) {
    sum += poissonPMF(lambda, i);
  }
  return sum;
};

export const calcBaselineMean = (x10: number, x20: number, xSeason: number): number => {
  // Advanced weight: x10 (40%), x20 (30%), xSeason (30%)
  return (0.4 * x10 + 0.3 * x20 + 0.3 * xSeason);
};

export const calcMinutesMultiplier = (expected: number, avg: number): number => {
  return avg === 0 ? 1 : Math.min(1.5, Math.max(0.5, expected / avg));
};

export const calcPaceMultiplier = (expected: number, league: number): number => {
  return league === 0 ? 1 : expected / league;
};

export const calcOpponentMultiplier = (allowed: number, league: number): number => {
  return league === 0 ? 1 : allowed / league;
};

export const impliedProbFromAmericanOdds = (odds: number): number => {
  if (odds > 0) {
    return 100 / (odds + 100);
  } else {
    const a = Math.abs(odds);
    return a / (a + 100);
  }
};

/**
 * Calculates a dynamic volatility (Sigma) based on stat type and value
 */
const getDynamicSigma = (statType: string, mean: number): number => {
  const type = statType.toLowerCase();
  let cv = 0.25; // Default 25% coefficient of variation
  
  if (type.includes('points') || type.includes('pts')) cv = 0.21;
  if (type.includes('reb') || type.includes('ast')) cv = 0.32;
  if (type.includes('three') || type.includes('3pm')) cv = 0.42;
  if (type.includes('td') || type.includes('touchdown')) cv = 0.55;
  
  return mean * cv;
};

export const calculateMlbEngineMetrics = (leg: BetLeg) => {
  const {
    line = 0, bookOdds = -110, statType = 'Prop', prediction = 'Over',
    pitcherK9, oppKRate, avgIpLast5, isBullpenGame, pitchCountLimitFactor,
    parkFactor, parkHrFactor, parkRunFactor, handednessAdjustment, umpireKRate, homeAwayFactor,
    xBA, iso, oppPitcherEraPlus, platoonFactor, lineupSpot, teamPace, oppSpQuality,
    oppPitcherH9Factor, babipLuckAdjustment, xFip, oppWrcPlus, bbPct, projectedPA
  } = leg;

  const type = statType.toLowerCase();
  let propType = 'other';
  if (type.includes('strikeout') || type.includes('k\'s') || type.includes('ks') || type.includes('k ')) {
    propType = 'strikeouts';
  } else if (type.includes('total bases') || type.includes('tb')) {
    propType = 'total_bases';
  } else if (type.includes('hit')) {
    propType = 'hits';
  } else if (type.includes('earned run') || type.includes('er')) {
    propType = 'earned_runs';
  } else if (type.includes('walk') || type.includes('bb')) {
    propType = 'walks';
  }

  let muFinal = 0;
  let summary = "";

  // 1. Lineup Spot AB Map & Plate Appearances Map
  const lineupSpotABMap: Record<number, number> = { 1: 4.7, 2: 4.6, 3: 4.5, 4: 4.3, 5: 4.1, 6: 3.9, 7: 3.7, 8: 3.5, 9: 3.3 };
  const baseAb = lineupSpotABMap[lineupSpot || 4] || 4.1;
  const abProjection = baseAb * (teamPace || 1.0) * (oppSpQuality || 1.0);
  const paProjection = (projectedPA || (abProjection + 0.45));

  // 2. Compute Projections based on player prop types
  if (propType === 'strikeouts') {
    const projectedIp = (avgIpLast5 || 5.8) * (isBullpenGame ? 0.5 : 1.0) * (pitchCountLimitFactor || 1.0);
    const k9 = pitcherK9 || 9.2;
    const oppK = oppKRate !== undefined ? oppKRate : 0.225;
    
    // Formula: Projected Ks = (Pitcher K/9 + Opponent K rate * 9) / 2 * (Innings Projection / 9) * Park Factor * Handedness Adjustment * Umpire factor * HomeAway
    muFinal = ((k9 + oppK * 9) / 2) * (projectedIp / 9) * (parkFactor || 1.0) * (handednessAdjustment || 1.0) * (umpireKRate || 1.0) * (homeAwayFactor || 1.0);
    summary = `Projected K's = (K/9: ${k9.toFixed(1)} + Opp K%: ${(oppK*100).toFixed(0)}%) / 2 * (IP Projection: ${projectedIp.toFixed(1)} / 9) * Park: ${parkFactor || 1.0}x * Umpire K-rate: ${umpireKRate || 1.0}x`;
  } 
  else if (propType === 'total_bases') {
    const batXba = xBA !== undefined ? xBA : 0.252;
    const batIso = iso !== undefined ? iso : 0.170;
    const eraPlusVal = oppPitcherEraPlus !== undefined ? oppPitcherEraPlus : 100;
    
    // xTB = (xBA * AB) + (ISO * AB * park factor)
    const baseXTb = (batXba * abProjection) + (batIso * abProjection * (parkHrFactor || 1.0));
    muFinal = baseXTb * (eraPlusVal / 100) * (platoonFactor || 1.0) * (parkHrFactor || 1.0);
    summary = `xTB = (${batXba.toFixed(3)} xBA * ${abProjection.toFixed(1)} AB) + (${batIso.toFixed(3)} ISO * ${abProjection.toFixed(1)} AB * ${parkHrFactor || 1.0}) adjusted by Platoon: ${platoonFactor || 1.0}x & SP ERA+: ${eraPlusVal}`;
  } 
  else if (propType === 'hits') {
    const batXba = xBA !== undefined ? xBA : 0.252;
    const babipAdj = babipLuckAdjustment || 0;
    
    // Projected Hits = xBA * Projected AB * (1 + BABIP luck adjustment) * Opposing pitcher H/9 factor * Platoon
    muFinal = batXba * abProjection * (1 + babipAdj) * (oppPitcherH9Factor || 1.0) * (platoonFactor || 1.0);
    summary = `Projected Hits = ${batXba.toFixed(3)} xBA * ${abProjection.toFixed(1)} AB * BABIP-Luck: ${(1+babipAdj).toFixed(2)}x * Pitcher H/9 Factor: ${oppPitcherH9Factor || 1.0}x`;
  } 
  else if (propType === 'earned_runs') {
    const xFipVal = xFip || 3.95;
    const projectedIp = (avgIpLast5 || 5.8) * (isBullpenGame ? 0.5 : 1.0) * (pitchCountLimitFactor || 1.0);
    
    // Projected ER = xFIP-based ERA * (IP projection / 9) * Opponent wRC+ / 100 * Park run factor
    muFinal = xFipVal * (projectedIp / 9) * ((oppWrcPlus || 100) / 100) * (parkRunFactor || 1.0);
    summary = `Projected ER = ${xFipVal.toFixed(2)} xFIP * (${projectedIp.toFixed(1)} IP / 9) * Opp wRC+: ${oppWrcPlus || 100} * Park Run: ${parkRunFactor || 1.0}x`;
  } 
  else if (propType === 'walks') {
    const walkRate = bbPct !== undefined ? bbPct : 0.088;
    
    // Walks = BB% * projected PA
    muFinal = walkRate * paProjection;
    summary = `Projected Walks = ${(walkRate*100).toFixed(1)}% BB% * ${paProjection.toFixed(1)} PA`;
  } 
  else {
    // Fallback if propType doesn't match standard MLB props
    const x10 = leg.x10 || 0;
    const x20 = leg.x20 || 0;
    const xSeason = leg.xSeason || 0;
    const sampleConfidence = (x10 > 0 ? 0.6 : 0) + (x20 > 0 ? 0.25 : 0) + (xSeason > 0 ? 0.15 : 0);
    let baseMean = (0.4 * x10 + 0.3 * x20 + 0.3 * xSeason);
    if (baseMean === 0) baseMean = line;
    muFinal = baseMean;
    summary = "Mathematical expectation based on rolling sample weights";
  }

  // Double check minimum boundaries
  if (muFinal < 0) muFinal = 0;

  // 3. Dynamic volatility (Sigma)
  let baseSigma = 0.5;
  if (muFinal > 0) {
    if (propType === 'strikeouts') baseSigma = muFinal * 0.23;
    else if (propType === 'total_bases') baseSigma = muFinal * 0.35;
    else if (propType === 'hits') baseSigma = muFinal * 0.28;
    else if (propType === 'earned_runs') baseSigma = muFinal * 0.38;
    else if (propType === 'walks') baseSigma = muFinal * 0.40;
    else baseSigma = muFinal * 0.30;
  }
  if (baseSigma <= 0) baseSigma = 0.5;

  let pOver = 0;
  let pUnder = 0;
  let modelUsed = "Normal";

  if (line < 3) {
    modelUsed = "Poisson";
    pUnder = poissonCDF(muFinal, line - 0.5);
    pOver = 1 - pUnder;
  } else {
    modelUsed = "Normal";
    const zScore = (line - muFinal) / baseSigma;
    pUnder = normalCDF(zScore);
    pOver = 1 - pUnder;
  }

  const pModel = prediction === 'Over' ? pOver : pUnder;
  const pImp = impliedProbFromAmericanOdds(bookOdds);
  const edgeValue = (pModel - pImp) * 100;

  // MLB threshold edge finder check
  const thresholds: Record<string, number> = {
    "strikeouts": 0.7,
    "hits": 0.3,
    "total_bases": 0.4,
    "earned_runs": 0.5,
    "walks": 0.2
  };
  const diff = muFinal - line;
  const rawThresh = thresholds[propType] || 0.3;
  let edgeSignal = "No bet";
  if (diff >= rawThresh) {
    edgeSignal = `OVER — Edge: +${diff.toFixed(2)}`;
  } else if (diff <= -rawThresh) {
    edgeSignal = `UNDER — Edge: -${Math.abs(diff).toFixed(2)}`;
  }

  return {
    muPlayer: muFinal,
    mMin: 1.0,
    mPace: 1.0,
    mOpp: 1.0,
    muFinal,
    sigmaFinal: baseSigma,
    modelUsed,
    pOver,
    pUnder,
    pModel,
    pImp,
    edge: edgeValue,
    confidence: 0.90, // Placed high confidence because Statcast indicators are highly precise
    mlbEdgeSignal: edgeSignal,
    mlbFormulaSummary: summary,
    mlbPropType: propType
  };
};

export const calculateNflEngineMetrics = (leg: BetLeg) => {
  const {
    line = 0, bookOdds = -110, statType = 'Prop', prediction = 'Over',
    
    // Core stats
    avgPassYardsL5, seasonAvgPassYards, oppPassYardsAllowed,
    qbTdRate, qbAttemptsAvg, rzOppRate, oppPosTdRate,
    oppPassFunnel = 1.0, impliedGameTotal = 44.5, spreadPoints = 0,
    
    // Toggles
    missingWR = false, domeToColdOutdoor = false, windSpeedMph = 0,
    offBye = false, shortWeek = false, facingManCoverage = false,
    
    // Rushing
    carriesProjection, avgYpc = 4.2, olineRunBlockRank = 16,
    rbRole = 'committee', isHandcuff = false, teamRushTendency = 0,
    
    // Receiving
    targetSharePct, teamProjPassAttempts, avgYpt,
    oppCoverageGrade = 1.0, separationRate = 1.0, routeConcept = 'intermediate',
    catchRatePct,
    
    // Anytime TD
    rzTargetSharePct, teamRzTrips, playerRzTdRate, oppRzTdAllowedRate,
    
    isDivisional = false, isPlayoffAtmosphere = false
  } = leg;

  const type = statType.toLowerCase();
  let propType = 'other';
  if (type.includes('pass') && type.includes('yard')) propType = 'passing_yards';
  else if (type.includes('pass') && type.includes('td')) propType = 'passing_tds';
  else if (type.includes('pass') && type.includes('attempt')) propType = 'passing_attempts';
  else if (type.includes('rush') && type.includes('yard')) propType = 'rushing_yards';
  else if (type.includes('carry') || (type.includes('rush') && type.includes('attempt'))) propType = 'rushing_carries';
  else if (type.includes('rec') && type.includes('yard')) propType = 'receiving_yards';
  else if (type.includes('rec') || type.includes('catch') || type.includes('receptions')) propType = 'receptions';
  else if (type.includes('td') || type.includes('touchdown')) propType = 'anytime_td';

  let muFinal = 0;
  let summary = "";
  
  // Weather wind adjustments
  let windMul = 1.0;
  if (windSpeedMph >= 25) windMul = 0.75;
  else if (windSpeedMph >= 20) windMul = 0.83;
  else if (windSpeedMph >= 15) windMul = 0.90;
  else if (windSpeedMph >= 10) windMul = 0.96;
  
  // Game Script margins
  const isFavorite10Plus = spreadPoints <= -10;
  const isUnderdog10Plus = spreadPoints >= 10;
  const isFavorite7Plus = spreadPoints <= -7;
  const isUnderdog7Plus = spreadPoints >= 7;
  const isCloseGame = Math.abs(spreadPoints) <= 3;

  if (propType === 'passing_yards') {
    const pL5 = avgPassYardsL5 || leg.x10 || 240;
    const pSeason = seasonAvgPassYards || leg.xSeason || 235;
    const pOpp = oppPassYardsAllowed || leg.oppAllowed || 220;
    
    const basePassYards = (pL5 * 0.40) + (pSeason * 0.30) + (pOpp * 0.30);
    
    let paceMul = leg.paceBonusMultiplier || (leg.expectedPace && leg.leaguePace ? leg.expectedPace / leg.leaguePace : 1.0);
    let weatherMul = windMul;
    if (domeToColdOutdoor) weatherMul *= 0.92;
    if (windSpeedMph >= 15) weatherMul *= 0.85; 
    
    let gameScriptMul = 1.0;
    if (isFavorite10Plus) gameScriptMul = 0.90;
    else if (isUnderdog10Plus) gameScriptMul = 1.15;
    
    let qbAdj = 1.0;
    if (missingWR) qbAdj *= 0.88;
    if (offBye) qbAdj *= 1.05;
    if (shortWeek) qbAdj *= 0.93;
    if (facingManCoverage) qbAdj *= 1.02;
    
    muFinal = basePassYards * paceMul * gameScriptMul * weatherMul * qbAdj;
    
    summary = `Passing Yards = [L5 Avg (${pL5}) x 40% + Season Avg (${pSeason}) x 30% + Opp Allowed (${pOpp}) x 30%] = ${basePassYards.toFixed(1)} Base. Multipliers applied: Pace ${paceMul.toFixed(2)}x, Script ${gameScriptMul.toFixed(2)}x, Weather ${weatherMul.toFixed(2)}x, QB Adj ${qbAdj.toFixed(2)}x.`;
  }
  else if (propType === 'passing_attempts') {
    const baseAttempts = qbAttemptsAvg || leg.xSeason || 34;
    const funnel = oppPassFunnel;
    const totalFactor = impliedGameTotal ? (impliedGameTotal / 44.5) : 1.0;
    
    let spreadAdj = 1.0;
    if (isFavorite7Plus) spreadAdj = 0.88;
    else if (isUnderdog7Plus) spreadAdj = 1.15;
    
    muFinal = baseAttempts * funnel * totalFactor * spreadAdj;
    summary = `Attempts = [Season Avg (${baseAttempts})] x Funnel ${funnel.toFixed(2)}x x Total Factor ${totalFactor.toFixed(2)}x x Spread Adj ${spreadAdj.toFixed(2)}x.`;
  }
  else if (propType === 'passing_tds') {
    const baseAttempts = qbAttemptsAvg || leg.xSeason || 34;
    let spreadAdj = 1.0;
    if (isFavorite7Plus) spreadAdj = 0.88;
    else if (isUnderdog7Plus) spreadAdj = 1.15;
    const projAttempts = baseAttempts * oppPassFunnel * (impliedGameTotal ? (impliedGameTotal / 44.5) : 1.0) * spreadAdj;

    const tdRate = qbTdRate || 0.045; 
    const rzOpp = rzOppRate || 1.0;
    const oppTdRate = oppPosTdRate || 1.0;
    const hfa = (spreadPoints < 0) ? 0.3 : 0.0; 
    
    let tdAdj = 1.0;
    if (missingWR) tdAdj *= 0.85;
    if (windSpeedMph >= 15) tdAdj *= 0.80;
    
    muFinal = ((tdRate * projAttempts) * rzOpp * oppTdRate + hfa) * tdAdj;
    summary = `Pass TDs = [TD% (${(tdRate*100).toFixed(1)}%) x Proj Attempts (${projAttempts.toFixed(1)}) x RZ Opp (${rzOpp.toFixed(1)}) x Opp TD allowed (${oppTdRate.toFixed(1)}) + Home Factor (+${hfa})] x Adj (${tdAdj.toFixed(2)}).`;
  }
  else if (propType === 'rushing_carries') {
    const baseCarries = carriesProjection || leg.xSeason || 14;
    const rushTendency = teamRushTendency;
    let scriptFactor = 1.0;
    if (isFavorite7Plus) scriptFactor = 1.20;
    else if (isUnderdog7Plus) scriptFactor = 0.80;
    else if (isCloseGame) scriptFactor = 1.00;
    
    muFinal = baseCarries * (1 + rushTendency) * scriptFactor;
    summary = `Carries = [Season Avg (${baseCarries})] x Tendency ${(1 + rushTendency).toFixed(2)}x x Script Factor ${scriptFactor.toFixed(2)}x.`;
  }
  else if (propType === 'rushing_yards') {
    const rL5 = avgPassYardsL5 || leg.x10 || 65; 
    const rSeason = seasonAvgPassYards || leg.xSeason || 62;
    const rOpp = oppPassYardsAllowed || leg.oppAllowed || 110;
    const baseCarries = carriesProjection || leg.xSeason || 14;
    
    let scriptFactor = 1.0;
    if (isFavorite7Plus) scriptFactor = 1.20;
    else if (isUnderdog7Plus) scriptFactor = 0.80;
    const projCarries = baseCarries * (1 + teamRushTendency) * scriptFactor;
    
    const baseRushYards = (rL5 * 0.35) + (rSeason * 0.25) + (rOpp * 0.25) + (projCarries * avgYpc * 0.15);
    
    let olineMul = 1.0;
    if (olineRunBlockRank <= 10) olineMul = 1.12;
    else if (olineRunBlockRank >= 23) olineMul = 0.88;
    
    let scriptMul = 1.0;
    if (isFavorite10Plus) scriptMul = 1.15;
    else if (isUnderdog10Plus) scriptMul = 0.80;
    
    let weatherMul = 1.0; 
    
    let roleMul = 1.0;
    if (rbRole === 'workhorse') roleMul = 1.15;
    else if (rbRole === 'committee') roleMul = 0.85;
    else if (rbRole === 'third_down') roleMul = 0.70;
    
    let handcuffMul = isHandcuff ? 0.75 : 1.0;
    
    muFinal = baseRushYards * olineMul * scriptMul * weatherMul * roleMul * handcuffMul;
    summary = `Rushing Yards = [L5 (${rL5}) x 35% + Season (${rSeason}) x 25% + Opp Allowed (${rOpp}) x 25% + (Proj Carries (${projCarries.toFixed(1)}) x YPC (${avgYpc}) x 15%)] = ${baseRushYards.toFixed(1)} Base. Multipliers: O-Line ${olineMul.toFixed(2)}x, Script ${scriptMul.toFixed(2)}x, Role ${roleMul.toFixed(2)}x${isHandcuff ? ', Handcuff 0.75x' : ''}.`;
  }
  else if (propType === 'receiving_yards') {
    const tShare = targetSharePct !== undefined ? targetSharePct : 0.18; 
    const teamAttempts = teamProjPassAttempts || 32;
    const projTargets = tShare * teamAttempts;
    
    let yptByRoute = 8.0;
    if (routeConcept === 'deep') yptByRoute = 10.5;
    else if (routeConcept === 'intermediate') yptByRoute = 8.0;
    else if (routeConcept === 'short') yptByRoute = 5.0;
    
    const baseRecYards = projTargets * yptByRoute;
    
    let scriptMul = 1.0;
    if (isFavorite10Plus) scriptMul = 0.92;
    else if (isUnderdog10Plus) scriptMul = 1.15;
    
    muFinal = baseRecYards * oppCoverageGrade * separationRate * scriptMul;
    summary = `Receiving Yards = [Target Share (${(tShare*100).toFixed(0)}%) x Team Attempts (${teamAttempts}) x Route YPT (${yptByRoute.toFixed(1)})] = ${baseRecYards.toFixed(1)} Base. Coverage Adj: ${oppCoverageGrade.toFixed(2)}x, Sec: ${separationRate.toFixed(2)}x, Script: ${scriptMul.toFixed(2)}x.`;
  }
  else if (propType === 'receptions') {
    const tShare = targetSharePct !== undefined ? targetSharePct : 0.18;
    const teamAttempts = teamProjPassAttempts || 32;
    const projTargets = tShare * teamAttempts;
    
    const cRate = catchRatePct || 0.65;
    muFinal = projTargets * cRate;
    summary = `Receptions = Proj Targets (${projTargets.toFixed(1)}) x Catch Rate (${(cRate*100).toFixed(0)}%). [Target Share: ${(tShare*100).toFixed(0)}%, Team Attempts: ${teamAttempts}].`;
  }
  else if (propType === 'anytime_td') {
    const rzShare = rzTargetSharePct !== undefined ? rzTargetSharePct : 0.15;
    const rzTrips = teamRzTrips || 3.0;
    const convRate = playerRzTdRate || 0.25;
    const oppAllowedRate = oppRzTdAllowedRate || 1.0;
    
    const tdProb = rzShare * rzTrips * convRate * oppAllowedRate;
    muFinal = tdProb; 
    summary = `Anytime TD Prob = RZ share (${(rzShare*100).toFixed(0)}%) x Team RZ Trips (${rzTrips}) x Conv Rate (${(convRate*100).toFixed(0)}%) x Opp RZ Factor (${oppAllowedRate.toFixed(2)}x) = ${(tdProb*100).toFixed(1)}%.`;
  }
  else {
    const x10 = leg.x10 || 0;
    const x20 = leg.x20 || 0;
    const xSeason = leg.xSeason || 0;
    let baseMean = calcBaselineMean(x10, x20, xSeason);
    if (baseMean === 0) baseMean = line;
    muFinal = baseMean;
    summary = "Mathematical expectation based on rolling sample weights";
  }

  // Divisional and playlist adjustments
  let finalAdj = 1.0;
  if (isDivisional) {
    if (isPlayoffAtmosphere) finalAdj *= 0.90;
    else finalAdj *= 0.95;
  }
  
  if (finalAdj !== 1.0) {
    muFinal *= finalAdj;
    summary += ` Adjusted for ${isPlayoffAtmosphere ? 'Playoff atmospheric division' : 'Divisional familiarity'} by ${finalAdj.toFixed(2)}x.`;
  }

  if (muFinal < 0) muFinal = 0;

  // Compute Standard Volatility (Sigma)
  let baseSigma = 1.0;
  if (muFinal > 0) {
    if (propType === 'passing_yards') baseSigma = muFinal * 0.18;
    else if (propType === 'passing_attempts') baseSigma = muFinal * 0.12;
    else if (propType === 'passing_tds') baseSigma = muFinal * 0.45;
    else if (propType === 'rushing_carries') baseSigma = muFinal * 0.20;
    else if (propType === 'rushing_yards') baseSigma = muFinal * 0.28;
    else if (propType === 'receiving_yards') baseSigma = muFinal * 0.28;
    else if (propType === 'receptions') baseSigma = muFinal * 0.22;
    else if (propType === 'anytime_td') baseSigma = muFinal * 0.50;
    else baseSigma = muFinal * 0.25;
  }
  if (baseSigma <= 0) baseSigma = 1.0;

  let pOver = 0;
  let pUnder = 0;
  let modelUsed = "Normal";

  if (propType === 'anytime_td') {
    modelUsed = "Direct Probability";
    pOver = muFinal; 
    pUnder = 1 - pOver;
  } else if (line < 4) {
    modelUsed = "Poisson";
    pUnder = poissonCDF(muFinal, line - 0.5);
    pOver = 1 - pUnder;
  } else {
    modelUsed = "Normal";
    const zScore = (line - muFinal) / baseSigma;
    pUnder = normalCDF(zScore);
    pOver = 1 - pUnder;
  }

  const pModel = prediction === 'Over' ? pOver : pUnder;
  const pImp = impliedProbFromAmericanOdds(bookOdds);
  const edgeValue = (pModel - pImp) * 100;

  let edgeSignal = "No bet";
  const diff = muFinal - line;
  
  let rawThresh = 6.0;
  if (propType === 'passing_yards') rawThresh = 8.0;
  else if (propType === 'rushing_yards') rawThresh = 6.0;
  else if (propType === 'receiving_yards') rawThresh = 6.0;
  else if (propType === 'receptions') rawThresh = 0.6;
  else if (propType === 'passing_tds') rawThresh = 0.3;
  else if (propType === 'anytime_td') rawThresh = 0.08; 

  if (propType === 'anytime_td') {
    if (edgeValue >= 8) {
      edgeSignal = `OVER — Anytime TD Edge: +${edgeValue.toFixed(1)}%`;
    }
  } else {
    if (diff >= rawThresh) {
      edgeSignal = `OVER — Edge: +${diff.toFixed(2)}`;
    } else if (diff <= -rawThresh) {
      edgeSignal = `UNDER — Edge: -${Math.abs(diff).toFixed(2)}`;
    }
  }

  let nflConfidence = "No Unit";
  if (propType === 'passing_yards') {
    const absDiff = Math.abs(diff);
    if (absDiff >= 20) nflConfidence = "Strong (2 units)";
    else if (absDiff >= 13) nflConfidence = "Moderate (1.5 units)";
    else if (absDiff >= 8) nflConfidence = "Lean (1 unit)";
  } else if (propType === 'rushing_yards') {
    const absDiff = Math.abs(diff);
    if (absDiff >= 16) nflConfidence = "Strong (2 units)";
    else if (absDiff >= 10) nflConfidence = "Moderate (1.5 units)";
    else if (absDiff >= 6) nflConfidence = "Lean (1 unit)";
  } else if (propType === 'receiving_yards') {
    const absDiff = Math.abs(diff);
    if (absDiff >= 15) nflConfidence = "Strong (2 units)";
    else if (absDiff >= 10) nflConfidence = "Moderate (1.5 units)";
    else if (absDiff >= 6) nflConfidence = "Lean (1 unit)";
  } else {
    if (edgeValue >= 15) nflConfidence = "Strong (2 units)";
    else if (edgeValue >= 8) nflConfidence = "Moderate (1.5 units)";
    else if (edgeValue >= 4) nflConfidence = "Lean (1 unit)";
  }

  return {
    muPlayer: muFinal,
    mMin: 1.0,
    mPace: 1.0,
    mOpp: 1.0,
    muFinal,
    sigmaFinal: baseSigma,
    modelUsed,
    pOver,
    pUnder,
    pModel,
    pImp,
    edge: edgeValue,
    confidence: edgeValue >= 8 ? 0.95 : 0.70,
    nflEdgeSignal: edgeSignal,
    nflFormulaSummary: summary,
    nflPropType: propType,
    nflConfidenceText: nflConfidence
  };
};

export const calculateEngineMetrics = (leg: BetLeg) => {
  // ROUTING DIRECTIVE: If the sport is MLB, redirect entirely to the dedicated MLB mathematical base
  if ((leg.league as any) === 'MLB' || (leg.league as any) === League.MLB) {
    return calculateMlbEngineMetrics(leg);
  }

  // NFL ROUTING DIRECTIVE: If the sport is NFL, redirect entirely to the dedicated NFL Player Prop base
  if ((leg.league as any) === 'NFL' || (leg.league as any) === League.NFL) {
    return calculateNflEngineMetrics(leg);
  }

  const {
    x10 = 0, x20 = 0, xSeason = 0, sigma: inputSigma = 0,
    expectedMins = 30, avgMins = 30,
    expectedPace = 100, leaguePace = 100,
    oppAllowed = 20, leagueAllowed = 20,
    line = 0, bookOdds = -110, statType = 'Prop'
  } = leg;

  // 1. Bayesian Shrinkage on Mean
  let rawMu = calcBaselineMean(x10, x20, xSeason);
  const sampleConfidence = (x10 > 0 ? 0.6 : 0) + (x20 > 0 ? 0.25 : 0) + (xSeason > 0 ? 0.15 : 0);
  let muPlayer = (rawMu * sampleConfidence) + (line * (1 - sampleConfidence));
  if (muPlayer === 0) muPlayer = line;

  // 2. Situational Adjustments
  const mMin = calcMinutesMultiplier(expectedMins, avgMins);
  const mPace = calcPaceMultiplier(expectedPace, leaguePace);
  const mOpp = calcOpponentMultiplier(oppAllowed, leagueAllowed);
  
  const muFinal = muPlayer * mMin * mPace * mOpp;

  // 3. Bayesian Variance Shrinkage
  // High pace games generally increase volatility (sigma) alongside the mean.
  const baseSigma = inputSigma || getDynamicSigma(statType, muFinal);
  const mVol = 1 + (mPace - 1) * 0.5; // Volatility scales with pace at 50% sensitivity
  const sigmaFinal = baseSigma * mVol;

  // 4. Model Selection & Probability Calculation
  let pOver = 0;
  let pUnder = 0;
  let modelUsed = "Normal";

  if (line < 8) {
    // Discrete Poisson for low-event props (e.g., 3PM, Blocks, Steals)
    modelUsed = "Poisson";
    pUnder = poissonCDF(muFinal, line - 0.5);
    pOver = 1 - pUnder;
  } else if (line < 25) {
    // Log-Normal for mid-tier stats to account for positive skewness
    modelUsed = "Log-Normal";
    pUnder = logNormalCDF(line, muFinal, sigmaFinal);
    pOver = 1 - pUnder;
  } else {
    // Normal Approximation for high-volume stats (Points)
    modelUsed = "Normal";
    const zScore = (line - muFinal) / sigmaFinal;
    pUnder = normalCDF(zScore);
    pOver = 1 - pUnder;
  }
  
  const pModel = leg.prediction === 'Over' ? pOver : pUnder;
  const pImp = impliedProbFromAmericanOdds(bookOdds);
  const edge = (pModel - pImp) * 100;

  return {
    muPlayer,
    mMin,
    mPace,
    mOpp,
    muFinal,
    sigmaFinal,
    modelUsed,
    pOver,
    pUnder,
    pModel,
    pImp,
    edge,
    confidence: sampleConfidence
  };
};
