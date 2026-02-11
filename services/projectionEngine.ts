
import { BetLeg } from '../types';

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

export const calculateEngineMetrics = (leg: BetLeg) => {
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
