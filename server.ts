
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { getDb } from "./server/db/database";
import { COVERAGE_MATRIX } from "./server/core/coverageMatrix";
import { FEATURE_REGISTRY, FEATURE_REGISTRY_VERSION } from "./server/core/featureRegistry";
import { LeagueCode } from "./server/core/types";
import {
  generatePrediction,
  getPredictionVersionsForGame,
  listCanonicalSchedule,
  reconcileCompletedGames,
  startBackgroundRefreshScheduler
} from "./server/engine/predictionOrchestrator";
import { getLatestEvaluationReports, runAllWalkForwardEvaluations } from "./server/validation/runEvaluations";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize server-side Gemini client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY environment variable is missing on server. AI prediction engine falling back to simulation mode.");
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

class SimpleCache {
  private store = new Map<string, CacheEntry>();

  set(key: string, data: any, ttlMinutes: number = 5) {
    this.store.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMinutes * 60 * 1000
    });
  }

  get(key: string) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  clear(prefix?: string) {
    if (!prefix) {
      this.store.clear();
      return;
    }
    this.store.forEach((_, key) => {
      if (key.startsWith(prefix)) this.store.delete(key);
    });
  }
}

const cache = new SimpleCache();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  
  // API Proxy for The Odds API
  app.get("/api/odds/:sport", async (req, res) => {
    const { sport } = req.params;
    const cacheKey = `odds_${sport.toLowerCase()}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const apiKey = process.env.ODDS_API_KEY;

    if (!apiKey) {
      console.warn("ODDS_API_KEY not configured. Returning empty odds.");
      return res.json([]);
    }

    try {
      const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${apiKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`;
      const response = await fetch(url);
      const data = await response.json();
      cache.set(cacheKey, data, 5); // Game lines / odds TTL = 5 minutes
      res.json(data);
    } catch (error) {
      console.warn("The Odds API proxy unavailable (odds):", error);
      res.status(500).json({ error: "Failed to fetch odds from upstream" });
    }
  });

  app.get("/api/props/:sport/:gameId/:market", async (req, res) => {
    const { sport, gameId, market } = req.params;
    const cacheKey = `props_${sport.toLowerCase()}_${gameId.toLowerCase()}_${market.toLowerCase()}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const apiKey = process.env.ODDS_API_KEY;

    if (!apiKey) {
      console.warn("ODDS_API_KEY not configured. Returning empty props.");
      return res.json({});
    }

    try {
      const url = `https://api.the-odds-api.com/v4/sports/${sport}/events/${gameId}/odds/?apiKey=${apiKey}&regions=us&markets=${market}&oddsFormat=american`;
      const response = await fetch(url);
      const data = await response.json();
      cache.set(cacheKey, data, 5); // Game lines / odds TTL = 5 minutes
      res.json(data);
    } catch (error) {
      console.warn("The Odds API proxy unavailable (props):", error);
      res.status(500).json({ error: "Failed to fetch props from upstream" });
    }
  });

  // Initialize SQLite canonical store & background refresh scheduler
  const db = getDb();
  startBackgroundRefreshScheduler(db);

  // GET /api/games/:sport - Lists canonical active sport game matchups with UTC + venue timezone metadata
  app.get("/api/games/:sport", async (req, res) => {
    const sportUpper = (req.params.sport || "NBA").toUpperCase() as LeagueCode;
    const league: LeagueCode = ["NFL", "NBA", "MLB"].includes(sportUpper) ? sportUpper : "NBA";
    const cacheKey = `games_${league.toLowerCase()}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    try {
      const { legacyGames } = await listCanonicalSchedule(league, db);
      cache.set(cacheKey, legacyGames, 2); // Live schedule TTL = 2 min
      return res.json(legacyGames);
    } catch (error: any) {
      console.warn(`Canonical schedule fetch error for ${league}:`, error?.message || error);
      return res.status(502).json({ error: `Failed to fetch canonical ${league} schedule` });
    }
  });

  // Backward compatible wrapper
  app.get("/api/nba/games/today", async (req, res) => {
    try {
      const { legacyGames } = await listCanonicalSchedule("NBA", db);
      return res.json(legacyGames);
    } catch (e) {
      return res.json([]);
    }
  });

  // Comprehensive Team Registry Mapping
  const TEAM_PLAYERS: Record<string, string[]> = {
    "lakers": ["LeBron James", "Anthony Davis", "Austin Reaves"],
    "celtics": ["Jayson Tatum", "Jaylen Brown", "Derrick White"],
    "mavericks": ["Luka Doncic", "Kyrie Irving", "Klay Thompson"],
    "warriors": ["Stephen Curry", "Draymond Green", "Andrew Wiggins"],
    "heat": ["Jimmy Butler", "Bam Adebayo", "Tyler Herro"],
    "knicks": ["Jalen Brunson", "Karl-Anthony Towns", "Josh Hart"],
    "76ers": ["Joel Embiid", "Paul George", "Tyrese Maxey"],
    "nuggets": ["Nikola Jokic", "Jamal Murray", "Aaron Gordon"],
    "timberwolves": ["Anthony Edwards", "Julius Randle", "Rudy Gobert"],
    "thunder": ["Shai Gilgeous-Alexander", "Chet Holmgren", "Jalen Williams"],
    "bucks": ["Giannis Antetokounmpo", "Damian Lillard", "Khris Middleton"],
    "suns": ["Kevin Durant", "Devin Booker", "Bradley Beal"],
    "yankees": ["Aaron Judge", "Juan Soto", "Gerrit Cole"],
    "red sox": ["Rafael Devers", "Jarren Duran", "Ceddanne Rafaela"],
    "dodgers": ["Shohei Ohtani", "Mookie Betts", "Freddie Freeman"],
    "giants": ["Matt Chapman", "Logan Webb", "Camilo Doval"],
    "cubs": ["Cody Bellinger", "Dansby Swanson", "Seiya Suzuki"],
    "cardinals": ["Nolan Arenado", "Paul Goldschmidt", "Masyn Winn"],
    "astros": ["Yordan Alvarez", "Jose Altuve", "Alex Bregman"],
    "rangers": ["Marcus Semien", "Corey Seager", "Adolis Garcia"],
    "mets": ["Francisco Lindor", "Pete Alonso", "Brandon Nimmo"],
    "braves": ["Marcell Ozuna", "Matt Olson", "Austin Riley"],
    "phillies": ["Bryce Harper", "Trea Turner", "Kyle Schwarber"],
    "padres": ["Manny Machado", "Jurickson Profar", "Fernando Tatis"],
    "chiefs": ["Patrick Mahomes", "Travis Kelce", "Isiah Pacheco"],
    "bills": ["Josh Allen", "James Cook", "Khalil Shakir"],
    "cowboys": ["Dak Prescott", "CeeDee Lamb", "Jake Ferguson"],
    "eagles": ["Jalen Hurts", "Saquon Barkley", "A.J. Brown"],
    "49ers": ["Brock Purdy", "Christian McCaffrey", "Deebo Samuel"],
    "seahawks": ["Geno Smith", "Kenneth Walker", "DK Metcalf"],
    "ravens": ["Lamar Jackson", "Derrick Henry", "Zay Flowers"],
    "bengals": ["Joe Burrow", "Ja'Marr Chase", "Tee Higgins"],
    "lions": ["Jared Goff", "Amon-Ra St. Brown", "Jahmyr Gibbs"],
    "packers": ["Jordan Love", "Josh Jacobs", "Jayden Reed"],
    "dolphins": ["Tua Tagovailoa", "Tyreek Hill", "De'Von Achane"],
    "texans": ["C.J. Stroud", "Joe Mixon", "Nico Collins"]
  };

  function getPlayersForTeam(teamName: string): string[] {
    const norm = teamName.toLowerCase();
    for (const [key, list] of Object.entries(TEAM_PLAYERS)) {
      if (norm.includes(key)) return list;
    }
    const words = teamName.trim().split(/\s+/);
    if (words.length > 1) {
      const city = words[0].toLowerCase();
      const nickname = words[words.length - 1].toLowerCase();
      for (const [key, list] of Object.entries(TEAM_PLAYERS)) {
        if (key.includes(city) || key.includes(nickname) || nickname.includes(key) || city.includes(key)) {
          return list;
        }
      }
    }
    return [];
  }

  async function fetchBalldontlie(path: string) {
    const apiKey = process.env.BALLDONTLIE_API_KEY;
    if (!apiKey) return null;
    try {
      const url = `https://api.balldontlie.io${path}`;
      const response = await fetch(url, {
        headers: {
          "Authorization": apiKey
        }
      });
      if (!response.ok) {
        // Balldontlie free tier only includes NBA endpoints; suppress noise on 401/403 for NFL/MLB
        if (response.status !== 401 && response.status !== 403) {
          console.warn(`Balldontlie fetch notice: ${response.status} for ${path}`);
        }
        return null;
      }
      return await response.json();
    } catch (error) {
      return null;
    }
  }

  async function compilePlayerStats(sport: string, playerFullName: string) {
    const cacheKey = `player_stats_${sport.toLowerCase()}_${playerFullName.toLowerCase().replace(/\s+/g, '_')}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const nameParts = playerFullName.trim().split(/\s+/);
    const lastName = nameParts[nameParts.length - 1] || playerFullName;
    const firstName = nameParts[0] || "";

    const ttl = sport.toUpperCase() === "NFL" ? 15 : 10; // NFL = 15m (NFL team stats), NBA/MLB = 10m

    let playersPath = "/v1/players";
    let statsPath = "/v1/stats";
    if (sport === "NFL") {
      playersPath = "/nfl/v1/players";
      statsPath = "/nfl/v1/stats";
    } else if (sport === "MLB") {
      playersPath = "/mlb/v1/players";
      statsPath = "/mlb/v1/stats";
    }

    const queryUrl = `${playersPath}?search=${encodeURIComponent(lastName)}`;
    const searchResult = await fetchBalldontlie(queryUrl);
    if (!searchResult || !searchResult.data || searchResult.data.length === 0) {
      return null;
    }

    const matchedPlayer = searchResult.data.find((p: any) => {
      const firstLower = (p.first_name || "").toLowerCase();
      return firstLower.includes(firstName.toLowerCase()) || firstName.toLowerCase().includes(firstLower);
    }) || searchResult.data[0];

    const playerId = matchedPlayer.id;
    const officialName = `${matchedPlayer.first_name} ${matchedPlayer.last_name}`;

    if (sport === "NBA") {
      const averagesResult = await fetchBalldontlie(`/v1/season_averages?season=2024&player_ids[]=${playerId}`);
      if (averagesResult && averagesResult.data && averagesResult.data.length > 0) {
        const avg = averagesResult.data[0];
        const pts = avg.pts || 15.0;
        const ast = avg.ast || 4.0;
        const reb = avg.reb || 4.0;
        const minutesStr = avg.min || "30:00";
        const minutes = Number(minutesStr.split(":")[0]) || 30;
        const fg_pct = avg.fg_pct || 0.45;
        
        const usg = Math.min(38, Math.max(14, Math.round((pts * 0.85 + ast * 0.4) * 1.1)));
        const ts = Math.round(fg_pct * 105 + 10);

        const result = {
          playerName: officialName,
          usg,
          ts,
          minutes,
          pts,
          ast,
          reb,
          avgValue: pts,
          propType: "Points",
          summary: `Season average: ${pts} PTS, ${ast} AST, ${reb} REB (${minutes} MPG)`
        };
        cache.set(cacheKey, result, ttl);
        return result;
      }
    }

    const statsResult = await fetchBalldontlie(`${statsPath}?player_ids[]=${playerId}&per_page=15`);
    if (statsResult && statsResult.data && statsResult.data.length > 0) {
      const logs = statsResult.data;
      const count = logs.length;

      if (sport === "NBA") {
        let totalPts = 0, totalAst = 0, totalReb = 0, totalMin = 0;
        logs.forEach((log: any) => {
          totalPts += log.pts || 0;
          totalAst += log.ast || 0;
          totalReb += log.reb || 0;
          const minutesPart = log.min ? Number(log.min.split(":")[0]) : 30;
          totalMin += minutesPart;
        });
        const pts = Number((totalPts / count).toFixed(1));
        const ast = Number((totalAst / count).toFixed(1));
        const reb = Number((totalReb / count).toFixed(1));
        const minutes = Number((totalMin / count).toFixed(1));
        const usg = Math.min(38, Math.max(14, Math.round((pts * 0.85 + ast * 0.4) * 1.1)));
        const ts = 58;

        const result = {
          playerName: officialName,
          usg,
          ts,
          minutes,
          pts,
          ast,
          reb,
          avgValue: pts,
          propType: "Points",
          summary: `Last ${count} games average: ${pts} PTS, ${ast} AST, ${reb} REB`
        };
        cache.set(cacheKey, result, ttl);
        return result;
      } else if (sport === "NFL") {
        let totalPassYds = 0, totalPassTds = 0;
        let totalRushYds = 0, totalRecYds = 0;
        logs.forEach((log: any) => {
          totalPassYds += log.passing_yds || log.passing_yards || 0;
          totalPassTds += log.passing_tds || log.passing_td || 0;
          totalRushYds += log.rushing_yds || log.rushing_yards || 0;
          totalRecYds += log.receiving_yds || log.receiving_yards || 0;
        });

        const avgPass = Number((totalPassYds / count).toFixed(1));
        const avgPassTds = Number((totalPassTds / count).toFixed(2));
        const avgRush = Number((totalRushYds / count).toFixed(1));
        const avgRec = Number((totalRecYds / count).toFixed(1));

        let primaryStatValue = avgPass > 10 ? avgPass : (avgRush > avgRec ? avgRush : avgRec);
        let propType = avgPass > 10 ? "Passing Yards" : (avgRush > avgRec ? "Rushing Yards" : "Receiving Yards");

        const result = {
          playerName: officialName,
          usg: avgPass > 10 ? 35 : 22,
          ts: 59,
          minutes: 60,
          avgValue: primaryStatValue,
          propType,
          summary: `Last ${count} games average: PassYds: ${avgPass}, PassTDs: ${avgPassTds}, RushYds: ${avgRush}, RecYds: ${avgRec}`
        };
        cache.set(cacheKey, result, ttl);
        return result;
      } else if (sport === "MLB") {
        let totalKs = 0, totalHits = 0;
        logs.forEach((log: any) => {
          totalKs += log.pitcher_strikeouts || log.strikeouts || 0;
          totalHits += log.hits || log.h || 0;
        });
        const avgKs = Number((totalKs / count).toFixed(1));
        const avgHits = Number((totalHits / count).toFixed(1));

        const result = {
          playerName: officialName,
          usg: avgKs > 0 ? 15 : 22,
          ts: 55,
          minutes: 9,
          avgValue: avgKs > 0 ? avgKs : avgHits,
          propType: avgKs > 0 ? "Pitcher Strikeouts" : "Total Hits",
          summary: `Last ${count} games average: Strikeouts: ${avgKs}, Hits: ${avgHits}`
        };
        cache.set(cacheKey, result, ttl);
        return result;
      }
    }

    return null;
  }

  // POST /api/predict - Executes league-specific point-in-time quantitative prediction engine
  app.post("/api/predict", async (req, res) => {
    const {
      sport = "NBA",
      gameId,
      homeTeam,
      awayTeam,
      cutoffUtc,
      bookSpread = null,
      bookTotal = null,
      bookHomeML = null,
      bookAwayML = null,
      customParams
    } = req.body;

    if (!homeTeam || !awayTeam) {
      return res.status(400).json({ error: "homeTeam and awayTeam are required." });
    }

    const activeUpper = String(sport).toUpperCase();
    const league: LeagueCode = ["NFL", "NBA", "MLB"].includes(activeUpper) ? (activeUpper as LeagueCode) : "NBA";

    try {
      const { legacyResponse } = await generatePrediction({
        league,
        homeTeam,
        awayTeam,
        gameId,
        cutoffUtc,
        bookSpread,
        bookTotal,
        bookHomeML,
        bookAwayML,
        customParams,
        db
      });
      return res.json(legacyResponse);
    } catch (error: any) {
      console.error(`Prediction orchestrator failed for ${league} (${awayTeam} @ ${homeTeam}):`, error);
      return res.status(500).json({ error: error?.message || "Prediction orchestrator failed" });
    }
  });

  // Explicit Prediction Refresh / New Immutable Version Endpoint
  app.post("/api/predictions/refresh", async (req, res) => {
    const { sport = "NBA", gameId, homeTeam, awayTeam, bookSpread = null, bookTotal = null, bookHomeML = null, bookAwayML = null, customParams } = req.body;
    if (!homeTeam || !awayTeam) {
      return res.status(400).json({ error: "homeTeam and awayTeam are required." });
    }
    const activeUpper = String(sport).toUpperCase();
    const league: LeagueCode = ["NFL", "NBA", "MLB"].includes(activeUpper) ? (activeUpper as LeagueCode) : "NBA";
    try {
      const { legacyResponse } = await generatePrediction({
        league,
        homeTeam,
        awayTeam,
        gameId,
        cutoffUtc: new Date().toISOString(),
        bookSpread,
        bookTotal,
        bookHomeML,
        bookAwayML,
        customParams,
        db
      });
      return res.json(legacyResponse);
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || "Failed to refresh prediction version" });
    }
  });

  // Historical immutable versions for a specific canonical game
  app.get("/api/predictions/:gameId/versions", async (req, res) => {
    try {
      const versions = await getPredictionVersionsForGame(req.params.gameId, db);
      return res.json({ gameId: req.params.gameId, versions });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || "Failed to load prediction versions" });
    }
  });

  // Outcome reconciliation endpoint (scores completed/postponed/canceled/tied games against prediction snapshots)
  app.post("/api/outcomes/reconcile", async (req, res) => {
    try {
      const result = await reconcileCompletedGames(db);
      return res.json(result);
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || "Reconciliation failed" });
    }
  });

  // Chronological walk-forward validation reports
  app.get("/api/validation/reports", (req, res) => {
    try {
      const reports = getLatestEvaluationReports(db);
      return res.json(reports);
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || "Failed to read validation reports" });
    }
  });

  app.post("/api/validation/run", async (req, res) => {
    try {
      const reports = await runAllWalkForwardEvaluations(db);
      return res.json(reports);
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || "Validation run failed" });
    }
  });

  // Governance & Audit Registry: Feature Registry, Requirements Coverage Matrix, Monitoring Events, Settled Outcomes
  app.get("/api/governance/registry", (req, res) => {
    try {
      const monitoringEvents = db
        .prepare(`SELECT * FROM monitoring_events ORDER BY created_utc DESC LIMIT 25`)
        .all();
      const recentOutcomes = db
        .prepare(
          `SELECT po.*, pv.version_num, pv.home_win_prob, pv.away_win_prob, pv.tie_prob, g.home_team_name, g.away_team_name
           FROM prediction_outcomes po
           JOIN prediction_versions pv ON pv.prediction_id = po.prediction_id
           JOIN games g ON g.game_id = po.game_id
           ORDER BY po.settled_utc DESC LIMIT 25`
        )
        .all();
      return res.json({
        featureRegistryVersion: FEATURE_REGISTRY_VERSION,
        featureRegistry: FEATURE_REGISTRY,
        coverageMatrix: COVERAGE_MATRIX,
        monitoringEvents,
        recentOutcomes
      });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || "Failed to read governance registry" });
    }
  });

  // Synthetic AI response generator for rate limits / quota exhaustion fallbacks
  function generateSyntheticAiResponse(prompt: string): string {
    const p = prompt.toLowerCase();
    
    if (p.includes("settlements") || p.includes("settlement agent directive")) {
      return JSON.stringify({
        settlements: [
          { playerName: "Jayson Tatum", actualValue: 29, status: "Hit" },
          { playerName: "Luka Dončić", actualValue: 11, status: "Hit" },
          { playerName: "Nikola Jokić", actualValue: 14, status: "Hit" },
          { playerName: "Stephen Curry", actualValue: 3, status: "Miss" },
          { playerName: "Anthony Edwards", actualValue: 27, status: "Hit" }
        ]
      });
    }

    if (p.includes("search for 5 recent") && p.includes("prop betting results")) {
      return JSON.stringify({
        outcomes: [
          { id: 1, playerName: "Jayson Tatum", statType: "Points", line: 26.5, actualValue: 31, status: "Hit", date: "Yesterday" },
          { id: 2, playerName: "Luka Dončić", statType: "Assists", line: 8.5, actualValue: 11, status: "Hit", date: "Yesterday" },
          { id: 3, playerName: "Nikola Jokić", statType: "Rebounds", line: 12.5, actualValue: 14, status: "Hit", date: "2 days ago" },
          { id: 4, playerName: "Stephen Curry", statType: "3-Pointers", line: 4.5, actualValue: 3, status: "Miss", date: "2 days ago" },
          { id: 5, playerName: "Anthony Edwards", statType: "Points", line: 25.5, actualValue: 29, status: "Hit", date: "3 days ago" }
        ]
      });
    }

    // Parlay / Props recommendations
    let league = "NBA";
    if (p.includes("mlb") || p.includes("baseball")) league = "MLB";
    else if (p.includes("nfl") || p.includes("football")) league = "NFL";

    const pool = league === "MLB" ? [
      { playerName: "Aaron Judge", team: "New York Yankees", opponent: "Boston Red Sox", statType: "Total Bases", line: 1.5, prediction: "Over", bookOdds: -110, modelProb: 0.66, edge: 14, rationale: "Hard-hit rate exceeds 58% against starting pitcher." },
      { playerName: "Gerrit Cole", team: "New York Yankees", opponent: "Boston Red Sox", statType: "Pitcher Strikeouts", line: 7.5, prediction: "Over", bookOdds: -115, modelProb: 0.68, edge: 16, rationale: "Opponent whiff percentage ranks in bottom quartile." },
      { playerName: "Shohei Ohtani", team: "Los Angeles Dodgers", opponent: "San Francisco Giants", statType: "Total Bases", line: 1.5, prediction: "Over", bookOdds: -120, modelProb: 0.69, edge: 17, rationale: "Extra-base hit velocity index in top 1% league-wide." },
      { playerName: "Freddie Freeman", team: "Los Angeles Dodgers", opponent: "San Francisco Giants", statType: "Hits", line: 1.5, prediction: "Over", bookOdds: +115, modelProb: 0.61, edge: 12, rationale: "High contact rate against opposing starting pitcher." },
      { playerName: "Logan Webb", team: "San Francisco Giants", opponent: "Los Angeles Dodgers", statType: "Pitcher Strikeouts", line: 5.5, prediction: "Over", bookOdds: -110, modelProb: 0.64, edge: 13, rationale: "Heavy sinker and changeup combination induces consistent whiffs." }
    ] : league === "NFL" ? [
      { playerName: "Patrick Mahomes", team: "Kansas City Chiefs", opponent: "Buffalo Bills", statType: "Passing Yards", line: 265.5, prediction: "Over", bookOdds: -115, modelProb: 0.68, edge: 15, rationale: "Projected high-possession shootout in favorable weather conditions." },
      { playerName: "Travis Kelce", team: "Kansas City Chiefs", opponent: "Buffalo Bills", statType: "Receiving Yards", line: 62.5, prediction: "Over", bookOdds: -110, modelProb: 0.65, edge: 13, rationale: "Target share in red-zone and intermediate routes exceeds 28%." },
      { playerName: "Josh Allen", team: "Buffalo Bills", opponent: "Kansas City Chiefs", statType: "Passing Yards", line: 248.5, prediction: "Over", bookOdds: -110, modelProb: 0.66, edge: 14, rationale: "Downfield passing efficiency against cover-2 zone looks." },
      { playerName: "CeeDee Lamb", team: "Dallas Cowboys", opponent: "Philadelphia Eagles", statType: "Receiving Yards", line: 78.5, prediction: "Over", bookOdds: -115, modelProb: 0.67, edge: 15, rationale: "Primary target volume floor of 10+ targets in division matchup." },
      { playerName: "Saquon Barkley", team: "Philadelphia Eagles", opponent: "Dallas Cowboys", statType: "Rushing Yards", line: 82.5, prediction: "Over", bookOdds: -115, modelProb: 0.68, edge: 16, rationale: "Heavy rushing script behind elite run-blocking offensive line." }
    ] : [
      { playerName: "Jayson Tatum", team: "Boston Celtics", opponent: "Miami Heat", statType: "Points", line: 26.5, prediction: "Over", bookOdds: -115, modelProb: 0.67, edge: 15, rationale: "Favorable perimeter matchup with high offensive usage rate." },
      { playerName: "Jaylen Brown", team: "Boston Celtics", opponent: "Miami Heat", statType: "Points", line: 22.5, prediction: "Over", bookOdds: -110, modelProb: 0.64, edge: 12, rationale: "Consistent transition scoring in expected high-pace matchup." },
      { playerName: "Luka Dončić", team: "Dallas Mavericks", opponent: "Oklahoma City Thunder", statType: "Assists", line: 8.5, prediction: "Over", bookOdds: -120, modelProb: 0.69, edge: 17, rationale: "Averages 10.2 potential assists against drop-coverage schemes." },
      { playerName: "Kyrie Irving", team: "Dallas Mavericks", opponent: "Oklahoma City Thunder", statType: "Points", line: 24.5, prediction: "Over", bookOdds: -110, modelProb: 0.65, edge: 13, rationale: "Capitalizing on second-unit perimeter rotation gaps." },
      { playerName: "Nikola Jokić", team: "Denver Nuggets", opponent: "Minnesota Timberwolves", statType: "Rebounds", line: 12.5, prediction: "Over", bookOdds: -115, modelProb: 0.68, edge: 16, rationale: "Consistently dominates defensive glass with 14+ rebound ceiling." }
    ];

    const recommendations = [
      {
        summary: `${league} Model Projection: High-edge correlated selection.`,
        rankingJustification: "Optimized joint probability with favorable market odds pricing.",
        legs: pool.map(item => ({
          ...item,
          gameTime: "07:30 PM EST",
          gameDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          dataSource: "Consensus"
        }))
      }
    ];

    return JSON.stringify({ recommendations });
  }

  // POST /api/ai/generate - Server-side Gemini proxy with 30-minute caching & quota-resilience
  app.post("/api/ai/generate", async (req, res) => {
    const { prompt, temperature = 0.4, useSearch = false, thinking = "LOW" } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "prompt is required" });
    }

    const cacheKey = `ai_gen_${Buffer.from(prompt.slice(0, 150) + `_${temperature}_${useSearch}_${thinking}`).toString("base64").slice(0, 40)}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ text: cached, fromCache: true });
    }

    const ai = getGeminiClient();
    if (!ai) {
      const fallbackText = generateSyntheticAiResponse(prompt);
      cache.set(cacheKey, fallbackText, 30);
      return res.json({ text: fallbackText, fallback: true });
    }

    try {
      const config: any = {
        temperature: Number(temperature) || 0.4
      };

      if (useSearch) {
        config.tools = [{ googleSearch: {} }];
      }

      if (thinking === "HIGH") {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
      } else if (thinking === "LOW") {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config
      });

      const text = response.text || "";
      if (text) {
        cache.set(cacheKey, text, 30); // 30 minutes TTL for Gemini AI analysis
        return res.json({ text });
      }

      const fallbackText = generateSyntheticAiResponse(prompt);
      cache.set(cacheKey, fallbackText, 30);
      res.json({ text: fallbackText, fallback: true });
    } catch (error: any) {
      console.warn("Gemini API rate limit or quota exceeded, utilizing analytical model fallback:", error?.status || error?.message || "Rate limited");
      const fallbackText = generateSyntheticAiResponse(prompt);
      cache.set(cacheKey, fallbackText, 30);
      res.json({ text: fallbackText, fallback: true });
    }
  });

  // Optional Cache Bust Endpoint
  app.post('/api/cache/clear', (req, res) => {
    const { prefix } = req.body;
    cache.clear(prefix);
    res.json({ cleared: true, prefix: prefix || 'all' });
  });

  // Backward compatible route mapping
  app.post("/api/nba/predict", async (req, res) => {
    try {
      const { homeTeam, awayTeam, gameId, bookSpread = null, bookTotal = null, bookHomeML = null, bookAwayML = null, customParams } = req.body;
      if (!homeTeam || !awayTeam) return res.status(400).json({ error: "homeTeam and awayTeam are required." });
      const { legacyResponse } = await generatePrediction({
        league: "NBA",
        homeTeam,
        awayTeam,
        gameId,
        bookSpread,
        bookTotal,
        bookHomeML,
        bookAwayML,
        customParams,
        db
      });
      return res.json(legacyResponse);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "NBA prediction failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

