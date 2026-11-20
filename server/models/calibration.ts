export interface CalibrationBin {
  binLabel: string;
  rangeMin: number;
  rangeMax: number;
  count: number;
  meanPredictedProb: number;
  empiricalWinRate: number;
  /** Binomial standard error: sqrt(p*(1-p)/n) */
  stdError: number;
}

export interface EvaluationMetricsSummary {
  sampleSize: number;
  accuracy: number;
  brierScore: number;
  logLoss: number;
  meanPredictedProb: number;
  empiricalBaseRate: number;
  calibrationErrorECE: number;
  roiFlatOneUnit?: number | null;
  betSampleSize?: number;
}

export interface LogisticParameters {
  bias: number;
  weights: number[];
  featureNames: string[];
  means: number[];
  stds: number[];
  plattA: number;
  plattB: number;
}

export function sigmoid(z: number): number {
  if (z > 30) return 0.999999;
  if (z < -30) return 0.000001;
  return 1 / (1 + Math.exp(-z));
}

export function clampProb(p: number, eps: number = 1e-6): number {
  return Math.min(1 - eps, Math.max(eps, p));
}

export function computeBrierScore(probs: number[], outcomes: number[]): number {
  if (probs.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < probs.length; i++) {
    const diff = probs[i] - outcomes[i];
    sum += diff * diff;
  }
  return Number((sum / probs.length).toFixed(5));
}

export function computeLogLoss(probs: number[], outcomes: number[]): number {
  if (probs.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < probs.length; i++) {
    const p = clampProb(probs[i], 1e-6);
    const y = outcomes[i];
    sum += -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
  }
  return Number((sum / probs.length).toFixed(5));
}

export function computeCalibrationBins(probs: number[], outcomes: number[], numBins: number = 10): {
  bins: CalibrationBin[];
  ece: number;
} {
  const bins: CalibrationBin[] = [];
  let ece = 0;
  const nTotal = probs.length;

  for (let b = 0; b < numBins; b++) {
    const min = b / numBins;
    const max = (b + 1) / numBins;
    const idxs: number[] = [];
    for (let i = 0; i < probs.length; i++) {
      if (b === numBins - 1 ? probs[i] >= min && probs[i] <= max : probs[i] >= min && probs[i] < max) {
        idxs.push(i);
      }
    }
    const count = idxs.length;
    if (count === 0) {
      bins.push({
        binLabel: `${Math.round(min * 100)}-${Math.round(max * 100)}%`,
        rangeMin: min,
        rangeMax: max,
        count: 0,
        meanPredictedProb: Number(((min + max) / 2).toFixed(3)),
        empiricalWinRate: 0,
        stdError: 0
      });
      continue;
    }
    const meanP = idxs.reduce((a, i) => a + probs[i], 0) / count;
    const empRate = idxs.reduce((a, i) => a + outcomes[i], 0) / count;
    const se = Math.sqrt((empRate * (1 - empRate)) / count);
    ece += (count / Math.max(1, nTotal)) * Math.abs(meanP - empRate);

    bins.push({
      binLabel: `${Math.round(min * 100)}-${Math.round(max * 100)}%`,
      rangeMin: min,
      rangeMax: max,
      count,
      meanPredictedProb: Number(meanP.toFixed(4)),
      empiricalWinRate: Number(empRate.toFixed(4)),
      stdError: Number(se.toFixed(4))
    });
  }

  return { bins, ece: Number(ece.toFixed(5)) };
}

export function summarizeProbMetrics(probs: number[], outcomes: number[]): EvaluationMetricsSummary {
  const n = probs.length;
  if (n === 0) {
    return {
      sampleSize: 0,
      accuracy: 0,
      brierScore: 0,
      logLoss: 0,
      meanPredictedProb: 0.5,
      empiricalBaseRate: 0.5,
      calibrationErrorECE: 0
    };
  }
  let correct = 0;
  let pSum = 0;
  let ySum = 0;
  for (let i = 0; i < n; i++) {
    pSum += probs[i];
    ySum += outcomes[i];
    const pred = probs[i] >= 0.5 ? 1 : 0;
    if (pred === Math.round(outcomes[i])) correct++;
  }
  const { ece } = computeCalibrationBins(probs, outcomes, 10);
  return {
    sampleSize: n,
    accuracy: Number((correct / n).toFixed(4)),
    brierScore: computeBrierScore(probs, outcomes),
    logLoss: computeLogLoss(probs, outcomes),
    meanPredictedProb: Number((pSum / n).toFixed(4)),
    empiricalBaseRate: Number((ySum / n).toFixed(4)),
    calibrationErrorECE: ece
  };
}

