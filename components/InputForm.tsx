import React, { useState, useEffect, useRef, useMemo } from 'react';
import { League, RiskLevel, UserInputState } from '../types';
import { BrainCircuit, DollarSign, RefreshCw, Zap, Database, Activity, Globe, Search, Clock, X, BarChart3, TrendingUp, ShieldAlert, Timer, Calendar, User, Trophy, MapPin, Cpu, History } from './Icons';

interface InputFormProps {
  formData: UserInputState;
  setFormData: React.Dispatch<React.SetStateAction<UserInputState>>;
  onSubmit: () => void;
  isLoading: boolean;
  lastSyncTime: Date | null;
}

const AUTOCOMPLETE_DATA = [
  // NBA Players
  { type: 'player', label: 'LeBron James', sub: 'LAL • F', league: 'NBA' },
  { type: 'player', label: 'Stephen Curry', sub: 'GSW • G', league: 'NBA' },
  { type: 'player', label: 'Luka Dončić', sub: 'DAL • G', league: 'NBA' },
  { type: 'player', label: 'Nikola Jokić', sub: 'DEN • C', league: 'NBA' },
  { type: 'player', label: 'Giannis Antetokounmpo', sub: 'MIL • F', league: 'NBA' },
  { type: 'player', label: 'Jayson Tatum', sub: 'BOS • F', league: 'NBA' },
  { type: 'player', label: 'Shai Gilgeous-Alexander', sub: 'OKC • G', league: 'NBA' },
  { type: 'player', label: 'Anthony Edwards', sub: 'MIN • G', league: 'NBA' },
  { type: 'player', label: 'Kevin Durant', sub: 'PHX • F', league: 'NBA' },
  { type: 'player', label: 'Joel Embiid', sub: 'PHI • C', league: 'NBA' },
  { type: 'player', label: 'Victor Wembanyama', sub: 'SAS • C', league: 'NBA' },
  
  // NFL Players
  { type: 'player', label: 'Patrick Mahomes', sub: 'KC • QB', league: 'NFL' },
  { type: 'player', label: 'Lamar Jackson', sub: 'BAL • QB', league: 'NFL' },
  { type: 'player', label: 'Christian McCaffrey', sub: 'SF • RB', league: 'NFL' },
  { type: 'player', label: 'Tyreek Hill', sub: 'MIA • WR', league: 'NFL' },
  { type: 'player', label: 'Josh Allen', sub: 'BUF • QB', league: 'NFL' },

  // MLB Players
  { type: 'player', label: 'Shohei Ohtani', sub: 'LAD • DH/P', league: 'MLB' },
  { type: 'player', label: 'Aaron Judge', sub: 'NYY • OF', league: 'MLB' },
  { type: 'player', label: 'Mookie Betts', sub: 'LAD • OF', league: 'MLB' },
];

