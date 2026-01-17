
import React from 'react';
import { 
    BrainCircuit, Zap, ChevronRight, Activity, BarChart3, Trophy, Timer, 
    Database, Cpu, Globe, User, Shield, Search, TrendingUp, ArrowRight,
    HelpCircle, Book, Lock
} from './Icons';

interface AboutPageProps {
  onBack: () => void;
  onStart: () => void;
}

const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; desc: string; color: string }> = ({ icon, title, desc, color }) => (
    <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl hover:border-gray-700 transition-all group">
        <div className={`w-12 h-12 rounded-lg ${color} flex items-center justify-center mb-4 shadow-inner group-hover:scale-110 transition-transform`}>
            {icon}
        </div>
        <h3 className="text-white font-bold mb-2 tracking-tight">{title}</h3>
        <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
    </div>
);

const Step: React.FC<{ num: string; title: string; desc: string }> = ({ num, title, desc }) => (
    <div className="flex gap-6 items-start">
        <div className="shrink-0 w-8 h-8 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center font-mono text-emerald-400 font-bold text-xs">
            {num}
        </div>
        <div>
            <h4 className="text-white font-bold mb-1 tracking-wide">{title}</h4>
            <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
        </div>
    </div>
);

export const AboutPage: React.FC<AboutPageProps> = ({ onBack, onStart }) => {
  return (
    <div className="min-h-screen bg-gray-950 font-sans selection:bg-emerald-500/30 relative overflow-x-hidden">
        {/* Decorative Grid */}
        <div className="absolute inset-0 z-0 pointer-events-none" 
             style={{ 
               backgroundImage: 'linear-gradient(#1f2937 1px, transparent 1px), linear-gradient(90deg, #1f2937 1px, transparent 1px)', 
               backgroundSize: '40px 40px',
               opacity: 0.15
             }}>
        </div>

        {/* Navbar */}
        <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-40">
           <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
              <div className="flex items-center gap-2 cursor-pointer" onClick={onBack}>
                  <div className="bg-emerald-500/10 p-1.5 rounded border border-emerald-500/20">
                      <BrainCircuit className="text-emerald-500" size={20} />
                  </div>
                  <span className="text-lg font-bold text-white tracking-tight">F*&% Going On! <span className="text-gray-600 text-sm font-normal">| Terminal</span></span>
              </div>
              <button 
                onClick={onBack}
                className="text-xs font-bold text-gray-500 hover:text-white transition-colors flex items-center gap-2 uppercase tracking-widest"
              >
                Back to Landing
              </button>
           </div>
        </nav>

        <div className="max-w-4xl mx-auto px-6 py-16 relative z-10">
            
            {/* Header */}
            <header className="mb-20">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 mb-6 uppercase tracking-widest">
                    <Book size={12} /> System Documentation V3.0
                </div>
                <h1 className="text-5xl font-bold text-white tracking-tighter mb-6 leading-tight">
                    Beyond Simple Odds.<br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">F*&% Going On!</span>
                </h1>
                <p className="text-gray-400 text-lg leading-relaxed max-w-2xl">
                    F*&% Going On! is a high-frequency sports intelligence terminal. 
                    We leverage Bayesian inference and live market grounding to identify mathematical 
                    discrepancies in player prop pricing across the multi-billion dollar betting ecosystem.
                </p>
            </header>

            {/* Core Pillars */}
            <section className="mb-24">
                <div className="flex items-center gap-3 mb-10">
                    <div className="h-px flex-1 bg-gray-800"></div>
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-[0.2em] whitespace-nowrap">Core Architecture</h2>
                    <div className="h-px flex-1 bg-gray-800"></div>
                </div>
                
                <div className="grid md:grid-cols-2 gap-6">
                    <FeatureCard 
                        icon={<Database size={24} className="text-blue-400" />}
                        title="Live Market Grounding"
                        desc="The system performs real-time scans of ESPN game logs, injury reports, and sportsbook closing lines every time you run an analysis."
                        color="bg-blue-500/10 border-blue-500/20"
                    />
                    <FeatureCard 
                        icon={<Cpu size={24} className="text-emerald-400" />}
                        title="Bayesian Regression"
                        desc="Instead of simple averages, we use Bayesian logic to weight recent form (L10/L20) against full-season variance and opponent difficulty."
                        color="bg-emerald-500/10 border-emerald-500/20"
                    />
                    <FeatureCard 
                        icon={<TrendingUp size={24} className="text-purple-400" />}
                        title="Expected Value (EV)"
                        desc="We calculate the 'Edge' by comparing our proprietary win probability against the probability implied by the bookmaker's odds."
                        color="bg-purple-500/10 border-purple-500/20"
                    />
                    <FeatureCard 
                        icon={<Shield size={24} className="text-orange-400" />}
                        title="Kelly Calibration"
                        desc="Long-term growth is managed via the Kelly Criterion, recommending specific stake sizes based on your model edge and bankroll."
                        color="bg-orange-500/10 border-orange-400/20"
                    />
                </div>
            </section>

            {/* How to Use Section */}
            <section className="mb-24">
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden relative">
                    <div className="p-8 md:p-12 relative z-10">
                        <h2 className="text-3xl font-bold text-white mb-8 tracking-tight flex items-center gap-3">
                            <Timer className="text-emerald-400" /> Operational Guide
                        </h2>
                        
                        <div className="space-y-12">
                            <Step 
                                num="01"
                                title="Initialize the Terminal"
                                desc="Click 'INITIALIZE TERMINAL' to establish a secure session. This wakes up the data-bridges that connect to live sportsbook feeds."
                            />
                            <Step 
                                num="02"
                                title="Analyze Players or Matchups"
                                desc="Search for a specific player (e.g. 'LeBron James') or a team. The terminal will automatically fetch every active prop line available for that target."
                            />
                            <Step 
                                num="03"
                                title="Identify High-ROI Edges"
                                desc="Look for props with a positive Edge percentage. These represent lines where the sportsbook has potentially misjudged the situational outcome."
                            />
                            <Step 
                                num="04"
                                title="Deep-Dive Variance"
                                desc="Click on any prop to sync the Variance Trends, Projection Delta, and Game Logs. This allows you to verify the model's logic against raw historical data."
                            />
                        </div>
                    </div>
                    {/* Visual Decor */}
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <BrainCircuit size={300} />
                    </div>
                </div>
            </section>

            {/* Math Explanation */}
            <section className="mb-24 grid md:grid-cols-3 gap-8 border-t border-gray-800 pt-16">
                <div>
                    <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                        <Activity size={16} className="text-emerald-500" /> Statistical Mean (μ)
                    </h3>
                    <p className="text-gray-500 text-xs leading-relaxed font-mono">
                        μ_final = μ_base * M_min * M_pace * M_opp. <br /><br />
                        We apply multipliers for expected minutes, game pace, and opponent defensive rank to reach a final projected outcome.
                    </p>
                </div>
                <div>
                    <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                        <BarChart3 size={16} className="text-blue-500" /> Z-Score Scaling
                    </h3>
                    <p className="text-gray-500 text-xs leading-relaxed font-mono">
                        Z = (Line - μ_final) / σ <br /><br />
                        The Z-score measures how many standard deviations the market line sits from our projected mean. High absolute Z-scores indicate extreme value.
                    </p>
                </div>
                <div>
                    <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                        <Lock size={16} className="text-purple-500" /> Implied Probability
                    </h3>
                    <p className="text-gray-500 text-xs leading-relaxed font-mono">
                        Edges only exist where P_model > P_implied. <br /><br />
                        We continuously monitor line movements to ensure your Edge is calculated against the most current market data.
                    </p>
                </div>
            </section>

            {/* Final CTA */}
            <div className="text-center bg-emerald-500/5 border border-emerald-500/20 p-12 rounded-3xl animate-fadeIn">
                <h2 className="text-2xl font-bold text-white mb-4 tracking-tight">Ready to operate the terminal?</h2>
                <p className="text-gray-400 mb-8 max-w-sm mx-auto text-sm">Join the 10 PM Mountain Time refresh cycle and identify tomorrow's high-ROI opportunities.</p>
                <button 
                    onClick={onStart}
                    className="px-10 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold tracking-widest transition-all shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-1 flex items-center gap-3 mx-auto"
                >
                    INITIALIZE ACCESS <ArrowRight size={18} />
                </button>
            </div>

        </div>

        {/* Footer */}
        <footer className="border-t border-gray-900 bg-gray-950 py-12 relative z-10">
            <div className="max-w-5xl mx-auto px-6 text-center">
                <p className="text-[10px] text-gray-700 uppercase tracking-widest font-mono mb-4">
                  F*&% Going On! Protocol • Mathematical Integrity Verified
                </p>
                <div className="flex justify-center gap-6">
                    <Globe size={16} className="text-gray-800" />
                    <Shield size={16} className="text-gray-800" />
                    <Zap size={16} className="text-gray-800" />
                </div>
            </div>
        </footer>
    </div>
  );
};
