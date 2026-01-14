
import { useState, useEffect } from 'react';
import { generateParlays, fetchTrendingPicks } from './services/geminiService';
import { League, RiskLevel, UserInputState, ParlayRecommendation } from './types';
import { InputForm } from './components/InputForm';
import { PlayerProfileCard } from './components/PlayerProfileCard';
import { LoadingScreen } from './components/LoadingScreen';
import { LandingPage } from './components/LandingPage';
import { SignUpPage } from './components/SignUpPage'; 
import { BarChart3, ShieldAlert, Home, Zap, User, RefreshCw } from './components/Icons';

type ViewState = 'landing' | 'signup' | 'app';

function App() {
  const [currentView, setCurrentView] = useState<ViewState>('landing');
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<ParlayRecommendation[]>([]);
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

  // Fetch trending picks for the landing page once on mount
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
    if (currentView === 'app' && recommendations.length === 0 && !isLoading) {
      handleGenerate(false);
    }
  }, [currentView]);

  const handleGenerate = async (isBackground = false, overrideParams?: UserInputState) => {
    setIsLoading(true);
    if (!isBackground) {
        setError(null);
        setRecommendations([]); 
    }
    
    const params = overrideParams || formData;

    try {
      const results = await generateParlays(
          params.league, 
          params.riskLevel, 
          params.filters, 
          params.statType, 
          params.advancedMetric
      );
      
      if (results.length === 0) {
          const context = params.filters ? `for "${params.filters}"` : `in the ${params.league}`;
          setError(`MARKET STATUS: No active games or verified prop lines found ${context} for today, ${new Date().toLocaleDateString()}. Check back closer to tip-off.`);
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

  if (currentView === 'landing') {
    return (
        <LandingPage 
            onEnter={() => setCurrentView('signup')} 
            hasActiveSession={recommendations.length > 0 || formData.filters !== ''}
            onResume={() => setCurrentView('app')} 
            trendingPicks={trendingPicks}
        />
    );
  }

  if (currentView === 'signup') {
    return (
        <SignUpPage 
            onComplete={() => setCurrentView('app')} 
            onLogin={() => setCurrentView('app')} 
        />
    );
  }

  const isTrending = !formData.filters && recommendations.length > 0;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 font-sans selection:bg-emerald-500/30">
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setCurrentView('landing')}>
            <div className="bg-emerald-500/10 p-2 rounded border border-emerald-500/20">
              <Zap className="text-emerald-500" size={24} fill="currentColor" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">PRR <span className="text-gray-500 text-sm font-normal">| Terminal</span></h1>
              <div className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">LIVE GROUNDING ACTIVE</div>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
             <button 
                onClick={() => setCurrentView('landing')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-800 hover:text-white transition-all group"
             >
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <InputForm 
            formData={formData} 
            setFormData={setFormData} 
            onSubmit={() => handleGenerate(false)} 
            isLoading={isLoading}
            lastSyncTime={lastSyncTime}
          />
        </div>

        <div className="space-y-6">
          {error && (
            <div className="bg-gray-900/80 border border-gray-800 text-gray-400 p-8 rounded-xl flex flex-col items-center text-center gap-4 animate-fadeIn shadow-2xl">
              <ShieldAlert size={40} className="text-amber-500 mb-2" />
              <div>
                <p className="font-bold text-lg mb-1 tracking-tight text-white">No Market Data Found</p>
                <p className="text-sm opacity-90 leading-relaxed max-w-md mx-auto">{error}</p>
                <div className="flex gap-4 justify-center mt-6">
                    <button 
                    onClick={() => handleGenerate(false)}
                    className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-gray-950 rounded-lg text-xs font-bold transition-all flex items-center gap-2"
                    >
                    <RefreshCw size={14} /> RE-SCAN MARKET
                    </button>
                    <button 
                    onClick={() => setFormData({...formData, filters: ''})}
                    className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-bold transition-all"
                    >
                    CLEAR SEARCH
                    </button>
                </div>
              </div>
            </div>
          )}

          {recommendations.length > 0 && (
             <div className="flex items-center justify-between mb-4 animate-fadeIn">
               <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2 uppercase tracking-tighter">
                    {isTrending ? (
                       <><Zap className="text-yellow-400" fill="currentColor" size={20} /> Today's Top ROI Edges</>
                    ) : (
                       <><User className="text-emerald-400" size={20} /> Quant Profile: {formData.filters}</>
                    )}
                  </h3>
               </div>
             </div>
          )}

          <div className="grid gap-6">
            {recommendations.map((item, index) => (
               <PlayerProfileCard key={item.id || index} data={item} bankroll={formData.bankroll} />
            ))}
          </div>

          {!isLoading && recommendations.length === 0 && !error && (
            <div className="text-center py-20 border border-dashed border-gray-800 rounded-xl bg-gray-900/20">
              <div className="inline-block p-4 rounded-full bg-gray-900 mb-4 border border-gray-800">
                <BarChart3 className="text-gray-700" size={32} />
              </div>
              <h3 className="text-gray-400 font-bold text-lg tracking-tight uppercase">Terminal Ready</h3>
              <p className="text-gray-600 max-w-sm mx-auto mt-2 text-sm">
                 Enter a player name or simply click "Analyze" to see today's highest variance ROI edges across the {formData.league}.
              </p>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-gray-900 mt-12 py-8 bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="text-[10px] text-gray-800 uppercase tracking-widest font-mono">
              Quant Trading Protocol: 30% ROI Targeted | Data Sources: DK, FD, PrizePicks | Precision: ±0.01%
            </p>
        </div>
      </footer>

      {isLoading && <LoadingScreen />}
    </div>
  );
}

export default App;
