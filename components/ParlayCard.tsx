
import React, { useMemo, useState } from 'react';
import { ParlayRecommendation, BetLeg } from '../types';
import { TrendingUp, ShieldAlert, Activity, ChevronRight, BarChart3, Globe, Zap, Search, HelpCircle, AlertCircle, GitMerge, CheckCircle2, RefreshCw, DollarSign, Plus, X, Trash2 } from './Icons';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { calculateEngineMetrics, impliedProbFromAmericanOdds } from '../services/projectionEngine';

// --- Odds Conversion Helpers ---
const americanToDecimal = (odds: number): number => {
  return odds > 0 ? (odds / 100) + 1 : (100 / Math.abs(odds)) + 1;
};

const decimalToAmerican = (decimal: number): number => {
  if (decimal >= 2.0) {
    return Math.round((decimal - 1) * 100);
  } else {
    return Math.round(-100 / (decimal - 1));
  }
};

const formatOdds = (odds: number) => (odds > 0 ? `+${odds}` : `${odds}`);

// --- Rationale Tooltip Logic ---
const getDefinition = (text: string) => {
  const lower = text.toLowerCase();
  if (lower.includes('bayesian')) return "Bayesian Inference: A statistical method that updates the probability of a hypothesis as more evidence (recent player form) becomes available.";
  if (lower.includes('regression')) return "Regression to Mean: The statistical tendency for extreme performances (hot/cold streaks) to eventually return to the player's long-term average.";
  if (lower.includes('implied') || lower.includes('edge')) return "Positive EV (+EV): A scenario where our model's calculated win probability is higher than the probability implied by the bookmaker's odds.";
  if (lower.includes('correlation')) return "Correlation Matrix: Measures how two events move together. In parlays, highly correlated legs (e.g., QB yards & WR yards) increase the true probability of winning.";
  if (lower.includes('z-score')) return "Z-Score: Measures how many standard deviations the betting line is from the projected mean (μ).";
  if (lower.includes('sigma') || lower.includes('deviation')) return "Standard Deviation (σ): Quantifies volatility; higher values indicate higher variance in player performance.";
  if (lower.includes('pace')) return "Pace Adjustment: Correcting projections based on the expected number of possessions in a specific matchup.";
  if (lower.includes('kelly')) return "Kelly Criterion: A formula used to determine the optimal size of a series of bets to maximize long-term wealth.";
  if (lower.includes('usage')) return "Usage Rate: The percentage of team plays a player is involved in while on the court/field.";
  if (lower.includes('efficiency')) return "Defensive Efficiency: Points allowed per possession by an opponent, used to scale offensive projections.";
  if (lower.includes('poisson')) return "Poisson Distribution: A discrete probability distribution that expresses the probability of a given number of events occurring in a fixed interval.";
  if (lower.includes('sharp') || lower.includes('money')) return "Sharp Action: Heavy betting volume from professional bettors, indicating valuable market information.";
  return "Quant Insight: High-confidence projection derived from a multi-factor regression model and historical situational variance analysis.";
};

const RationaleTooltip: React.FC<{ text: string }> = ({ text }) => {
  const [isVisible, setIsVisible] = useState(false);
  const definition = getDefinition(text);

  return (
    <div className="relative inline-flex items-center ml-2">
      <button 
        className="text-gray-600 hover:text-emerald-400 transition-colors cursor-help outline-none"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={(e) => { e.stopPropagation(); setIsVisible(!isVisible); }}
      >
        <HelpCircle size={12} />
      </button>
      {isVisible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-950 border border-emerald-500/30 rounded-lg shadow-2xl z-[60] animate-fadeIn pointer-events-none">
            <div className="flex items-start gap-2">
                <AlertCircle size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                <div>
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">Concept Definition</p>
                    <p className="text-xs text-gray-300 leading-relaxed font-sans">{definition}</p>
                </div>
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-950"></div>
        </div>
      )}
    </div>
  );
};

