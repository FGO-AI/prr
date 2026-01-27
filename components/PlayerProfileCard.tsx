
import React, { useMemo, useState, useEffect } from 'react';
import { ParlayRecommendation, BetLeg, GameLogEntry, League } from '../types';
import { calculateEngineMetrics } from '../services/projectionEngine';
import { 
    Activity, Globe, TrendingUp, BarChart3, User, Zap, Lock, BrainCircuit, 
    HistoryIcon, TableIcon, CheckCircle2, XCircle, HelpCircle, AlertCircle, Trophy, GitMerge, Timer, ArrowRight, DollarSign, ChevronRight, Cpu, 
    TrendingDown,
    ListIcon,
    RefreshCw,
    Search,
    Book,
    Timer as ClockIcon,
    Target
} from './Icons';
import { 
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Line
} from 'recharts';

interface PlayerProfileCardProps {
  data: ParlayRecommendation;
  bankroll?: number;
}

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

const PerformanceDeltaAnalysis: React.FC<{ leg: BetLeg }> = ({ leg }) => {
    const recentGames = useMemo(() => (leg.recentGames || []).slice(0, 10), [leg.recentGames]);
    const last5 = useMemo(() => recentGames.slice(0, 5).reverse(), [recentGames]);
    
    const trendAnalysis = useMemo(() => {
        if (last5.length < 2) return { status: 'STABLE', color: 'text-blue-400', bg: 'bg-blue-500/10', summary: "Insufficient game logs for variance trend detection." };
        
        const actuals = last5.map(g => g.value);
        const hits = last5.filter(g => g.value >= leg.line).length;
        const avgActual = actuals.reduce((a, b) => a + b, 0) / actuals.length;
        const deviation = ((avgActual - leg.line) / leg.line) * 100;
        
        // Performance Trend Logic
        if (hits >= 4 || (actuals[actuals.length - 1] > leg.line * 1.2 && actuals[actuals.length - 2] > leg.line)) {
            return { 
                status: 'TRENDING UP', 
                color: 'text-emerald-400', 
                bg: 'bg-emerald-500/10',
                summary: `Aggressive upward trajectory. Player is outperforming the ${leg.line} market line by ${deviation.toFixed(1)}% over the L5.` 
            };
        } else if (hits <= 1 || (actuals[actuals.length - 1] < leg.line * 0.8 && actuals[actuals.length - 2] < leg.line)) {
            return { 
                status: 'UNDERPERFORMING', 
                color: 'text-rose-400', 
                bg: 'bg-rose-500/10',
                summary: `Market line overvaluation detected. Performance is averaging ${Math.abs(deviation).toFixed(1)}% below the current ${leg.line} projection.` 
            };
        } else {
            return { 
                status: 'STABLE', 
                color: 'text-blue-400', 
                bg: 'bg-blue-500/10',
                summary: `Performance is oscillating within ±${Math.abs(deviation).toFixed(1)}% of the market line. High predictability profile.` 
            };
        }
    }, [last5, leg.line]);

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-center gap-4 ${trendAnalysis.bg} border-gray-800/50`}>
                <div className={`px-3 py-1.5 rounded-lg border border-current font-bold font-mono text-xs ${trendAnalysis.color}`}>
                    {trendAnalysis.status}
                </div>
                <div className="flex-1 text-xs text-gray-300 leading-relaxed font-medium italic">
                    <span className="text-gray-500 not-italic mr-2">ALGORITHMIC SUMMARY:</span>
                    "{trendAnalysis.summary}"
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {last5.map((game, idx) => {
                    const diff = game.value - leg.line;
                    const isHit = game.value >= leg.line;
                    return (
                        <div key={idx} className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex flex-col items-center group hover:border-gray-700 transition-all">
                            <div className="text-[8px] text-gray-600 font-mono uppercase mb-2">{game.date}</div>
                            <div className="text-xl font-mono font-bold text-white mb-1">{game.value}</div>
                            <div className={`text-[10px] font-bold font-mono ${isHit ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isHit ? '+' : ''}{diff.toFixed(1)}
                            </div>
                            <div className="w-full h-1 bg-gray-800 rounded-full mt-3 overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-500 ${isHit ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                    style={{ width: `${Math.min(100, (game.value / (leg.line * 1.5)) * 100)}%` }}
                                ></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const EngineBreakdown: React.FC<{ leg: BetLeg }> = ({ leg }) => {
    const m = useMemo(() => calculateEngineMetrics(leg), [leg]);
    const leagueAvg = leg.leagueAvg || (leg.line * 0.9);
    
    return (
        <div className="mt-2 mb-4 bg-gray-950 border border-gray-800 rounded-lg overflow-hidden animate-fadeIn">
            <div className="bg-gray-900/50 px-3 py-1.5 border-b border-gray-800 flex items-center justify-between">
                <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                    <Cpu size={10} /> {leg.statType} Bayesian Breakdown
                </span>
                <span className="text-[8px] text-gray-600 font-mono">League Baseline: {leagueAvg.toFixed(1)}</span>
            </div>
            
            <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-[10px] font-mono text-gray-400">
                <div className="space-y-1">
                    <p className="text-gray-600 font-bold border-b border-gray-800 pb-0.5 mb-1 text-[8px]">PLAYER PROFILE</p>
                    <div className="flex justify-between"><span>L10 Avg:</span> <span className="text-white">{leg.x10?.toFixed(1) || '0.0'}</span></div>
                    <div className="flex justify-between"><span>μ Base:</span> <span className="text-emerald-400">{m.muPlayer.toFixed(2)}</span></div>
                </div>
                <div className="space-y-1">
                    <p className="text-gray-600 font-bold border-b border-gray-800 pb-0.5 mb-1 text-[8px]">ADJUSTMENTS</p>
                    <div className="flex justify-between"><span>Pace Mod:</span> <span className="text-white">{m.mPace.toFixed(3)}x</span></div>
                    <div className="flex justify-between"><span>Def Mod:</span> <span className="text-white">{m.mOpp.toFixed(3)}x</span></div>
                </div>
                <div className="space-y-1">
                    <p className="text-gray-600 font-bold border-b border-gray-800 pb-0.5 mb-1 text-[8px]">PROJECTION</p>
                    <div className="flex justify-between"><span>μ Final:</span> <span className="text-blue-400 font-bold">{m.muFinal.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>Model Edge:</span> <span className="text-emerald-400 font-bold">+{m.edge.toFixed(1)}%</span></div>
                </div>
            </div>
        </div>
    );
};

const PropRow: React.FC<{ leg: BetLeg; isActive: boolean; onSelect: () => void }> = ({ leg, isActive, onSelect }) => {
  const [showMath, setShowMath] = useState(false);
  const m = useMemo(() => calculateEngineMetrics(leg), [leg]);
  const leagueAvg = leg.leagueAvg || (leg.line * 0.85);
  const diffFromAvg = leagueAvg > 0 ? ((m.muFinal - leagueAvg) / leagueAvg) * 100 : 0;

  return (
    <div 
      onClick={onSelect}
      className={`p-4 border-b border-gray-800 transition-all group cursor-pointer relative ${isActive ? 'bg-emerald-500/10 border-l-4 border-l-emerald-500' : 'bg-gray-900 hover:bg-gray-850 border-l-4 border-l-transparent'}`}
    >
        <div className="grid grid-cols-12 gap-3 items-center">
            <div className="col-span-12 lg:col-span-3">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-100">{leg.statType}</div>
                <div className="flex items-center gap-2 mt-0.5">
                    <div className="text-[8px] text-gray-600 font-mono">Lg Avg: {leagueAvg.toFixed(1)}</div>
                    <div className={`text-[8px] font-bold px-1 rounded-sm ${diffFromAvg >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        {diffFromAvg >= 0 ? '+' : ''}{diffFromAvg.toFixed(0)}% vs Avg
                    </div>
                </div>
            </div>
            <div className="col-span-4 lg:col-span-2">
                <div className="flex items-center gap-1.5">
                    <div className={`w-6 h-6 flex items-center justify-center rounded text-[10px] font-mono font-bold transition-all border ${
                        leg.prediction === 'Over' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-rose-500/20 border-rose-500 text-rose-400'
                    }`}>
                        {leg.prediction === 'Over' ? 'O' : 'U'}
                    </div>
                    <div className="text-white text-[11px] font-mono font-bold">{leg.line}</div>
                </div>
            </div>
            <div className="col-span-3 lg:col-span-1 text-center font-mono text-[11px] text-gray-500">{leg.bookOdds > 0 ? '+' : ''}{leg.bookOdds}</div>
            <div className="col-span-3 lg:col-span-2 text-center">
                <div className={`text-base font-mono font-bold ${m.pModel >= 0.6 ? 'text-emerald-400' : 'text-gray-400'}`}>{(m.pModel * 100).toFixed(0)}%</div>
                <div className="text-[8px] text-gray-600 uppercase font-mono tracking-tighter">Win Chance</div>
            </div>
            <div className="hidden lg:block lg:col-span-3 flex-wrap"><HighlightedRationale text={leg.rationale} /></div>
            <div className="col-span-2 lg:col-span-1 flex justify-end">
                <button onClick={e => { e.stopPropagation(); setShowMath(!showMath); }} className={`p-1.5 rounded-lg transition-all ${showMath ? 'bg-emerald-500 text-gray-950 shadow-lg' : 'bg-gray-800 text-gray-500'}`}>
                    <BrainCircuit size={14} />
                </button>
            </div>
        </div>
        {showMath && <div onClick={e => e.stopPropagation()}><EngineBreakdown leg={leg} /></div>}
    </div>
  );
};

export const PlayerProfileCard: React.FC<PlayerProfileCardProps> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<'delta' | 'trends' | 'logs'>('delta');
  const [selectedLegIndex, setSelectedLegIndex] = useState(0);

  useEffect(() => { setSelectedLegIndex(0); }, [data.id]);

  const activeLeg = useMemo(() => data.legs[selectedLegIndex] || data.legs[0], [data.legs, selectedLegIndex]);
  const playerName = activeLeg?.playerName || "Unknown";
  
  // Explicit League Detection (Usually passed down or inferred from data)
  const isNBA = activeLeg.team.match(/(LAL|GSW|BOS|DEN|MIL|PHI|PHX|DAL|SAS|NYK|MIA|CHI|HOU|LAC|OKC|MIN|CLE|IND|ORL|NOP|SAC|ATL|BKN|CHA|DET|MEM|POR|TOR|UTA|WAS)/i);
  const gameLimit = isNBA ? 10 : 5;

  const statsData = useMemo(() => {
    if (!activeLeg || !activeLeg.recentGames) return [];
    const leagueAvg = activeLeg.leagueAvg || (activeLeg.line * 0.85);
    return (activeLeg.recentGames || []).slice(0, gameLimit).map((g) => ({
        game: g.date,
        value: g.value,
        line: activeLeg.line,
        leagueAvg: leagueAvg
    }));
  }, [activeLeg, gameLimit]);

  return (
    <div className="bg-gray-850 rounded-xl border border-gray-800 shadow-xl overflow-hidden relative">
       <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-blue-500 via-emerald-500 to-purple-500 z-10"></div>
       <div className="p-6 flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="w-16 h-16 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center relative overflow-hidden">
             <User size={32} className="text-gray-600" />
             <div className="absolute inset-0 bg-emerald-500/5 transition-colors"></div>
          </div>
          <div className="flex-1">
             <div className="flex items-center gap-2 mb-1">
                <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] rounded uppercase font-bold tracking-widest flex items-center gap-1"><Zap size={10} fill="currentColor" /> Quant Model Verified</span>
                <span className="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] rounded uppercase font-bold tracking-widest">{activeLeg.team} Verified Feed</span>
             </div>
             <h2 className="text-2xl font-bold text-white tracking-tight">{playerName}</h2>
             <p className="text-gray-500 font-mono text-[10px] uppercase tracking-widest flex items-center gap-2 mt-1">
                {activeLeg.team} VS {activeLeg.opponent} <span className="text-gray-800">|</span> <span className="text-emerald-400 font-bold">Target: {activeLeg.statType}</span>
             </p>
          </div>
          <div className="flex gap-4">
              <div className="bg-gray-900 border border-gray-800 p-3 rounded-lg text-right min-w-[100px]">
                  <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Volatility (σ)</div>
                  <div className="text-xl font-mono font-bold text-orange-400">{(activeLeg.sigma || 2.4).toFixed(1)}</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 p-3 rounded-lg text-right min-w-[100px]">
                  <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Sample Size</div>
                  <div className="text-xl font-mono font-bold text-blue-400">{activeLeg.recentGames?.length || 0} G</div>
              </div>
          </div>
       </div>

       <div className="px-6 flex items-center gap-6 border-b border-gray-800 bg-gray-900/40">
            <button onClick={() => setActiveTab('delta')} className={`py-3 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 border-b-2 transition-all ${activeTab === 'delta' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}><Target size={14} /> Delta Analysis (L5)</button>
            <button onClick={() => setActiveTab('trends')} className={`py-3 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 border-b-2 transition-all ${activeTab === 'trends' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}><TrendingUp size={14} /> Historical Cycle</button>
            <button onClick={() => setActiveTab('logs')} className={`py-3 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 border-b-2 transition-all ${activeTab === 'logs' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}><ListIcon size={14} /> Master Log (L{gameLimit})</button>
       </div>

       <div className="p-6 min-h-[350px]">
          {activeTab === 'delta' ? (
             <PerformanceDeltaAnalysis leg={activeLeg} />
          ) : activeTab === 'trends' ? (
            <div className="animate-fadeIn h-64 w-full relative">
                <div className="absolute top-0 right-0 z-10 flex gap-4 text-[9px] font-mono p-2">
                    <span className="flex items-center gap-1"><div className="w-2 h-0.5 bg-emerald-500"></div> Player</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-0.5 bg-blue-500"></div> League Avg</span>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={statsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                        <XAxis dataKey="game" hide />
                        <YAxis tick={{fill: '#4b5563', fontSize: 9}} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#030712', border: '1px solid #1f2937', fontSize: '10px' }} />
                        <ReferenceLine y={activeLeg.line} stroke="#ffffff" strokeDasharray="5 5" opacity={0.3} />
                        <Line type="monotone" dataKey="leagueAvg" stroke="#3b82f6" strokeWidth={1} strokeDasharray="3 3" dot={false} opacity={0.6} />
                        <Area type="monotone" dataKey="value" stroke="#10b981" fillOpacity={0.1} fill="#10b981" strokeWidth={3} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden animate-fadeIn">
                <table className="w-full text-[11px] font-mono">
                    <thead className="bg-gray-950/50 text-gray-500 uppercase tracking-wider border-b border-gray-800">
                        <tr>
                            <th className="px-4 py-3 text-left">Date</th>
                            <th className="px-4 py-3 text-left">Opponent</th>
                            <th className="px-4 py-3 text-center">Minutes</th>
                            <th className="px-4 py-3 text-right">Actual Stat</th>
                            <th className="px-4 py-3 text-center">Outcome</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                        {(activeLeg.recentGames || []).slice(0, gameLimit).map((log, i) => (
                            <tr key={i} className="hover:bg-white/5 transition-colors">
                                <td className="px-4 py-2.5 text-gray-400">{log.date}</td>
                                <td className="px-4 py-2.5 font-bold text-gray-200">{log.opponent}</td>
                                <td className="px-4 py-2.5 text-center text-gray-500"><ClockIcon size={10} className="inline mr-1" /> {log.minutes || '--'}</td>
                                <td className="px-4 py-2.5 text-right font-bold text-white">{log.value}</td>
                                <td className="px-4 py-2.5 text-center">
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${log.hit ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{log.hit ? 'HIT' : 'MISS'}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          )}
       </div>

       <div className="bg-gray-950/80 border-t border-b border-gray-800 py-3 px-6 flex items-center justify-between sticky top-0 z-20">
           <span className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-2"><ListIcon size={14} className="text-emerald-500" /> Exhaustive Stat Markets</span>
           <span className="text-[9px] text-gray-600 font-mono italic animate-pulse">Synced to Official League Feed</span>
       </div>

       <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
          {data.legs.map((leg, i) => (
             <PropRow key={i} leg={leg} isActive={activeLeg === leg} onSelect={() => setSelectedLegIndex(i)} />
          ))}
       </div>

       <div className="bg-gray-950 py-4 px-6 flex items-center justify-center border-t border-gray-800 text-[9px] text-gray-600 font-mono italic">
            Market baseline data updated as of {new Date().toLocaleDateString()}. Cross-referenced with historical role-based efficiency.
       </div>
    </div>
  );
};
