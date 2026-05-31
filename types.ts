
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
  league?: League;
  
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
  
  // MLB-Specific Mathematical Projection Fields
  pitcherK9?: number;          // Pitcher K/9
  oppKRate?: number;           // Opponent K rate (decimal, e.g. 0.22)
  avgIpLast5?: number;         // Pitcher average IP last 5 starts
  isBullpenGame?: boolean;     // Flag for bullpen game
  pitchCountLimitFactor?: number; // Pitch count limit multiplier (e.g. 0.9)
  parkFactor?: number;         // Park adjustment factor (e.g. 1.05)
  parkHrFactor?: number;       // Park home run factor
  parkRunFactor?: number;      // Park run factor
  handednessAdjustment?: number; // Platoon/handedness adjustment
  umpireKRate?: number;        // Umpire historical K tendencies factor (e.g. 1.03)
  homeAwayFactor?: number;     // Pitcher K% home/away factor
  xBA?: number;                // Statcast Expected Batting Average (e.g. 0.265)
  iso?: number;                // Isolated Power SLG - AVG (e.g. 0.185)
  oppPitcherEraPlus?: number;  // Opposing pitcher ERA+ (e.g. 105)
  platoonFactor?: number;      // Platoon split (e.g. 1.12)
  lineupSpot?: number;         // Batting lineup spot 1-9
  teamPace?: number;           // Team pace / plate apps speed
  oppSpQuality?: number;       // Starting pitcher quality
  oppPitcherH9Factor?: number; // Opposing pitcher Hits per 9 multiplier
  babipLuckAdjustment?: number; // Player BABIP deviation (regress down if positive, up if negative)
  xFip?: number;               // Expected FIP (e.g. 3.85)
  oppWrcPlus?: number;         // Opponent wRC+ (e.g. 110)
  bbPct?: number;              // Batter walk rate (e.g. 0.085)
  projectedPA?: number;        // Projected plate appearances (e.g. 4.2)
  
  // NFL-Specific Mathematical Model Fields
  avgPassYardsL5?: number;
  seasonAvgPassYards?: number;
  oppPassYardsAllowed?: number;
  paceBonusMultiplier?: number;
  gameScriptMultiplier?: number;
  weatherFactor?: number;
  qbTdRate?: number;
  qbIntRate?: number;
  qbAttemptsAvg?: number;
  rzOppRate?: number;
  oppPosTdRate?: number;
  oppPassFunnel?: number;
  impliedGameTotal?: number;
  spreadPoints?: number;
  
  missingWR?: boolean;
  domeToColdOutdoor?: boolean;
  windSpeedMph?: number;
  offBye?: boolean;
  shortWeek?: boolean;
  facingManCoverage?: boolean;
  
  carriesProjection?: number;
  avgYpc?: number;
  olineRunBlockRank?: number; // 1-32
  rbRole?: 'workhorse' | 'committee' | 'third_down';
  isHandcuff?: boolean;
  teamRushTendency?: number;
  
  targetSharePct?: number;
  teamProjPassAttempts?: number;
  avgYpt?: number;
  oppCoverageGrade?: number;
  separationRate?: number;
  routeConcept?: 'deep' | 'intermediate' | 'short';
  catchRatePct?: number;
  
  rzTargetSharePct?: number;
  teamRzTrips?: number;
  playerRzTdRate?: number;
  oppRzTdAllowedRate?: number;
  
  isDivisional?: boolean;
  isPlayoffAtmosphere?: boolean;
  
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
