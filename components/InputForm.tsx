import React, { useState, useEffect, useRef, useMemo } from 'react';
import { League, RiskLevel, BettingApp, UserInputState } from '../types';
import { 
    BrainCircuit, Search, Clock, RefreshCw, ChevronRight,
    Target, Globe, Database
} from './Icons';

interface InputFormProps {
  formData: UserInputState;
  setFormData: React.Dispatch<React.SetStateAction<UserInputState>>;
  onSubmit: () => void;
  isLoading: boolean;
  lastSyncTime: Date | null;
  spinsRemaining?: number;
  maxSpins?: number;
  nbaMatchups?: any[];
}

const AUTOCOMPLETE_DATA = [
  { type: 'player', label: 'LeBron James', sub: 'LAL • F', league: League.NBA },
  { type: 'player', label: 'Stephen Curry', sub: 'GSW • G', league: League.NBA },
  { type: 'player', label: 'Luka Dončić', sub: 'DAL • G', league: League.NBA },
  { type: 'player', label: 'Nikola Jokić', sub: 'DEN • C', league: League.NBA },
  { type: 'player', label: 'Shohei Ohtani', sub: 'LAD • DH/P', league: League.MLB },
  { type: 'player', label: 'Patrick Mahomes', sub: 'KC • QB', league: League.NFL },
  { type: 'team', label: 'Los Angeles Lakers', sub: 'LAL', league: League.NBA },
  { type: 'game', label: 'LAL @ GSW', sub: 'Tonight 10:00 PM', league: League.NBA },
];

