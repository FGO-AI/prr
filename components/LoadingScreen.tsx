
import React, { useEffect, useState } from 'react';
// Added missing BrainCircuit import
import { BrainCircuit, Cpu, Database, RefreshCw, Zap } from './Icons';

export const LoadingScreen: React.FC = () => {
  const [log, setLog] = useState<string>("Initializing system...");

  useEffect(() => {
    const logs = [
      "Activating Google Search Grounding for live matchup pace...",
      "Fetching real-time x10, x20, and Season averages...",
      "Calculating standard deviation (σ) for market variance...",
      "Analyzing opponent defensive efficiency by role...",
      "Applying Minutes Multiplier (M_min) from injury reports...",
      "Computing Pace-Adjusted Final Projected Mean (μ_final)...",
      "Calculating Z-Scores for all active prop lines...",
      "Mapping Normal Distribution CDF for Win Probabilities...",
      "Identifying 30% ROI edges via American odds comparison...",
      "Calibrating Kelly Stakes for bankroll optimization..."
    ];
    
    let i = 0;
    const interval = setInterval(() => {
      if (i < logs.length) {
        setLog(logs[i]);
        i++;
      }
    }, 600);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-gray-950/95 z-50 flex items-center justify-center backdrop-blur-md">
      <div className="w-full max-w-md p-8 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-emerald-500 animate-pulse"></div>
        
        <div className="flex flex-col items-center gap-8">
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500 blur-2xl opacity-10 rounded-full"></div>
            <div className="p-4 rounded-full bg-gray-800 border border-gray-700 relative">
                <RefreshCw className="text-emerald-400 animate-spin" size={40} />
            </div>
            <Zap className="absolute -top-1 -right-1 text-yellow-400 animate-bounce" size={16} />
          </div>
          
          <div className="text-center w-full">
            <h3 className="text-lg font-bold text-white mb-2 tracking-widest uppercase">Prop Engine V3.0</h3>
            <div className="bg-gray-950 p-4 rounded-lg border border-gray-800 min-h-[64px] flex items-center justify-center">
                <p className="font-mono text-emerald-500 text-[10px] leading-relaxed animate-pulse">
                    {">"} {log}
                </p>
            </div>
          </div>

          <div className="flex justify-center gap-12 w-full border-t border-gray-800 pt-6">
             <div className="flex flex-col items-center text-gray-500 gap-1">
                <Database size={18} className="text-blue-500" />
                <span className="text-[9px] uppercase font-bold tracking-widest">Market Feed</span>
             </div>
             <div className="flex flex-col items-center text-gray-500 gap-1">
                <Cpu size={18} className="text-emerald-500" />
                <span className="text-[9px] uppercase font-bold tracking-widest">Quant Model</span>
             </div>
             <div className="flex flex-col items-center text-gray-500 gap-1">
                <BrainCircuit size={18} className="text-purple-500" />
                <span className="text-[9px] uppercase font-bold tracking-widest">ROI Logic</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
