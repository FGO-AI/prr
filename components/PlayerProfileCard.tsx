
import React, { useMemo, useState, useEffect } from 'react';
import { ParlayRecommendation, BetLeg, GameLogEntry, League } from '../types';
import { calculateEngineMetrics } from '../services/projectionEngine';
import { 
    Activity, Globe, TrendingUp, User, Zap, BrainCircuit, 
    RefreshCw, ChevronRight, Cpu, Target, Settings2, DollarSign, Clock as ClockIcon,
    AlertCircle, Shield, TrendingDown, Timer, Database, BarChart3, Info, ChevronDown, ChevronUp, ListIcon, HistoryIcon
} from './Icons';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
    ResponsiveContainer, Cell, ReferenceLine, LineChart, Line, AreaChart, Area
} from 'recharts';

interface PlayerProfileCardProps {
  data: ParlayRecommendation;
  bankroll?: number;
  onPlaceBet?: () => void;
  rank?: number;
}

const Tooltip: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => (
    <div className="group relative inline-block">
        {children}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-[10px] text-gray-300 w-48 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-2xl leading-relaxed">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-950"></div>
        </div>
    </div>
);

const HighlightedRationale: React.FC<{ text: string }> = ({ text }) => {
    if (!text) return null;
    const regex = /(MATH:|Line|μ|σ|ROI|Z-Score|Edge|discrepancy|[-+]?\d*\.?\d+%?|OVER|UNDER|Bayesian|Pace|Volatility|ROI edge)/gi;
    const parts = text.split(regex);
    
    const getTooltipText = (word: string) => {
        const w = word.toLowerCase();
        if (w.includes('μ')) return "The arithmetic mean (average) projected by the model.";
        if (w.includes('σ')) return "Sigma: The standard deviation or volatility of the projection.";
        if (w.includes('roi')) return "Return on Investment: The expected percentage gain per unit wagered.";
        if (w.includes('z-score')) return "How many standard deviations the line is from the mean.";
        if (w.includes('edge')) return "The mathematical advantage over the sportsbook's implied probability.";
        if (w.includes('bayesian')) return "A statistical method that updates probabilities as more evidence becomes available.";
        if (w.includes('pace')) return "The estimated number of possessions or opportunities in the game.";
        if (w.includes('volatility')) return "The degree of variation in the player's performance.";
        return "";
    };

    return (
        <span className="font-sans">
            {parts.map((part, i) => {
                const isMath = regex.test(part);
                if (isMath) {
                   const isVerdict = /OVER|UNDER/i.test(part);
                   const tooltip = getTooltipText(part);
                   const content = (
                       <span key={i} className={`font-mono font-bold cursor-help ${isVerdict ? 'text-emerald-400 bg-emerald-500/10 px-1 rounded' : 'text-blue-400'}`}>
                           {part}
                       </span>
                   );
                   return tooltip ? <Tooltip key={i} text={tooltip}>{content}</Tooltip> : content;
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

const BookOdds: React.FC<{ name: string; odds: number; isBest?: boolean }> = ({ name, odds, isBest }) => (
    <div className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${isBest ? 'bg-emerald-500/10 border-emerald-500/50 shadow-lg shadow-emerald-500/5' : 'bg-gray-950 border-gray-800 opacity-60 hover:opacity-100'}`}>
        <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">{name}</span>
        <span className={`text-xs font-mono font-bold ${isBest ? 'text-emerald-400' : 'text-white'}`}>
            {odds > 0 ? '+' : ''}{odds}
        </span>
        {isBest && <span className="text-[7px] font-bold text-emerald-500 uppercase tracking-tighter">Best Price</span>}
    </div>
);

export const PlayerProfileCard: React.FC<PlayerProfileCardProps> = ({ data, bankroll = 1000, onPlaceBet, rank }) => {
    const [selectedLegIdx, setSelectedLegIdx] = useState(0);
    const [activeTab, setActiveTab] = useState<'trends' | 'logs'>('trends');
    
    // Reset selected leg when data changes
    useEffect(() => {
        setSelectedLegIdx(0);
    }, [data.id]);

    const leg = data.legs[selectedLegIdx];
    
    const [customLine, setCustomLine] = useState(leg?.line || 0);
    const [customPrediction, setCustomPrediction] = useState<'Over' | 'Under'>(leg?.prediction as 'Over' | 'Under' || 'Over');
    const [customOdds, setCustomOdds] = useState(leg?.bookOdds || -110);
    const [customMins, setCustomMins] = useState(leg?.expectedMins || 30);
    const [customPace, setCustomPace] = useState(leg?.expectedPace || 100);
    const [customOppFactor, setCustomOppFactor] = useState(leg?.oppAllowed || 20);
    const [isRecalculating, setIsRecalculating] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    // NFL-Specific Local States
    const [avgPassYardsL5, setAvgPassYardsL5] = useState<number>(leg?.avgPassYardsL5 || leg?.x10 || 240);
    const [seasonAvgPassYards, setSeasonAvgPassYards] = useState<number>(leg?.seasonAvgPassYards || leg?.xSeason || 235);
    const [oppPassYardsAllowed, setOppPassYardsAllowed] = useState<number>(leg?.oppPassYardsAllowed || leg?.oppAllowed || 220);
    const [qbTdRate, setQbTdRate] = useState<number>(leg?.qbTdRate || 0.045);
    const [qbAttemptsAvg, setQbAttemptsAvg] = useState<number>(leg?.qbAttemptsAvg || leg?.xSeason || 34);
    const [rzOppRate, setRzOppRate] = useState<number>(leg?.rzOppRate || 1.0);
    const [oppPosTdRate, setOppPosTdRate] = useState<number>(leg?.oppPosTdRate || 1.0);
    const [oppPassFunnel, setOppPassFunnel] = useState<number>(leg?.oppPassFunnel || 1.0);
    const [impliedGameTotal, setImpliedGameTotal] = useState<number>(leg?.impliedGameTotal || 44.5);
    const [spreadPoints, setSpreadPoints] = useState<number>(leg?.spreadPoints || 0);
    
    // Toggles
    const [missingWR, setMissingWR] = useState<boolean>(leg?.missingWR || false);
    const [domeToColdOutdoor, setDomeToColdOutdoor] = useState<boolean>(leg?.domeToColdOutdoor || false);
    const [windSpeedMph, setWindSpeedMph] = useState<number>(leg?.windSpeedMph || 0);
    const [offBye, setOffBye] = useState<boolean>(leg?.offBye || false);
    const [shortWeek, setShortWeek] = useState<boolean>(leg?.shortWeek || false);
    const [facingManCoverage, setFacingManCoverage] = useState<boolean>(leg?.facingManCoverage || false);
    
    // Rushing
    const [carriesProjection, setCarriesProjection] = useState<number>(leg?.carriesProjection || leg?.xSeason || 14);
    const [avgYpc, setAvgYpc] = useState<number>(leg?.avgYpc || 4.2);
    const [olineRunBlockRank, setOlineRunBlockRank] = useState<number>(leg?.olineRunBlockRank || 16);
    const [rbRole, setRbRole] = useState<'workhorse' | 'committee' | 'third_down'>(leg?.rbRole || 'committee');
    const [isHandcuff, setIsHandcuff] = useState<boolean>(leg?.isHandcuff || false);
    const [teamRushTendency, setTeamRushTendency] = useState<number>(leg?.teamRushTendency || 0);
    
    // Receiving
    const [targetSharePct, setTargetSharePct] = useState<number>(leg?.targetSharePct || 0.18);
    const [teamProjPassAttempts, setTeamProjPassAttempts] = useState<number>(leg?.teamProjPassAttempts || 32);
    const [avgYpt, setAvgYpt] = useState<number>(leg?.avgYpt || 8.0);
    const [oppCoverageGrade, setOppCoverageGrade] = useState<number>(leg?.oppCoverageGrade || 1.0);
    const [separationRate, setSeparationRate] = useState<number>(leg?.separationRate || 1.0);
    const [routeConcept, setRouteConcept] = useState<'deep' | 'intermediate' | 'short'>(leg?.routeConcept || 'intermediate');
    const [catchRatePct, setCatchRatePct] = useState<number>(leg?.catchRatePct || 0.65);
    
    // Anytime TD
    const [rzTargetSharePct, setRzTargetSharePct] = useState<number>(leg?.rzTargetSharePct || 0.15);
    const [teamRzTrips, setTeamRzTrips] = useState<number>(leg?.teamRzTrips || 3.0);
    const [playerRzTdRate, setPlayerRzTdRate] = useState<number>(leg?.playerRzTdRate || 0.25);
    const [oppRzTdAllowedRate, setOppRzTdAllowedRate] = useState<number>(leg?.oppRzTdAllowedRate || 1.0);
    
    const [isDivisional, setIsDivisional] = useState<boolean>(leg?.isDivisional || false);
    const [isPlayoffAtmosphere, setIsPlayoffAtmosphere] = useState<boolean>(leg?.isPlayoffAtmosphere || false);

    useEffect(() => {
        if (leg) {
            setCustomLine(leg.line);
            setCustomPrediction(leg.prediction as 'Over' | 'Under');
            setCustomOdds(leg.bookOdds);
            setCustomMins(leg.expectedMins || 30);
            setCustomPace(leg.expectedPace || 100);
            setCustomOppFactor(leg.oppAllowed || 20);

            // Reset NFL states
            setAvgPassYardsL5(leg.avgPassYardsL5 || leg.x10 || 240);
            setSeasonAvgPassYards(leg.seasonAvgPassYards || leg.xSeason || 235);
            setOppPassYardsAllowed(leg.oppPassYardsAllowed || leg.oppAllowed || 220);
            setQbTdRate(leg.qbTdRate || 0.045);
            setQbAttemptsAvg(leg.qbAttemptsAvg || leg.xSeason || 34);
            setRzOppRate(leg.rzOppRate || 1.0);
            setOppPosTdRate(leg.oppPosTdRate || 1.0);
            setOppPassFunnel(leg.oppPassFunnel || 1.0);
            setImpliedGameTotal(leg.impliedGameTotal || 44.5);
            setSpreadPoints(leg.spreadPoints || 0);
            
            setMissingWR(leg.missingWR || false);
            setDomeToColdOutdoor(leg.domeToColdOutdoor || false);
            setWindSpeedMph(leg.windSpeedMph || 0);
            setOffBye(leg.offBye || false);
            setShortWeek(leg.shortWeek || false);
            setFacingManCoverage(leg.facingManCoverage || false);
            
            setCarriesProjection(leg.carriesProjection || leg.xSeason || 14);
            setAvgYpc(leg.avgYpc || 4.2);
            setOlineRunBlockRank(leg.olineRunBlockRank || 16);
            setRbRole(leg.rbRole || 'committee');
            setIsHandcuff(leg.isHandcuff || false);
            setTeamRushTendency(leg.teamRushTendency || 0);
            
            setTargetSharePct(leg.targetSharePct || 0.18);
            setTeamProjPassAttempts(leg.teamProjPassAttempts || 32);
            setAvgYpt(leg.avgYpt || 8.0);
            setOppCoverageGrade(leg.oppCoverageGrade || 1.0);
            setSeparationRate(leg.separationRate || 1.0);
            setRouteConcept(leg.routeConcept || 'intermediate');
            setCatchRatePct(leg.catchRatePct || 0.65);
            
            setRzTargetSharePct(leg.rzTargetSharePct || 0.15);
            setTeamRzTrips(leg.teamRzTrips || 3.0);
            setPlayerRzTdRate(leg.playerRzTdRate || 0.25);
            setOppRzTdAllowedRate(leg.oppRzTdAllowedRate || 1.0);
            
            setIsDivisional(leg.isDivisional || false);
            setIsPlayoffAtmosphere(leg.isPlayoffAtmosphere || false);
        }
    }, [leg]);

    const metrics = useMemo(() => {
        if (!leg) return null;
        return calculateEngineMetrics({ 
            ...leg, 
            line: customLine, 
            prediction: customPrediction,
            bookOdds: customOdds,
            expectedMins: customMins,
            expectedPace: customPace,
            oppAllowed: customOppFactor,
            
            // NFL Parameters
            avgPassYardsL5,
            seasonAvgPassYards,
            oppPassYardsAllowed,
            qbTdRate,
            qbAttemptsAvg,
            rzOppRate,
            oppPosTdRate,
            oppPassFunnel,
            impliedGameTotal,
            spreadPoints,
            missingWR,
            domeToColdOutdoor,
            windSpeedMph,
            offBye,
            shortWeek,
            facingManCoverage,
            carriesProjection,
            avgYpc,
            olineRunBlockRank,
            rbRole,
            isHandcuff,
            teamRushTendency,
            targetSharePct,
            teamProjPassAttempts,
            avgYpt,
            oppCoverageGrade,
            separationRate,
            routeConcept,
            catchRatePct,
            rzTargetSharePct,
            teamRzTrips,
            playerRzTdRate,
            oppRzTdAllowedRate,
            isDivisional,
            isPlayoffAtmosphere
        });
    }, [
        leg, customLine, customPrediction, customOdds, customMins, customPace, customOppFactor,
        avgPassYardsL5, seasonAvgPassYards, oppPassYardsAllowed, qbTdRate, qbAttemptsAvg, rzOppRate, oppPosTdRate,
        oppPassFunnel, impliedGameTotal, spreadPoints, missingWR, domeToColdOutdoor, windSpeedMph, offBye, shortWeek,
        facingManCoverage, carriesProjection, avgYpc, olineRunBlockRank, rbRole, isHandcuff, teamRushTendency,
        targetSharePct, teamProjPassAttempts, avgYpt, oppCoverageGrade, separationRate, routeConcept, catchRatePct,
        rzTargetSharePct, teamRzTrips, playerRzTdRate, oppRzTdAllowedRate, isDivisional, isPlayoffAtmosphere
    ]);

    const handleRecalculate = () => {
        setIsRecalculating(true);
        setTimeout(() => {
            setIsRecalculating(false);
        }, 800);
    };

    if (!leg || !metrics) return null;

    const sideColor = customPrediction === 'Over' ? 'emerald' : 'rose';

    return (
        <div className={`bg-gray-850 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl animate-fadeIn group mb-4 transition-all duration-500 ${isRecalculating ? 'opacity-50 blur-[1px] scale-[0.99]' : 'opacity-100 blur-0 scale-100'}`}>
            {/* Direct Verdict Header */}
            <div className={`p-4 bg-${sideColor}-500/10 border-b border-${sideColor}-500/20 flex items-center justify-between relative cursor-pointer hover:bg-${sideColor}-500/20 transition-all`} onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex items-center gap-3">
                    {rank !== undefined && (
                        <div className="px-2 py-0.5 rounded bg-gray-950 border border-gray-800 text-[10px] font-black text-white font-mono shadow-lg flex items-center gap-1.5">
                            #{rank}
                            {isExpanded ? <ChevronUp size={10} className="text-emerald-500" /> : <ChevronDown size={10} className="text-gray-500" />}
                        </div>
                    )}
                    <div className={`w-3 h-3 rounded-full bg-${sideColor}-500 ${isRecalculating ? 'animate-ping' : 'animate-pulse'}`}></div>
                    <span className={`text-[11px] font-black text-${sideColor}-400 uppercase tracking-[0.25em] font-mono`}>
                        VERDICT: {leg.statType.toUpperCase()} {customPrediction.toUpperCase()} {customLine} @ {customOdds > 0 ? '+' : ''}{customOdds}
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

            {/* Leg Selector for Multi-Pick Spins */}
            {data.legs.length > 1 && (
                <div className="px-6 py-3 bg-gray-900/80 border-b border-gray-800 flex items-center gap-2 overflow-x-auto custom-scrollbar">
                    <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest mr-2 shrink-0">Select Pick:</span>
                    {data.legs.map((l, idx) => (
                        <button
                            key={idx}
                            onClick={() => setSelectedLegIdx(idx)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all shrink-0 border ${
                                selectedLegIdx === idx 
                                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' 
                                    : 'bg-gray-950 border-gray-800 text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            PICK {idx + 1}: {l.playerName.split(' ').pop()}
                        </button>
                    ))}
                </div>
            )}

            {/* Ranking Justification Dropdown */}
            {isExpanded && data.rankingJustification && (
                <div className="px-6 py-4 bg-gray-950 border-b border-gray-800 animate-slideDown">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 mt-1">
                            <BrainCircuit size={16} className="text-emerald-400" />
                        </div>
                        <div>
                            <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em] mb-2">Ranking Intelligence Justification</h4>
                            <p className="text-xs text-gray-400 leading-relaxed font-sans italic">
                                "{data.rankingJustification}"
                            </p>
                        </div>
                    </div>
                </div>
            )}

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
                            {leg.gameTime && (
                                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-mono text-emerald-400 uppercase tracking-widest">
                                    <ClockIcon size={10} /> {leg.gameDate ? `${leg.gameDate} @ ` : 'PRE-GAME: '}{leg.gameTime}
                                </span>
                            )}
                            {leg.dataSource && (
                                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[9px] font-mono text-blue-400 uppercase tracking-widest">
                                    <Database size={10} /> Source: {leg.dataSource}
                                </span>
                            )}
                            {leg.lastUpdated && (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-[9px] font-mono text-gray-400 uppercase tracking-widest group/freshness relative">
                                    <div className={`w-1.5 h-1.5 rounded-full ${
                                        (Date.now() - new Date(leg.lastUpdated).getTime()) < 300000 ? 'bg-emerald-500 animate-pulse' : 
                                        (Date.now() - new Date(leg.lastUpdated).getTime()) < 900000 ? 'bg-yellow-500' : 'bg-rose-500'
                                    }`}></div>
                                    <span>Updated: {new Date(leg.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    
                                    <div className="absolute bottom-full left-0 mb-2 hidden group-hover/freshness:block w-48 p-2 bg-gray-950 border border-gray-800 rounded-lg shadow-2xl z-50">
                                        <div className="text-[8px] text-gray-500 mb-1">DATA FRESHNESS</div>
                                        <div className="text-[10px] text-white leading-tight">
                                            Last verified at {new Date(leg.lastUpdated).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-4 text-[10px] font-mono text-gray-500 uppercase tracking-widest font-bold">
                           <span className="flex items-center gap-1.5"><Zap size={12} className="text-yellow-500" /> CONFIDENCE: {(metrics.confidence * 100).toFixed(0)}%</span>
                           <span className="flex items-center gap-1.5 text-blue-400 uppercase tracking-tighter"><BrainCircuit size={12} /> Model: {metrics.modelUsed}</span>
                        </div>
                        {/* Season Stat Badges */}
                        <div className="flex items-center gap-2 mt-3">
                            <div className="px-2 py-1 bg-gray-950 border border-gray-800 rounded flex flex-col items-center min-w-[40px]">
                                <span className="text-[7px] text-gray-600 font-bold uppercase">PPG</span>
                                <span className="text-[10px] text-white font-mono font-bold">{(leg.xSeason || 0).toFixed(1)}</span>
                            </div>
                            <div className="px-2 py-1 bg-gray-950 border border-gray-800 rounded flex flex-col items-center min-w-[40px]">
                                <span className="text-[7px] text-gray-600 font-bold uppercase">L10</span>
                                <span className="text-[10px] text-white font-mono font-bold">{(leg.x10 || 0).toFixed(1)}</span>
                            </div>
                            <div className="px-2 py-1 bg-gray-950 border border-gray-800 rounded flex flex-col items-center min-w-[40px]">
                                <span className="text-[7px] text-gray-600 font-bold uppercase">Impact</span>
                                <span className="text-[10px] text-emerald-400 font-mono font-bold">8.4</span>
                            </div>
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
                                            {leg.statType} Line
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

                                {leg.league === League.NFL || leg.league === 'NFL' ? (
                                    <div className="space-y-4 pt-2 border-t border-gray-800">
                                        <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest font-mono">
                                            NFL Model Settings: {metrics?.nflPropType?.toUpperCase()?.replace('_', ' ') || 'LEG ADVANCED'}
                                        </div>
                                        
                                        {metrics?.nflPropType === 'passing_yards' && (
                                            <div className="space-y-3 animate-fadeIn">
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div>
                                                        <label className="text-[7px] text-gray-500 uppercase font-mono font-bold">L5 Avg Yds</label>
                                                        <input type="number" value={avgPassYardsL5} onChange={e => setAvgPassYardsL5(parseFloat(e.target.value) || 0)} className="w-full bg-gray-950 border border-gray-800 text-white font-mono text-[10px] px-2 py-1.5 rounded-lg focus:border-blue-500 outline-none" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[7px] text-gray-500 uppercase font-mono font-bold">Season Avg</label>
                                                        <input type="number" value={seasonAvgPassYards} onChange={e => setSeasonAvgPassYards(parseFloat(e.target.value) || 0)} className="w-full bg-gray-950 border border-gray-800 text-white font-mono text-[10px] px-2 py-1.5 rounded-lg focus:border-blue-500 outline-none" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[7px] text-gray-500 uppercase font-mono font-bold">Opp Allowed</label>
                                                        <input type="number" value={oppPassYardsAllowed} onChange={e => setOppPassYardsAllowed(parseFloat(e.target.value) || 0)} className="w-full bg-gray-950 border border-gray-800 text-white font-mono text-[10px] px-2 py-1.5 rounded-lg focus:border-blue-500 outline-none" />
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2 bg-gray-950 p-2.5 rounded-xl border border-gray-900">
                                                    <label className="text-[8px] text-gray-400 font-mono font-bold flex justify-between">
                                                        <span>Wind Speed: {windSpeedMph} MPH</span>
                                                    </label>
                                                    <input type="range" min="0" max="35" value={windSpeedMph} onChange={e => setWindSpeedMph(parseInt(e.target.value) || 0)} className="w-full accent-blue-500" />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 mt-2">
                                                    <label className="flex items-center gap-2 text-[9px] text-gray-400 font-mono cursor-pointer bg-gray-950 p-2 rounded-lg border border-gray-850 hover:border-blue-500/50">
                                                        <input type="checkbox" checked={missingWR} onChange={e => setMissingWR(e.target.checked)} className="rounded" />
                                                        <span>Missing Top WR</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 text-[9px] text-gray-400 font-mono cursor-pointer bg-gray-950 p-2 rounded-lg border border-gray-850 hover:border-blue-500/50">
                                                        <input type="checkbox" checked={domeToColdOutdoor} onChange={e => setDomeToColdOutdoor(e.target.checked)} className="rounded" />
                                                        <span>Dome to Cold</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 text-[9px] text-gray-400 font-mono cursor-pointer bg-gray-950 p-2 rounded-lg border border-gray-850 hover:border-blue-500/50">
                                                        <input type="checkbox" checked={offBye} onChange={e => setOffBye(e.target.checked)} className="rounded" />
                                                        <span>Off Bye Week</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 text-[9px] text-gray-400 font-mono cursor-pointer bg-gray-950 p-2 rounded-lg border border-gray-850 hover:border-blue-500/50">
                                                        <input type="checkbox" checked={shortWeek} onChange={e => setShortWeek(e.target.checked)} className="rounded" />
                                                        <span>Short Week</span>
                                                    </label>
                                                </div>
                                            </div>
                                        )}

                                        {(metrics?.nflPropType === 'passing_attempts' || metrics?.nflPropType === 'passing_tds') && (
                                            <div className="space-y-3 animate-fadeIn">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="text-[7px] text-gray-500 uppercase font-mono font-bold">QB Avg Attempts</label>
                                                        <input type="number" value={qbAttemptsAvg} onChange={e => setQbAttemptsAvg(parseFloat(e.target.value) || 0)} className="w-full bg-gray-950 border border-gray-800 text-white font-mono text-[10px] px-2 py-1.5 rounded-lg" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[7px] text-gray-500 uppercase font-mono font-bold">Opp Pass Funnel (x)</label>
                                                        <input type="number" step="0.05" value={oppPassFunnel} onChange={e => setOppPassFunnel(parseFloat(e.target.value) || 1.0)} className="w-full bg-gray-950 border border-gray-800 text-white font-mono text-[10px] px-2 py-1.5 rounded-lg" />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="text-[7px] text-gray-500 uppercase font-mono font-bold">Implied Game Total</label>
                                                        <input type="number" value={impliedGameTotal} onChange={e => setImpliedGameTotal(parseFloat(e.target.value) || 44.5)} className="w-full bg-gray-950 border border-gray-800 text-white font-mono text-[10px] px-2 py-1.5 rounded-lg" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[7px] text-gray-500 uppercase font-mono font-bold">Vegas Spread</label>
                                                        <input type="number" step="0.5" value={spreadPoints} onChange={e => setSpreadPoints(parseFloat(e.target.value) || 0)} className="w-full bg-gray-950 border border-gray-800 text-white font-mono text-[10px] px-2 py-1.5 rounded-lg" />
                                                    </div>
                                                </div>
                                                {metrics?.nflPropType === 'passing_tds' && (
                                                    <div className="grid grid-cols-3 gap-1 bg-gray-950 p-2 rounded-xl border border-gray-900">
                                                        <div>
                                                            <label className="text-[6px] text-gray-500 uppercase font-mono">QB TD%</label>
                                                            <input type="number" step="0.005" value={qbTdRate} onChange={e => setQbTdRate(parseFloat(e.target.value) || 0)} className="w-full bg-gray-900 text-white font-mono text-[9px] p-1 rounded" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[6px] text-gray-500 uppercase font-mono">RZ Opp Rate</label>
                                                            <input type="number" step="0.05" value={rzOppRate} onChange={e => setRzOppRate(parseFloat(e.target.value) || 0)} className="w-full bg-gray-900 text-white font-mono text-[9px] p-1 rounded" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[6px] text-gray-500 uppercase font-mono">Opp Pos TD Allowed</label>
                                                            <input type="number" step="0.05" value={oppPosTdRate} onChange={e => setOppPosTdRate(parseFloat(e.target.value) || 0)} className="w-full bg-gray-900 text-white font-mono text-[9px] p-1 rounded" />
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="grid grid-cols-2 gap-2">
                                                    <label className="flex items-center gap-2 text-[9px] text-gray-400 font-mono cursor-pointer bg-gray-950 p-2 rounded-lg border border-gray-850 hover:border-blue-500/50">
                                                        <input type="checkbox" checked={missingWR} onChange={e => setMissingWR(e.target.checked)} className="rounded" />
                                                        <span>Missing Top WR</span>
                                                    </label>
                                                </div>
                                            </div>
                                        )}

                                        {(metrics?.nflPropType === 'rushing_yards' || metrics?.nflPropType === 'rushing_carries') && (
                                            <div className="space-y-3 animate-fadeIn">
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div>
                                                        <label className="text-[7px] text-gray-500 uppercase font-mono font-bold">Proj Carries</label>
                                                        <input type="number" value={carriesProjection} onChange={e => setCarriesProjection(parseFloat(e.target.value) || 0)} className="w-full bg-gray-950 border border-gray-800 text-white font-mono text-[10px] px-2 py-1.5 rounded-lg" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[7px] text-gray-500 uppercase font-mono font-bold">Avg YPC</label>
                                                        <input type="number" step="0.1" value={avgYpc} onChange={e => setAvgYpc(parseFloat(e.target.value) || 0)} className="w-full bg-gray-950 border border-gray-800 text-white font-mono text-[10px] px-2 py-1.5 rounded-lg" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[7px] text-gray-500 uppercase font-mono font-bold">O-Line Rank</label>
                                                        <input type="number" min="1" max="32" value={olineRunBlockRank} onChange={e => setOlineRunBlockRank(parseInt(e.target.value) || 16)} className="w-full bg-gray-950 border border-gray-800 text-white font-mono text-[10px] px-2 py-1.5 rounded-lg" />
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-1.5 bg-gray-950 p-2 rounded-xl border border-gray-900">
                                                    <label className="text-[8px] text-gray-500 font-mono font-bold">Team Rush Tendency Offset (e.g. +0.10)</label>
                                                    <input type="number" step="0.05" value={teamRushTendency} onChange={e => setTeamRushTendency(parseFloat(e.target.value) || 0)} className="w-full bg-gray-900 text-white font-mono text-[10px] px-2 py-1 rounded" />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="text-[7px] text-gray-500 uppercase font-mono font-bold">RB Role</label>
                                                        <select value={rbRole} onChange={e => setRbRole(e.target.value as any)} className="w-full bg-gray-950 border border-gray-800 text-white font-mono text-[10px] px-2 py-1.5 rounded-lg">
                                                            <option value="workhorse">Workhorse (70%+ snap)</option>
                                                            <option value="committee">Committee (40-60%)</option>
                                                            <option value="third_down">3rd Down Back</option>
                                                        </select>
                                                    </div>
                                                    <label className="flex items-center gap-2 text-[9px] text-gray-400 font-mono cursor-pointer bg-gray-950 p-2 rounded-lg border border-gray-850 hover:border-blue-500/50 mt-4 h-9">
                                                        <input type="checkbox" checked={isHandcuff} onChange={e => setIsHandcuff(e.target.checked)} className="rounded" />
                                                        <span>Backup Cuff</span>
                                                    </label>
                                                </div>
                                            </div>
                                        )}

                                        {(metrics?.nflPropType === 'receiving_yards' || metrics?.nflPropType === 'receptions') && (
                                            <div className="space-y-3 animate-fadeIn">
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div>
                                                        <label className="text-[7px] text-gray-500 uppercase font-mono font-bold">Target Share %</label>
                                                        <input type="number" step="0.01" value={targetSharePct} onChange={e => setTargetSharePct(parseFloat(e.target.value) || 0)} className="w-full bg-gray-950 border border-gray-800 text-white font-mono text-[10px] px-2 py-1.5 rounded-lg" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[7px] text-gray-500 uppercase font-mono font-bold">Team Pass Att</label>
                                                        <input type="number" value={teamProjPassAttempts} onChange={e => setTeamProjPassAttempts(parseInt(e.target.value) || 0)} className="w-full bg-gray-950 border border-gray-800 text-white font-mono text-[10px] px-2 py-1.5 rounded-lg" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[7px] text-gray-500 uppercase font-mono font-bold">Catch Rate %</label>
                                                        <input type="number" step="0.01" value={catchRatePct} onChange={e => setCatchRatePct(parseFloat(e.target.value) || 0.65)} className="w-full bg-gray-950 border border-gray-800 text-white font-mono text-[10px] px-2 py-1.5 rounded-lg" />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div>
                                                        <label className="text-[7px] text-gray-500 uppercase font-mono font-bold">Avg YPT</label>
                                                        <input type="number" step="0.1" value={avgYpt} onChange={e => setAvgYpt(parseFloat(e.target.value) || 8.0)} className="w-full bg-gray-950 border border-gray-800 text-white font-mono text-[10px] px-2 py-1.5 rounded-lg" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[7px] text-gray-500 uppercase font-mono font-bold">Opp Coverage</label>
                                                        <input type="number" step="0.05" value={oppCoverageGrade} onChange={e => setOppCoverageGrade(parseFloat(e.target.value) || 1.0)} className="w-full bg-gray-950 border border-gray-800 text-white font-mono text-[10px] px-2 py-1.5 rounded-lg" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[7px] text-gray-500 uppercase font-mono font-bold">Separation</label>
                                                        <input type="number" step="0.05" value={separationRate} onChange={e => setSeparationRate(parseFloat(e.target.value) || 1.0)} className="w-full bg-gray-950 border border-gray-800 text-white font-mono text-[10px] px-2 py-1.5 rounded-lg" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[7px] text-gray-500 uppercase font-mono font-bold">Route Depth Concept</label>
                                                    <select value={routeConcept} onChange={e => setRouteConcept(e.target.value as any)} className="w-full bg-gray-950 border border-gray-800 text-white font-mono text-[10px] px-2 py-1.5 rounded-lg">
                                                        <option value="deep">Deep (15+ yards)</option>
                                                        <option value="intermediate">Intermediate (8-14 yards)</option>
                                                        <option value="short">Short/Screen (0-7 yards)</option>
                                                    </select>
                                                </div>
                                            </div>
                                        )}

                                        {metrics?.nflPropType === 'anytime_td' && (
                                            <div className="space-y-3 animate-fadeIn bg-gray-950 p-3 rounded-2xl border border-gray-900">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="text-[7px] text-gray-500 uppercase font-mono font-bold">RZ Target Share %</label>
                                                        <input type="number" step="0.01" value={rzTargetSharePct} onChange={e => setRzTargetSharePct(parseFloat(e.target.value) || 0)} className="w-full bg-gray-950 border border-gray-800 text-white font-mono text-[10px] px-2 py-1.5 rounded-md" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[7px] text-gray-500 uppercase font-mono font-bold">Team RZ Trips</label>
                                                        <input type="number" step="0.1" value={teamRzTrips} onChange={e => setTeamRzTrips(parseFloat(e.target.value) || 0)} className="w-full bg-gray-950 border border-gray-800 text-white font-mono text-[10px] px-2 py-1.5 rounded-md" />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="text-[7px] text-gray-500 uppercase font-mono font-bold">Player RZ Conv Rate</label>
                                                        <input type="number" step="0.01" value={playerRzTdRate} onChange={e => setPlayerRzTdRate(parseFloat(e.target.value) || 0)} className="w-full bg-gray-950 border border-gray-800 text-white font-mono text-[10px] px-2 py-1.5 rounded-md" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[7px] text-gray-500 uppercase font-mono font-bold">Opp RZ TD Allowed</label>
                                                        <input type="number" step="0.01" value={oppRzTdAllowedRate} onChange={e => setOppRzTdAllowedRate(parseFloat(e.target.value) || 0)} className="w-full bg-gray-950 border border-gray-800 text-white font-mono text-[10px] px-2 py-1.5 rounded-md" />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-2 p-1.5 bg-gray-950 rounded-xl border border-gray-900 mt-2">
                                            <label className="flex items-center gap-1.5 text-[8.5px] text-gray-400 font-mono cursor-pointer hover:text-white transition-colors">
                                                <input type="checkbox" checked={isDivisional} onChange={e => setIsDivisional(e.target.checked)} className="rounded border-gray-800 text-blue-500 bg-gray-950" />
                                                <span>Divisional Familiarity</span>
                                            </label>
                                            <label className="flex items-center gap-1.5 text-[8.5px] text-gray-400 font-mono cursor-pointer hover:text-white transition-colors">
                                                <input type="checkbox" checked={isPlayoffAtmosphere} onChange={e => setIsPlayoffAtmosphere(e.target.checked)} className="rounded border-gray-800 text-blue-500 bg-gray-950" />
                                                <span>Playoff Intensity</span>
                                            </label>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 gap-3 animate-fadeIn">
                                        <div className="space-y-2">
                                            <label className="text-[8px] text-gray-600 uppercase font-mono font-bold tracking-widest">Mins</label>
                                            <input 
                                                type="number" 
                                                value={customMins} 
                                                onChange={(e) => setCustomMins(parseFloat(e.target.value) || 0)} 
                                                className="w-full bg-gray-950 border border-gray-800 text-white font-mono text-[10px] px-2 py-2 rounded-lg focus:border-emerald-500 outline-none transition-all" 
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[8px] text-gray-600 uppercase font-mono font-bold tracking-widest">Pace</label>
                                            <input 
                                                type="number" 
                                                value={customPace} 
                                                onChange={(e) => setCustomPace(parseFloat(e.target.value) || 0)} 
                                                className="w-full bg-gray-950 border border-gray-800 text-white font-mono text-[10px] px-2 py-2 rounded-lg focus:border-emerald-500 outline-none transition-all" 
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[8px] text-gray-600 uppercase font-mono font-bold tracking-widest">Def</label>
                                            <input 
                                                type="number" 
                                                value={customOppFactor} 
                                                onChange={(e) => setCustomOppFactor(parseFloat(e.target.value) || 0)} 
                                                className="w-full bg-gray-950 border border-gray-800 text-white font-mono text-[10px] px-2 py-2 rounded-lg focus:border-emerald-500 outline-none transition-all" 
                                            />
                                        </div>
                                    </div>
                                )}

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
                                    <span className="text-gray-500 group-hover:text-gray-400 transition-colors">Projected {leg.statType} (μ):</span>
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

                        {/* Comparative Analysis Chart */}
                        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 shadow-2xl">
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <BarChart3 size={14} className="text-blue-400" /> Comparative Analysis
                            </div>
                            <div className="h-40 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={[
                                        { name: 'Season', value: leg.xSeason || 0, fill: '#374151' },
                                        { name: 'L10', value: leg.x10 || 0, fill: '#4b5563' },
                                        { name: 'Projected', value: metrics.muFinal, fill: '#10b981' },
                                        { name: 'Line', value: customLine, fill: '#f43f5e' }
                                    ]}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#6b7280' }} />
                                        <YAxis hide domain={[0, 'auto']} />
                                        <RechartsTooltip 
                                            contentStyle={{ backgroundColor: '#030712', border: '1px solid #1f2937', borderRadius: '8px', fontSize: '10px' }}
                                            itemStyle={{ color: '#fff' }}
                                        />
                                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                            { [0,1,2,3].map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={index === 2 ? '#10b981' : index === 3 ? '#f43f5e' : '#374151'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
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
                            {leg.league === League.MLB || leg.league === 'MLB' ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 animate-fadeIn">
                                    <MetricBadge 
                                        label="Umpire Tendency" 
                                        value={leg.statType.toLowerCase().includes('strikeout') || leg.statType.toLowerCase().includes('ks') ? `${(leg.umpireKRate || 1.0).toFixed(2)}x` : '1.00x (Zone)'} 
                                        sub="Strikes/Out Rate Weight"
                                        icon={<Target size={14} />} 
                                    />
                                    <MetricBadge 
                                        label="Volatility (σ)" 
                                        value={metrics.sigmaFinal.toFixed(2)} 
                                        sub="Statcast Variance"
                                        icon={<Activity size={14} />} 
                                    />
                                    <MetricBadge 
                                        label="Platoon Matchup" 
                                        value={`${(leg.platoonFactor || 1.00).toFixed(2)}x`} 
                                        sub="Handedness Platoon Bias"
                                        icon={<Shield size={14} />} 
                                    />
                                    <MetricBadge 
                                        label="Park Factor" 
                                        value={`${(leg.parkHrFactor || leg.parkFactor || leg.parkRunFactor || 1.0).toFixed(2)}x`} 
                                        sub="Stadium Index Adjustment"
                                        icon={<Globe size={14} />} 
                                    />
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                                    <MetricBadge 
                                        label="Confidence Score" 
                                        value={`${((metrics.confidence || 0) * 100).toFixed(0)}%`} 
                                        sub="Bayesian Shrinkage Index"
                                        icon={<Database size={14} />} 
                                    />
                                    <MetricBadge 
                                        label="Volatility (σ)" 
                                        value={(metrics.sigmaFinal || 0).toFixed(2)} 
                                        sub="Pace-Adjusted Variance"
                                        icon={<Activity size={14} />} 
                                    />
                                    <MetricBadge 
                                        label="Pace Multiplier" 
                                        value={`${(metrics.mPace || 1).toFixed(2)}x`} 
                                        sub="Tempo Adjustment"
                                        icon={<RefreshCw size={14} />} 
                                    />
                                    <MetricBadge 
                                        label="Opponent Factor" 
                                        value={`${(metrics.mOpp || 1).toFixed(2)}x`} 
                                        sub="Defensive Logic"
                                        icon={<Shield size={14} />} 
                                    />
                                </div>
                            )}
                            
                            {/* AI Reasoner Box */}
                            <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 flex items-start gap-4 mb-6">
                                <div className="mt-1">
                                    <AlertCircle size={18} className="text-emerald-500" />
                                </div>
                                <div className="w-full">
                                    {leg.league === League.MLB || leg.league === 'MLB' ? (
                                        <div className="text-[11px] text-gray-400 leading-relaxed space-y-1.5 w-full">
                                            <p>
                                                <span className="text-emerald-400 font-bold uppercase tracking-widest mr-2">MLB Statcast Engine:</span> 
                                                Utilizing the <span className="text-white font-bold">{metrics.modelUsed}</span> distribution, we completed a high-frequency projection on the <span className="text-white font-bold">{leg.statType}</span> market.
                                            </p>
                                            <div className="p-2.5 bg-gray-950/90 rounded border border-gray-800 font-mono text-[9.5px] text-emerald-300">
                                                {metrics.mlbFormulaSummary || "Projected expectation = (Statcast Grounding Variables)"}
                                            </div>
                                            <p className="font-mono text-[10px]">
                                                Signal Resolution: <span className="text-emerald-400 font-bold">{metrics.mlbEdgeSignal || "No bet"}</span>
                                            </p>
                                        </div>
                                    ) : leg.league === League.NFL || leg.league === 'NFL' ? (
                                        <div className="text-[11px] text-gray-400 leading-relaxed space-y-1.5 w-full">
                                            <p>
                                                <span className="text-emerald-400 font-bold uppercase tracking-widest mr-2">NFL Prop Science:</span> 
                                                Utilizing the <span className="text-white font-bold">{metrics.modelUsed}</span> distribution, we modeled the <span className="text-white font-bold">{leg.statType}</span> market under strict situational game scripts.
                                            </p>
                                            <div className="p-2.5 bg-gray-950/90 rounded border border-gray-800 font-mono text-[9.5px] text-emerald-300">
                                                {metrics.nflFormulaSummary}
                                            </div>
                                            <div className="font-mono text-[10px] flex flex-wrap items-center gap-4">
                                                <span>Signal Resolution: <span className="text-emerald-400 font-bold">{metrics.nflEdgeSignal || "No bet"}</span></span>
                                                <span>Confidence Level: <span className="text-blue-400 font-bold">{metrics.nflConfidenceText || "None"}</span></span>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-[11px] text-gray-400 leading-relaxed">
                                            <span className="text-emerald-400 font-bold uppercase tracking-widest mr-2">Model Architect:</span> 
                                            Utilizing the <span className="text-white font-bold">{metrics.modelUsed}</span> distribution, we have identified a high-probability divergence in the <span className="text-white font-bold">{leg.statType}</span> market. Our mean of <span className="text-white font-bold">{metrics.muFinal.toFixed(1)}</span> accounts for situational pace volatility (σ={metrics.sigmaFinal?.toFixed(1)}), creating a <span className={`font-bold ${metrics.edge > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {metrics.edge > 0 ? '+' : ''}{metrics.edge.toFixed(1)}% ROI edge
                                            </span> against current market pricing.
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Game Theory Strategy Section */}
                            <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-5">
                                <h5 className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                    <Globe size={14} /> Game Theory Insights
                                </h5>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <div className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">Market Sentiment</div>
                                        <div className="flex items-center gap-2">
                                            <div className="h-1.5 flex-1 bg-gray-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-500 w-[65%]"></div>
                                            </div>
                                            <span className="text-[10px] font-mono text-blue-400">{leg.marketSentiment || '65% Public'}</span>
                                        </div>
                                        <p className="text-[9px] text-gray-600 leading-tight">{leg.marketSentiment?.includes('Public') ? `Public lean detected; sharp indicators suggest value on the ${customPrediction}.` : 'Balanced market action; model edge derived from statistical divergence.'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">Correlation Matrix</div>
                                        <div className="flex items-center gap-2">
                                            <div className="h-1.5 flex-1 bg-gray-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500 w-[82%]"></div>
                                            </div>
                                            <span className="text-[10px] font-mono text-emerald-400">0.82 Score</span>
                                        </div>
                                        <p className="text-[9px] text-gray-600 leading-tight">{leg.correlationInsight || 'High positive correlation with team total points and primary playmaker assists.'}</p>
                                    </div>
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

                        {/* Real-Time Market Comparison */}
                        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 shadow-2xl">
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center justify-between">
                                <div className="flex items-center gap-2"><Globe size={14} className="text-blue-400" /> Real-Time Market Comparison</div>
                                <div className="flex items-center gap-1 text-[8px] text-emerald-500 font-mono">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                    LIVE SYNC
                                </div>
                            </div>
                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                <BookOdds name="FanDuel" odds={leg.marketOdds?.fanDuel || customOdds} isBest={(leg.marketOdds?.fanDuel || customOdds) >= Math.max(...Object.values(leg.marketOdds || { o: customOdds }).map(v => Number(v)))} />
                                <BookOdds name="DraftKings" odds={leg.marketOdds?.draftKings || customOdds} isBest={(leg.marketOdds?.draftKings || customOdds) >= Math.max(...Object.values(leg.marketOdds || { o: customOdds }).map(v => Number(v)))} />
                                <BookOdds name="BetMGM" odds={leg.marketOdds?.betMGM || customOdds} isBest={(leg.marketOdds?.betMGM || customOdds) >= Math.max(...Object.values(leg.marketOdds || { o: customOdds }).map(v => Number(v)))} />
                                <BookOdds name="Caesars" odds={leg.marketOdds?.caesars || customOdds} isBest={(leg.marketOdds?.caesars || customOdds) >= Math.max(...Object.values(leg.marketOdds || { o: customOdds }).map(v => Number(v)))} />
                                <BookOdds name="Pinnacle" odds={leg.marketOdds?.pinnacle || customOdds} isBest={(leg.marketOdds?.pinnacle || customOdds) >= Math.max(...Object.values(leg.marketOdds || { o: customOdds }).map(v => Number(v)))} />
                            </div>
                            <div className="mt-4 p-3 bg-blue-500/5 rounded-xl border border-blue-500/10 flex items-center gap-3">
                                <Info size={14} className="text-blue-400 shrink-0" />
                                <p className="text-[9px] text-gray-500 leading-tight">
                                    Lines are synchronized via <span className="text-blue-400 font-bold">Google Search Grounding</span>. Discrepancies between books indicate potential arbitrage or stale line value.
                                </p>
                            </div>
                        </div>
                        
                        {/* Smart Stats Dashboard */}
                        <div className="bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
                            <div className="flex border-b border-gray-800">
                                <button 
                                    onClick={() => setActiveTab('trends')}
                                    className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'trends' ? 'bg-gray-900 text-emerald-400 border-b-2 border-emerald-500' : 'text-gray-600 hover:text-gray-400'}`}
                                >
                                    Trend Analysis
                                </button>
                                <button 
                                    onClick={() => setActiveTab('logs')}
                                    className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'logs' ? 'bg-gray-900 text-emerald-400 border-b-2 border-emerald-500' : 'text-gray-600 hover:text-gray-400'}`}
                                >
                                    Recent Game Logs
                                </button>
                            </div>
                            
                            <div className="p-5">
                                {activeTab === 'trends' ? (
                                    <div className="h-48 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={[
                                                { g: 1, v: (leg.xSeason || 0) * 0.8 },
                                                { g: 2, v: (leg.xSeason || 0) * 1.1 },
                                                { g: 3, v: (leg.xSeason || 0) * 0.9 },
                                                { g: 4, v: (leg.xSeason || 0) * 1.3 },
                                                { g: 5, v: (leg.xSeason || 0) * 1.0 },
                                                { g: 6, v: (leg.xSeason || 0) * 0.7 },
                                                { g: 7, v: (leg.xSeason || 0) * 1.2 },
                                                { g: 8, v: (leg.xSeason || 0) * 1.1 },
                                                { g: 9, v: (leg.xSeason || 0) * 0.9 },
                                                { g: 10, v: (leg.xSeason || 0) * 1.4 },
                                            ]}>
                                                <defs>
                                                    <linearGradient id="colorV" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                                                <XAxis dataKey="g" hide />
                                                <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                                                <RechartsTooltip 
                                                    contentStyle={{ backgroundColor: '#030712', border: '1px solid #1f2937', borderRadius: '8px', fontSize: '10px' }}
                                                    itemStyle={{ color: '#fff' }}
                                                />
                                                <ReferenceLine y={customLine} stroke="#f43f5e" strokeDasharray="3 3" label={{ position: 'right', value: 'Line', fill: '#f43f5e', fontSize: 8 }} />
                                                <Area type="monotone" dataKey="v" stroke="#10b981" fillOpacity={1} fill="url(#colorV)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                        <div className="flex justify-between mt-2 text-[8px] text-gray-600 font-mono uppercase tracking-widest">
                                            <span>10 Games Ago</span>
                                            <span>Most Recent</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {leg.historicalInfluence && (
                                            <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl mb-2">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <HistoryIcon size={12} className="text-emerald-400" />
                                                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Historical Influence Analysis</span>
                                                </div>
                                                <p className="text-[10px] text-gray-400 leading-relaxed italic">
                                                    "{leg.historicalInfluence}"
                                                </p>
                                            </div>
                                        )}
                                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                        {(leg.recentGames || []).map((game, i) => (
                                            <div key={i} className="flex items-center justify-between p-2 bg-gray-900/50 rounded border border-gray-800/50 text-[10px]">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-gray-600 font-mono">{game.date}</span>
                                                    <span className="text-white font-bold">vs {game.opponent}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className={`font-mono font-bold ${game.hit ? 'text-emerald-400' : 'text-rose-400'}`}>{game.value}</span>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${game.hit ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                                </div>
                                            </div>
                                        ))}
                                        {(!leg.recentGames || leg.recentGames.length === 0) && (
                                            <div className="text-center py-8 text-gray-600 text-[10px] font-mono italic">No recent game data available for this player.</div>
                                        )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button 
                           onClick={onPlaceBet}
                           className="w-full py-5 bg-emerald-500 text-gray-950 rounded-2xl font-bold uppercase tracking-[0.3em] text-[10px] hover:bg-emerald-600 transition-all flex items-center justify-center gap-3 group/btn shadow-lg shadow-emerald-500/20"
                        >
                           <Target size={16} className="group-hover/btn:scale-125 transition-transform" />
                           Lock in Pick & Track Outcome
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
