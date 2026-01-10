export enum League {
  NFL = 'NFL',
  NBA = 'NBA',
  MLB = 'MLB'
}

export enum RiskLevel {
  VERY_LOW = 'Safe (High Probability)',
  LOW = 'Conservative (Positive EV)',
  MEDIUM = 'Balanced (Standard)',
  HIGH = 'Aggressive (High Return)',
  VERY_HIGH = 'Moonshot (Extreme Odds)'
}

export interface BetLeg {
  playerId: string;
  playerName: string;
  team: string;
  opponent: string;
  statType: string; // e.g., "Points", "Rebounds", "Passing Yards"
  line: number;
  prediction: 'Over' | 'Under';
  bookOdds: number; // American odds, e.g., -110
  modelProb: number; // 0.0 to 1.0
  impliedProb: number; // 0.0 to 1.0
  edge: number; // Percentage points
  rationale: string;
  injuryStatus?: string; // e.g. "Active", "Probable", "Questionable", "GTD"
  leagueAvg?: number; // Comparison baseline
  recentHitRate?: string; // e.g. "8/10"
}

export interface ParlayRecommendation {
  type?: 'parlay' | 'player_profile'; // Discriminator for UI rendering
  id: string;
  legs: BetLeg[];
  totalOdds: number; // American odds, e.g., +260
  jointProbAdjusted: number; // Correlation adjusted probability
  expectedValue: number; // EV %
  kellyStake: number; // Recommended bankroll %
  correlationScore: number; // 0 to 1, how correlated the plays are
  varianceScore: number; // High variance = high risk
  summary: string;
  timestamp: string;
}

export interface UserInputState {
  league: League;
  riskLevel: RiskLevel;
  bankroll: number;
  filters: string;
  statType: string;
  advancedMetric: string;
}