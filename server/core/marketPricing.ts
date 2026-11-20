import { LeagueCode, MarketPricingAnalysis, MarketSnapshot } from "./types";

export const SETTLEMENT_RULES_VERSIONS: Record<LeagueCode, string> = {
  NFL: "nfl_2025_ot_tie_reg_push_v1",
  NBA: "nba_2025_ot_included_v1",
  MLB: "mlb_2025_extra_innings_ghost_runner_v1"
};

export function americanToDecimal(american: number): number {
  if (!Number.isFinite(american) || american === 0) {
    throw new Error(`Invalid American odds: ${american}`);
  }
  if (american > 0) {
    return Number((1 + american / 100).toFixed(6));
  }
  const absA = Math.abs(american);
  return Number((1 + 100 / absA).toFixed(6));
}

export function decimalToAmerican(decimal: number): number {
  if (!Number.isFinite(decimal) || decimal <= 1.0) {
    throw new Error(`Invalid decimal odds: ${decimal}`);
  }
  if (decimal >= 2.0) {
    return Math.round((decimal - 1) * 100);
  }
  return Math.round(-100 / (decimal - 1));
}

export function rawImpliedFromDecimal(decimal: number): number {
  if (!Number.isFinite(decimal) || decimal <= 1.0) {
    throw new Error(`Invalid decimal odds: ${decimal}`);
  }
  return 1 / decimal;
}

export function rawImpliedFromAmerican(american: number): number {
  if (!Number.isFinite(american) || american === 0) {
    throw new Error(`Invalid American odds: ${american}`);
  }
  if (american > 0) {
    return 100 / (american + 100);
  }
  const absA = Math.abs(american);
  return absA / (absA + 100);
}

/**
 * Proportional margin removal approximation: q_i = r_i / sum(r_j).
 * Explicitly labeled as an approximation, not a claim of true probability.
 */
export function removeMarginProportional(rawProbs: number[]): {
  normalized: number[];
  overround: number;
  method: string;
} {
  if (rawProbs.length === 0 || rawProbs.some(p => !Number.isFinite(p) || p <= 0)) {
    throw new Error("Raw implied probabilities must be positive finite numbers.");
  }
  const sum = rawProbs.reduce((a, b) => a + b, 0);
  return {
    normalized: rawProbs.map(r => r / sum),
    overround: sum - 1,
    method: "proportional_normalization_approx"
  };
}

/**
 * Push-aware expected value per 1 unit staked:
 * EV = p_win * (d - 1) - p_loss
 * Returned push stake contributes 0 net profit.
 */
export function expectedValuePerUnit(params: {
  pWin: number;
  pLoss: number;
  pPush?: number;
  decimalOdds: number;
}): number {
  const pPush = params.pPush ?? 0;
  const sum = params.pWin + params.pLoss + pPush;
  if (Math.abs(sum - 1) > 1e-4) {
    throw new Error(`Exhaustive outcome probabilities must sum to 1 (got ${sum})`);
  }
  if (params.decimalOdds <= 1) {
    throw new Error(`Invalid decimal odds: ${params.decimalOdds}`);
  }
  return params.pWin * (params.decimalOdds - 1) - params.pLoss;
}

export function validateComparableSnapshots(snapshots: MarketSnapshot[]): {
  comparable: boolean;
  reason?: string;
} {
  if (snapshots.length <= 1) return { comparable: true };
  const ref = snapshots[0];
  for (const s of snapshots.slice(1)) {
    if (s.marketType !== ref.marketType) {
      return { comparable: false, reason: `Mismatched marketType: ${s.marketType} vs ${ref.marketType}` };
    }
    if (s.period !== ref.period) {
      return { comparable: false, reason: `Mismatched period: ${s.period} vs ${ref.period}` };
    }
    if (s.settlementRulesVersion !== ref.settlementRulesVersion) {
      return { comparable: false, reason: `Mismatched settlementRulesVersion: ${s.settlementRulesVersion} vs ${ref.settlementRulesVersion}` };
    }
    if (s.line !== ref.line) {
      return { comparable: false, reason: `Mismatched line: ${s.line} vs ${ref.line}` };
    }
  }
  return { comparable: true };
}

export type WagerSettlement = "win" | "loss" | "push" | "void";

export function settleMarketOutcome(params: {
  marketType: "h2h" | "spread" | "total";
  side: "home" | "away" | "over" | "under";
  line: number | null;
  homeScore: number | null;
  awayScore: number | null;
  gameStatus: string;
  decimalOdds: number;
}): { outcome: WagerSettlement; netProfitPerUnit: number } {
  if (
    params.gameStatus === "canceled" ||
    params.gameStatus === "postponed" ||
    params.homeScore === null ||
    params.awayScore === null
  ) {
    return { outcome: "void", netProfitPerUnit: 0 };
  }

  const margin = params.homeScore - params.awayScore;
  const total = params.homeScore + params.awayScore;

  if (params.marketType === "h2h") {
    if (margin === 0) {
      // 2-way H2H moneyline pushes on NFL ties
      return { outcome: "push", netProfitPerUnit: 0 };
    }
    const homeWon = margin > 0;
    const won = params.side === "home" ? homeWon : !homeWon;
    return {
      outcome: won ? "win" : "loss",
      netProfitPerUnit: won ? params.decimalOdds - 1 : -1
    };
  }

  if (params.marketType === "spread") {
    const line = params.line ?? 0;
    const adjusted = params.side === "home" ? margin + line : -margin - line;
    if (Math.abs(adjusted) < 1e-9) {
      return { outcome: "push", netProfitPerUnit: 0 };
    }
    const won = adjusted > 0;
    return {
      outcome: won ? "win" : "loss",
      netProfitPerUnit: won ? params.decimalOdds - 1 : -1
    };
  }

  // Total
  const totalLine = params.line ?? 0;
  if (Math.abs(total - totalLine) < 1e-9) {
    return { outcome: "push", netProfitPerUnit: 0 };
  }
  const won = params.side === "over" ? total > totalLine : total < totalLine;
  return {
    outcome: won ? "win" : "loss",
    netProfitPerUnit: won ? params.decimalOdds - 1 : -1
  };
}

