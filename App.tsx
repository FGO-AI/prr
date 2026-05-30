
import { useState, useEffect, useMemo } from 'react';
import { generateParlays, fetchTrendingPicks, fetchGroundedOutcomes, settleUserPicks } from './services/geminiService';
import { League, RiskLevel, BettingApp, UserInputState, ParlayRecommendation, BetLeg, User as UserType, SubscriptionTier } from './types';
import { InputForm } from './components/InputForm';
import { PlayerProfileCard } from './components/PlayerProfileCard';
import { LoadingScreen } from './components/LoadingScreen';
import { LandingPage } from './components/LandingPage';
import { SignUpPage } from './components/SignUpPage'; 
import { LoginPage } from './components/LoginPage';
import { AboutPage } from './components/AboutPage';
import { AccessCodePage } from './components/AccessCodePage';
import { GameOutcomePredictor } from './components/GameOutcomePredictor';
import { calculateEngineMetrics } from './services/projectionEngine';
import { 
  BarChart3, ShieldAlert, Home, Zap, User, RefreshCw, 
  Target, TrendingUp, Trophy, HistoryIcon, CheckCircle2, XCircle, ListIcon, Clock, Calendar, Timer,
  Search, Plus, Trash2, Cpu, ArrowRight, BrainCircuit, X, Settings2, AlertCircle, Globe, Shield
} from './components/Icons';

type ViewState = 'landing' | 'signup' | 'login' | 'app' | 'about' | 'access';
type AppTab = 'search' | 'history' | 'ml';

const TIER_MAX_SPINS = {
  [SubscriptionTier.FREE]: 5,
  [SubscriptionTier.PRO]: 5,
  [SubscriptionTier.WHALE]: 15
};

const getTodayDatePT = () => {
  const now = new Date();
  const ptDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
  const [m, d, y] = ptDate.split('/');
  return `${y}-${m}-${d}`;
};

