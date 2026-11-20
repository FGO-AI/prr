import { useState, useMemo, useEffect } from "react";
import { ParlayRecommendation, BetLeg, League } from "../types";
import { compileAccuracyReport, calculateLegCLV, CategoryAccuracy } from "../services/accuracyEngine";
import {
  Trophy, ShieldCheck, Edit3, Check, DollarSign, RefreshCw,
  BarChart3, Clock, Zap, CheckCircle2, AlertTriangle, FileSearch, Layers, Activity
} from "lucide-react";

interface ModelAccuracyDashboardProps {
  userPickHistory: ParlayRecommendation[];
  onUpdateLegClosingLine: (pickId: string, playerName: string, statType: string, closingLine: number) => void;
}

interface ValidationMetricsSummary {
  sampleSize: number;
  brierScore: number;
  logLoss: number;
  accuracy: number;
  calibrationErrorECE: number;
  meanPredictedProb: number;
  empiricalBaseRate: number;
}

interface CalibrationBinUI {
  binLabel: string;
  rangeMin: number;
  rangeMax: number;
  count: number;
  meanPredictedProb: number;
  empiricalWinRate: number;
  stdError: number;
}

interface AblationUI {
  variant: string;
  brierScore: number;
  logLoss: number;
  accuracy: number;
  deltaBrierVsBaseline: number;
}

interface LeagueReportUI {
  runId: string;
  league: "NFL" | "NBA" | "MLB";
  createdUtc: string;
  modelVersion: string;
  baselineVersion: string;
  trainWindow: string;
  valWindow: string;
  testWindow: string;
  baselineMetrics: ValidationMetricsSummary;
  legacyMetrics: ValidationMetricsSummary;
  candidateMetrics: ValidationMetricsSummary;
  marketBaselineMetrics: ValidationMetricsSummary | null;
  calibrationBins: CalibrationBinUI[];
  ablations: AblationUI[];
  bettingEvaluation: {
    available: boolean;
    sampleSize: number;
    wins: number;
    losses: number;
    pushes: number;
    netUnits: number;
    roiPct: number | null;
    note: string;
  };
  historicalCoverageGaps: string[];
}

interface CoverageMatrixRow {
  factorId: string;
  category: "Shared" | "NFL" | "NBA" | "MLB" | "WeakSignal";
  name: string;
  dataSource: string;
  definition: string;
  units: string;
  timing: string;
  implementationLocation: string;
  status: "implemented_validated" | "implemented_unvalidated" | "experimental" | "unavailable" | "not_applicable" | "excluded";
  validationEvidence: string;
  remainingDependency: string;
}

interface FeatureRegistryRow {
  featureId: string;
  name: string;
  factorIds: string[];
  leagueApplicability: string[];
  definition: string;
  units: string;
  source: string;
  lookback: string;
  missingDataPolicy: string;
  kind: "observation" | "model_derived_estimate";
  version: string;
}

interface GovernancePayload {
  featureRegistryVersion: string;
  featureRegistry: FeatureRegistryRow[];
  coverageMatrix: CoverageMatrixRow[];
  monitoringEvents: Array<any>;
  recentOutcomes: Array<any>;
}

const MATRIX_STATUS_BADGE: Record<string, string> = {
  implemented_validated: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  implemented_unvalidated: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  experimental: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  unavailable: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  not_applicable: "bg-gray-800 text-gray-400 border-gray-700",
  excluded: "bg-gray-800 text-gray-500 border-gray-700"
};

