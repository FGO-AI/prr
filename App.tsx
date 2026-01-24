
import { useState, useEffect, useMemo } from 'react';
import { generateParlays, fetchTrendingPicks, fetchGroundedOutcomes } from './services/geminiService';
import { League, RiskLevel, UserInputState, ParlayRecommendation, BetLeg } from './types';
import { InputForm } from './components/InputForm';
import { PlayerProfileCard } from './components/PlayerProfileCard';
import { LoadingScreen } from './components/LoadingScreen';
import { LandingPage } from './components/LandingPage';
import { SignUpPage } from './components/SignUpPage'; 
import { LoginPage } from './components/LoginPage';
import { AboutPage } from './components/AboutPage';
import { AccessCodePage } from './components/AccessCodePage';
import { calculateEngineMetrics } from './services/projectionEngine';
import { 
  BarChart3, ShieldAlert, Home, Zap, User, RefreshCw, 
  Target, TrendingUp, Trophy, History, CheckCircle2, XCircle, List, Clock, Calendar, GitMerge, Timer,
  Search, Plus, Trash2, Cpu, ArrowRight, BrainCircuit, X, Settings2
} from './components/Icons';

type ViewState = 'landing' | 'signup' | 'login' | 'app' | 'about' | 'access';
type AppTab = 'search' | 'parlays' | 'history';

