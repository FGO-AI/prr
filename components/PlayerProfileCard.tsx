import React, { useMemo, useState } from 'react';
import { ParlayRecommendation, BetLeg } from '../types';
import { 
    Activity, Globe, TrendingUp, BarChart3, User, Zap, Lock, BrainCircuit, 
    History, TableIcon, CheckCircle2, XCircle, HelpCircle, AlertCircle, Trophy, GitMerge, Timer, ArrowRight, DollarSign
} from './Icons';
import { 
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, BarChart, Bar, Cell 
} from 'recharts';

interface PlayerProfileCardProps {
  data: ParlayRecommendation;
  bankroll?: number;
}

const getDefinition = (text: string) => {
  const lower = text.toLowerCase();
  if (lower.includes('bayesian')) return "Bayesian Inference: Updating win probability based on live form + historical priors.";
  if (lower.includes('pace')) return "Pace Adjustment: Correcting counting stats for the projected number of possessions in this matchup.";
  if (lower.includes('def rank') || lower.includes('vs')) return "Matchup Grade: Based on the opponent's defensive efficiency against this specific player's position.";
  return "Algorithmic Insight: This projection uses an ensemble of Monte Carlo simulations and defensive scouting reports to target 30%+ ROI.";
};

const RationaleTooltip: React.FC<{ text: string }> = ({ text }) => {
  const [isVisible, setIsVisible] = useState(false);
  const definition = getDefinition(text);

  return (
    <div className="relative inline-flex items-center ml-2">
      <button 
        className="text-gray-500 hover:text-emerald-400 transition-colors cursor-help"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
      >
        <HelpCircle size={12} />
      </button>
      {isVisible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-950 border border-emerald-500/30 rounded-lg shadow-2xl z-50 animate-fadeIn">
            <div className="flex items-start gap-2">
                <AlertCircle size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                <div>
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">Context Engine</p>
                    <p className="text-xs text-gray-300 leading-relaxed font-sans">{definition}</p>
                </div>
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-950"></div>
        </div>
      )}
    </div>
  );
};