export function analyzeMarketPricing(params: {
  league: LeagueCode;
  modelHomeWinProb: number;
  modelAwayWinProb: number;
  modelTieProb: number;
  snapshot: MarketSnapshot | null;
  isMarketInformedModel: boolean;
}): MarketPricingAnalysis {
  const { snapshot, modelHomeWinProb, modelAwayWinProb, modelTieProb } = params;

  if (!snapshot || snapshot.homePriceAmerican === null || snapshot.awayPriceAmerican === null) {
    return {
      available: false,
      reasonIfUnavailable:
        "No live odds provider configured (ODDS_API_KEY unset) and no verified market odds snapshot supplied. Model probabilities are shown without invented market prices.",
      sportsbook: null,
      marketType: "h2h",
      period: "full_game",
      settlementRulesVersion: SETTLEMENT_RULES_VERSIONS[params.league],
      capturedUtc: null,
      isUserSupplied: false,
      isMarketInformedModel: params.isMarketInformedModel,
      homeAmericanOdds: null,
      awayAmericanOdds: null,
      homeDecimalOdds: null,
      awayDecimalOdds: null,
      homeRawImpliedProb: null,
      awayRawImpliedProb: null,
      overroundPct: null,
      homeNoVigApproxProb: null,
      awayNoVigApproxProb: null,
      noVigMethodLabel: "unavailable",
      homeExpectedValuePerUnit: null,
      awayExpectedValuePerUnit: null,
      spreadLine: snapshot?.line ?? null,
      totalLine: null,
      recommendedMarketNote: "Unavailable — supply sportsbook odds or configure ODDS_API_KEY to evaluate price EV."
    };
  }

  const homeDec = snapshot.homeDecimal ?? americanToDecimal(snapshot.homePriceAmerican);
  const awayDec = snapshot.awayDecimal ?? americanToDecimal(snapshot.awayPriceAmerican);
  const homeRaw = rawImpliedFromAmerican(snapshot.homePriceAmerican);
  const awayRaw = rawImpliedFromAmerican(snapshot.awayPriceAmerican);

  // Two-way H2H moneyline pushes on NFL tie (for 2-way market, normalize conditional on non-tie decision)
  const { normalized, overround, method } = removeMarginProportional([homeRaw, awayRaw]);
  const homeNoVig = Number(normalized[0].toFixed(4));
  const awayNoVig = Number(normalized[1].toFixed(4));

  const homeEv = expectedValuePerUnit({
    pWin: modelHomeWinProb,
    pLoss: modelAwayWinProb,
    pPush: modelTieProb,
    decimalOdds: homeDec
  });
  const awayEv = expectedValuePerUnit({
    pWin: modelAwayWinProb,
    pLoss: modelHomeWinProb,
    pPush: modelTieProb,
    decimalOdds: awayDec
  });

  let note = "No positive expected value at current price.";
  if (homeEv >= 0.02 || awayEv >= 0.02) {
    const side = homeEv >= awayEv ? "Home" : "Away";
    const bestEv = Math.max(homeEv, awayEv) * 100;
    note = `${side} price shows +${bestEv.toFixed(1)}% expected value (before uncertainty shrinkage). Compare against model probability independently of win likelihood.`;
  } else if (Math.max(homeEv, awayEv) > -0.02) {
    note = "Market price is approximately aligned with model fair probability.";
  }

  return {
    available: true,
    sportsbook: snapshot.sportsbook,
    marketType: snapshot.marketType,
    period: snapshot.period,
    settlementRulesVersion: snapshot.settlementRulesVersion,
    capturedUtc: snapshot.capturedUtc,
    isUserSupplied: snapshot.isUserSupplied,
    isMarketInformedModel: params.isMarketInformedModel,
    homeAmericanOdds: snapshot.homePriceAmerican,
    awayAmericanOdds: snapshot.awayPriceAmerican,
    homeDecimalOdds: homeDec,
    awayDecimalOdds: awayDec,
    homeRawImpliedProb: Number(homeRaw.toFixed(4)),
    awayRawImpliedProb: Number(awayRaw.toFixed(4)),
    overroundPct: Number((overround * 100).toFixed(2)),
    homeNoVigApproxProb: homeNoVig,
    awayNoVigApproxProb: awayNoVig,
    noVigMethodLabel: `${method} (approximation; excludes tie vig when 2-way)`,
    homeExpectedValuePerUnit: Number(homeEv.toFixed(4)),
    awayExpectedValuePerUnit: Number(awayEv.toFixed(4)),
    spreadLine: snapshot.line,
    totalLine: null,
    recommendedMarketNote: note
  };
}
