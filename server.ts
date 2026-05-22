
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";

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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  
  // API Proxy for The Odds API
  app.get("/api/odds/:sport", async (req, res) => {
    const { sport } = req.params;
    const apiKey = process.env.ODDS_API_KEY;

    if (!apiKey) {
      console.warn("ODDS_API_KEY not configured. Returning empty odds.");
      return res.json([]);
    }

    try {
      const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${apiKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`;
      const response = await fetch(url);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Proxy error (odds):", error);
      res.status(500).json({ error: "Failed to fetch odds from upstream" });
    }
  });

  app.get("/api/props/:sport/:gameId/:market", async (req, res) => {
    const { sport, gameId, market } = req.params;
    const apiKey = process.env.ODDS_API_KEY;

    if (!apiKey) {
      console.warn("ODDS_API_KEY not configured. Returning empty props.");
      return res.json({});
    }

    try {
      const url = `https://api.the-odds-api.com/v4/sports/${sport}/events/${gameId}/odds/?apiKey=${apiKey}&regions=us&markets=${market}&oddsFormat=american`;
      const response = await fetch(url);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Proxy error (props):", error);
      res.status(500).json({ error: "Failed to fetch props from upstream" });
    }
  });

  // GET /api/nba/games/today - Lists active NBA game matchups
  app.get("/api/nba/games/today", async (req, res) => {
    const ai = getGeminiClient();
    
    // Curated fallback matchups in case the API key is not present or query fails
    // May 2026 represents the NBA Playoffs (Conference Finals stage)
    const fallbackGames = [
      { id: "g1", homeTeam: "Boston Celtics", awayTeam: "Miami Heat", gameTime: "8:30 PM EST", bookSpread: -6.5, bookTotal: 216.5, seriesInfo: "Eastern Conference Finals - Game 3" },
      { id: "g2", homeTeam: "Dallas Mavericks", awayTeam: "Oklahoma City Thunder", gameTime: "9:00 PM EST", bookSpread: -2.5, bookTotal: 224.0, seriesInfo: "Western Conference Finals - Game 4" },
      { id: "g3", homeTeam: "New York Knicks", awayTeam: "Philadelphia 76ers", gameTime: "7:30 PM EST", bookSpread: -3.5, bookTotal: 211.5, seriesInfo: "Eastern Conference Semifinals (Simulated)" },
      { id: "g4", homeTeam: "Denver Nuggets", awayTeam: "Minnesota Timberwolves", gameTime: "10:30 PM EST", bookSpread: -4.0, bookTotal: 219.0, seriesInfo: "Western Conference Semifinals (Simulated)" }
    ];

    if (!ai) {
      return res.json(fallbackGames);
    }

    try {
      // Query Gemini with search grounding to obtain current active matchups, focusing on playoffs
      const todayDateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const prompt = `Perform a live google search for: "NBA game schedule ${todayDateStr}" or "NBA playoffs schedule active games".
      Identify the active, today's or nearest upcoming NBA game matchups (specifically playoff series games).
      Provide a flat JSON array format representing these games. For each match, provide an estimate of the point spread and over/under game total based on current sportsbook projections.
      If it is the offseason or there are no active playoff games today, provide highly realistic NBA playoff matchups (such as Boston Celtics vs Miami Heat, Dallas Mavericks vs Oklahoma City Thunder) reflecting high-stakes Conference Finals or Semifinals matches.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                homeTeam: { type: Type.STRING },
                awayTeam: { type: Type.STRING },
                gameTime: { type: Type.STRING },
                bookSpread: { type: Type.NUMBER, description: "Typical spread, negative for home favorite, positive for away favorite" },
                bookTotal: { type: Type.NUMBER, description: "Over/Under game total, e.g. 218.5" },
                seriesInfo: { type: Type.STRING, description: "e.g. 'Eastern Conference Finals - Game 3' if a playoff game" }
              },
              required: ["id", "homeTeam", "awayTeam", "gameTime", "bookSpread", "bookTotal"]
            }
          }
        }
      });

      if (response.text) {
        const parsed = JSON.parse(response.text.trim());
        return res.json(parsed);
      }
      res.json(fallbackGames);
    } catch (error) {
      console.error("Failed to fetch today's NBA games (playoffs):", error);
      res.json(fallbackGames);
    }
  });

  // POST /api/nba/predict - Runs search-grounded analytics to formulate margin prediction and prop edges
  app.post("/api/nba/predict", async (req, res) => {
    const { homeTeam, awayTeam, bookSpread = -5, bookTotal = 220, bookHomeML, bookAwayML } = req.body;
    
    if (!homeTeam || !awayTeam) {
      return res.status(400).json({ error: "homeTeam and awayTeam are required." });
    }

    const ai = getGeminiClient();

    // Helper to calculate implied probability from American Odds Money Line
    const getImpliedProb = (ml: number): number => {
      if (ml < 0) {
        return Math.abs(ml) / (Math.abs(ml) + 100);
      } else {
        return 100 / (ml + 100);
      }
    };

    // Helper to estimate realistic book moneylines from spread if not provided
    const estimateMLFromSpread = (spread: number) => {
      // spread of -5 => home is favorite.
      // 1 / (1 + e^(-0.1554 * margin))
      const margin = -spread; 
      const winProbHome = 1 / (1 + Math.exp(-0.1554 * margin));
      let homeML = -110;
      let awayML = -110;
      
      if (winProbHome >= 0.5) {
        homeML = Math.round(-(winProbHome / (1 - winProbHome)) * 100);
        awayML = Math.round(((1 - winProbHome) / winProbHome) * 100);
      } else {
        homeML = Math.round((winProbHome / (1 - winProbHome)) * 100);
        awayML = Math.round(-((1 - winProbHome) / winProbHome) * 100);
      }
      return { homeML, awayML };
    };

    // Fallback generator for realistic prediction data in simulation mode
    const generateFallbackPrediction = () => {
      const hRating = 4.2 + (Math.random() * 6);
      const aRating = 1.1 + (Math.random() * 5);
      const hPace = 98.2 + (Math.random() * 4);
      const aPace = 99.1 + (Math.random() * 4);
      const projectedMargin = Number(((hRating - aRating) / 2 + 2.75).toFixed(1));
      
      const ourSpread = -projectedMargin;
      const diff = ourSpread - bookSpread;
      const edgePoints = Number(Math.abs(diff).toFixed(1));

      let recommendedPick = "";
      if (diff > 0) {
        recommendedPick = `LEAN ${awayTeam} +${Math.abs(bookSpread)}`;
      } else {
        recommendedPick = `LEAN ${homeTeam} ${bookSpread}`;
      }

      let edgeCategory = "No bet";
      let confidence = 50 + Math.floor(Math.random() * 15);
      if (edgePoints >= 3) {
        edgeCategory = "Strong edge";
        confidence = 65 + Math.floor(Math.random() * 20);
      } else if (edgePoints >= 1.5) {
        edgeCategory = "Moderate edge";
        confidence = 55 + Math.floor(Math.random() * 15);
      }

      // Money Line calculations
      const estBooks = estimateMLFromSpread(bookSpread);
      const finalBookHomeML = bookHomeML || estBooks.homeML;
      const finalBookAwayML = bookAwayML || estBooks.awayML;

      // Model probability based on projected winning margin
      // Sigmoidal standard sports probability curve
      const projectedHomeWinProb = Number((1 / (1 + Math.exp(-0.1554 * projectedMargin))).toFixed(3));
      const projectedAwayWinProb = Number((1 - projectedHomeWinProb).toFixed(3));

      // Convert probabilities to american odds moneylines
      let projectedHomeML = -110;
      let projectedAwayML = -110;

      if (projectedHomeWinProb >= 0.5) {
        projectedHomeML = Math.round(-(projectedHomeWinProb / (1 - projectedHomeWinProb)) * 100);
        projectedAwayML = Math.round(((1 - projectedHomeWinProb) / projectedHomeWinProb) * 100);
      } else {
        projectedHomeML = Math.round((projectedHomeWinProb / (1 - projectedHomeWinProb)) * 100);
        projectedAwayML = Math.round(-((1 - projectedHomeWinProb) / projectedHomeWinProb) * 100);
      }

      // Detect ML edges by comparing model probabilities vs book implied probabilities
      const impliedHomeBookProb = getImpliedProb(finalBookHomeML);
      const impliedAwayBookProb = getImpliedProb(finalBookAwayML);

      const homeMLEdge = projectedHomeWinProb - impliedHomeBookProb;
      const awayMLEdge = projectedAwayWinProb - impliedAwayBookProb;

      let mlEdgeTeam = homeTeam;
      let mlEdgePct = Number((homeMLEdge * 100).toFixed(1));
      if (awayMLEdge > homeMLEdge) {
        mlEdgeTeam = awayTeam;
        mlEdgePct = Number((awayMLEdge * 100).toFixed(1));
      }

      let mlEdgeCategory = "No bet";
      if (mlEdgePct >= 5) {
        mlEdgeCategory = "Strong edge";
      } else if (mlEdgePct >= 2) {
        mlEdgeCategory = "Moderate edge";
      }

      return {
        homeTeam,
        awayTeam,
        homeNetRtg: Number(hRating.toFixed(1)),
        awayNetRtg: Number(aRating.toFixed(1)),
        homePace: Number(hPace.toFixed(1)),
        awayPace: Number(aPace.toFixed(1)),
        homeTS: 58.4,
        awayTS: 56.9,
        injuryReport: [
          `Key Player (${homeTeam}) - Questionable (Knee)`,
          `Backup Guard (${awayTeam}) - Out (Ankle)`
        ],
        projectedMargin,
        bookSpread,
        edgePoints,
        edgeCategory,
        recommendedPick,
        confidence,
        
        // ML Model integration
        projectedHomeWinProb,
        projectedAwayWinProb,
        projectedHomeML,
        projectedAwayML,
        bookHomeML: finalBookHomeML,
        bookAwayML: finalBookAwayML,
        mlEdgeTeam,
        mlEdgePct,
        mlEdgeCategory,

        homePlayerStats: [
          { playerName: "Star Player A", usg: 29.5, ts: 61.2, minutes: 34.5 },
          { playerName: "Guard B", usg: 21.0, ts: 57.1, minutes: 28.2 }
        ],
        awayPlayerStats: [
          { playerName: "Star Player X", usg: 28.1, ts: 59.8, minutes: 35.1 },
          { playerName: "Forward Y", usg: 19.5, ts: 55.4, minutes: 31.0 }
        ],
        playerProps: [
          { playerName: "Star Player A", statType: "Points", line: 26.5, projected: 29.8, overUnder: "OVER", edgePct: 68 },
          { playerName: "Star Player X", statType: "Assists", line: 7.5, projected: 6.2, overUnder: "UNDER", edgePct: 62 },
          { playerName: "Guard B", statType: "Rebounds", line: 4.5, projected: 5.8, overUnder: "OVER", edgePct: 59 }
        ]
      };
    };

    if (!ai) {
      return res.json(generateFallbackPrediction());
    }

    try {
      const estBooks = estimateMLFromSpread(bookSpread);
      const finalBookHomeML = bookHomeML || estBooks.homeML;
      const finalBookAwayML = bookAwayML || estBooks.awayML;

      const prompt = `Search live and retrieve actual NBA stats for the matchup: ${awayTeam} at ${homeTeam}.
      Look up:
      1. Home team ${homeTeam} offensive rating, defensive rating, NetRtg (Net Rating) in their last 15 games, and their average game Pace.
      2. Away team ${awayTeam} offensive rating, defensive rating, NetRtg in their last 15 games, and their average game Pace.
      3. Team True Shooting percentages (TS%).
      4. Key injuries or game statuses for both teams.
      5. Top 2 player stats for each team: USG%, TS%, and game minutes.
      6. Formulate 3 player prop recommendations with the calculated line advantage.
      7. Using their ratings, calculate the projected margin of victory mathematically as: Projected Margin = (Home NetRtg - Away NetRtg) / 2 + 2.75.
      
      Compare this projected home win margin with the Book Spread which is ${bookSpread} to calculate Spreads edge.
      Also formulate the Money Line predictor model:
      - Theoretical Home Win Probability = 1 / (1 + e^(-0.1554 * Projected Margin)).
      - Theoretical Away Win Probability = 1 - Home Win Probability.
      - Convert those win probabilities to projected American Moneyline Odds for home and away.
      
      Compare these model projections with book odds where Home Book ML is ${finalBookHomeML} and Away Book ML is ${finalBookAwayML}:
      - Implied book probability for any positive odds x is 100 / (x + 100).
      - Implied book probability for any negative odds y is |y| / (|y| + 100).
      - Compute Home Money Line Edge: Home Win Probability - Home Book Implied Probability.
      - Compute Away Money Line Edge: Away Win Probability - Away Book Implied Probability.
      - Select the team side with the maximal Edge value. Express this edge as percentage (e.g. +4.5% Edge).
      - ML Edge Category is 'Strong edge' if MLEdgePct is >= 5, 'Moderate edge' if edge is >= 2, else 'No bet'.
      
      Return a flat, valid JSON object following the provided schema. No markdown formatting tags, just the clean JSON object.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              homeTeam: { type: Type.STRING },
              awayTeam: { type: Type.STRING },
              homeNetRtg: { type: Type.NUMBER },
              awayNetRtg: { type: Type.NUMBER },
              homePace: { type: Type.NUMBER },
              awayPace: { type: Type.NUMBER },
              homeTS: { type: Type.NUMBER },
              awayTS: { type: Type.NUMBER },
              injuryReport: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              projectedMargin: { type: Type.NUMBER },
              bookSpread: { type: Type.NUMBER },
              edgePoints: { type: Type.NUMBER },
              edgeCategory: { type: Type.STRING },
              recommendedPick: { type: Type.STRING },
              confidence: { type: Type.INTEGER },
              homePlayerStats: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    playerName: { type: Type.STRING },
                    usg: { type: Type.NUMBER },
                    ts: { type: Type.NUMBER },
                    minutes: { type: Type.NUMBER }
                  },
                  required: ["playerName", "usg", "ts", "minutes"]
                }
              },
              awayPlayerStats: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    playerName: { type: Type.STRING },
                    usg: { type: Type.NUMBER },
                    ts: { type: Type.NUMBER },
                    minutes: { type: Type.NUMBER }
                  },
                  required: ["playerName", "usg", "ts", "minutes"]
                }
              },
              playerProps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    playerName: { type: Type.STRING },
                    statType: { type: Type.STRING },
                    line: { type: Type.NUMBER },
                    projected: { type: Type.NUMBER },
                    overUnder: { type: Type.STRING },
                    edgePct: { type: Type.INTEGER }
                  },
                  required: ["playerName", "statType", "line", "projected", "overUnder", "edgePct"]
                }
              },
              projectedHomeWinProb: { type: Type.NUMBER },
              projectedAwayWinProb: { type: Type.NUMBER },
              projectedHomeML: { type: Type.NUMBER },
              projectedAwayML: { type: Type.NUMBER },
              bookHomeML: { type: Type.NUMBER },
              bookAwayML: { type: Type.NUMBER },
              mlEdgeTeam: { type: Type.STRING },
              mlEdgePct: { type: Type.NUMBER },
              mlEdgeCategory: { type: Type.STRING }
            },
            required: [
              "homeTeam", "awayTeam", "homeNetRtg", "awayNetRtg", "homePace", "awayPace",
              "homeTS", "awayTS", "injuryReport", "projectedMargin", "bookSpread",
              "edgePoints", "edgeCategory", "recommendedPick", "confidence",
              "homePlayerStats", "awayPlayerStats", "playerProps",
              "projectedHomeWinProb", "projectedAwayWinProb", "projectedHomeML", "projectedAwayML",
              "bookHomeML", "bookAwayML", "mlEdgeTeam", "mlEdgePct", "mlEdgeCategory"
            ]
          }
        }
      });

      if (response.text) {
        const parsed = JSON.parse(response.text.trim());
        return res.json(parsed);
      }
      res.json(generateFallbackPrediction());
    } catch (error) {
      console.error("AI game prediction formula error:", error);
      res.json(generateFallbackPrediction());
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