const LegRow: React.FC<{ leg: BetLeg; onPlayerClick: (name: string) => void; onAddToBuilder: (leg: BetLeg) => void }> = ({ leg, onPlayerClick, onAddToBuilder }) => {
    const isInjured = leg.injuryStatus && leg.injuryStatus !== 'Active';
    const statusColor = leg.injuryStatus?.toLowerCase().includes('probable') ? 'text-yellow-400' : 'text-orange-500';

    return (
      <div className="flex flex-col p-3 bg-gray-900 rounded border border-gray-800 mb-2 hover:border-gray-700 transition-colors relative group">
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
                    {isInjured && (
                        <span className={`text-[9px] ${statusColor} border border-current px-1 rounded flex items-center gap-0.5`}>
                           <AlertCircle size={8} /> {leg.injuryStatus}
                        </span>
                    )}
                </button>
                <div className="text-xs text-gray-400 font-mono flex items-center gap-1">
                    <span className="text-gray-300 font-bold">{leg.team}</span> vs {leg.opponent} • <span className="text-gray-300">{leg.statType}</span>
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
                <div className="text-right">
                    <div className="text-sm text-gray-400">Win Prob</div>
                    <div className="font-mono font-bold text-emerald-400">{((leg.modelProb || 0) * 100).toFixed(1)}%</div>
                </div>
                <button 
                  onClick={() => onAddToBuilder(leg)}
                  className="ml-2 p-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-gray-950 rounded border border-emerald-500/20 transition-all flex items-center justify-center"
                  title="Add to Bet Builder"
                >
                    <Plus size={16} />
                </button>
            </div>
        </div>
      </div>
    );
};

// --- Bet Builder Section ---
interface BetBuilderLeg extends BetLeg {
  originalProb: number;
}

