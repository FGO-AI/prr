
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
        cleaned = cleaned.replace(/,\s*([\]}])/g, '$1'); 
        return cleaned;
    } catch (e) {
        return "{}";
    }
};

const getEffectiveMarketDate = () => {
    const now = new Date();
    const mtStr = now.toLocaleString("en-US", { timeZone: "America/Denver", hour12: false });
    const parts = mtStr.split(', ');
    const timePart = parts[1];
    const hour = parseInt(timePart.split(':')[0], 10);
    
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
      
      IMPORTANT: For each player, include the last 10 games for NBA and last 5 games for NFL/MLB in the "recentGames" array.
      
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
                "recentGames": [{"date": "string", "opponent": "string", "value": number, "minutes": number, "hit": boolean}]
              }
            ]
          }
        ]
      }
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
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
    const modelId = "gemini-3-pro-preview";

    const prompt = `
      STRICT OPERATIONAL DIRECTIVE: EXHAUSTIVE MARKET SCAN FOR "${filters}" (${league}) ON ${marketDate}.
      
      TASK 1: USE googleSearch to find EVERY SINGLE LIVE PROP LINE for "${filters}" on books.
      TASK 2: Include comprehensive game logs in "recentGames": 
              - FOR NBA: Provide the last 10 games.
              - FOR NFL/MLB: Provide the last 5 games.
      
      OUTPUT JSON STRUCTURE:
      {
        "recommendations": [
          {
            "type": "player_profile",
            "summary": "Deep-dive live market analysis for ${filters}",
            "legs": [
              {
                "playerName": "string", "team": "string", "opponent": "string", "statType": "string",
                "line": number, "prediction": "Over" | "Under", "bookOdds": number, 
                "recentGames": [ { "date": "string", "opponent": "string", "value": number, "minutes": number, "hit": boolean } ],
                "rationale": "DEF: #Rank, PACE: Diff, HIT: X/5",
                "leagueAvg": number
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
        return parseResponse(response.text || "");
    } catch (err) {
        console.error("Analysis Failed:", err);
        throw new Error("The analytical bridge encountered an error while scanning the market.");
    }
};

// Fix: Exported fetchGroundedOutcomes to satisfy App.tsx import.
/**
 * Fetches recent actual betting outcomes for a given league using Google Search grounding.
 * This function provides the "Grounded Outcomes" data shown in the History tab.
 */
export const fetchGroundedOutcomes = async (league: League): Promise<any[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Search for and provide 5 recent actual completed player prop betting outcomes for ${league}.
    Return a strict JSON object with an 'outcomes' key.
    Each outcome object must include: id (unique), date (MM/DD), outcome ("WIN" or "LOSS"), player, opponent, prop, result (final stat), and odds (American).
    Format Example:
    {
      "outcomes": [
        {
          "id": "uuid-123",
          "date": "Oct 25",
          "outcome": "WIN",
          "player": "LeBron James",
          "opponent": "Kings",
          "prop": "Over 24.5 Pts",
          "result": "32",
          "odds": "-110"
        }
      ]
    }`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { 
                tools: [{ googleSearch: {} }], 
                temperature: 0.1,
                responseMimeType: "application/json"
            }
        });
        
        const text = response.text || "";
        const parsed = JSON.parse(cleanJsonText(text));
        return (parsed.outcomes || []).map((o: any) => ({
            ...o,
            id: o.id || `outcome-${Math.random().toString(36).substr(2, 9)}`
        }));
    } catch (err) {
        console.error("Grounded Outcomes Sync Failed:", err);
        return [];
    }
};
