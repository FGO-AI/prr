import React, { useEffect, useState } from 'react';
import { Cpu, Database, RefreshCw } from './Icons';

export const LoadingScreen: React.FC = () => {
  const [log, setLog] = useState<string>("Initializing system...");

  useEffect(() => {
    const logs = [
      "Establishing connection to Odds API & DFS platforms...",
      "Fetching real-time lines from DK, FD, PrizePicks, Underdog, Chalkboard...",
      "Verifying Active Rosters & Injury Reports (ESPN / RotoWire)...",
      "Computing Bayesian Posteriors from Implied Probabilities...",
      "Fitting Negative Binomial & Poisson Distributions...",
      "Running Monte Carlo Simulation (n=10,000 iterations)...",
      "Performing Time-Series Analysis (ARIMA / Exp. Smoothing)...",
      "Calculating Copula Functions for Joint Correlations...",
      "Optimizing Utility via Kelly Criterion & Game Theory...",
      "Finalizing Risk-Adjusted Expected Value (Sharpe Ratio)..."
    ];
    
    let i = 0;
    const interval = setInterval(() => {
      if (i < logs.length) {
        setLog(logs[i]);
        i++;
      }
    }, 800);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-gray-950/90 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="w-full max-w-md p-8 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl relative overflow-hidden">
         {/* Scanning line effect */}
        <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 animate-[loading_2s_ease-in-out_infinite]"></div>
        
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500 blur-xl opacity-20 rounded-full"></div>
            <RefreshCw className="text-emerald-400 animate-spin" size={48} />
          </div>
          
          <div className="text-center">
            <h3 className="text-xl font-bold text-white mb-2 tracking-widest">CALCULATING PROBABILITIES</h3>
            <p className="font-mono text-emerald-500 text-xs h-6 px-4 truncate">{log}</p>
          </div>

          <div className="flex justify-center gap-8 w-full border-t border-gray-800 pt-6">
             <div className="flex flex-col items-center text-gray-500">
                <Database size={20} className="mb-1 text-blue-500" />
                <span className="text-[10px] uppercase">Data Lake</span>
             </div>
             <div className="flex flex-col items-center text-gray-500">
                <Cpu size={20} className="mb-1 text-purple-500" />
                <span className="text-[10px] uppercase">Math Engine</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};