const BetBuilder: React.FC<{ 
  legs: BetBuilderLeg[]; 
  onUpdateLeg: (index: number, updates: Partial<BetBuilderLeg>) => void;
  onRemoveLeg: (index: number) => void;
  onClose: () => void;
  bankroll: number;
}> = ({ legs, onUpdateLeg, onRemoveLeg, onClose, bankroll }) => {
  
  const stats = useMemo(() => {
    if (legs.length === 0) return { prob: 0, odds: 0, roi: 0 };
    
    // Joint probability assumes independence for simplicity in this builder tool
    // Real SGP correlations would be complex here
    const jointProb = legs.reduce((p, leg) => {
      // Re-calculate probability if line changed using engine
      const metrics = calculateEngineMetrics(leg);
      return p * metrics.pModel;
    }, 1);

    const totalDecimal = legs.reduce((o, leg) => o * americanToDecimal(leg.bookOdds), 1);
    const totalAmerican = decimalToAmerican(totalDecimal);
    
    // ROI = (Prob * Payout) - 1
    const roi = (jointProb * totalDecimal) - 1;

    return {
      prob: jointProb * 100,
      odds: totalAmerican,
      roi: roi * 100
    };
  }, [legs]);

  return (
    <div className="bg-gray-950 border border-emerald-500/30 rounded-xl overflow-hidden shadow-2xl animate-slideUp">
      <div className="p-3 bg-gray-900 border-b border-gray-800 flex justify-between items-center">
        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
          <Zap size={14} fill="currentColor" /> Quant Bet Builder
        </h4>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
        {legs.length === 0 ? (
          <div className="text-center py-8 text-gray-600 font-mono text-xs">
            SELECT LEGS TO INITIALIZE BUILDER
          </div>
        ) : (
          legs.map((leg, idx) => (
            <div key={`${leg.playerName}-${idx}`} className="bg-gray-900 border border-gray-800 rounded p-3 relative group">
              <button 
                onClick={() => onRemoveLeg(idx)}
                className="absolute top-2 right-2 text-gray-600 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={12} />
              </button>
              <div className="text-[10px] text-emerald-500 font-bold uppercase mb-2">{leg.playerName} • {leg.statType}</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] text-gray-500 uppercase font-mono">Market Line</label>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => onUpdateLeg(idx, { prediction: leg.prediction === 'Over' ? 'Under' : 'Over' })}
                      className={`text-[9px] font-bold px-1 rounded ${leg.prediction === 'Over' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}
                    >
                      {leg.prediction === 'Over' ? 'O' : 'U'}
                    </button>
                    <input 
                      type="number" 
                      step="0.5"
                      value={leg.line}
                      onChange={(e) => onUpdateLeg(idx, { line: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-gray-950 border border-gray-800 text-white font-mono text-xs p-1 rounded focus:border-emerald-500 outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-gray-500 uppercase font-mono">Book Odds</label>
                  <input 
                    type="number" 
                    step="5"
                    value={leg.bookOdds}
                    onChange={(e) => onUpdateLeg(idx, { bookOdds: parseInt(e.target.value) || 0 })}
                    className="w-full bg-gray-950 border border-gray-800 text-white font-mono text-xs p-1 rounded focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 bg-gray-900 border-t border-gray-800 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-[8px] text-gray-500 uppercase mb-1">Total Odds</div>
          <div className="text-sm font-mono font-bold text-white">{formatOdds(stats.odds)}</div>
        </div>
        <div>
          <div className="text-[8px] text-gray-500 uppercase mb-1">Win Prob</div>
          <div className="text-sm font-mono font-bold text-emerald-400">{stats.prob.toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-[8px] text-gray-500 uppercase mb-1">Custom ROI</div>
          <div className={`text-sm font-mono font-bold ${stats.roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {stats.roi >= 0 ? '+' : ''}{stats.roi.toFixed(1)}%
          </div>
        </div>
      </div>
      
      <div className="p-3">
        <button className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-gray-950 font-bold rounded-lg text-[10px] tracking-widest uppercase transition-all shadow-lg shadow-emerald-500/20">
          LOCK IN TERMINAL PROJECTION
        </button>
      </div>
    </div>
  );
};

interface ParlayCardProps {
  parlay: ParlayRecommendation;
  index: number;
  onPlayerClick: (name: string) => void;
  bankroll?: number;
}

export const ParlayCard: React.FC<ParlayCardProps> = ({ parlay, index, onPlayerClick, bankroll = 1000 }) => {
  const [builderLegs, setBuilderLegs] = useState<BetBuilderLeg[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);

  const riskColor = parlay.varianceScore > 7 ? 'text-rose-400' : parlay.varianceScore > 4 ? 'text-yellow-400' : 'text-emerald-400';
  const pieData = [
    { name: 'Model Prob', value: (parlay.jointProbAdjusted || 0) * 100 },
    { name: 'Risk', value: 100 - ((parlay.jointProbAdjusted || 0) * 100) },
  ];
  const COLORS = ['#10b981', '#374151'];

  const addToBuilder = (leg: BetLeg) => {
    setBuilderLegs(prev => [...prev, { ...leg, originalProb: leg.modelProb }]);
    setShowBuilder(true);
  };

  const updateBuilderLeg = (idx: number, updates: Partial<BetBuilderLeg>) => {
    setBuilderLegs(prev => prev.map((l, i) => i === idx ? { ...l, ...updates } : l));
  };

  const removeBuilderLeg = (idx: number) => {
    setBuilderLegs(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="bg-gray-850 rounded-xl border border-gray-800 p-6 mb-6 shadow-xl relative overflow-hidden group">
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
                  <LegRow 
                    key={i} 
                    leg={leg} 
                    onPlayerClick={onPlayerClick} 
                    onAddToBuilder={addToBuilder}
                  />
                ))}
             </div>
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
        </div>

        {/* Right: Technical Metrics / Bet Builder */}
        <div className="w-full lg:w-72 shrink-0 space-y-4">
           {!showBuilder ? (
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 flex flex-col h-full">
                  <h4 className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
                      <TrendingUp size={14} /> Model Accuracy
                  </h4>
                  
                  <div className="h-32 w-full relative mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={pieData}
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
                            {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-xl font-mono text-emerald-400 font-bold">{((parlay.jointProbAdjusted || 0) * 100).toFixed(0)}%</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                      <div className="p-3 bg-gray-950 rounded border border-gray-800">
                          <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1 font-mono">Potential ROI</div>
                          <div className="text-xl font-mono font-bold text-emerald-400">+{(parlay.expectedValue || 0).toFixed(1)}%</div>
                      </div>
                      
                      <button 
                        onClick={() => setShowBuilder(true)}
                        className="w-full py-3 bg-gray-850 hover:bg-gray-800 border border-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-bold tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-2"
                      >
                        <RefreshCw size={14} /> Open Bet Builder
                      </button>
                  </div>
              </div>
           ) : (
              <BetBuilder 
                legs={builderLegs}
                onUpdateLeg={updateBuilderLeg}
                onRemoveLeg={removeBuilderLeg}
                onClose={() => setShowBuilder(false)}
                bankroll={bankroll}
              />
           )}
        </div>

      </div>
    </div>
  );
};