/**
 * Fold-local preprocessing & L2-regularized logistic regression.
 * Imputes missing values (NaN / null) using ONLY training fold means,
 * standardizes features using ONLY training fold mean/std,
 * and fits weights + bias with L2 penalty.
 */
export function fitFoldLocalLogisticModel(params: {
  rawFeatures: Array<Array<number | null>>;
  outcomes: number[]; // 1 = home win, 0 = away win (or 0.5 for NFL tie)
  featureNames: string[];
  l2Lambda?: number;
  learningRate?: number;
  epochs?: number;
}): LogisticParameters {
  const n = params.rawFeatures.length;
  const d = params.featureNames.length;
  const means = new Array(d).fill(0);
  const counts = new Array(d).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < d; j++) {
      const v = params.rawFeatures[i][j];
      if (v !== null && Number.isFinite(v)) {
        means[j] += v;
        counts[j]++;
      }
    }
  }
  for (let j = 0; j < d; j++) {
    means[j] = counts[j] > 0 ? means[j] / counts[j] : 0;
  }

  const stds = new Array(d).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < d; j++) {
      const v = params.rawFeatures[i][j];
      const val = v !== null && Number.isFinite(v) ? v : means[j];
      stds[j] += (val - means[j]) ** 2;
    }
  }
  for (let j = 0; j < d; j++) {
    stds[j] = counts[j] > 1 ? Math.max(1e-4, Math.sqrt(stds[j] / counts[j])) : 1;
  }

  const X: number[][] = params.rawFeatures.map(row =>
    row.map((v, j) => {
      const imputed = v !== null && Number.isFinite(v) ? v : means[j];
      return Math.max(-6, Math.min(6, (imputed - means[j]) / stds[j]));
    })
  );

  const weights = new Array(d).fill(0);
  let bias = 0;
  const lambda = params.l2Lambda ?? 12.0;
  const lr = params.learningRate ?? 0.08;
  const epochs = params.epochs ?? 280;

  for (let ep = 0; ep < epochs; ep++) {
    const gradW = new Array(d).fill(0);
    let gradB = 0;
    for (let i = 0; i < n; i++) {
      let z = bias;
      for (let j = 0; j < d; j++) z += weights[j] * X[i][j];
      const p = sigmoid(z);
      const err = p - params.outcomes[i];
      gradB += err;
      for (let j = 0; j < d; j++) {
        gradW[j] += err * X[i][j];
      }
    }
    bias -= lr * (gradB / Math.max(1, n));
    for (let j = 0; j < d; j++) {
      const reg = (lambda * weights[j]) / Math.max(1, n);
      weights[j] -= lr * (gradW[j] / Math.max(1, n) + reg);
    }
  }

  return {
    bias: Number(bias.toFixed(5)),
    weights: weights.map(w => Number(w.toFixed(5))),
    featureNames: params.featureNames,
    means: means.map(m => Number(m.toFixed(5))),
    stds: stds.map(s => Number(s.toFixed(5))),
    plattA: 1.0,
    plattB: 0.0
  };
}

export function predictWithLogisticModel(
  model: LogisticParameters,
  rawFeatureRow: Array<number | null>
): number {
  let z = model.bias;
  for (let j = 0; j < model.weights.length; j++) {
    const v = rawFeatureRow[j];
    const imputed = v !== null && Number.isFinite(v) ? v : model.means[j];
    const x = Math.max(-6, Math.min(6, (imputed - model.means[j]) / model.stds[j]));
    z += model.weights[j] * x;
  }
  const rawLogit = z * model.plattA + model.plattB;
  return clampProb(sigmoid(rawLogit), 0.02);
}

/**
 * Fits Platt scaling (1D logistic recalibration on validation logits) strictly on validation fold.
 */
export function fitPlattCalibration(rawProbs: number[], outcomes: number[]): { plattA: number; plattB: number } {
  if (rawProbs.length < 20) return { plattA: 1.0, plattB: 0.0 };
  let a = 1.0;
  let b = 0.0;
  const lr = 0.05;
  const l2 = 2.0;

  const logits = rawProbs.map(p => {
    const c = clampProb(p, 0.01);
    return Math.log(c / (1 - c));
  });

  for (let ep = 0; ep < 200; ep++) {
    let gA = 0;
    let gB = 0;
    for (let i = 0; i < logits.length; i++) {
      const pred = sigmoid(a * logits[i] + b);
      const err = pred - outcomes[i];
      gA += err * logits[i];
      gB += err;
    }
    a -= lr * (gA / logits.length + (l2 * (a - 1.0)) / logits.length);
    b -= lr * (gB / logits.length + (l2 * b) / logits.length);
  }

  return {
    plattA: Number(Math.max(0.4, Math.min(1.6, a)).toFixed(4)),
    plattB: Number(Math.max(-0.5, Math.min(0.5, b)).toFixed(4))
  };
}