export const InputForm: React.FC<InputFormProps> = ({ 
  formData, 
  setFormData, 
  onSubmit, 
  isLoading,
  lastSyncTime
}) => {
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('prr_search_history');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse search history", e);
      }
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'league') {
        setFormData(prev => ({
          ...prev,
          league: value as League,
          statType: 'Any'
        }));
    } else {
        setFormData(prev => ({
          ...prev,
          [name]: name === 'bankroll' ? parseFloat(value) : value
        }));
    }
    if (name === 'filters') {
      setShowSuggestions(true);
    }
  };

  const saveToHistory = (term: string) => {
    if (!term || term.trim().length < 2) return;
    const cleanTerm = term.trim();
    // Remove duplicates and keep only last 5, adding new one to front
    const newHistory = [cleanTerm, ...recentSearches.filter(s => s.toLowerCase() !== cleanTerm.toLowerCase())].slice(0, 5);
    setRecentSearches(newHistory);
    localStorage.setItem('prr_search_history', JSON.stringify(newHistory));
  };

  const clearHistory = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    setRecentSearches([]);
    localStorage.removeItem('prr_search_history');
    setShowSuggestions(false); 
  };

  const handleSubmission = () => {
    saveToHistory(formData.filters);
    setShowSuggestions(false);
    onSubmit();
  };

  const handleSuggestionClick = (term: string) => {
    setFormData(prev => ({ ...prev, filters: term }));
    saveToHistory(term); // Update history order immediately on click
    setShowSuggestions(false);
  };

  const formatTime = (date: Date | null) => {
    if (!date) return "WAITING...";
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const historySuggestions = recentSearches.filter(s => 
    s.toLowerCase().includes(formData.filters.toLowerCase())
  );

  const liveSuggestions = useMemo(() => {
     if (!formData.filters || formData.filters.length < 2) return [];
     const lower = formData.filters.toLowerCase();
     return AUTOCOMPLETE_DATA.filter(item => 
        (item.league === formData.league) && 
        (item.label.toLowerCase().includes(lower) || item.sub.toLowerCase().includes(lower))
     ).slice(0, 4); 
  }, [formData.filters, formData.league]);

  const shouldShowDropdown = showSuggestions && (historySuggestions.length > 0 || liveSuggestions.length > 0 || (formData.filters === '' && recentSearches.length > 0));

  return (
    <div className="bg-gray-850 p-6 rounded-xl border border-gray-800 shadow-lg relative z-30">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Search className="text-emerald-400" size={24} />
          <h2 className="text-xl font-bold text-white">Player Search</h2>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleSubmission}
            disabled={isLoading}
            className="flex items-center justify-center p-2 bg-gray-900 border border-gray-800 rounded-lg hover:bg-gray-800 hover:border-gray-700 transition-all text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed group"
            title="Force Refresh Data"
          >
            <RefreshCw size={18} className={`group-hover:text-emerald-400 transition-colors ${isLoading ? 'animate-spin text-emerald-500' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Search Bar (Massive) */}
        <div className="md:col-span-8 relative" ref={searchContainerRef}>
          <label className="block text-xs text-emerald-400 uppercase tracking-wider mb-2 font-bold flex items-center gap-2">
             <User size={12} /> Player Name
          </label>
          <div className="relative group">
            <input 
              type="text" 
              name="filters"
              value={formData.filters}
              onChange={handleChange}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmission();
              }}
              autoComplete="off"
              placeholder="e.g. LeBron James, Patrick Mahomes..."
              className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-3 pl-10 focus:outline-none focus:border-emerald-500 transition-colors group-hover:border-gray-600 text-sm h-[46px]"
            />
            <Search size={16} className="absolute left-3 top-3.5 text-gray-500 group-hover:text-emerald-400 transition-colors" />
          </div>

          {shouldShowDropdown && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50 animate-fadeIn">
              <div className="py-1 max-h-64 overflow-y-auto custom-scrollbar">
                
                {/* History Section - PRIORITIZED AT TOP */}
                {historySuggestions.length > 0 && (
                    <div className="mb-1">
                        <div className="px-3 py-2 text-[10px] uppercase text-gray-500 font-bold tracking-wider border-b border-gray-800 flex justify-between items-center bg-gray-900/80 sticky top-0 backdrop-blur-sm z-10">
                            <span className="flex items-center gap-1"><History size={10} /> Recent</span>
                            <button 
                                onClick={clearHistory} 
                                className="text-gray-600 hover:text-rose-400 transition-colors flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-rose-500/10"
                                title="Clear History"
                            >
                                <X size={10} /> Clear
                            </button>
                        </div>
                        {historySuggestions.map((term, idx) => (
                            <div 
                                key={`hist-${idx}`}
                                onClick={() => handleSuggestionClick(term)}
                                className="px-3 py-2.5 hover:bg-gray-800 cursor-pointer flex items-center gap-3 transition-colors text-sm text-gray-300 group border-b border-gray-800/50 last:border-0"
                            >
                                <Clock size={14} className="text-gray-600 group-hover:text-emerald-400 transition-colors" />
                                <span className="group-hover:text-white transition-colors font-medium">{term}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Live Suggestions Section */}
                {liveSuggestions.length > 0 && (
                    <div>
                        <div className="px-3 py-1.5 text-[10px] uppercase text-emerald-500 font-bold tracking-wider bg-emerald-950/20 flex items-center gap-2 sticky top-0 z-10">
                             <Zap size={10} fill="currentColor" /> Active Roster
                        </div>
                        {liveSuggestions.map((item, idx) => (
                            <div 
                                key={`live-${idx}`}
                                onClick={() => handleSuggestionClick(item.label)}
                                className="px-3 py-2.5 hover:bg-gray-800 cursor-pointer flex items-center justify-between transition-colors text-sm text-gray-200 border-b border-gray-800/50 last:border-0"
                            >
                                <div className="flex items-center gap-3">
                                    <User size={14} className="text-gray-400" />
                                    <div className="flex flex-col">
                                        <span className="font-semibold">{item.label}</span>
                                        <span className="text-[10px] text-gray-500">{item.sub}</span>
                                    </div>
                                </div>
                                <div className="text-[10px] bg-gray-800 text-gray-400 px-1 rounded border border-gray-700">
                                    {item.league}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* League Selector */}
        <div className="md:col-span-2">
          <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">League</label>
          <div className="relative">
            <select 
              name="league"
              value={formData.league}
              onChange={handleChange}
              className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-3 appearance-none focus:outline-none focus:border-emerald-500 transition-colors text-sm h-[46px]"
            >
              {Object.values(League).map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
             <div className="absolute right-3 top-3.5 pointer-events-none text-gray-500">
               <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
            </div>
          </div>
        </div>

         {/* Action Button (2 cols) */}
         <div className="md:col-span-2 flex items-end">
            <button 
            onClick={handleSubmission} 
            disabled={isLoading}
            className={`
                w-full flex items-center justify-center gap-2 h-[46px] rounded-lg font-bold tracking-wide transition-all text-xs sm:text-sm
                ${isLoading 
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 active:transform active:scale-95'
                }
            `}
            >
            {isLoading ? (
                <>
                <RefreshCw className="animate-spin" size={16} />
                SCANNING
                </>
            ) : (
                <>
                <BrainCircuit size={16} />
                ANALYZE
                </>
            )}
            </button>
         </div>
      </div>
      
      {/* Live Data Sources Indicator */}
      <div className="mt-4 p-3 bg-gray-900/50 rounded-lg border border-gray-800 flex flex-wrap gap-4 items-center justify-between animate-fadeIn">
          <div className="flex flex-wrap gap-4 items-center">
            <span className="text-[10px] uppercase text-gray-500 font-bold tracking-widest flex items-center gap-1">
                <Globe size={10} /> Live Verification:
            </span>
            <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-xs text-gray-300 font-medium">Injury Reports</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse delay-75"></div>
                <span className="text-xs text-gray-300 font-medium">DK / FD / PrizePicks</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pl-4 border-l border-gray-800 hidden sm:flex">
             <Timer size={12} className="text-gray-500" />
             <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
                LAST SYNC: <span className="text-emerald-400 font-bold">{formatTime(lastSyncTime)}</span>
             </span>
          </div>
      </div>
    </div>
  );
};