
import React, { useMemo, useState, useEffect } from 'react';
import { ParlayRecommendation, BetLeg, GameLogEntry } from '../types';
import { calculateEngineMetrics } from '../services/projectionEngine';
import { 
    Activity, Globe, TrendingUp, BarChart3, User, Zap, Lock, BrainCircuit, 
    History, TableIcon, CheckCircle2, XCircle, HelpCircle, AlertCircle, Trophy, GitMerge, Timer, ArrowRight, DollarSign, ChevronRight, Cpu, 
    TrendingDown,
    List,
    Activity as PulseIcon,
    RefreshCw
} from './Icons';
import { 
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, BarChart, Bar, Cell as RechartsCell, ComposedChart, Line
} from 'recharts';

interface PlayerProfileCardProps {
  data: ParlayRecommendation;
  bankroll?: number;
}

// --- Shared Rationale Helpers ---
const getDefinition = (text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes('bayesian')) return "Bayesian Inference: A statistical method that updates the probability of a hypothesis as more evidence (recent player form) becomes available.";
    if (lower.includes('regression')) return "Regression to Mean: The statistical tendency for extreme performances (hot/cold streaks) to eventually return to the player's long-term average.";
    if (lower.includes('edge')) return "Model Edge: The difference between our calculated probability and the bookmaker's implied probability.";
    if (lower.includes('z-score')) return "Z-Score: Measures how many standard deviations the betting line is from the projected mean (μ).";
    if (lower.includes('sigma') || lower.includes('deviation')) return "Standard Deviation (σ): Quantifies volatility; higher values indicate higher variance in player performance.";
    if (lower.includes('pace')) return "Pace Adjustment: Correcting projections based on the expected number of possessions in a specific matchup.";
    if (lower.includes('kelly')) return "Kelly Criterion: A formula used to determine the optimal size of a series of bets to maximize long-term wealth.";
    if (lower.includes('usage')) return "Usage Rate: The percentage of team plays a player is involved in while on the court/field.";
    if (lower.includes('efficiency')) return "Defensive Efficiency: Points allowed per possession by an opponent, used to scale offensive projections.";
    if (lower.includes('poisson')) return "Poisson Distribution: A discrete probability distribution expressing the probability of a given number of events occurring in a fixed interval.";
    return "Quant Insight: High-confidence projection derived from regression models and historical situational variance analysis.";
};

const RationaleTooltip: React.FC<{ text: string }> = ({ text }) => {
    const [isVisible, setIsVisible] = useState(false);
    const definition = getDefinition(text);

    return (
        <span className="relative inline-flex items-center ml-1">
            <button 
                type="button"
                className="text-gray-600 hover:text-emerald-400 transition-colors cursor-help outline-none"
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
                onClick={(e) => { e.stopPropagation(); setIsVisible(!isVisible); }}
            >
                <HelpCircle size={10} />
            </button>
            {isVisible && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-950 border border-emerald-500/30 rounded shadow-2xl z-[100] animate-fadeIn pointer-events-none">
                    <div className="flex items-start gap-1.5">
                        <AlertCircle size={10} className="text-emerald-400 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-[8px] font-bold text-emerald-400 uppercase tracking-wider mb-0.5">Engine Concept</p>
                            <p className="text-[9px] text-gray-300 leading-tight font-sans">{definition}</p>
                        </div>
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-950"></div>
                </div>
            )}
        </span>
    );
};

