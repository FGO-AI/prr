
import React, { useMemo, useState, useEffect } from 'react';
import { ParlayRecommendation, BetLeg, GameLogEntry, League } from '../types';
import { calculateEngineMetrics } from '../services/projectionEngine';
import { 
    Activity, Globe, TrendingUp, User, Zap, BrainCircuit, 
    RefreshCw, ChevronRight, Cpu, Target, Settings2, DollarSign, Clock as ClockIcon,
    AlertCircle, Shield, TrendingDown, Timer, Database
} from './Icons';

interface PlayerProfileCardProps {
  data: ParlayRecommendation;
  bankroll?: number;
}

const HighlightedRationale: React.FC<{ text: string }> = ({ text }) => {
    if (!text) return null;
    const regex = /(MATH:|Line|μ|σ|ROI|Z-Score|Edge|discrepancy|[-+]?\d*\.?\d+%?|OVER|UNDER)/gi;
    const parts = text.split(regex);
    
    return (
        <span className="font-sans">
            {parts.map((part, i) => {
                const isMath = regex.test(part);
                if (isMath) {
                   const isVerdict = /OVER|UNDER/i.test(part);
                   return (
                       <span key={i} className={`font-mono font-bold ${isVerdict ? 'text-emerald-400 bg-emerald-500/10 px-1 rounded' : 'text-blue-400'}`}>
                           {part}
                       </span>
                   );
                }
                return <span key={i} className="text-gray-400">{part}</span>;
            })}
        </span>
    );
};

const MetricBadge: React.FC<{ label: string; value: string; sub?: string; icon: React.ReactNode }> = ({ label, value, sub, icon }) => (
    <div className="bg-gray-900/80 border border-gray-800 p-3 rounded-xl flex items-center justify-between group hover:border-gray-700 transition-all">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-950 rounded-lg text-gray-500 group-hover:text-emerald-400 transition-colors">
                {icon}
            </div>
            <div>
                <div className="text-[8px] text-gray-600 font-bold uppercase tracking-widest">{label}</div>
                <div className="text-[10px] text-gray-400 font-mono mt-0.5">{sub}</div>
            </div>
        </div>
        <div className="text-right">
            <div className="text-sm font-mono font-bold text-white">{value}</div>
        </div>
    </div>
);

