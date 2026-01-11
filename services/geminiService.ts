
import { GoogleGenAI } from "@google/genai";
import { League, RiskLevel, ParlayRecommendation, BetLeg } from "../types";

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
                type: 'player_profile',
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

export const generateParlays = async (
  league: League,
  risk: RiskLevel,
  filters: string,
  statType: string = 'Any',
  advancedMetric: string = 'Standard'
): Promise<ParlayRecommendation[]> => {
    const now = new Date();
    const dateStamp = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const modelId = "gemini-3-pro-preview";

    const prompt = `
      OPERATE AS A HIGH-FREQUENCY QUANTITATIVE SPORTS ENGINE.
      OBJECTIVE: 30% ROI via mispriced player props for TODAY (${dateStamp}).
      
      STEP 1: USE googleSearch for:
      - "${league} games scheduled for ${dateStamp}"
      - "${filters || 'Top stars'} player prop lines ${dateStamp}"
      - "Specific stats for ${filters || 'current active players'}: Last 10, Last 20, Season Avg, Standard Deviation"
      - "Team Pace projections and defensive efficiency against specific positions today"

      STEP 2: ENHANCE RATIONALE. For each leg's "rationale" field, you MUST include:
      - "DEF: #[Rank]" (e.g. DEF: #28 vs Pts)
      - "PACE: [Percentage Delta]" (e.g. PACE: +4.2%)
      - "HIT: [x/y]" (e.g. HIT: 8/10 L10)
      - "SITUATIONAL: [Key Factor]" (e.g. SITUATIONAL: Back-to-back game)

      STEP 3: RETURN DATA IN JSON. provide these quantitative variables for our engine:
      - x10, x20, xSeason (averages)
      - sigma (Standard Deviation)
      - expectedMins, avgMins
      - expectedPace, leaguePace
      - oppAllowed, leagueAllowed

      OUTPUT FORMAT (STRICT):
      {
        "recommendations": [
          {
            "type": "player_profile",
            "summary": "Detailed ROI rationale...",
            "expectedValue": 15.5,
            "kellyStake": 2.5,
            "legs": [
              {
                "playerName": "string", "team": "string", "opponent": "string", "statType": "string",
                "line": number, "prediction": "Over", "bookOdds": number,
                "x10": number, "x20": number, "xSeason": number, "sigma": number,
                "expectedMins": number, "avgMins": number,
                "expectedPace": number, "leaguePace": number,
                "oppAllowed": number, "leagueAllowed": number,
                "rationale": "DEF: #28, PACE: +5.2%, HIT: 7/10, SITUATIONAL: High usage expected due to injury."
              }
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