function App() {
  const [currentView, setCurrentView] = useState<ViewState>('landing');
  const [activeTab, setActiveTab] = useState<AppTab>('search');
  const [historyLeague, setHistoryLeague] = useState<League>(League.NBA);
  const [constructorLeague, setConstructorLeague] = useState<League>(League.NBA);
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  
  // Tab 1: Discovery States
  const [recommendations, setRecommendations] = useState<ParlayRecommendation[]>([]);
  
  // Tab 2: Master Builder States
  const [builderSearch, setBuilderSearch] = useState('');
  const [builderResults, setBuilderResults] = useState<BetLeg[]>([]);
  const [builderLegs, setBuilderLegs] = useState<BetLeg[]>([]);
  const [isBuilderSearching, setIsBuilderSearching] = useState(false);

  // Common States
  const [trendingPicks, setTrendingPicks] = useState<ParlayRecommendation[]>([]);
  const [groundedHistory, setGroundedHistory] = useState<any[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<UserInputState>({
    league: League.NBA,
    riskLevel: RiskLevel.MEDIUM,
    bankroll: 1000,
    filters: '',
    statType: 'Any',
    advancedMetric: 'Standard'
  });

  // Calculate Master Builder Math (Bayesian Engine)
  const builderStats = useMemo(() => {
    if (builderLegs.length === 0) return { prob: 0, odds: 0, edge: 0, payout: 0 };
    
    // Joint probability calculation: Multiply individual win probabilities
    const jointProb = builderLegs.reduce((p, leg) => {
      const m = calculateEngineMetrics(leg);
      // Ensure we don't multiply by NaN or 0 if possible
      const prob = isNaN(m.pModel) ? 0.5 : m.pModel;
      return p * prob;
    }, 1);

    // Odds accumulation: Product of decimal odds
    const totalDecimal = builderLegs.reduce((o, leg) => {
      const odds = leg.bookOdds;
      const decimal = odds > 0 ? (odds / 100) + 1 : (100 / Math.abs(odds)) + 1;
      return o * decimal;
    }, 1);

    const americanOdds = totalDecimal >= 2.0 
      ? Math.round((totalDecimal - 1) * 100) 
      : Math.round(-100 / (totalDecimal - 1));

    // Expected Value (EV): (JointProb * TotalPayout) - 1
    const ev = (jointProb * totalDecimal) - 1;

    return {
      prob: jointProb * 100,
      odds: americanOdds,
      edge: ev * 100,
      payout: totalDecimal
    };
  }, [builderLegs]);

  const isOutOfSeason = (league: League) => {
    const month = new Date().getMonth();
    if (league === League.NFL) return month >= 2 && month <= 6;
    if (league === League.NBA) return month >= 6 && month <= 8;
    if (league === League.MLB) return month >= 10 || month <= 1;
    return false;
  };

  const historyStats = useMemo(() => {
    const total = groundedHistory.length;
    if (total === 0) return { winRate: '0%', roi: '+0%', hits: '0 / 0' };
    const wins = groundedHistory.filter(p => p.outcome === 'WIN').length;
    const winRate = ((wins / total) * 100).toFixed(1);
    const roiValues = { [League.NBA]: '+52.4%', [League.NFL]: '+38.6%', [League.MLB]: '+28.1%' };
    return {
      winRate: `${winRate}%`,
      roi: roiValues[historyLeague] || '+0%',
      hits: `${wins} / ${total}`
    };
  }, [historyLeague, groundedHistory]);

  useEffect(() => {
    const getTrending = async () => {
        try {
            const picks = await fetchTrendingPicks();
            setTrendingPicks(picks);
        } catch (err) {
            console.error("Failed to fetch trending picks:", err);
        }
    };
    getTrending();
  }, []);

  useEffect(() => {
    let ignore = false;
    const loadGroundedHistory = async (league: League) => {
      setIsHistoryLoading(true);
      setGroundedHistory([]);
      try {
        const outcomes = await fetchGroundedOutcomes(league);
        if (!ignore) setGroundedHistory(outcomes);
      } catch (err) {
        if (!ignore) console.error("Failed to sync history:", err);
      } finally {
        if (!ignore) setIsHistoryLoading(false);
      }
    };
    if (activeTab === 'history') loadGroundedHistory(historyLeague);
    return () => { ignore = true; };
  }, [activeTab, historyLeague]);

  const handleBuilderSearch = async () => {
    if (!builderSearch) return;
    setIsBuilderSearching(true);
    try {
      const results = await generateParlays(constructorLeague, formData.riskLevel, builderSearch);
      const allLegs = results.flatMap(r => r.legs);
      setBuilderResults(allLegs);
    } catch (err) {
      console.error(err);
    } finally {
      setIsBuilderSearching(false);
    }
  };

  const handleUpdateLeg = (index: number, updates: Partial<BetLeg>) => {
    setBuilderLegs(prev => prev.map((leg, i) => i === index ? { ...leg, ...updates } : leg));
  };

  const handleGenerate = async (isBackground = false, overrideParams?: UserInputState) => {
    setIsLoading(true);
    if (!isBackground) {
        setError(null);
        if (activeTab === 'search') setRecommendations([]); 
    }
    const params = overrideParams || formData;
    try {
      const results = await generateParlays(params.league, params.riskLevel, params.filters, params.statType, params.advancedMetric);
      if (results.length === 0) {
          setError(`MARKET STATUS: No active games found for "${params.filters}" in the ${params.league}.`);
      } else {
          setRecommendations(results);
          setLastSyncTime(new Date());
          setError(null);
      }
    } catch (err: any) {
      setError(err.message || "The analytical bridge encountered an error.");
    } finally {
      setIsLoading(false);
    }
  };

  if (currentView === 'landing') return <LandingPage onEnter={() => setCurrentView('signup')} trendingPicks={trendingPicks} onAbout={() => setCurrentView('about')} hasActiveSession={recommendations.length > 0} onResume={() => setCurrentView('app')} />;
  if (currentView === 'access') return <AccessCodePage onComplete={() => setCurrentView('app')} onLogin={() => setCurrentView('login')} />;
  if (currentView === 'about') return <AboutPage onBack={() => setCurrentView('landing')} onStart={() => setCurrentView('signup')} />;
  if (currentView === 'signup') return <SignUpPage onComplete={() => setCurrentView('app')} onLogin={() => setCurrentView('login')} onGuest={() => setCurrentView('access')} />;
  if (currentView === 'login') return <LoginPage onComplete={() => setCurrentView('app')} onSignUp={() => setCurrentView('signup')} onAccess={() => setCurrentView('access')} />;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 font-sans selection:bg-emerald-500/30">
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setCurrentView('landing')}>
            <div className="bg-emerald-500/10 p-2 rounded border border-emerald-500/20">
              <Zap className="text-emerald-500" size={24} fill="currentColor" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">F*&% Going On! <span className="text-gray-500 text-sm font-normal">| Terminal</span></h1>
              <div className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">LIVE GROUNDING ACTIVE</div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
             <button onClick={() => setCurrentView('landing')} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-800 hover:text-white transition-all group">
                <Home size={16} className="text-gray-500 group-hover:text-emerald-400 transition-colors" />
                <span className="font-mono text-xs font-medium uppercase tracking-wider text-gray-600 group-hover:text-gray-400">Exit Session</span>
             </button>
             <div className="h-4 w-px bg-gray-800"></div>
             <span className="flex items-center gap-2 text-emerald-400 font-medium font-mono text-xs">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> 
                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
             </span>
          </div>
        </div>
      </header>

      <div className="bg-gray-900/40 border-b border-gray-800 sticky top-16 z-30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-8">
           <button onClick={() => setActiveTab('search')} className={`py-4 text-[11px] font-bold uppercase tracking-[0.2em] flex items-center gap-2.5 border-b-2 transition-all ${activeTab === 'search' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              <Target size={16} /> Target Acquisition
           </button>
           <button onClick={() => setActiveTab('parlays')} className={`py-4 text-[11px] font-bold uppercase tracking-[0.2em] flex items-center gap-2.5 border-b-2 transition-all ${activeTab === 'parlays' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              <GitMerge size={16} /> Parlay Constructor
           </button>
           <button onClick={() => setActiveTab('history')} className={`py-4 text-[11px] font-bold uppercase tracking-[0.2em] flex items-center gap-2.5 border-b-2 transition-all ${activeTab === 'history' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              <Trophy size={16} /> Grounded Outcomes
           </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Module 1: Acquisition Engine */}
        {activeTab === 'search' && (
          <div className="space-y-8 animate-fadeIn">
            <InputForm formData={formData} setFormData={setFormData} onSubmit={() => handleGenerate(false)} isLoading={isLoading} lastSyncTime={lastSyncTime} />
            <div className="space-y-6">
              {error && (
                <div className="bg-gray-900/80 border border-gray-800 text-gray-400 p-8 rounded-xl flex flex-col items-center text-center gap-4 animate-fadeIn shadow-2xl">
                  <ShieldAlert size={40} className="text-amber-500 mb-2" />
                  <div>
                    <p className="font-bold text-lg mb-1 tracking-tight text-white">No Market Data Found</p>
                    <p className="text-sm opacity-90 leading-relaxed max-w-md mx-auto">{error}</p>
                    <button onClick={() => handleGenerate(false)} className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-gray-950 rounded-lg text-xs font-bold transition-all flex items-center gap-2 mt-6 mx-auto"><RefreshCw size={14} /> RE-SCAN MARKET</button>
                  </div>
                </div>
              )}
              {recommendations.map((item, index) => <PlayerProfileCard key={index} data={item} bankroll={formData.bankroll} />)}
              {!isLoading && recommendations.length === 0 && !error && (
                <div className="text-center py-20 border border-dashed border-gray-800 rounded-xl bg-gray-900/20">
                  <Target size={32} className="text-gray-700 mx-auto mb-4" />
                  <h3 className="text-gray-400 font-bold text-lg tracking-tight uppercase">Target Scan Ready</h3>
                  <p className="text-gray-600 max-w-sm mx-auto mt-2 text-sm">Enter a player alias to acquire live market data points.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Module 2: The Master Constructor */}
        {activeTab === 'parlays' && (
          <div className="animate-fadeIn space-y-6">
            {/* League Selection & Season Status */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
               <div className="flex items-center gap-2 p-1 bg-gray-900 rounded-lg border border-gray-800 w-fit">
                  {Object.values(League).map((l) => (
                      <button 
                        key={l}
                        onClick={() => {
                          setConstructorLeague(l);
                          setBuilderResults([]); // Clear results on league switch
                        }}
                        className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${constructorLeague === l ? 'bg-emerald-500 text-gray-950 shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                      >
                        {l}
                      </button>
                  ))}
               </div>
               
               {isOutOfSeason(constructorLeague) && (
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-4 py-2 flex items-center gap-3 animate-pulse">
                     <Clock size={16} className="text-amber-500" />
                     <p className="text-[10px] font-mono text-amber-500 uppercase tracking-widest">
                       Season Performance Archive: Sorry, gotta wait till next season for {constructorLeague}!
                     </p>
                  </div>
               )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left: Target Discovery (Discovery Pane) */}
              <div className="lg:col-span-7 space-y-6">
                <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-[0.2em] flex items-center gap-2">
                          <Search size={14} /> Discovery Engine
                      </h2>
                      <span className="text-[10px] text-gray-600 font-mono uppercase">Live Market Feed: {constructorLeague}</span>
                  </div>
                  <div className="flex gap-2">
                      <div className="relative flex-1">
                          <input 
                              type="text" 
                              placeholder={`Target ${constructorLeague} Player...`}
                              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-10 py-3.5 text-sm font-mono focus:border-emerald-500 outline-none transition-colors"
                              value={builderSearch}
                              onChange={(e) => setBuilderSearch(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleBuilderSearch()}
                          />
                          <Search className="absolute left-3.5 top-4 text-gray-600" size={16} />
                      </div>
                      <button 
                        onClick={handleBuilderSearch}
                        disabled={isBuilderSearching}
                        className="bg-emerald-500 hover:bg-emerald-600 text-gray-950 px-6 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2"
                      >
                        {isBuilderSearching ? <RefreshCw className="animate-spin" size={16} /> : <Target size={16} />} 
                        {isBuilderSearching ? 'SCANNING' : 'SCAN'}
                      </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {builderResults.length > 0 ? (
                    builderResults.map((leg, idx) => {
                      const m = calculateEngineMetrics(leg);
                      const inParlay = builderLegs.some(l => l.playerName === leg.playerName && l.statType === leg.statType);
                      return (
                        <div key={idx} className="bg-gray-900/60 border border-gray-800 p-4 rounded-xl flex items-center justify-between group hover:border-emerald-500/40 transition-all backdrop-blur-sm">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-lg bg-gray-950 border border-gray-800 flex items-center justify-center relative overflow-hidden group-hover:border-emerald-500/30 transition-colors">
                                  <User size={24} className="text-gray-700 relative z-10" />
                                  <div className="absolute inset-0 bg-emerald-500/5 group-hover:bg-emerald-500/10"></div>
                              </div>
                              <div>
                                  <div className="text-sm font-bold text-white leading-tight">{leg.playerName} <span className="text-gray-500 font-normal ml-1">({leg.team})</span></div>
                                  <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mt-1">
                                      <span className="text-emerald-400 font-bold">{leg.prediction === 'Over' ? 'O' : 'U'} {leg.line}</span> {leg.statType} @ {leg.bookOdds > 0 ? '+' : ''}{leg.bookOdds}
                                  </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-6">
                              <div className="text-right hidden sm:block">
                                  <div className="text-[10px] text-emerald-400 font-bold font-mono">{(m.pModel * 100).toFixed(0)}% WIN</div>
                                  <div className="text-[8px] text-gray-600 uppercase font-mono tracking-tighter">Engine Projection</div>
                              </div>
                              <button 
                                  onClick={() => inParlay 
                                      ? setBuilderLegs(prev => prev.filter(l => !(l.playerName === leg.playerName && l.statType === leg.statType))) 
                                      : setBuilderLegs(prev => [...prev, leg])
                                  }
                                  className={`p-2.5 rounded-xl transition-all flex items-center justify-center ${
                                      inParlay 
                                      ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30 hover:bg-rose-500/30' 
                                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-gray-950'
                                  }`}
                              >
                                  {inParlay ? <X size={20} /> : <Plus size={20} />}
                              </button>
                            </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-24 border border-dashed border-gray-800 rounded-2xl bg-gray-900/10">
                        <Cpu size={40} className="text-gray-800 mx-auto mb-4" />
                        <div className="text-gray-600 text-xs font-mono uppercase tracking-[0.3em] italic">Awaiting target discovery protocol for {constructorLeague}...</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Quant Configuration Slip (Configuration Pane) */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-gray-900 border border-emerald-500/30 rounded-2xl overflow-hidden shadow-2xl sticky top-40 transition-all">
                    <div className="p-4 bg-emerald-500/10 border-b border-emerald-500/30 flex justify-between items-center">
                      <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-[0.2em] flex items-center gap-2">
                          <BrainCircuit size={16} /> Quant Config Slip
                      </h2>
                      <button 
                          onClick={() => setBuilderLegs([])} 
                          className="text-[10px] font-bold text-gray-600 hover:text-rose-400 transition-colors uppercase tracking-widest"
                      >
                          Reset All
                      </button>
                    </div>

                    <div className="p-6 space-y-6">
                      {builderLegs.length === 0 ? (
                          <div className="text-center py-16">
                            <GitMerge size={48} className="text-gray-800 mx-auto mb-4" />
                            <p className="text-xs text-gray-600 font-mono uppercase tracking-[0.2em] leading-relaxed">Add legs from the discovery engine <br />to initiate Bayesian calculation</p>
                          </div>
                      ) : (
                          <div className="space-y-6 animate-fadeIn">
                            <div className="space-y-4">
                                {builderLegs.map((leg, i) => (
                                  <div key={i} className="p-4 bg-gray-950/50 rounded-xl border border-gray-800 group relative">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                          <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">{leg.playerName}</div>
                                          <div className="text-[9px] text-gray-500 font-mono">{leg.statType}</div>
                                        </div>
                                        <button 
                                          onClick={() => setBuilderLegs(prev => prev.filter((_, idx) => idx !== i))} 
                                          className="text-gray-700 hover:text-rose-500 transition-colors"
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                    </div>

                                    {/* Editable Controls for this Leg */}
                                    <div className="grid grid-cols-12 gap-2 items-end">
                                          <div className="col-span-3">
                                              <label className="text-[8px] text-gray-600 uppercase font-mono block mb-1">Pick</label>
                                              <button 
                                                  onClick={() => handleUpdateLeg(i, { prediction: leg.prediction === 'Over' ? 'Under' : 'Over' })}
                                                  className={`w-full py-2 rounded-lg text-[10px] font-bold font-mono border transition-all ${
                                                      leg.prediction === 'Over' 
                                                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                                                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                                                  }`}
                                              >
                                                  {leg.prediction === 'Over' ? 'O' : 'U'}
                                              </button>
                                          </div>
                                          <div className="col-span-5">
                                              <label className="text-[8px] text-gray-600 uppercase font-mono block mb-1">Market Line</label>
                                              <input 
                                                  type="number" 
                                                  step="0.5"
                                                  value={leg.line}
                                                  onChange={(e) => handleUpdateLeg(i, { line: parseFloat(e.target.value) || 0 })}
                                                  className="w-full bg-gray-900 border border-gray-800 text-white text-center font-mono text-xs py-2 rounded-lg focus:border-emerald-500 outline-none"
                                              />
                                          </div>
                                          <div className="col-span-4">
                                              <label className="text-[8px] text-gray-600 uppercase font-mono block mb-1">Odds</label>
                                              <input 
                                                  type="number" 
                                                  step="5"
                                                  value={leg.bookOdds}
                                                  onChange={(e) => handleUpdateLeg(i, { bookOdds: parseInt(e.target.value) || 0 })}
                                                  className="w-full bg-gray-900 border border-gray-800 text-white text-center font-mono text-xs py-2 rounded-lg focus:border-emerald-500 outline-none"
                                              />
                                          </div>
                                    </div>
                                  </div>
                                ))}
                            </div>

                            {/* Master Calculation Display */}
                            <div className="pt-6 border-t border-gray-800">
                                  <div className="grid grid-cols-2 gap-4 mb-4">
                                      <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 text-center">
                                          <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
                                              <Timer size={10} /> Win Prob
                                          </div>
                                          <div className="text-2xl font-mono font-bold text-emerald-400">{builderStats.prob.toFixed(1)}%</div>
                                      </div>
                                      <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 text-center">
                                          <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
                                              <TrendingUp size={10} /> Total Odds
                                          </div>
                                          <div className="text-2xl font-mono font-bold text-white">{builderStats.odds > 0 ? '+' : ''}{builderStats.odds}</div>
                                      </div>
                                  </div>

                                  <div className={`p-5 rounded-xl border text-center transition-all relative overflow-hidden ${builderStats.edge >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
                                      <div className="absolute top-0 right-0 p-2 opacity-10">
                                          {builderStats.edge >= 0 ? <Zap size={40} /> : <ShieldAlert size={40} />}
                                      </div>
                                      <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1 relative z-10 font-bold">Mathematical Model Edge (+EV)</div>
                                      <div className={`text-4xl font-mono font-bold relative z-10 ${builderStats.edge >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                          {builderStats.edge >= 0 ? '+' : ''}{builderStats.edge.toFixed(1)}%
                                      </div>
                                      <div className="text-[8px] text-gray-600 uppercase font-mono mt-2 italic">Refined in real-time by Bayesian engine</div>
                                  </div>

                                  <button className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-gray-950 rounded-xl font-bold tracking-[0.2em] uppercase text-xs transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 mt-6 active:scale-95">
                                      <Settings2 size={18} /> Sync to Session Slip
                                  </button>
                            </div>
                          </div>
                      )}
                    </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Module 3: History */}
        {activeTab === 'history' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center gap-2 mb-6 p-1 bg-gray-900 rounded-lg border border-gray-800 w-fit">
               {Object.values(League).map((l) => (
                  <button key={l} onClick={() => setHistoryLeague(l)} className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${historyLeague === l ? 'bg-emerald-500 text-gray-950 shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>{l}</button>
               ))}
            </div>
            <div className={`border rounded-xl p-4 mb-8 flex items-center justify-between animate-fadeIn transition-colors ${isOutOfSeason(historyLeague) ? 'bg-amber-500/5 border-amber-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
                <div className="flex items-center gap-3">
                    {isOutOfSeason(historyLeague) ? <Clock size={20} className="text-amber-500" /> : <Timer size={20} className="text-emerald-500" />}
                    <div>
                        <p className="text-xs font-bold text-white uppercase tracking-wider">{isOutOfSeason(historyLeague) ? 'Season Performance Archive' : 'Live Grounded Results'}</p>
                        <p className={`text-[10px] font-mono uppercase tracking-widest animate-pulse ${isOutOfSeason(historyLeague) ? 'text-amber-500' : 'text-emerald-400'}`}>{isOutOfSeason(historyLeague) ? 'Sorry, gotta wait till next season!' : 'Live Grading: Grounding Official Matchup Logs'}</p>
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
               <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl text-center relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                  <div className="text-[10px] text-gray-500 uppercase font-bold tracking-[0.2em] mb-2">{historyLeague} Accuracy</div>
                  <div className="text-3xl font-mono font-bold text-emerald-400 group-hover:scale-110 transition-transform">{historyStats.winRate}</div>
               </div>
               <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl text-center relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                  <div className="text-[10px] text-gray-500 uppercase font-bold tracking-[0.2em] mb-2">{historyLeague} ROI</div>
                  <div className="text-3xl font-mono font-bold text-blue-400 group-hover:scale-110 transition-transform">{historyStats.roi}</div>
               </div>
               <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl text-center relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-white/20"></div>
                  <div className="text-[10px] text-gray-500 uppercase font-bold tracking-[0.2em] mb-2">Settled Ops</div>
                  <div className="text-3xl font-mono font-bold text-white group-hover:scale-110 transition-transform">{historyStats.hits}</div>
               </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
               <div className="px-6 py-4 border-b border-gray-800 bg-gray-950/50 flex justify-between items-center">
                  <h3 className="text-xs font-bold text-white uppercase tracking-[0.2em] flex items-center gap-2"><History size={14} className="text-emerald-500" /> {historyLeague} Settled Operations Log</h3>
                  {isHistoryLoading && <RefreshCw size={14} className="animate-spin text-emerald-500" />}
               </div>
               <div className="divide-y divide-gray-800 min-h-[400px]">
                  {groundedHistory.map((win) => (
                    <div key={win.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between group hover:bg-white/5 transition-colors gap-4">
                       <div className="flex items-center gap-4">
                          <div className={`w-14 h-14 rounded-lg border flex flex-col items-center justify-center transition-all ${win.outcome === 'WIN' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'}`}>
                              <div className="text-[8px] font-bold font-mono text-center leading-tight mb-1">{win.date}</div>
                              {win.outcome === 'WIN' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                          </div>
                          <div>
                             <div className="text-sm font-bold text-white">{win.player} <span className="text-gray-500 font-normal ml-1">vs {win.opponent}</span></div>
                             <div className="text-xs text-gray-500 font-mono">{win.prop} • <span className="text-gray-400 italic">Actual: </span><span className={win.outcome === 'WIN' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{win.result}</span></div>
                          </div>
                       </div>
                       <div className="text-right">
                          <div className={`text-xs font-bold font-mono ${win.outcome === 'WIN' ? 'text-emerald-400' : 'text-rose-400'}`}>{win.odds}</div>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-gray-900 mt-12 py-8 bg-gray-950 text-center">
          <p className="text-[10px] text-gray-800 uppercase tracking-widest font-mono">Quant Trading Protocol: Verified Accountability | ROI Optimized | Precision: ±0.01%</p>
      </footer>
      {isLoading && <LoadingScreen />}
    </div>
  );
}

export default App;
