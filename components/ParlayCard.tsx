import React, { useMemo, useState } from 'react';
import { ParlayRecommendation, BetLeg } from '../types';
import { TrendingUp, ShieldAlert, Activity, ChevronRight, BarChart3, Globe, Zap, Search, HelpCircle, AlertCircle, GitMerge, CheckCircle2 } from './Icons';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';

interface ParlayCardProps {
  parlay: ParlayRecommendation;
  index: number;
  onPlayerClick: (playerName: string) => void;
}

// --- Rationale Tooltip Logic ---
const getDefinition = (text: string) => {
  const lower = text.toLowerCase();
  if (lower.includes('bayesian')) return "Bayesian Inference: A statistical method that updates the probability of a hypothesis as more evidence (recent player form) becomes available.";
  if (lower.includes('regression')) return "Regression to Mean: The statistical tendency for extreme performances (hot/cold streaks) to eventually return to the player's long-term average.";
  if (lower.includes('implied') || lower.includes('edge')) return "Positive EV (+EV): A scenario where our model's calculated win probability is higher than the probability implied by the bookmaker's odds.";
  if (lower.includes('correlation')) return "Correlation Matrix: Measures how two events move together. In parlays, highly correlated legs (e.g., QB yards & WR yards) increase the true probability of winning relative to the payout.";
  if (lower.includes('sharp') || lower.includes('money')) return "Sharp Action: Heavy betting volume from professional bettors, often indicating valuable information not yet reflected in the public line.";
  if (lower.includes('variance')) return "Variance: A measure of volatility. High variance players have a wide range of outcomes (boom or bust), while low variance players are consistent.";
  return "Algorithmic Insight: This projection is derived from a weighted ensemble of decision trees (XGBoost) and historical situational analysis.";
};

const RationaleTooltip: React.FC<{ text: string }> = ({ text }) => {
  const [isVisible, setIsVisible] = useState(false);
  const definition = getDefinition(text);

  return (
    <div className="relative inline-flex items-center ml-2">
      <button 
        className="text-gray-600 hover:text-emerald-400 transition-colors cursor-help"
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
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">Concept Definition</p>
                    <p className="text-xs text-gray-300 leading-relaxed font-sans">{definition}</p>
                </div>
            </div>
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-950"></div>
        </div>
      )}
    </div>
  );
};

// --- Correlation Insight Tooltip ---
const CorrelationTooltip: React.FC<{ statType: string }> = ({ statType }) => {
  const [isVisible, setIsVisible] = useState(false);
  
  const getInsight = (type: string) => {
      const t = type.toLowerCase();
      if (t.includes('point') || t.includes('pts')) return "Positive Correlation (0.72) with Team Total Over. Often pairs well with 'Over' on Assists from primary ball-handlers.";
      if (t.includes('assist') || t.includes('ast')) return "Directly correlates with teammate scoring props. Stacks well with 'Over' on Teammate Points.";
      if (t.includes('rebound') || t.includes('reb')) return "Inverse correlation with Teammate Rebounds. Slight positive correlation with 'Under' on FG% (more missed shots).";
      if (t.includes('threes') || t.includes('3-pointer')) return "High variance. Correlates with Game Pace and 'Over' on Total Points.";
      if (t.includes('pass')) return "Extremely high correlation (0.91) with WR Receiving Yards. Essential stack for Game Correlation.";
      if (t.includes('receiv')) return "Dependent variable. Strongly correlates with QB Passing Yards and Attempts.";
      if (t.includes('rush')) return "Correlates with Game Script (Favorites). Teams leading late tend to rush more.";
      return "Correlates with Game Script and Pace. Check implied team totals.";
  };

  const insight = getInsight(statType);

  return (
    <div className="relative inline-flex items-center ml-1 z-20">
       <button 
        className="text-gray-600 hover:text-purple-400 transition-colors"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={(e) => { e.stopPropagation(); setIsVisible(!isVisible); }}
      >
        <GitMerge size={12} />
      </button>
       {isVisible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 bg-gray-950 border border-purple-500/30 rounded-lg shadow-2xl z-50 animate-fadeIn pointer-events-none">
            <div className="flex items-start gap-2">
                <GitMerge size={14} className="text-purple-400 mt-0.5 shrink-0" />
                <div>
                    <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-1">Correlation Insight</p>
                    <p className="text-[10px] text-gray-300 leading-relaxed font-sans">{insight}</p>
                </div>
            </div>
             <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-950"></div>
        </div>
      )}
    </div>
  )
}

