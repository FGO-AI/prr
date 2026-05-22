
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

export enum BettingApp {
  ALL = 'All Apps',
  CHALKBOARD = 'Chalkboard',
  UNDERDOG = 'Underdog Fantasy',
  PRIZEPICKS = 'PrizePicks',
  FANDUEL = 'FanDuel',
  DRAFTKINGS = 'DraftKings',
  BETMGM = 'BetMGM',
  CAESARS = 'Caesars'
}

export interface GameLogEntry {
  date: string;
  opponent: string;
  value: number;
  minutes: number;
  hit: boolean;
}

export interface BetLeg {
  playerId: string;
  playerName: string;
  team: string;
  opponent: string;
  statType: string;
  category?: 'Primary' | 'Alternate' | 'Combo' | 'Defense';
  isAltLine?: boolean;
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
  recentGames?: GameLogEntry[];
  
  // Historical Settlement
  actualValue?: number;
  settledStatus?: 'Pending' | 'Hit' | 'Miss' | 'Void';
  
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
  marketSentiment?: string;
  correlationInsight?: string;
  gameTime?: string;
  gameDate?: string;
  dataSource?: string;
  lastUpdated?: string;
  historicalInfluence?: string;
  
  marketOdds?: {
    fanDuel?: number;
    draftKings?: number;
    betMGM?: number;
    pinnacle?: number;
    caesars?: number;
  };
  
  correlations?: {
    playerName: string;
    statType: string;
    coefficient: number;
    rationale: string;
  }[];
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
  rankingJustification?: string;
  timestamp: string;
  roiPotential?: number;
  isUserGenerated?: boolean;
}

export enum SubscriptionTier {
  FREE = 'Free',
  PRO = 'Pro',
  WHALE = 'Whale'
}

export interface User {
  id: string;
  email?: string;
  name?: string;
  type: 'email' | 'access_code';
  tier: SubscriptionTier;
  spinsRemaining?: number;
  lastSpinResetDate?: string;
}

export interface UserInputState {
  league: League;
  riskLevel: RiskLevel;
  bankroll: number;
  filters: string;
  statType: string;
  advancedMetric: string;
  selectedApp: BettingApp;
}
