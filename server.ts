
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

  // GET /api/games/:sport - Lists active sport game matchups
  app.get("/api/games/:sport", async (req, res) => {
    const sport = (req.params.sport || "NBA").toUpperCase();
    const ai = getGeminiClient();

    const fallbackGames: Record<string, any[]> = {
      NBA: [
        { id: "g1", homeTeam: "Boston Celtics", awayTeam: "Miami Heat", gameTime: "8:30 PM EST", bookSpread: -6.5, bookTotal: 216.5, seriesInfo: "Eastern Conference Finals - Game 3" },
        { id: "g2", homeTeam: "Dallas Mavericks", awayTeam: "Oklahoma City Thunder", gameTime: "9:00 PM EST", bookSpread: -2.5, bookTotal: 224.0, seriesInfo: "Western Conference Finals - Game 4" },
        { id: "g3", homeTeam: "New York Knicks", awayTeam: "Philadelphia 76ers", gameTime: "7:30 PM EST", bookSpread: -3.5, bookTotal: 211.5, seriesInfo: "Eastern Conference Semifinals (Simulated)" },
        { id: "g4", homeTeam: "Denver Nuggets", awayTeam: "Minnesota Timberwolves", gameTime: "10:30 PM EST", bookSpread: -4.0, bookTotal: 219.0, seriesInfo: "Western Conference Semifinals (Simulated)" }
      ],
      MLB: [
        { id: "mlb1", homeTeam: "New York Yankees", awayTeam: "Boston Red Sox", gameTime: "7:05 PM EST", bookSpread: -1.5, bookTotal: 8.5, seriesInfo: "Regular Season Classic" },
        { id: "mlb2", homeTeam: "Los Angeles Dodgers", awayTeam: "San Francisco Giants", gameTime: "10:10 PM EST", bookSpread: -1.5, bookTotal: 7.5, seriesInfo: "West Coast Rivalry" },
        { id: "mlb3", homeTeam: "Chicago Cubs", awayTeam: "St. Louis Cardinals", gameTime: "2:20 PM EST", bookSpread: -1.0, bookTotal: 9.0, seriesInfo: "Rivalry at Wrigley Field" },
        { id: "mlb4", homeTeam: "Houston Astros", awayTeam: "Texas Rangers", gameTime: "8:10 PM EST", bookSpread: -1.0, bookTotal: 8.0, seriesInfo: "Lone Star Series" }
      ],
      NFL: [
        { id: "nfl1", homeTeam: "Kansas City Chiefs", awayTeam: "Buffalo Bills", gameTime: "4:25 PM EST", bookSpread: -3.5, bookTotal: 48.5, seriesInfo: "AFC Divisional Preview" },
        { id: "nfl2", homeTeam: "Dallas Cowboys", awayTeam: "Philadelphia Eagles", gameTime: "8:20 PM EST", bookSpread: -2.5, bookTotal: 46.0, seriesInfo: "Sunday Night Showdown" },
        { id: "nfl3", homeTeam: "San Francisco 49ers", awayTeam: "Seattle Seahawks", gameTime: "4:05 PM EST", bookSpread: -5.5, bookTotal: 44.5, seriesInfo: "NFC West Division Battle" },
        { id: "nfl4", homeTeam: "Baltimore Ravens", awayTeam: "Cincinnati Bengals", gameTime: "1:00 PM EST", bookSpread: -3.0, bookTotal: 47.0, seriesInfo: "AFC North Clashing" }
      ]
    };

    const selectedGames = fallbackGames[sport] || fallbackGames["NBA"];

    if (!ai) {
      return res.json(selectedGames);
    }

    try {
      const todayDateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      let queryLabel = "NBA game schedule";
      let leagueDesc = "NBA playoffs schedule active games";
      if (sport === 'MLB') {
        queryLabel = "MLB game schedule";
        leagueDesc = "MLB regular season active games today";
      } else if (sport === 'NFL') {
        queryLabel = "NFL game schedule";
        leagueDesc = "NFL active week matchups or near upcoming high-profile games";
      }

      const prompt = `Perform a live google search for: "${queryLabel} ${todayDateStr}" or "${leagueDesc}".
      Identify active, today's or nearest upcoming ${sport} game matchups.
      Provide a flat JSON array format representing these games. For each match, provide an estimate of the point spread / run line and over/under game total based on current sportsbook projections.
      If it is the offseason or there are no active games today, provide highly realistic high-stakes matchups (such as ${selectedGames[0].homeTeam} vs ${selectedGames[0].awayTeam}) reflecting typical matchups.`;
      
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
                bookTotal: { type: Type.NUMBER, description: "Over/Under game total, e.g. 218.5 for NBA, 8.5 for MLB, 45.5 for NFL" },
                seriesInfo: { type: Type.STRING }
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
      res.json(selectedGames);
    } catch (error) {
      console.error(`Failed to fetch today's ${sport} games:`, error);
      res.json(selectedGames);
    }
  });

  // Backward compatible wrapper
  app.get("/api/nba/games/today", async (req, res) => {
    const ai = getGeminiClient();
    const fallbackGames = [
      { id: "g1", homeTeam: "Boston Celtics", awayTeam: "Miami Heat", gameTime: "8:30 PM EST", bookSpread: -6.5, bookTotal: 216.5, seriesInfo: "Eastern Conference Finals - Game 3" },
      { id: "g2", homeTeam: "Dallas Mavericks", awayTeam: "Oklahoma City Thunder", gameTime: "9:00 PM EST", bookSpread: -2.5, bookTotal: 224.0, seriesInfo: "Western Conference Finals - Game 4" },
      { id: "g3", homeTeam: "New York Knicks", awayTeam: "Philadelphia 76ers", gameTime: "7:30 PM EST", bookSpread: -3.5, bookTotal: 211.5, seriesInfo: "Eastern Conference Semifinals (Simulated)" },
      { id: "g4", homeTeam: "Denver Nuggets", awayTeam: "Minnesota Timberwolves", gameTime: "10:30 PM EST", bookSpread: -4.0, bookTotal: 219.0, seriesInfo: "Western Conference Semifinals (Simulated)" }
    ];
    res.json(fallbackGames);
  });

  // POST /api/predict - Runs search-grounded analytics to formulate margin prediction and prop edges across NBA, MLB, and NFL
  app.post("/api/predict", async (req, res) => {
    const { sport = "NBA", homeTeam, awayTeam, bookSpread = -5, bookTotal = 220, bookHomeML, bookAwayML, customParams } = req.body;
    
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
    const estimateMLFromSpread = (spread: number, currentSport: string) => {
      const margin = -spread; 
      let winProbHome = 1 / (1 + Math.exp(-0.1554 * margin));
      if (currentSport === 'MLB') {
        winProbHome = 1 / (1 + Math.exp(-0.6 * margin));
      }
      let homeML = -110;
      let awayML = -110;
      
      if (winProbHome >= 0.5) {
        homeML = Math.round(-(winProbHome / (1 - winProbHome)) * 100);
        awayML = Math.round(((1 - winProbHome) / winProbHome) * 105);
      } else {
        homeML = Math.round((winProbHome / (1 - winProbHome)) * 105);
        awayML = Math.round(-((1 - winProbHome) / winProbHome) * 100);
      }
      return { homeML, awayML };
    };

    const generateFallbackPrediction = () => {
      const activeSport = sport.toUpperCase();
      const estBooks = estimateMLFromSpread(bookSpread, activeSport);
      const finalBookHomeML = bookHomeML || estBooks.homeML;
      const finalBookAwayML = bookAwayML || estBooks.awayML;

      if (activeSport === 'MLB') {
        const hWrc = customParams?.homeWrc || 105;
        const aWrc = customParams?.awayWrc || 98;
        const hSpxFip = customParams?.homeSpxFip || 3.9;
        const aSpxFip = customParams?.awaySpxFip || 4.2;
        const parkFactor = customParams?.ballparkRunFactor || 1.0;
        const handednessAdjustment = customParams?.handednessAdjustment || 0.0;

        const scaleNode = 0.05; 
        const rawHomePart = (hWrc - aSpxFip * 20); 
        const rawAwayPart = (aWrc - hSpxFip * 20); 
        const projectedMargin = Number(((rawHomePart - rawAwayPart) * scaleNode + (parkFactor - 1.0) * 2 + handednessAdjustment).toFixed(2));
        
        const hSPprojectedEr = customParams?.homeSPprojectedEr || 2.4;
        const aSPprojectedEr = customParams?.awaySPprojectedEr || 2.8;
        const bullpenEraContrib = customParams?.bullpenEraContrib || 1.8;
        const projectedTotal = Number((hSPprojectedEr + aSPprojectedEr + bullpenEraContrib + (parkFactor - 1.0) * 1.5).toFixed(1));

        const projectedHomeWinProb = Number((1 / (1 + Math.exp(-1.1 * projectedMargin))).toFixed(3));
        const projectedAwayWinProb = Number((1 - projectedHomeWinProb).toFixed(3));

        let projectedHomeML = -110;
        let projectedAwayML = -110;
        if (projectedHomeWinProb >= 0.5) {
          projectedHomeML = Math.round(-(projectedHomeWinProb / (1 - projectedHomeWinProb)) * 100);
          projectedAwayML = Math.round(((1 - projectedHomeWinProb) / projectedHomeWinProb) * 100);
        } else {
          projectedHomeML = Math.round((projectedHomeWinProb / (1 - projectedHomeWinProb)) * 100);
          projectedAwayML = Math.round(-((1 - projectedHomeWinProb) / projectedHomeWinProb) * 100);
        }

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

        const runLineDiff = -projectedMargin - bookSpread;
        const edgePoints = Number(Math.abs(runLineDiff).toFixed(2));
        let recommendedPick = runLineDiff > 0 ? `LEAN ${awayTeam} +${Math.abs(bookSpread)}` : `LEAN ${homeTeam} ${bookSpread}`;

        const defaultMlbProps = [
          { playerName: "Pitcher " + homeTeam.split(" ").pop(), statType: "Pitcher Strikeouts", line: 5.5, projected: 6.8, overUnder: "OVER", edgePct: 65 },
          { playerName: "Pitcher " + awayTeam.split(" ").pop(), statType: "Pitcher Strikeouts", line: 6.5, projected: 5.4, overUnder: "UNDER", edgePct: 61 },
          { playerName: "Batter " + homeTeam.split(" ").pop(), statType: "Total Bases", line: 1.5, projected: 2.1, overUnder: "OVER", edgePct: 58 }
        ];

        return {
          homeTeam,
          awayTeam,
          sport: "MLB",
          homeWrc: hWrc,
          awayWrc: aWrc,
          homeSpxFip: hSpxFip,
          awaySpxFip: aSpxFip,
          parkFactor,
          projectedMargin,
          bookSpread,
          bookTotal,
          projectedTotal,
          edgePoints,
          edgeCategory: edgePoints >= 0.5 ? "Strong edge" : (edgePoints >= 0.25 ? "Moderate edge" : "No bet"),
          recommendedPick,
          confidence: 70,
          projectedHomeWinProb,
          projectedAwayWinProb,
          projectedHomeML,
          projectedAwayML,
          bookHomeML: finalBookHomeML,
          bookAwayML: finalBookAwayML,
          mlEdgeTeam,
          mlEdgePct,
          mlEdgeCategory,
          injuryReport: [
            `Starting Pitcher (${homeTeam}) - Safe split ready.`,
            `Star Outfielder (${awayTeam}) - Day-to-day (Hamstring soreness)`
          ],
          homePlayerStats: [
            { playerName: "Clean-up Batter", usg: 22, ts: 58, minutes: 9 },
            { playerName: "Lead Pitcher", usg: 15, ts: 52, minutes: 6 }
          ],
          awayPlayerStats: [
            { playerName: "All Star Star", usg: 25, ts: 62, minutes: 9 },
            { playerName: "Ace Pitcher", usg: 18, ts: 55, minutes: 7 }
          ],
          playerProps: defaultMlbProps,
          mlbFormulaSummary: `Projected Margin = (${hWrc} - ${aSpxFip}×20) - (${aWrc} - ${hSpxFip}×20) scaled + ${handednessAdjustment} adj`
        };

      } else if (activeSport === 'NFL') {
        const hDVOA = customParams?.homeDVOA || 12.5;
        const aDVOA = customParams?.awayDVOA || 5.0;
        const hOffDVOA = customParams?.homeOffenseDVOA || 10.2;
        const aDefDVOA = customParams?.awayDefenseDVOA || -3.5;
        const aOffDVOA = customParams?.awayOffenseDVOA || 6.1;
        const hDefDVOA = customParams?.homeDefenseDVOA || 1.2;
        const paceFactor = customParams?.paceFactor || 1.0;
        
        const b2bHome = customParams?.isOffByeHome ? 2.5 : 0;
        const b2bAway = customParams?.isOffByeAway ? 2.5 : 0;
        const shortWeekHome = customParams?.isShortWeekHome ? -1.5 : 0;
        const shortWeekAway = customParams?.isShortWeekAway ? -1.5 : 0;
        
        const hfa = 2.75;
        const qbAdjHome = customParams?.isBackupQBHome ? -8.5 : 0;
        const qbAdjAway = customParams?.isBackupQBAway ? -8.5 : 0;

        let projectedMargin = (hDVOA - aDVOA) * 0.15 + hfa + qbAdjHome - qbAdjAway + (b2bHome - b2bAway) + (shortWeekHome - shortWeekAway);
        projectedMargin = Number(projectedMargin.toFixed(1));

        const offDefDiffHome = hOffDVOA - aDefDVOA; 
        const offDefDiffAway = aOffDVOA - hDefDVOA;
        let projectedTotal = 44.5 + (offDefDiffHome + offDefDiffAway) * 0.15 * paceFactor;
        if (customParams?.weatherWind > 15) {
          projectedTotal -= 3.0; 
        }
        projectedTotal = Number(projectedTotal.toFixed(1));

        const projectedHomeWinProb = Number((1 / (1 + Math.exp(-0.1554 * projectedMargin))).toFixed(3));
        const projectedAwayWinProb = Number((1 - projectedHomeWinProb).toFixed(3));

        let projectedHomeML = -110;
        let projectedAwayML = -110;
        if (projectedHomeWinProb >= 0.5) {
          projectedHomeML = Math.round(-(projectedHomeWinProb / (1 - projectedHomeWinProb)) * 100);
          projectedAwayML = Math.round(((1 - projectedHomeWinProb) / projectedHomeWinProb) * 100);
        } else {
          projectedHomeML = Math.round((projectedHomeWinProb / (1 - projectedHomeWinProb)) * 100);
          projectedAwayML = Math.round(-((1 - projectedHomeWinProb) / projectedHomeWinProb) * 100);
        }

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

        const spreadDiff = -projectedMargin - bookSpread;
        const edgePoints = Number(Math.abs(spreadDiff).toFixed(1));
        let recommendedPick = spreadDiff > 0 ? `LEAN ${awayTeam} +${Math.abs(bookSpread)}` : `LEAN ${homeTeam} ${bookSpread}`;

        const defaultNflProps = [
          { playerName: "qb " + homeTeam.split(" ").pop(), statType: "Passing Yards", line: 242.5, projected: 265.4, overUnder: "OVER", edgePct: 66 },
          { playerName: "qb " + awayTeam.split(" ").pop(), statType: "Passing Yards", line: 254.5, projected: 232.1, overUnder: "UNDER", edgePct: 62 },
          { playerName: "Receiver " + homeTeam.split(" ").pop(), statType: "Receiving Yards", line: 72.5, projected: 85.8, overUnder: "OVER", edgePct: 60 }
        ];

        return {
          homeTeam,
          awayTeam,
          sport: "NFL",
          homeDVOA: hDVOA,
          awayDVOA: aDVOA,
          projectedMargin,
          bookSpread,
          bookTotal,
          projectedTotal,
          edgePoints,
          edgeCategory: edgePoints >= 3.5 ? "Strong edge" : (edgePoints >= 1.5 ? "Moderate edge" : "No bet"),
          recommendedPick,
          confidence: 72,
          projectedHomeWinProb,
          projectedAwayWinProb,
          projectedHomeML,
          projectedAwayML,
          bookHomeML: finalBookHomeML,
          bookAwayML: finalBookAwayML,
          mlEdgeTeam,
          mlEdgePct,
          mlEdgeCategory,
          injuryReport: [
            `qb Status (${homeTeam}) - Active.`,
            `Star Safety (${awayTeam}) - Out (shoulder strain)`
          ],
          homePlayerStats: [
            { playerName: "Quarterback A", usg: 35, ts: 60, minutes: 60 },
            { playerName: "Running Back B", usg: 22, ts: 54, minutes: 40 }
          ],
          awayPlayerStats: [
            { playerName: "Quarterback X", usg: 33, ts: 58, minutes: 60 },
            { playerName: "Wide Receiver Y", usg: 25, ts: 61, minutes: 55 }
          ],
          playerProps: defaultNflProps,
          nflFormulaSummary: `Margin = (${hDVOA} - ${aDVOA})×0.15 + 2.75 HFA + QBAdj`
        };

      } else {
        const hRating = customParams?.homeNetRtg || 4.2;
        const aRating = customParams?.awayNetRtg || 1.1;
        const hPace = customParams?.pace || 98.2;
        const aPace = customParams?.pace || 99.1;
        const projectedMargin = Number(((hRating - aRating) / 2 + 2.75).toFixed(1));
        
        const projectedTotal = Number((((customParams?.homeORtg || 116.5) + (customParams?.awayDRtg || 114.2)) / 2 + ((customParams?.awayORtg || 115.0) + (customParams?.homeDRtg || 113.8)) / 2 * (hPace / 100)).toFixed(1));

        const ourSpread = -projectedMargin;
        const diff = ourSpread - bookSpread;
        const edgePoints = Number(Math.abs(diff).toFixed(1));

        let recommendedPick = diff > 0 ? `LEAN ${awayTeam} +${Math.abs(bookSpread)}` : `LEAN ${homeTeam} ${bookSpread}`;

        const projectedHomeWinProb = Number((1 / (1 + Math.exp(-0.1554 * projectedMargin))).toFixed(3));
        const projectedAwayWinProb = Number((1 - projectedHomeWinProb).toFixed(3));

        let projectedHomeML = -110;
        let projectedAwayML = -110;
        if (projectedHomeWinProb >= 0.5) {
          projectedHomeML = Math.round(-(projectedHomeWinProb / (1 - projectedHomeWinProb)) * 100);
          projectedAwayML = Math.round(((1 - projectedHomeWinProb) / projectedHomeWinProb) * 100);
        } else {
          projectedHomeML = Math.round((projectedHomeWinProb / (1 - projectedHomeWinProb)) * 100);
          projectedAwayML = Math.round(-((1 - projectedHomeWinProb) / projectedHomeWinProb) * 100);
        }

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
          sport: "NBA",
          homeNetRtg: Number(hRating.toFixed(1)),
          awayNetRtg: Number(aRating.toFixed(1)),
          homePace: hPace,
          awayPace: aPace,
          homeTS: 58.4,
          awayTS: 56.9,
          injuryReport: [
            `Key Player (${homeTeam}) - Questionable`,
            `Backup Guard (${awayTeam}) - Out`
          ],
          projectedMargin,
          bookSpread,
          bookTotal,
          projectedTotal,
          edgePoints,
          edgeCategory: edgePoints >= 3 ? "Strong edge" : (edgePoints >= 1.5 ? "Moderate edge" : "No bet"),
          recommendedPick,
          confidence: 65,
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
      }
    };

    if (!ai) {
      return res.json(generateFallbackPrediction());
    }

    try {
      const activeSport = sport.toUpperCase();
      const estBooks = estimateMLFromSpread(bookSpread, activeSport);
      const finalBookHomeML = bookHomeML || estBooks.homeML;
      const finalBookAwayML = bookAwayML || estBooks.awayML;

      let sportGroundingDirectives = "";
      let formulaInstruction = "";
      
      if (activeSport === 'MLB') {
        sportGroundingDirectives = `
          Look up:
          1. Home team ${homeTeam} offensive wRC+ (vs opposite hand starting pitcher) and Team runs scored/allowed.
          2. Away team ${awayTeam} starting pitcher projection, xFIP, ERA, bullpen ERA.
          3. Away team ${awayTeam} offensive wRC+ (vs opposite hand starting pitcher) and Team runs scored/allowed.
          4. Home team ${homeTeam} starting pitcher projection, xFIP, ERA.
          5. Ballpark Run Factor and weather/wind conditions (especially wind speed blowing out/in).
          6. Dynamic player props (e.g., Pitcher strikeouts over/under, batter hits, etc.).
        `;
        formulaInstruction = `
          Calculate the Projected Run Line mathematically as:
          Projected Run Margin = (Home Team wRC+ - Away SP xFIP ERA) - (Away Team wRC+ - Home SP xFIP ERA) + Ballpark Run Factor + Handedness Lineup Adjustment.
          And Projected Game Total mathematically as:
          Projected Total = Home SP projected ER (over 6 IP) + Away SP projected ER (over 6 IP) + Bullpen ERA contribution + Park run factor adjustment + (Wind over 15mph blowing out = add 0.8 runs).
          Convert the winning probability model using Pythagorean Win Formula:
          Pythagorean Win% = HomeRS^1.83 / (HomeRS^1.83 + HomeRA^1.83) vs AwayRS^1.83 / (AwayRS^1.83 + AwayRA^1.83), adjusted for today's active SP compared to average.
        `;
      } else if (activeSport === 'NFL') {
        sportGroundingDirectives = `
          Look up:
          1. Home team ${homeTeam} overall DVOA, Offensive DVOA, and Defensive DVOA.
          2. Away team ${awayTeam} overall DVOA, Offensive DVOA, and Defensive DVOA.
          3. Starting Quarterbacks relative DYAR/DVOA and rest statuses (bye week, short week).
          4. Weather forecast (wind, snow, rain, dome stadium vs outside).
          5. Dynamic player props (e.g. Quarterback Passing Yards, Wide Receiver yards).
        `;
        formulaInstruction = `
          Calculate Projected Spread margin mathematically as:
          Projected Margin = (Home DVOA - Away DVOA) * 0.15 + 2.75 HFA + QB Value Adjustment + Roster Rest Adjustments.
          QB Value Adjustment is: QB Impact = (Starting QB DYAR - Replacement QB DYAR) * (Pass play % * 0.6). If backup QB is playing, subtract 7-10 points from projected margin.
          And Projected Game Total mathematically as:
          Projected Total = 43.5 + (Home Offense DVOA + Away Defense DVOA) * 0.15 * paceFactor + (Away Offense DVOA + Home Defense DVOA) * 0.15 * paceFactor + Weather multiplier.
        `;
      } else {
        sportGroundingDirectives = `
          Look up:
          1. Home team ${homeTeam} NetRtg, Offensive Rating, Defensive Rating over last 15 games, average Pace.
          2. Away team ${awayTeam} NetRtg, Offensive Rating, Defensive Rating over last 15 games, average Pace.
          3. Team injuries & active star availability.
          4. Dynamic player props (e.g. points, assists, rebounds).
        `;
        formulaInstruction = `
          Calculate the projected margin of victory mathematically as:
          Projected Margin = (Home NetRtg - Away NetRtg) / 2 + 2.75 Home Court Advantage.
          Calculate Projected Game Total mathematically as:
          Projected Total = ((Home ORtg + Away DRtg) / 2 + (Away ORtg + Home DRtg) / 2) * (Pace / 100).
        `;
      }

      const prompt = `Search live and retrieve actual stats for the matchup: ${awayTeam} at ${homeTeam} in the ${activeSport} league.
      ${sportGroundingDirectives}
      
      Compare predictions mathematically against book lines where:
      - Book Spread is ${bookSpread}
      - Book Game Total is ${bookTotal}
      - Home ML is ${finalBookHomeML}
      - Away ML is ${finalBookAwayML}

      ${formulaInstruction}

      Formulate a moneyline edge model:
      - Implied probability = 100 / (odds + 100) if odds > 0; |odds| / (|odds| + 100) if odds < 0.
      - MLEdgePct = Model Winning Prob - Implied Book Prob.
      - Highlight the maximal positive Edge side.

      Return a flat, valid JSON object matching the JSON schema below. Include relevant indicators.`;

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
              sport: { type: Type.STRING },
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
              projectedMargin: { type: Type.NUMBER, description: "Points margin (positive Home, negative Away)" },
              bookSpread: { type: Type.NUMBER },
              projectedTotal: { type: Type.NUMBER },
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
              mlEdgeCategory: { type: Type.STRING },
              mlbFormulaSummary: { type: Type.STRING },
              nflFormulaSummary: { type: Type.STRING }
            },
            required: [
              "homeTeam", "awayTeam", "projectedMargin", "bookSpread", "projectedTotal",
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
        parsed.sport = parsed.sport || activeSport;
        return res.json(parsed);
      }
      res.json(generateFallbackPrediction());
    } catch (error) {
      console.error(`AI ${sport} prediction formula error:`, error);
      res.json(generateFallbackPrediction());
    }
  });

  // Backward compatible route mapping
  app.post("/api/nba/predict", async (req, res) => {
    req.body.sport = req.body.sport || "NBA";
    req.url = "/api/predict";
    app._router.handle(req, res);
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