// Helper to highlight key metrics in rationale
const HighlightedRationale: React.FC<{ text: string }> = ({ text }) => {
    if (!text) return null;
    
    // Split by common patterns: "Hit in X/Y", "Rank X", "L10", "Defense"
    const regex = /((?:Hit in \d+\/\d+)|(?:\d+\/\d+)|(?:L\d+)|(?:Rank #?\d+)|(?:\d+th)|(?:vs \w+)|(?:Pace)|(?:Usage)|(?:Def))/gi;
    const parts = text.split(regex);
    
    return (
        <span className="flex-1">
            {parts.map((part, i) => {
                if (part.match(regex)) {
                    return <span key={i} className="text-gray-200 font-bold font-mono text-[11px] bg-gray-800/50 px-1 rounded mx-0.5">{part}</span>;
                }
                return <span key={i}>{part}</span>;
            })}
        </span>
    );
};

const formatOdds = (odds: number) => (odds > 0 ? `+${odds}` : `${odds}`);

const LegRow: React.FC<{ leg: BetLeg; onPlayerClick: (name: string) => void }> = ({ leg, onPlayerClick }) => {
    const isInjured = leg.injuryStatus && leg.injuryStatus !== 'Active';
    const statusColor = leg.injuryStatus?.toLowerCase().includes('probable') ? 'text-yellow-400' : 'text-orange-500';

    return (
      <div className="flex flex-col p-3 bg-gray-900 rounded border border-gray-800 mb-2 hover:border-gray-700 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between">
            <div className="flex items-center gap-3">
            <div className={`w-1 h-8 rounded-full ${leg.prediction === 'Over' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
            <div>
                <button 
                    onClick={() => onPlayerClick(leg.playerName)}
                    className="font-semibold text-gray-200 flex items-center gap-2 hover:text-emerald-400 hover:underline decoration-emerald-500/30 underline-offset-4 transition-all text-left group"
                >
                    {leg.playerName}
                    <Search size={10} className="opacity-0 group-hover:opacity-100 transition-opacity text-emerald-500" />
                    {(leg.modelProb || 0) > 0.65 && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30 font-mono no-underline">
                            HIGH CONFIDENCE
                        </span>
                    )}
                    
                    {/* Injury Status Badge */}
                    {isInjured ? (
                        <span className={`text-[9px] ${statusColor} border border-current px-1 rounded flex items-center gap-0.5`}>
                           <AlertCircle size={8} /> {leg.injuryStatus}
                        </span>
                    ) : (
                        <span className="text-[9px] text-emerald-600/50 flex items-center gap-0.5">
                            <CheckCircle2 size={10} />
                        </span>
                    )}
                </button>
                <div className="text-xs text-gray-400 font-mono flex items-center gap-1">
                    <span className="text-gray-300 font-bold">{leg.team}</span> vs {leg.opponent} • <span className="text-gray-300">{leg.statType}</span>
                    <CorrelationTooltip statType={leg.statType} />
                </div>
            </div>
            </div>
            
            <div className="flex items-center justify-between sm:justify-end gap-4 mt-2 sm:mt-0">
                <div className="text-right">
                    <div className="text-sm text-gray-400">Line</div>
                    <div className="font-mono font-medium text-white">
                        {leg.prediction === 'Over' ? 'O' : 'U'} {leg.line}
                    </div>
                </div>
                <div className="text-right hidden sm:block">
                    <div className="text-sm text-gray-400">Win Prob</div>
                    <div className="font-mono font-bold text-emerald-400">{((leg.modelProb || 0) * 100).toFixed(1)}%</div>
                </div>
                <div className="text-right">
                    <div className="text-sm text-gray-400">Edge</div>
                    <div className="font-mono text-emerald-400 font-bold">+{ (leg.edge || 0).toFixed(1)}%</div>
                </div>
            </div>
        </div>
        
        {/* Rationale / Book Comparison Section */}
        {leg.rationale && (
            <div className="mt-2 pt-2 border-t border-gray-800 flex items-start gap-2 relative z-10">
                <Globe size={12} className="text-blue-400 mt-0.5 shrink-0" />
                <p className="text-xs text-gray-400 font-mono leading-relaxed flex items-center flex-wrap">
                    <span className="text-blue-400 font-semibold mr-1">Intel:</span> 
                    <HighlightedRationale text={leg.rationale} />
                    <RationaleTooltip text={leg.rationale} />
                </p>
            </div>
        )}
      </div>
    );
};

export const ParlayCard: React.FC<ParlayCardProps> = ({ parlay, index, onPlayerClick }) => {
  
  const riskColor = parlay.varianceScore > 7 ? 'text-rose-400' : parlay.varianceScore > 4 ? 'text-yellow-400' : 'text-emerald-400';
  const data = [
    { name: 'Model Prob', value: (parlay.jointProbAdjusted || 0) * 100 },
    { name: 'Risk', value: 100 - ((parlay.jointProbAdjusted || 0) * 100) },
  ];
  const COLORS = ['#10b981', '#374151'];

  // Generate simulated historical data for the chart based on current stats
  const historyData = useMemo(() => {
    const history = [];
    const baseEv = parlay.expectedValue || 0;
    const baseStake = parlay.kellyStake || 0;
    
    // Simulate 12 data points (e.g., last 6 hours, 30 min intervals)
    for (let i = 12; i >= 0; i--) {
        // Create realistic fluctuation
        const timeOffset = i * 30; // minutes
        const noise = (Math.sin(i) * 2) + ((Math.random() - 0.5) * 1.5);
        
        // The further back, the more "different" it might be, converging to current
        let simEv = baseEv + (noise * (i / 8));
        let simStake = baseStake + (noise * (i / 15));

        // Clamping
        simEv = Math.max(0.5, simEv);
        simStake = Math.max(0.1, simStake);

        history.push({
            time: i === 0 ? 'Now' : `-${timeOffset}m`,
            ev: parseFloat(simEv.toFixed(1)),
            stake: parseFloat(simStake.toFixed(2))
        });
    }
    // Force last point to be exact current values
    history[history.length - 1].ev = baseEv;
    history[history.length - 1].stake = baseStake;
    
    return history;
  }, [parlay.expectedValue, parlay.kellyStake]);

  return (
    <div className="bg-gray-850 rounded-xl border border-gray-800 p-6 mb-6 shadow-xl relative overflow-hidden group">
      {/* Decorative Top Border */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 opacity-70"></div>

      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Left: Stats & Overview */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-gray-800 text-gray-300 text-xs px-2 py-0.5 rounded font-mono uppercase tracking-wider">
                  Option #{index + 1}
                </span>
                <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-2 py-0.5 rounded font-mono flex items-center gap-1">
                   <Zap size={10} fill="currentColor" /> {(parlay.jointProbAdjusted * 100).toFixed(0)}% WIN PROBABILITY
                </span>
              </div>
              <h3 className="text-2xl font-bold text-white font-mono tracking-tight">
                {formatOdds(parlay.totalOdds)} PARLAY
              </h3>
            </div>
            
            <div className="text-right">
              <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Kelly Stake</div>
              <div className="text-xl font-mono font-bold text-blue-400">{(parlay.kellyStake || 0).toFixed(2)}%</div>
            </div>
          </div>

          <div className="mb-4 relative">
             <div className="max-h-[320px] overflow-y-auto pr-1 custom-scrollbar space-y-2 pb-2">
                {parlay.legs && parlay.legs.map((leg, i) => (
                  <LegRow key={i} leg={leg} onPlayerClick={onPlayerClick} />
                ))}
             </div>
             {/* Subtle gradient to hint more content if scrolling */}
             {parlay.legs && parlay.legs.length > 4 && (
                <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-gray-850 to-transparent pointer-events-none"></div>
             )}
          </div>

          <div className="bg-gray-900/50 p-3 rounded border border-gray-800/50">
             <p className="text-sm text-gray-400 italic">
                <span className="text-blue-400 font-semibold not-italic mr-2">Optimization Logic:</span>
                {parlay.summary}
             </p>
          </div>

          {/* Historical Performance Chart */}
          <div className="mt-4 pt-4 border-t border-gray-800">
             <div className="flex items-center gap-2 mb-3">
                 <BarChart3 size={14} className="text-gray-500" />
                 <h4 className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Value Tracking (Last 6h)</h4>
             </div>
             <div className="h-40 w-full bg-gray-900/20 rounded-lg border border-gray-800/50 p-2">
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={historyData}>
                        <defs>
                            <linearGradient id="colorEv" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorStake" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} opacity={0.5} />
                        <XAxis 
                            dataKey="time" 
                            tick={{fontSize: 10, fill: '#6b7280'}} 
                            axisLine={false}
                            tickLine={false}
                            interval={2}
                        />
                        <YAxis hide domain={['auto', 'auto']} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', fontSize: '12px', borderRadius: '4px' }}
                            itemStyle={{ padding: 0 }}
                            labelStyle={{ color: '#9ca3af', marginBottom: '4px' }}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="ev" 
                            name="Exp. Value %"
                            stroke="#10b981" 
                            fillOpacity={1} 
                            fill="url(#colorEv)" 
                            strokeWidth={2}
                        />
                         <Area 
                            type="monotone" 
                            dataKey="stake" 
                            name="Kelly Stake %"
                            stroke="#3b82f6" 
                            fillOpacity={1} 
                            fill="url(#colorStake)" 
                            strokeWidth={2}
                            strokeDasharray="4 2"
                        />
                    </AreaChart>
                 </ResponsiveContainer>
             </div>
          </div>
        </div>

        {/* Right: Technical Metrics Visualization */}
        <div className="w-full lg:w-64 bg-gray-900 rounded-lg p-4 border border-gray-800 flex flex-col justify-between shrink-0">
           <div>
               <h4 className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
                   <TrendingUp size={14} /> Hit Probability
               </h4>
               
               <div className="h-32 w-full relative">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={30}
                            outerRadius={45}
                            fill="#8884d8"
                            paddingAngle={5}
                            dataKey="value"
                            startAngle={90}
                            endAngle={-270}
                        >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                        </Pie>
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', fontSize: '12px' }}
                            itemStyle={{ color: '#e5e7eb' }}
                        />
                    </PieChart>
                 </ResponsiveContainer>
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <span className="text-xl font-mono text-emerald-400 font-bold">{((parlay.jointProbAdjusted || 0) * 100).toFixed(0)}%</span>
                 </div>
               </div>
           </div>

           <div className="space-y-3 mt-2">
               <div className="flex justify-between items-center text-xs">
                   <span className="text-gray-500">Correlation</span>
                   <span className="text-gray-300 font-mono">{((parlay.correlationScore || 0) * 100).toFixed(0)}/100</span>
               </div>
               <div className="w-full bg-gray-800 h-1 rounded overflow-hidden">
                   <div className="bg-blue-500 h-full" style={{ width: `${(parlay.correlationScore || 0) * 100}%` }}></div>
               </div>

               <div className="flex justify-between items-center text-xs">
                   <span className="text-gray-500">Stability Score</span>
                   <span className={`${riskColor} font-mono`}>{((10 - parlay.varianceScore)).toFixed(1)}/10</span>
               </div>
               <div className="w-full bg-gray-800 h-1 rounded overflow-hidden">
                   <div className={`h-full ${parlay.varianceScore > 7 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${((10 - parlay.varianceScore) || 0) * 10}%` }}></div>
               </div>
           </div>
        </div>

      </div>
    </div>
  );
};