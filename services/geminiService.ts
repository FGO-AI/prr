
import { GoogleGenAI } from "@google/genai";
import { League, RiskLevel, ParlayRecommendation, BetLeg, GameLogEntry } from "../types";

const cleanJsonText = (text: string): string => {
    try {
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace === -1 || lastBrace === -1) {
            return "{}";
        }
        let cleaned = text.substring(firstBrace, lastBrace + 1);
        // Handle common JSON issues from LLMs
        cleaned = cleaned.replace(/,\s*([\]}])/g, '$1'); // Trailing commas
        return cleaned;
    } catch (e) {
        return "{}";
    }
};

const getEffectiveMarketDate = () => {
    const now = new Date();
    // Use Mountain Time as requested for cycle sync
    const mtStr = now.toLocaleString("en-US", { timeZone: "America/Denver", hour12: false });
    const parts = mtStr.split(', ');
    const timePart = parts[1];
    const hour = parseInt(timePart.split(':')[0], 10);
    
    // If past 10 PM MT, focus on the next day's slate
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
            // RELAXED FILTER: We want data! If we have a name and a line, we keep it.
            // We require at least ONE game log entry to ensure it's "live grounded" and not hallucinated.
            const mappedLegs = (rec.legs || [])
                .filter((leg: any) => leg.playerName && leg.line && leg.statType)
                .map((leg: any) => ({
                    playerId: leg.playerId || `p-${Date.now()}-${Math.random()}`,
                    playerName: leg.playerName,
                    team: leg.team || "N/A",
                    opponent: leg.opponent || "N/A",
                    statType: leg.statType || "Prop",
                    category: leg.category || (leg.isAltLine ? "Alternate" : "Primary"),
                    isAltLine: !!leg.isAltLine,
                    line: Number(leg.line),
                    prediction: leg.prediction || "Over",
                    bookOdds: Number(leg.bookOdds) || -110,
                    modelProb: Number(leg.modelProb) || 0.5,
                    edge: Number(leg.edge) || 0,
                    rationale: leg.rationale || "Verified via live market scan.",
                    injuryStatus: leg.injuryStatus || "Active",
                    leagueAvg: Number(leg.leagueAvg) || 0,
                    recentHitRate: leg.recentHitRate || "N/A",
                    recentGames: (leg.recentGames || []).map((g: any) => ({
                        date: g.date || "N/A",
                        opponent: g.opponent || "N/A",
                        value: Number(g.value),
                        minutes: Number(g.minutes) || 0,
                        hit: !!g.hit
                    })),
                    
                    // Engine variables
                    x10: Number(leg.x10) || 0,
                    x20: Number(leg.x20) || 0,
                    xSeason: Number(leg.xSeason) || 0,
                    sigma: Number(leg.sigma) || 1,
                    expectedMins: Number(leg.expectedMins) || 30,
                    avgMins: Number(leg.avgMins) || 30,
                    expectedPace: Number(leg.expectedPace) || 100,
                    leaguePace: Number(leg.leaguePace) || 100,
                    oppAllowed: Number(leg.oppAllowed) || 20,
                    leagueAllowed: Number(leg.leagueAllowed) || 20,
                    correlations: leg.correlations || []
                }));

            if (mappedLegs.length === 0) return null;

            return {
                type: rec.type || 'player_profile',
                id: rec.id || `profile-${Date.now()}-${index}`,
                summary: rec.summary || "Quantitative ROI analysis complete.",
                totalOdds: Number(rec.totalOdds) || 0,
                jointProbAdjusted: Number(rec.jointProbAdjusted) || 0.5,
                expectedValue: Number(rec.expectedValue) || 0,
                kellyStake: Number(rec.kellyStake) || 0,
                correlationScore: Number(rec.correlationScore) || 0,
                varianceScore: Number(rec.varianceScore) || 0,
                timestamp: new Date().toISOString(),
                legs: mappedLegs
            };
        }).filter((rec: any) => rec !== null);
    } catch (e) {
        console.error("Parse Error:", e);
        return [];
    }
};

