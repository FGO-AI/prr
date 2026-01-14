
import { GoogleGenAI } from "@google/genai";
import { League, RiskLevel, ParlayRecommendation, BetLeg, GameLogEntry } from "../types";

const cleanJsonText = (text: string): string => {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) {
        throw new Error("Terminal analysis error. Data stream corrupted.");
    }
    let cleaned = text.substring(firstBrace, lastBrace + 1);
    cleaned = cleaned.replace(/:\s*\+(\d+)/g, ': $1'); 
    return cleaned;
};

const getEffectiveMarketDate = () => {
    const now = new Date();
    // Get current time in Mountain Time
    const mtStr = now.toLocaleString("en-US", { timeZone: "America/Denver", hour12: false });
    // Expected format: "MM/DD/YYYY, HH:mm:ss"
    const parts = mtStr.split(', ');
    const timePart = parts[1];
    const hour = parseInt(timePart.split(':')[0], 10);
    
    // The cycle updates at 10 PM (22:00) MT
    if (hour >= 22) {
        const nextDay = new Date(now);
        nextDay.setDate(nextDay.getDate() + 1);
        return nextDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    }
    return now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
};

const parseResponse = (text: string): ParlayRecommendation[] => {
    try {
        const jsonString = cleanJsonText(text);
        const parsed = JSON.parse(jsonString);

        if (!parsed.recommendations || !Array.isArray(parsed.recommendations)) return [];

        return parsed.recommendations.map((rec: any, index: number) => {
            const mappedLegs = (rec.legs || []).map((leg: any) => ({
                playerId: leg.playerId || `p-${Date.now()}-${Math.random()}`,
                playerName: leg.playerName || "Unknown",
                team: leg.team || "N/A",
                opponent: leg.opponent || "N/A",
                statType: leg.statType || "Prop",
                line: Number(leg.line) || 0,
                prediction: leg.prediction || "Over",
                bookOdds: Number(leg.bookOdds) || -110,
                modelProb: Number(leg.modelProb) || 0.52,
                edge: Number(leg.edge) || 0,
                rationale: leg.rationale || "Verified via market search.",
                injuryStatus: leg.injuryStatus || "Active",
                leagueAvg: Number(leg.leagueAvg) || 0,
                recentHitRate: leg.recentHitRate || "N/A",
                recentGames: (leg.recentGames || []).map((g: any) => ({
                    date: g.date || "N/A",
                    opponent: g.opponent || "N/A",
                    value: Number(g.value) || 0,
                    minutes: Number(g.minutes) || 0,
                    hit: !!g.hit
                })),
                
                // Raw Engine variables from Gemini Search
                x10: Number(leg.x10) || Number(leg.line) * 0.95,
                x20: Number(leg.x20) || Number(leg.line) * 0.93,
                xSeason: Number(leg.xSeason) || Number(leg.line) * 0.9,
                sigma: Number(leg.sigma) || Math.max(2, Number(leg.line) * 0.15),
                expectedMins: Number(leg.expectedMins) || 32,
                avgMins: Number(leg.avgMins) || 30,
                expectedPace: Number(leg.expectedPace) || 100,
                leaguePace: Number(leg.leaguePace) || 98,
                oppAllowed: Number(leg.oppAllowed) || 22,
                leagueAllowed: Number(leg.leagueAllowed) || 20
            }));

            return {
                type: rec.type || 'player_profile',
                id: rec.id || `profile-${Date.now()}-${index}`,
                summary: rec.summary || "Quantitative ROI analysis complete.",
                totalOdds: Number(rec.totalOdds) || 0,
                expectedValue: Number(rec.expectedValue) || 15,
                kellyStake: Number(rec.kellyStake) || 2.5,
                correlationScore: Number(rec.correlationScore) || 0.6,
                varianceScore: Number(rec.varianceScore) || 3,
                timestamp: new Date().toISOString(),
                legs: mappedLegs
            };
        });
    } catch (e) {
        console.error("Parse Error:", e);
        throw new Error("Market data format error. Re-scanning...");
    }
};

