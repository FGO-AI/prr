
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
  Target, TrendingUp, Trophy, HistoryIcon, CheckCircle2, XCircle, ListIcon, Clock, Calendar, GitMerge, Timer,
  Search, Plus, Trash2, Cpu, ArrowRight, BrainCircuit, X, Settings2, AlertCircle
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
  
  const [recommendations, setRecommendations] = useState<ParlayRecommendation[]>([]);
  const [isFallbackActive, setIsFallbackActive] = useState(false);

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

  useEffect(() => {
    const getTrending = async () => {
        try {
            const picks = await fetchTrendingPicks();
            setTrendingPicks(picks);
        } catch (err) { console.error(err); }
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
      } catch (err) { console.error(err); } finally { if (!ignore) setIsHistoryLoading(false); }
    };
    if (activeTab === 'history') loadGroundedHistory(historyLeague);
    return () => { ignore = true; };
  }, [activeTab, historyLeague]);

  const handleGenerate = async (isBackground = false, overrideParams?: UserInputState) => {
    setIsLoading(true);
    setError(null);
    setIsFallbackActive(false);
    
    if (!isBackground) {
        if (activeTab === 'search') setRecommendations([]);
    }

    const params = overrideParams || formData;
    
    try {
      const results = await generateParlays(params.league, params.riskLevel, params.filters, params.statType, params.advancedMetric);
      
      if (results.length === 0) {
          setError(`MARKET STATUS: No active lines found. The books may be offline or between games.`);
      } else {
          // Detect if the AI results match the search or if it's a fallback
          const searchTerm = params.filters.toLowerCase().trim();
          const matchesSearch = searchTerm === '' || results.some(r => 
            r.legs.some(l => 
              l.playerName.toLowerCase().includes(searchTerm) || 
              l.team.toLowerCase().includes(searchTerm)
            )
          );

          setIsFallbackActive(!matchesSearch && searchTerm !== '');
          setRecommendations(results);
          setLastSyncTime(new Date());
          setError(null);
      }
    } catch (err: any) { 
      setError(err.message || "Error scanning market. Connection timed out."); 
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
             <button onClick={() => setCurrentView('landing')} className="flex items-center gap-2 p-2 sm:px-3 sm:py-1.5 rounded-lg hover:bg-gray-800 transition-all group">
                <Home size={16} className="text-gray-500 group-hover:text-emerald-400" />
                <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-wider text-gray-600 group-hover:text-gray-400">Exit</span>
             </button>
             <div className="h-4 w-px bg-gray-800"></div>
             <span className="flex items-center gap-2 text-emerald-400 font-medium font-mono text-[10px]">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div> 
                <span className="hidden xs:inline uppercase">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} Sync</span>
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
                <div className="bg-gray-900/80 border border-gray-800 text-gray-400 p-6 sm:p-8 rounded-xl flex flex-col items-center text-center gap-4 animate-fadeIn">
                  <ShieldAlert size={32} className="text-amber-500" />
                  <div>
                    <p className="font-bold text-base mb-1 text-white uppercase tracking-tight">Market Status Check</p>
                    <p className="text-xs opacity-90 leading-relaxed max-w-xs mx-auto font-mono">{error}</p>
                    <button onClick={() => handleGenerate(false)} className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-gray-950 rounded-lg text-[10px] font-bold uppercase tracking-widest mt-6 mx-auto flex items-center gap-2">
                        <RefreshCw size={12} /> Retry Discovery
                    </button>
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
           <div className="text-center py-20 border border-dashed border-gray-800 rounded-2xl bg-gray-900/20">
              <Trophy size={32} className="text-gray-800 mx-auto mb-4" />
              <h3 className="text-gray-600 font-bold text-xs tracking-[0.3em] uppercase">Historical Archive</h3>
              <p className="text-[9px] text-gray-700 font-mono mt-2 uppercase">Syncing settled outcomes from market feed...</p>
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