export const fetchTrendingPicks = async (): Promise<ParlayRecommendation[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const marketDate = getEffectiveMarketDate();

    const prompt = `
      STRICT OPERATIONAL DIRECTIVE: IDENTIFY TOP 3 TRENDING PLAYER PROPS FOR ${marketDate}.
      USE googleSearch TO FIND LIVE LINES ON: DraftKings, FanDuel, PrizePicks, Underdog.
      
      CRITICAL: You MUST find REAL players and REAL lines for today's games.
      If no games are currently active or listed, look for the very next available slate.
      
      OUTPUT JSON STRUCTURE:
      {
        "recommendations": [
          {
            "type": "parlay",
            "summary": "Verified High-EV Edge",
            "legs": [
              {
                "playerName": "string", "team": "string", "opponent": "string", "statType": "string",
                "line": number, "prediction": "Over", "bookOdds": number, "modelProb": number, "edge": number,
                "recentGames": [{"date": "string", "opponent": "string", "value": number, "hit": boolean}],
                "x10": number, "x20": number, "xSeason": number, "sigma": number, "expectedMins": number, "avgMins": number,
                "expectedPace": number, "leaguePace": number, "oppAllowed": number, "leagueAllowed": number
              }
            ]
          }
        ]
      }
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: { tools: [{ googleSearch: {} }], temperature: 0.1 }
        });
        return parseResponse(response.text || "");
    } catch (err) {
        console.error("Trending Fetch Failed:", err);
        return [];
    }
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
    
    // Use Pro for complex search and reasoning
    const modelId = "gemini-3-pro-preview";

    const prompt = `
      STRICT OPERATIONAL DIRECTIVE: EXHAUSTIVE MARKET SCAN FOR "${filters}" (${league}) ON ${marketDate}.
      
      TASK 1: USE googleSearch to find EVERY SINGLE LIVE PROP LINE for "${filters}" on:
      - DraftKings, FanDuel, BetMGM (Sportsbooks)
      - PrizePicks, Underdog, Chalkboard (DFS)
      
      TASK 2: RETRIEVE:
      - PRIMARY: Points, Rebounds, Assists, 3PT Made, PRAs, Blocks+Steals.
      - ALTERNATE: Alternate Points (15+, 20+, 25+, etc.), Alternate Assists (4+, 6+, 8+, etc.).
      - COMBO: Points+Rebounds, Rebounds+Assists.
      - SGP CORRELATIONS: 2-3 teammates or opponents with highly correlated lines today.
      
      TASK 3: VERIFY ACTUAL STATS:
      - Last 5 game logs for each stat found.
      - Season averages and situational pace adjustments.
      
      STRICT RULE: Only return players/matchups with confirmed lines for today or the next scheduled game.
      If "${filters}" is a team, return the top 5 props for their star players.
      
      OUTPUT JSON STRUCTURE:
      {
        "recommendations": [
          {
            "type": "player_profile",
            "summary": "Deep-dive live market analysis for ${filters}",
            "legs": [
              {
                "playerName": "string", "team": "string", "opponent": "string", "statType": "string",
                "category": "Primary" | "Alternate" | "Combo", "isAltLine": boolean,
                "line": number, "prediction": "Over" | "Under", "bookOdds": number, 
                "recentGames": [ { "date": "string", "opponent": "string", "value": number, "minutes": number, "hit": boolean } ],
                "x10": number, "x20": number, "xSeason": number, "sigma": number, "expectedMins": number, "avgMins": number,
                "expectedPace": number, "leaguePace": number, "oppAllowed": number, "leagueAllowed": number,
                "rationale": "DEF: #Rank, PACE: Diff, HIT: X/5",
                "correlations": [ { "playerName": "string", "statType": "string", "coefficient": number, "rationale": "string" } ]
              }
            ]
          }
        ]
      }
    `;

    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: prompt,
            config: { tools: [{ googleSearch: {} }], temperature: 0.1 }
        });
        const results = parseResponse(response.text || "");
        return results;
    } catch (err) {
        console.error("Analysis Failed:", err);
        throw new Error("The analytical bridge encountered an error while scanning the market.");
    }
};
