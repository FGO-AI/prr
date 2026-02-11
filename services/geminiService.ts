
import { GoogleGenAI } from "@google/genai";
import { League, RiskLevel, ParlayRecommendation, BetLeg, GameLogEntry } from "../types";

const cleanJsonText = (text: string): string => {
    if (!text) return "{}";
    // Remove potential markdown code block markers
    let cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    try {
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        const firstBracket = cleaned.indexOf('[');
        const lastBracket = cleaned.lastIndexOf(']');

        // Determine if we are looking for an object or an array as the root
        let start = -1;
        let end = -1;

        if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
            start = firstBrace;
            end = lastBrace;
        } else if (firstBracket !== -1) {
            start = firstBracket;
            end = lastBracket;
        }

        if (start === -1 || end === -1) return "{}";
        
        cleaned = cleaned.substring(start, end + 1);
        
        // Remove trailing commas which break standard JSON.parse
        cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
        // Simple comment removal (lines starting with //)
        cleaned = cleaned.replace(/^\s*\/\/.*$/gm, '');
        
        return cleaned;
    } catch (e) {
        return "{}";
    }
};

const getEffectiveMarketDate = () => {
    const now = new Date();
    const mtStr = now.toLocaleString("en-US", { timeZone: "America/Denver", hour12: false });
    const parts = mtStr.split(', ');
    const hour = parseInt(parts[1].split(':')[0], 10);
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
        if (jsonString === "{}" || jsonString === "[]") return [];
        
        const parsed = JSON.parse(jsonString);
        
        // Handle cases where recommendations might be wrapped differently or be the root array
        const recs = Array.isArray(parsed) ? parsed : (parsed.recommendations || parsed.parlays || parsed.picks || []);
        if (!Array.isArray(recs)) return [];

        return recs.map((rec: any, index: number) => {
            const mappedLegs = (rec.legs || [])
                .filter((leg: any) => leg.playerName && leg.line)
                .map((leg: any) => ({
                    playerId: leg.playerId || `p-${Date.now()}-${Math.random()}`,
                    playerName: leg.playerName,
                    team: leg.team || "N/A",
                    opponent: leg.opponent || "N/A",
                    statType: leg.statType || "Prop",
                    category: leg.category || "Primary",
                    line: Number(leg.line),
                    prediction: leg.prediction || "Over",
                    bookOdds: Number(leg.bookOdds) || -110,
                    modelProb: Number(leg.modelProb) || 0.5,
                    edge: Number(leg.edge) || 0,
                    rationale: leg.rationale || "Analytical edge detected.",
                    injuryStatus: leg.injuryStatus || "Active",
                    recentGames: (leg.recentGames || []).map((g: any) => ({
                        date: g.date || "N/A",
                        opponent: g.opponent || "N/A",
                        value: Number(g.value),
                        hit: !!g.hit
                    })),
                    x10: Number(leg.x10) || Number(leg.line),
                    x20: Number(leg.x20) || Number(leg.line),
                    xSeason: Number(leg.xSeason) || Number(leg.line),
                    sigma: Number(leg.sigma) || (Number(leg.line) * 0.2),
                    expectedMins: Number(leg.expectedMins) || 30,
                    avgMins: Number(leg.avgMins) || 30,
                    expectedPace: Number(leg.expectedPace) || 100,
                    leaguePace: Number(leg.leaguePace) || 100,
                    oppAllowed: Number(leg.oppAllowed) || 20,
                    leagueAllowed: Number(leg.leagueAllowed) || 20
                }));

            if (mappedLegs.length === 0) return null;

            return {
                type: rec.type || 'player_profile',
                id: rec.id || `profile-${Date.now()}-${index}`,
                summary: rec.summary || "System Directive Issued.",
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
        console.error("Critical JSON Parse Failure:", e);
        return [];
    }
};

export const fetchTrendingPicks = async (): Promise<ParlayRecommendation[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const marketDate = getEffectiveMarketDate();
    const prompt = `
      AI ARCHITECT DIRECTIVE: IDENTIFY TOP 3 'LOCK-TIER' BETS FOR ${marketDate}.
      SEARCH DraftKings/FanDuel/PrizePicks for live lines.
      
      FOR EACH PICK:
      1. Choose a side (OVER or UNDER) based on market edge.
      2. MATH RATIONALE: "Line at X vs Model μ Y = ROI Edge Z%".
      3. REQUIRED STATS: include "expectedMins", "avgMins", "expectedPace", "leaguePace", "oppAllowed", "leagueAllowed" numbers.
      4. Include recent game history.
      
      OUTPUT VALID JSON ONLY. NO MARKDOWN.
    `;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { tools: [{ googleSearch: {} }], temperature: 0.1 }
        });
        return parseResponse(response.text || "");
    } catch (err) {
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
    
    const filterContext = filters.trim() 
      ? `targeting the player/team: "${filters}"` 
      : `searching for the highest-edge Alpha Picks in the ${league} market right now`;

    const prompt = `
      EXECUTE FULL MARKET SCAN ${filterContext} ON ${marketDate} (${league}).
      DO NOT BE PASSIVE. ISSUE A MATHEMATICAL DIRECTIVE.

      CORE INSTRUCTIONS:
      1. If searching for a specific player/team ("${filters}") yields no live lines, IGNORE THAT FILTER and return the top 3 players in the ${league} with the largest mathematical discrepancy.
      2. You MUST provide: "playerName", "team", "line", "prediction" (Over/Under), "bookOdds", "modelProb", "edge", "rationale".
      3. TECHNICAL PARAMS REQUIRED for the engine breakdown:
         - "expectedMins": number (projected mins today)
         - "avgMins": number (season average mins)
         - "expectedPace": number (this game's projected pace)
         - "leaguePace": number (league average pace)
         - "oppAllowed": number (stat allowed by opponent vs this position)
         - "leagueAllowed": number (league average stat allowed by all teams)
         - "x10", "x20", "xSeason": numbers (recent averages)
      4. MATH JUSTIFICATION: Compare Book Line (L) to your Projected Mean (μ).

      OUTPUT FORMAT: STRICT JSON.
      {
        "recommendations": [
          {
            "summary": "SYSTEM VERDICT: AGGRESSIVE ALPHA DETECTED",
            "legs": [
              {
                "playerName": "string", "team": "string", "line": number, "prediction": "Over" | "Under",
                "bookOdds": number, "modelProb": number, "edge": number,
                "rationale": "MATH: Line X vs μ Y. Divergence Z...",
                "expectedMins": number, "avgMins": number, "expectedPace": number, "leaguePace": number,
                "oppAllowed": number, "leagueAllowed": number,
                "recentGames": [{"date": "string", "value": number, "hit": boolean}]
              }
            ]
          }
        ]
      }
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: { tools: [{ googleSearch: {} }], temperature: 0.1 }
        });
        const results = parseResponse(response.text || "");
        return results;
    } catch (err) {
        throw new Error("The mathematical bridge to the market was interrupted. Retry connection.");
    }
};

export const fetchGroundedOutcomes = async (league: League): Promise<any[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Search for 5 recent prop betting outcomes for ${league}. Return JSON with 'outcomes' array.`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { tools: [{ googleSearch: {} }], temperature: 0.1, responseMimeType: "application/json" }
        });
        const parsed = JSON.parse(cleanJsonText(response.text || ""));
        return (parsed.outcomes || []).map((o: any) => ({ ...o, id: o.id || Math.random() }));
    } catch (err) { return []; }
};
