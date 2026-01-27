import React, { useState, useEffect, useRef, useMemo } from 'react';
import { League, RiskLevel, UserInputState } from '../types';
import { 
    BrainCircuit, 
    Search, 
    Clock, 
    X, 
    RefreshCw, 
    User, 
    Shield, 
    Calendar as CalendarIcon, 
    HistoryIcon, 
    ChevronRight,
    Cpu,
    Timer,
    Globe,
    Zap,
    TrendingUp
} from './Icons';

interface InputFormProps {
  formData: UserInputState;
  setFormData: React.Dispatch<React.SetStateAction<UserInputState>>;
  onSubmit: () => void;
  isLoading: boolean;
  lastSyncTime: Date | null;
}

type AutocompleteCategory = 'player' | 'team' | 'game';

interface AutocompleteItem {
  type: AutocompleteCategory;
  label: string;
  sub: string;
  league: League;
  keywords?: string[];
  date?: string; // Used for date-specific searching
}

const AUTOCOMPLETE_DATA: AutocompleteItem[] = [
  // NBA Players
  { type: 'player', label: 'LeBron James', sub: 'LAL • F', league: League.NBA, keywords: ['king', 'lbj'] },
  { type: 'player', label: 'Stephen Curry', sub: 'GSW • G', league: League.NBA, keywords: ['chef', 'steph'] },
  { type: 'player', label: 'Luka Dončić', sub: 'DAL • G', league: League.NBA, keywords: ['luka'] },
  { type: 'player', label: 'Nikola Jokić', sub: 'DEN • C', league: League.NBA, keywords: ['joker'] },
  { type: 'player', label: 'Giannis Antetokounmpo', sub: 'MIL • F', league: League.NBA, keywords: ['freak'] },
  { type: 'player', label: 'Victor Wembanyama', sub: 'SAS • C', league: League.NBA, keywords: ['wemby'] },
  { type: 'player', label: 'Jayson Tatum', sub: 'BOS • F', league: League.NBA },
  { type: 'player', label: 'Kevin Durant', sub: 'PHX • F', league: League.NBA, keywords: ['kd'] },
  
  // NBA Teams
  { type: 'team', label: 'Los Angeles Lakers', sub: 'LAL', league: League.NBA },
  { type: 'team', label: 'Golden State Warriors', sub: 'GSW', league: League.NBA },
  { type: 'team', label: 'Boston Celtics', sub: 'BOS', league: League.NBA },
  { type: 'team', label: 'Denver Nuggets', sub: 'DEN', league: League.NBA },
  { type: 'team', label: 'Milwaukee Bucks', sub: 'MIL', league: League.NBA },

  // NBA Games
  { type: 'game', label: 'LAL @ GSW', sub: 'Tonight 10:00 PM', league: League.NBA, date: 'today tonight' },
  { type: 'game', label: 'BOS @ NYK', sub: 'Tonight 7:30 PM', league: League.NBA, date: 'today tonight' },
  { type: 'game', label: 'MIL @ PHI', sub: 'Tomorrow 8:00 PM', league: League.NBA, date: 'tomorrow' },
  { type: 'game', label: 'PHX @ DAL', sub: 'Saturday 3:30 PM', league: League.NBA, date: 'saturday sat' },
  { type: 'game', label: 'DEN @ MIA', sub: 'Sunday 6:00 PM', league: League.NBA, date: 'sunday sun' },

  // NFL Players
  { type: 'player', label: 'Patrick Mahomes', sub: 'KC • QB', league: League.NFL },
  { type: 'player', label: 'Lamar Jackson', sub: 'BAL • QB', league: League.NFL },
  { type: 'player', label: 'Christian McCaffrey', sub: 'SF • RB', league: League.NFL, keywords: ['cmc'] },
  { type: 'player', label: 'Tyreek Hill', sub: 'MIA • WR', league: League.NFL, keywords: ['cheetah'] },
  { type: 'player', label: 'Josh Allen', sub: 'BUF • QB', league: League.NFL },
  
  // NFL Teams
  { type: 'team', label: 'Kansas City Chiefs', sub: 'KC', league: League.NFL },
  { type: 'team', label: 'San Francisco 49ers', sub: 'SF', league: League.NFL },
  { type: 'team', label: 'Baltimore Ravens', sub: 'BAL', league: League.NFL },

  // NFL Games
  { type: 'game', label: 'KC @ BUF', sub: 'Sunday 4:25 PM', league: League.NFL, date: 'sunday sun' },
  { type: 'game', label: 'PHI @ DAL', sub: 'Sunday 8:20 PM', league: League.NFL, date: 'sunday sun' },
  { type: 'game', label: 'BAL @ CIN', sub: 'Monday 8:15 PM', league: League.NFL, date: 'monday mon' },

  // MLB Players
  { type: 'player', label: 'Shohei Ohtani', sub: 'LAD • DH/P', league: League.MLB },
  { type: 'player', label: 'Aaron Judge', sub: 'NYY • OF', league: League.MLB },
  { type: 'player', label: 'Mookie Betts', sub: 'LAD • OF', league: League.MLB },
  
  // MLB Teams
  { type: 'team', label: 'LA Dodgers', sub: 'LAD', league: League.MLB },
  { type: 'team', label: 'NY Yankees', sub: 'NYY', league: League.MLB },

  // MLB Games
  { type: 'game', label: 'LAD @ NYY', sub: 'Tonight 7:05 PM', league: League.MLB, date: 'today tonight' },
  { type: 'game', label: 'HOU @ TEX', sub: 'Tonight 8:10 PM', league: League.MLB, date: 'today tonight' },
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
    saveToHistory(term);
    setShowSuggestions(false);
  };

  const formatTime = (date: Date | null) => {
    if (!date) return "WAITING...";
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const historySuggestions = recentSearches.filter(s => 
    s.toLowerCase().includes(formData.filters.toLowerCase())
  );

  const categorizedSuggestions = useMemo(() => {
     if (!formData.filters || formData.filters.length < 1) return { players: [], teams: [], games: [] };
     const lower = formData.filters.toLowerCase();
     
     const filtered = AUTOCOMPLETE_DATA.filter(item => 
        (item.league === formData.league) && 
        (
            item.label.toLowerCase().includes(lower) || 
            item.sub.toLowerCase().includes(lower) ||
            item.keywords?.some(k => k.includes(lower)) ||
            (item.type === 'game' && item.date?.includes(lower))
        )
     );

     return {
        players: filtered.filter(f => f.type === 'player').slice(0, 4),
        teams: filtered.filter(f => f.type === 'team').slice(0, 3),
        games: filtered.filter(f => f.type === 'game').slice(0, 4)
     };
  }, [formData.filters, formData.league]);

  const hasSuggestions = historySuggestions.length > 0 || 
                         categorizedSuggestions.players.length > 0 || 
                         categorizedSuggestions.teams.length > 0 || 
                         categorizedSuggestions.games.length > 0;

  const shouldShowDropdown = showSuggestions && (hasSuggestions || (formData.filters === '' && recentSearches.length > 0));

  return (
    <div className="bg-gray-850 p-6 rounded-xl border border-gray-800 shadow-lg relative z-30">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <Search className="text-emerald-400" size={20} />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Market Intelligence Terminal</h2>
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
        
        {/* Unified Intelligent Search Bar */}
        <div className="md:col-span-8 relative" ref={searchContainerRef}>
          <label className="block text-[10px] text-emerald-400 uppercase tracking-widest mb-2 font-bold flex items-center gap-2">
             <BrainCircuit size={12} /> Search Players, Teams, or Matchups
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
              placeholder="e.g. LeBron James, Lakers, Tonight, Sunday..."
              className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-3 pl-10 focus:outline-none focus:border-emerald-500 transition-colors group-hover:border-gray-600 text-sm h-[52px] font-mono"
            />
            <div className="absolute left-3 top-4 text-gray-500 group-hover:text-emerald-400 transition-colors">
                <Search size={18} />
            </div>
            {formData.filters && (
                <button 
                    onClick={() => setFormData(prev => ({...prev, filters: ''}))}
                    className="absolute right-3 top-4 text-gray-600 hover:text-white transition-colors"
                >
                    <X size={18} />
                </button>
            )}
          </div>

          {shouldShowDropdown && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-gray-950 border border-gray-800 rounded-xl shadow-2xl overflow-hidden z-50 animate-fadeIn ring-1 ring-white/5">
              <div className="py-2 max-h-[420px] overflow-y-auto custom-scrollbar">
                
                {/* Recent History Section */}
                {historySuggestions.length > 0 && (
                    <div className="mb-2">
                        <div className="px-4 py-2 text-[9px] uppercase text-gray-500 font-bold tracking-widest border-b border-gray-800/50 flex justify-between items-center bg-gray-900/40 sticky top-0 backdrop-blur-sm z-10">
                            <span className="flex items-center gap-1.5"><HistoryIcon size={11} /> Recent Queries</span>
                            <button 
                                onClick={clearHistory} 
                                className="text-gray-600 hover:text-rose-400 transition-colors flex items-center gap-1 px-2 py-0.5 rounded hover:bg-rose-500/10"
                            >
                                <X size={10} /> CLEAR
                            </button>
                        </div>
                        {historySuggestions.map((term, idx) => (
                            <div 
                                key={`hist-${idx}`}
                                onClick={() => handleSuggestionClick(term)}
                                className="px-4 py-3 hover:bg-white/5 cursor-pointer flex items-center gap-4 transition-colors text-sm text-gray-300 group"
                            >
                                <Clock size={16} className="text-gray-700 group-hover:text-emerald-500 transition-colors" />
                                <span className="group-hover:text-white transition-colors font-mono">{term}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Categorized Live Suggestions */}
                
                {/* Players */}
                {categorizedSuggestions.players.length > 0 && (
                    <div className="mb-2">
                        <div className="px-4 py-1.5 text-[9px] uppercase text-emerald-500 font-bold tracking-widest bg-emerald-500/5 flex items-center gap-2 border-b border-gray-800/50">
                             <User size={11} /> Verified Players
                        </div>
                        {categorizedSuggestions.players.map((item, idx) => (
                            <div 
                                key={`player-${idx}`}
                                onClick={() => handleSuggestionClick(item.label)}
                                className="px-4 py-3 hover:bg-emerald-500/10 cursor-pointer flex items-center justify-between transition-colors group border-b border-gray-900/50 last:border-0"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-600 group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-all">
                                        <User size={16} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-200 group-hover:text-white transition-colors">{item.label}</span>
                                        <span className="text-[10px] text-gray-500 font-mono">{item.sub}</span>
                                    </div>
                                </div>
                                <TrendingUp size={14} className="text-gray-800 group-hover:text-emerald-500 opacity-0 group-hover:opacity-100 transition-all" />
                            </div>
                        ))}
                    </div>
                )}

                {/* Teams */}
                {categorizedSuggestions.teams.length > 0 && (
                    <div className="mb-2">
                        <div className="px-4 py-1.5 text-[9px] uppercase text-blue-400 font-bold tracking-widest bg-blue-400/5 flex items-center gap-2 border-b border-gray-800/50">
                             <Shield size={11} /> Active Franchises
                        </div>
                        {categorizedSuggestions.teams.map((item, idx) => (
                            <div 
                                key={`team-${idx}`}
                                onClick={() => handleSuggestionClick(item.label)}
                                className="px-4 py-3 hover:bg-blue-400/10 cursor-pointer flex items-center justify-between transition-colors group border-b border-gray-900/50 last:border-0"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-600 group-hover:text-blue-400 group-hover:border-blue-500/30 transition-all">
                                        <Shield size={16} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-200 group-hover:text-white transition-colors">{item.label}</span>
                                        <span className="text-[10px] text-gray-500 font-mono">Organization: {item.sub}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Games */}
                {categorizedSuggestions.games.length > 0 && (
                    <div className="mb-1">
                        <div className="px-4 py-1.5 text-[9px] uppercase text-purple-400 font-bold tracking-widest bg-purple-400/5 flex items-center gap-2 border-b border-gray-800/50">
                             <CalendarIcon size={11} /> Scheduled Matchups
                        </div>
                        {categorizedSuggestions.games.map((item, idx) => (
                            <div 
                                key={`game-${idx}`}
                                onClick={() => handleSuggestionClick(item.label)}
                                className="px-4 py-3 hover:bg-purple-400/10 cursor-pointer flex items-center justify-between transition-colors group border-b border-gray-900/50 last:border-0"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-600 group-hover:text-purple-400 group-hover:border-purple-500/30 transition-all">
                                        <CalendarIcon size={16} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-200 group-hover:text-white transition-colors">{item.label}</span>
                                        <span className="text-[10px] text-gray-500 font-mono">{item.sub}</span>
                                    </div>
                                </div>
                                <Zap size={14} className="text-purple-500 animate-pulse" />
                            </div>
                        ))}
                    </div>
                )}

                {formData.filters.length > 0 && !hasSuggestions && (
                    <div className="px-4 py-8 text-center">
                        <p className="text-xs text-gray-500 font-mono italic">No local matches for "{formData.filters}"</p>
                        <p className="text-[10px] text-gray-600 mt-1">Terminal will attempt global live scan on ANALYZE</p>
                    </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* League Selector */}
        <div className="md:col-span-2">
          <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-bold">Selected Circuit</label>
          <div className="relative group">
            <select 
              name="league"
              value={formData.league}
              onChange={handleChange}
              className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-3 appearance-none focus:outline-none focus:border-emerald-500 transition-colors text-sm h-[52px] font-mono cursor-pointer group-hover:border-gray-600"
            >
              {Object.values(League).map((l) => (
                <option key={l} value={l}>{l} DATASET</option>
              ))}
            </select>
             <div className="absolute right-3 top-4.5 pointer-events-none text-gray-500">
                <ChevronRight size={16} className="rotate-90" />
            </div>
          </div>
        </div>

         {/* Action Button */}
         <div className="md:col-span-2 flex items-end">
            <button 
            onClick={handleSubmission} 
            disabled={isLoading}
            className={`
                w-full flex items-center justify-center gap-3 h-[52px] rounded-lg font-bold tracking-widest transition-all text-xs
                ${isLoading 
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700' 
                : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/40 active:transform active:scale-[0.98] border border-emerald-400/20'
                }
            `}
            >
            {isLoading ? (
                <>
                <RefreshCw className="animate-spin" size={16} />
                DECRYPTING
                </>
            ) : (
                <>
                <Cpu size={18} />
                ANALYZE
                </>
            )}
            </button>
         </div>
      </div>
      
      {/* Dynamic Data Stream Footer */}
      <div className="mt-6 p-3 bg-gray-950/50 rounded-xl border border-gray-800/50 flex flex-wrap gap-6 items-center justify-between animate-fadeIn">
          <div className="flex flex-wrap gap-6 items-center">
            <div className="flex items-center gap-2">
                <Globe size={14} className="text-blue-500" />
                <span className="text-[10px] uppercase text-gray-400 font-bold tracking-widest">Global Grounding: <span className="text-emerald-500">ACTIVE</span></span>
            </div>
            <div className="h-4 w-px bg-gray-800 hidden sm:block"></div>
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[10px] text-gray-500 font-mono">Lines</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse delay-75"></div>
                    <span className="text-[10px] text-gray-500 font-mono">Pace</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse delay-150"></div>
                    <span className="text-[10px] text-gray-500 font-mono">Injuries</span>
                </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pr-2 hidden md:flex">
             <Timer size={14} className="text-gray-600" />
             <div className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">
                LAST TERMINAL SYNC: <span className="text-emerald-500/80 font-bold">{formatTime(lastSyncTime)}</span>
             </div>
          </div>
      </div>
    </div>
  );
};