function App() {
  const [currentView, setCurrentView] = useState<ViewState>('landing');
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('search');
  const [historyLeague, setHistoryLeague] = useState<League>(League.NBA);
  const [isLoading, setIsLoading] = useState(false);
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  
  const [recommendationsByLeague, setRecommendationsByLeague] = useState<Record<League, ParlayRecommendation[]>>({
    [League.NBA]: [],
    [League.NFL]: [],
    [League.MLB]: []
  });
  const [userPickHistory, setUserPickHistory] = useState<ParlayRecommendation[]>([]);
  const [isFallbackActive, setIsFallbackActive] = useState(false);

  const [trendingPicks, setTrendingPicks] = useState<ParlayRecommendation[]>([]);
  const [nbaMatchups, setNbaMatchups] = useState<any[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<UserInputState>({
    league: League.NBA,
    riskLevel: RiskLevel.MEDIUM,
    bankroll: 1000,
    filters: '',
    statType: 'Any',
    advancedMetric: 'Standard',
    selectedApp: BettingApp.ALL
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

      // Handle Spin Reset
      const today = getTodayDatePT();
      if (currentUser.lastSpinResetDate !== today) {
        const maxSpins = TIER_MAX_SPINS[currentUser.tier];
        setCurrentUser(prev => {
          if (!prev) return null;
          return {
            ...prev,
            spinsRemaining: maxSpins,
            lastSpinResetDate: today
          };
        });
      }
    }
  }, [currentUser?.id, currentUser?.tier]);

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
            const picks = await fetchTrendingPicks(currentUser?.tier || SubscriptionTier.FREE);
            if (picks && picks.length > 0) {
              setTrendingPicks(picks);
            }
        } catch (err) { console.error(err); }
    };
    getTrending();
  }, [currentUser]);

  useEffect(() => {
    const getMatchups = async () => {
      try {
        const res = await fetch('/api/nba/games/today');
        if (res.ok) {
          const data = await res.json();
          setNbaMatchups(data);
        }
      } catch (e) {
        console.error("Failed to fetch NBA games schedule in App", e);
      }
    };
    getMatchups();
  }, []);

  const handleGenerate = async (isBackground = false, overrideParams?: UserInputState) => {
    if (!isBackground) {
      if (currentUser && currentUser.spinsRemaining !== undefined && currentUser.spinsRemaining <= 0) {
        setError("DAILY QUOTA REACHED: Your account has exhausted its market spins for today. Access resets at 12:00 AM PT.");
        return;
      }
      setIsLoading(true);
    } else {
      setIsBackgroundLoading(true);
    }
    setError(null);
    setIsFallbackActive(false);
    
    if (!isBackground) {
        if (activeTab === 'search') {
          setRecommendationsByLeague({
            [League.NBA]: [],
            [League.NFL]: [],
            [League.MLB]: []
          });
        }
    }

    const params = overrideParams || formData;
    
    try {
      const leaguesToFetch = [League.NBA, League.NFL, League.MLB];
      
      const resultsList = await Promise.all(
        leaguesToFetch.map(async (lg) => {
          try {
            const res = await generateParlays(
              lg, 
              params.riskLevel, 
              params.filters, 
              params.statType, 
              params.advancedMetric,
              params.selectedApp,
              currentUser?.tier || SubscriptionTier.FREE
            );
            return { league: lg, data: res || [] };
          } catch (e) {
            console.error(`Failed to fetch parlays for ${lg}`, e);
            return { league: lg, data: [] };
          }
        })
      );

      // Determine if there are off-season/empty leagues alongside active leagues
      const inactiveLeagues = resultsList.filter(r => r.data.length === 0);
      const activeLeagues = resultsList.filter(r => r.data.length > 0);

      if (inactiveLeagues.length > 0 && activeLeagues.length > 0) {
        // We have off-season leagues. Let's fetch more props for the active leagues to replace lost capacity.
        const tier = currentUser?.tier || SubscriptionTier.FREE;
        const limitCount = tier === SubscriptionTier.WHALE ? 25 : 12;

        await Promise.all(
          activeLeagues.map(async (activeItem) => {
            try {
              const extraData = await generateParlays(
                activeItem.league,
                params.riskLevel,
                params.filters,
                params.statType,
                params.advancedMetric,
                params.selectedApp,
                tier,
                limitCount
              );
              if (extraData && extraData.length > 0) {
                // Merge activeItem.data and extraData while deduplicating by players involved
                const seenKeys = new Set<string>();
                const merged: ParlayRecommendation[] = [];

                const getRecKey = (r: ParlayRecommendation) => {
                  return r.legs.map(l => `${l.playerName.toLowerCase()}:${l.statType.toLowerCase()}:${l.line}`).sort().join('|');
                };

                // Add original first
                activeItem.data.forEach(r => {
                  const key = getRecKey(r);
                  if (!seenKeys.has(key)) {
                    seenKeys.add(key);
                    merged.push(r);
                  }
                });

                // Add extra
                extraData.forEach(r => {
                  const key = getRecKey(r);
                  if (!seenKeys.has(key)) {
                    seenKeys.add(key);
                    merged.push(r);
                  }
                });

                activeItem.data = merged;
              }
            } catch (err) {
              console.error(`Failed to fetch extra props for in-season league ${activeItem.league}:`, err);
            }
          })
        );
      }

      const newRecs: Record<League, ParlayRecommendation[]> = {
        [League.NBA]: [],
        [League.NFL]: [],
        [League.MLB]: []
      };

      let totalCount = 0;
      let hasAnySearchMatch = false;

      resultsList.forEach(({ league, data }) => {
        const searchTerm = params.filters.toLowerCase().trim();
        const matchesSearch = searchTerm === '' || data.some(r => 
          r.legs.some(l => 
            l.playerName.toLowerCase().includes(searchTerm) || 
            l.team.toLowerCase().includes(searchTerm)
          )
        );
        if (matchesSearch && searchTerm !== '') {
          hasAnySearchMatch = true;
        }

        const taggedResults = data.map(r => ({ ...r, isUserGenerated: true }));
        newRecs[league] = taggedResults;
        totalCount += taggedResults.length;
      });

      if (totalCount === 0) {
        setError(`MARKET STATUS: No active lines found across NBA, NFL, or MLB for this specific query.`);
      } else {
        const searchTerm = params.filters.toLowerCase().trim();
        setIsFallbackActive(!hasAnySearchMatch && searchTerm !== '');
        
        setRecommendationsByLeague(newRecs);
        
        // Decrement spins if not background
        if (!isBackground && currentUser) {
          setCurrentUser(prev => {
            if (!prev) return null;
            return {
              ...prev,
              spinsRemaining: Math.max(0, (prev.spinsRemaining || 1) - 1)
            };
          });
        }

        // Automatically save to history ONLY if it's a background sync
        if (isBackground) {
          const allTaggedResults = Object.values(newRecs).flat();
          const newHistory = [...allTaggedResults, ...userPickHistory].slice(0, 50);
          setUserPickHistory(newHistory);
          if (currentUser) {
            localStorage.setItem(`user_pick_history_${currentUser.id}`, JSON.stringify(newHistory));
          }
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

  const handlePlaceBet = (pick: ParlayRecommendation) => {
    const newHistory = [pick, ...userPickHistory].slice(0, 50);
    setUserPickHistory(newHistory);
    if (currentUser) {
      localStorage.setItem(`user_pick_history_${currentUser.id}`, JSON.stringify(newHistory));
    }
    // Optional: show a toast or feedback
    alert("PICK LOCKED: Added to Outcomes Ledger for tracking.");
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

  if (currentView === 'landing') return <LandingPage onEnter={() => setCurrentView('signup')} trendingPicks={trendingPicks} onAbout={() => setCurrentView('about')} hasActiveSession={recommendationsByLeague[League.NBA].length > 0 || recommendationsByLeague[League.NFL].length > 0 || recommendationsByLeague[League.MLB].length > 0} onResume={() => setCurrentView('app')} />;
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
               <div className="hidden md:flex items-center gap-3 px-3 py-1.5 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-2">
                    <User size={12} className="text-emerald-500" />
                    <span className="text-[10px] font-mono uppercase tracking-wider text-gray-300">
                      {currentUser.name || currentUser.email}
                    </span>
                  </div>
                  <div className="h-3 w-px bg-gray-700"></div>
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-tighter ${
                    currentUser.tier === SubscriptionTier.WHALE ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                    currentUser.tier === SubscriptionTier.PRO ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                    'bg-gray-700/50 text-gray-400 border border-gray-600'
                  }`}>
                    {currentUser.tier === SubscriptionTier.WHALE && <Trophy size={8} className="text-purple-400" />}
                    {currentUser.tier === SubscriptionTier.PRO && <Zap size={8} className="text-blue-400" />}
                    {currentUser.tier}
                  </div>
               </div>
             )}
             <button onClick={() => { setCurrentUser(null); setCurrentView('landing'); }} className="flex items-center gap-2 p-2 sm:px-3 sm:py-1.5 rounded-lg hover:bg-gray-800 transition-all group">
                <Home size={16} className="text-gray-500 group-hover:text-emerald-400" />
                <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-wider text-gray-600 group-hover:text-gray-400">Exit</span>
             </button>
             <div className="h-4 w-px bg-gray-800"></div>
             <span className="flex items-center gap-2 text-emerald-400 font-medium font-mono text-[10px]">
                <div className={`w-1.5 h-1.5 rounded-full ${isBackgroundLoading ? 'bg-blue-500 animate-ping' : 'bg-emerald-500 animate-pulse'}`}></div> 
                <span className="hidden xs:inline uppercase">{isBackgroundLoading ? 'Background Sync' : `Market Date: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} • PRE-GAME ONLY`}</span>
             </span>
          </div>
        </div>
      </header>

      <div className="bg-gray-900/40 border-b border-gray-800 sticky top-16 z-30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-6 sm:gap-8">
           <button onClick={() => setActiveTab('search')} className={`py-4 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 border-b-2 transition-all ${activeTab === 'search' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              <Target size={14} /> Acquisition
           </button>
           <button onClick={() => setActiveTab('history')} className={`py-4 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 border-b-2 transition-all ${activeTab === 'history' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              <Trophy size={14} /> Outcomes
           </button>
           <button onClick={() => setActiveTab('ml')} className={`py-4 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 border-b-2 transition-all ${activeTab === 'ml' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              <Cpu size={14} /> Predictions
           </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'search' && (
          <div className="space-y-6 sm:space-y-8 animate-fadeIn">
            <InputForm 
              formData={formData} 
              setFormData={setFormData} 
              onSubmit={() => handleGenerate(false)} 
              isLoading={isLoading} 
              lastSyncTime={lastSyncTime}
              spinsRemaining={currentUser?.spinsRemaining}
              maxSpins={currentUser ? TIER_MAX_SPINS[currentUser.tier] : undefined}
              nbaMatchups={nbaMatchups}
            />
            
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

              {/* Show different sections for different leagues */}
              {Object.values(League).map((leagueHex) => {
                const league = leagueHex as League;
                const recs = recommendationsByLeague[league] || [];
                const hasScan = lastSyncTime !== null;
                
                if (!hasScan) return null;
                // STRICT DIRECTIVE: If league has no props (e.g. is in off-season), don't show it at all
                if (recs.length === 0) return null;

                return (
                  <div key={league} className="space-y-4 border-l-2 border-dashed border-gray-800/80 pl-4 py-2 hover:border-emerald-500/50 transition-all animate-fadeIn">
                    <div className="flex items-center justify-between px-2 pt-4">
                      <h3 className="text-xs font-extrabold text-white uppercase tracking-[0.2em] flex items-center gap-2.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          league === League.NBA ? 'bg-orange-500 animate-pulse' :
                          league === League.NFL ? 'bg-blue-500' :
                          'bg-emerald-500'
                        }`}></span>
                        {league === League.NBA ? 'National Basketball Association (NBA)' :
                         league === League.NFL ? 'National Football League (NFL) - Classic' :
                         'Major League Baseball (MLB)'}
                        <span className="text-[10px] text-gray-500 font-mono font-bold tracking-tight">({recs.length} Opportunities)</span>
                      </h3>
                      {recs.length > 0 && (
                        <span className="text-[9px] font-mono text-gray-600 uppercase tracking-widest">Sorted by Hit Probability</span>
                      )}
                    </div>
                    
                    <div className="space-y-4">
                      {recs
                        .sort((a, b) => (b.jointProbAdjusted || 0) - (a.jointProbAdjusted || 0))
                        .map((item, index) => (
                          <PlayerProfileCard 
                            key={index} 
                            data={item} 
                            bankroll={formData.bankroll} 
                            onPlaceBet={() => handlePlaceBet(item)}
                            rank={index + 1}
                          />
                        ))
                      }
                    </div>
                  </div>
                );
              })}

              {/* General Target Discovery Standby if no scan has been performed yet */}
              {!lastSyncTime && !isLoading && !error && (
                <div className="text-center py-20 border border-dashed border-gray-800 rounded-2xl bg-gray-900/20 flex flex-col items-center">
                  <Cpu size={32} className="text-gray-800 mb-4 animate-pulse" />
                  <h3 className="text-gray-600 font-bold text-xs tracking-[0.3em] uppercase">Target Discovery Standby</h3>
                  <p className="text-[9px] text-gray-700 font-mono mt-2 uppercase">Ready for market acquisition...</p>
                </div>
              )}
            </div>
          </div>
        )}


        {activeTab === 'history' && (
           <div className="space-y-6 animate-fadeIn">
              {/* Performance Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-900/50 border border-gray-800 p-4 rounded-2xl">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Total Picks</div>
                  <div className="text-2xl font-mono font-bold text-white">{userPickHistory.length}</div>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 p-4 rounded-2xl">
                  <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Total Hits</div>
                  <div className="text-2xl font-mono font-bold text-emerald-400">
                    {userPickHistory.reduce((acc, pick) => acc + pick.legs.filter(l => l.settledStatus === 'Hit').length, 0)}
                  </div>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 p-4 rounded-2xl">
                  <div className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-1">Total Misses</div>
                  <div className="text-2xl font-mono font-bold text-rose-400">
                    {userPickHistory.reduce((acc, pick) => acc + pick.legs.filter(l => l.settledStatus === 'Miss').length, 0)}
                  </div>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 p-4 rounded-2xl">
                  <div className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">Win Rate</div>
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-mono font-bold text-blue-400">
                      {(() => {
                        const total = userPickHistory.reduce((acc, pick) => acc + pick.legs.filter(l => l.settledStatus === 'Hit' || l.settledStatus === 'Miss').length, 0);
                        const hits = userPickHistory.reduce((acc, pick) => acc + pick.legs.filter(l => l.settledStatus === 'Hit').length, 0);
                        return total > 0 ? `${((hits / total) * 100).toFixed(1)}%` : '0%';
                      })()}
                    </div>
                    <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-1000" 
                        style={{ 
                          width: (() => {
                            const total = userPickHistory.reduce((acc, pick) => acc + pick.legs.filter(l => l.settledStatus === 'Hit' || l.settledStatus === 'Miss').length, 0);
                            const hits = userPickHistory.reduce((acc, pick) => acc + pick.legs.filter(l => l.settledStatus === 'Hit').length, 0);
                            return total > 0 ? `${(hits / total) * 100}%` : '0%';
                          })()
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

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
                               <div className="flex items-center gap-1.5 bg-gray-900 px-2 py-1 rounded border border-gray-800 mr-2">
                                  <span className={`text-[8px] font-bold font-mono uppercase ${
                                    pick.legs.every(l => l.settledStatus === 'Hit') ? 'text-emerald-400' : 
                                    pick.legs.some(l => l.settledStatus === 'Miss') ? 'text-rose-400' : 
                                    'text-gray-500'
                                  }`}>
                                    {pick.legs.every(l => l.settledStatus === 'Hit') ? 'PARLAY HIT' : 
                                     pick.legs.some(l => l.settledStatus === 'Miss') ? 'PARLAY MISS' : 
                                     'PARLAY PENDING'}
                                  </span>
                               </div>
                               <Shield className="text-emerald-500" size={12} />
                               <span className="text-[8px] font-mono text-emerald-400 uppercase tracking-widest">Grounded Feed</span>
                           </div>
                        </div>
                        <div className="px-4 py-2 bg-gray-900/50 border-b border-gray-800 flex items-center gap-4">
                           <div className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">Leg Hit Rate:</div>
                           <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-emerald-500 transition-all duration-500" 
                                style={{ 
                                  width: `${(pick.legs.filter(l => l.settledStatus === 'Hit').length / pick.legs.length) * 100}%` 
                                }}
                              ></div>
                           </div>
                           <div className="text-[9px] font-mono text-emerald-400 font-bold">
                              {pick.legs.filter(l => l.settledStatus === 'Hit').length}/{pick.legs.length}
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
        {activeTab === 'ml' && (
			<GameOutcomePredictor />
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