export const InputForm: React.FC<InputFormProps> = ({ 
  formData, setFormData, onSubmit, isLoading, lastSyncTime, spinsRemaining, maxSpins, nbaMatchups = []
}) => {
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('prr_search_history');
    if (saved) { try { setRecentSearches(JSON.parse(saved)); } catch (e) { console.error(e); } }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'league') {
        setFormData(prev => ({ ...prev, league: value as League, statType: 'Any' }));
    } else {
        setFormData(prev => ({ ...prev, [name]: name === 'bankroll' ? parseFloat(value) : value }));
    }
    if (name === 'filters') setShowSuggestions(true);
  };

  const handleSubmission = () => {
    if (formData.filters.trim()) {
        const cleanTerm = formData.filters.trim();
        const newHistory = [cleanTerm, ...recentSearches.filter(s => s !== cleanTerm)].slice(0, 5);
        setRecentSearches(newHistory);
        localStorage.setItem('prr_search_history', JSON.stringify(newHistory));
    }
    setShowSuggestions(false);
    onSubmit();
  };

  const handleSuggestionClick = (term: string) => {
    setFormData(prev => ({ ...prev, filters: term }));
    setShowSuggestions(false);
  };

  const formatTime = (date: Date | null) => {
    if (!date) return "--:--";
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  };

  const categorizedSuggestions = useMemo(() => {
     if (!formData.filters || formData.filters.length < 1) return { players: [], teams: [] };
     const lower = formData.filters.toLowerCase();
     const filtered = AUTOCOMPLETE_DATA.filter(item => 
        item.label.toLowerCase().includes(lower)
     );
     return {
        players: filtered.filter(f => f.type === 'player').slice(0, 3),
        teams: filtered.filter(f => f.type === 'team').slice(0, 2)
     };
  }, [formData.filters]);

  return (
    <div className="bg-gray-850 p-4 sm:p-6 rounded-xl border border-gray-800 shadow-lg relative z-30">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <Search className="text-emerald-400" size={18} />
          </div>
          <h2 className="text-base font-bold text-white tracking-tight">Intelligence Terminal</h2>
        </div>
        <div className="flex items-center gap-4">
             <div className="flex flex-col text-right">
                  <span className="text-[8px] text-gray-500 font-mono uppercase">Daily Spins</span>
                  <span className={`text-[10px] font-mono font-bold ${spinsRemaining === 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {spinsRemaining !== undefined ? `${spinsRemaining} / ${maxSpins}` : '-- / --'}
                  </span>
             </div>
             <div className="h-6 w-px bg-gray-800"></div>
             <div className="flex flex-col text-right">
                  <span className="text-[8px] text-gray-500 font-mono uppercase">Last Sync</span>
                  <span className="text-[10px] text-emerald-500 font-mono font-bold">{formatTime(lastSyncTime)}</span>
             </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6">
        <div className="md:col-span-8 relative" ref={searchContainerRef}>
          <label className="block text-[9px] text-emerald-400 uppercase tracking-widest mb-1.5 font-bold flex items-center gap-1.5">
             <BrainCircuit size={10} /> Target Identification
          </label>
          <div className="relative">
            <input 
              type="text" 
              name="filters" 
              value={formData.filters} 
              onChange={handleChange} 
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmission()}
              placeholder="Search player or team..."
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 sm:py-4 text-sm font-mono text-white focus:outline-none focus:border-emerald-500 transition-all placeholder:text-gray-700 h-12 sm:h-auto"
            />
            {showSuggestions && (formData.filters.length > 0 || recentSearches.length > 0) && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden max-h-60 overflow-y-auto">
                {recentSearches.length > 0 && formData.filters === '' && (
                  <div className="p-2 border-b border-gray-800">
                    <p className="text-[8px] text-gray-500 uppercase font-bold tracking-widest px-2 mb-1">History</p>
                    {recentSearches.map((s, i) => (
                      <button key={i} onClick={() => handleSuggestionClick(s)} className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-800 rounded-md flex items-center gap-2">
                        <Clock size={12} className="text-gray-600" /> {s}
                      </button>
                    ))}
                  </div>
                )}
                <div className="p-1">
                  {categorizedSuggestions.players.map((p, i) => (
                    <button key={i} onClick={() => handleSuggestionClick(p.label)} className="w-full text-left px-3 py-2 hover:bg-emerald-500/10 rounded-lg">
                      <div className="text-xs font-bold text-gray-200">{p.label}</div>
                      <div className="text-[9px] text-gray-500 font-mono">{p.sub}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {nbaMatchups && nbaMatchups.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5 items-center">
              <span className="text-[8px] font-mono font-bold text-gray-500 uppercase tracking-widest mr-1">Active Series:</span>
              {nbaMatchups.map((game, idx) => {
                const label = `${game.awayTeam.split(' ').pop()} at ${game.homeTeam.split(' ').pop()}`;
                const isSelected = formData.filters.toLowerCase().includes(game.awayTeam.split(' ').pop().toLowerCase()) || 
                                   formData.filters.toLowerCase().includes(game.homeTeam.split(' ').pop().toLowerCase());
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, filters: `${game.awayTeam} at ${game.homeTeam}` }));
                    }}
                    className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded border transition-all flex items-center gap-1.5 shrink-0 ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                        : 'bg-gray-950/60 border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-700'
                    }`}
                    title={`${game.awayTeam} at ${game.homeTeam} (${game.gameTime}) - ${game.seriesInfo || 'Playoffs'}`}
                  >
                    <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`}></span>
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="block text-[9px] text-gray-500 uppercase tracking-widest mb-1.5 font-bold">Risk Weight</label>
          <div className="relative">
            <select name="riskLevel" value={formData.riskLevel} onChange={handleChange} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-xs font-mono text-white appearance-none h-12 sm:h-auto">
              {Object.values(RiskLevel).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-gray-600 pointer-events-none" size={14} />
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="block text-[9px] text-gray-500 uppercase tracking-widest mb-1.5 font-bold">Betting App</label>
          <div className="relative">
            <select name="selectedApp" value={formData.selectedApp} onChange={handleChange} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-xs font-mono text-white appearance-none h-12 sm:h-auto">
              {Object.values(BettingApp).map(app => <option key={app} value={app}>{app}</option>)}
            </select>
            <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-gray-600 pointer-events-none" size={14} />
          </div>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-6">
         <div className="flex gap-4 sm:gap-6 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
            <div className="flex items-center gap-2 whitespace-nowrap">
                <Globe size={14} className="text-blue-500" />
                <span className="text-[9px] font-mono text-gray-500 uppercase">Grounding: On</span>
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap">
                <Database size={14} className="text-emerald-500" />
                <span className="text-[9px] font-mono text-gray-500 uppercase">Live Feed</span>
            </div>
         </div>
         <button 
           onClick={handleSubmission} 
           disabled={isLoading || (spinsRemaining !== undefined && spinsRemaining <= 0)} 
           className={`w-full sm:w-auto px-10 py-4 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-3 h-14 sm:h-auto ${
             (spinsRemaining !== undefined && spinsRemaining <= 0) 
               ? 'bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700' 
               : 'bg-emerald-500 hover:bg-emerald-600 text-gray-950'
           }`}
         >
           {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <Target size={16} />}
           {isLoading ? 'ANALYZING...' : (spinsRemaining !== undefined && spinsRemaining <= 0) ? 'QUOTA EXCEEDED' : 'ANALYZE MARKET'}
         </button>
      </div>
    </div>
  );
};