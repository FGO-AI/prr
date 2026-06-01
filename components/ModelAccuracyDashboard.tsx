import { useState, useMemo } from "react";
import { ParlayRecommendation, BetLeg, League } from "../types";
import { compileAccuracyReport, calculateLegCLV, SportAccuracy, CategoryAccuracy } from "../services/accuracyEngine";
import { 
  Trophy, TrendingUp, AlignLeft, ShieldCheck, HelpCircle, 
  Edit3, Check, DollarSign, Calendar, AlertCircle, RefreshCw,
  Award, BarChart3, Clock, Zap
} from "lucide-react";

interface ModelAccuracyDashboardProps {
  userPickHistory: ParlayRecommendation[];
  onUpdateLegClosingLine: (pickId: string, playerName: string, statType: string, closingLine: number) => void;
}

export function ModelAccuracyDashboard({ userPickHistory, onUpdateLegClosingLine }: ModelAccuracyDashboardProps) {
  const [selectedSportTab, setSelectedSportTab] = useState<"ALL" | League>("ALL");
  const [editingLegKey, setEditingLegKey] = useState<string | null>(null);
  const [tempClosingLine, setTempClosingLine] = useState<string>("");

  // Extract all legs from the parlay history that have been either settled as Hit or Miss
  const allHistoryLegs = useMemo(() => {
    const legsList: Array<{ pickId: string; pickTimestamp: string; leg: BetLeg }> = [];
    userPickHistory.forEach(pick => {
      pick.legs.forEach(leg => {
        // Collect legs that have settlement results
        if (leg.settledStatus === "Hit" || leg.settledStatus === "Miss") {
          legsList.push({
            pickId: pick.id,
            pickTimestamp: pick.timestamp,
            leg
          });
        }
      });
    });
    // Sort recent first
    return legsList.sort((a, b) => new Date(b.pickTimestamp).getTime() - new Date(a.pickTimestamp).getTime());
  }, [userPickHistory]);

  const settledLegsOnly = useMemo(() => {
    return allHistoryLegs.map(item => item.leg);
  }, [allHistoryLegs]);

  // Compile full mathematical accuracy metrics
  const report = useMemo(() => {
    return compileAccuracyReport(settledLegsOnly);
  }, [settledLegsOnly]);

  const handleStartEdit = (pickId: string, leg: BetLeg) => {
    setEditingLegKey(`${pickId}-${leg.playerName}-${leg.statType}`);
    setTempClosingLine(leg.closingLine !== undefined ? leg.closingLine.toString() : "");
  };

  const handleSaveClosingLine = (pickId: string, leg: BetLeg) => {
    const parsed = parseFloat(tempClosingLine);
    if (!isNaN(parsed) && parsed >= 0) {
      onUpdateLegClosingLine(pickId, leg.playerName, leg.statType, parsed);
    }
    setEditingLegKey(null);
  };

  // Filter breakdown items
  const sportsToDisplay = selectedSportTab === "ALL" 
    ? [League.NBA, League.NFL, League.MLB] 
    : [selectedSportTab as League];

  const totalSettledPicks = report.overall.total;

  const getGradeColor = (grade: string) => {
    if (grade.startsWith("A")) return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
    if (grade.startsWith("B")) return "text-blue-400 border-blue-500/30 bg-blue-500/10";
    if (grade.startsWith("C")) return "text-amber-400 border-amber-500/30 bg-amber-500/10";
    if (grade.startsWith("D")) return "text-orange-400 border-orange-500/30 bg-orange-500/10";
    return "text-rose-400 border-rose-500/30 bg-rose-500/10";
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Block */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-950 p-6 rounded-2xl border border-gray-900 shadow-xl">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight uppercase flex items-center gap-3">
            <BarChart3 className="text-emerald-400 animate-pulse" size={24} /> Model Calibration Audit
          </h2>
          <p className="text-xs text-gray-500 font-mono uppercase tracking-widest mt-1">
            Analyzing Predictive Accuracy, Closing Line Value, and ROI
          </p>
        </div>
        <div className="flex bg-gray-900 border border-gray-800 p-1.5 rounded-xl text-[10px] uppercase font-mono font-bold">
          <button
            onClick={() => setSelectedSportTab("ALL")}
            className={`px-3 py-1.5 rounded-lg transition-all ${selectedSportTab === "ALL" ? "bg-emerald-500 text-gray-950 font-black" : "text-gray-400 hover:text-white"}`}
          >
            All Sports
          </button>
          <button
            onClick={() => setSelectedSportTab(League.NBA)}
            className={`px-3 py-1.5 rounded-lg transition-all ${selectedSportTab === League.NBA ? "bg-emerald-500 text-gray-950 font-black" : "text-gray-400 hover:text-white"}`}
          >
            NBA
          </button>
          <button
            onClick={() => setSelectedSportTab(League.NFL)}
            className={`px-3 py-1.5 rounded-lg transition-all ${selectedSportTab === League.NFL ? "bg-emerald-500 text-gray-950 font-black" : "text-gray-400 hover:text-white"}`}
          >
            NFL
          </button>
          <button
            onClick={() => setSelectedSportTab(League.MLB)}
            className={`px-3 py-1.5 rounded-lg transition-all ${selectedSportTab === League.MLB ? "bg-emerald-500 text-gray-950 font-black" : "text-gray-400 hover:text-white"}`}
          >
            MLB
          </button>
        </div>
      </div>

      {totalSettledPicks === 0 ? (
        <div className="text-center py-24 border border-dashed border-gray-850 rounded-2xl bg-gray-950/40 flex flex-col items-center">
          <Trophy size={48} className="text-gray-800 mb-5 animate-bounce" />
          <h3 className="text-gray-400 font-black text-sm tracking-[0.2em] uppercase">No Calibration Assets Resolved</h3>
          <p className="text-[10px] text-gray-600 font-mono max-w-md mt-3 uppercase leading-relaxed">
            Calibration metrics require settled outcomes. Return to the Acquisition tab, generate high-probability projections, lock them down, then settle picks under the history terminal!
          </p>
        </div>
      ) : (
        <>
          {/* Main Scoring Card Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Big Grade Card - 4 cols */}
            <div className="lg:col-span-5 bg-gradient-to-b from-gray-950 to-gray-900 border border-gray-850 p-6 rounded-2xl flex flex-col justify-between shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-all"></div>
              
              <div className="space-y-4">
                <span className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-widest block">Model Score card</span>
                <div className="flex items-center gap-5">
                  <div className={`w-20 h-20 rounded-2xl border flex items-center justify-center font-mono font-black text-3xl shadow-lg ${getGradeColor(report.overall.rating)}`}>
                    {report.overall.rating}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Calibration Grade</h3>
                    <p className="text-[10px] text-gray-500 font-mono mt-1.5 uppercase leading-relaxed">
                      {report.overall.description}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-850/60 mt-6 pt-5 grid grid-cols-2 gap-4">
                <div className="bg-gray-950/60 p-3 rounded-xl border border-gray-850">
                  <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest block font-mono">Total Monitored</span>
                  <span className="text-lg font-mono font-black text-white block mt-1">{report.overall.total} legs</span>
                </div>
                <div className="bg-gray-950/60 p-3 rounded-xl border border-gray-850">
                  <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest block font-mono">Win/Loss Split</span>
                  <span className="text-lg font-mono font-black text-emerald-400 block mt-1">
                    {report.overall.hits} - <span className="text-rose-400">{report.overall.misses}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Premium Metrics Grid - 7 cols */}
            <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Hit Rate Card */}
              <div className="bg-gray-950/70 border border-gray-850/80 p-5 rounded-2xl flex flex-col justify-between shadow-md">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[8.5px] font-mono text-gray-400 uppercase tracking-widest font-bold">Model Hit Rate</span>
                    <ShieldCheck className="text-emerald-400" size={16} />
                  </div>
                  <div className="text-3xl font-mono font-extrabold text-white">
                    {report.overall.hitRate.toFixed(1)}%
                  </div>
                  <p className="text-[9px] text-gray-500 font-mono mt-2.5 uppercase leading-relaxed">
                    Actual settled winning percentage against sportsbook thresholds.
                  </p>
                </div>
                <div className="h-1.5 bg-gray-900 rounded-full overflow-hidden mt-4">
                  <div 
                    className="h-full bg-emerald-400 transition-all duration-1000"
                    style={{ width: `${report.overall.hitRate}%` }}
                  ></div>
                </div>
              </div>

              {/* CLV Card */}
              <div className="bg-gray-950/70 border border-gray-850/80 p-5 rounded-2xl flex flex-col justify-between shadow-md">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[8.5px] font-mono text-gray-400 uppercase tracking-widest font-bold">Average CLV</span>
                    <Clock className="text-blue-400" size={16} />
                  </div>
                  <div className={`text-3xl font-mono font-extrabold ${report.overall.avgClv >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {report.overall.avgClv >= 0 ? "+" : ""}{report.overall.avgClv.toFixed(2)}
                  </div>
                  <p className="text-[9px] text-gray-500 font-mono mt-2.5 uppercase leading-relaxed">
                    Closing Line Value. Captures line movement and beat-the-market margin edge.
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-[8px] font-mono text-gray-400 bg-gray-900 px-2 py-1 rounded border border-gray-800">
                  <span className="text-emerald-400 font-bold">Unlocks:</span> {report.overall.clvCount} Checked Lines
                </div>
              </div>

              {/* ROI Card */}
              <div className="bg-gray-950/70 border border-gray-850/80 p-5 rounded-2xl flex flex-col justify-between shadow-md">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[8.5px] font-mono text-gray-400 uppercase tracking-widest font-bold">Flat Stake ROI</span>
                    <DollarSign className="text-amber-500" size={16} />
                  </div>
                  <div className={`text-3xl font-mono font-extrabold ${report.overall.roi >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {report.overall.roi >= 0 ? "+" : ""}{report.overall.roi.toFixed(1)}%
                  </div>
                  <p className="text-[9px] text-gray-500 font-mono mt-2.5 uppercase leading-relaxed">
                    Expected returns auditing continuous $100 wagers flat at standard -110 odds.
                  </p>
                </div>
                <div className="mt-4 text-[8px] font-mono text-gray-400 bg-gray-900 px-2:py-1 p-1 py-1.5 rounded border border-gray-800 text-center uppercase tracking-widest">
                  Break-even benchmark: <b className="text-white">52.38%</b>
                </div>
              </div>

            </div>
          </div>

          {/* Grids for Detailed sport breakdowns */}
          <div className="space-y-6">
            <h3 className="text-xs font-mono font-extrabold text-white uppercase tracking-widest flex items-center gap-2">
              <Zap size={14} className="text-emerald-400" /> League & Stat-Specific Performance
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {sportsToDisplay.map(sportKey => {
                const spData = report.bySport[sportKey];
                if (spData.total === 0) return null;

                return (
                  <div key={sportKey} className="bg-gray-950/95 border border-gray-850 rounded-2xl overflow-hidden shadow-lg p-5 space-y-4">
                    <div className="flex justify-between items-center border-b border-gray-850 pb-3">
                      <div>
                        <span className="font-mono text-white font-extrabold text-sm">{sportKey} Stats Summary</span>
                        <span className="text-[9px] font-mono text-gray-500 uppercase block mt-1">{spData.total} resolved legs</span>
                      </div>
                      <span className="text-[9px] font-mono font-bold bg-gray-900 px-2 py-1 rounded text-emerald-400 border border-gray-800">
                        {spData.hitRate.toFixed(1)}% Wins
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="bg-gray-900/40 p-2.5 rounded-xl border border-gray-850">
                        <span className="text-[8px] text-gray-500 font-mono font-bold block uppercase">AVG CLV</span>
                        <span className={`text-sm font-mono font-semibold block mt-1 ${spData.avgClv >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {spData.avgClv >= 0 ? "+" : ""}{spData.avgClv.toFixed(2)}
                        </span>
                      </div>
                      <div className="bg-gray-900/40 p-2.5 rounded-xl border border-gray-850">
                        <span className="text-[8px] text-gray-500 font-mono font-bold block uppercase">Est. ROI</span>
                        <span className={`text-sm font-mono font-semibold block mt-1 ${spData.roi >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {spData.roi >= 0 ? "+" : ""}{spData.roi.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Props Specific Listings */}
                    <div className="space-y-3.5 mt-2">
                      <span className="text-[8.5px] font-mono font-bold text-gray-500 uppercase tracking-wider block">Prop breakdown details</span>
                      {Object.values(spData.categories).map((cat: CategoryAccuracy) => (
                        <div key={cat.category} className="p-3 bg-gray-900 border border-gray-850 rounded-xl space-y-2 hover:border-gray-800 transition-colors">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold text-white uppercase">{cat.category}</span>
                            <span className="text-[10px] font-mono font-bold text-emerald-400">{cat.hitRate.toFixed(1)}% wr</span>
                          </div>
                          
                          <div className="flex justify-between items-center text-[9px] text-gray-500 font-mono">
                            <span>Legs: <b>{cat.total}</b></span>
                            <span className={cat.avgClv >= 0 ? "text-emerald-400" : "text-rose-400"}>
                              CLV: <b>{cat.avgClv >= 0 ? "+" : ""}{cat.avgClv.toFixed(1)}</b>
                            </span>
                          </div>

                          <div className="h-1 bg-gray-950 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-400"
                              style={{ width: `${cat.hitRate}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Table Ledger and Input Form Section */}
          <div className="bg-gray-950 border border-gray-900 p-6 rounded-2xl shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-900 pb-4">
              <div>
                <h3 className="font-bold text-white text-base uppercase flex items-center gap-2">
                  <Edit3 className="text-blue-400" size={16} /> Market Closing Lines Ledger
                </h3>
                <p className="text-[10px] text-gray-500 font-mono uppercase mt-1">
                  Manually update the final sportsbook threshold prior to launch to compute model CLV edge
                </p>
              </div>
            </div>

            {/* List of Legs */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-900 text-[9px] font-mono uppercase tracking-widest text-gray-500 pb-3">
                    <th className="py-3 px-4">Player / Event</th>
                    <th className="py-3 px-4">Locked Target</th>
                    <th className="py-3 px-4">Settle Status</th>
                    <th className="py-3 px-4 text-center">Closing Market Line</th>
                    <th className="py-3 px-4 text-right">Computed CLV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-900 text-xs text-white">
                  {allHistoryLegs.map(({ pickId, pickTimestamp, leg }) => {
                    const isEditing = editingLegKey === `${pickId}-${leg.playerName}-${leg.statType}`;
                    const customClv = calculateLegCLV(leg);

                    return (
                      <tr key={`${pickId}-${leg.playerName}-${leg.statType}`} className="hover:bg-gray-900/30 transition-colors">
                        <td className="py-4 px-4">
                          <div className="font-bold">{leg.playerName}</div>
                          <div className="text-[9px] text-gray-500 uppercase font-mono mt-1">
                            {leg.league || League.NBA} • {new Date(pickTimestamp).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="py-4 px-4 font-mono font-medium">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold mr-1.5 ${leg.prediction.toLowerCase() === "over" ? "bg-emerald-500/10 text-emerald-400" : "bg-blue-500/10 text-blue-400"}`}>
                            {leg.prediction}
                          </span> 
                          {leg.line} {leg.statType}
                        </td>
                        <td className="py-4 px-4 font-mono">
                          <span className={`px-2 py-0.5 rounded-[5px] text-[9.5px] font-black uppercase ${leg.settledStatus === "Hit" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/10" : "bg-rose-500/15 text-rose-400 border border-rose-500/10"}`}>
                            {leg.settledStatus === "Hit" ? "HIT" : "MISS"}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-2">
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                value={tempClosingLine}
                                onChange={(e) => setTempClosingLine(e.target.value)}
                                className="w-16 px-1.5 py-1 bg-gray-900 border border-gray-850 rounded text-center text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveClosingLine(pickId, leg)}
                                className="p-1 px-1.5 bg-emerald-500 hover:bg-emerald-600 text-gray-950 font-bold rounded flex items-center justify-center gap-1"
                              >
                                <Check size={12} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <span className="font-mono font-bold text-gray-300">
                                {leg.closingLine !== undefined ? leg.closingLine : "—"}
                              </span>
                              <button
                                onClick={() => handleStartEdit(pickId, leg)}
                                className="p-1 text-gray-500 hover:text-white hover:bg-gray-900 rounded transition-colors"
                                title="Update Closing Line"
                              >
                                <Edit3 size={12} />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right font-mono font-bold">
                          {customClv !== null ? (
                            <span className={customClv > 0 ? "text-emerald-400" : customClv < 0 ? "text-rose-400" : "text-gray-400"}>
                              {customClv > 0 ? "+" : ""}{customClv.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-600 uppercase font-mono tracking-wider font-normal">
                              Pending Line Input
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
