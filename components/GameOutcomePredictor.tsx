import React, { useState, useEffect } from 'react';
import { 
  Cpu, Target, RefreshCw, ChevronDown, Check, AlertCircle, 
  TrendingUp, Star, Lock, Trophy, Award, Trash2, Sliders, Play
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { League } from '../types';

interface PlayerStat {
  playerName: string;
  usg: number;
  ts: number;
  minutes: number;
}

interface PlayerProp {
  playerName: string;
  statType: string;
  line: number;
  projected: number;
  overUnder: string;
  edgePct: number;
}

interface GamePredictionData {
  homeTeam: string;
  awayTeam: string;
  sport?: string;
  homeNetRtg?: number;
  awayNetRtg?: number;
  homePace?: number;
  awayPace?: number;
  homeTS?: number;
  awayTS?: number;
  homeWrc?: number;
  awayWrc?: number;
  homeSpxFip?: number;
  awaySpxFip?: number;
  parkFactor?: number;
  homeDVOA?: number;
  awayDVOA?: number;
  injuryReport: string[];
  projectedMargin: number;
  bookSpread: number;
  projectedTotal?: number;
  edgePoints: number;
  edgeCategory: string;
  recommendedPick: string;
  confidence: number;
  homePlayerStats: PlayerStat[];
  awayPlayerStats: PlayerStat[];
  playerProps: PlayerProp[];

  // ML target fields
  projectedHomeWinProb: number;
  projectedAwayWinProb: number;
  projectedHomeML: number;
  projectedAwayML: number;
  bookHomeML: number;
  bookAwayML: number;
  mlEdgeTeam: string;
  mlEdgePct: number;
  mlEdgeCategory: string;
  mlbFormulaSummary?: string;
  nflFormulaSummary?: string;
}

interface MatchupItem {
  id: string;
  homeTeam: string;
  awayTeam: string;
  gameTime: string;
  bookSpread: number;
  bookTotal: number;
  bookHomeML?: number;
  bookAwayML?: number;
}

interface TrackedPick {
  id: string;
  matchup: string;
  pick: string;
  bookSpread: number;
  edge: number;
  confidence: number;
  result: 'PENDING' | 'WIN' | 'LOSS';
  createdAt: string;
}

export const GameOutcomePredictor: React.FC = () => {
  // UI states
  const [selectedLeague, setSelectedLeague] = useState<League>(League.NBA);
  const [showFormulaParams, setShowFormulaParams] = useState<boolean>(true);
  const [matchups, setMatchups] = useState<MatchupItem[]>([]);
  const [selectedMatchupId, setSelectedMatchupId] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(false);
  
  // Inputs
  const [customHome, setCustomHome] = useState<string>('Lakers');
  const [customAway, setCustomAway] = useState<string>('Warriors');
  const [bookSpread, setBookSpread] = useState<number>(-4.5);
  const [bookTotal, setBookTotal] = useState<number>(222.0);
  const [bookHomeML, setBookHomeML] = useState<number>(-190);
  const [bookAwayML, setBookAwayML] = useState<number>(160);

  // NBA Engine States
  const [homeNetRtg, setHomeNetRtg] = useState<number>(4.2);
  const [awayNetRtg, setAwayNetRtg] = useState<number>(1.1);
  const [homeORtg, setHomeORtg] = useState<number>(116.5);
  const [awayDRtg, setAwayDRtg] = useState<number>(114.2);
  const [awayORtg, setAwayORtg] = useState<number>(115.0);
  const [homeDRtg, setHomeDRtg] = useState<number>(113.8);
  const [pace, setPace] = useState<number>(98.5);
  
  // NBA Situationals
  const [isB2B, setIsB2B] = useState<boolean>(false);
  const [restDifference, setRestDifference] = useState<number>(0);
  const [missingStarHome, setMissingStarHome] = useState<boolean>(false);
  const [missingStarAway, setMissingStarAway] = useState<boolean>(false);
  const [isPlayoff, setIsPlayoff] = useState<boolean>(false);

  // MLB Engine States
  const [homeWrc, setHomeWrc] = useState<number>(105);
  const [awayWrc, setAwayWrc] = useState<number>(98);
  const [homeSpxFip, setHomeSpxFip] = useState<number>(3.90);
  const [awaySpxFip, setAwaySpxFip] = useState<number>(4.20);
  const [ballparkRunFactor, setBallparkRunFactor] = useState<number>(1.00);
  const [handednessAdjustment, setHandednessAdjustment] = useState<number>(0.00);
  const [homeSPprojectedEr, setHomeSPprojectedEr] = useState<number>(2.40);
  const [awaySPprojectedEr, setAwaySPprojectedEr] = useState<number>(2.80);
  const [bullpenEraContrib, setBullpenEraContrib] = useState<number>(1.80);
  const [windSpeed, setWindSpeed] = useState<number>(5);

  // NFL Engine States
  const [homeDVOA, setHomeDVOA] = useState<number>(12.5);
  const [awayDVOA, setAwayDVOA] = useState<number>(5.0);
  const [homeOffenseDVOA, setHomeOffenseDVOA] = useState<number>(10.2);
  const [awayDefenseDVOA, setAwayDefenseDVOA] = useState<number>(-3.5);
  const [awayOffenseDVOA, setAwayOffenseDVOA] = useState<number>(6.1);
  const [homeDefenseDVOA, setHomeDefenseDVOA] = useState<number>(1.2);
  const [paceFactor, setPaceFactor] = useState<number>(1.00);
  const [isBackupQBHome, setIsBackupQBHome] = useState<boolean>(false);
  const [isBackupQBAway, setIsBackupQBAway] = useState<boolean>(false);
  const [isOffByeHome, setIsOffByeHome] = useState<boolean>(false);
  const [isOffByeAway, setIsOffByeAway] = useState<boolean>(false);
  const [isShortWeekHome, setIsShortWeekHome] = useState<boolean>(false);
  const [isShortWeekAway, setIsShortWeekAway] = useState<boolean>(false);
  const [weatherWindNFL, setWeatherWindNFL] = useState<number>(8);

  // Loaders
  const [isPredicting, setIsPredicting] = useState<boolean>(false);
  
  // Results
  const [prediction, setPrediction] = useState<GamePredictionData | null>(null);
  
  // Ledger and Leaderboard tracking
  const [trackedPicks, setTrackedPicks] = useState<TrackedPick[]>([]);
  const [sortBy, setSortBy] = useState<'highest' | 'recent'>('highest');

  // Helper client-side formula to convert standard point spread to estimated american money line
  const estimateML = (spread: number, currentSport: League = selectedLeague) => {
    const margin = -spread;
    let prob = 1 / (1 + Math.exp(-0.1554 * margin));
    if (currentSport === League.MLB) {
      prob = 1 / (1 + Math.exp(-0.6 * margin));
    }
    let hML = -110;
    let aML = -110;
    if (prob >= 0.5) {
      hML = Math.round(-(prob / (1 - prob)) * 100);
      aML = Math.round(((1 - prob) / prob) * 105);
    } else {
      hML = Math.round((prob / (1 - prob)) * 105);
      aML = Math.round(-((1 - prob) / prob) * 100);
    }
    return { homeML: hML, awayML: aML };
  };

  // Real-time calculation engine outputs
  const calculated = React.useMemo(() => {
    if (selectedLeague === League.NBA) {
      let margin = (homeNetRtg - awayNetRtg) / 2 + 2.75;
      if (isB2B) {
        margin = margin * 0.85 - 2.2;
      }
      if (restDifference >= 3) {
        margin += 2.5;
      }
      if (missingStarHome) {
        margin -= 3.5;
      }
      if (missingStarAway) {
        margin += 3.5;
      }
      if (isPlayoff) {
        margin += margin >= 0 ? 1.0 : -1.0;
      }

      const total = ((homeORtg + awayDRtg) / 2 + (awayORtg + homeDRtg) / 2) * (pace / 100);
      const ourSpread = -margin;
      const spreadDiff = ourSpread - bookSpread;
      const totalDiff = total - bookTotal;

      return {
        margin: Number(margin.toFixed(1)),
        spread: Number(ourSpread.toFixed(1)),
        total: Number(total.toFixed(1)),
        spreadEdge: Number(Math.abs(spreadDiff).toFixed(1)),
        totalEdge: Number(Math.abs(totalDiff).toFixed(1)),
        spreadRecommend: spreadDiff > 0 ? `LEAN AWAY +${Math.abs(bookSpread)}` : `LEAN HOME ${bookSpread}`,
        totalRecommend: totalDiff > 0 ? 'OVER' : 'UNDER'
      };

    } else if (selectedLeague === League.MLB) {
      const scaleNode = 0.05; 
      const rawHomePart = (homeWrc - awaySpxFip * 20); 
      const rawAwayPart = (awayWrc - homeSpxFip * 20); 
      const margin = (rawHomePart - rawAwayPart) * scaleNode + (ballparkRunFactor - 1.0) * 2 + handednessAdjustment;

      let total = homeSPprojectedEr + awaySPprojectedEr + bullpenEraContrib + (ballparkRunFactor - 1.0) * 1.5;
      if (windSpeed >= 15) {
        total += 0.8;
      }

      const ourSpread = -margin;
      const spreadDiff = ourSpread - bookSpread;
      const totalDiff = total - bookTotal;

      return {
        margin: Number(margin.toFixed(2)),
        spread: Number(ourSpread.toFixed(2)),
        total: Number(total.toFixed(1)),
        spreadEdge: Number(Math.abs(spreadDiff).toFixed(2)),
        totalEdge: Number(Math.abs(totalDiff).toFixed(1)),
        spreadRecommend: spreadDiff > 0 ? `LEAN AWAY +${Math.abs(bookSpread)}` : `LEAN HOME ${bookSpread}`,
        totalRecommend: totalDiff > 0 ? 'OVER' : 'UNDER'
      };

    } else {
      const hfa = 2.75;
      const qbAdjHome = isBackupQBHome ? -8.5 : 0;
      const qbAdjAway = isBackupQBAway ? -8.5 : 0;
      const byeHome = isOffByeHome ? 2.5 : 0;
      const byeAway = isOffByeAway ? 2.5 : 0;
      const shortHome = isShortWeekHome ? -1.5 : 0;
      const shortAway = isShortWeekAway ? -1.5 : 0;

      let margin = (homeDVOA - awayDVOA) * 0.15 + hfa + qbAdjHome - qbAdjAway + (byeHome - byeAway) + (shortHome - shortAway);
      
      const offDefDiffHome = homeOffenseDVOA - awayDefenseDVOA; 
      const offDefDiffAway = awayOffenseDVOA - homeDefenseDVOA;
      let total = 44.5 + (offDefDiffHome + offDefDiffAway) * 0.15 * paceFactor;
      if (weatherWindNFL > 15) {
        total -= 3.0;
      }

      const ourSpread = -margin;
      const spreadDiff = ourSpread - bookSpread;
      const totalDiff = total - bookTotal;

      return {
        margin: Number(margin.toFixed(1)),
        spread: Number(ourSpread.toFixed(1)),
        total: Number(total.toFixed(1)),
        spreadEdge: Number(Math.abs(spreadDiff).toFixed(1)),
        totalEdge: Number(Math.abs(totalDiff).toFixed(1)),
        spreadRecommend: spreadDiff > 0 ? `LEAN AWAY +${Math.abs(bookSpread)}` : `LEAN HOME ${bookSpread}`,
        totalRecommend: totalDiff > 0 ? 'OVER' : 'UNDER'
      };
    }
  }, [
    selectedLeague, bookSpread, bookTotal,
    homeNetRtg, awayNetRtg, homeORtg, awayDRtg, awayORtg, homeDRtg, pace,
    isB2B, restDifference, missingStarHome, missingStarAway, isPlayoff,
    homeWrc, awayWrc, homeSpxFip, awaySpxFip, ballparkRunFactor, handednessAdjustment,
    homeSPprojectedEr, awaySPprojectedEr, bullpenEraContrib, windSpeed,
    homeDVOA, awayDVOA, homeOffenseDVOA, awayDefenseDVOA, awayOffenseDVOA, homeDefenseDVOA,
    paceFactor, isBackupQBHome, isBackupQBAway, isOffByeHome, isOffByeAway, isShortWeekHome, isShortWeekAway,
    weatherWindNFL
  ]);

  // Fetch matchups on mount and when league selection changes
  useEffect(() => {
    fetchMatchups(selectedLeague);
    // Load saved tracked picks
    const saved = localStorage.getItem('tracked_nba_predictions');
    if (saved) {
      try {
        setTrackedPicks(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, [selectedLeague]);

  const fetchMatchups = async (sport: League = selectedLeague) => {
    try {
      const res = await fetch(`/api/games/${sport}`);
      if (res.ok) {
        const data: MatchupItem[] = await res.json();
        setMatchups(data);
        if (data.length > 0) {
          setSelectedMatchupId(data[0].id);
          setBookSpread(data[0].bookSpread);
          setBookTotal(data[0].bookTotal);
          const est = estimateML(data[0].bookSpread, sport);
          setBookHomeML(data[0].bookHomeML || est.homeML);
          setBookAwayML(data[0].bookAwayML || est.awayML);
        } else {
          setSelectedMatchupId('');
          setBookSpread(sport === League.MLB ? -1.5 : -4.5);
          setBookTotal(sport === League.MLB ? 8.5 : (sport === League.NFL ? 45.5 : 222.0));
          const est = estimateML(sport === League.MLB ? -1.5 : -4.5, sport);
          setBookHomeML(est.homeML);
          setBookAwayML(est.awayML);
        }
      }
    } catch (e) {
      console.error("Matchups fetch error", e);
    }
  };

  // Triggered when selected matchup dropdown changes
  const handleMatchupChange = (id: string) => {
    setSelectedMatchupId(id);
    const matched = matchups.find(m => m.id === id);
    if (matched) {
      setBookSpread(matched.bookSpread);
      setBookTotal(matched.bookTotal);
      const est = estimateML(matched.bookSpread, selectedLeague);
      setBookHomeML(matched.bookHomeML || est.homeML);
      setBookAwayML(matched.bookAwayML || est.awayML);
      setIsCustom(false);
    }
  };

  // Run the predictions routine
  const runPredictionEngine = async () => {
    setIsPredicting(true);
    setPrediction(null);

    // Call predict API
    let home = customHome;
    let away = customAway;

    if (!isCustom) {
      const selectedGame = matchups.find(m => m.id === selectedMatchupId);
      if (selectedGame) {
        home = selectedGame.homeTeam;
        away = selectedGame.awayTeam;
      }
    }

    try {
      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sport: selectedLeague,
          homeTeam: home,
          awayTeam: away,
          bookSpread,
          bookTotal,
          bookHomeML,
          bookAwayML,
          customParams: {
            homeNetRtg, awayNetRtg, homeORtg, awayDRtg, awayORtg, homeDRtg, pace,
            isB2B, restDifference, missingStarHome, missingStarAway, isPlayoff,
            homeWrc, awayWrc, homeSpxFip, awaySpxFip, ballparkRunFactor, handednessAdjustment,
            homeSPprojectedEr, awaySPprojectedEr, bullpenEraContrib, windSpeed,
            homeDVOA, awayDVOA, homeOffenseDVOA, awayDefenseDVOA, awayOffenseDVOA, homeDefenseDVOA,
            paceFactor, isBackupQBHome, isBackupQBAway, isOffByeHome, isOffByeAway, isShortWeekHome, isShortWeekAway,
            weatherWindNFL
          }
        })
      });

      if (res.ok) {
        const data: GamePredictionData = await res.json();
        setPrediction(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsPredicting(false);
    }
  };

  // Save/Track a pick to outcome list (Week 4 Features)
  const lockAndTrackPick = (pickToSave?: string, confidenceToSave?: number, edgeToSave?: number) => {
    const defaultPickName = prediction ? prediction.recommendedPick : `${customAway} +${bookSpread}`;
    const finalPick = pickToSave || defaultPickName;
    const finalConf = confidenceToSave || (prediction ? prediction.confidence : 60);
    const finalEdge = edgeToSave || (prediction ? prediction.edgePoints : 1.5);
    const matchupStr = prediction ? `${prediction.awayTeam} @ ${prediction.homeTeam}` : `${customAway} @ ${customHome}`;

    const newPick: TrackedPick = {
      id: "pk_" + Date.now() + Math.random().toString(36).substr(2, 4),
      matchup: matchupStr,
      pick: finalPick,
      bookSpread: bookSpread,
      edge: finalEdge,
      confidence: finalConf,
      result: 'PENDING',
      createdAt: new Date().toLocaleDateString()
    };

    const updated = [newPick, ...trackedPicks];
    setTrackedPicks(updated);
    localStorage.setItem('tracked_nba_predictions', JSON.stringify(updated));
  };

  const updatePickResult = (id: string, sResult: 'WIN' | 'LOSS') => {
    const updated = trackedPicks.map(p => {
      if (p.id === id) {
        return { ...p, result: sResult };
      }
      return p;
    });
    setTrackedPicks(updated);
    localStorage.setItem('tracked_nba_predictions', JSON.stringify(updated));
  };

  const deleteTrackedPick = (id: string) => {
    const updated = trackedPicks.filter(p => p.id !== id);
    setTrackedPicks(updated);
    localStorage.setItem('tracked_nba_predictions', JSON.stringify(updated));
  };

  // Generate Recharts normal curve data points for Total distribution simulation
  const mockCurveData = prediction ? Array.from({ length: 41 }, (_, i) => {
    const totalPoint = (bookTotal - 20) + (i * 1);
    const exponent = -Math.pow(totalPoint - bookTotal, 2) / (2 * Math.pow(9, 2));
    const density = Math.round((1 / (9 * Math.sqrt(2 * Math.PI))) * Math.exp(exponent) * 1000);
    return { name: totalPoint.toString(), density };
  }) : [];

  // Recalculate human performance metrics from settled outcomes
  const statsSummary = React.useMemo(() => {
    const settled = trackedPicks.filter(p => p.result !== 'PENDING');
    const wins = settled.filter(p => p.result === 'WIN').length;
    const losses = settled.filter(p => p.result === 'LOSS').length;
    const wr = settled.length > 0 ? Math.round((wins / settled.length) * 100) : 0;
    return { wins, losses, wr, total: settled.length };
  }, [trackedPicks]);

  // Leaders roster (Mock Global Leaderboard aligned to user's real stats)
  const mockLeaderboard = [
    { name: "QuantAlgo_Edge", winRate: 69.1, wins: 56, losses: 25, active: true },
    { name: "SharpSavant", winRate: 65.4, wins: 48, losses: 25, active: false },
    { name: "You (mlopes2023)", winRate: statsSummary.total > 0 ? statsSummary.wr : 58.5, wins: statsSummary.wins, losses: statsSummary.losses, active: true, isUser: true },
    { name: "MarginSniper_AI", winRate: 63.8, wins: 60, losses: 34, active: false },
    { name: "BookFinderPro", winRate: 61.2, wins: 41, losses: 26, active: false }
  ].sort((a,b) => b.winRate - a.winRate);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Tab Branding Header */}
      <div className="p-5 bg-gradient-to-r from-blue-900/10 via-blue-500/5 to-gray-950 border border-blue-500/15 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <Cpu className="text-blue-400 animate-pulse" size={24} />
          </div>
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-wider">Edge-Search Prediction Layer</h2>
            <p className="text-xs text-blue-500/80 font-mono uppercase tracking-[0.2em] mt-1">
              Live NBA Search Grounding Engine • NetRtg Edge Comparison Model
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono">
            GROUNDED WEB PIPELINE ACTIVE
          </span>
        </div>
      </div>      {/* Control Console Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Input form Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl flex flex-col justify-between h-auto">
            <div className="space-y-5">
              
              {/* Sport Selector Tabs */}
              <div className="grid grid-cols-3 gap-2 p-1 bg-gray-950 border border-gray-800 rounded-xl">
                <button
                  onClick={() => setSelectedLeague(League.NBA)}
                  className={`py-2 text-[10px] font-bold tracking-widest uppercase rounded-lg transition-all ${
                    selectedLeague === League.NBA 
                      ? 'bg-blue-500 text-gray-950 font-extrabold shadow-md shadow-blue-500/10' 
                      : 'text-gray-400 hover:text-white hover:bg-gray-900/50'
                  }`}
                >
                  NBA
                </button>
                <button
                  onClick={() => setSelectedLeague(League.MLB)}
                  className={`py-2 text-[10px] font-bold tracking-widest uppercase rounded-lg transition-all ${
                    selectedLeague === League.MLB 
                      ? 'bg-blue-500 text-gray-950 font-extrabold shadow-md shadow-blue-500/10' 
                      : 'text-gray-400 hover:text-white hover:bg-gray-900/50'
                  }`}
                >
                  MLB
                </button>
                <button
                  onClick={() => setSelectedLeague(League.NFL)}
                  className={`py-2 text-[10px] font-bold tracking-widest uppercase rounded-lg transition-all ${
                    selectedLeague === League.NFL 
                      ? 'bg-blue-500 text-gray-950 font-extrabold shadow-md shadow-blue-500/10' 
                      : 'text-gray-400 hover:text-white hover:bg-gray-900/50'
                  }`}
                >
                  NFL
                </button>
              </div>

              <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-2">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Sliders size={14} className="text-blue-500" /> Matchup Setup ({selectedLeague})
                </span>
                
                {/* Custom Toggle Switch */}
                <button 
                  onClick={() => setIsCustom(!isCustom)}
                  className={`px-3 py-1 text-[9px] font-bold tracking-widest uppercase rounded border transition-all ${
                    isCustom ? 'bg-blue-500/15 border-blue-400 text-blue-300' : 'bg-gray-950 border-gray-800 text-gray-500'
                  }`}
                >
                  {isCustom ? "Custom Teams" : "Today's Games"}
                </button>
              </div>

              {isCustom ? (
                <div className="grid grid-cols-2 gap-4 animate-fadeIn">
                  <div className="p-3 bg-gray-950 border border-gray-805 rounded-xl">
                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Home Team</label>
                    <input 
                      type="text" 
                      value={customHome} 
                      onChange={(e) => setCustomHome(e.target.value)}
                      className="w-full bg-transparent border-0 text-white font-mono text-xs focus:ring-0 outline-none p-0"
                    />
                  </div>
                  <div className="p-3 bg-gray-950 border border-gray-805 rounded-xl">
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
                <div className="p-3 bg-gray-950 border border-gray-800 rounded-xl relative select-none animate-fadeIn">
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2.5 block">
                    Select Live {selectedLeague} Matchup
                  </label>
                  <div className="relative">
                    <select 
                      value={selectedMatchupId}
                      onChange={(e) => handleMatchupChange(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-800 text-white font-mono font-bold text-xs p-3.5 pr-10 rounded-lg outline-none appearance-none cursor-pointer focus:border-blue-500 transition-colors"
                    >
                      {matchups.map((game) => (
                        <option key={game.id} value={game.id}>
                          {game.awayTeam} at {game.homeTeam} ({game.gameTime})
                        </option>
                      ))}
                      {matchups.length === 0 && (
                        <option value="">No schedule found (Simulation Active)</option>
                      )}
                    </select>
                    <div className="absolute top-1/2 right-4 transform -translate-y-1/2 pointer-events-none text-gray-500">
                      <ChevronDown size={14} />
                    </div>
                  </div>
                </div>
              )}

              {/* Book Betting Parameters */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3.5 bg-gray-950 border border-gray-800 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Book Spread</label>
                    <span className="text-[8px] font-mono text-gray-650 block leading-none">Home Fav (-)</span>
                  </div>
                  <input 
                    type="number" 
                    step="0.5" 
                    value={bookSpread}
                    onChange={(e) => {
                      const spreadVal = Number(e.target.value);
                      setBookSpread(spreadVal);
                      const est = estimateML(spreadVal, selectedLeague);
                      setBookHomeML(est.homeML);
                      setBookAwayML(est.awayML);
                    }}
                    className="w-full bg-transparent border-0 text-lg font-mono font-bold text-white focus:ring-0 outline-none p-0"
                  />
                </div>
                <div className="p-3.5 bg-gray-950 border border-gray-800 rounded-xl">
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2.5 block">Book Game Total</label>
                  <input 
                    type="number" 
                    step="0.5" 
                    value={bookTotal}
                    onChange={(e) => setBookTotal(Number(e.target.value))}
                    className="w-full bg-transparent border-0 text-lg font-mono font-bold text-white focus:ring-0 outline-none p-0"
                  />
                </div>

                <div className="p-3.5 bg-gray-950 border border-gray-800 rounded-xl">
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2.5 block">Book Home ML</label>
                  <input 
                    type="number" 
                    step="5" 
                    value={bookHomeML}
                    onChange={(e) => setBookHomeML(Number(e.target.value))}
                    className="w-full bg-transparent border-0 text-lg font-mono font-bold text-white focus:ring-0 outline-none p-0"
                  />
                </div>
                <div className="p-3.5 bg-gray-950 border border-gray-800 rounded-xl">
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2.5 block">Book Away ML</label>
                  <input 
                    type="number" 
                    step="5" 
                    value={bookAwayML}
                    onChange={(e) => setBookAwayML(Number(e.target.value))}
                    className="w-full bg-transparent border-0 text-lg font-mono font-bold text-white focus:ring-0 outline-none p-0"
                  />
                </div>
              </div>

              {/* Dynamic Formula Fine-Tuning Workspace */}
              <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-950">
                <button 
                  type="button"
                  onClick={() => setShowFormulaParams(!showFormulaParams)}
                  className="w-full p-3.5 bg-gray-900 hover:bg-gray-850 transition-colors flex items-center justify-between text-left border-b border-gray-800"
                >
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-400 font-mono flex items-center gap-2">
                    <Sliders size={12} /> Model Tuning Parameters
                  </span>
                  <ChevronDown size={14} className={`text-gray-400 transition-transform ${showFormulaParams ? 'rotate-180' : ''}`} />
                </button>

                {showFormulaParams && (
                  <div className="p-4 space-y-4 max-h-[320px] overflow-y-auto custom-scrollbar text-xs">
                    {selectedLeague === League.NBA && (
                      <div className="space-y-4 animate-fadeIn">
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] uppercase font-mono font-bold">
                            <span className="text-gray-400">Home Net Rating</span>
                            <span className="text-blue-400">{homeNetRtg > 0 ? `+${homeNetRtg}` : homeNetRtg}</span>
                          </div>
                          <input 
                            type="range" min="-15" max="15" step="0.1" value={homeNetRtg} 
                            onChange={(e) => setHomeNetRtg(Number(e.target.value))}
                            className="w-full accent-blue-500"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] uppercase font-mono font-bold">
                            <span className="text-gray-400">Away Net Rating</span>
                            <span className="text-blue-400">{awayNetRtg > 0 ? `+${awayNetRtg}` : awayNetRtg}</span>
                          </div>
                          <input 
                            type="range" min="-15" max="15" step="0.1" value={awayNetRtg} 
                            onChange={(e) => setAwayNetRtg(Number(e.target.value))}
                            className="w-full accent-blue-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2">
                          <div className="space-y-1.5 p-2 bg-gray-900 border border-gray-850 rounded-lg">
                            <label className="text-[9px] text-gray-500 font-bold uppercase block tracking-wider">Home ORtg</label>
                            <input 
                              type="number" step="0.5" value={homeORtg} 
                              onChange={(e) => setHomeORtg(Number(e.target.value))}
                              className="w-full bg-transparent border-0 text-white font-mono font-bold outline-none p-0 text-xs focus:ring-0"
                            />
                          </div>
                          <div className="space-y-1.5 p-2 bg-gray-900 border border-gray-850 rounded-lg">
                            <label className="text-[9px] text-gray-500 font-bold uppercase block tracking-wider">Away DRtg</label>
                            <input 
                              type="number" step="0.5" value={awayDRtg} 
                              onChange={(e) => setAwayDRtg(Number(e.target.value))}
                              className="w-full bg-transparent border-0 text-white font-mono font-bold outline-none p-0 text-xs focus:ring-0"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5 p-2 bg-gray-900 border border-gray-850 rounded-lg">
                            <label className="text-[9px] text-gray-500 font-bold uppercase block tracking-wider">Away ORtg</label>
                            <input 
                              type="number" step="0.5" value={awayORtg} 
                              onChange={(e) => setAwayORtg(Number(e.target.value))}
                              className="w-full bg-transparent border-0 text-white font-mono font-bold outline-none p-0 text-xs focus:ring-0"
                            />
                          </div>
                          <div className="space-y-1.5 p-2 bg-gray-900 border border-gray-850 rounded-lg">
                            <label className="text-[9px] text-gray-500 font-bold uppercase block tracking-wider">Home DRtg</label>
                            <input 
                              type="number" step="0.5" value={homeDRtg} 
                              onChange={(e) => setHomeDRtg(Number(e.target.value))}
                              className="w-full bg-transparent border-0 text-white font-mono font-bold outline-none p-0 text-xs focus:ring-0"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] uppercase font-mono font-bold">
                            <span className="text-gray-400">Game Pace</span>
                            <span className="text-blue-400">{pace} pos</span>
                          </div>
                          <input 
                            type="range" min="85" max="115" step="0.5" value={pace} 
                            onChange={(e) => setPace(Number(e.target.value))}
                            className="w-full accent-blue-500"
                          />
                        </div>

                        {/* NBA Toggles */}
                        <div className="pt-2 border-t border-gray-900 space-y-2">
                          <label className="flex items-center justify-between p-1 cursor-pointer">
                            <span className="text-[9.5px] text-gray-400 font-bold uppercase">Away Back-to-Back Road?</span>
                            <input 
                              type="checkbox" checked={isB2B} onChange={(e) => setIsB2B(e.target.checked)}
                              className="rounded border-gray-800 bg-gray-900 text-blue-500 focus:ring-opacity-0"
                            />
                          </label>
                          <label className="flex items-center justify-between p-1 cursor-pointer">
                            <span className="text-[9.5px] text-gray-400 font-bold uppercase">Home 3+ Days Rest vs B2B?</span>
                            <input 
                              type="checkbox" checked={restDifference >= 3} 
                              onChange={(e) => setRestDifference(e.target.checked ? 3 : 0)}
                              className="rounded border-gray-800 bg-gray-900 text-blue-500 focus:ring-opacity-0"
                            />
                          </label>
                          <label className="flex items-center justify-between p-1 cursor-pointer">
                            <span className="text-[9.5px] text-gray-400 font-bold uppercase">Missing Home Star (-3.5)?</span>
                            <input 
                              type="checkbox" checked={missingStarHome} onChange={(e) => setMissingStarHome(e.target.checked)}
                              className="rounded border-gray-800 bg-gray-900 text-blue-500 focus:ring-opacity-0"
                            />
                          </label>
                          <label className="flex items-center justify-between p-1 cursor-pointer">
                            <span className="text-[9.5px] text-gray-400 font-bold uppercase">Missing Away Star (-3.5)?</span>
                            <input 
                              type="checkbox" checked={missingStarAway} onChange={(e) => setIsB2B(e.target.checked ? false : missingStarAway)} // just toggles
                              className="hidden" // hide simple raw inputs, render neat toggle wrapper
                            />
                            <button
                              type="button"
                              onClick={() => setMissingStarAway(!missingStarAway)}
                              className={`px-2 py-0.5 text-[8px] font-black uppercase rounded ${missingStarAway ? 'bg-red-500/20 text-red-300 border border-red-500/35' : 'bg-gray-900 text-gray-500 border border-gray-800'}`}
                            >
                              {missingStarAway ? 'ACTIVE' : 'INACTIVE'}
                            </button>
                          </label>
                        </div>
                      </div>
                    )}

                    {selectedLeague === League.MLB && (
                      <div className="space-y-4 animate-fadeIn">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1 p-2 bg-gray-900 border border-gray-850 rounded-lg">
                            <label className="text-[8px] text-gray-500 font-bold uppercase tracking-wider block">Home Team wRC+</label>
                            <input 
                              type="number" value={homeWrc} 
                              onChange={(e) => setHomeWrc(Number(e.target.value))}
                              className="w-full bg-transparent border-0 text-white font-mono font-bold outline-none p-0 text-xs focus:ring-0"
                            />
                          </div>
                          <div className="space-y-1 p-2 bg-gray-900 border border-gray-850 rounded-lg">
                            <label className="text-[8px] text-gray-500 font-bold uppercase tracking-wider block">Away Team wRC+</label>
                            <input 
                              type="number" value={awayWrc} 
                              onChange={(e) => setAwayWrc(Number(e.target.value))}
                              className="w-full bg-transparent border-0 text-white font-mono font-bold outline-none p-0 text-xs focus:ring-0"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1 p-2 bg-gray-900 border border-gray-850 rounded-lg">
                            <label className="text-[8px] text-gray-500 font-bold uppercase tracking-wider block">Home SP xFIP ERA</label>
                            <input 
                              type="number" step="0.05" value={homeSpxFip} 
                              onChange={(e) => setHomeSpxFip(Number(e.target.value))}
                              className="w-full bg-transparent border-0 text-white font-mono font-bold outline-none p-0 text-xs focus:ring-0"
                            />
                          </div>
                          <div className="space-y-1 p-2 bg-gray-900 border border-gray-850 rounded-lg">
                            <label className="text-[8px] text-gray-500 font-bold uppercase tracking-wider block">Away SP xFIP ERA</label>
                            <input 
                              type="number" step="0.05" value={awaySpxFip} 
                              onChange={(e) => setAwaySpxFip(Number(e.target.value))}
                              className="w-full bg-transparent border-0 text-white font-mono font-bold outline-none p-0 text-xs focus:ring-0"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] uppercase font-mono font-bold">
                            <span className="text-gray-400">Ballpark Run Factor</span>
                            <span className="text-blue-400">x{ballparkRunFactor.toFixed(2)}</span>
                          </div>
                          <input 
                            type="range" min="0.80" max="1.30" step="0.01" value={ballparkRunFactor} 
                            onChange={(e) => setBallparkRunFactor(Number(e.target.value))}
                            className="w-full accent-blue-500"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] uppercase font-mono font-bold">
                            <span className="text-gray-400">Handedness Adjustment</span>
                            <span className="text-blue-400">{handednessAdjustment >= 0 ? `+${handednessAdjustment}` : handednessAdjustment} runs</span>
                          </div>
                          <input 
                            type="range" min="-1" max="1" step="0.05" value={handednessAdjustment} 
                            onChange={(e) => setHandednessAdjustment(Number(e.target.value))}
                            className="w-full accent-blue-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3 border-t border-gray-900 pt-3">
                          <div className="space-y-1 p-2 bg-gray-900 border border-gray-850 rounded-lg">
                            <label className="text-[8px] text-gray-500 font-bold uppercase tracking-wider block">Home SP Proj ER</label>
                            <input 
                              type="number" step="0.1" value={homeSPprojectedEr} 
                              onChange={(e) => setHomeSPprojectedEr(Number(e.target.value))}
                              className="w-full bg-transparent border-0 text-white font-mono font-bold outline-none p-0 text-xs focus:ring-0"
                            />
                          </div>
                          <div className="space-y-1 p-2 bg-gray-900 border border-gray-850 rounded-lg">
                            <label className="text-[8px] text-gray-500 font-bold uppercase tracking-wider block">Away SP Proj ER</label>
                            <input 
                              type="number" step="0.1" value={awaySPprojectedEr} 
                              onChange={(e) => setAwaySPprojectedEr(Number(e.target.value))}
                              className="w-full bg-transparent border-0 text-white font-mono font-bold outline-none p-0 text-xs focus:ring-0"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1 p-2 bg-gray-900 border border-gray-850 rounded-lg font-mono">
                            <label className="text-[8px] text-gray-500 font-bold uppercase tracking-wider block">Bullpen ER Added</label>
                            <input 
                              type="number" step="0.1" value={bullpenEraContrib} 
                              onChange={(e) => setBullpenEraContrib(Number(e.target.value))}
                              className="w-full bg-transparent border-0 text-white font-bold outline-none p-0 text-xs focus:ring-0"
                            />
                          </div>
                          <div className="space-y-1 p-2 bg-gray-900 border border-gray-850 rounded-lg font-mono">
                            <label className="text-[8px] text-gray-500 font-bold uppercase tracking-wider block">Wind Speed (mph)</label>
                            <input 
                              type="number" value={windSpeed} 
                              onChange={(e) => setWindSpeed(Number(e.target.value))}
                              className="w-full bg-transparent border-0 text-white font-bold outline-none p-0 text-xs focus:ring-0"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedLeague === League.NFL && (
                      <div className="space-y-4 animate-fadeIn font-mono">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1 p-2 bg-gray-900 border border-gray-850 rounded-lg">
                            <label className="text-[8px] text-gray-500 font-bold uppercase tracking-wider block">Home Team Net DVOA%</label>
                            <input 
                              type="number" step="0.5" value={homeDVOA} 
                              onChange={(e) => setHomeDVOA(Number(e.target.value))}
                              className="w-full bg-transparent border-0 text-white font-bold outline-none p-0 text-xs focus:ring-0"
                            />
                          </div>
                          <div className="space-y-1 p-2 bg-gray-900 border border-gray-850 rounded-lg">
                            <label className="text-[8px] text-gray-500 font-bold uppercase tracking-wider block">Away Team Net DVOA%</label>
                            <input 
                              type="number" step="0.5" value={awayDVOA} 
                              onChange={(e) => setAwayDVOA(Number(e.target.value))}
                              className="w-full bg-transparent border-0 text-white font-bold outline-none p-0 text-xs focus:ring-0"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1 p-2 bg-gray-900 border border-gray-850 rounded-lg">
                            <label className="text-[8px] text-gray-500 font-bold uppercase tracking-wider block">Home Offense DVOA%</label>
                            <input 
                              type="number" step="0.5" value={homeOffenseDVOA} 
                              onChange={(e) => setHomeOffenseDVOA(Number(e.target.value))}
                              className="w-full bg-transparent border-0 text-white font-bold outline-none p-0 text-xs focus:ring-0"
                            />
                          </div>
                          <div className="space-y-1 p-2 bg-gray-900 border border-gray-850 rounded-lg">
                            <label className="text-[8px] text-gray-500 font-bold uppercase tracking-wider block">Away Defense DVOA%</label>
                            <input 
                              type="number" step="0.5" value={awayDefenseDVOA} 
                              onChange={(e) => setAwayDefenseDVOA(Number(e.target.value))}
                              className="w-full bg-transparent border-0 text-white font-bold outline-none p-0 text-xs focus:ring-0"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-2">
                          <div className="space-y-1 p-2 bg-gray-900 border border-gray-850 rounded-lg font-mono">
                            <label className="text-[8px] text-gray-500 font-bold uppercase block tracking-wider">Away Offense DVOA%</label>
                            <input 
                              type="number" step="0.5" value={awayOffenseDVOA} 
                              onChange={(e) => setAwayOffenseDVOA(Number(e.target.value))}
                              className="w-full bg-transparent border-0 text-white font-bold outline-none p-0 text-xs focus:ring-0"
                            />
                          </div>
                          <div className="space-y-1 p-2 bg-gray-900 border border-gray-850 rounded-lg font-mono">
                            <label className="text-[8px] text-gray-500 font-bold uppercase block tracking-wider">Home Defense DVOA%</label>
                            <input 
                              type="number" step="0.5" value={homeDefenseDVOA} 
                              onChange={(e) => setHomeDefenseDVOA(Number(e.target.value))}
                              className="w-full bg-transparent border-0 text-white font-bold outline-none p-0 text-xs focus:ring-0"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] uppercase font-bold">
                            <span className="text-gray-400">Pace Factor</span>
                            <span className="text-blue-400">x{paceFactor.toFixed(2)}</span>
                          </div>
                          <input 
                            type="range" min="0.80" max="1.20" step="0.01" value={paceFactor} 
                            onChange={(e) => setPaceFactor(Number(e.target.value))}
                            className="w-full accent-blue-500"
                          />
                        </div>

                        {/* NFL Situationals */}
                        <div className="pt-2 border-t border-gray-900 space-y-2">
                          <label className="flex items-center justify-between p-1 cursor-pointer">
                            <span className="text-[9.5px] text-gray-400 font-bold uppercase">Home Team Backup QB?</span>
                            <input 
                              type="checkbox" checked={isBackupQBHome} onChange={(e) => setIsBackupQBHome(e.target.checked)}
                              className="rounded border-gray-800 bg-gray-900 text-blue-500 focus:ring-opacity-0"
                            />
                          </label>
                          <label className="flex items-center justify-between p-1 cursor-pointer">
                            <span className="text-[9.5px] text-gray-400 font-bold uppercase">Away Team Backup QB?</span>
                            <input 
                              type="checkbox" checked={isBackupQBAway} onChange={(e) => setIsBackupQBAway(e.target.checked)}
                              className="rounded border-gray-800 bg-gray-900 text-blue-500 focus:ring-opacity-0"
                            />
                          </label>
                          <label className="flex items-center justify-between p-1 cursor-pointer">
                            <span className="text-[9.5px] text-gray-400 font-bold uppercase">Home Team Off Bye?</span>
                            <input 
                              type="checkbox" checked={isOffByeHome} onChange={(e) => setIsOffByeHome(e.target.checked)}
                              className="rounded border-gray-800 bg-gray-900 text-blue-500 focus:ring-opacity-0"
                            />
                          </label>
                          <label className="flex items-center justify-between p-1 cursor-pointer">
                            <span className="text-[9.5px] text-gray-400 font-bold uppercase">Away Team Off Bye?</span>
                            <input 
                              type="checkbox" checked={isOffByeAway} onChange={(e) => setIsOffByeAway(e.target.checked)}
                              className="rounded border-gray-800 bg-gray-900 text-blue-500 focus:ring-opacity-0"
                            />
                          </label>
                          <label className="flex items-center justify-between p-1 cursor-pointer">
                            <span className="text-[9.5px] text-gray-400 font-bold uppercase">NFL Game Weather Wind (mph)</span>
                            <input 
                              type="number" value={weatherWindNFL} onChange={(e) => setWeatherWindNFL(Number(e.target.value))}
                              className="w-12 text-center bg-gray-900 border border-gray-800 text-white rounded text-[10px] p-0.5 outline-none font-bold"
                            />
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Computed Model Preview Drawer */}
                    <div className="mt-3 p-3 bg-gradient-to-br from-blue-950/20 to-gray-900 border border-blue-500/10 rounded-lg space-y-2 font-mono">
                      <div className="text-[10px] text-gray-400 font-black tracking-widest uppercase border-b border-gray-900 pb-1.5 flex items-center justify-between">
                        <span>📊 Current Formula outputs</span>
                        <span className="text-emerald-400 animate-pulse">● LIVE CONSOLE</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div>
                          <span className="text-gray-500">Proj. Spread:</span>{' '}
                          <span className="font-bold text-white">{calculated.spread > 0 ? `+${calculated.spread}` : calculated.spread}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Spread Edge:</span>{' '}
                          <span className="font-extrabold text-emerald-400">+{calculated.spreadEdge} pts</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Proj. Total:</span>{' '}
                          <span className="font-bold text-white">{calculated.total} runs/pts</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Total Edge:</span>{' '}
                          <span className="font-extrabold text-emerald-400">+{calculated.totalEdge} pts</span>
                        </div>
                      </div>
                      <div className="text-[9px] uppercase font-bold text-blue-400 pt-1 text-center bg-gray-950/80 py-1 rounded border border-gray-900">
                        {calculated.spreadRecommend} • {calculated.totalRecommend}
                      </div>
                    </div>

                  </div>
                )}
              </div>

            </div>

            {/* CTA action */}
            <button 
              onClick={runPredictionEngine}
              disabled={isPredicting}
              className={`w-full mt-6 py-4 bg-blue-500 hover:bg-blue-600 text-gray-950 rounded-xl font-bold uppercase tracking-[0.25em] text-[10px] transition-all flex items-center justify-center gap-3.5 shadow-lg shadow-blue-500/20 ${
                isPredicting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <RefreshCw size={14} className={isPredicting ? "animate-spin" : ""} />
              {isPredicting ? "Executing AI Engine..." : "Analyze Live Edge & Predict"}
            </button>
          </div>

          {/* Injury & Info Alert Check */}
          <div className="p-4 bg-blue-900/10 border border-blue-500/15 rounded-xl flex items-start gap-3.5">
            <AlertCircle size={18} className="text-blue-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-gray-400 font-sans leading-relaxed">
              <span className="font-bold text-blue-300 uppercase tracking-wider block mb-1">Prediction Guideline:</span>
              This pipeline implements search grounding over live {selectedLeague} roster sheets. Spreads are evaluated using actual team ratings factored with high-precision statistical models. Edges over 3.0 pts are flagged as <b>Strong Edge</b> signals.
            </p>
          </div>
        </div>

        {/* Right Console Output pane (7 cols) */}
        <div className="lg:col-span-7">
          
          {/* Default initial inactive state */}
          {!isPredicting && !prediction && (
            <div className="bg-gray-900 border border-gray-800 h-96 rounded-2xl flex flex-col items-center justify-center text-center p-8 shadow-2xl">
              <div className="p-4 bg-gray-950 border border-gray-800 rounded-full mb-4">
                <Target size={30} className="text-gray-600 animate-pulse" />
              </div>
              <h3 className="font-bold text-white uppercase tracking-wider text-sm">Prediction Terminal Ready</h3>
              <p className="text-[11px] text-gray-500 max-w-sm mt-1 mb-6">
                Configure matchups on the left, then trigger the grounded search calculator to construct margin analyses.
              </p>
              <div className="flex border border-gray-800 divide-x divide-gray-800 rounded-lg overflow-hidden bg-gray-950 font-mono text-[9px] uppercase tracking-wider text-gray-500">
                <span className="px-3.5 py-2">Formula: NetRtg/2</span>
                <span className="px-3.5 py-2">Home Court: +2.75</span>
                <span className="px-3.5 py-2">Grounding: Search</span>
              </div>
            </div>
          )}

          {/* Quantum Edge Loader Sweep Module */}
          {isPredicting && (
            <div className="bg-gray-950 border border-blue-500/20 shadow-2xl shadow-blue-500/5 h-96 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-6 relative overflow-hidden">
               <div className="relative flex items-center justify-center h-28 w-28">
                  <div className="absolute inset-0 rounded-full border-2 border-dashed border-blue-500/10 animate-spin" style={{ animationDuration: '20s' }}></div>
                  <div className="absolute inset-2 rounded-full border border-blue-400/30 animate-pulse"></div>
                  <div className="absolute h-16 w-16 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                     <Cpu size={28} className="text-blue-400 animate-spin" style={{ animationDuration: '6s' }} />
                  </div>
               </div>
               <div className="space-y-2">
                  <h4 className="text-xs font-mono font-bold tracking-[0.25em] text-blue-400 uppercase">Calculating Edge Projections...</h4>
                  <p className="text-[10px] text-gray-400 font-mono">MODELING HARMONIC NETRTG • CONVERTING WIN PROBABILITIES • EXTRACTING VALUE</p>
               </div>
               <div className="w-48 bg-gray-900/60 h-1.5 rounded-full overflow-hidden border border-gray-800">
                  <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full animate-pulse" style={{ width: '80%' }}></div>
               </div>
            </div>
          )}

          {/* Full prediction result view */}
          {!isPredicting && prediction && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-6 space-y-6 animate-scaleIn">
              
              {/* Score / Pick recommendation header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-950 p-4 rounded-xl border border-gray-800 gap-4">
                <div>
                  <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest flex items-center gap-1">
                    Matchup Recommendation • Confidence {prediction.confidence}%
                  </div>
                  <div className="text-xl font-black text-rose-500 uppercase tracking-wide mt-1.5">
                    {prediction.awayTeam} <span className="text-gray-500 text-sm font-normal">at</span> {prediction.homeTeam}
                  </div>
                </div>

                <div className="flex flex-col items-center sm:items-end w-full sm:w-auto">
                  <div className={`px-4 py-2 rounded-xl text-center shadow-lg border w-full sm:w-auto text-[11px] font-black tracking-widest uppercase ${
                    prediction.edgeCategory === 'Strong edge' 
                      ? 'bg-emerald-500/15 border-emerald-400 text-emerald-300' 
                      : prediction.edgeCategory === 'Moderate edge'
                      ? 'bg-amber-500/15 border-amber-400 text-amber-300'
                      : 'bg-gray-850 border-gray-700 text-gray-300'
                  }`}>
                    {prediction.recommendedPick} ({prediction.edgeCategory})
                  </div>
                </div>
              </div>

              {/* Edge, Projected Spread layout details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3.5 bg-gray-950 border border-gray-800 rounded-xl text-center">
                  <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Projected Margin</div>
                  <div className="text-xl font-mono font-bold text-white mt-1.5">{prediction.projectedMargin > 0 ? `Home +${prediction.projectedMargin}` : `Home ${prediction.projectedMargin}`}</div>
                  <div className="text-[8px] text-gray-650 font-mono tracking-wide uppercase mt-1">LvsW: (N15_Home - N15_Away)/2 + 2.75</div>
                </div>
                <div className="p-3.5 bg-gray-950 border border-gray-800 rounded-xl text-center">
                  <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Projected Spread</div>
                  <div className="text-xl font-mono font-bold text-white mt-1.5">{(-prediction.projectedMargin) > 0 ? `Home +${(-prediction.projectedMargin)}` : `Home ${(-prediction.projectedMargin)}`}</div>
                  <div className="text-[8px] text-gray-650 font-mono tracking-wide uppercase mt-1">Recalculated Home Spread</div>
                </div>
                <div className="p-3.5 bg-gray-950 border border-gray-800 rounded-xl text-center flex flex-col justify-between">
                  <div>
                    <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Detected Edge Points</div>
                    <div className="text-xl font-mono font-bold text-emerald-400 mt-1.5">+{prediction.edgePoints} pts</div>
                  </div>
                  <div className="text-[8px] text-gray-650 font-mono tracking-wide uppercase">Formula: abs(our - book)</div>
                </div>
              </div>

              {/* Quantum Moneyline Analytical Model Card */}
              <div className="p-5 bg-gradient-to-b from-gray-950 to-gray-900 border border-gray-800 rounded-xl space-y-4">
                <div className="flex items-center justify-between border-b border-gray-900 pb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="text-emerald-400" size={16} />
                    <span className="text-[11px] font-black text-white uppercase tracking-wider font-sans">
                      Quantum Money Line Projection Model
                    </span>
                  </div>
                  <span className={`text-[9.5px] font-mono tracking-widest uppercase px-2.5 py-0.5 rounded border ${
                    prediction.mlEdgeCategory === 'Strong edge' 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-black' 
                      : prediction.mlEdgeCategory === 'Moderate edge'
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-300 font-bold'
                      : 'bg-gray-900 border-gray-800 text-gray-550'
                  }`}>
                    {prediction.mlEdgeCategory === 'No bet' ? 'No Edge Signal' : `${prediction.mlEdgeCategory}`}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
                  
                  {/* Home Team ML Projections */}
                  <div className="p-3.5 bg-gray-900/40 border border-gray-805 rounded-xl space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-rose-400 uppercase tracking-wider">{prediction.homeTeam} (Home)</span>
                      <span className="text-[9.5px] font-mono text-gray-400 uppercase">Win Prob: <b className="text-white">{(prediction.projectedHomeWinProb * 100).toFixed(1)}%</b></span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="p-2 bg-gray-950 rounded border border-gray-900">
                        <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider block">Model Target ML</span>
                        <span className="text-sm font-mono font-bold text-white mt-1 block">
                          {prediction.projectedHomeML > 0 ? `+${prediction.projectedHomeML}` : prediction.projectedHomeML}
                        </span>
                      </div>
                      <div className="p-2 bg-gray-950 rounded border border-gray-900">
                        <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider block">Sportsbook ML</span>
                        <span className="text-sm font-mono font-bold text-gray-400 mt-1 block">
                          {prediction.bookHomeML > 0 ? `+${prediction.bookHomeML}` : prediction.bookHomeML}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Away Team ML Projections */}
                  <div className="p-3.5 bg-gray-900/40 border border-gray-805 rounded-xl space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-blue-400 uppercase tracking-wider">{prediction.awayTeam} (Away)</span>
                      <span className="text-[9.5px] font-mono text-gray-400 uppercase">Win Prob: <b className="text-white">{(prediction.projectedAwayWinProb * 100).toFixed(1)}%</b></span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="p-2 bg-gray-950 rounded border border-gray-100/10">
                        <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider block">Model Target ML</span>
                        <span className="text-sm font-mono font-bold text-white mt-1 block">
                          {prediction.projectedAwayML > 0 ? `+${prediction.projectedAwayML}` : prediction.projectedAwayML}
                        </span>
                      </div>
                      <div className="p-2 bg-gray-950 rounded border border-gray-100/10">
                        <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider block">Sportsbook ML</span>
                        <span className="text-sm font-mono font-bold text-gray-400 mt-1 block">
                          {prediction.bookAwayML > 0 ? `+${prediction.bookAwayML}` : prediction.bookAwayML}
                        </span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Moneyline recommendation block banner */}
                <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex flex-col sm:flex-row items-center justify-between text-xs gap-3">
                  <span className="text-[10px] text-gray-300 font-sans text-center sm:text-left leading-relaxed">
                    {prediction.mlEdgePct > 0 ? (
                      <span>
                        Calculated edge: <b className="text-emerald-400">+{prediction.mlEdgePct}% win probability premium</b> on the <b className="text-white">{prediction.mlEdgeTeam}</b> compared to current sportsbook odds.
                      </span>
                    ) : (
                      <span>No mathematical positive edge signal detected on the moneyline at these odds.</span>
                    )}
                  </span>
                  
                </div>
              </div>

              {/* Key Indicators grid: Team NetRtg & Pace comparison (Bento) */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Team stats list */}
                <div className="md:col-span-12 p-4 bg-gray-950 border border-gray-800 rounded-xl space-y-4">
                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block border-b border-gray-900 pb-2">
                    Matchup Intelligence Grid
                  </span>
                  
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="text-left font-bold text-gray-500 uppercase tracking-widest text-[8px] self-center">Team Metrics</div>
                    <div className="font-bold text-blue-300 font-mono mr-2">{prediction.awayTeam}</div>
                    <div className="font-bold text-rose-300 font-mono ml-2">{prediction.homeTeam}</div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs items-center border-t border-gray-900 pt-2 pb-1">
                    <div className="text-left font-bold text-gray-400 uppercase tracking-normal text-[9px]">Net Rating (L15)</div>
                    <div className="font-mono text-blue-400">+{prediction.awayNetRtg}</div>
                    <div className="font-mono text-rose-400">+{prediction.homeNetRtg}</div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs items-center border-t border-gray-900 pt-2 pb-1">
                    <div className="text-left font-bold text-gray-400 uppercase tracking-normal text-[9px]">Average Game Pace</div>
                    <div className="font-mono text-gray-300">{prediction.awayPace}</div>
                    <div className="font-mono text-gray-300">{prediction.homePace}</div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs items-center border-t border-gray-900 pt-2 pb-1">
                    <div className="text-left font-bold text-gray-400 uppercase tracking-normal text-[9px]">True Shooting (TS%)</div>
                    <div className="font-mono text-gray-400">{prediction.awayTS}%</div>
                    <div className="font-mono text-gray-400">{prediction.homeTS}%</div>
                  </div>
                </div>
              </div>

              {/* Injury Bullet lists */}
              <div className="p-4 bg-gray-950 border border-gray-800 rounded-xl space-y-3">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block border-b border-gray-900 pb-2">
                  Injury & Availability Report
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {prediction.injuryReport.map((injury, index) => (
                    <div key={index} className="flex items-start gap-2 text-[10px] text-gray-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1 shrink-0"></span>
                      <span>{injury}</span>
                    </div>
                  ))}
                  {prediction.injuryReport.length === 0 && (
                    <div className="text-[10px] text-gray-500">No major injuries noted on roster file.</div>
                  )}
                </div>
              </div>

              {/* Player level stats lists (TS%, USG%, Minutes) */}
              <div className="p-4 bg-gray-950 border border-gray-800 rounded-xl space-y-3.5">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block border-b border-gray-900 pb-2">
                  Active Star Rosters (USG%, TS%, MIN)
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Home Team players */}
                  <div>
                    <h5 className="text-[9px] font-bold text-rose-400 uppercase tracking-wider mb-2.5">{prediction.homeTeam} Target Stars</h5>
                    <div className="divide-y divide-gray-900 space-y-2 text-xs">
                      {prediction.homePlayerStats?.map((p, i) => (
                        <div key={i} className="flex justify-between items-center py-1 bg-gray-900/40 p-2.5 rounded border border-gray-900">
                          <div>
                            <span className="font-bold text-white block">{p.playerName}</span>
                            <span className="text-[8px] text-gray-500 font-mono uppercase">{p.minutes} min/game</span>
                          </div>
                          <div className="text-right font-mono text-[10px] space-x-3">
                            <span className="text-gray-400"><b className="text-gray-500 font-normal">USG:</b> {p.usg}%</span>
                            <span className="text-gray-400"><b className="text-gray-500 font-normal">TS:</b> {p.ts}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Away Team players */}
                  <div>
                    <h5 className="text-[9px] font-bold text-blue-400 uppercase tracking-wider mb-2.5">{prediction.awayTeam} Target Stars</h5>
                    <div className="divide-y divide-gray-900 space-y-2 text-xs">
                      {prediction.awayPlayerStats?.map((p, i) => (
                        <div key={i} className="flex justify-between items-center py-1 bg-gray-900/40 p-2.5 rounded border border-gray-900">
                          <div>
                            <span className="font-bold text-white block">{p.playerName}</span>
                            <span className="text-[8px] text-gray-500 font-mono uppercase">{p.minutes} min/game</span>
                          </div>
                          <div className="text-right font-mono text-[10px] space-x-3">
                            <span className="text-gray-400"><b className="text-gray-500 font-normal">USG:</b> {p.usg}%</span>
                            <span className="text-gray-400"><b className="text-gray-500 font-normal">TS:</b> {p.ts}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Recommended Player Props edges */}
              <div className="p-4 bg-gray-950 border border-gray-800 rounded-xl space-y-3.5">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block border-b border-gray-900 pb-2">
                  AI Edge Handcrafted Player Props
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {prediction.playerProps?.map((prop, idx) => (
                    <div key={idx} className="p-3 bg-gray-900/60 border border-gray-805 rounded-xl flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <span className="text-[9px] font-mono text-gray-500 uppercase">{prop.playerName}</span>
                          <span className="text-[8px] bg-blue-500/10 text-blue-400 border border-blue-500/15 px-1.5 py-0.5 rounded font-mono uppercase font-bold">{prop.overUnder}</span>
                        </div>
                        <div className="text-sm font-bold text-white mt-1.5">
                          {prop.statType}: {prop.line}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-1">
                          Projected Line Score: <span className="text-white font-mono font-bold">{prop.projected}</span>
                        </div>
                      </div>
                      
                      <div className="border-t border-gray-800 mt-3 pt-2.5 flex items-center justify-between">
                        <span className="text-[9px] text-emerald-400 block font-bold font-mono">Edge: {prop.edgePct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action layout footer */}
              <div className="border-t border-gray-800 pt-5 flex flex-col sm:flex-row justify-between items-center gap-4">
                <span className="text-[9px] text-gray-500 uppercase font-mono">
                  Grounded {selectedLeague} Model calculation complete
                </span>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
};
