import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "initial_canonical_schema",
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_utc TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS games (
        game_id TEXT PRIMARY KEY,
        league TEXT NOT NULL,
        season INTEGER NOT NULL,
        competition_phase TEXT NOT NULL,
        home_team_id TEXT NOT NULL,
        away_team_id TEXT NOT NULL,
        home_team_name TEXT NOT NULL,
        away_team_name TEXT NOT NULL,
        home_team_abbr TEXT NOT NULL,
        away_team_abbr TEXT NOT NULL,
        venue_id TEXT NOT NULL,
        venue_name TEXT NOT NULL,
        venue_timezone TEXT NOT NULL,
        scheduled_start_utc TEXT NOT NULL,
        neutral_site INTEGER NOT NULL DEFAULT 0,
        doubleheader_game_num INTEGER,
        status TEXT NOT NULL,
        home_score INTEGER,
        away_score INTEGER,
        went_overtime INTEGER NOT NULL DEFAULT 0,
        overtime_periods INTEGER NOT NULL DEFAULT 0,
        is_tie INTEGER NOT NULL DEFAULT 0,
        rescheduled_from_utc TEXT,
        provider_ids_json TEXT NOT NULL,
        created_utc TEXT NOT NULL,
        updated_utc TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_games_league_start ON games (league, scheduled_start_utc);

      CREATE TABLE IF NOT EXISTS provider_mappings (
        provider TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        canonical_id TEXT NOT NULL,
        raw_name TEXT,
        updated_utc TEXT NOT NULL,
        PRIMARY KEY (provider, entity_type, provider_id)
      );

      CREATE TABLE IF NOT EXISTS input_snapshots (
        snapshot_id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        league TEXT NOT NULL,
        cutoff_utc TEXT NOT NULL,
        source TEXT NOT NULL,
        source_published_utc TEXT,
        event_time_utc TEXT NOT NULL,
        ingested_utc TEXT NOT NULL,
        earliest_known_utc TEXT NOT NULL,
        status TEXT NOT NULL,
        input_hash TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_snapshots_game_cutoff ON input_snapshots (game_id, cutoff_utc);

      CREATE TABLE IF NOT EXISTS weather_forecasts (
        forecast_id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        venue_id TEXT NOT NULL,
        source TEXT NOT NULL,
        issued_utc TEXT NOT NULL,
        valid_utc TEXT NOT NULL,
        ingested_utc TEXT NOT NULL,
        temp_f REAL,
        wind_mph REAL,
        wind_gust_mph REAL,
        wind_dir_deg REAL,
        precip_prob REAL,
        precip_in REAL,
        roof_status TEXT NOT NULL,
        surface TEXT NOT NULL,
        altitude_ft REAL NOT NULL,
        air_density_index REAL,
        delay_risk_score REAL,
        status TEXT NOT NULL,
        short_forecast TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_weather_game_issued ON weather_forecasts (game_id, issued_utc);

      CREATE TABLE IF NOT EXISTS odds_snapshots (
        odds_id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        league TEXT NOT NULL,
        sportsbook TEXT NOT NULL,
        market_type TEXT NOT NULL,
        period TEXT NOT NULL,
        line REAL,
        home_price_american REAL,
        away_price_american REAL,
        draw_price_american REAL,
        over_price_american REAL,
        under_price_american REAL,
        home_decimal REAL,
        away_decimal REAL,
        settlement_rules_version TEXT NOT NULL,
        captured_utc TEXT NOT NULL,
        source TEXT NOT NULL,
        is_user_supplied INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_odds_game_captured ON odds_snapshots (game_id, captured_utc);

      CREATE TABLE IF NOT EXISTS prediction_versions (
        prediction_id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        league TEXT NOT NULL,
        version_num INTEGER NOT NULL,
        cutoff_utc TEXT NOT NULL,
        created_utc TEXT NOT NULL,
        feature_registry_version TEXT NOT NULL,
        model_version TEXT NOT NULL,
        calibration_version TEXT NOT NULL,
        rules_version TEXT NOT NULL,
        snapshot_id TEXT NOT NULL,
        odds_id TEXT,
        forecast_id TEXT,
        forecast_status TEXT NOT NULL,
        is_market_informed INTEGER NOT NULL DEFAULT 0,
        home_win_prob REAL NOT NULL,
        away_win_prob REAL NOT NULL,
        tie_prob REAL NOT NULL DEFAULT 0,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_pred_game_ver ON prediction_versions (game_id, version_num DESC);

      CREATE TABLE IF NOT EXISTS prediction_outcomes (
        prediction_id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        league TEXT NOT NULL,
        settled_utc TEXT NOT NULL,
        actual_home_score INTEGER,
        actual_away_score INTEGER,
        winner TEXT NOT NULL,
        went_overtime INTEGER NOT NULL DEFAULT 0,
        brier_score REAL,
        log_loss REAL,
        spread_result TEXT,
        total_result TEXT,
        ml_ev_realized REAL
      );

      CREATE TABLE IF NOT EXISTS evaluation_runs (
        run_id TEXT PRIMARY KEY,
        league TEXT NOT NULL,
        created_utc TEXT NOT NULL,
        model_version TEXT NOT NULL,
        baseline_version TEXT NOT NULL,
        train_window TEXT NOT NULL,
        val_window TEXT NOT NULL,
        test_window TEXT NOT NULL,
        metrics_json TEXT NOT NULL,
        ablation_json TEXT NOT NULL,
        calibration_bins_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS monitoring_events (
        event_id TEXT PRIMARY KEY,
        created_utc TEXT NOT NULL,
        severity TEXT NOT NULL,
        source TEXT NOT NULL,
        league TEXT,
        event_type TEXT NOT NULL,
        message TEXT NOT NULL,
        details_json TEXT
      );
    `
  }
];

let sharedDb: DatabaseSync | null = null;

export function createDatabase(dbPath?: string): DatabaseSync {
  const resolvedPath = dbPath || process.env.ENGINE_DB_PATH || path.join(process.cwd(), "data", "engine.db");
  if (resolvedPath !== ":memory:") {
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  const db = new DatabaseSync(resolvedPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  return db;
}

export function getDb(): DatabaseSync {
  if (!sharedDb) {
    sharedDb = createDatabase();
  }
  return sharedDb;
}

export function runMigrations(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_utc TEXT NOT NULL
    );
  `);

  const applied = new Set<number>();
  const rows = db.prepare("SELECT version FROM schema_migrations").all() as Array<{ version: number }>;
  for (const r of rows) applied.add(r.version);

  for (const mig of MIGRATIONS) {
    if (!applied.has(mig.version)) {
      db.exec(mig.sql);
      db.prepare("INSERT INTO schema_migrations (version, name, applied_utc) VALUES (?, ?, ?)")
        .run(mig.version, mig.name, new Date().toISOString());
    }
  }
}

export function stableHash(obj: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(obj)).digest("hex").slice(0, 16);
}

export function logMonitoringEvent(
  db: DatabaseSync,
  params: {
    severity: "info" | "warn" | "error";
    source: string;
    league?: string | null;
    eventType: string;
    message: string;
    details?: unknown;
  }
) {
  try {
    const id = `mon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    db.prepare(
      `INSERT INTO monitoring_events (event_id, created_utc, severity, source, league, event_type, message, details_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      new Date().toISOString(),
      params.severity,
      params.source,
      params.league || null,
      params.eventType,
      params.message,
      params.details ? JSON.stringify(params.details) : null
    );
  } catch {
    // Non-blocking monitor logging
  }
}