export const PlayerProfileCard: React.FC<PlayerProfileCardProps> = ({ data, bankroll = 1000 }) => {
    const [selectedLegIdx, setSelectedLegIdx] = useState(0);
    const leg = data.legs[selectedLegIdx];
    
    const [customLine, setCustomLine] = useState(leg?.line || 0);
    const [customPrediction, setCustomPrediction] = useState<'Over' | 'Under'>(leg?.prediction as 'Over' | 'Under' || 'Over');
    const [customOdds, setCustomOdds] = useState(leg?.bookOdds || -110);
    const [isRecalculating, setIsRecalculating] = useState(false);

    useEffect(() => {
        if (leg) {
            setCustomLine(leg.line);
            setCustomPrediction(leg.prediction as 'Over' | 'Under');
            setCustomOdds(leg.bookOdds);
        }
    }, [leg]);

    const metrics = useMemo(() => {
        if (!leg) return null;
        return calculateEngineMetrics({ 
            ...leg, 
            line: customLine, 
            prediction: customPrediction,
            bookOdds: customOdds
        });
    }, [leg, customLine, customPrediction, customOdds]);

    const handleRecalculate = () => {
        setIsRecalculating(true);
        setTimeout(() => {
            setIsRecalculating(false);
        }, 800);
    };

    if (!leg || !metrics) return null;

    const sideColor = customPrediction === 'Over' ? 'emerald' : 'rose';

    return (
        <div className={`bg-gray-850 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl animate-fadeIn group mb-8 transition-all duration-500 ${isRecalculating ? 'opacity-50 blur-[1px] scale-[0.99]' : 'opacity-100 blur-0 scale-100'}`}>
            {/* Direct Verdict Header */}
            <div className={`p-4 bg-${sideColor}-500/10 border-b border-${sideColor}-500/20 flex items-center justify-between relative`}>
                <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full bg-${sideColor}-500 ${isRecalculating ? 'animate-ping' : 'animate-pulse'}`}></div>
                    <span className={`text-[11px] font-black text-${sideColor}-400 uppercase tracking-[0.25em] font-mono`}>
                        SYSTEM VERDICT: {customPrediction.toUpperCase()} {customLine} @ {customOdds > 0 ? '+' : ''}{customOdds}
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 bg-gray-950 px-2 py-1 rounded border border-gray-800">
                        <TrendingUp size={12} className="text-emerald-500" />
                        <span className="text-[9px] font-bold text-gray-500 font-mono uppercase">
                            {isRecalculating ? 'SIMULATING...' : `Edge: ${metrics.edge.toFixed(1)}%`}
                        </span>
                    </div>
                    <Shield size={14} className={`text-${sideColor}-500`} />
                </div>
            </div>

            {/* Player Info Section */}
            <div className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-gray-900/40">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-2xl bg-gray-950 border border-gray-800 flex items-center justify-center relative overflow-hidden shadow-inner group-hover:border-emerald-500/30 transition-all">
                        <User size={36} className="text-gray-700 relative z-10" />
                        <div className={`absolute inset-0 bg-${sideColor}-500/5`}></div>
                    </div>
                    <div>
                        <div className="flex items-center gap-3 mb-1.5">
                            <h3 className="text-2xl font-bold text-white tracking-tight">{leg.playerName}</h3>
                            <span className="px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-[10px] font-mono text-gray-400 uppercase tracking-widest">{leg.team}</span>
                        </div>
                        <div className="flex items-center gap-4 text-[10px] font-mono text-gray-500 uppercase tracking-widest font-bold">
                           <span className="flex items-center gap-1.5"><Zap size={12} className="text-yellow-500" /> CONFIDENCE: {(metrics.confidence * 100).toFixed(0)}%</span>
                           <span className="flex items-center gap-1.5 text-blue-400 uppercase tracking-tighter"><BrainCircuit size={12} /> Model: {metrics.modelUsed}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-8 w-full md:w-auto pt-4 md:pt-0 border-t md:border-t-0 border-gray-800/50">
                    <div className="text-right">
                        <div className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mb-1 font-mono">Win Prob</div>
                        <div className={`text-3xl font-mono font-bold text-${sideColor}-400`}>{(metrics.pModel * 100).toFixed(0)}%</div>
                    </div>
                    <div className="h-12 w-px bg-gray-800 hidden md:block"></div>
                    <div className="text-right">
                        <div className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mb-1 font-mono">Unit Advice</div>
                        <div className="text-3xl font-mono font-bold text-white">{(metrics.edge * 0.2).toFixed(1)}u</div>
                    </div>
                </div>
            </div>

            <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    {/* Left Column: Decision Logic */}
                    <div className="lg:col-span-5 space-y-6">
                        <div className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 shadow-inner">
                            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-6 flex items-center justify-between">
                                <div className="flex items-center gap-2"><Settings2 size={12} /> Operational Adjuster</div>
                                {isRecalculating && <RefreshCw size={10} className="animate-spin text-emerald-500" />}
                            </h4>
                            <div className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <button 
                                        onClick={() => setCustomPrediction('Over')} 
                                        className={`py-4 rounded-xl font-bold text-xs font-mono border transition-all flex flex-col items-center justify-center gap-1 ${customPrediction === 'Over' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'bg-gray-950 border-gray-800 text-gray-600 hover:text-gray-400'}`}
                                    >
                                        OVER
                                        {leg.prediction === 'Over' && <span className="text-[8px] font-bold opacity-50">AI PREFERRED</span>}
                                    </button>
                                    <button 
                                        onClick={() => setCustomPrediction('Under')} 
                                        className={`py-4 rounded-xl font-bold text-xs font-mono border transition-all flex flex-col items-center justify-center gap-1 ${customPrediction === 'Under' ? 'bg-rose-500/20 border-rose-500 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.1)]' : 'bg-gray-950 border-gray-800 text-gray-600 hover:text-gray-400'}`}
                                    >
                                        UNDER
                                        {leg.prediction === 'Under' && <span className="text-[8px] font-bold opacity-50">AI PREFERRED</span>}
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[9px] text-gray-600 uppercase font-mono font-bold tracking-widest flex justify-between">
                                            Market Line
                                        </label>
                                        <input 
                                            type="number" 
                                            step="0.5" 
                                            value={customLine} 
                                            onChange={(e) => setCustomLine(parseFloat(e.target.value) || 0)} 
                                            className="w-full bg-gray-950 border border-gray-800 text-white font-mono text-sm px-4 py-3 rounded-xl focus:border-emerald-500 outline-none transition-all shadow-inner" 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] text-gray-600 uppercase font-mono font-bold tracking-widest flex justify-between">
                                            Odds (US)
                                        </label>
                                        <input 
                                            type="number" 
                                            step="5" 
                                            value={customOdds} 
                                            onChange={(e) => setCustomOdds(parseInt(e.target.value) || -110)} 
                                            className="w-full bg-gray-950 border border-gray-800 text-white font-mono text-sm px-4 py-3 rounded-xl focus:border-emerald-500 outline-none transition-all shadow-inner" 
                                        />
                                    </div>
                                </div>

                                <button 
                                    onClick={handleRecalculate}
                                    disabled={isRecalculating}
                                    className="w-full py-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-emerald-500/20 hover:border-emerald-500 transition-all flex items-center justify-center gap-2 group/recalc"
                                >
                                    <RefreshCw size={14} className={`${isRecalculating ? 'animate-spin' : 'group-hover/recalc:rotate-180 transition-transform duration-500'}`} />
                                    {isRecalculating ? 'RECALCULATING...' : 'Recalculate Metrics'}
                                </button>
                            </div>
                        </div>

                        {/* Quantitative Anchor */}
                        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 shadow-2xl">
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <BrainCircuit size={14} className="text-emerald-500" /> Decision Skew Matrix
                            </div>
                            <div className="space-y-4 font-mono text-[11px]">
                                <div className="flex justify-between items-center group">
                                    <span className="text-gray-500 group-hover:text-gray-400 transition-colors">Projected Mean (μ):</span>
                                    <span className="text-emerald-400 font-bold text-lg">{metrics.muFinal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center group">
                                    <span className="text-gray-500 group-hover:text-gray-400 transition-colors">Target Line (L):</span>
                                    <span className="text-white text-lg">{customLine}</span>
                                </div>
                                <div className="h-px bg-gray-900 my-2"></div>
                                <div className="flex justify-between items-center pt-1 group">
                                    <span className="text-gray-400 font-bold uppercase tracking-widest">Model Skew (Δ):</span>
                                    <span className={`text-lg font-bold ${customPrediction === 'Over' && metrics.muFinal > customLine ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {(metrics.muFinal - customLine).toFixed(2)} pts
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Math Explanation */}
                    <div className="lg:col-span-7 space-y-6">
                        <div className="bg-gray-950 border border-emerald-500/20 p-6 rounded-3xl relative overflow-hidden group/math shadow-2xl">
                            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover/math:opacity-10 transition-opacity">
                                <Cpu size={80} />
                            </div>
                            <h4 className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
                                <Activity size={16} /> Mathematical Directives
                            </h4>
                            <div className="p-5 bg-gray-900/80 rounded-2xl border border-gray-800/50 text-[13px] text-gray-300 leading-relaxed italic shadow-inner mb-6">
                                <HighlightedRationale text={leg.rationale} />
                            </div>

                            {/* Detailed Multiplier Breakdown */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                                <MetricBadge 
                                    label="Confidence Score" 
                                    value={`${(metrics.confidence * 100).toFixed(0)}%`} 
                                    sub="Bayesian Shrinkage Index"
                                    icon={<Database size={14} />} 
                                />
                                <MetricBadge 
                                    label="Volatility (σ)" 
                                    value={metrics.sigmaFinal.toFixed(2)} 
                                    sub="Pace-Adjusted Variance"
                                    icon={<Activity size={14} />} 
                                />
                                <MetricBadge 
                                    label="Pace Multiplier" 
                                    value={`${metrics.mPace.toFixed(2)}x`} 
                                    sub="Tempo Adjustment"
                                    icon={<RefreshCw size={14} />} 
                                />
                                <MetricBadge 
                                    label="Opponent Factor" 
                                    value={`${metrics.mOpp.toFixed(2)}x`} 
                                    sub="Defensive Logic"
                                    icon={<Shield size={14} />} 
                                />
                            </div>
                            
                            {/* AI Reasoner Box */}
                            <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 flex items-start gap-4">
                                <div className="mt-1">
                                    <AlertCircle size={18} className="text-emerald-500" />
                                </div>
                                <div>
                                    <p className="text-[11px] text-gray-400 leading-relaxed">
                                        <span className="text-emerald-400 font-bold uppercase tracking-widest mr-2">Model Architect:</span> 
                                        Utilizing the <span className="text-white font-bold">{metrics.modelUsed}</span> distribution, we have identified a high-probability divergence. Our mean of <span className="text-white font-bold">{metrics.muFinal.toFixed(1)}</span> accounts for situational pace volatility (σ={metrics.sigmaFinal.toFixed(1)}), creating a <span className={`font-bold ${metrics.edge > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {metrics.edge > 0 ? '+' : ''}{metrics.edge.toFixed(1)}% ROI edge
                                        </span> against current market pricing.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Market Implied Odds Grid */}
                        <div className="grid grid-cols-2 gap-6">
                            <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800 flex flex-col justify-between shadow-xl">
                                <div className="text-[10px] text-gray-600 uppercase font-bold tracking-widest mb-2">Book Odds</div>
                                <div className="text-3xl font-mono font-bold text-white mb-2">{customOdds > 0 ? '+' : ''}{customOdds}</div>
                                <div className="text-[10px] text-gray-500 font-mono">Implied P: {(metrics.pImp * 100).toFixed(1)}%</div>
                            </div>
                            <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800 flex flex-col justify-between shadow-xl">
                                <div className="text-[10px] text-gray-600 uppercase font-bold tracking-widest mb-2">ROI Potential</div>
                                <div className={`text-3xl font-mono font-bold mb-2 ${metrics.edge > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {metrics.edge > 0 ? '+' : ''}{(metrics.edge * 1.5).toFixed(1)}%
                                </div>
                                <div className="text-[10px] text-gray-500 font-mono">Kelly Scaled: {(metrics.edge * 0.2).toFixed(2)}%</div>
                            </div>
                        </div>
                        
                        <button className="w-full py-5 bg-gray-900 border border-emerald-500/30 text-emerald-400 rounded-2xl font-bold uppercase tracking-[0.3em] text-[10px] hover:bg-emerald-500/10 hover:border-emerald-500 transition-all flex items-center justify-center gap-3 group/btn">
                           <Target size={16} className="group-hover/btn:scale-125 transition-transform" />
                           Synchronize Decision with Constructor
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
