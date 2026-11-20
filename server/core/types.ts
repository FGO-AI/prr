export type LeagueCode = 'NFL' | 'NBA' | 'MLB';

export type CompetitionPhase = 'preseason' | 'regular' | 'postseason' | 'playin' | 'unknown';

export type GameStatus =
  | 'scheduled'
  | 'in_progress'
  | 'final'
  | 'postponed'
  | 'rescheduled'
  | 'canceled'
  | 'suspended';

export type DataStatus =
  | 'confirmed'
  | 'projected'
  | 'estimated'
  | 'missing'
  | 'stale'
  | 'not_applicable';

export type ImplementationStatus =
  | 'implemented_validated'
  | 'implemented_unvalidated'
  | 'experimental'
  | 'unavailable'
  | 'not_applicable'
  | 'excluded';

export interface ProvenancedValue<T> {
  value: T | null;
  units: string;
  source: string;
  sourcePublishedUtc: string | null;
  eventTimeUtc: string;
  ingestedUtc: string;
  earliestKnownUtc: string;
  status: DataStatus;
  notes?: string;
}

export interface VenueMetadata {
  venueId: string;
  name: string;
  teamAbbr: string;
  league: LeagueCode;
  city: string;
  state: string;
  timezone: string;
  lat: number;
  lon: number;
  altitudeFt: number;
  roofType: 'outdoor' | 'retractable' | 'dome' | 'indoor';
  surface: 'grass' | 'turf' | 'hardwood';
  /** Azimuth in degrees (0 = North, 90 = East) from home plate to center field (MLB only) */
  cfAzimuthDeg?: number;
  /** 100-neutral park index (relative multiplier = index / 100) */
  parkRunIndex100?: number;
  parkHrIndex100?: number;
  parkIndexType?: 'relative' | 'absolute';
  parkSeason?: number;
}

export interface CanonicalGame {
  gameId: string;
  league: LeagueCode;
  season: number;
  competitionPhase: CompetitionPhase;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamAbbr: string;
  awayTeamAbbr: string;
  venueId: string;
  venueName: string;
  venueTimezone: string;
  scheduledStartUtc: string;
  neutralSite: boolean;
  doubleheaderGameNum: number | null;
  status: GameStatus;
  homeScore: number | null;
  awayScore: number | null;
  wentOvertime: boolean;
  overtimePeriods: number;
  isTie: boolean;
  rescheduledFromUtc: string | null;
  providerIds: Record<string, string>;
}

export interface PlayerAvailabilityRecord {
  playerId: string;
  playerName: string;
  teamAbbr: string;
  position: string;
  role: 'starter' | 'key_rotation' | 'depth' | 'qb1' | 'qb2' | 'sp' | 'rp' | 'closer' | 'lineup';
  /** NFL separates practice status from official game designation */
  practiceStatus?: 'DNP' | 'LP' | 'FP' | 'UNKNOWN' | null;
  gameDesignation?: 'Out' | 'Doubtful' | 'Questionable' | 'Probable' | 'Active' | 'IR' | 'Suspended' | 'Personal' | 'Rest' | 'Day-To-Day' | null;
  injuryOrReason: string;
  confirmedParticipationProb: number | null;
  expectedWorkloadPct: number;
  replacementName?: string;
  replacementDropoffPoints: number;
  alreadyReflectedInBaselinePct: number;
  source: string;
  sourcePublishedUtc: string | null;
  ingestedUtc: string;
  status: DataStatus;
}

export interface AvailabilityScenario {
  scenarioId: string;
  label: string;
  probability: number; // q_s >= 0, sum(q_s) = 1
  description: string;
  conditionalHomeWinProb: number; // p_s
  conditionalAwayWinProb: number;
  conditionalTieProb: number;
  conditionalMargin: number;
  conditionalTotal: number | null;
  lineupSummary: string[];
  workloadNotes: string[];
}

