import { GoogleGenAI } from "@google/genai";
import { League, RiskLevel, ParlayRecommendation, BetLeg } from "../types";

const cleanJsonText = (text: string): string => {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) {
        throw new Error("Analytical engine output error. Market volatility high.");
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
                playerName: leg.playerName || "Unknown Player",
                team: leg.team || "N/A",
                opponent: leg.opponent || "N/A",
                statType: leg.statType || "Prop",
                line: Number(leg.line) || 0,
                prediction: leg.prediction || "Over",
                bookOdds: Number(leg.bookOdds) || -110,
                modelProb: Number(leg.modelProb) || 0.52,
                impliedProb: Number(leg.impliedProb) || 0.523,
                edge: Number(leg.edge) || 0,
                rationale: leg.rationale || "Verified via market search.",
                injuryStatus: leg.injuryStatus || "Active",
                leagueAvg: Number(leg.leagueAvg) || 0,
                recentHitRate: leg.recentHitRate || "N/A"
            }));

            const activeLegs = mappedLegs.filter((leg: any) => {
                const status = (leg.injuryStatus || "").toLowerCase();
                return !status.includes('out') && !status.includes('doubtful') && !status.includes('injured');
            });

            return {
                type: 'player_profile',
                id: rec.id || `profile-${Date.now()}-${index}`,
                summary: rec.summary || "Real-time analysis complete.",
                totalOdds: Number(rec.totalOdds) || 0,
                jointProbAdjusted: Number(rec.jointProbAdjusted) || 0,
                expectedValue: Number(rec.expectedValue) || 0,
                kellyStake: Number(rec.kellyStake) || 0,
                correlationScore: Number(rec.correlationScore) || 0,
                varianceScore: Number(rec.varianceScore) || 0,
                timestamp: new Date().toISOString(),
                legs: activeLegs
            };
        }).filter((rec: any) => rec.legs.length > 0);
    } catch (e) {
        console.error("Data Extraction Error:", e);
        throw new Error("Terminal parsing exception. Re-initializing...");
    }
};

export const generateParlays = async (
  league: League,
  risk: RiskLevel,
  filters: string,
  statType: string = 'Any',
  advancedMetric: string = 'Standard'
): Promise<ParlayRecommendation[]> => {
    const apiKey = process.env.API_KEY;
    const now = new Date();
    const dateStamp = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    if (!apiKey) throw new Error("API Key Missing.");

    const ai = new GoogleGenAI({ apiKey });
    const modelId = "gemini-3-pro-preview";

    const searchContext = filters && filters.length > 1 
        ? `the player "${filters}"` 
        : `the 5 most popular ${league} stars scheduled for TODAY (${dateStamp})`;

    const prompt = `
      OPERATE AS A HIGH-FREQUENCY QUANTITATIVE SPORTS ANALYST.
      TARGET: Identify mispriced props to achieve a 30% ROI.
      TIME: ${dateStamp}, ${now.toLocaleTimeString()}
      
      STEP 1: USE googleSearch for:
      - "SCHEDULED ${league} GAMES TODAY ${dateStamp}"
      - "LIVE PLAYER PROPS ${searchContext} ${dateStamp}"
      - "OPPONENT DEFENSIVE RANKING vs [Player Position] for today's games"
      - "PROJECTED POSSESSION COUNT/PACE for tonight's games"

      STEP 2: ANALYSIS REQUIREMENTS:
      - Calculate a "ROI Projection" based on the Edge and Market Odd mispricing.
      - Mandate the rationale includes:
        1. DEF RANK: Rank vs specific position (e.g. "Opponent ranks 28th vs SG").
        2. PACE DELTA: How the game speed affects this specific stat.
        3. HIT RATE: Verified L5 and L10 hit rate for THIS exact line.
        4. ROI RATIONALE: Why this prop specifically contributes to a 30% ROI strategy.

      STEP 3: OUTPUT FIELDS FOR EACH PROP:
      - playerName, team, opponent, statType, line, prediction, bookOdds.
      - modelProb (float 0-1), edge (float).
      - leagueAvg: Contextual baseline for the player's position.
      - recentHitRate: e.g., "9/10".
      - injuryStatus: Active confirmation only.

      JSON OUTPUT FORMAT:
      {
        "recommendations": [
          {
            "type": "player_profile",
            "summary": "Quantitative breakdown targeting 30% ROI...",
            "expectedValue": number (e.g. 15.5 for 15.5% EV),
            "kellyStake": number (suggested bankroll % to maintain ROI),
            "legs": [
              {
                "playerName": "string",
                "team": "string",
                "opponent": "string",
                "statType": "string",
                "line": number,
                "prediction": "Over" | "Under",
                "bookOdds": number,
                "modelProb": number,
                "edge": number,
                "rationale": "DEF: [rank], PACE: [delta], HIT: [rate]. [ROI logic].",
                "leagueAvg": number,
                "recentHitRate": "string",
                "injuryStatus": "Active"
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
        if (!response.text) throw new Error("Terminal connection lost.");
        return parseResponse(response.text);
    } catch (error: any) {
        console.error("Gemini Error:", error.message);
        throw error;
    }
};