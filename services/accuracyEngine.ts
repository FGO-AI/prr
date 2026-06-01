import { BetLeg, League } from "../types";

export interface CategoryAccuracy {
  category: string;
  total: number;
  hits: number;
  misses: number;
  hitRate: number;
  avgClv: number;
  clvCount: number;
  roi: number;
}

export interface SportAccuracy {
  sport: League;
  total: number;
  hits: number;
  misses: number;
  hitRate: number;
  avgClv: number;
  clvCount: number;
  roi: number;
  categories: Record<string, CategoryAccuracy>;
}

export interface ModelAccuracyReport {
  overall: {
    total: number;
    hits: number;
    misses: number;
    hitRate: number;
    avgClv: number;
    clvCount: number;
    roi: number;
    rating: string;
    description: string;
  };
  bySport: Record<League, SportAccuracy>;
}

/**
 * Calculates CLV (Closing Line Value) for a single leg:
 * If prediction is 'Over', locking a lower line is positive (CLV = Closing - Locked).
 * If prediction is 'Under', locking a higher line is positive (CLV = Locked - Closing).
 */
export function calculateLegCLV(leg: BetLeg): number | null {
  if (leg.closingLine === undefined || leg.closingLine === null) {
    return null;
  }
  
  const lockedLine = leg.line;
  const closingLine = leg.closingLine;
  const isOver = leg.prediction.toLowerCase() === "over";

  if (isOver) {
    return closingLine - lockedLine;
  } else {
    return lockedLine - closingLine;
  }
}

/**
 * Derives the model's professional grade based on Hit Rate and Closing Line accuracy.
 */
export function determineModelGrade(hitRate: number, avgClv: number, roi: number, count: number): { grade: string; description: string } {
  if (count === 0) {
    return {
      grade: "N/A",
      description: "Insufficient settlement data. Lock and verify outcomes to kick off audit."
    };
  }

  // Composited evaluation
  if (hitRate >= 56.5) {
    if (avgClv > 0) {
      return { grade: "A+", description: "Supernatural Model Edge. Dominating sportsbooks at standard and alternative lines." };
    }
    return { grade: "A", description: "Ultra Elite. High probability outcomes consistently yielding positive returns." };
  } else if (hitRate >= 54.0) {
    return { grade: "A-", description: "Elite level performance. Solid win/loss margin exceeding -110 break-even juice." };
  } else if (hitRate >= 52.3) {
    return { grade: "B", description: "Consistent Profit. Capturing positive expected value across high-volume lines." };
  } else if (hitRate >= 50.0) {
    if (avgClv >= 0.1) {
      return { grade: "C+", description: "Break-even with Positive CLV. Markets adjusting to model projections. Profit imminent." };
    }
    return { grade: "C", description: "Market Neutral. Floating near coin-flip metrics. Fine-tune advanced filters." };
  } else if (hitRate >= 47.0) {
    return { grade: "D", description: "Negative Equity. Exposed to market juice. Consider utilizing Underdog/PrizePicks insurance modes." };
  } else {
    return { grade: "F", description: "System Noise. Model over-index or local variations current. Review underlying features." };
  }
}

/**
 * Generates audit reports analyzing accuracy across all stored pick records.
 */
export function compileAccuracyReport(legs: BetLeg[]): ModelAccuracyReport {
  const settledLegs = legs.filter(l => l.settledStatus === "Hit" || l.settledStatus === "Miss");
  
  let overallHits = 0;
  let overallMisses = 0;
  let overallClvSum = 0;
  let overallClvCount = 0;

  const sportAccuracies: Record<League, SportAccuracy> = {
    [League.NBA]: { sport: League.NBA, total: 0, hits: 0, misses: 0, hitRate: 0, avgClv: 0, clvCount: 0, roi: 0, categories: {} },
    [League.NFL]: { sport: League.NFL, total: 0, hits: 0, misses: 0, hitRate: 0, avgClv: 0, clvCount: 0, roi: 0, categories: {} },
    [League.MLB]: { sport: League.MLB, total: 0, hits: 0, misses: 0, hitRate: 0, avgClv: 0, clvCount: 0, roi: 0, categories: {} }
  };

  settledLegs.forEach(leg => {
    // Determine sport
    const sport = leg.league || League.NBA;
    const isHit = leg.settledStatus === "Hit";

    // Initialize category if needed
    const statCat = leg.statType || "Other";
    if (!sportAccuracies[sport].categories[statCat]) {
      sportAccuracies[sport].categories[statCat] = {
        category: statCat,
        total: 0,
        hits: 0,
        misses: 0,
        hitRate: 0,
        avgClv: 0,
        clvCount: 0,
        roi: 0
      };
    }

    const cat = sportAccuracies[sport].categories[statCat];

    // Compute basic totals
    if (isHit) {
      overallHits++;
      sportAccuracies[sport].hits++;
      cat.hits++;
    } else {
      overallMisses++;
      sportAccuracies[sport].misses++;
      cat.misses++;
    }

    overallClvCount++; // Total legs available

    // CLV checks
    const clvVal = calculateLegCLV(leg);
    if (clvVal !== null) {
      overallClvSum += clvVal;
      overallClvCount++;
      
      sportAccuracies[sport].clvCount++;
      sportAccuracies[sport].avgClv += clvVal;

      cat.clvCount++;
      cat.avgClv += clvVal;
    }

    sportAccuracies[sport].total++;
    cat.total++;
  });

  // Calculate final ratios for details
  const overallTotal = overallHits + overallMisses;
  const overallHitRate = overallTotal > 0 ? (overallHits / overallTotal) * 100 : 0;
  
  // Flat profit model: stake $100 per outcome leg @ standard American odds of -110
  // Profit per hit = $100 * (100 / 110) = $90.91
  // Cost per miss = -$100
  const overallRoi = overallTotal > 0 
    ? ((overallHits * 90.91 - overallMisses * 100) / (overallTotal * 100)) * 100 
    : 0;

  const finalOverallClv = overallClvCount > 0 ? (overallClvSum / overallClvCount) : 0;
  const { grade, description } = determineModelGrade(overallHitRate, finalOverallClv, overallRoi, overallTotal);

  Object.values(sportAccuracies).forEach(sp => {
    const spTotal = sp.hits + sp.misses;
    sp.hitRate = spTotal > 0 ? (sp.hits / spTotal) * 100 : 0;
    sp.avgClv = sp.clvCount > 0 ? (sp.avgClv / sp.clvCount) : 0;
    sp.roi = spTotal > 0 ? ((sp.hits * 90.91 - sp.misses * 100) / (spTotal * 100)) * 100 : 0;

    Object.values(sp.categories).forEach(cat => {
      const catTotal = cat.hits + cat.misses;
      cat.hitRate = catTotal > 0 ? (cat.hits / catTotal) * 100 : 0;
      cat.avgClv = cat.clvCount > 0 ? (cat.avgClv / cat.clvCount) : 0;
      cat.roi = catTotal > 0 ? ((cat.hits * 90.91 - cat.misses * 100) / (catTotal * 100)) * 100 : 0;
    });
  });

  return {
    overall: {
      total: overallTotal,
      hits: overallHits,
      misses: overallMisses,
      hitRate: overallHitRate,
      avgClv: finalOverallClv,
      clvCount: overallClvCount,
      roi: overallRoi,
      rating: grade,
      description
    },
    bySport: sportAccuracies
  };
}
