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
  statType: string;
  line: number;
  prediction: 'Over' | 'Under';
  bookOdds: number;
  modelProb: number;
  impliedProb: number;
  edge: number;
  rationale: string;
  injuryStatus?: string;
  leagueAvg?: number;
  recentHitRate?: string;
  
  // New Engine Variables
  x10?: number;
  x20?: number;
  xSeason?: number;
  sigma?: number;
  expectedMins?: number;
  avgMins?: number;
  expectedPace?: number;
  leaguePace?: number;
  oppAllowed?: number;
  leagueAllowed?: number;
  muFinal?: number;
  zScore?: number;
}

export interface ParlayRecommendation {
  type?: 'parlay' | 'player_profile';
  id: string;
  legs: BetLeg[];
  totalOdds: number;
  jointProbAdjusted: number;
  expectedValue: number;
  kellyStake: number;
  correlationScore: number;
  varianceScore: number;
  summary: string;
  timestamp: string;
  roiPotential?: number;
}

export interface UserInputState {
  league: League;
  riskLevel: RiskLevel;
  bankroll: number;
  filters: string;
  statType: string;
  advancedMetric: string;
}