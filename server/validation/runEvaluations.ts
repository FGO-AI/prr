import { DatabaseSync } from "node:sqlite";
import { getDb } from "../db/database";
import { LeagueCode } from "../core/types";
import {
  LeagueEvaluationReport,
  runMlbWalkForwardEvaluation,
  runNbaWalkForwardEvaluation,
  runNflWalkForwardEvaluation
} from "./walkForwardEval";

export async function runAllWalkForwardEvaluations(db?: DatabaseSync): Promise<Record<LeagueCode, LeagueEvaluationReport>> {
  const database = db || getDb();
  const [nfl, nba, mlb] = await Promise.all([
    runNflWalkForwardEvaluation(database),
    runNbaWalkForwardEvaluation(database),
    runMlbWalkForwardEvaluation(database)
  ]);
  return { NFL: nfl, NBA: nba, MLB: mlb };
}

export function getLatestEvaluationReports(db?: DatabaseSync): Record<string, LeagueEvaluationReport | null> {
  const database = db || getDb();
  const leagues: LeagueCode[] = ["NFL", "NBA", "MLB"];
  const out: Record<string, LeagueEvaluationReport | null> = { NFL: null, NBA: null, MLB: null };

  for (const league of leagues) {
    const row = database
      .prepare(`SELECT * FROM evaluation_runs WHERE league = ? ORDER BY created_utc DESC LIMIT 1`)
      .get(league) as any;
    if (row) {
      const m = JSON.parse(row.metrics_json);
      out[league] = {
        runId: row.run_id,
        league: row.league,
        createdUtc: row.created_utc,
        modelVersion: row.model_version,
        baselineVersion: row.baseline_version,
        trainWindow: row.train_window,
        valWindow: row.val_window,
        testWindow: row.test_window,
        baselineMetrics: m.baseline,
        legacyMetrics: m.legacy,
        candidateMetrics: m.candidate,
        marketBaselineMetrics: m.market ?? null,
        calibrationBins: JSON.parse(row.calibration_bins_json),
        ablations: JSON.parse(row.ablation_json),
        learnedParams: m.learnedParams,
        bettingEvaluation: m.bettingEvaluation,
        historicalCoverageGaps: m.historicalCoverageGaps || []
      };
    }
  }
  return out;
}

// CLI execution entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("Running chronological walk-forward validations across NFL, NBA, and MLB...");
  runAllWalkForwardEvaluations()
    .then(reports => {
      for (const [league, rep] of Object.entries(reports)) {
        console.log(`\n=== ${league} (${rep.modelVersion}) ===`);
        console.log(`Train: ${rep.trainWindow} | Val: ${rep.valWindow} | Test: ${rep.testWindow}`);
        console.log(`Baseline  -> Brier: ${rep.baselineMetrics.brierScore}, LogLoss: ${rep.baselineMetrics.logLoss}, Acc: ${(rep.baselineMetrics.accuracy * 100).toFixed(1)}%`);
        console.log(`Legacy    -> Brier: ${rep.legacyMetrics.brierScore}, LogLoss: ${rep.legacyMetrics.logLoss}, Acc: ${(rep.legacyMetrics.accuracy * 100).toFixed(1)}%`);
        console.log(`Candidate -> Brier: ${rep.candidateMetrics.brierScore}, LogLoss: ${rep.candidateMetrics.logLoss}, Acc: ${(rep.candidateMetrics.accuracy * 100).toFixed(1)}%, ECE: ${rep.candidateMetrics.calibrationErrorECE}`);
        if (rep.marketBaselineMetrics) {
          console.log(`Market    -> Brier: ${rep.marketBaselineMetrics.brierScore}, LogLoss: ${rep.marketBaselineMetrics.logLoss}, Acc: ${(rep.marketBaselineMetrics.accuracy * 100).toFixed(1)}%`);
        }
        console.log(`Betting   ->`, rep.bettingEvaluation);
        console.log(`Ablations ->`, rep.ablations.map(a => `${a.variant}: Brier=${a.brierScore} (delta=${a.deltaBrierVsBaseline})`));
      }
      process.exit(0);
    })
    .catch(err => {
      console.error("Evaluation failed:", err);
      process.exit(1);
    });
}
