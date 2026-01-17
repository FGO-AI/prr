
import React, { useMemo } from 'react';
import { BrainCircuit, Zap, ChevronRight, Activity, BarChart3, Trophy, Timer, Database, Cpu, Globe, User } from './Icons';
import { ParlayRecommendation } from '../types';

interface LandingPageProps {
  onEnter: () => void;
  onAbout?: () => void;
  onResume?: () => void;
  hasActiveSession?: boolean;
  trendingPicks?: ParlayRecommendation[];
}

const LIVE_SIMS = [
  { league: "NFL", match: "KC vs BUF", pick: "P. Mahomes O 285.5 Pass", prob: "64%", time: "Live" },
  { league: "NBA", match: "LAL vs GSW", pick: "L. James O 24.5 Pts", prob: "62%", time: "2s ago" },
  { league: "NFL", match: "SF vs DET", pick: "C. McCaffrey O 85.5 Rush", prob: "69%", time: "5s ago" },
  { league: "NBA", match: "BOS vs NYK", pick: "J. Tatum O 26.5 Pts", prob: "58%", time: "8s ago" },
  { league: "NFL", match: "MIA vs NYJ", pick: "T. Hill O 88.5 Rec", prob: "65%", time: "11s ago" },
  { league: "NBA", match: "DAL vs PHX", pick: "L. Doncic O 9.5 Ast", prob: "71%", time: "15s ago" },
];

const LiveTicker = () => (
  <div className="w-full bg-gray-900 border-y border-gray-800 overflow-hidden relative h-20 flex items-center shadow-2xl z-20">
    <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-gray-950 to-transparent z-10"></div>
    <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-gray-950 to-transparent z-10"></div>
    
    <div className="animate-marquee flex items-center gap-0 whitespace-nowrap">
       {[...LIVE_SIMS, ...LIVE_SIMS, ...LIVE_SIMS].map((sim, i) => (
         <div key={i} className="flex flex-col justify-center border-r border-gray-800 px-8 h-20 bg-gray-900/50 hover:bg-gray-800 transition-colors cursor-default group">
            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 group-hover:text-gray-400">
               <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
               <span className={sim.league === 'NFL' ? 'text-blue-400' : 'text-orange-400'}>{sim.league}</span>
               <span className="text-gray-700">|</span>
               {sim.match}
            </div>
            <div className="flex items-center gap-3">
                <span className="text-gray-200 font-bold font-mono text-sm group-hover:text-white transition-colors">{sim.pick}</span>
                <span className="text-emerald-400 font-bold text-sm bg-emerald-500/10 px-1.5 rounded border border-emerald-500/20">
                    {sim.prob}
                </span>
            </div>
         </div>
       ))}
    </div>
    
    <style>{`
      @keyframes marquee {
        0% { transform: translateX(0); }
        100% { transform: translateX(-50%); }
      }
      .animate-marquee {
        animation: marquee 80s linear infinite;
      }
    `}</style>
  </div>
);

const TopPicksCard: React.FC<{ picks: ParlayRecommendation[] }> = ({ picks }) => {
  const displayPicks = useMemo(() => {
    if (!picks || picks.length === 0) {
        // Return placeholders if nothing loaded yet
        return Array.from({ length: 3 }).map((_, i) => ({
            rank: i + 1,
            player: "Scanning...",
            team: "---",
            prop: "---",
            ev: "---",
            odds: "---"
        }));
    }
    return picks.flatMap(p => p.legs).slice(0, 3).map((leg, i) => ({
        rank: i + 1,
        player: leg.playerName,
        team: leg.team,
        prop: `${leg.prediction === 'Over' ? 'O' : 'U'} ${leg.line} ${leg.statType}`,
        ev: leg.edge > 0 ? `+${leg.edge.toFixed(1)}%` : `${leg.edge.toFixed(1)}%`,
        odds: leg.bookOdds > 0 ? `+${leg.bookOdds}` : leg.bookOdds.toString()
    }));
  }, [picks]);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl w-full relative group hover:border-gray-700 transition-colors h-full flex flex-col">
       <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 opacity-50 group-hover:opacity-100 transition-opacity"></div>
       
       <div className="p-4 border-b border-gray-800 bg-gray-900/80 backdrop-blur flex justify-between items-center">
          <div className="flex items-center gap-2">
             <Trophy size={16} className="text-yellow-400" />
             <span className="text-sm font-bold text-white tracking-wide uppercase">Trending Edges</span>
          </div>
          <div className="text-[10px] font-mono text-gray-500 flex items-center gap-1">
             <Timer size={10} />
             Cycle: 10PM MT
          </div>
       </div>

       <div className="divide-y divide-gray-800 flex-1">
          {displayPicks.map((pick, i) => (
             <div key={i} className="p-4 hover:bg-gray-800/40 transition-colors flex items-center justify-between group/item">
                <div className="flex items-center gap-3">
                   <div className="font-mono text-gray-700 text-2xl font-bold group-hover/item:text-emerald-500/50 transition-colors">0{pick.rank}</div>
                   <div>
                      <div className="text-sm font-bold text-gray-200">{pick.player}</div>
                      <div className="text-[10px] text-gray-500">{pick.team} • <span className="text-emerald-400 font-medium">{pick.prop}</span></div>
                   </div>
                </div>
                <div className="text-right">
                   <div className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold mb-1">
                      {pick.ev} EV
                   </div>
                   <div className="text-xs font-mono text-gray-400">{pick.odds}</div>
                </div>
             </div>
          ))}
       </div>
    </div>
  );
};

