
import React from 'react';
import { 
    BrainCircuit, Zap, ChevronRight, Activity, BarChart3, Trophy, Timer, 
    Database, Cpu, Globe, User, Shield, Search, TrendingUp, ArrowRight,
    HelpCircle, Book, Lock, List, RefreshCw, GitMerge, CheckCircle2,
    Settings2, Target
} from './Icons';

const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; desc: string; color: string }> = ({ icon, title, desc, color }) => (
    <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl hover:border-emerald-500/30 transition-all group relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            {icon}
        </div>
        <div className={`w-12 h-12 rounded-lg ${color} flex items-center justify-center mb-4 shadow-inner group-hover:scale-110 transition-transform`}>
            {icon}
        </div>
        <h3 className="text-white font-bold mb-2 tracking-tight uppercase text-sm">{title}</h3>
        <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
    </div>
);

const ProtocolStep: React.FC<{ num: string; title: string; desc: string; icon: React.ReactNode }> = ({ num, title, desc, icon }) => (
    <div className="flex gap-6 items-start p-6 bg-gray-900/40 border border-gray-800/50 rounded-xl hover:bg-gray-900/60 transition-colors group">
        <div className="shrink-0 flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-950 border border-emerald-500/30 flex items-center justify-center font-mono text-emerald-400 font-bold text-sm shadow-[0_0_15px_rgba(16,185,129,0.1)] group-hover:border-emerald-500 transition-colors">
                {num}
            </div>
            <div className="w-px h-full bg-gray-800 group-last:hidden"></div>
        </div>
        <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
                <span className="text-emerald-400 opacity-50">{icon}</span>
                <h4 className="text-white font-bold tracking-wide uppercase text-sm">{title}</h4>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
        </div>
    </div>
);

const MetricDef: React.FC<{ term: string; formula?: string; desc: string; icon: React.ReactNode }> = ({ term, formula, desc, icon }) => (
    <div className="border-l-2 border-gray-800 pl-6 py-2 hover:border-emerald-500/50 transition-colors group">
        <div className="flex items-center gap-2 mb-2">
            <span className="text-emerald-500 group-hover:scale-110 transition-transform">{icon}</span>
            <span className="text-white font-bold font-mono text-sm uppercase tracking-widest">{term}</span>
        </div>
        {formula && (
            <div className="bg-gray-950 px-3 py-1.5 rounded border border-gray-800 text-[10px] font-mono text-emerald-400/80 mb-2 inline-block">
                {formula}
            </div>
        )}
        <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
    </div>
);

