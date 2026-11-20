import React, { useState, useEffect, useMemo } from 'react';
import {
  Cpu, Target, RefreshCw, ChevronDown, AlertCircle,
  TrendingUp, Trophy, Sliders, Crown, Activity, Clock,
  Cloud, MapPin, Layers, Shield, Scale, History
} from 'lucide-react';
import { League } from '../types';

interface EdgeFactor {
  factor: string;
  description: string;
  edgeSide?: string;
}

interface AvailabilityScenarioUI {
  scenarioId: string;
  label: string;
  probability: number;
  description: string;
  conditionalHomeWinProb: number;
  conditionalAwayWinProb: number;
  conditionalTieProb: number;
  conditionalMargin: number;
  conditionalTotal: number | null;
  lineupSummary: string[];
  workloadNotes: string[];
}

interface PlayerAvailabilityUI {
  playerId: string;
  playerName: string;
  teamAbbr: string;
  position: string;
  role: string;
  practiceStatus?: string | null;
  gameDesignation?: string | null;
  injuryOrReason: string;
  confirmedParticipationProb: number | null;
  expectedWorkloadPct: number;
  replacementName?: string;
  replacementDropoffPoints: number;
  alreadyReflectedInBaselinePct: number;
  status: string;
}

interface RotationEntryUI {
  playerName: string;
  position: string;
  projectedMinutes: number;
  baselineMinutes: number;
  role: string;
  status: string;
}

interface PitchingPlanEntryUI {
  role: string;
  pitcherName: string;
  projectedInnings: number;
  fip: number | null;
  k9: number | null;
  bb9: number | null;
  availabilityStatus: string;
}

interface MarketPricingUI {
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
  homeNoVigApproxProb: number | null;
  awayNoVigApproxProb: number | null;
  noVigMethodLabel: string;
  homeExpectedValuePerUnit: number | null;
  awayExpectedValuePerUnit: number | null;
  spreadLine: number | null;
  totalLine: number | null;
  recommendedMarketNote: string;
}

