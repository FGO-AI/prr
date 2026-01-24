
import { BetLeg } from '../types';

/**
 * Standard Normal Cumulative Distribution Function
 */
export const normalCDF = (z: number): number => {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
};

export const calcBaselineMean = (x10: number, x20: number, xSeason: number): number => {
  return (3 * x10 + 2 * x20 + 1 * xSeason) / 6;
};

export const calcMinutesMultiplier = (expected: number, avg: number): number => {
  return avg === 0 ? 1 : expected / avg;
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

export const calculateEngineMetrics = (leg: BetLeg) => {
  const {
    x10 = 0, x20 = 0, xSeason = 0, sigma = 0,
    expectedMins = 30, avgMins = 30,
    expectedPace = 100, leaguePace = 100,
    oppAllowed = 20, leagueAllowed = 20,
    line = 0, bookOdds = -110
  } = leg;

  // Fallback Logic: If no historical form is available (common in live search),
  // we assume the market line is the current baseline estimate of the mean.
  let muPlayer = calcBaselineMean(x10, x20, xSeason);
  if (muPlayer === 0 && line > 0) {
    muPlayer = line;
  }

  // Fallback Sigma: If no volatility is provided, assume a standard 20% Coefficient of Variation
  const effectiveSigma = sigma || (line * 0.2) || 1;

  const mMin = calcMinutesMultiplier(expectedMins, avgMins);
  const mPace = calcPaceMultiplier(expectedPace, leaguePace);
  const mOpp = calcOpponentMultiplier(oppAllowed, leagueAllowed);
  
  const muFinal = muPlayer * mMin * mPace * mOpp;
  const zScore = (line - muFinal) / effectiveSigma;
  
  const pUnder = normalCDF(zScore);
  const pOver = 1 - pUnder;
  
  // Calculate model probability based on user prediction (O/U)
  const pModel = leg.prediction === 'Over' ? pOver : pUnder;
  const pImp = impliedProbFromAmericanOdds(bookOdds);
  const edge = (pModel - pImp) * 100;

  return {
    muPlayer,
    mMin,
    mPace,
    mOpp,
    muFinal,
    zScore,
    pOver,
    pUnder,
    pModel,
    pImp,
    edge
  };
};