interface AboutPageProps {
  onBack: () => void;
  onStart: () => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ onBack, onStart }) => {
  return (
    <div className="min-h-screen bg-gray-950 font-sans selection:bg-emerald-500/30 relative overflow-x-hidden">
        {/* Background Visuals */}
        <div className="absolute inset-0 z-0 pointer-events-none" 
             style={{ 
               backgroundImage: 'linear-gradient(#1f2937 1px, transparent 1px), linear-gradient(90deg, #1f2937 1px, transparent 1px)', 
               backgroundSize: '60px 60px',
               opacity: 0.1
             }}>
        </div>
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-emerald-500/5 rounded-full blur-[120px] -z-10 translate-x-1/2 -translate-y-1/2"></div>

        {/* Navbar */}
        <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-40">
           <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
              <div className="flex items-center gap-2 cursor-pointer" onClick={onBack}>
                  <div className="bg-emerald-500/10 p-1.5 rounded border border-emerald-500/20">
                      <BrainCircuit className="text-emerald-500" size={20} />
                  </div>
                  <span className="text-lg font-bold text-white tracking-tight">F*&% Going On! <span className="text-gray-600 text-sm font-normal">| Terminal</span></span>
              </div>
              <button 
                onClick={onBack}
                className="text-xs font-bold text-gray-500 hover:text-white transition-colors flex items-center gap-2 uppercase tracking-widest px-4 py-2 bg-gray-900 rounded-lg border border-gray-800"
              >
                Return to Port
              </button>
           </div>
        </nav>

        <div className="max-w-5xl mx-auto px-6 py-16 relative z-10">
            
            {/* Mission Briefing */}
            <header className="mb-24">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 mb-8 uppercase tracking-widest animate-pulse">
                    <CheckCircle2 size={12} /> System Documentation: Operational Manual V3.5 (Quant Edition)
                </div>
                <h1 className="text-6xl font-bold text-white tracking-tighter mb-8 leading-[0.9]">
                    THE QUANT <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500">BETTING PROTOCOL</span>
                </h1>
                <p className="text-gray-400 text-xl leading-relaxed max-w-3xl font-light">
                    This terminal serves as a high-frequency interface for <span className="text-white font-medium">Bayesian sports modeling</span>. Unlike standard betting apps, we provide the raw mathematical edge derived from live market discrepancies across the NBA, NFL, and MLB.
                </p>
            </header>

            {/* Step-by-Step Operating Guide */}
            <section className="mb-32">
                <div className="flex items-center gap-4 mb-12">
                    <h2 className="text-xl font-bold text-white uppercase tracking-tighter">Operational Protocol</h2>
                    <div className="h-px flex-1 bg-gradient-to-r from-gray-800 to-transparent"></div>
                </div>
                
                <div className="grid lg:grid-cols-1 gap-4">
                    <ProtocolStep 
                        num="01"
                        title="Acquire Discovery Data"
                        desc="Navigate to 'Target Acquisition' and search for a player (e.g., 'Kevin Durant'). The terminal will execute a global scrape to find every verified market line currently available on live books."
                        icon={<Target size={18} />}
                    />
                    <ProtocolStep 
                        num="02"
                        title="Engage Parlay Constructor"
                        desc="Switch to the 'Parlay Constructor' tab to initiate a multi-leg build session. Select your circuit (NBA, NFL, MLB) and use the 'Discovery Engine' search to add specific props to your slip."
                        icon={<GitMerge size={18} />}
                    />
                    <ProtocolStep 
                        num="03"
                        title="Fine-Tune Market Lines"
                        desc="Inside the 'Quant Config Slip,' you can manually adjust the Market Line, Odds, and Over/Under prediction. The terminal's engine handles the math immediately, updating your projections."
                        icon={<Settings2 size={18} />}
                    />
                    <ProtocolStep 
                        num="04"
                        title="Monitor Joint Probability"
                        desc="As you add or edit legs, watch the 'Joint Probability' and 'Mathematical Edge (+EV)' modules. Our Bayesian engine recalculates these values in real-time based on the cumulative risk profile."
                        icon={<Zap size={18} />}
                    />
                    <ProtocolStep 
                        num="05"
                        title="Validate via Grounded Outcomes"
                        desc="Check the 'Grounded Outcomes' tab to verify the model's historical accountability. Every result is officially synced from live match logs to ensure the ROI data is 100% verified."
                        icon={<Trophy size={18} />}
                    />
                </div>
            </section>

            {/* The Quant Glossary */}
            <section className="mb-32 bg-gray-900/20 border border-gray-800 rounded-3xl p-8 md:p-12">
                <div className="flex flex-col md:flex-row gap-12">
                    <div className="md:w-1/3">
                        <h2 className="text-3xl font-bold text-white mb-6 tracking-tighter leading-tight">ENGINE <br /> ARCHITECTURE</h2>
                        <p className="text-gray-500 text-sm leading-relaxed mb-6">
                            The terminal uses a non-static projection model that scales with live variables.
                        </p>
                        <div className="p-4 bg-gray-950 rounded-xl border border-gray-800">
                            <div className="flex items-center gap-2 mb-2">
                                <Cpu size={14} className="text-emerald-500" />
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Calculation Mode</span>
                            </div>
                            <div className="text-xs text-emerald-400 font-mono">DYNAMIC: Real-Time Slip Logic</div>
                        </div>
                    </div>
                    
                    <div className="md:w-2/3 grid gap-8">
                        <MetricDef 
                            term="Joint Probability"
                            formula="P(A ∩ B) = P(A) * P(B)"
                            desc="Calculated in the Parlay Constructor. It represents the actual likelihood of all selected outcomes occurring simultaneously. We use independent Bayesian updates for each leg."
                            icon={<RefreshCw size={16} />}
                        />
                        <MetricDef 
                            term="Expected Value (+EV)"
                            formula="EV = (P_Win * Total_Odds) - 1"
                            desc="The core metric of professional betting. It indicates the long-term profitability of a parlay. If the edge is positive (+), the model has identified a bookmaker pricing error."
                            icon={<TrendingUp size={16} />}
                        />
                        <MetricDef 
                            term="Bayesian Refinement"
                            desc="Our models don't just look at 'last year.' They refine projections using recent game logs (x10, x20) and situational pace adjustments to find the current true mean (μ)."
                            icon={<BrainCircuit size={16} />}
                        />
                    </div>
                </div>
            </section>

            {/* Feature Highlights */}
            <section className="mb-32">
                <div className="flex items-center gap-3 mb-12">
                    <div className="h-px flex-1 bg-gray-800"></div>
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-[0.2em] whitespace-nowrap">Core Terminal Systems</h2>
                    <div className="h-px flex-1 bg-gray-800"></div>
                </div>
                
                <div className="grid md:grid-cols-3 gap-6">
                    <FeatureCard 
                        icon={<Search size={24} className="text-blue-400" />}
                        title="Live Discovery Engine"
                        desc="Search for any player to instantly retrieve their current lines across DraftKings, FanDuel, and PrizePicks."
                        color="bg-blue-500/10 border-blue-500/20"
                    />
                    <FeatureCard 
                        icon={<GitMerge size={24} className="text-emerald-400" />}
                        title="Constructor Tab"
                        desc="A dedicated workspace for building custom slips. Add multiple players and instantly see how they correlate."
                        color="bg-emerald-500/10 border-emerald-500/20"
                    />
                    <FeatureCard 
                        icon={<History size={24} className="text-purple-400" />}
                        title="Settled Log Sync"
                        desc="We don't hide losses. Every model pick is settled and logged in the Outcomes tab for complete transparency."
                        color="bg-purple-500/10 border-purple-500/20"
                    />
                </div>
            </section>

            {/* Final Initialization CTA */}
            <div className="relative group overflow-hidden bg-gray-900 border border-gray-800 p-12 rounded-[2.5rem] text-center shadow-2xl">
                <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                    <h2 className="text-4xl font-bold text-white mb-6 tracking-tighter">PROTOCOL READY <br />FOR EXECUTION</h2>
                    <p className="text-gray-500 mb-10 max-w-sm mx-auto text-sm">Synchronize with the latest market cycle and establish your session.</p>
                    <button 
                        onClick={onStart}
                        className="px-12 py-5 bg-emerald-500 hover:bg-emerald-600 text-gray-950 rounded-2xl font-bold tracking-widest transition-all shadow-[0_0_30px_rgba(16,185,129,0.2)] hover:shadow-[0_0_40px_rgba(16,185,129,0.3)] hover:-translate-y-1 flex items-center gap-4 mx-auto uppercase text-xs"
                    >
                        Initialize Terminal <ArrowRight size={20} />
                    </button>
                </div>
                <div className="absolute -bottom-10 -right-10 text-gray-800/10">
                    <Cpu size={260} />
                </div>
            </div>

        </div>

        {/* Technical Footer */}
        <footer className="border-t border-gray-900 bg-gray-950 py-16 relative z-10">
            <div className="max-w-5xl mx-auto px-6 text-center">
                <div className="flex justify-center gap-10 mb-8 opacity-20">
                    <Globe size={20} className="text-gray-400" />
                    <Shield size={20} className="text-gray-400" />
                    <Database size={20} className="text-gray-400" />
                    <BrainCircuit size={20} className="text-gray-400" />
                </div>
                <p className="text-[10px] text-gray-700 uppercase tracking-[0.4em] font-mono mb-4">
                  F*&% Going On! Terminal BIOS V3.5 • High-Frequency Analytics Engine
                </p>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-900 rounded-full border border-gray-800">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                    <span className="text-[9px] text-gray-500 font-mono">ENCRYPTED DATA FEED: ACTIVE</span>
                </div>
            </div>
        </footer>
    </div>
  );
};