export function ModelAccuracyDashboard({ userPickHistory, onUpdateLegClosingLine }: ModelAccuracyDashboardProps) {
  const [selectedSportTab, setSelectedSportTab] = useState<"ALL" | League>("ALL");
  const [editingLegKey, setEditingLegKey] = useState<string | null>(null);
  const [tempClosingLine, setTempClosingLine] = useState<string>("");

  // Quantitative Validation & Governance States
  const [validationReports, setValidationReports] = useState<LeagueReportUI[]>([]);
  const [governance, setGovernance] = useState<GovernancePayload | null>(null);
  const [activeReportLeague, setActiveReportLeague] = useState<"NFL" | "NBA" | "MLB">("NFL");
  const [matrixCategoryFilter, setMatrixCategoryFilter] = useState<string>("ALL");
  const [matrixStatusFilter, setMatrixStatusFilter] = useState<string>("ALL");
  const [matrixSearch, setMatrixSearch] = useState<string>("");
  const [isReconciling, setIsReconciling] = useState<boolean>(false);
  const [isRunningBacktest, setIsRunningBacktest] = useState<boolean>(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [activeGovTab, setActiveGovTab] = useState<"validation" | "matrix" | "registry" | "outcomes">("validation");

  const normalizeReportsPayload = (payload: any): LeagueReportUI[] => {
    if (Array.isArray(payload)) return payload.filter(Boolean);
    if (payload && typeof payload === "object") {
      return Object.values(payload).filter((v): v is LeagueReportUI => Boolean(v && typeof v === "object" && "league" in v));
    }
    return [];
  };

  const loadGovernanceAndValidation = async () => {
    try {
      const [valRes, govRes] = await Promise.all([
        fetch("/api/validation/reports"),
        fetch("/api/governance/registry")
      ]);
      if (valRes.ok) {
        const valJson = await valRes.json();
        setValidationReports(normalizeReportsPayload(valJson));
      }
      if (govRes.ok) {
        const govJson = await govRes.json();
        setGovernance(govJson);
      }
    } catch (e) {
      console.error("Failed loading governance/validation data:", e);
    }
  };

  useEffect(() => {
    loadGovernanceAndValidation();
  }, []);

  const handleReconcileOutcomes = async () => {
    setIsReconciling(true);
    setStatusNotice(null);
    try {
      const res = await fetch("/api/outcomes/reconcile", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setStatusNotice(`Reconciled ${data.settledCount} prediction versions across ${data.updatedGamesCount} fetched games.`);
        await loadGovernanceAndValidation();
      }
    } catch (e: any) {
      setStatusNotice(`Reconciliation error: ${e?.message || "unknown"}`);
    } finally {
      setIsReconciling(false);
    }
  };

  const handleRerunBacktests = async () => {
    setIsRunningBacktest(true);
    setStatusNotice(null);
    try {
      const res = await fetch("/api/validation/run", { method: "POST" });
      if (res.ok) {
        const reports = await res.json();
        setValidationReports(normalizeReportsPayload(reports));
        setStatusNotice("Chronological walk-forward backtests re-executed and persisted to SQLite.");
        await loadGovernanceAndValidation();
      }
    } catch (e: any) {
      setStatusNotice(`Backtest error: ${e?.message || "unknown"}`);
    } finally {
      setIsRunningBacktest(false);
    }
  };

  const activeReport = useMemo(() => {
    return validationReports.find(r => r.league === activeReportLeague) || validationReports[0] || null;
  }, [validationReports, activeReportLeague]);

  const filteredMatrix = useMemo(() => {
    if (!governance?.coverageMatrix) return [];
    const q = matrixSearch.trim().toLowerCase();
    return governance.coverageMatrix.filter(row => {
      if (matrixCategoryFilter !== "ALL" && row.category !== matrixCategoryFilter) return false;
      if (matrixStatusFilter !== "ALL" && row.status !== matrixStatusFilter) return false;
      if (q && !`${row.factorId} ${row.name} ${row.dataSource} ${row.definition}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [governance, matrixCategoryFilter, matrixStatusFilter, matrixSearch]);

  const matrixCounts = useMemo(() => {
    const counts: Record<string, number> = {
      total: 0,
      implemented_validated: 0,
      implemented_unvalidated: 0,
      experimental: 0,
      unavailable: 0,
      excluded: 0
    };
    (governance?.coverageMatrix || []).forEach(r => {
      counts.total++;
      counts[r.status] = (counts[r.status] || 0) + 1;
    });
    return counts;
  }, [governance]);

  // Existing User Pick History Extraction & Ledger Logic (preserved)
  const allHistoryLegs = useMemo(() => {
    const legsList: Array<{ pickId: string; pickTimestamp: string; leg: BetLeg }> = [];
    userPickHistory.forEach(pick => {
      pick.legs.forEach(leg => {
        if (leg.settledStatus === "Hit" || leg.settledStatus === "Miss") {
          legsList.push({
            pickId: pick.id,
            pickTimestamp: pick.timestamp,
            leg
          });
        }
      });
    });
    return legsList.sort((a, b) => new Date(b.pickTimestamp).getTime() - new Date(a.pickTimestamp).getTime());
  }, [userPickHistory]);

  const settledLegsOnly = useMemo(() => allHistoryLegs.map(item => item.leg), [allHistoryLegs]);
  const report = useMemo(() => compileAccuracyReport(settledLegsOnly), [settledLegsOnly]);

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

  const sportsToDisplay = selectedSportTab === "ALL" ? [League.NBA, League.NFL, League.MLB] : [selectedSportTab as League];
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
            <BarChart3 className="text-emerald-400" size={24} /> Quantitative Validation & Governance Audit
          </h2>
          <p className="text-xs text-gray-500 font-mono uppercase tracking-widest mt-1">
            Chronological Walk-Forward Calibration, Requirements Coverage Matrix & Pick Ledger
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleReconcileOutcomes}
            disabled={isReconciling}
            className="px-3 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-[10px] font-mono font-bold uppercase text-blue-300 flex items-center gap-1.5"
          >
            <RefreshCw size={12} className={isReconciling ? "animate-spin" : ""} />
            {isReconciling ? "Reconciling..." : "Reconcile Completed Games"}
          </button>
          <button
            type="button"
            onClick={handleRerunBacktests}
            disabled={isRunningBacktest}
            className="px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-[10px] font-mono font-bold uppercase text-emerald-300 flex items-center gap-1.5"
          >
            <Activity size={12} className={isRunningBacktest ? "animate-spin" : ""} />
            {isRunningBacktest ? "Running Backtest..." : "Re-Run Walk-Forward"}
          </button>
        </div>
      </div>

      {statusNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-200">
          {statusNotice}
        </div>
      )}

      {/* Engine Validation & Coverage Matrix Section */}
      <div className="bg-gray-950 border border-gray-900 rounded-2xl p-6 space-y-6 shadow-xl">
        {/* Sub-Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-900 pb-4">
          <div className="flex flex-wrap gap-2">
            {[
              { id: "validation", label: "Walk-Forward Holdout & Calibration", icon: ShieldCheck },
              { id: "matrix", label: `Requirements Matrix (${matrixCounts.total} Factors)`, icon: FileSearch },
              { id: "registry", label: `Feature Registry v${governance?.featureRegistryVersion || "2026.1.0"}`, icon: Layers },
              { id: "outcomes", label: "Live Settled Snapshots & Events", icon: Clock }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveGovTab(tab.id as any)}
                  className={`px-3.5 py-2 rounded-xl text-[10px] font-mono font-bold uppercase flex items-center gap-2 border transition-all ${
                    activeGovTab === tab.id
                      ? "bg-blue-500 text-gray-950 border-blue-400"
                      : "bg-gray-900 text-gray-400 border-gray-800 hover:text-white"
                  }`}
                >
                  <Icon size={13} /> {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* TAB 1: Walk-Forward Holdout Validation */}
        {activeGovTab === "validation" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex gap-2 bg-gray-900 p-1 rounded-xl border border-gray-800">
                {(["NFL", "NBA", "MLB"] as const).map(lg => (
                  <button
                    key={lg}
                    onClick={() => setActiveReportLeague(lg)}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-mono font-black uppercase ${
                      activeReportLeague === lg ? "bg-emerald-500 text-gray-950" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {lg} Holdout Report
                  </button>
                ))}
              </div>
              {activeReport && (
                <div className="text-[10px] font-mono text-gray-400">
                  Run: <b className="text-gray-200">{activeReport.runId}</b> • Model: <b className="text-blue-300">{activeReport.modelVersion}</b>
                </div>
              )}
            </div>

            {!activeReport ? (
              <div className="p-8 text-center text-xs font-mono text-gray-500 border border-dashed border-gray-800 rounded-xl">
                No persisted walk-forward reports found. Click &ldquo;Re-Run Walk-Forward&rdquo; above to execute evaluation runs.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[10px] font-mono">
                  <div className="p-3 bg-gray-900/60 border border-gray-800 rounded-xl">
                    <span className="text-gray-500 uppercase block">Train Split</span>
                    <span className="text-white font-bold mt-1 block">{activeReport.trainWindow}</span>
                  </div>
                  <div className="p-3 bg-gray-900/60 border border-gray-800 rounded-xl">
                    <span className="text-gray-500 uppercase block">Validation / Platt Fit Split</span>
                    <span className="text-white font-bold mt-1 block">{activeReport.valWindow}</span>
                  </div>
                  <div className="p-3 bg-gray-900/60 border border-gray-800 rounded-xl">
                    <span className="text-emerald-400 uppercase block font-bold">Untouched Test Holdout</span>
                    <span className="text-white font-bold mt-1 block">{activeReport.testWindow} (n={activeReport.candidateMetrics.sampleSize})</span>
                  </div>
                </div>

                {/* Comparison Table: Baseline vs Legacy Heuristic vs Candidate vs Market Baseline */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="border-b border-gray-800 text-[9.5px] uppercase text-gray-500">
                        <th className="py-2.5 px-3">Model / Benchmark (Untouched Test)</th>
                        <th className="py-2.5 px-3 text-right">n</th>
                        <th className="py-2.5 px-3 text-right">Brier ↓</th>
                        <th className="py-2.5 px-3 text-right">Log Loss ↓</th>
                        <th className="py-2.5 px-3 text-right">Accuracy ↑</th>
                        <th className="py-2.5 px-3 text-right">ECE ↓</th>
                        <th className="py-2.5 px-3 text-right">Empirical Home Win</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-900">
                      <tr className="bg-emerald-500/5">
                        <td className="py-3 px-3 font-bold text-emerald-300">Candidate ({activeReport.modelVersion})</td>
                        <td className="py-3 px-3 text-right text-gray-300">{activeReport.candidateMetrics.sampleSize}</td>
                        <td className="py-3 px-3 text-right font-black text-emerald-400">{activeReport.candidateMetrics.brierScore.toFixed(5)}</td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-300">{activeReport.candidateMetrics.logLoss.toFixed(5)}</td>
                        <td className="py-3 px-3 text-right text-white">{(activeReport.candidateMetrics.accuracy * 100).toFixed(1)}%</td>
                        <td className="py-3 px-3 text-right text-gray-200">{activeReport.candidateMetrics.calibrationErrorECE.toFixed(5)}</td>
                        <td className="py-3 px-3 text-right text-gray-400">{(activeReport.candidateMetrics.empiricalBaseRate * 100).toFixed(1)}%</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-3 text-gray-300">Simple Baseline ({activeReport.baselineVersion})</td>
                        <td className="py-3 px-3 text-right text-gray-400">{activeReport.baselineMetrics.sampleSize}</td>
                        <td className="py-3 px-3 text-right text-gray-200">{activeReport.baselineMetrics.brierScore.toFixed(5)}</td>
                        <td className="py-3 px-3 text-right text-gray-200">{activeReport.baselineMetrics.logLoss.toFixed(5)}</td>
                        <td className="py-3 px-3 text-right text-gray-300">{(activeReport.baselineMetrics.accuracy * 100).toFixed(1)}%</td>
                        <td className="py-3 px-3 text-right text-gray-400">{activeReport.baselineMetrics.calibrationErrorECE.toFixed(5)}</td>
                        <td className="py-3 px-3 text-right text-gray-400">{(activeReport.baselineMetrics.empiricalBaseRate * 100).toFixed(1)}%</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-3 text-gray-400">Legacy Heuristic Formula (Pre-Refactor)</td>
                        <td className="py-3 px-3 text-right text-gray-400">{activeReport.legacyMetrics.sampleSize}</td>
                        <td className="py-3 px-3 text-right text-gray-300">{activeReport.legacyMetrics.brierScore.toFixed(5)}</td>
                        <td className="py-3 px-3 text-right text-gray-300">{activeReport.legacyMetrics.logLoss.toFixed(5)}</td>
                        <td className="py-3 px-3 text-right text-gray-300">{(activeReport.legacyMetrics.accuracy * 100).toFixed(1)}%</td>
                        <td className="py-3 px-3 text-right text-gray-400">{activeReport.legacyMetrics.calibrationErrorECE.toFixed(5)}</td>
                        <td className="py-3 px-3 text-right text-gray-400">{(activeReport.legacyMetrics.empiricalBaseRate * 100).toFixed(1)}%</td>
                      </tr>
                      {activeReport.marketBaselineMetrics ? (
                        <tr>
                          <td className="py-3 px-3 text-amber-300">Market Closing Moneyline Benchmark</td>
                          <td className="py-3 px-3 text-right text-gray-400">{activeReport.marketBaselineMetrics.sampleSize}</td>
                          <td className="py-3 px-3 text-right text-amber-300">{activeReport.marketBaselineMetrics.brierScore.toFixed(5)}</td>
                          <td className="py-3 px-3 text-right text-amber-300">{activeReport.marketBaselineMetrics.logLoss.toFixed(5)}</td>
                          <td className="py-3 px-3 text-right text-amber-200">{(activeReport.marketBaselineMetrics.accuracy * 100).toFixed(1)}%</td>
                          <td className="py-3 px-3 text-right text-gray-400">{activeReport.marketBaselineMetrics.calibrationErrorECE.toFixed(5)}</td>
                          <td className="py-3 px-3 text-right text-gray-400">{(activeReport.marketBaselineMetrics.empiricalBaseRate * 100).toFixed(1)}%</td>
                        </tr>
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-2.5 px-3 text-gray-500 text-[10px]">
                            Market Baseline: Historical closing moneyline dataset unavailable for {activeReport.league} (reported honestly without fabrication).
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Calibration Reliability Bins + Ablation Impact + Betting Backtest */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="p-4 bg-gray-900/50 border border-gray-800 rounded-xl space-y-3">
                    <span className="text-[10px] font-mono font-bold uppercase text-gray-400 block">
                      Calibration Reliability Bins (with Binomial Standard Error)
                    </span>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[10px] font-mono text-left">
                        <thead>
                          <tr className="border-b border-gray-800 text-gray-500">
                            <th className="py-1.5">Pred Bin</th>
                            <th className="py-1.5 text-right">n</th>
                            <th className="py-1.5 text-right">Mean Pred</th>
                            <th className="py-1.5 text-right">Empirical Win</th>
                            <th className="py-1.5 text-right">Binomial SE</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-900">
                          {activeReport.calibrationBins.map((bin, idx) => (
                            <tr key={idx}>
                              <td className="py-1.5 text-gray-300">{bin.binLabel}</td>
                              <td className="py-1.5 text-right text-gray-400">{bin.count}</td>
                              <td className="py-1.5 text-right text-blue-300">{(bin.meanPredictedProb * 100).toFixed(1)}%</td>
                              <td className="py-1.5 text-right text-emerald-300 font-bold">{(bin.empiricalWinRate * 100).toFixed(1)}%</td>
                              <td className="py-1.5 text-right text-gray-500">±{(bin.stdError * 100).toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-gray-900/50 border border-gray-800 rounded-xl space-y-3">
                      <span className="text-[10px] font-mono font-bold uppercase text-gray-400 block">
                        Feature Group Ablation Studies
                      </span>
                      <div className="space-y-2 text-[10px] font-mono">
                        {activeReport.ablations.map((ab, idx) => (
                          <div key={idx} className="flex justify-between items-center p-2 bg-gray-950 rounded border border-gray-800">
                            <span className="text-gray-200">{ab.variant}</span>
                            <span className="text-right">
                              Brier {ab.brierScore.toFixed(5)}{" "}
                              <span className={ab.deltaBrierVsBaseline > 0 ? "text-emerald-400" : "text-amber-300"}>
                                ({ab.deltaBrierVsBaseline >= 0 ? "+" : ""}{ab.deltaBrierVsBaseline.toFixed(5)} vs full)
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 bg-gray-900/50 border border-gray-800 rounded-xl space-y-2 text-[10px] font-mono">
                      <span className="text-gray-400 font-bold uppercase block">Market EV Backtest Integrity</span>
                      {activeReport.bettingEvaluation.available ? (
                        <div className="text-gray-300 space-y-1">
                          <div>
                            Bets: <b>{activeReport.bettingEvaluation.sampleSize}</b> • Record:{" "}
                            <b>{activeReport.bettingEvaluation.wins}-{activeReport.bettingEvaluation.losses}-{activeReport.bettingEvaluation.pushes}</b> • Net:{" "}
                            <b className={activeReport.bettingEvaluation.netUnits >= 0 ? "text-emerald-400" : "text-rose-400"}>
                              {activeReport.bettingEvaluation.netUnits >= 0 ? "+" : ""}{activeReport.bettingEvaluation.netUnits}u ({activeReport.bettingEvaluation.roiPct}%)
                            </b>
                          </div>
                          <p className="text-gray-500 leading-snug">{activeReport.bettingEvaluation.note}</p>
                        </div>
                      ) : (
                        <p className="text-gray-400">{activeReport.bettingEvaluation.note}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Historical Coverage Gaps */}
                {activeReport.historicalCoverageGaps.length > 0 && (
                  <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-1.5 text-[10px] font-mono">
                    <span className="text-amber-300 font-bold uppercase flex items-center gap-1.5">
                      <AlertTriangle size={12} /> Documented Historical Dataset Limitations
                    </span>
                    {activeReport.historicalCoverageGaps.map((gap, i) => (
                      <div key={i} className="text-gray-300">• {gap}</div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* TAB 2: Requirements-to-Implementation Coverage Matrix (All 69 Factor IDs) */}
        {activeGovTab === "matrix" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-[10px] font-mono">
              <div className="p-2.5 bg-gray-900 rounded-lg border border-gray-800">
                <span className="text-gray-500 block">Total Factors</span>
                <b className="text-white text-sm">{matrixCounts.total}</b>
              </div>
              <div className="p-2.5 bg-emerald-500/10 rounded-lg border border-emerald-500/25">
                <span className="text-emerald-300 block">Validated</span>
                <b className="text-white text-sm">{matrixCounts.implemented_validated || 0}</b>
              </div>
              <div className="p-2.5 bg-amber-500/10 rounded-lg border border-amber-500/25">
                <span className="text-amber-300 block">Impl / Unvalidated</span>
                <b className="text-white text-sm">{matrixCounts.implemented_unvalidated || 0}</b>
              </div>
              <div className="p-2.5 bg-blue-500/10 rounded-lg border border-blue-500/25">
                <span className="text-blue-300 block">Experimental</span>
                <b className="text-white text-sm">{matrixCounts.experimental || 0}</b>
              </div>
              <div className="p-2.5 bg-rose-500/10 rounded-lg border border-rose-500/25">
                <span className="text-rose-300 block">Unavailable</span>
                <b className="text-white text-sm">{matrixCounts.unavailable || 0}</b>
              </div>
              <div className="p-2.5 bg-gray-900 rounded-lg border border-gray-800">
                <span className="text-gray-400 block">Excluded (Weak)</span>
                <b className="text-white text-sm">{matrixCounts.excluded || 0}</b>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="Search factor ID (e.g. U03, NFL02, W04)..."
                value={matrixSearch}
                onChange={(e) => setMatrixSearch(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 bg-gray-900 border border-gray-800 rounded-xl text-xs font-mono text-white outline-none focus:border-blue-500"
              />
              <select
                value={matrixCategoryFilter}
                onChange={(e) => setMatrixCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-xl text-xs font-mono text-gray-200 outline-none"
              >
                <option value="ALL">All Categories</option>
                <option value="Shared">Shared (U01–U16)</option>
                <option value="NFL">NFL (NFL01–NFL14)</option>
                <option value="NBA">NBA (NBA01–NBA15)</option>
                <option value="MLB">MLB (MLB01–MLB16)</option>
                <option value="WeakSignal">Weak Signals (W01–W08)</option>
              </select>
              <select
                value={matrixStatusFilter}
                onChange={(e) => setMatrixStatusFilter(e.target.value)}
                className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-xl text-xs font-mono text-gray-200 outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="implemented_validated">Implemented & Validated</option>
                <option value="implemented_unvalidated">Implemented (Unvalidated)</option>
                <option value="experimental">Experimental</option>
                <option value="unavailable">Unavailable</option>
                <option value="excluded">Intentionally Excluded</option>
              </select>
            </div>

            <div className="overflow-x-auto max-h-[520px] overflow-y-auto border border-gray-900 rounded-xl">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead className="bg-gray-900 sticky top-0 z-10 text-[9.5px] font-mono uppercase text-gray-400">
                  <tr>
                    <th className="py-2.5 px-3">ID</th>
                    <th className="py-2.5 px-3">Factor & Definition</th>
                    <th className="py-2.5 px-3">Source / Timing</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Validation Evidence & Dependency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-900">
                  {filteredMatrix.map(row => (
                    <tr key={row.factorId} className="hover:bg-gray-900/40">
                      <td className="py-2.5 px-3 font-mono font-black text-blue-300 whitespace-nowrap align-top">{row.factorId}</td>
                      <td className="py-2.5 px-3 align-top">
                        <div className="font-bold text-white">{row.name}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{row.definition} ({row.units})</div>
                        <div className="text-[9px] text-gray-500 font-mono mt-0.5">{row.implementationLocation}</div>
                      </td>
                      <td className="py-2.5 px-3 align-top text-[10px] font-mono text-gray-300">
                        <div>{row.dataSource}</div>
                        <div className="text-gray-500 mt-0.5">{row.timing}</div>
                      </td>
                      <td className="py-2.5 px-3 align-top whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${MATRIX_STATUS_BADGE[row.status] || ""}`}>
                          {row.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 align-top text-[10px] text-gray-300">
                        <div>{row.validationEvidence}</div>
                        <div className="text-amber-300/80 text-[9.5px] mt-0.5">Dep: {row.remainingDependency}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: Versioned Feature Registry */}
        {activeGovTab === "registry" && (
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto border border-gray-900 rounded-xl">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead className="bg-gray-900 sticky top-0 text-[9.5px] font-mono uppercase text-gray-400">
                <tr>
                  <th className="py-2.5 px-3">Feature ID</th>
                  <th className="py-2.5 px-3">Leagues</th>
                  <th className="py-2.5 px-3">Kind</th>
                  <th className="py-2.5 px-3">Definition & Source</th>
                  <th className="py-2.5 px-3">Missing Data Policy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-900">
                {(governance?.featureRegistry || []).map(f => (
                  <tr key={f.featureId}>
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-300 align-top">
                      {f.featureId}
                      <span className="block text-[9px] text-gray-500">{f.factorIds.join(", ")}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-gray-300 align-top">{f.leagueApplicability.join(", ")}</td>
                    <td className="py-2.5 px-3 font-mono align-top">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] border ${f.kind === "observation" ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" : "bg-blue-500/10 text-blue-300 border-blue-500/30"}`}>
                        {f.kind}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 align-top">
                      <div className="font-bold text-white">{f.name}</div>
                      <div className="text-[10px] text-gray-400">{f.definition}</div>
                      <div className="text-[9px] font-mono text-gray-500 mt-0.5">Source: {f.source} • Lookback: {f.lookback}</div>
                    </td>
                    <td className="py-2.5 px-3 text-[10px] text-gray-300 align-top">{f.missingDataPolicy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: Live Settled Prediction Outcomes & Monitoring Events */}
        {activeGovTab === "outcomes" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-4 bg-gray-900/40 border border-gray-800 rounded-xl space-y-3">
              <span className="text-[10px] font-mono font-bold uppercase text-gray-400 flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-400" /> Recently Reconciled Prediction Snapshots
              </span>
              {(governance?.recentOutcomes || []).length === 0 ? (
                <div className="text-[10px] font-mono text-gray-500">
                  No completed predictions settled yet. Generate predictions for active games, then click &ldquo;Reconcile Completed Games&rdquo; once games go final.
                </div>
              ) : (
                <div className="space-y-2 text-[10px] font-mono">
                  {governance!.recentOutcomes.map((o: any) => (
                    <div key={o.prediction_id} className="p-2.5 bg-gray-950 rounded border border-gray-800 flex justify-between">
                      <div>
                        <span className="text-white font-bold">{o.away_team_name} @ {o.home_team_name}</span>
                        <span className="block text-gray-500">v{o.version_num} • Winner: {o.winner} ({o.actual_away_score}-{o.actual_home_score})</span>
                      </div>
                      <div className="text-right">
                        <span className="text-emerald-300 block">Brier: {o.brier_score ?? "N/A"}</span>
                        <span className="text-gray-400">LogLoss: {o.log_loss ?? "N/A"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-900/40 border border-gray-800 rounded-xl space-y-3">
              <span className="text-[10px] font-mono font-bold uppercase text-gray-400">
                Data Freshness & Provider Monitoring Log
              </span>
              {(governance?.monitoringEvents || []).length === 0 ? (
                <div className="text-[10px] font-mono text-gray-500">No monitoring events logged yet.</div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto text-[10px] font-mono">
                  {governance!.monitoringEvents.map((ev: any) => (
                    <div key={ev.event_id} className="p-2 bg-gray-950 rounded border border-gray-800">
                      <div className="flex justify-between text-gray-400">
                        <span className={ev.severity === "error" ? "text-rose-400" : ev.severity === "warn" ? "text-amber-300" : "text-blue-300"}>
                          [{ev.severity.toUpperCase()}] {ev.source} • {ev.event_type}
                        </span>
                        <span>{new Date(ev.created_utc).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-gray-300 mt-1">{ev.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Preserved User Pick History Calibration & Closing Line Ledger */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-950 p-5 rounded-2xl border border-gray-900">
        <div>
          <h3 className="text-base font-bold text-white uppercase tracking-wider">User Tracked Prop Pick Accuracy & CLV Ledger</h3>
          <p className="text-[10px] text-gray-500 font-mono uppercase mt-1">Settled Legs from Parlay History</p>
        </div>
        <div className="flex bg-gray-900 border border-gray-800 p-1 rounded-xl text-[10px] uppercase font-mono font-bold">
          <button
            onClick={() => setSelectedSportTab("ALL")}
            className={`px-3 py-1 rounded-lg ${selectedSportTab === "ALL" ? "bg-emerald-500 text-gray-950 font-black" : "text-gray-400"}`}
          >
            All Sports
          </button>
          <button
            onClick={() => setSelectedSportTab(League.NBA)}
            className={`px-3 py-1 rounded-lg ${selectedSportTab === League.NBA ? "bg-emerald-500 text-gray-950 font-black" : "text-gray-400"}`}
          >
            NBA
          </button>
          <button
            onClick={() => setSelectedSportTab(League.NFL)}
            className={`px-3 py-1 rounded-lg ${selectedSportTab === League.NFL ? "bg-emerald-500 text-gray-950 font-black" : "text-gray-400"}`}
          >
            NFL
          </button>
          <button
            onClick={() => setSelectedSportTab(League.MLB)}
            className={`px-3 py-1 rounded-lg ${selectedSportTab === League.MLB ? "bg-emerald-500 text-gray-950 font-black" : "text-gray-400"}`}
          >
            MLB
          </button>
        </div>
      </div>

      {totalSettledPicks === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-850 rounded-2xl bg-gray-950/40 flex flex-col items-center">
          <Trophy size={36} className="text-gray-800 mb-3" />
          <h3 className="text-gray-400 font-black text-xs tracking-[0.2em] uppercase">No User Prop Legs Settled Yet</h3>
          <p className="text-[10px] text-gray-600 font-mono max-w-md mt-2 uppercase leading-relaxed">
            Your settled prop picks will appear here alongside CLV tracking once you settle legs under History.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-gradient-to-b from-gray-950 to-gray-900 border border-gray-850 p-6 rounded-2xl flex flex-col justify-between shadow-lg">
              <div className="space-y-4">
                <span className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-widest block">User Pick Scorecard</span>
                <div className="flex items-center gap-5">
                  <div className={`w-20 h-20 rounded-2xl border flex items-center justify-center font-mono font-black text-3xl ${getGradeColor(report.overall.rating)}`}>
                    {report.overall.rating}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Pick Hit-Rate Grade</h3>
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

            <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-950/70 border border-gray-850/80 p-5 rounded-2xl flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[8.5px] font-mono text-gray-400 uppercase font-bold">Hit Rate</span>
                    <ShieldCheck className="text-emerald-400" size={16} />
                  </div>
                  <div className="text-3xl font-mono font-extrabold text-white">{report.overall.hitRate.toFixed(1)}%</div>
                </div>
              </div>
              <div className="bg-gray-950/70 border border-gray-850/80 p-5 rounded-2xl flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[8.5px] font-mono text-gray-400 uppercase font-bold">Average CLV</span>
                    <Clock className="text-blue-400" size={16} />
                  </div>
                  <div className={`text-3xl font-mono font-extrabold ${report.overall.avgClv >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {report.overall.avgClv >= 0 ? "+" : ""}{report.overall.avgClv.toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="bg-gray-950/70 border border-gray-850/80 p-5 rounded-2xl flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[8.5px] font-mono text-gray-400 uppercase font-bold">Flat Stake ROI</span>
                    <DollarSign className="text-amber-500" size={16} />
                  </div>
                  <div className={`text-3xl font-mono font-extrabold ${report.overall.roi >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {report.overall.roi >= 0 ? "+" : ""}{report.overall.roi.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {sportsToDisplay.map(sportKey => {
              const spData = report.bySport[sportKey];
              if (spData.total === 0) return null;
              return (
                <div key={sportKey} className="bg-gray-950/95 border border-gray-850 rounded-2xl p-5 space-y-4">
                  <div className="flex justify-between items-center border-b border-gray-850 pb-3">
                    <span className="font-mono text-white font-extrabold text-sm">{sportKey} ({spData.total} legs)</span>
                    <span className="text-[9px] font-mono font-bold text-emerald-400">{spData.hitRate.toFixed(1)}% Wins</span>
                  </div>
                  <div className="space-y-2">
                    {Object.values(spData.categories).map((cat: CategoryAccuracy) => (
                      <div key={cat.category} className="p-2.5 bg-gray-900 border border-gray-850 rounded-xl text-[10px] font-mono flex justify-between">
                        <span className="text-white">{cat.category} ({cat.total})</span>
                        <span className="text-emerald-400">{cat.hitRate.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-gray-950 border border-gray-900 p-6 rounded-2xl shadow-xl space-y-6">
            <h3 className="font-bold text-white text-base uppercase flex items-center gap-2 border-b border-gray-900 pb-4">
              <Edit3 className="text-blue-400" size={16} /> Market Closing Lines Ledger
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-900 text-[9px] font-mono uppercase tracking-widest text-gray-500">
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
                      <tr key={`${pickId}-${leg.playerName}-${leg.statType}`}>
                        <td className="py-4 px-4">
                          <div className="font-bold">{leg.playerName}</div>
                          <div className="text-[9px] text-gray-500 uppercase font-mono">{leg.league || League.NBA} • {new Date(pickTimestamp).toLocaleDateString()}</div>
                        </td>
                        <td className="py-4 px-4 font-mono">{leg.prediction} {leg.line} {leg.statType}</td>
                        <td className="py-4 px-4 font-mono">{leg.settledStatus}</td>
                        <td className="py-4 px-4 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-2">
                              <input
                                type="number"
                                step="0.5"
                                value={tempClosingLine}
                                onChange={(e) => setTempClosingLine(e.target.value)}
                                className="w-16 px-1.5 py-1 bg-gray-900 border border-gray-850 rounded text-center text-xs font-mono text-white"
                                autoFocus
                              />
                              <button onClick={() => handleSaveClosingLine(pickId, leg)} className="p-1 bg-emerald-500 text-gray-950 rounded">
                                <Check size={12} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <span className="font-mono">{leg.closingLine !== undefined ? leg.closingLine : "—"}</span>
                              <button onClick={() => handleStartEdit(pickId, leg)} className="p-1 text-gray-500 hover:text-white">
                                <Edit3 size={12} />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right font-mono font-bold">
                          {customClv !== null ? `${customClv > 0 ? "+" : ""}${customClv.toFixed(1)}` : "Pending"}
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