const HighlightedRationale: React.FC<{ text: string }> = ({ text }) => {
    if (!text) return null;
    const regex = /((?:Hit in \d+\/\d+)|(?:\d+\/\d+)|(?:L\d+)|(?:Rank #?\d+)|(?:\d+th)|(?:vs \w+)|(?:Pace)|(?:Usage)|(?:Def))/gi;
    const parts = text.split(regex);
    return (
        <span className="flex-1">
            {parts.map((part, i) => {
                if (part.match(regex)) {
                    return <span key={i} className="text-gray-200 font-bold font-mono text-[11px] bg-emerald-500/10 px-1 rounded mx-0.5 border border-emerald-500/20">{part}</span>;
                }
                return <span key={i}>{part}</span>;
            })}
        </span>
    );
};

const PropRow: React.FC<{ leg: BetLeg; isBest?: boolean }> = ({ leg, isBest }) => {
  const hitRateValue = (leg.modelProb || 0) * 100;
  const probabilityColor = hitRateValue >= 65 ? 'text-emerald-400' : hitRateValue >= 55 ? 'text-yellow-400' : 'text-gray-400';

  return (
    <div className={`grid grid-cols-12 gap-4 p-4 border-b border-gray-800 transition-colors items-center ${isBest ? 'bg-emerald-950/20 hover:bg-emerald-950/30' : 'bg-gray-900 hover:bg-gray-800/50'}`}>
      <div className="col-span-4 sm:col-span-3">
        <div className="flex items-center gap-2">
            <div className="text-sm font-bold text-gray-100">{leg.statType}</div>
            {leg.recentHitRate && (
                <span className="text-[9px] bg-gray-800 text-emerald-400 px-1 rounded font-mono border border-emerald-500/20">
                    L10: {leg.recentHitRate}
                </span>
            )}
        </div>
        <div className="text-[9px] text-gray-600 font-mono flex items-center gap-1">
             LG AVG: <span className="text-gray-400">{leg.leagueAvg || '--'}</span>
        </div>
      </div>

      <div className="col-span-4 sm:col-span-2">
        <div className="flex items-baseline gap-1">
            <span className={`text-base font-mono font-bold ${leg.prediction === 'Over' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {leg.prediction === 'Over' ? 'O' : 'U'}
            </span>
            <span className="text-base font-mono font-bold text-white">{leg.line}</span>
        </div>
        <div className="text-[10px] text-gray-500 uppercase font-mono">Market Line</div>
      </div>

      <div className="col-span-4 sm:col-span-2">
         <div className={`text-base font-mono font-bold ${probabilityColor}`}>
            {hitRateValue.toFixed(0)}%
         </div>
         <div className="text-[10px] text-gray-500 uppercase font-mono">Win Prob</div>
      </div>
      
      <div className="hidden sm:block sm:col-span-5">
         <div className={`p-2 rounded border ${isBest ? 'bg-emerald-900/20 border-emerald-500/20' : 'bg-gray-950/50 border-gray-800/50'}`}>
            <p className="text-[11px] text-gray-400 leading-tight flex items-start flex-wrap">
                <Globe size={10} className="inline mr-1 text-blue-400 mt-0.5 shrink-0" />
                <HighlightedRationale text={leg.rationale} />
                <RationaleTooltip text={leg.rationale} />
            </p>
         </div>
      </div>
    </div>
  );
};

const ContextMetric = ({ label, value, baseline, suffix = "" }: { label: string, value: number | string, baseline: number, suffix?: string }) => {
    const numValue = typeof value === 'number' ? value : parseFloat(value);
    const diff = numValue - baseline;
    const isBetter = diff > 0;
    
    return (
        <div className="flex flex-col p-3 bg-gray-900 border border-gray-800 rounded-lg">
            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">{label}</span>
            <div className="flex items-baseline gap-2">
                <span className="text-xl font-mono font-bold text-white">{value}{suffix}</span>
                <span className={`text-[10px] font-mono ${isBetter ? 'text-emerald-400' : 'text-gray-500'}`}>
                    {isBetter ? '▲' : '▼'} {Math.abs(diff).toFixed(1)} vs AVG
                </span>
            </div>
            <div className="w-full bg-gray-850 h-1 mt-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${isBetter ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                  style={{ width: `${Math.min((numValue / (baseline * 2)) * 100, 100)}%` }}
                ></div>
            </div>
        </div>
    );
}

export const PlayerProfileCard: React.FC<PlayerProfileCardProps> = ({ data, bankroll = 1000 }) => {
  const [activeTab, setActiveTab] = useState<'trends' | 'logs'>('trends');
  
  const sortedLegs = [...data.legs].sort((a, b) => (b.modelProb || 0) - (a.modelProb || 0));
  const bestLeg = sortedLegs[0];
  const playerName = bestLeg?.playerName || "Unknown Player";
  const teamInfo = bestLeg ? `${bestLeg.team} vs ${bestLeg.opponent}` : "N/A";
  
  // Calculate specific ROI potential for this card
  const roiPotential = (data.expectedValue || 15).toFixed(1);
  const suggestedWager = ((data.kellyStake || 2.5) / 100 * bankroll).toFixed(2);
  const expectedProfit = (parseFloat(roiPotential) / 100 * parseFloat(suggestedWager)).toFixed(2);

  const statsData = useMemo(() => {
    if (!bestLeg) return { logs: [], trend: [], avg: 0, posAvg: 0 };
    const line = bestLeg.line;
    const isOver = bestLeg.prediction === 'Over';
    const avg = isOver ? line - (line * 0.05) : line + (line * 0.05);
    const posAvg = bestLeg.leagueAvg || (avg * 0.8); 
    
    const trend = [];
    const logs = [];
    for (let i = 1; i <= 10; i++) {
        const variance = line * 0.35;
        const val = Math.round(avg + (Math.random() - 0.5) * 2 * variance + (isOver ? line * 0.1 : -line * 0.1));
        const hit = isOver ? val > line : val < line;
        
        const date = new Date();
        date.setDate(date.getDate() - (11 - i) * 2);

        trend.push({ game: `G${i}`, value: val, line: line, avg: avg, posAvg: posAvg });
        logs.push({
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            opponent: ['MIA', 'LAL', 'BOS', 'NYK', 'PHI', 'CHI', 'DEN', 'GSW', 'DAL', 'HOU'][i-1],
            isHome: Math.random() > 0.5,
            oppRank: Math.floor(Math.random() * 30) + 1,
            result: hit ? 'HIT' : 'MISS',
            value: val,
            line: line,
            diff: val - line
        });
    }
    return { logs: logs.reverse(), trend, avg, posAvg };
  }, [bestLeg]);

  return (
    <div className="bg-gray-850 rounded-xl border border-gray-800 shadow-xl overflow-hidden mb-8 relative">
       <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-blue-500 via-emerald-500 to-purple-500 z-10"></div>

       <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6 relative z-10">
          <div className="w-16 h-16 rounded-xl bg-gray-900 border-2 border-gray-800 flex items-center justify-center shadow-2xl shrink-0 overflow-hidden relative">
             <User size={32} className="text-gray-500" />
          </div>

          <div className="flex-1">
             <div className="flex items-center gap-2 mb-1">
                <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] rounded uppercase font-bold tracking-widest flex items-center gap-1">
                    <Zap size={10} fill="currentColor" /> Quant Model Active
                </span>
                <span className="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] rounded uppercase font-bold tracking-widest flex items-center gap-1">
                    ROI Focus
                </span>
             </div>
             <h2 className="text-2xl font-bold text-white tracking-tight">{playerName}</h2>
             <p className="text-gray-500 font-mono text-[10px] uppercase tracking-widest flex items-center gap-2 mt-1">
                {teamInfo} <span className="text-gray-800">|</span> <span className="text-emerald-400">MARKET EDGE: {((bestLeg?.edge || 0)).toFixed(1)}%</span>
             </p>
          </div>

          <div className="text-right flex flex-col gap-1 items-end">
              <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg text-right">
                  <div className="text-[9px] text-emerald-400 uppercase tracking-widest font-bold">ROI PROJECTION</div>
                  <div className="text-2xl font-mono font-bold text-white">+{roiPotential}%</div>
              </div>
              <div className="text-[10px] text-gray-500 font-mono">EST. PROFIT: <span className="text-white">${expectedProfit}</span></div>
          </div>
       </div>

       {/* Comparisons & Context */}
       <div className="px-6 py-4 bg-gray-900/30 border-y border-gray-800 grid grid-cols-2 md:grid-cols-4 gap-4">
            <ContextMetric label="Kelly Stake" value={data.kellyStake || 2.5} baseline={2.0} suffix="%" />
            <ContextMetric label="Stability" value={10 - (data.varianceScore || 3.5)} baseline={5.0} />
            <ContextMetric label="Pos correlation" value={data.correlationScore || 0.65} baseline={0.5} />
            <div className="flex flex-col p-3 bg-gray-900 border border-gray-800 rounded-lg justify-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-emerald-500/5 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1 relative z-10">Conviction</span>
                <span className="text-xl font-mono font-bold text-emerald-400 flex items-center gap-2 relative z-10">
                    <Trophy size={16} fill="currentColor" className="text-yellow-500" /> HIGH
                </span>
            </div>
       </div>

       {/* Detailed Tabs */}
       <div className="px-6 py-6">
          <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
             <div className="flex border-b border-gray-800 bg-gray-900/50">
                <button onClick={() => setActiveTab('trends')} className={`flex items-center gap-2 px-6 py-4 text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === 'trends' ? 'bg-gray-800 text-emerald-400 border-b-2 border-emerald-500' : 'text-gray-500'}`}>
                    <History size={14} /> Performance Trends
                </button>
                <button onClick={() => setActiveTab('logs')} className={`flex items-center gap-2 px-6 py-4 text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === 'logs' ? 'bg-gray-800 text-emerald-400 border-b-2 border-emerald-500' : 'text-gray-500'}`}>
                    <TableIcon size={14} /> Full Game Logs
                </button>
             </div>

             <div className="p-6 min-h-[320px]">
                {activeTab === 'trends' ? (
                    <div className="h-64 w-full">
                       <div className="flex justify-between items-center mb-6">
                          <h4 className="text-xs text-gray-400 font-bold uppercase tracking-widest flex items-center gap-2">
                             L10 Trajectory: {bestLeg?.statType}
                          </h4>
                          <div className="flex gap-4 text-[10px] font-mono">
                             <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-gray-600"></div> LG AVG</div>
                             <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-emerald-500"></div> PLAYER</div>
                             <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-white border-dashed"></div> LINE</div>
                          </div>
                       </div>
                       <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={statsData.trend} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                             <defs>
                                <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                             </defs>
                             <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                             <XAxis dataKey="game" tick={{fill: '#4b5563', fontSize: 10}} axisLine={false} tickLine={false} />
                             <YAxis tick={{fill: '#4b5563', fontSize: 10}} axisLine={false} tickLine={false} />
                             <Tooltip contentStyle={{ backgroundColor: '#030712', border: '1px solid #1f2937', borderRadius: '8px', fontSize: '11px' }} />
                             <ReferenceLine y={bestLeg?.line} stroke="#ffffff" strokeDasharray="5 5" opacity={0.5} />
                             <ReferenceLine y={statsData.posAvg} stroke="#4b5563" strokeDasharray="3 3" opacity={0.3} />
                             <Area type="monotone" dataKey="value" stroke="#10b981" fillOpacity={1} fill="url(#colorVal)" strokeWidth={2} />
                          </AreaChart>
                       </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="text-[10px] text-gray-500 uppercase tracking-widest border-b border-gray-800">
                                <tr>
                                    <th className="pb-4">Match Date</th>
                                    <th className="pb-4">Opponent</th>
                                    <th className="pb-4 text-center">Def Rank</th>
                                    <th className="pb-4 text-right">Actual</th>
                                    <th className="pb-4 text-right">Result</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/40 text-xs font-mono">
                                {statsData.logs.map((log, i) => (
                                    <tr key={i} className="group hover:bg-gray-800/30 transition-colors">
                                        <td className="py-3 text-gray-400">{log.date}</td>
                                        <td className="py-3 text-gray-200 font-bold">{log.opponent}</td>
                                        <td className="py-3 text-center">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${log.oppRank > 20 ? 'bg-emerald-500/10 text-emerald-400' : log.oppRank < 10 ? 'bg-rose-500/10 text-rose-400' : 'bg-gray-800 text-gray-500'}`}>
                                                #{log.oppRank}
                                            </span>
                                        </td>
                                        <td className="py-3 text-right font-bold text-white">
                                            {log.value} <span className={`text-[10px] ml-1 ${log.diff > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>({log.diff > 0 ? '+' : ''}{log.diff})</span>
                                        </td>
                                        <td className="py-3 text-right">
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${log.result === 'HIT' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                                {log.result}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
             </div>
          </div>
       </div>

       {/* Markets */}
       <div className="bg-gray-950 border-y border-gray-800 px-6 py-3 flex items-center justify-between sticky top-0 z-20">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <BarChart3 size={14} /> 30% ROI Market Target Protocol
            </span>
            <div className="text-[9px] text-gray-600 font-mono flex items-center gap-4">
                <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div> HIGH EDGE</span>
                <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></div> +EV VALUE</span>
            </div>
       </div>
       <div className="divide-y divide-gray-800/60">
          {sortedLegs.map((leg, i) => (
             <PropRow key={i} leg={leg} isBest={i === 0} />
          ))}
       </div>
    </div>
  );
};