interface EngineSnapshotUI {
  predictionId: string;
  versionNum: number;
  snapshotId: string;
  game: {
    gameId: string;
    league: string;
    season: number;
    competitionPhase: string;
    homeTeamName: string;
    awayTeamName: string;
    homeTeamAbbr: string;
    awayTeamAbbr: string;
    venueName: string;
    venueTimezone: string;
    scheduledStartUtc: string;
    neutralSite: boolean;
    doubleheaderGameNum: number | null;
    status: string;
  };
  cutoffUtc: string;
  createdUtc: string;
  forecastStatus: 'confirmed' | 'provisional' | 'withheld';
  provisionalReasons: string[];
  featureRegistryVersion: string;
  modelVersion: string;
  calibrationVersion: string;
  rulesVersion: string;
  isMarketInformed: boolean;
  homeWinProb: number;
  awayWinProb: number;
  tieProb: number;
  projectedMargin: number | null;
  projectedHomeScore: number | null;
  projectedAwayScore: number | null;
  projectedTotal: number | null;
  marginEvaluated: boolean;
  totalEvaluated: boolean;
  uncertaintySigmaMargin: number | null;
  scenarios: AvailabilityScenarioUI[];
  absencesAndReplacements: PlayerAvailabilityUI[];
  nbaRotations?: {
    homeMinutesTotal: number;
    awayMinutesTotal: number;
    homeRotation: RotationEntryUI[];
    awayRotation: RotationEntryUI[];
    feasible: boolean;
  };
  mlbPitchingPlan?: {
    homeInningsTotal: number;
    awayInningsTotal: number;
    homeStaff: PitchingPlanEntryUI[];
    awayStaff: PitchingPlanEntryUI[];
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
  travelRest: {
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
    awayTravelDirection: string;
    awayRoadTripGameNum: number | null;
    arrivalTimingStatus: 'unknown' | 'confirmed';
    scheduleDensityLast7DaysHome: number | null;
    scheduleDensityLast7DaysAway: number | null;
    status: string;
  };
  weather: {
    source: string;
    issuedUtc: string;
    validUtc: string;
    tempF: number | null;
    windMph: number | null;
    windDirDeg: number | null;
    precipProb: number | null;
    roofStatus: string;
    surface: string;
    altitudeFt: number;
    airDensityIndex: number | null;
    delayRiskScore: number | null;
    status: string;
    shortForecast?: string;
  } | null;
  venue: {
    name: string;
    city: string;
    state: string;
    roofType: string;
    surface: string;
    altitudeFt: number;
    parkRunIndex100?: number;
    parkHrIndex100?: number;
    parkIndexType?: string;
    parkSeason?: number;
  } | null;
  dataCompleteness: {
    confirmedCount: number;
    projectedCount: number;
    estimatedCount: number;
    missingCount: number;
    staleCount: number;
    notApplicableCount: number;
    essentialMissing: string[];
    freshnessLabel: string;
  };
  marketPricing: MarketPricingUI;
  topDrivers: Array<{
    factorId: string;
    name: string;
    impactOnHomeWinProb: number;
    impactOnMargin: number;
    direction: 'home' | 'away' | 'neutral';
    evidenceSource: string;
    status: string;
    explanation: string;
  }>;
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

interface GamePredictionData {
  homeTeam: string;
  awayTeam: string;
  sport?: string;
  homeNetRtg?: number | null;
  awayNetRtg?: number | null;
  injuryReport: string[];
  projectedMargin: number;
  bookSpread: number;
  projectedTotal?: number | null;
  edgePoints: number;
  edgeCategory: string;
  recommendedPick: string;
  confidence: number;
  projectedHomeWinProb: number;
  projectedAwayWinProb: number;
  projectedTieProb?: number;
  projectedHomeML: number;
  projectedAwayML: number;
  bookHomeML: number | null;
  bookAwayML: number | null;
  mlEdgeTeam: string;
  mlEdgePct: number;
  mlEdgeCategory: string;
  edgeTeam?: string;
  winningTeam?: string;
  winningChancePct?: number;
  edgeReason?: string;
  edgeFactors?: EdgeFactor[];
  engineSnapshot?: EngineSnapshotUI;
}

interface MatchupItem {
  id: string;
  homeTeam: string;
  awayTeam: string;
  gameTime: string;
  utcStart?: string;
  localStart?: string;
  venueName?: string;
  venueTimezone?: string;
  neutralSite?: boolean;
  doubleheaderGameNum?: number | null;
  status?: string;
  competitionPhase?: string;
  bookSpread: number;
  bookTotal: number;
  bookHomeML?: number;
  bookAwayML?: number;
  hasLiveMarketOdds?: boolean;
  homeProbablePitcher?: string | null;
  awayProbablePitcher?: string | null;
}

function formatPct(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

function formatAmerican(ml: number | null | undefined): string {
  if (ml === null || ml === undefined || !Number.isFinite(ml)) return 'N/A';
  return ml > 0 ? `+${ml}` : `${ml}`;
}

function getStatusBadgeClass(status: string): string {
  if (status === 'confirmed') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  if (status === 'projected' || status === 'estimated') return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
  if (status === 'stale' || status === 'provisional') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  if (status === 'not_applicable') return 'bg-gray-800 text-gray-400 border-gray-700';
  return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
}

export const GameOutcomePredictor: React.FC = () => {
  const [selectedLeague, setSelectedLeague] = useState<League>(League.NBA);
  const [showFormulaParams, setShowFormulaParams] = useState<boolean>(false);
  const [matchups, setMatchups] = useState<MatchupItem[]>([]);
  const [selectedMatchupId, setSelectedMatchupId] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(false);

  // Team / Optional User Odds Inputs
  const [customHome, setCustomHome] = useState<string>('Boston Celtics');
  const [customAway, setCustomAway] = useState<string>('Los Angeles Lakers');
  const [useCustomOdds, setUseCustomOdds] = useState<boolean>(false);
  const [bookSpread, setBookSpread] = useState<number>(-4.5);
  const [bookTotal, setBookTotal] = useState<number>(222.0);
  const [bookHomeML, setBookHomeML] = useState<string>('');
  const [bookAwayML, setBookAwayML] = useState<string>('');

  // Optional Scenario Tuning Overrides (passed only when panel toggled or user modifies)
  const [isB2B, setIsB2B] = useState<boolean>(false);
  const [restDifference, setRestDifference] = useState<number>(0);
  const [missingStarHome, setMissingStarHome] = useState<boolean>(false);
  const [missingStarAway, setMissingStarAway] = useState<boolean>(false);
  const [isPlayoff, setIsPlayoff] = useState<boolean>(false);

  const [isBackupQBHome, setIsBackupQBHome] = useState<boolean>(false);
  const [isBackupQBAway, setIsBackupQBAway] = useState<boolean>(false);
  const [isOffByeHome, setIsOffByeHome] = useState<boolean>(false);
  const [isOffByeAway, setIsOffByeAway] = useState<boolean>(false);
  const [isShortWeekHome, setIsShortWeekHome] = useState<boolean>(false);
  const [isShortWeekAway, setIsShortWeekAway] = useState<boolean>(false);
  const [weatherWindNFL, setWeatherWindNFL] = useState<number>(8);

  const [ballparkRunFactor, setBallparkRunFactor] = useState<number>(1.0);
  const [windSpeed, setWindSpeed] = useState<number>(5);

  const [isPredicting, setIsPredicting] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<GamePredictionData | null>(null);
  const [versionsList, setVersionsList] = useState<EngineSnapshotUI[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');

  useEffect(() => {
    setPrediction(null);
    setVersionsList([]);
    setSelectedVersionId('');
    setErrorMsg(null);
    fetchMatchups(selectedLeague);

    if (selectedLeague === League.NFL) {
      setCustomHome('Kansas City Chiefs');
      setCustomAway('Buffalo Bills');
    } else if (selectedLeague === League.MLB) {
      setCustomHome('New York Yankees');
      setCustomAway('Boston Red Sox');
    } else {
      setCustomHome('Boston Celtics');
      setCustomAway('Los Angeles Lakers');
    }
  }, [selectedLeague]);

  const fetchMatchups = async (sport: League = selectedLeague) => {
    try {
      const res = await fetch(`/api/games/${sport}`);
      if (res.ok) {
        const data: MatchupItem[] = await res.json();
        setMatchups(data);
        if (data.length > 0) {
          const first = data[0];
          setSelectedMatchupId(first.id);
          setBookSpread(first.bookSpread);
          setBookTotal(first.bookTotal);
          setBookHomeML(first.hasLiveMarketOdds && first.bookHomeML !== undefined ? String(first.bookHomeML) : '');
          setBookAwayML(first.hasLiveMarketOdds && first.bookAwayML !== undefined ? String(first.bookAwayML) : '');
          setUseCustomOdds(Boolean(first.hasLiveMarketOdds));
        } else {
          setSelectedMatchupId('');
          setBookSpread(sport === League.MLB ? -1.5 : sport === League.NFL ? -3.0 : -4.5);
          setBookTotal(sport === League.MLB ? 8.5 : sport === League.NFL ? 45.5 : 222.0);
          setBookHomeML('');
          setBookAwayML('');
          setUseCustomOdds(false);
        }
      }
    } catch (e) {
      console.error('Matchups fetch error', e);
    }
  };

  const handleMatchupChange = (id: string) => {
    setSelectedMatchupId(id);
    const matched = matchups.find(m => m.id === id);
    if (matched) {
      setBookSpread(matched.bookSpread);
      setBookTotal(matched.bookTotal);
      setBookHomeML(matched.hasLiveMarketOdds && matched.bookHomeML !== undefined ? String(matched.bookHomeML) : '');
      setBookAwayML(matched.hasLiveMarketOdds && matched.bookAwayML !== undefined ? String(matched.bookAwayML) : '');
      setUseCustomOdds(Boolean(matched.hasLiveMarketOdds));
      setIsCustom(false);
    }
  };

  const selectedMatchup = useMemo(
    () => matchups.find(m => m.id === selectedMatchupId) || null,
    [matchups, selectedMatchupId]
  );

  const buildPayload = () => {
    let home = customHome;
    let away = customAway;
    let gameId: string | undefined;

    if (!isCustom && selectedMatchup) {
      home = selectedMatchup.homeTeam;
      away = selectedMatchup.awayTeam;
      gameId = selectedMatchup.id;
    }

    const parsedHomeML = useCustomOdds && bookHomeML.trim() !== '' && !isNaN(Number(bookHomeML)) ? Number(bookHomeML) : null;
    const parsedAwayML = useCustomOdds && bookAwayML.trim() !== '' && !isNaN(Number(bookAwayML)) ? Number(bookAwayML) : null;

    return {
      sport: selectedLeague,
      gameId,
      homeTeam: home,
      awayTeam: away,
      bookSpread: useCustomOdds ? bookSpread : null,
      bookTotal: useCustomOdds ? bookTotal : null,
      bookHomeML: parsedHomeML,
      bookAwayML: parsedAwayML,
      customParams: showFormulaParams
        ? {
            isB2B,
            restDifference,
            missingStarHome,
            missingStarAway,
            isPlayoff,
            isBackupQBHome,
            isBackupQBAway,
            isOffByeHome,
            isOffByeAway,
            isShortWeekHome,
            isShortWeekAway,
            weatherWindNFL,
            ballparkRunFactor,
            windSpeed
          }
        : undefined
    };
  };

  const runPredictionEngine = async (refreshMode = false) => {
    if (refreshMode) setIsRefreshing(true);
    else {
      setIsPredicting(true);
      setPrediction(null);
    }
    setErrorMsg(null);

    try {
      const endpoint = refreshMode ? '/api/predictions/refresh' : '/api/predict';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload())
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        setErrorMsg(err.error || `Prediction request failed (${res.status})`);
        return;
      }

      const data: GamePredictionData = await res.json();
      setPrediction(data);

      if (data.engineSnapshot?.game?.gameId) {
        const vRes = await fetch(`/api/predictions/${encodeURIComponent(data.engineSnapshot.game.gameId)}/versions`);
        if (vRes.ok) {
          const vData = await vRes.json();
          if (Array.isArray(vData.versions)) {
            setVersionsList(vData.versions);
            setSelectedVersionId(data.engineSnapshot.predictionId);
          }
        }
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Network error executing prediction engine');
    } finally {
      setIsPredicting(false);
      setIsRefreshing(false);
    }
  };

  // Switch rendered snapshot when selecting an older immutable version
  const activeSnapshot: EngineSnapshotUI | null = useMemo(() => {
    if (!prediction?.engineSnapshot) return null;
    if (selectedVersionId && versionsList.length > 0) {
      const found = versionsList.find(v => v.predictionId === selectedVersionId);
      if (found) return found;
    }
    return prediction.engineSnapshot;
  }, [prediction, versionsList, selectedVersionId]);

  const homeProb = activeSnapshot ? activeSnapshot.homeWinProb : (prediction?.projectedHomeWinProb ?? 0.5);
  const awayProb = activeSnapshot ? activeSnapshot.awayWinProb : (prediction?.projectedAwayWinProb ?? 0.5);
  const tieProb = activeSnapshot ? activeSnapshot.tieProb : (prediction?.projectedTieProb ?? 0);
  const homeTeamLabel = activeSnapshot?.game.homeTeamName ?? prediction?.homeTeam ?? '';
  const awayTeamLabel = activeSnapshot?.game.awayTeamName ?? prediction?.awayTeam ?? '';
  const winningTeamLabel = homeProb >= awayProb ? homeTeamLabel : awayTeamLabel;
  const winningPctVal = Math.max(homeProb, awayProb) * 100;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="p-5 bg-gradient-to-r from-blue-900/10 via-blue-500/5 to-gray-950 border border-blue-500/15 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <Cpu className="text-blue-400" size={24} />
          </div>
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-wider">Point-in-Time Quantitative Win Probability Engine</h2>
            <p className="text-xs text-blue-400/80 font-mono uppercase tracking-[0.15em] mt-1">
              Calibrated {selectedLeague} Matchup Forecaster • Separated Market Pricing & Availability Scenarios
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono">
            CUTOFF-SAFE • MARKET-INDEPENDENT
          </span>
        </div>
      </div>

      {/* Control & Output Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Control Console (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl space-y-5">
            {/* Sport Tabs */}
            <div className="grid grid-cols-3 gap-2 p-1 bg-gray-950 border border-gray-800 rounded-xl">
              {[League.NBA, League.MLB, League.NFL].map(lg => (
                <button
                  key={lg}
                  onClick={() => setSelectedLeague(lg)}
                  className={`py-2 text-[10px] font-bold tracking-widest uppercase rounded-lg transition-all ${
                    selectedLeague === lg
                      ? 'bg-blue-500 text-gray-950 font-extrabold shadow-md shadow-blue-500/10'
                      : 'text-gray-400 hover:text-white hover:bg-gray-900/50'
                  }`}
                >
                  {lg}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Sliders size={14} className="text-blue-500" /> Canonical Schedule ({selectedLeague})
              </span>
              <button
                type="button"
                onClick={() => setIsCustom(!isCustom)}
                className={`px-3 py-1 text-[9px] font-bold tracking-widest uppercase rounded border transition-all ${
                  isCustom ? 'bg-blue-500/15 border-blue-400 text-blue-300' : 'bg-gray-950 border-gray-800 text-gray-400'
                }`}
              >
                {isCustom ? 'Custom Teams' : 'Live Schedule'}
              </button>
            </div>

            {isCustom ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-950 border border-gray-800 rounded-xl">
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Home Team</label>
                  <input
                    type="text"
                    value={customHome}
                    onChange={(e) => setCustomHome(e.target.value)}
                    className="w-full bg-transparent border-0 text-white font-mono text-xs focus:ring-0 outline-none p-0"
                  />
                </div>
                <div className="p-3 bg-gray-950 border border-gray-800 rounded-xl">
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Away Team</label>
                  <input
                    type="text"
                    value={customAway}
                    onChange={(e) => setCustomAway(e.target.value)}
                    className="w-full bg-transparent border-0 text-white font-mono text-xs focus:ring-0 outline-none p-0"
                  />
                </div>
              </div>
            ) : (
              <div className="p-3 bg-gray-950 border border-gray-800 rounded-xl space-y-2.5">
                <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block">
                  Select Canonical {selectedLeague} Matchup
                </label>
                <div className="relative">
                  <select
                    value={selectedMatchupId}
                    onChange={(e) => handleMatchupChange(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-800 text-white font-mono font-bold text-xs p-3 pr-10 rounded-lg outline-none appearance-none cursor-pointer focus:border-blue-500 transition-colors"
                  >
                    {matchups.map((game) => (
                      <option key={game.id} value={game.id}>
                        {game.awayTeam} @ {game.homeTeam} • {game.localStart || game.gameTime}
                        {game.doubleheaderGameNum ? ` (G${game.doubleheaderGameNum})` : ''}
                      </option>
                    ))}
                    {matchups.length === 0 && (
                      <option value="">No scheduled slate today — switch to Custom Teams</option>
                    )}
                  </select>
                  <div className="absolute top-1/2 right-3 -translate-y-1/2 pointer-events-none text-gray-500">
                    <ChevronDown size={14} />
                  </div>
                </div>
                {selectedMatchup && (
                  <div className="flex flex-wrap items-center gap-2 text-[9px] font-mono text-gray-400">
                    {selectedMatchup.venueName && (
                      <span className="flex items-center gap-1">
                        <MapPin size={10} className="text-blue-400" /> {selectedMatchup.venueName}
                      </span>
                    )}
                    {selectedMatchup.neutralSite && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">NEUTRAL SITE</span>
                    )}
                    {selectedMatchup.doubleheaderGameNum && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                        DH GAME #{selectedMatchup.doubleheaderGameNum}
                      </span>
                    )}
                    {selectedMatchup.status && selectedMatchup.status !== 'scheduled' && (
                      <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-200 uppercase">
                        STATUS: {selectedMatchup.status}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Separated Sportsbook Price Comparison Input (strictly optional — never feeds win probability) */}
            <div className="p-3.5 bg-gray-950 border border-gray-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Scale size={12} className="text-emerald-400" /> Sportsbook Price Comparison (Optional)
                </span>
                <button
                  type="button"
                  onClick={() => setUseCustomOdds(!useCustomOdds)}
                  className={`px-2 py-0.5 text-[8.5px] font-mono font-bold uppercase rounded border ${
                    useCustomOdds ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-gray-900 border-gray-800 text-gray-500'
                  }`}
                >
                  {useCustomOdds ? 'Price Enabled' : 'No Odds Entered'}
                </button>
              </div>
              <p className="text-[9px] text-gray-500 leading-snug">
                Sportsbook prices evaluate betting value (EV) only. They never alter the model&apos;s predicted win probabilities.
              </p>

              {useCustomOdds && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-2.5 bg-gray-900 border border-gray-800 rounded-lg">
                    <label className="text-[8.5px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Book Home ML</label>
                    <input
                      type="number"
                      placeholder="-145"
                      value={bookHomeML}
                      onChange={(e) => setBookHomeML(e.target.value)}
                      className="w-full bg-transparent border-0 text-sm font-mono font-bold text-white focus:ring-0 outline-none p-0"
                    />
                  </div>
                  <div className="p-2.5 bg-gray-900 border border-gray-800 rounded-lg">
                    <label className="text-[8.5px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Book Away ML</label>
                    <input
                      type="number"
                      placeholder="+125"
                      value={bookAwayML}
                      onChange={(e) => setBookAwayML(e.target.value)}
                      className="w-full bg-transparent border-0 text-sm font-mono font-bold text-white focus:ring-0 outline-none p-0"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Optional Availability & Situational Scenario Stress-Test Drawer */}
            <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-950">
              <button
                type="button"
                onClick={() => setShowFormulaParams(!showFormulaParams)}
                className="w-full p-3.5 bg-gray-900 hover:bg-gray-850 transition-colors flex items-center justify-between text-left border-b border-gray-800"
              >
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-400 font-mono flex items-center gap-2">
                  <Sliders size={12} /> Situational Override & Scenario Stress Test
                </span>
                <ChevronDown size={14} className={`text-gray-400 transition-transform ${showFormulaParams ? 'rotate-180' : ''}`} />
              </button>

              {showFormulaParams && (
                <div className="p-4 space-y-3 text-xs">
                  {selectedLeague === League.NBA && (
                    <>
                      <label className="flex items-center justify-between p-1 cursor-pointer">
                        <span className="text-[9.5px] text-gray-400 font-bold uppercase">Force Away Back-to-Back?</span>
                        <input
                          type="checkbox"
                          checked={isB2B}
                          onChange={(e) => setIsB2B(e.target.checked)}
                          className="rounded border-gray-800 bg-gray-900 text-blue-500"
                        />
                      </label>
                      <label className="flex items-center justify-between p-1 cursor-pointer">
                        <span className="text-[9.5px] text-gray-400 font-bold uppercase">Simulate Missing Home Star?</span>
                        <input
                          type="checkbox"
                          checked={missingStarHome}
                          onChange={(e) => setMissingStarHome(e.target.checked)}
                          className="rounded border-gray-800 bg-gray-900 text-blue-500"
                        />
                      </label>
                      <label className="flex items-center justify-between p-1 cursor-pointer">
                        <span className="text-[9.5px] text-gray-400 font-bold uppercase">Simulate Missing Away Star?</span>
                        <input
                          type="checkbox"
                          checked={missingStarAway}
                          onChange={(e) => setMissingStarAway(e.target.checked)}
                          className="rounded border-gray-800 bg-gray-900 text-blue-500"
                        />
                      </label>
                      <label className="flex items-center justify-between p-1 cursor-pointer">
                        <span className="text-[9.5px] text-gray-400 font-bold uppercase">Playoff Rotation Mode (42m cap)?</span>
                        <input
                          type="checkbox"
                          checked={isPlayoff}
                          onChange={(e) => setIsPlayoff(e.target.checked)}
                          className="rounded border-gray-800 bg-gray-900 text-blue-500"
                        />
                      </label>
                      <label className="flex items-center justify-between p-1">
                        <span className="text-[9.5px] text-gray-400 font-bold uppercase">Home Rest Advantage (days)</span>
                        <input
                          type="number"
                          min={0}
                          max={5}
                          value={restDifference}
                          onChange={(e) => setRestDifference(Number(e.target.value))}
                          className="w-14 text-center bg-gray-900 border border-gray-800 text-white rounded text-[10px] p-1 font-bold"
                        />
                      </label>
                    </>
                  )}

                  {selectedLeague === League.MLB && (
                    <>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] uppercase font-mono font-bold">
                          <span className="text-gray-400">Override Wind Speed (mph)</span>
                          <span className="text-blue-400">{windSpeed} mph</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="30"
                          step="1"
                          value={windSpeed}
                          onChange={(e) => setWindSpeed(Number(e.target.value))}
                          className="w-full accent-blue-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] uppercase font-mono font-bold">
                          <span className="text-gray-400">Ballpark Index Override</span>
                          <span className="text-blue-400">x{ballparkRunFactor.toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min="0.80"
                          max="1.30"
                          step="0.01"
                          value={ballparkRunFactor}
                          onChange={(e) => setBallparkRunFactor(Number(e.target.value))}
                          className="w-full accent-blue-500"
                        />
                      </div>
                    </>
                  )}

                  {selectedLeague === League.NFL && (
                    <>
                      <label className="flex items-center justify-between p-1 cursor-pointer">
                        <span className="text-[9.5px] text-gray-400 font-bold uppercase">Home Backup QB Scenario?</span>
                        <input
                          type="checkbox"
                          checked={isBackupQBHome}
                          onChange={(e) => setIsBackupQBHome(e.target.checked)}
                          className="rounded border-gray-800 bg-gray-900 text-blue-500"
                        />
                      </label>
                      <label className="flex items-center justify-between p-1 cursor-pointer">
                        <span className="text-[9.5px] text-gray-400 font-bold uppercase">Away Backup QB Scenario?</span>
                        <input
                          type="checkbox"
                          checked={isBackupQBAway}
                          onChange={(e) => setIsBackupQBAway(e.target.checked)}
                          className="rounded border-gray-800 bg-gray-900 text-blue-500"
                        />
                      </label>
                      <label className="flex items-center justify-between p-1 cursor-pointer">
                        <span className="text-[9.5px] text-gray-400 font-bold uppercase">Home Off Bye / Away Short Week?</span>
                        <input
                          type="checkbox"
                          checked={isOffByeHome || isShortWeekAway}
                          onChange={(e) => {
                            setIsOffByeHome(e.target.checked);
                            setIsShortWeekAway(e.target.checked);
                          }}
                          className="rounded border-gray-800 bg-gray-900 text-blue-500"
                        />
                      </label>
                      <label className="flex items-center justify-between p-1">
                        <span className="text-[9.5px] text-gray-400 font-bold uppercase">Wind Override (mph)</span>
                        <input
                          type="number"
                          value={weatherWindNFL}
                          onChange={(e) => setWeatherWindNFL(Number(e.target.value))}
                          className="w-14 text-center bg-gray-900 border border-gray-800 text-white rounded text-[10px] p-1 font-bold"
                        />
                      </label>
                    </>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => runPredictionEngine(false)}
              disabled={isPredicting || isRefreshing}
              className={`w-full py-4 bg-blue-500 hover:bg-blue-600 text-gray-950 rounded-xl font-bold uppercase tracking-[0.2em] text-[10px] transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-500/20 ${
                isPredicting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <RefreshCw size={14} className={isPredicting ? 'animate-spin' : ''} />
              {isPredicting ? 'Running Point-in-Time Snapshot...' : 'Generate Calibrated Forecast'}
            </button>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
                {errorMsg}
              </div>
            )}
          </div>

          <div className="p-4 bg-blue-900/10 border border-blue-500/15 rounded-xl flex items-start gap-3">
            <AlertCircle size={18} className="text-blue-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-gray-400 leading-relaxed">
              <span className="font-bold text-blue-300 uppercase tracking-wider block mb-1">Probability vs Price Discipline</span>
              Every prediction stores an immutable point-in-time snapshot before estimating outcome probabilities across active availability scenarios. Probable winners can still be overpriced betting markets.
            </p>
          </div>
        </div>

        {/* Right Forecast Console (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {!isPredicting && !prediction && (
            <div className="bg-gray-900 border border-gray-800 h-96 rounded-2xl flex flex-col items-center justify-center text-center p-8 shadow-2xl">
              <div className="p-4 bg-gray-950 border border-gray-800 rounded-full mb-4">
                <Target size={30} className="text-gray-600" />
              </div>
              <h3 className="font-bold text-white uppercase tracking-wider text-sm">Forecast Engine Ready</h3>
              <p className="text-[11px] text-gray-500 max-w-md mt-1.5 mb-6">
                Select a canonical {selectedLeague} matchup and generate an immutable, point-in-time prediction snapshot with calibrated probabilities, availability scenarios, and separated sportsbook pricing.
              </p>
              <div className="flex flex-wrap justify-center border border-gray-800 divide-x divide-gray-800 rounded-lg overflow-hidden bg-gray-950 font-mono text-[9px] uppercase tracking-wider text-gray-400">
                <span className="px-3.5 py-2">Calibrated Out-of-Sample</span>
                <span className="px-3.5 py-2">NWS Forecast Vintages</span>
                <span className="px-3.5 py-2">Zero Leakage Guard</span>
              </div>
            </div>
          )}

          {isPredicting && (
            <div className="bg-gray-950 border border-blue-500/20 h-96 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-5">
              <Cpu size={32} className="text-blue-400 animate-spin" style={{ animationDuration: '4s' }} />
              <div className="space-y-1.5">
                <h4 className="text-xs font-mono font-bold tracking-[0.2em] text-blue-400 uppercase">Ingesting Live Feeds & Solving Availability Scenarios</h4>
                <p className="text-[10px] text-gray-400 font-mono">APPLYING CUTOFF GUARD • FETCHING NWS FORECAST VINTAGE • CALIBRATING PROBABILITIES</p>
              </div>
            </div>
          )}

          {!isPredicting && prediction && activeSnapshot && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-6 space-y-6 animate-fadeIn">
              {/* Top Forecast Status, Timestamps & Immutable Version Control Bar */}
              <div className="p-4 bg-gray-950 border border-gray-800 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2.5 py-1 rounded text-[9px] font-mono font-black uppercase border ${getStatusBadgeClass(activeSnapshot.forecastStatus)}`}>
                      FORECAST: {activeSnapshot.forecastStatus}
                    </span>
                    <span className="px-2 py-1 rounded text-[9px] font-mono bg-gray-900 text-gray-300 border border-gray-800">
                      v{activeSnapshot.versionNum} • {activeSnapshot.modelVersion}
                    </span>
                    <span className="px-2 py-1 rounded text-[9px] font-mono bg-gray-900 text-gray-400 border border-gray-800">
                      Cal: {activeSnapshot.calibrationVersion}
                    </span>
                    {activeSnapshot.game.neutralSite && (
                      <span className="px-2 py-1 rounded text-[9px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        NEUTRAL SITE
                      </span>
                    )}
                    {activeSnapshot.game.doubleheaderGameNum && (
                      <span className="px-2 py-1 rounded text-[9px] font-mono bg-blue-500/15 text-blue-300 border border-blue-500/30">
                        DOUBLEHEADER G{activeSnapshot.game.doubleheaderGameNum}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {versionsList.length > 1 && (
                      <div className="flex items-center gap-1.5 bg-gray-900 border border-gray-800 rounded-lg px-2 py-1">
                        <History size={12} className="text-blue-400" />
                        <select
                          value={activeSnapshot.predictionId}
                          onChange={(e) => setSelectedVersionId(e.target.value)}
                          className="bg-transparent text-[10px] font-mono text-gray-200 outline-none"
                        >
                          {versionsList.map(v => (
                            <option key={v.predictionId} value={v.predictionId} className="bg-gray-900">
                              v{v.versionNum} ({new Date(v.createdUtc).toLocaleTimeString()})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => runPredictionEngine(true)}
                      disabled={isRefreshing}
                      className="px-3 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 rounded-lg text-[9.5px] font-mono font-bold uppercase flex items-center gap-1.5"
                    >
                      <RefreshCw size={11} className={isRefreshing ? 'animate-spin' : ''} /> Refresh Snapshot
                    </button>
                  </div>
                </div>

                {/* Timestamps & Data Completeness */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono text-gray-400 pt-2 border-t border-gray-900">
                  <div>
                    <Clock size={11} className="inline mr-1 text-blue-400" />
                    Start: <b className="text-gray-200">{new Date(activeSnapshot.game.scheduledStartUtc).toLocaleString('en-US', { timeZone: activeSnapshot.game.venueTimezone, dateStyle: 'short', timeStyle: 'short' })}</b> ({activeSnapshot.game.venueTimezone})
                    <span className="block text-[9px] text-gray-500">UTC Cutoff: {activeSnapshot.cutoffUtc}</span>
                  </div>
                  <div className="sm:text-right">
                    <MapPin size={11} className="inline mr-1 text-emerald-400" />
                    Venue: <b className="text-gray-200">{activeSnapshot.game.venueName}</b>
                    <span className="block text-[9px] text-gray-500">
                      Completeness ({activeSnapshot.dataCompleteness.freshnessLabel}): {activeSnapshot.dataCompleteness.confirmedCount} Confirmed • {activeSnapshot.dataCompleteness.projectedCount} Projected • {activeSnapshot.dataCompleteness.missingCount} Missing • {activeSnapshot.dataCompleteness.staleCount} Stale
                    </span>
                  </div>
                </div>

                {activeSnapshot.provisionalReasons.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[10px] text-amber-200 space-y-1">
                    <span className="font-mono font-bold uppercase text-amber-300 block">Provisional / Uncertainty Notices:</span>
                    {activeSnapshot.provisionalReasons.map((r, i) => (
                      <div key={i}>• {r}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* Exhaustive Calibrated Win Probabilities */}
              <div className="p-6 bg-gradient-to-br from-gray-950 via-gray-900 to-emerald-950/30 border border-emerald-500/30 rounded-2xl space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest block">
                      Calibrated Matchup Win Probabilities (Simplex Sum = {((homeProb + awayProb + tieProb) * 100).toFixed(1)}%)
                    </span>
                    <h3 className="text-xl font-black text-white uppercase mt-1">
                      {awayTeamLabel} <span className="text-gray-500 text-sm font-normal">@</span> {homeTeamLabel}
                    </h3>
                  </div>
                  <span className="px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-black flex items-center gap-1.5">
                    <Trophy size={13} /> Model Favorite: {winningTeamLabel} ({winningPctVal.toFixed(1)}%)
                  </span>
                </div>

                {/* Probability Cards */}
                <div className={`grid grid-cols-1 ${tieProb > 0 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-4`}>
                  <div className="p-4 bg-gray-950 border border-gray-800 rounded-xl flex flex-col justify-between">
                    <span className="text-[9.5px] font-mono text-blue-400 uppercase font-bold flex items-center gap-1">
                      {awayProb > homeProb && <Crown size={12} />} {awayTeamLabel} (Away)
                    </span>
                    <div className="text-3xl font-mono font-black text-white mt-2">{formatPct(awayProb)}</div>
                    <span className="text-[10px] font-mono text-gray-500 mt-1">
                      Fair ML Equivalent: {formatAmerican(prediction.projectedAwayML)}
                    </span>
                  </div>

                  <div className="p-4 bg-gray-950 border border-gray-800 rounded-xl flex flex-col justify-between">
                    <span className="text-[9.5px] font-mono text-rose-400 uppercase font-bold flex items-center gap-1">
                      {homeProb >= awayProb && <Crown size={12} />} {homeTeamLabel} (Home)
                    </span>
                    <div className="text-3xl font-mono font-black text-white mt-2">{formatPct(homeProb)}</div>
                    <span className="text-[10px] font-mono text-gray-500 mt-1">
                      Fair ML Equivalent: {formatAmerican(prediction.projectedHomeML)}
                    </span>
                  </div>

                  {tieProb > 0 && (
                    <div className="p-4 bg-gray-950 border border-gray-800 rounded-xl flex flex-col justify-between">
                      <span className="text-[9.5px] font-mono text-amber-400 uppercase font-bold">
                        Regulation / OT Tie (NFL)
                      </span>
                      <div className="text-3xl font-mono font-black text-amber-300 mt-2">{formatPct(tieProb)}</div>
                      <span className="text-[10px] font-mono text-gray-500 mt-1">Included in 3-way simplex</span>
                    </div>
                  )}
                </div>

                {/* Visual Split Bar */}
                <div className="h-3.5 bg-gray-950 rounded-full overflow-hidden p-0.5 border border-gray-800 flex">
                  <div style={{ width: `${Math.max(4, awayProb * 100)}%` }} className="h-full bg-blue-500 rounded-l-full" />
                  {tieProb > 0 && (
                    <div style={{ width: `${Math.max(1, tieProb * 100)}%` }} className="h-full bg-amber-400" />
                  )}
                  <div style={{ width: `${Math.max(4, homeProb * 100)}%` }} className="h-full bg-emerald-500 rounded-r-full" />
                </div>

                {/* Secondary Heuristic Margin / Total Strip (Explicitly Labeled Evaluative Status) */}
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div className="p-3 bg-gray-950 border border-gray-800 rounded-xl text-center">
                    <span className="text-[8.5px] text-gray-500 uppercase font-mono block">Secondary Est. Margin</span>
                    <span className="text-base font-mono font-bold text-white mt-1 block">
                      {activeSnapshot.projectedMargin !== null
                        ? `${activeSnapshot.projectedMargin > 0 ? 'Home +' : 'Home '}${activeSnapshot.projectedMargin}`
                        : 'N/A'}
                    </span>
                    <span className="text-[8px] text-amber-400/80 font-mono">
                      {activeSnapshot.marginEvaluated ? 'Validated' : 'Secondary estimate (unvalidated)'}
                    </span>
                  </div>
                  <div className="p-3 bg-gray-950 border border-gray-800 rounded-xl text-center">
                    <span className="text-[8.5px] text-gray-500 uppercase font-mono block">Secondary Est. Total</span>
                    <span className="text-base font-mono font-bold text-white mt-1 block">
                      {activeSnapshot.projectedTotal !== null ? activeSnapshot.projectedTotal : 'N/A'}
                    </span>
                    <span className="text-[8px] text-amber-400/80 font-mono">
                      {activeSnapshot.totalEvaluated ? 'Validated' : 'Secondary estimate (unvalidated)'}
                    </span>
                  </div>
                  <div className="p-3 bg-gray-950 border border-gray-800 rounded-xl text-center">
                    <span className="text-[8.5px] text-gray-500 uppercase font-mono block">Margin Uncertainty σ</span>
                    <span className="text-base font-mono font-bold text-white mt-1 block">
                      ±{activeSnapshot.uncertaintySigmaMargin ?? 'N/A'}
                    </span>
                    <span className="text-[8px] text-gray-500 font-mono">Model-based distribution</span>
                  </div>
                </div>
              </div>

              {/* Separated Market Pricing & Push-Aware EV Module */}
              <div className="p-5 bg-gray-950 border border-gray-800 rounded-xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-900 pb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="text-emerald-400" size={16} />
                    <span className="text-[11px] font-black text-white uppercase tracking-wider">
                      Separated Sportsbook Market & EV Pricing
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-gray-400 px-2 py-0.5 rounded bg-gray-900 border border-gray-800">
                    {activeSnapshot.marketPricing.available
                      ? `${activeSnapshot.marketPricing.sportsbook || 'Market'} • Rules ${activeSnapshot.marketPricing.settlementRulesVersion}`
                      : 'Market Odds Unavailable'}
                  </span>
                </div>

                {!activeSnapshot.marketPricing.available ? (
                  <div className="p-3 rounded-lg bg-gray-900/70 border border-gray-800 text-xs text-gray-400">
                    {activeSnapshot.marketPricing.reasonIfUnavailable ||
                      'Live sportsbook prices unavailable (ODDS_API_KEY not configured or matchup unpriced). Enable "Sportsbook Price Comparison" on the left to evaluate custom moneyline prices.'}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Away Market Card */}
                      <div className="p-3.5 bg-gray-900/50 border border-gray-800 rounded-xl space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-blue-300 uppercase">{awayTeamLabel} (Away)</span>
                          <span className="font-mono font-black text-white">
                            {formatAmerican(activeSnapshot.marketPricing.awayAmericanOdds)} ({activeSnapshot.marketPricing.awayDecimalOdds?.toFixed(3)} dec)
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-center pt-1">
                          <div className="p-1.5 bg-gray-950 rounded border border-gray-900">
                            <span className="text-gray-500 block text-[8px]">Raw Implied</span>
                            <span className="text-gray-300 font-bold">
                              {activeSnapshot.marketPricing.awayRawImpliedProb !== null ? formatPct(activeSnapshot.marketPricing.awayRawImpliedProb) : 'N/A'}
                            </span>
                          </div>
                          <div className="p-1.5 bg-gray-950 rounded border border-gray-900">
                            <span className="text-gray-500 block text-[8px]">No-Vig Approx</span>
                            <span className="text-gray-200 font-bold">
                              {activeSnapshot.marketPricing.awayNoVigApproxProb !== null ? formatPct(activeSnapshot.marketPricing.awayNoVigApproxProb) : 'N/A'}
                            </span>
                          </div>
                          <div className="p-1.5 bg-gray-950 rounded border border-gray-900">
                            <span className="text-gray-500 block text-[8px]">EV / 1 Unit</span>
                            <span className={`font-bold ${(activeSnapshot.marketPricing.awayExpectedValuePerUnit ?? 0) > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {activeSnapshot.marketPricing.awayExpectedValuePerUnit !== null
                                ? `${activeSnapshot.marketPricing.awayExpectedValuePerUnit > 0 ? '+' : ''}${(activeSnapshot.marketPricing.awayExpectedValuePerUnit * 100).toFixed(2)}%`
                                : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Home Market Card */}
                      <div className="p-3.5 bg-gray-900/50 border border-gray-800 rounded-xl space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-rose-300 uppercase">{homeTeamLabel} (Home)</span>
                          <span className="font-mono font-black text-white">
                            {formatAmerican(activeSnapshot.marketPricing.homeAmericanOdds)} ({activeSnapshot.marketPricing.homeDecimalOdds?.toFixed(3)} dec)
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-center pt-1">
                          <div className="p-1.5 bg-gray-950 rounded border border-gray-900">
                            <span className="text-gray-500 block text-[8px]">Raw Implied</span>
                            <span className="text-gray-300 font-bold">
                              {activeSnapshot.marketPricing.homeRawImpliedProb !== null ? formatPct(activeSnapshot.marketPricing.homeRawImpliedProb) : 'N/A'}
                            </span>
                          </div>
                          <div className="p-1.5 bg-gray-950 rounded border border-gray-900">
                            <span className="text-gray-500 block text-[8px]">No-Vig Approx</span>
                            <span className="text-gray-200 font-bold">
                              {activeSnapshot.marketPricing.homeNoVigApproxProb !== null ? formatPct(activeSnapshot.marketPricing.homeNoVigApproxProb) : 'N/A'}
                            </span>
                          </div>
                          <div className="p-1.5 bg-gray-950 rounded border border-gray-900">
                            <span className="text-gray-500 block text-[8px]">EV / 1 Unit</span>
                            <span className={`font-bold ${(activeSnapshot.marketPricing.homeExpectedValuePerUnit ?? 0) > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {activeSnapshot.marketPricing.homeExpectedValuePerUnit !== null
                                ? `${activeSnapshot.marketPricing.homeExpectedValuePerUnit > 0 ? '+' : ''}${(activeSnapshot.marketPricing.homeExpectedValuePerUnit * 100).toFixed(2)}%`
                                : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="text-[10px] font-mono text-gray-400 bg-gray-900/60 border border-gray-800 rounded-lg p-2.5 flex flex-wrap justify-between gap-2">
                      <span>Overround: <b className="text-white">{activeSnapshot.marketPricing.overroundPct?.toFixed(2)}%</b> • {activeSnapshot.marketPricing.noVigMethodLabel}</span>
                      <span className="text-emerald-300 font-bold">{activeSnapshot.marketPricing.recommendedMarketNote}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Availability Scenarios (Marginalization Proof) */}
              <div className="p-4 bg-gray-950 border border-gray-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-gray-900 pb-2">
                  <span className="text-[9.5px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Layers size={12} className="text-blue-400" /> Joint Availability Scenarios (P(win) = Σ qₛ · pₛ)
                  </span>
                  <span className="text-[9px] font-mono text-gray-500">
                    Marginalized Home Win: {formatPct(activeSnapshot.homeWinProb)}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeSnapshot.scenarios.map(s => (
                    <div key={s.scenarioId} className="p-3 bg-gray-900/60 border border-gray-800 rounded-lg space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] font-mono font-bold">
                        <span className="text-white">{s.label}</span>
                        <span className="text-blue-300">Weight qₛ: {(s.probability * 100).toFixed(1)}%</span>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-snug">{s.description}</p>
                      <div className="flex justify-between text-[10px] font-mono pt-1 border-t border-gray-800 text-gray-300">
                        <span>Cond. Home Win pₛ: <b className="text-emerald-300">{(s.conditionalHomeWinProb * 100).toFixed(1)}%</b></span>
                        <span>Cond. Margin: <b>{s.conditionalMargin > 0 ? `+${s.conditionalMargin}` : s.conditionalMargin}</b></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Model-Backed Top Drivers */}
              <div className="p-4 bg-gray-950 border border-gray-800 rounded-xl space-y-3">
                <span className="text-[9.5px] font-bold text-gray-400 uppercase tracking-widest block border-b border-gray-900 pb-2">
                  Model-Backed Factor Contributions
                </span>
                <div className="space-y-2">
                  {activeSnapshot.topDrivers.map((d, idx) => (
                    <div key={idx} className="p-3 bg-gray-900/50 border border-gray-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                            {d.factorId}
                          </span>
                          <span className="text-xs font-bold text-white">{d.name}</span>
                          <span className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded border ${getStatusBadgeClass(d.status)}`}>
                            {d.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400">{d.explanation}</p>
                      </div>
                      <div className="text-right font-mono text-[10px] shrink-0">
                        <span className={`font-bold block ${d.direction === 'home' ? 'text-emerald-400' : d.direction === 'away' ? 'text-blue-400' : 'text-gray-400'}`}>
                          {d.impactOnHomeWinProb >= 0 ? '+' : ''}{(d.impactOnHomeWinProb * 100).toFixed(2)}% Win Prob
                        </span>
                        <span className="text-[8.5px] text-gray-500">{d.evidenceSource}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Travel, Rest, & NWS Weather Vintage Conditions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-950 border border-gray-800 rounded-xl space-y-2">
                  <span className="text-[9.5px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-gray-900 pb-2">
                    <Activity size={12} className="text-blue-400" /> Rest & Travel Schedule Load
                  </span>
                  <div className="text-[10px] font-mono space-y-1.5 text-gray-300">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Home Rest Days:</span>
                      <span>
                        {activeSnapshot.travelRest.homeRestDays ?? 'Missing'}
                        {activeSnapshot.travelRest.homeIsB2B ? ' (B2B)' : ''}
                        {activeSnapshot.travelRest.homeOffBye ? ' (Off Bye)' : ''}
                        {activeSnapshot.travelRest.homeShortWeek ? ' (Short Week)' : ''}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Away Rest Days:</span>
                      <span>
                        {activeSnapshot.travelRest.awayRestDays ?? 'Missing'}
                        {activeSnapshot.travelRest.awayIsB2B ? ' (B2B)' : ''}
                        {activeSnapshot.travelRest.awayOffBye ? ' (Off Bye)' : ''}
                        {activeSnapshot.travelRest.awayShortWeek ? ' (Short Week)' : ''}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Away Travel Distance:</span>
                      <span>
                        {activeSnapshot.travelRest.awayTravelMilesFromPrev !== null
                          ? `${activeSnapshot.travelRest.awayTravelMilesFromPrev} mi (${activeSnapshot.travelRest.awayTravelDirection}, ${activeSnapshot.travelRest.awayTimezonesCrossed ?? 0} TZ)`
                          : 'Unknown'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Arrival Timing:</span>
                      <span className="text-amber-300">{activeSnapshot.travelRest.arrivalTimingStatus} (not fabricated)</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-950 border border-gray-800 rounded-xl space-y-2">
                  <span className="text-[9.5px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-gray-900 pb-2">
                    <Cloud size={12} className="text-blue-400" /> Venue & NWS Forecast Vintage
                  </span>
                  {activeSnapshot.weather ? (
                    <div className="text-[10px] font-mono space-y-1.5 text-gray-300">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Status / Roof:</span>
                        <span className="uppercase">{activeSnapshot.weather.status} • {activeSnapshot.weather.roofStatus} ({activeSnapshot.weather.surface})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Temp / Wind / Precip:</span>
                        <span>
                          {activeSnapshot.weather.status === 'not_applicable'
                            ? 'N/A — Indoor Venue'
                            : activeSnapshot.weather.tempF !== null
                            ? `${activeSnapshot.weather.tempF}°F • ${activeSnapshot.weather.windMph ?? '?'} mph • ${activeSnapshot.weather.precipProb ?? 0}% precip`
                            : 'Missing'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Altitude / Air Density:</span>
                        <span>
                          {activeSnapshot.weather.altitudeFt} ft
                          {activeSnapshot.weather.airDensityIndex !== null ? ` (idx ${activeSnapshot.weather.airDensityIndex})` : ''}
                        </span>
                      </div>
                      <div className="text-[9px] text-gray-500 truncate">
                        Issued: {activeSnapshot.weather.issuedUtc} • Valid: {activeSnapshot.weather.validUtc}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-gray-500 font-mono">Weather vintage unavailable.</div>
                  )}
                </div>
              </div>

              {/* League-Specific Coherence Panels */}
              {activeSnapshot.nbaRotations && (
                <div className="p-4 bg-gray-950 border border-gray-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-900 pb-2">
                    <span className="text-[9.5px] font-bold text-gray-400 uppercase tracking-widest">
                      NBA Rotation Coherence (240.0 Team-Minute Conservation)
                    </span>
                    <span className="text-[9px] font-mono text-emerald-400">
                      Home: {activeSnapshot.nbaRotations.homeMinutesTotal}m • Away: {activeSnapshot.nbaRotations.awayMinutesTotal}m ({activeSnapshot.nbaRotations.feasible ? 'Feasible' : 'Adjusted'})
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px] font-mono">
                    {[
                      { title: `${awayTeamLabel} Rotation`, list: activeSnapshot.nbaRotations.awayRotation, color: 'text-blue-400' },
                      { title: `${homeTeamLabel} Rotation`, list: activeSnapshot.nbaRotations.homeRotation, color: 'text-rose-400' }
                    ].map((side, idx) => (
                      <div key={idx} className="space-y-1.5">
                        <div className={`font-bold uppercase ${side.color}`}>{side.title}</div>
                        {side.list.slice(0, 7).map((r, i) => (
                          <div key={i} className="flex justify-between p-1.5 bg-gray-900/60 rounded border border-gray-900">
                            <span className="text-gray-200">{r.playerName} <span className="text-gray-500">({r.position})</span></span>
                            <span className="text-white font-bold">{r.projectedMinutes.toFixed(1)}m <span className="text-gray-500 font-normal">(base {r.baselineMinutes})</span></span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeSnapshot.mlbPitchingPlan && (
                <div className="p-4 bg-gray-950 border border-gray-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-900 pb-2">
                    <span className="text-[9.5px] font-bold text-gray-400 uppercase tracking-widest">
                      MLB 9-Inning Pitching Workload Plan & Park Factors
                    </span>
                    <span className="text-[9px] font-mono text-gray-400">
                      Home Lineup: {activeSnapshot.mlbPitchingPlan.homeLineupConfirmed ? 'Confirmed' : 'Projected'} • Away: {activeSnapshot.mlbPitchingPlan.awayLineupConfirmed ? 'Confirmed' : 'Projected'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px] font-mono">
                    {[
                      { title: `${awayTeamLabel} Staff (${activeSnapshot.mlbPitchingPlan.awayInningsTotal} IP)`, list: activeSnapshot.mlbPitchingPlan.awayStaff, color: 'text-blue-400' },
                      { title: `${homeTeamLabel} Staff (${activeSnapshot.mlbPitchingPlan.homeInningsTotal} IP)`, list: activeSnapshot.mlbPitchingPlan.homeStaff, color: 'text-rose-400' }
                    ].map((side, idx) => (
                      <div key={idx} className="space-y-1.5">
                        <div className={`font-bold uppercase ${side.color}`}>{side.title}</div>
                        {side.list.map((p, i) => (
                          <div key={i} className="flex justify-between p-2 bg-gray-900/60 rounded border border-gray-900">
                            <div>
                              <span className="text-white font-bold block">{p.pitcherName}</span>
                              <span className="text-[8.5px] text-gray-500 uppercase">{p.role} • {p.availabilityStatus}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-emerald-300 font-bold block">{p.projectedInnings} IP</span>
                              <span className="text-[8.5px] text-gray-400">FIP: {p.fip !== null ? p.fip.toFixed(2) : 'Missing'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeSnapshot.nflMatchupContext && (
                <div className="p-4 bg-gray-950 border border-gray-800 rounded-xl space-y-2">
                  <span className="text-[9.5px] font-bold text-gray-400 uppercase tracking-widest block border-b border-gray-900 pb-2">
                    NFL Unit Matchup Context ({activeSnapshot.nflMatchupContext.epaDefinition})
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px] font-mono">
                    <div className="p-2 bg-gray-900/60 rounded border border-gray-900">
                      <span className="text-gray-500 block text-[8.5px]">Home Off EPA/play</span>
                      <span className="text-white font-bold">{activeSnapshot.nflMatchupContext.homeOffEpaPerPlay ?? 'Missing'}</span>
                    </div>
                    <div className="p-2 bg-gray-900/60 rounded border border-gray-900">
                      <span className="text-gray-500 block text-[8.5px]">Away Off EPA/play</span>
                      <span className="text-white font-bold">{activeSnapshot.nflMatchupContext.awayOffEpaPerPlay ?? 'Missing'}</span>
                    </div>
                    <div className="p-2 bg-gray-900/60 rounded border border-gray-900">
                      <span className="text-gray-500 block text-[8.5px]">Home OL vs Pass Rush</span>
                      <span className="text-emerald-300 font-bold">{activeSnapshot.nflMatchupContext.olVsPassRushInteractionHome ?? 'N/A'}</span>
                    </div>
                    <div className="p-2 bg-gray-900/60 rounded border border-gray-900">
                      <span className="text-gray-500 block text-[8.5px]">Away OL vs Pass Rush</span>
                      <span className="text-blue-300 font-bold">{activeSnapshot.nflMatchupContext.olVsPassRushInteractionAway ?? 'N/A'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Injury & Replacement Depth Details (ESPN Injuries) */}
              <div className="p-4 bg-gray-950 border border-gray-800 rounded-xl space-y-3">
                <span className="text-[9.5px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-gray-900 pb-2">
                  <Shield size={12} className="text-amber-400" /> Injury, Participation Status & Replacement Depth
                </span>
                {activeSnapshot.absencesAndReplacements.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {activeSnapshot.absencesAndReplacements.map((rec, i) => (
                      <div key={i} className="p-2.5 bg-gray-900/60 border border-gray-800 rounded-lg text-[10px] space-y-1">
                        <div className="flex justify-between font-mono font-bold">
                          <span className="text-white">{rec.playerName} ({rec.teamAbbr} {rec.position})</span>
                          <span className="text-amber-300">{rec.gameDesignation || 'Listed'}</span>
                        </div>
                        <div className="text-gray-400">
                          {rec.practiceStatus ? `Practice: ${rec.practiceStatus} • ` : ''}
                          Reason: {rec.injuryOrReason} • Play Prob: {rec.confirmedParticipationProb !== null ? `${Math.round(rec.confirmedParticipationProb * 100)}%` : 'Est.'}
                        </div>
                        <div className="text-[9px] text-gray-500 font-mono">
                          Est. Drop-off vs {rec.replacementName || 'Replacement'}: {rec.replacementDropoffPoints.toFixed(1)} pts ({Math.round(rec.alreadyReflectedInBaselinePct * 100)}% in baseline)
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px] text-gray-500 font-mono">
                    No active injury exclusions reported on live {selectedLeague} feed at snapshot cutoff.
                  </div>
                )}
              </div>

              {/* League Methodology & Governance Footer */}
              <div className="text-[9.5px] text-gray-500 font-mono border-t border-gray-800 pt-3 flex flex-wrap justify-between gap-2">
                <span>Snapshot ID: {activeSnapshot.snapshotId} • Feature Registry v{activeSnapshot.featureRegistryVersion}</span>
                <span>Rules: {activeSnapshot.rulesVersion}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
