
import { useState, useEffect, useMemo } from 'react';
import { generateParlays, fetchTrendingPicks, fetchGroundedOutcomes, settleUserPicks } from './services/geminiService';
import { League, RiskLevel, UserInputState, ParlayRecommendation, BetLeg, User as UserType } from './types';
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
  Target, TrendingUp, Trophy, HistoryIcon, CheckCircle2, XCircle, ListIcon, Clock, Calendar, GitMerge, Timer,
  Search, Plus, Trash2, Cpu, ArrowRight, BrainCircuit, X, Settings2, AlertCircle, Globe, Shield
} from './components/Icons';

type ViewState = 'landing' | 'signup' | 'login' | 'app' | 'about' | 'access';
type AppTab = 'search' | 'parlays' | 'history';

function App() {
  const [currentView, setCurrentView] = useState<ViewState>('landing');
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('search');
  const [historyLeague, setHistoryLeague] = useState<League>(League.NBA);
  const [isLoading, setIsLoading] = useState(false);
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  
  const [recommendations, setRecommendations] = useState<ParlayRecommendation[]>([]);
  const [userPickHistory, setUserPickHistory] = useState<ParlayRecommendation[]>([]);
  const [isFallbackActive, setIsFallbackActive] = useState(false);

  const [trendingPicks, setTrendingPicks] = useState<ParlayRecommendation[]>([]);
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

  // Load history from localStorage based on user
  useEffect(() => {
    if (currentUser) {
      const storageKey = `user_pick_history_${currentUser.id}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          setUserPickHistory(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to load history", e);
        }
      } else {
        setUserPickHistory([]);
      }
    }
  }, [currentUser]);

  // Background generation every 5 minutes
  useEffect(() => {
    if (currentUser && currentView === 'app') {
      const interval = setInterval(() => {
        handleGenerate(true);
      }, 300000); // 5 minutes
      return () => clearInterval(interval);
    }
  }, [currentUser, currentView, formData]);

  useEffect(() => {
    const getTrending = async () => {
        try {
            const picks = await fetchTrendingPicks();
            if (picks && picks.length > 0) {
              setTrendingPicks(picks);
            }
        } catch (err) { console.error(err); }
    };
    getTrending();
  }, []);

  const handleGenerate = async (isBackground = false, overrideParams?: UserInputState) => {
    if (!isBackground) setIsLoading(true);
    else setIsBackgroundLoading(true);
    setError(null);
    setIsFallbackActive(false);
    
    if (!isBackground) {
        if (activeTab === 'search') setRecommendations([]);
    }

    const params = overrideParams || formData;
    
    try {
      const results = await generateParlays(params.league, params.riskLevel, params.filters, params.statType, params.advancedMetric);
      
      if (!results || results.length === 0) {
          setError(`MARKET STATUS: No active lines found. The AI couldn't locate verified props on FanDuel or DraftKings for this specific query.`);
      } else {
          const searchTerm = params.filters.toLowerCase().trim();
          const matchesSearch = searchTerm === '' || results.some(r => 
            r.legs.some(l => 
              l.playerName.toLowerCase().includes(searchTerm) || 
              l.team.toLowerCase().includes(searchTerm)
            )
          );

          setIsFallbackActive(!matchesSearch && searchTerm !== '');
          
          const taggedResults = results.map(r => ({ ...r, isUserGenerated: true }));
          setRecommendations(taggedResults);
          
          // Save to local history
          const newHistory = [...taggedResults, ...userPickHistory].slice(0, 50);
          setUserPickHistory(newHistory);
          if (currentUser) {
            localStorage.setItem(`user_pick_history_${currentUser.id}`, JSON.stringify(newHistory));
          }
          
          setLastSyncTime(new Date());
          setError(null);
      }
    } catch (err: any) { 
      setError(err.message || "Error scanning market. Connection timed out."); 
    } finally { 
      if (!isBackground) setIsLoading(false); 
      else setIsBackgroundLoading(false);
    }
  };

  const handleVerifyHistory = async () => {
    setIsSettling(true);
    try {
      const pendingPicks = userPickHistory.filter(p => p.legs.some(l => !l.settledStatus || l.settledStatus === 'Pending'));
      if (pendingPicks.length === 0) return;

      const settled = await settleUserPicks(pendingPicks);
      
      const updatedHistory = userPickHistory.map(oldPick => {
        const found = settled.find(s => s.id === oldPick.id);
        return found || oldPick;
      });

      setUserPickHistory(updatedHistory);
      if (currentUser) {
        localStorage.setItem(`user_pick_history_${currentUser.id}`, JSON.stringify(updatedHistory));
      }
    } catch (e) {
      console.error("Verification failed", e);
    } finally {
      setIsSettling(false);
    }
  };

  const forceGlobalScan = () => {
    setFormData(prev => ({ ...prev, filters: '' }));
    handleGenerate(false, { ...formData, filters: '' });
  };

  const clearHistory = () => {
    if (confirm("Purge historical pick archive?")) {
      setUserPickHistory([]);
      if (currentUser) {
        localStorage.removeItem(`user_pick_history_${currentUser.id}`);
      }
    }
  };

  const handleAuthComplete = (user: UserType) => {
    setCurrentUser(user);
    setCurrentView('app');
  };

  if (currentView === 'landing') return <LandingPage onEnter={() => setCurrentView('signup')} trendingPicks={trendingPicks} onAbout={() => setCurrentView('about')} hasActiveSession={recommendations.length > 0} onResume={() => setCurrentView('app')} />;
  if (currentView === 'access') return <AccessCodePage onComplete={handleAuthComplete} onLogin={() => setCurrentView('login')} />;
  if (currentView === 'about') return <AboutPage onBack={() => setCurrentView('landing')} onStart={() => setCurrentView('signup')} />;
  if (currentView === 'signup') return <SignUpPage onComplete={handleAuthComplete} onLogin={() => setCurrentView('login')} onGuest={() => setCurrentView('access')} />;
  if (currentView === 'login') return <LoginPage onComplete={handleAuthComplete} onSignUp={() => setCurrentView('signup')} onAccess={() => setCurrentView('access')} />;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 font-sans selection:bg-emerald-500/30 overflow-x-hidden">
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentView('landing')}>
            <div className="bg-emerald-500/10 p-1.5 rounded border border-emerald-500/20">
              <Zap className="text-emerald-500" size={20} fill="currentColor" />
            </div>
            <div className="hidden xs:block">
              <h1 className="text-sm font-bold text-white tracking-tight uppercase">F*&% Going On!</h1>
              <div className="text-[8px] font-mono text-emerald-400 uppercase tracking-widest">LIVE TERMINAL</div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400">
             {currentUser && (
               <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 rounded-lg border border-gray-700">
                  <User size={12} className="text-emerald-500" />
                  <span className="text-[10px] font-mono uppercase tracking-wider text-gray-300">
                    {currentUser.name || currentUser.email}
                  </span>
               </div>
             )}
             <button onClick={() => { setCurrentUser(null); setCurrentView('landing'); }} className="flex items-center gap-2 p-2 sm:px-3 sm:py-1.5 rounded-lg hover:bg-gray-800 transition-all group">
                <Home size={16} className="text-gray-500 group-hover:text-emerald-400" />
                <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-wider text-gray-600 group-hover:text-gray-400">Exit</span>
             </button>
             <div className="h-4 w-px bg-gray-800"></div>
             <span className="flex items-center gap-2 text-emerald-400 font-medium font-mono text-[10px]">
                <div className={`w-1.5 h-1.5 rounded-full ${isBackgroundLoading ? 'bg-blue-500 animate-ping' : 'bg-emerald-500 animate-pulse'}`}></div> 
                <span className="hidden xs:inline uppercase">{isBackgroundLoading ? 'Background Sync' : `${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} Sync`}</span>
             </span>
          </div>
        </div>
      </header>

      <div className="bg-gray-900/40 border-b border-gray-800 sticky top-16 z-30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-6 sm:gap-8">
           <button onClick={() => setActiveTab('search')} className={`py-4 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 border-b-2 transition-all ${activeTab === 'search' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              <Target size={14} /> Acquisition
           </button>
           <button onClick={() => setActiveTab('parlays')} className={`py-4 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 border-b-2 transition-all ${activeTab === 'parlays' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              <GitMerge size={14} /> Constructor
           </button>
           <button onClick={() => setActiveTab('history')} className={`py-4 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 border-b-2 transition-all ${activeTab === 'history' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              <Trophy size={14} /> Outcomes
           </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'search' && (
          <div className="space-y-6 sm:space-y-8 animate-fadeIn">
            <InputForm formData={formData} setFormData={setFormData} onSubmit={() => handleGenerate(false)} isLoading={isLoading} lastSyncTime={lastSyncTime} />
            
            {isFallbackActive && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-3 animate-fadeIn">
                  <AlertCircle size={18} className="text-blue-400" />
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest font-mono">
                    System Alert: No lines for "{formData.filters}". Defaulting to model-preferred Alpha Picks.
                  </p>
              </div>
            )}

            <div className="space-y-6">
              {error && (
                <div className="bg-gray-900/80 border border-gray-800 text-gray-400 p-6 sm:p-12 rounded-2xl flex flex-col items-center text-center gap-6 animate-fadeIn">
                  <div className="p-4 bg-amber-500/10 rounded-full border border-amber-500/20">
                    <ShieldAlert size={36} className="text-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2 text-white uppercase tracking-tight">Zero Active Lines Identified</h3>
                    <p className="text-sm opacity-80 leading-relaxed max-w-md mx-auto font-sans mb-8">
                      {error} <br/> The books may have locked lines for ongoing games, or the model is struggling to ground live odds.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button onClick={() => handleGenerate(false)} className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-gray-950 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20">
                            <RefreshCw size={14} /> Retry Acquisition
                        </button>
                        <button onClick={forceGlobalScan} className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                            <Globe size={14} /> Force Global Scan
                        </button>
                    </div>
                  </div>
                </div>
              )}
              {recommendations.map((item, index) => <PlayerProfileCard key={index} data={item} bankroll={formData.bankroll} />)}
              {!isLoading && recommendations.length === 0 && !error && (
                <div className="text-center py-20 border border-dashed border-gray-800 rounded-2xl bg-gray-900/20 flex flex-col items-center">
                  <Cpu size={32} className="text-gray-800 mb-4 animate-pulse" />
                  <h3 className="text-gray-600 font-bold text-xs tracking-[0.3em] uppercase">Target Discovery Standby</h3>
                  <p className="text-[9px] text-gray-700 font-mono mt-2 uppercase">Ready for market acquisition...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'parlays' && (
           <div className="text-center py-20 border border-dashed border-gray-800 rounded-2xl bg-gray-900/20">
              <GitMerge size={32} className="text-gray-800 mx-auto mb-4" />
              <h3 className="text-gray-600 font-bold text-xs tracking-[0.3em] uppercase">Constructor Offline</h3>
              <p className="text-[9px] text-gray-700 font-mono mt-2 uppercase">Manual leg construction available in V4.0.</p>
           </div>
        )}
        
        {activeTab === 'history' && (
           <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-900/50 p-6 rounded-2xl border border-gray-800">
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-tight uppercase flex items-center gap-3">
                        <Trophy className="text-yellow-500" /> Settlement Archive
                    </h2>
                    <p className="text-xs text-gray-500 font-mono uppercase tracking-widest mt-1">Verified User Pick Outcomes</p>
                  </div>
                  <div className="flex gap-3">
                      <button 
                        onClick={handleVerifyHistory} 
                        disabled={isSettling || userPickHistory.length === 0}
                        className="px-5 py-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-500/20 transition-all flex items-center gap-2"
                      >
                         {isSettling ? <RefreshCw className="animate-spin" size={14} /> : <Shield size={14} />}
                         {isSettling ? 'Verifying Results...' : 'Verify My History'}
                      </button>
                      <button onClick={clearHistory} className="px-3 py-2.5 bg-gray-800 text-gray-500 hover:text-rose-400 rounded-lg transition-all">
                        <Trash2 size={16} />
                      </button>
                  </div>
              </div>

              <div className="space-y-4">
                {userPickHistory.length > 0 ? (
                  userPickHistory.map((pick, i) => (
                    <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-all group">
                        <div className="p-4 bg-gray-950 flex justify-between items-center border-b border-gray-800">
                           <div className="flex items-center gap-3">
                               <Calendar size={14} className="text-gray-600" />
                               <span className="text-[10px] font-mono text-gray-400 font-bold uppercase">Generated {new Date(pick.timestamp).toLocaleString()}</span>
                           </div>
                           <div className="flex items-center gap-2">
                               <Shield className="text-emerald-500" size={12} />
                               <span className="text-[8px] font-mono text-emerald-400 uppercase tracking-widest">Grounded Feed</span>
                           </div>
                        </div>
                        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                           {pick.legs.map((leg, j) => (
                             <div key={j} className="flex items-center justify-between gap-4 p-4 bg-gray-850/50 rounded-xl border border-gray-800 group-hover:bg-gray-850/80 transition-all">
                                <div className="flex items-center gap-4">
                                   <div className={`w-10 h-10 rounded-lg bg-gray-950 flex items-center justify-center border ${leg.settledStatus === 'Hit' ? 'border-emerald-500' : leg.settledStatus === 'Miss' ? 'border-rose-500' : 'border-gray-800'}`}>
                                      {leg.settledStatus === 'Hit' ? <CheckCircle2 className="text-emerald-500" size={24} /> : leg.settledStatus === 'Miss' ? <XCircle className="text-rose-500" size={24} /> : <User className="text-gray-700" size={24} />}
                                   </div>
                                   <div>
                                      <div className="text-sm font-bold text-white">{leg.playerName}</div>
                                      <div className="text-[10px] font-mono text-gray-500">
                                        {leg.prediction.toUpperCase()} {leg.line} {leg.statType}
                                      </div>
                                   </div>
                                </div>
                                <div className="text-right">
                                   <div className={`text-sm font-mono font-bold ${leg.settledStatus === 'Hit' ? 'text-emerald-400' : leg.settledStatus === 'Miss' ? 'text-rose-400' : 'text-gray-400'}`}>
                                      {leg.settledStatus === 'Hit' ? 'VERIFIED HIT' : leg.settledStatus === 'Miss' ? 'SETTLED LOSS' : 'PENDING'}
                                   </div>
                                   {leg.actualValue !== undefined && (
                                     <div className="text-[10px] text-gray-500 font-mono">Actual: {leg.actualValue}</div>
                                   )}
                                </div>
                             </div>
                           ))}
                        </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-20 border border-dashed border-gray-800 rounded-2xl bg-gray-900/20">
                    <HistoryIcon size={32} className="text-gray-800 mx-auto mb-4" />
                    <h3 className="text-gray-600 font-bold text-xs tracking-[0.3em] uppercase">Archive Empty</h3>
                    <p className="text-[9px] text-gray-700 font-mono mt-2 uppercase">Generate picks in Acquisition to build your ledger.</p>
                  </div>
                )}
              </div>
           </div>
        )}
      </main>

      <footer className="border-t border-gray-900 mt-12 py-8 bg-gray-950 text-center px-4">
          <p className="text-[9px] text-gray-800 uppercase tracking-[0.4em] font-mono">Quant Protocol V3.5 • High-Edge Model Intelligence</p>
      </footer>
      {isLoading && <LoadingScreen />}
    </div>
  );
}

export default App;
