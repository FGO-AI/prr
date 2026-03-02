
import { GoogleGenAI, Type } from "@google/genai";
import { League, RiskLevel, ParlayRecommendation, BetLeg, GameLogEntry } from "../types";

const cleanJsonText = (text: string): string => {
    if (!text) return "{}";
    let cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    try {
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        const firstBracket = cleaned.indexOf('[');
        const lastBracket = cleaned.lastIndexOf(']');

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
        cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
        cleaned = cleaned.replace(/^\s*\/\/.*$/gm, '');
        return cleaned;
    } catch (e) {
        return "{}";
    }
};

const getEffectiveMarketDate = () => {
    const now = new Date();
    return now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};

const parseResponse = (text: string): ParlayRecommendation[] => {
    try {
        const jsonString = cleanJsonText(text);
        if (jsonString === "{}" || jsonString === "[]") return [];
        
        const parsed = JSON.parse(jsonString);
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
        return [];
    }
};

export const settleUserPicks = async (recommendations: ParlayRecommendation[]): Promise<ParlayRecommendation[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const pickDescriptions = recommendations.flatMap(r => r.legs).map(l => 
        `${l.playerName} ${l.statType} (Line: ${l.line}) on ${l.opponent}`
    ).join(", ");

    const prompt = `
      SETTLEMENT AGENT DIRECTIVE:
      Search for the ACTUAL game statistics for the following player props: ${pickDescriptions}.
      Determine if each prop hit or missed based on the target line.
      Return JSON only.
      {
        "settlements": [
          { "playerName": "string", "actualValue": number, "status": "Hit" | "Miss" | "Void" | "Pending" }
        ]
      }
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { 
                tools: [{ googleSearch: {} }], 
                temperature: 0.1,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        settlements: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    playerName: { type: Type.STRING },
                                    actualValue: { type: Type.NUMBER },
                                    status: { type: Type.STRING }
                                },
                                required: ["playerName", "actualValue", "status"]
                            }
                        }
                    },
                    required: ["settlements"]
                }
            }
        });
        
        const settlementData = JSON.parse(cleanJsonText(response.text || "{}"));
        const settlements = settlementData.settlements || [];

        return recommendations.map(rec => ({
            ...rec,
            legs: rec.legs.map(leg => {
                const match = settlements.find((s: any) => s.playerName.toLowerCase().includes(leg.playerName.toLowerCase()));
                if (match) {
                    return { ...leg, actualValue: match.actualValue, settledStatus: match.status as any };
                }
                return leg;
            })
        }));
    } catch (err) {
        console.error("Settlement failed", err);
        return recommendations;
    }
};

export const fetchTrendingPicks = async (): Promise<ParlayRecommendation[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const marketDate = getEffectiveMarketDate();
    const prompt = `
      AI ARCHITECT DIRECTIVE: 
      1. SEARCH Google for "${marketDate} NBA player prop lines FanDuel DraftKings" and "${marketDate} NBA injury reports".
      2. IDENTIFY 3 UNIQUE players with the highest mathematical edge.
      3. DIVERSITY: You MUST pick players from DIFFERENT teams.
      4. SIDE-BALANCE: You MUST provide a mix of OVER and UNDER recommendations. Do not return all Overs.
      5. Include specific stats: Points, Rebounds, Assists, etc.
      
      OUTPUT VALID JSON.
    `;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { tools: [{ googleSearch: {} }], temperature: 0.2 }
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
      ? `specifically for player/team "${filters}"` 
      : `for the entire ${league} board`;

    const prompt = `
      URGENT MARKET SCAN: Find live player prop lines ${filterContext} for today ${marketDate}.
      
      SEARCH REQUIREMENTS:
      - Use Google Search to find current lines on FanDuel, DraftKings, PrizePicks, or Underdog.
      - If searching for a specific name ("${filters}") yields no live lines, broaden your search to find ANY high-edge picks for ${league} today.
      
      CORE DIRECTIVES:
      1. DIVERSITY: Do not repeat players. Return at least 3 UNIQUE players from 3 DIFFERENT teams.
      2. SIDE-BALANCE: Return a healthy mix of both 'OVER' and 'UNDER' picks. 
      3. UNDER-FOCUS: Actively search for 'UNDER' lines where the public has inflated the line.
      4. CATEGORY: Explicitly specify if the stat is Points, Assists, Rebounds, 3PM, etc.
      
      DATA SCHEMA:
      {
        "recommendations": [
          {
            "legs": [
              {
                "playerName": "string", "team": "string", "line": number, "statType": "string", "prediction": "Over" | "Under",
                "bookOdds": number, "modelProb": number, "edge": number, "rationale": "string",
                "expectedMins": number, "avgMins": number, "expectedPace": number, "leaguePace": number,
                "oppAllowed": number, "leagueAllowed": number, "x10": number, "x20": number, "xSeason": number
              }
            ]
          }
        ]
      }
      
      OUTPUT STRICT JSON.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: { tools: [{ googleSearch: {} }], temperature: 0.3 }
        });
        return parseResponse(response.text || "");
    } catch (err) {
        throw new Error("Market sync failed. The books might be locked for game-time or search grounding is timing out.");
    }
};

export const fetchGroundedOutcomes = async (league: League): Promise<any[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Search for 5 recent ${league} prop betting results. JSON: { 'outcomes': [] }`;
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