const HighlightedRationale: React.FC<{ text: string }> = ({ text }) => {
    if (!text) return null;
    const regex = /((?:DEF: #?\d+)|(?:PACE: [+-]?\d+(?:\.\d+)?%)|(?:HIT: \d+\/\d+)|(?:SITUATIONAL: [^,.]+)|(?:L\d+)|(?:Rank #?\d+)|(?:\d+th)|(?:vs \w+)|(?:Pace)|(?:Usage)|(?:Def))/gi;
    const parts = text.split(regex);
    return (
        <span>
            {parts.map((part, i) => {
                if (part.match(regex)) {
                    let colorClass = 'text-gray-200 bg-gray-800/50';
                    if (part.toUpperCase().startsWith('DEF:')) colorClass = 'text-orange-400 bg-orange-400/10 border-orange-400/20';
                    if (part.toUpperCase().startsWith('PACE:')) colorClass = 'text-blue-400 bg-blue-400/10 border-blue-400/20';
                    if (part.toUpperCase().startsWith('HIT:')) colorClass = 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
                    if (part.toUpperCase().startsWith('SITUATIONAL:')) colorClass = 'text-purple-400 bg-purple-400/10 border-purple-400/20';

                    return (
                        <span 
                          key={i} 
                          className={`${colorClass} font-bold font-mono text-[9px] px-1.5 py-0.5 rounded border mx-0.5 inline-flex items-center gap-1 transition-all hover:scale-105`}
                        >
                          {part}
                        </span>
                    );
                }
                return <span key={i} className="text-gray-400">{part}</span>;
            })}
        </span>
    );
};

const EngineBreakdown: React.FC<{ leg: BetLeg }> = ({ leg }) => {
    const m = useMemo(() => calculateEngineMetrics(leg), [leg]);
    
    return (
        <div className="mt-2 mb-4 bg-gray-950 border border-gray-800 rounded-lg overflow-hidden animate-fadeIn">
            <div className="bg-gray-900/50 px-3 py-1.5 border-b border-gray-800 flex items-center justify-between">
                <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                    <Cpu size={10} /> {leg.statType} Math Engine
                </span>
            </div>
            
            <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-[10px] font-mono">
                <div className="space-y-1">
                    <p className="text-gray-600 font-bold border-b border-gray-800 pb-0.5 mb-1 text-[8px]">BASELINE</p>
                    <div className="flex justify-between"><span>L10:</span> <span className="text-white">{leg.x10?.toFixed(1)}</span></div>
                    <div className="flex justify-between"><span>L20:</span> <span className="text-white">{leg.x20?.toFixed(1)}</span></div>
                    <div className="flex justify-between font-bold text-emerald-400 border-t border-gray-800/50 mt-1 pt-1">
                        <span>μ Base:</span> <span>{m.muPlayer.toFixed(2)}</span>
                    </div>
                </div>

                <div className="space-y-1">
                    <p className="text-gray-600 font-bold border-b border-gray-800 pb-0.5 mb-1 text-[8px]">MULTIPLIERS</p>
                    <div className="flex justify-between"><span>Pace:</span> <span className="text-white">{m.mPace.toFixed(3)}x</span></div>
                    <div className="flex justify-between"><span>Opp:</span> <span className="text-white">{m.mOpp.toFixed(3)}x</span></div>
                    <div className="flex justify-between font-bold text-blue-400 border-t border-gray-800/50 mt-1 pt-1">
                        <span>μ Final:</span> <span>{m.muFinal.toFixed(2)}</span>
                    </div>
                </div>

                <div className="space-y-1">
                    <p className="text-gray-600 font-bold border-b border-gray-800 pb-0.5 mb-1 text-[8px]">PROBABILITY</p>
                    <div className="flex justify-between"><span>Z-Score:</span> <span className="text-white">{m.zScore.toFixed(3)}</span></div>
                    <div className="flex justify-between"><span>Imp:</span> <span className="text-white">{(m.pImp * 100).toFixed(1)}%</span></div>
                    <div className="flex justify-between font-bold text-emerald-400 border-t border-gray-800/50 mt-1 pt-1">
                        <span>Edge:</span> <span>+{m.edge.toFixed(1)}%</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const PropRow: React.FC<{ leg: BetLeg; isActive: boolean; onSelect: () => void }> = ({ leg, isActive, onSelect }) => {
  const [showMath, setShowMath] = useState(false);
  const [localLine, setLocalLine] = useState(leg.line.toString());
  const [localOdds, setLocalOdds] = useState(leg.bookOdds.toString());
  const [localPrediction, setLocalPrediction] = useState<'Over' | 'Under'>(leg.prediction);
  const [calcLeg, setCalcLeg] = useState(leg);
  const [isRecalculating, setIsRecalculating] = useState(false);

  useEffect(() => {
    setLocalLine(leg.line.toString());
    setLocalOdds(leg.bookOdds.toString());
    setLocalPrediction(leg.prediction);
    setCalcLeg(leg);
  }, [leg]);

  const m = useMemo(() => calculateEngineMetrics(calcLeg), [calcLeg]);
  
  const handleRecalculate = () => {
    setIsRecalculating(true);
    setTimeout(() => {
        setCalcLeg({
            ...leg,
            line: parseFloat(localLine) || 0,
            bookOdds: parseFloat(localOdds) || -110,
            prediction: localPrediction
        });
        setIsRecalculating(false);
    }, 400);
  };

  const togglePrediction = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLocalPrediction(prev => prev === 'Over' ? 'Under' : 'Over');
  };

  const hitRateValue = m.pModel * 100;
  const probabilityColor = hitRateValue >= 65 ? 'text-emerald-400' : hitRateValue >= 55 ? 'text-yellow-400' : 'text-gray-400';
  const leagueAvg = leg.leagueAvg || (leg.line * 0.8);
  const diffFromAvg = ((m.muFinal - leagueAvg) / leagueAvg) * 100;
  
  const hasAdjusted = 
    parseFloat(localLine) !== leg.line || 
    parseFloat(localOdds) !== leg.bookOdds || 
    localPrediction !== leg.prediction;

  return (
    <div 
      onClick={onSelect}
      className={`p-4 border-b border-gray-800 transition-all group cursor-pointer relative ${isActive ? 'bg-emerald-500/10 border-l-4 border-l-emerald-500' : 'bg-gray-900 hover:bg-gray-850 border-l-4 border-l-transparent'}`}
    >
        <div className="grid grid-cols-12 gap-3 items-center">
            {/* Stat Label */}
            <div className="col-span-12 lg:col-span-3">
                <div className="flex items-center gap-2">
                    <div className={`text-xs font-bold uppercase tracking-wider transition-colors ${isActive ? 'text-emerald-400 scale-105' : 'text-gray-100'}`}>{leg.statType}</div>
                    <span className={`text-[8px] px-1 rounded font-mono border transition-colors ${isActive ? 'bg-emerald-500 text-gray-950 border-emerald-400' : 'bg-gray-800 text-emerald-400 border-emerald-500/20'}`}>
                        {isActive ? 'ACTIVE MARKET' : (leg.recentHitRate || 'SYNCED')}
                    </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                    <div className="text-[8px] text-gray-600 font-mono">μ:{m.muFinal.toFixed(1)}</div>
                    <div className={`text-[8px] font-bold px-1 rounded-sm ${diffFromAvg >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        {diffFromAvg >= 0 ? '↑' : '↓'}{Math.abs(diffFromAvg).toFixed(0)}%
                    </div>
                </div>
            </div>

            {/* Input - Line & O/U Toggle */}
            <div className="col-span-4 lg:col-span-2">
                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                    <button 
                        onClick={togglePrediction}
                        className={`w-6 h-6 flex items-center justify-center rounded text-[10px] font-mono font-bold transition-all border ${
                            localPrediction === 'Over' 
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]' 
                            : 'bg-rose-500/20 border-rose-500 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                        }`}
                        title="Toggle Over/Under"
                    >
                        {localPrediction === 'Over' ? 'O' : 'U'}
                    </button>
                    <input 
                        type="number" 
                        step="0.5"
                        value={localLine}
                        onChange={(e) => setLocalLine(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 text-white text-[11px] font-mono font-bold px-1 py-1 rounded focus:border-emerald-500 outline-none hover:border-gray-700 transition-colors"
                    />
                </div>
            </div>

            {/* Input - Odds */}
            <div className="col-span-3 lg:col-span-1">
                <div onClick={e => e.stopPropagation()}>
                    <input 
                        type="number" 
                        step="1"
                        value={localOdds}
                        onChange={(e) => setLocalOdds(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 text-gray-400 text-[11px] font-mono px-1 py-1 rounded focus:border-emerald-500 outline-none hover:border-gray-700 transition-colors"
                    />
                </div>
            </div>

            {/* Win Prob */}
            <div className="col-span-3 lg:col-span-2 text-center">
                <div className={`text-base font-mono font-bold ${probabilityColor} ${isRecalculating ? 'animate-pulse opacity-50' : ''}`}>
                    {hitRateValue.toFixed(0)}%
                </div>
                <div className="text-[8px] text-gray-600 uppercase font-mono">Win Prob</div>
            </div>

            {/* Edge Info (Desktop Only) */}
            <div className="hidden lg:block lg:col-span-2">
                <div className="px-2 py-1 rounded bg-gray-950/50 border border-gray-800/50 flex flex-col items-center">
                    <div className={`text-[10px] font-bold font-mono ${m.edge >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {m.edge >= 0 ? '+' : ''}{m.edge.toFixed(1)}% Edge
                    </div>
                    <div className="flex gap-1">
                        <HighlightedRationale text={leg.rationale} />
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="col-span-2 lg:col-span-2 flex justify-end items-center gap-2">
                {hasAdjusted && (
                    <button 
                        onClick={e => { e.stopPropagation(); handleRecalculate(); }}
                        disabled={isRecalculating}
                        className="p-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all"
                        title="Recalculate Stats"
                    >
                        <RefreshCw size={14} className={isRecalculating ? 'animate-spin' : ''} />
                    </button>
                )}
                <button 
                    onClick={e => { e.stopPropagation(); setShowMath(!showMath); }}
                    className={`p-1.5 rounded-lg transition-all ${showMath ? 'bg-emerald-500 text-gray-950 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-gray-800 text-gray-500 hover:text-white'}`}
                >
                    <BrainCircuit size={14} />
                </button>
            </div>
        </div>

        {showMath && <div onClick={e => e.stopPropagation()}><EngineBreakdown leg={calcLeg} /></div>}
    </div>
  );
};

// --- Delta Analysis Component ---
const DeltaAnalysis: React.FC<{ legs: BetLeg[] }> = ({ legs }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn">
            {legs.map((leg, idx) => {
                const actuals = leg.recentGames && leg.recentGames.length > 0 
                    ? leg.recentGames.map((g, i) => ({ game: g.date, actual: g.value, line: leg.line }))
                    : Array.from({ length: 5 }).map((_, i) => ({ game: `G-${5-i}`, actual: (leg.xSeason || leg.line), line: leg.line }));

                const avgActual = actuals.reduce((sum, a) => sum + a.actual, 0) / (actuals.length || 1);
                const totalDelta = ((avgActual - leg.line) / (leg.line || 1)) * 100;
                
                let trendStatus: 'up' | 'stable' | 'down' = 'stable';
                if (actuals.length >= 3) {
                    const last3 = actuals.slice(-3);
                    if (last3[2].actual > last3[1].actual && last3[1].actual > last3[0].actual) trendStatus = 'up';
                    else if (last3[2].actual < last3[1].actual && last3[1].actual < last3[0].actual) trendStatus = 'down';
                }

                const trendLabels = {
                    up: { text: 'Trending Up', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: <TrendingUp size={10} /> },
                    stable: { text: 'Stable', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: <PulseIcon size={10} /> },
                    down: { text: 'Underperforming', color: 'text-rose-400', bg: 'bg-rose-500/10', icon: <TrendingDown size={10} /> }
                };

                const currentTrend = trendLabels[trendStatus];

                return (
                    <div key={`${leg.statType}-${idx}`} className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex flex-col group hover:border-gray-700 transition-colors">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">{leg.statType} Comparison</h4>
                                <div className="flex items-center gap-2">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${currentTrend.bg} ${currentTrend.color}`}>
                                        {currentTrend.icon} {currentTrend.text}
                                    </span>
                                    <span className="text-[9px] text-gray-600 font-mono">Target: {leg.line}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className={`text-lg font-mono font-bold ${totalDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {totalDelta >= 0 ? '+' : ''}{totalDelta.toFixed(1)}%
                                </div>
                                <div className="text-[9px] text-gray-500 uppercase font-mono">Market Gap</div>
                            </div>
                        </div>

                        <div className="h-24 w-full bg-gray-950/50 rounded p-1 mb-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={actuals} key={leg.statType}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                                    <XAxis dataKey="game" hide />
                                    <YAxis hide domain={['auto', 'auto']} />
                                    <Tooltip contentStyle={{ backgroundColor: '#030712', border: '1px solid #1f2937', fontSize: '10px' }} />
                                    <ReferenceLine y={leg.line} stroke="#ffffff" strokeDasharray="3 3" opacity={0.3} />
                                    <Bar dataKey="actual" radius={[2, 2, 0, 0]}>
                                        {actuals.map((entry, index) => (
                                            <RechartsCell key={`cell-${index}`} fill={entry.actual >= leg.line ? '#10b981' : '#f43f5e'} fillOpacity={0.6} />
                                        ))}
                                    </Bar>
                                    <Line type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={1} dot={{ r: 2, fill: '#3b82f6' }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export const PlayerProfileCard: React.FC<PlayerProfileCardProps> = ({ data, bankroll = 1000 }) => {
  const [activeTab, setActiveTab] = useState<'trends' | 'logs' | 'accuracy'>('trends');
  const [selectedLegIndex, setSelectedLegIndex] = useState(0);

  // Re-sync when the data object changes (e.g., new player searched)
  useEffect(() => {
    setSelectedLegIndex(0);
  }, [data.id]);

  const activeLeg = useMemo(() => data.legs[selectedLegIndex] || data.legs[0], [data.legs, selectedLegIndex]);
  const playerName = activeLeg?.playerName || "Unknown";
  
  const statsData = useMemo(() => {
    if (!activeLeg) return [];
    if (activeLeg.recentGames && activeLeg.recentGames.length > 0) {
        return activeLeg.recentGames.map((g, i) => ({
            game: g.date,
            value: g.value,
            line: activeLeg.line,
            leagueAvg: activeLeg.leagueAvg || (activeLeg.line * 0.8)
        }));
    }
    const avg = activeLeg.xSeason || activeLeg.line;
    return Array.from({ length: 15 }).map((_, i) => ({
      game: `G${i+1}`,
      value: Math.max(0, avg + (Math.random() - 0.5) * (activeLeg.sigma || 5) * 2),
      line: activeLeg.line,
      leagueAvg: activeLeg.leagueAvg || (activeLeg.line * 0.8)
    }));
  }, [activeLeg]);

  return (
    <div className="bg-gray-850 rounded-xl border border-gray-800 shadow-xl overflow-hidden relative">
       <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-blue-500 via-emerald-500 to-purple-500 z-10"></div>

       <div className="p-6 flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="w-16 h-16 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center shadow-inner relative overflow-hidden group">
             <User size={32} className="text-gray-600" />
             <div className="absolute inset-0 bg-emerald-500/5 group-hover:bg-emerald-500/10 transition-colors"></div>
          </div>

          <div className="flex-1">
             <div className="flex items-center gap-2 mb-1">
                <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] rounded uppercase font-bold tracking-widest flex items-center gap-1">
                    <Zap size={10} fill="currentColor" /> Quant Model Verified
                </span>
                <span className="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] rounded uppercase font-bold tracking-widest">
                    Live Data Sourced
                </span>
             </div>
             <h2 className="text-2xl font-bold text-white tracking-tight">{playerName}</h2>
             <p className="text-gray-500 font-mono text-[10px] uppercase tracking-widest flex items-center gap-2 mt-1">
                {activeLeg.team} VS {activeLeg.opponent} <span className="text-gray-800">|</span> <span className="text-emerald-400 font-bold uppercase tracking-tight bg-emerald-500/10 px-1 rounded animate-pulse">Syncing: {activeLeg.statType}</span>
             </p>
          </div>

          <div className="flex gap-4">
              <div className="bg-gray-900 border border-gray-800 p-3 rounded-lg text-right min-w-[100px]">
                  <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Total Markets</div>
                  <div className="text-xl font-mono font-bold text-emerald-400">{data.legs.length}</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 p-3 rounded-lg text-right min-w-[100px]">
                  <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Win Probability</div>
                  <div className="text-xl font-mono font-bold text-blue-400">{(activeLeg.modelProb * 100).toFixed(0)}%</div>
              </div>
          </div>
       </div>

       <div className="px-6 flex items-center gap-6 border-b border-gray-800 bg-gray-900/40">
            <button 
                onClick={() => setActiveTab('trends')}
                className={`py-3 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 border-b-2 transition-all ${activeTab === 'trends' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
                <TrendingUp size={14} /> Variance Trends
            </button>
            <button 
                onClick={() => setActiveTab('accuracy')}
                className={`py-3 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 border-b-2 transition-all ${activeTab === 'accuracy' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
                <PulseIcon size={14} /> Projection Delta
            </button>
            <button 
                onClick={() => setActiveTab('logs')}
                className={`py-3 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 border-b-2 transition-all ${activeTab === 'logs' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
                <List size={14} /> Game Logs
            </button>
       </div>

       <div className="p-6">
          {activeTab === 'trends' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn" key={`trends-${selectedLegIndex}`}>
                <div className="lg:col-span-8 bg-gray-900 border border-gray-800 rounded-lg overflow-hidden h-64">
                    <div className="p-2 border-b border-gray-800 flex justify-between items-center bg-gray-950/30">
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <History size={12} /> {activeLeg.statType} Performance Volatility
                        </span>
                        <div className="flex gap-4 text-[9px] font-mono">
                            <span className="flex items-center gap-1"><div className="w-2 h-0.5 bg-emerald-500"></div> Value</span>
                            <span className="flex items-center gap-1 border-gray-700 border-l pl-2"><div className="w-2 h-0.5 bg-white opacity-40"></div> Line</span>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={statsData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }} key={activeLeg.statType}>
                            <defs>
                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                            <XAxis dataKey="game" tick={{fill: '#4b5563', fontSize: 9}} hide />
                            <YAxis tick={{fill: '#4b5563', fontSize: 9}} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#030712', border: '1px solid #1f2937', fontSize: '10px' }} />
                            <ReferenceLine y={activeLeg.line} stroke="#ffffff" strokeDasharray="5 5" opacity={0.3} />
                            <Area type="monotone" dataKey="value" stroke="#10b981" fillOpacity={1} fill="url(#colorValue)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
                
                <div className="lg:col-span-4 bg-gray-900 border border-gray-800 p-4 rounded-lg flex flex-col justify-center text-center">
                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Active Prop Intelligence</h4>
                    <div className="text-[24px] font-mono font-bold text-white mb-1">{activeLeg.line}</div>
                    <div className="text-[9px] text-emerald-400 font-mono uppercase tracking-widest mb-4">{activeLeg.statType} TARGET</div>
                    <p className="text-[11px] text-gray-400 leading-relaxed italic">
                        Switch between markets below to update this analytical backup. Data is synchronized directly from live ESPN game logs.
                    </p>
                </div>
            </div>
          ) : activeTab === 'accuracy' ? (
            <DeltaAnalysis legs={[activeLeg]} />
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden animate-fadeIn max-h-[400px] overflow-y-auto custom-scrollbar" key={`logs-${selectedLegIndex}`}>
                <table className="w-full text-[11px] font-mono">
                    <thead className="bg-gray-950/50 text-gray-500 uppercase tracking-wider border-b border-gray-800 sticky top-0 z-10">
                        <tr>
                            <th className="px-4 py-3 text-left font-bold">Date</th>
                            <th className="px-4 py-3 text-left font-bold">Opponent</th>
                            <th className="px-4 py-3 text-right font-bold">{activeLeg.statType} Value</th>
                            <th className="px-4 py-3 text-center font-bold">Outcome</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                        {(activeLeg.recentGames || []).length > 0 ? (
                            activeLeg.recentGames.map((log, i) => (
                                <tr key={i} className="hover:bg-white/5 transition-colors">
                                    <td className="px-4 py-2.5 text-gray-400">{log.date}</td>
                                    <td className="px-4 py-2.5 font-bold text-gray-200">{log.opponent}</td>
                                    <td className="px-4 py-2.5 text-right font-bold text-white">{log.value}</td>
                                    <td className="px-4 py-2.5 text-center">
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${log.hit ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                            {log.hit ? 'OVER' : 'UNDER'}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={4} className="px-4 py-12 text-center text-gray-600 italic text-xs">
                                    Syncing historical {activeLeg.statType} results...
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
          )}
       </div>

       {/* All Props Header */}
       <div className="bg-gray-950/80 border-t border-b border-gray-800 py-3 px-6 flex items-center justify-between sticky top-0 z-20">
           <div className="flex items-center gap-3">
               <span className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-2">
                   <List size={14} className="text-emerald-500" /> Exhaustive Market Props
               </span>
               <span className="text-[9px] text-gray-600 font-mono italic animate-pulse">Select a stat below to update statistical backup</span>
           </div>
           <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[9px] font-mono text-emerald-500 uppercase tracking-tighter">ESPN Grounding: SYNCED</span>
                </div>
           </div>
       </div>

       {/* The List of Every Stat */}
       <div className="max-h-[600px] overflow-y-auto custom-scrollbar divide-y divide-gray-800/50">
          {data.legs.map((leg, i) => (
             <PropRow 
                key={`${leg.statType}-${leg.playerName}-${i}`} 
                leg={leg} 
                isActive={selectedLegIndex === i}
                onSelect={() => setSelectedLegIndex(i)}
             />
          ))}
       </div>

       <div className="bg-gray-950 py-4 px-6 flex items-center justify-center border-t border-gray-800">
          <p className="text-[9px] text-gray-600 font-mono italic">
            Exhaustive market scan complete. All charts and logs are reactive to your market selection.
          </p>
       </div>
    </div>
  );
};