export interface WeatherForecastVintage {
  forecastId: string;
  gameId: string;
  venueId: string;
  source: string;
  issuedUtc: string;
  validUtc: string;
  ingestedUtc: string;
  tempF: number | null;
  windMph: number | null;
  windGustMph: number | null;
  windDirDeg: number | null;
  precipProb: number | null;
  precipIn: number | null;
  roofStatus: 'open' | 'closed' | 'dome' | 'indoor' | 'unknown';
  surface: string;
  altitudeFt: number;
  airDensityIndex: number | null; // 1.00 = sea level 70F
  delayRiskScore: number | null;
  status: DataStatus;
  shortForecast?: string;
}

export interface MarketSnapshot {
  oddsId: string;
  gameId: string;
  league: LeagueCode;
  sportsbook: string;
  marketType: 'h2h' | 'spread' | 'total' | '1h_h2h';
  period: 'full_game' | 'first_half' | 'regulation';
  line: number | null;
  homePriceAmerican: number | null;
  awayPriceAmerican: number | null;
  drawPriceAmerican?: number | null;
  overPriceAmerican: number | null;
  underPriceAmerican: number | null;
  homeDecimal: number | null;
  awayDecimal: number | null;
  settlementRulesVersion: string;
  capturedUtc: string;
  source: string;
  isUserSupplied: boolean;
  status: DataStatus;
}

export interface MarketPricingAnalysis {
  available: boolean;
  reasonIfUnavailable?: string;
  sportsbook: string | null;
  marketType: string;
  period: string;
  settlementRulesVersion: string;
  capturedUtc: string | null;
  isUserSupplied: boolean;
  isMarketInformedModel: boolean;
  homeAmericanOdds: number | null;
  awayAmericanOdds: number | null;
  homeDecimalOdds: number | null;
  awayDecimalOdds: number | null;
  homeRawImpliedProb: number | null;
  awayRawImpliedProb: number | null;
  overroundPct: number | null;
  /** Proportional normalization approximation: q_i = r_i / sum(r_j) */
  homeNoVigApproxProb: number | null;
  awayNoVigApproxProb: number | null;
  noVigMethodLabel: string;
  homeExpectedValuePerUnit: number | null;
  awayExpectedValuePerUnit: number | null;
  spreadLine: number | null;
  totalLine: number | null;
  recommendedMarketNote: string;
}

export interface TravelRestMetrics {
  homeRestDays: number | null;
  awayRestDays: number | null;
  homeIsB2B: boolean;
  awayIsB2B: boolean;
  homeShortWeek: boolean;
  awayShortWeek: boolean;
  homeOffBye: boolean;
  awayOffBye: boolean;
  awayTravelMilesFromPrev: number | null;
  homeTravelMilesFromPrev: number | null;
  awayTimezonesCrossed: number | null;
  awayTravelDirection: 'eastbound' | 'westbound' | 'neutral' | 'unknown';
  awayRoadTripGameNum: number | null;
  arrivalTimingStatus: 'unknown' | 'confirmed';
  scheduleDensityLast7DaysHome: number | null;
  scheduleDensityLast7DaysAway: number | null;
  status: DataStatus;
}

export interface RotationEntry {
  playerName: string;
  position: string;
  projectedMinutes: number;
  baselineMinutes: number;
  role: string;
  status: DataStatus;
}

export interface PitchingPlanEntry {
  role: 'starter' | 'setup' | 'closer' | 'bulk_bullpen';
  pitcherName: string;
  projectedInnings: number;
  fip: number | null;
  k9: number | null;
  bb9: number | null;
  recentPitchCount3d: number | null;
  availabilityStatus: DataStatus;
}

export interface FeatureRegistryEntry {
  featureId: string;
  name: string;
  factorIds: string[];
  leagueApplicability: LeagueCode[];
  definition: string;
  units: string;
  source: string;
  sampleSize: string;
  lookback: string;
  normalization: string;
  missingDataPolicy: string;
  interactions: string[];
  higherIsFavorableFor: 'home' | 'away' | 'context_dependent' | 'neutral';
  kind: 'observation' | 'model_derived_estimate';
  version: string;
}

