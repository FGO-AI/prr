
import { useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import { ParlayRecommendation } from '../types';

interface WinRateChartProps {
  history: ParlayRecommendation[];
}

interface ChartDataPoint {
  week: string;
  winRate: number;
  totalPicks: number;
}

export function WinRateChart({ history }: WinRateChartProps) {
  const chartData = useMemo(() => {
    if (!history || history.length === 0) return [];

    const weeksMap: Record<string, { hits: number; total: number; label: string }> = {};

    history.forEach(pick => {
      const date = new Date(pick.timestamp);
      // Get the start of the week (Sunday)
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - date.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      const weekLabel = startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const weekKey = startOfWeek.toISOString(); // Use ISO string as unique key for sorting

      pick.legs.forEach(leg => {
        if (leg.settledStatus === 'Hit' || leg.settledStatus === 'Miss') {
          if (!weeksMap[weekKey]) {
            weeksMap[weekKey] = { hits: 0, total: 0, label: weekLabel };
          }
          weeksMap[weekKey].total += 1;
          if (leg.settledStatus === 'Hit') {
            weeksMap[weekKey].hits += 1;
          }
        }
      });
    });

    const sortedWeeks = Object.entries(weeksMap)
      .map(([key, stats]) => ({
        week: stats.label,
        winRate: parseFloat(((stats.hits / stats.total) * 100).toFixed(1)),
        totalPicks: stats.total,
        key
      }))
      .sort((a, b) => a.key.localeCompare(b.key));

    return sortedWeeks;
  }, [history]);

  if (chartData.length < 2) {
    return (
      <div className="h-[200px] flex flex-col items-center justify-center bg-gray-900/30 border border-dashed border-gray-800 rounded-2xl p-6 text-center">
        <div className="text-[10px] font-mono text-gray-600 uppercase tracking-widest mb-2">Insufficient Historical Depth</div>
        <p className="text-[9px] text-gray-700 uppercase tracking-tighter">Need at least 2 weeks of settled data to plot trajectory</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-[0.2em]">Win-Rate Trajectory</h3>
          <p className="text-[9px] text-gray-500 font-mono uppercase mt-1">Weekly Hit Probability Distribution</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-[9px] text-gray-400 font-mono uppercase">Hit Rate %</span>
          </div>
        </div>
      </div>

      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorWinRate" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis 
              dataKey="week" 
              stroke="#4b5563" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false} 
              tick={{ fill: '#4b5563' }}
              dy={10}
            />
            <YAxis 
              stroke="#4b5563" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false} 
              tick={{ fill: '#4b5563' }}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#111827', 
                border: '1px solid #374151',
                borderRadius: '8px',
                fontSize: '10px',
                color: '#fff'
              }}
              itemStyle={{ color: '#10b981' }}
              labelStyle={{ color: '#9ca3af', marginBottom: '4px', fontWeight: 'bold' }}
            />
            <Area 
              type="monotone" 
              dataKey="winRate" 
              stroke="#10b981" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorWinRate)" 
              name="Win Rate"
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