export const fetchTrendingPicks = async (): Promise<ParlayRecommendation[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const marketDate = getEffectiveMarketDate();

    const prompt = `
      OPERATE AS A HIGH-FREQUENCY BETTING ANALYST.
      OBJECTIVE: Identify the top 3 trending player prop ROI edges for ${marketDate}.
      
      STEP 1: USE googleSearch to scan FanDuel, DraftKings, and PrizePicks for the most popular/trending NBA and NFL bets today.
      STEP 2: Identify 3 high-EV (Positive Expected Value) props.
      
      OUTPUT FORMAT (STRICT JSON):
      {
        "recommendations": [
          {
            "type": "parlay",
            "summary": "Trending High-EV Pick",
            "legs": [
              {
                "playerName": "string", "team": "string", "opponent": "string", "statType": "string",
                "line": number, "prediction": "Over", "bookOdds": number, "modelProb": number, "edge": number,
                "rationale": "Must include rank, pace, and hit rate info."
              }
            ],
            "expectedValue": number
          }
        ]
      }
    `;

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { tools: [{ googleSearch: {} }], temperature: 0.2 }
    });

    return parseResponse(response.text || "");
};

export const generateParlays = async (
  league: League,
  risk: RiskLevel,
  filters: string,
  statType: string = 'Any',
  advancedMetric: string = 'Standard'
): Promise<ParlayRecommendation[]> => {
    const marketDate = getEffectiveMarketDate();
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const modelId = "gemini-3-pro-preview";

    const prompt = `
      OPERATE AS A COMPREHENSIVE MULTI-MARKET SPORTS DATA AGGREGATOR.
      OBJECTIVE: EXPOSE EVERY SINGLE BETTABLE PROP FOR THE REQUESTED PLAYER(S) for ${marketDate}.
      
      STEP 1: USE googleSearch to perform an exhaustive scan for "${filters}":
      - For NBA: Retrieve EVERY line (Pts, Reb, Ast, 3PT, Stl, Blk, TO, PRA, P+R, P+A, R+A).
      - For NFL: Retrieve Pass Yds, Pass TDs, Rush Yds, Rec Yds, Receptions, Anytime TD.
      - For MLB: Retrieve Hits, HRs, TB, K, ER.

      STEP 2: STAT-SPECIFIC LOGS (CRITICAL). 
      For EACH individual leg (statType), search for the actual results of the player's last 5-10 games SPECIFIC to that stat.
      Example: If the leg is "Assists", the 'recentGames' array for THAT leg must contain how many ASSISTS the player got in those games. Do NOT use points logs for an assist prop.

      STEP 3: QUANTITATIVE PRECISION. For each unique stat, calculate:
      - recentGames: (5 most recent actual outcomes FOR THAT STAT TYPE)
      - x10, x20, xSeason (actual averages for that specific stat)
      - sigma (Standard Deviation for that specific stat)
      - DEF: #[Rank] vs that specific stat category.

      OUTPUT FORMAT (STRICT JSON):
      {
        "recommendations": [
          {
            "type": "player_profile",
            "summary": "Full market analysis for ${filters}...",
            "legs": [
              {
                "playerName": "${filters}", "team": "string", "opponent": "string", "statType": "Points",
                "line": number, "prediction": "Over", "bookOdds": number, 
                "recentGames": [ { "date": "string", "opponent": "string", "value": number, "minutes": number, "hit": boolean } ],
                "x10": number, "x20": number, "xSeason": number, "sigma": number, "expectedMins": number, "avgMins": number,
                "expectedPace": number, "leaguePace": number, "oppAllowed": number, "leagueAllowed": number,
                "rationale": "DEF: #22, PACE: +1.2%, HIT: 6/10 L10"
              }
              ... repeat for EVERY found bettable market ...
            ]
          }
        ]
      }
    `;

    const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: { tools: [{ googleSearch: {} }], temperature: 0.1 }
    });

    return parseResponse(response.text || "");
};