export const LandingPage: React.FC<LandingPageProps> = ({ onEnter, onAbout, onResume, hasActiveSession, trendingPicks = [] }) => {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col font-sans selection:bg-emerald-500/30 overflow-hidden">
        
        <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-40">
           <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
              <div className="flex items-center gap-2">
                  <div className="bg-emerald-500/10 p-1.5 rounded border border-emerald-500/20">
                      <BrainCircuit className="text-emerald-500" size={20} />
                  </div>
                  <span className="text-lg font-bold text-white tracking-tight">F*&% Going On! <span className="text-gray-600 text-sm font-normal">| Terminal</span></span>
              </div>
              <div className="flex items-center gap-4">
                 <div className="hidden md:flex items-center gap-2 text-xs text-gray-500 font-mono">
                    <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> SYSTEM ONLINE</span>
                    <span className="text-gray-700">|</span>
                    <span>10PM MT REFRESH</span>
                 </div>
                 {hasActiveSession && onResume && (
                    <button onClick={onResume} className="px-3 py-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors">
                        RESUME SESSION
                    </button>
                 )}
              </div>
           </div>
        </nav>

        <LiveTicker />

        <div className="flex-1 flex flex-col relative">
            <div className="absolute inset-0 z-0 pointer-events-none" 
                 style={{ 
                   backgroundImage: 'linear-gradient(#1f2937 1px, transparent 1px), linear-gradient(90deg, #1f2937 1px, transparent 1px)', 
                   backgroundSize: '40px 40px',
                   opacity: 0.2
                 }}>
            </div>
            
            <div className="max-w-7xl mx-auto px-6 py-12 lg:py-20 w-full relative z-10 grid lg:grid-cols-2 gap-12 items-center">
                
                <div className="space-y-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-900 border border-gray-700 text-xs font-medium text-emerald-400 mb-2 animate-fadeIn">
                       <Zap size={12} fill="currentColor" />
                       <span>LIVE: Daily Prop Cycle Syncs at 10 PM Mountain Time</span>
                    </div>
                    
                    <h1 className="text-5xl lg:text-7xl font-bold text-white tracking-tighter leading-none">
                       F*&% <br />
                       <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Going On!</span>
                    </h1>
                    
                    <p className="text-gray-400 text-lg max-w-xl leading-relaxed">
                       Advanced sports analytics terminal leveraging Bayesian inference to identify mispriced player props across all major books.
                    </p>

                    <div className="flex flex-wrap gap-4 pt-2">
                        <button 
                           onClick={onEnter}
                           className="group relative px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold tracking-wide transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-1 overflow-hidden"
                        >
                           <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 skew-y-12"></div>
                           <div className="relative flex items-center gap-3">
                              INITIALIZE TERMINAL <ChevronRight size={18} />
                           </div>
                        </button>

                        <button 
                           onClick={onAbout}
                           className="px-8 py-4 bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-300 rounded-lg font-bold tracking-wide transition-all flex items-center gap-2"
                        >
                           <Activity size={18} /> HOW TO USE
                        </button>
                    </div>

                    <div className="flex items-center gap-8 text-gray-500 text-xs font-mono pt-8">
                        <div className="flex items-center gap-2">
                            <Database size={14} className="text-gray-600" />
                            <span>15M+ DATA POINTS</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Cpu size={14} className="text-gray-600" />
                            <span>42ms LATENCY</span>
                        </div>
                         <div className="flex items-center gap-2">
                            <Globe size={14} className="text-gray-600" />
                            <span>GLOBAL COVERAGE</span>
                        </div>
                    </div>
                </div>

                <div className="relative hidden lg:flex flex-col items-center justify-center gap-8 h-full min-h-[550px]">
                    <div className="w-full max-w-sm space-y-6">
                        <div className="w-full bg-gray-900/90 backdrop-blur border border-gray-800 p-6 rounded-xl shadow-2xl z-10 animate-[float_8s_ease-in-out_infinite]">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20 text-blue-400">
                                        <BarChart3 size={24} />
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">Aggregated Model ROI</div>
                                        <div className="text-2xl font-bold text-white">+18.4% <span className="text-xs font-normal text-emerald-400 ml-1">L30 Days</span></div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] text-gray-600 font-mono">CONFIDENCE</div>
                                    <div className="text-emerald-500 font-bold font-mono">94.2%</div>
                                </div>
                            </div>
                            <div className="h-24 flex items-end gap-1.5">
                                {[35, 60, 45, 85, 50, 95, 70, 80, 55, 90, 85].map((h, i) => (
                                    <div 
                                        key={i} 
                                        className="flex-1 bg-gray-800 hover:bg-emerald-500/50 transition-all rounded-t relative group" 
                                        style={{ height: `${h}%` }}
                                    >
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="w-full z-20 animate-[float_6s_ease-in-out_infinite_0.5s]">
                            <TopPicksCard picks={trendingPicks} />
                        </div>
                    </div>

                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[100px] -z-10"></div>
                </div>
            </div>
        </div>
        
        <footer className="border-t border-gray-900 bg-gray-950 py-8 relative z-10">
            <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <p className="text-xs text-gray-600">© 2024 F*&% Going On! Systems. All rights reserved. Data refreshed daily at 10:00 PM MT.</p>
                <div className="flex items-center gap-4 text-xs text-gray-600">
                    <span className="hover:text-emerald-400 cursor-pointer transition-colors">Privacy Protocol</span>
                    <span className="hover:text-emerald-400 cursor-pointer transition-colors">Terms of Service</span>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-900 rounded border border-gray-800">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                        <span>All Systems Operational</span>
                    </div>
                </div>
            </div>
        </footer>

        <style>{`
            @keyframes float {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
            }
        `}</style>
    </div>
  );
};