export interface CoverageMatrixEntry {
  factorId: string;
  category: 'Shared' | 'NFL' | 'NBA' | 'MLB' | 'WeakSignal';
  name: string;
  dataSource: string;
  definition: string;
  units: string;
  timing: string;
  implementationLocation: string;
  status: ImplementationStatus;
  validationEvidence: string;
  remainingDependency: string;
}

export interface ModelDriver {
  factorId: string;
  name: string;
  impactOnHomeWinProb: number; // additive log-odds or probability delta explanation
  impactOnMargin: number;
  direction: 'home' | 'away' | 'neutral';
  evidenceSource: string;
  status: DataStatus;
  explanation: string;
}

export interface PredictionSnapshotOutput {
  predictionId: string;
  versionNum: number;
  snapshotId: string;
  game: CanonicalGame;
  cutoffUtc: string;
  createdUtc: string;
  forecastStatus: 'confirmed' | 'provisional' | 'withheld';
  provisionalReasons: string[];
  featureRegistryVersion: string;
  modelVersion: string;
  calibrationVersion: string;
  rulesVersion: string;
  isMarketInformed: boolean;

  // Exhaustive Outcome Probabilities (sum to 1.0)
  homeWinProb: number;
  awayWinProb: number;
  tieProb: number; // 0 for NBA/MLB, >0 for NFL regular season

  // Evaluated vs Unevaluated secondary targets
  projectedMargin: number | null; // Home - Away
  projectedHomeScore: number | null;
  projectedAwayScore: number | null;
  projectedTotal: number | null;
  marginEvaluated: boolean;
  totalEvaluated: boolean;
  uncertaintySigmaMargin: number | null;

  // Availability Scenarios (P(win) = sum q_s * p_s)
  scenarios: AvailabilityScenario[];
  absencesAndReplacements: PlayerAvailabilityRecord[];

  // League-specific structured coherence
  nbaRotations?: {
    homeMinutesTotal: number;
    awayMinutesTotal: number;
    homeRotation: RotationEntry[];
    awayRotation: RotationEntry[];
    feasible: boolean;
  };
  mlbPitchingPlan?: {
    homeInningsTotal: number;
    awayInningsTotal: number;
    homeStaff: PitchingPlanEntry[];
    awayStaff: PitchingPlanEntry[];
    homeLineupConfirmed: boolean;
    awayLineupConfirmed: boolean;
  };
  nflMatchupContext?: {
    epaDefinition: string;
    successRateDefinition: string;
    homeOffEpaPerPlay: number | null;
    awayOffEpaPerPlay: number | null;
    homeDefEpaPerPlay: number | null;
    awayDefEpaPerPlay: number | null;
    olVsPassRushInteractionHome: number | null;
    olVsPassRushInteractionAway: number | null;
  };

  // Context & Freshness
  travelRest: TravelRestMetrics;
  weather: WeatherForecastVintage | null;
  venue: VenueMetadata | null;
  dataCompleteness: {
    confirmedCount: number;
    projectedCount: number;
    estimatedCount: number;
    missingCount: number;
    staleCount: number;
    notApplicableCount: number;
    essentialMissing: string[];
    freshnessLabel: 'Fresh' | 'Partially Stale' | 'Incomplete / Provisional';
  };

  // Market & Pricing Module (strictly separated from model probability)
  marketPricing: MarketPricingAnalysis;

  // Model-backed drivers (only from features actually used)
  topDrivers: ModelDriver[];
  leagueNotes: string[];
  previousVersions: Array<{
    predictionId: string;
    versionNum: number;
    createdUtc: string;
    homeWinProb: number;
    awayWinProb: number;
    tieProb: number;
    forecastStatus: string;
  }>;
}
