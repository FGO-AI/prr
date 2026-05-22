
import React, { useMemo, useState } from 'react';
import { ParlayRecommendation, BetLeg } from '../types';
import { TrendingUp, Activity, Zap, Search, GitMerge, RefreshCw, DollarSign, Shield } from './Icons';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { calculateEngineMetrics } from '../services/projectionEngine';

const americanToDecimal = (odds: number): number => odds > 0 ? (odds / 100) + 1 : (100 / Math.abs(odds)) + 1;
const formatOdds = (odds: number) => (odds > 0 ? `+${odds}` : `${odds}`);

const LegRow: React.FC<{ leg: BetLeg; onPlayerClick: (name: string) => void }> = ({ leg, onPlayerClick }) => {
    return (
      <div className="flex flex-col p-3 bg-gray-900 rounded border border-gray-800 mb-2 hover:border-gray-700 transition-colors">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className={`w-1 h-8 rounded-full ${leg.prediction === 'Over' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                <div>
                    <button onClick={() => onPlayerClick(leg.playerName)} className="font-semibold text-gray-200 hover:text-emerald-400 transition-colors">
                        {leg.playerName}
                    </button>
                    <div className="text-xs text-gray-500 font-mono flex items-center gap-2">
                        <span>{leg.prediction.toUpperCase()} {leg.line} {leg.statType}</span>
                        {leg.gameTime && (
                            <span className="text-[9px] text-gray-600 bg-gray-950 px-1 rounded border border-gray-800">
                                {leg.gameTime}
                            </span>
                        )}
                    </div>
                    {(leg.dataSource || leg.gameDate) && (
                        <div className="text-[8px] text-gray-600 font-mono mt-1 flex items-center gap-2">
                            {leg.dataSource && <span className="uppercase">Source: {leg.dataSource}</span>}
                            {leg.gameDate && <span>• {leg.gameDate}</span>}
                        </div>
                    )}
                </div>
            </div>
            <div className="text-right">
                <div className="text-[10px] text-emerald-500 font-bold">{(leg.modelProb * 100).toFixed(0)}%</div>
                <div className="text-[9px] text-gray-500 font-mono">P_MODEL</div>
            </div>
        </div>
      </div>
    );
};

export const ParlayCard: React.FC<ParlayCardProps> = ({ parlay, index, onPlayerClick, bankroll = 1000 }) => {
  const COLORS = ['#10b981', '#374151'];
  const pieData = [{ name: 'Win', value: parlay.jointProbAdjusted * 100 }, { name: 'Loss', value: 100 - (parlay.jointProbAdjusted * 100) }];

  return (
    <div className="bg-gray-850 rounded-xl border border-gray-800 p-6 mb-6 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-blue-500"></div>
      
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Shield size={14} className="text-emerald-500" />
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest font-mono">
                    AI SYSTEM DIRECTIVE: {parlay.totalOdds > 500 ? 'AGGRESSIVE' : 'BALANCED'} VALUE
                </span>
              </div>
              <h3 className="text-3xl font-bold text-white font-mono">{formatOdds(parlay.totalOdds)} PARLAY</h3>
            </div>
            <div className="text-right">
               <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Kelly Stake</div>
               <div className="text-2xl font-mono font-bold text-blue-400">{parlay.kellyStake.toFixed(1)}%</div>
            </div>
          </div>

          <div className="space-y-2 mb-6">
             {parlay.legs.map((leg, i) => <LegRow key={i} leg={leg} onPlayerClick={onPlayerClick} />)}
          </div>

          <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800">
             <div className="text-[10px] font-bold text-emerald-500 uppercase mb-2 flex items-center gap-2">
                <TrendingUp size={12} /> Analytical Summary
             </div>
             <p className="text-sm text-gray-400 italic leading-relaxed">
                {parlay.summary}
             </p>
          </div>
        </div>

        <div className="w-full lg:w-72 flex flex-col gap-4">
           <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 h-full flex flex-col items-center">
              <h4 className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-4">Joint Win Probability</h4>
              <div className="h-40 w-full relative mb-4">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value" startAngle={90} endAngle={-270}>
                          {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-mono text-emerald-400 font-bold">{(parlay.jointProbAdjusted * 100).toFixed(0)}%</span>
                </div>
              </div>
              <div className="w-full space-y-3 mt-auto">
                 <div className="p-3 bg-gray-950 rounded-lg border border-gray-800 text-center">
                    <div className="text-[9px] text-gray-500 uppercase mb-1">Expected ROI</div>
                    <div className="text-2xl font-mono font-bold text-emerald-400">+{(parlay.expectedValue).toFixed(1)}%</div>
                 </div>
                 <button className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-gray-950 rounded-lg font-bold text-[10px] tracking-widest uppercase transition-all shadow-lg shadow-emerald-500/20">
                    Execute Position
                 </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

interface ParlayCardProps {
  parlay: ParlayRecommendation;
  index: number;
  onPlayerClick: (name: string) => void;
  bankroll?: number;
}
