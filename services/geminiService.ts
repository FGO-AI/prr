
import { League, RiskLevel, BettingApp, ParlayRecommendation, BetLeg, GameLogEntry, SubscriptionTier } from "../types";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const getAi = () => {
    const apiKey = (import.meta.env.VITE_GEMINI_API_KEY || "").trim();
    // In this environment, process.env.GEMINI_API_KEY is also available via the platform
    const key = apiKey || (window as any).process?.env?.GEMINI_API_KEY;
    
    if (!key || key.includes("TODO")) {
        throw new Error("Gemini API Key not configured. Please add it in the Settings menu.");
    }
    return new GoogleGenAI({ apiKey: key });
};

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
        // Remove leading '+' from numbers (common in American odds like +124)
        cleaned = cleaned.replace(/:\s*\+(\d+)/g, ': $1');
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
        
        // Be extremely flexible with the root key
        let recs: any[] = [];
        if (Array.isArray(parsed)) {
            recs = parsed;
        } else {
            // Check common keys
            const possibleKeys = ['recommendations', 'parlays', 'picks', 'results', 'data', 'recommendation', 'parlay', 'pick'];
            for (const key of possibleKeys) {
                if (Array.isArray(parsed[key])) {
                    recs = parsed[key];
                    break;
                }
            }
            // If still empty, check if the object itself looks like a recommendation
            if (recs.length === 0 && (parsed.legs || parsed.playerName)) {
                recs = [parsed];
            }
        }

        if (!Array.isArray(recs)) return [];

        return recs.map((rec: any, index: number) => {
            if (!rec) return null;
            
            // Handle cases where legs might be at the root of the recommendation object
            let rawLegs = Array.isArray(rec.legs) ? rec.legs : (Array.isArray(rec) ? rec : []);
            
            // If rec itself looks like a leg, wrap it
            if (rawLegs.length === 0 && (rec.playerName || rec.player || rec.name)) {
                rawLegs = [rec];
            }

            const mappedLegs = rawLegs
                .filter((leg: any) => leg && (leg.playerName || leg.player || leg.name))
                .map((leg: any) => ({
                    playerId: leg.playerId || `p-${Date.now()}-${Math.random()}`,
                    playerName: leg.playerName || leg.player || leg.name,
                    team: leg.team || "N/A",
                    opponent: leg.opponent || "N/A",
                    statType: leg.statType || leg.stat || "Prop",
                    category: leg.category || "Primary",
                    line: Number(leg.line) || 0,
                    prediction: leg.prediction || leg.side || "Over",
                    bookOdds: Number(leg.bookOdds) || Number(leg.odds) || -110,
                    modelProb: Number(leg.modelProb) || Number(leg.probability) || 0.5,
                    edge: Number(leg.edge) || 0,
                    rationale: leg.rationale || leg.analysis || "Analytical edge detected.",
                    marketSentiment: leg.marketSentiment || "Neutral",
                    correlationInsight: leg.correlationInsight || "Standard variance.",
                    gameTime: leg.gameTime || leg.time || "TBD",
                    gameDate: leg.gameDate || leg.date || "TBD",
                    dataSource: leg.dataSource || "Consensus Market",
                    lastUpdated: leg.lastUpdated || new Date().toISOString(),
                    historicalInfluence: leg.historicalInfluence || "Historical data suggests a strong alignment with current market pricing.",
                    marketOdds: leg.marketOdds || {
                        fanDuel: Number(leg.bookOdds) || -110,
                        draftKings: Number(leg.bookOdds) || -110,
                        betMGM: Number(leg.bookOdds) || -110,
                        pinnacle: Number(leg.bookOdds) || -110,
                        caesars: Number(leg.bookOdds) || -110
                    },
                    injuryStatus: leg.injuryStatus || "Active",
                    recentGames: (leg.recentGames || []).map((g: any) => ({
                        date: g.date || "N/A",
                        opponent: g.opponent || "N/A",
                        value: Number(g.value) || 0,
                        hit: g.hit !== undefined ? !!g.hit : true
                    })),
                    x10: Number(leg.x10) || Number(leg.line) || 0,
                    x20: Number(leg.x20) || Number(leg.line) || 0,
                    xSeason: Number(leg.xSeason) || Number(leg.line) || 0,
                    sigma: Number(leg.sigma) || (Number(leg.line) * 0.2) || 1,
                    expectedMins: Number(leg.expectedMins) || 30,
                    avgMins: Number(leg.avgMins) || 30,
                    expectedPace: Number(leg.expectedPace) || 100,
                    leaguePace: Number(leg.leaguePace) || 100,
                    oppAllowed: Number(leg.oppAllowed) || 20,
                    leagueAllowed: Number(leg.leagueAllowed) || 20,
                    
                    // MLB-Specific Mathematical Projection Fields
                    pitcherK9: leg.pitcherK9 !== undefined ? Number(leg.pitcherK9) : undefined,
                    oppKRate: leg.oppKRate !== undefined ? Number(leg.oppKRate) : undefined,
                    avgIpLast5: leg.avgIpLast5 !== undefined ? Number(leg.avgIpLast5) : undefined,
                    isBullpenGame: leg.isBullpenGame !== undefined ? !!leg.isBullpenGame : undefined,
                    pitchCountLimitFactor: leg.pitchCountLimitFactor !== undefined ? Number(leg.pitchCountLimitFactor) : undefined,
                    parkFactor: leg.parkFactor !== undefined ? Number(leg.parkFactor) : undefined,
                    parkHrFactor: leg.parkHrFactor !== undefined ? Number(leg.parkHrFactor) : undefined,
                    parkRunFactor: leg.parkRunFactor !== undefined ? Number(leg.parkRunFactor) : undefined,
                    handednessAdjustment: leg.handednessAdjustment !== undefined ? Number(leg.handednessAdjustment) : undefined,
                    umpireKRate: leg.umpireKRate !== undefined ? Number(leg.umpireKRate) : undefined,
                    homeAwayFactor: leg.homeAwayFactor !== undefined ? Number(leg.homeAwayFactor) : undefined,
                    xBA: leg.xBA !== undefined ? Number(leg.xBA) : undefined,
                    iso: leg.iso !== undefined ? Number(leg.iso) : undefined,
                    oppPitcherEraPlus: leg.oppPitcherEraPlus !== undefined ? Number(leg.oppPitcherEraPlus) : undefined,
                    platoonFactor: leg.platoonFactor !== undefined ? Number(leg.platoonFactor) : undefined,
                    lineupSpot: leg.lineupSpot !== undefined ? Number(leg.lineupSpot) : undefined,
                    teamPace: leg.teamPace !== undefined ? Number(leg.teamPace) : undefined,
                    oppSpQuality: leg.oppSpQuality !== undefined ? Number(leg.oppSpQuality) : undefined,
                    oppPitcherH9Factor: leg.oppPitcherH9Factor !== undefined ? Number(leg.oppPitcherH9Factor) : undefined,
                    babipLuckAdjustment: leg.babipLuckAdjustment !== undefined ? Number(leg.babipLuckAdjustment) : undefined,
                    xFip: leg.xFip !== undefined ? Number(leg.xFip) : undefined,
                    oppWrcPlus: leg.oppWrcPlus !== undefined ? Number(leg.oppWrcPlus) : undefined,
                    bbPct: leg.bbPct !== undefined ? Number(leg.bbPct) : undefined,
                    projectedPA: leg.projectedPA !== undefined ? Number(leg.projectedPA) : undefined,
                    league: leg.league
                }));

            if (mappedLegs.length === 0) return null;

            return {
                type: rec.type || 'player_profile',
                id: rec.id || `profile-${Date.now()}-${index}`,
                summary: rec.summary || rec.rationale || "System Directive Issued.",
                rankingJustification: rec.rankingJustification || "Ranked based on mathematical edge.",
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
        console.error("Parse error:", e);
        return [];
    }
};

const callAi = async (params: { prompt: string; temperature?: number; useSearch?: boolean; thinking?: "LOW" | "HIGH" }) => {
    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [{ text: params.prompt }] },
            config: {
                tools: params.useSearch ? [{ googleSearch: {} }] : undefined,
                temperature: params.temperature ?? 0.4,
                thinkingConfig: { 
                    thinkingLevel: params.thinking === "HIGH" ? ThinkingLevel.HIGH : ThinkingLevel.LOW 
                }
            }
        });

        const text = response.text;
        if (!text) {
            throw new Error("Empty response from AI");
        }
        return { text };
    } catch (error: any) {
        console.error("Gemini API Error:", error);
        if (error.message?.includes("API key not valid")) {
            throw new Error("The Gemini API key is invalid. Please update it in the Settings menu.");
        }
        throw error;
    }
};

export const settleUserPicks = async (recommendations: ParlayRecommendation[]): Promise<ParlayRecommendation[]> => {
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
        const data = await callAi({ prompt, temperature: 0.1, useSearch: true });
        const settlementData = JSON.parse(cleanJsonText(data.text || "{}"));
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

export const fetchTrendingPicks = async (tier: SubscriptionTier = SubscriptionTier.FREE): Promise<ParlayRecommendation[]> => {
    const marketDate = getEffectiveMarketDate();
    
    let recCount = 5;
    let legsPerRec = 5;
    let minProb = 0.60;

    if (tier === SubscriptionTier.PRO) {
        recCount = 5;
        legsPerRec = 15;
        minProb = 0.75;
    } else if (tier === SubscriptionTier.WHALE) {
        recCount = 15;
        legsPerRec = 15;
        minProb = 0.65;
    }

    const metricDepth = tier === SubscriptionTier.FREE ? "Standard" : "Deep Analytical";
    const currentTime = new Date().toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hour12: true });

    // Fetch live schedule data (including playoff stages) from our shared backend endpoint
    let scheduleContext = "";
    try {
        const res = await fetch('/api/nba/games/today');
        if (res.ok) {
            const games = await res.json();
            if (games && games.length > 0) {
                scheduleContext = `VERIFIED CURRENT NBA SCHEDULE (Including Playoff Series):
${games.map((g: any) => `- MATCH: ${g.awayTeam} at ${g.homeTeam} (${g.gameTime}) - Spread: ${g.bookSpread}, Total: ${g.bookTotal} ${g.seriesInfo ? `[${g.seriesInfo}]` : ''}`).join('\n')}

STRICT DIRECTIVE: You MUST focus search grounding on finding live player prop lines for players belongings to the teams actively listed in the verified playoffs/schedule above.`;
            }
        }
    } catch (e) {
        console.error("Failed to load live schedule in fetchTrendingPicks", e);
    }

    const prompt = `
      AI ARCHITECT DIRECTIVE: 
      1. SEARCH GOOGLE for "LIVE ${marketDate} NBA player prop lines" and "NBA injury report ${marketDate}".
      2. VISIT sportsbooks like FanDuel, DraftKings, PrizePicks, and Underdog to find current lines.
      3. IDENTIFY at least 5 UNIQUE recommendations.
      
      ${scheduleContext}
      
      4. Each recommendation should contain multiple legs (picks).
      5. FOR EACH PICK, YOU MUST PROVIDE:
         - The exact "playerName", "team", "opponent", "line", "statType" (Points, Rebounds, etc), and "prediction" (Over/Under).
         - The "gameTime" (e.g., "7:30 PM ET") and "gameDate" (e.g., "${marketDate}").
         - The "dataSource" (e.g., "FanDuel").
      6. PROBABILITY: Only include picks with a high mathematical hit probability (>60%).
      7. LIVE STATUS: Only include games that have NOT started yet. Current time is ${currentTime} PT.
      8. If no games remain for ${marketDate}, search for tomorrow's slate.
      
      RETURN ONLY VALID JSON.
    `;
    try {
        const data = await callAi({ prompt, temperature: 0.2, useSearch: true });
        return parseResponse(data.text || "");
    } catch (err) {
        return [];
    }
};

export const generateParlays = async (
  league: League,
  risk: RiskLevel,
  filters: string,
  statType: string = 'Any',
  advancedMetric: string = 'Standard',
  selectedApp: BettingApp = BettingApp.ALL,
  tier: SubscriptionTier = SubscriptionTier.FREE,
  limit?: number
): Promise<ParlayRecommendation[]> => {
    const marketDate = getEffectiveMarketDate();
    
    let recCount = 5;
    let legsPerRec = 5;
    let minProb = 0.60;

    if (tier === SubscriptionTier.PRO) {
        recCount = 5;
        legsPerRec = 15;
        minProb = 0.75;
    } else if (tier === SubscriptionTier.WHALE) {
        recCount = 15;
        legsPerRec = 15;
        minProb = 0.65;
    }

    if (limit && limit > 0) {
        recCount = limit;
    }

    const metricDepth = tier === SubscriptionTier.FREE ? "Standard" : "Deep Analytical with Historical Influence";

    const filterContext = filters.trim() 
      ? `specifically for player/team "${filters}"` 
      : `for the entire ${league} board`;

    const appConstraint = selectedApp !== BettingApp.ALL 
      ? `The user is using the ${selectedApp} app. Prioritize lines and odds available on ${selectedApp}.`
      : `Search ONLY across these specific sources: Chalkboard, Underdog Fantasy, PrizePicks, FanDuel, DraftKings, BetMGM, and Caesars.`;

    const currentTime = new Date().toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hour12: true });

    // Fetch live schedule data from our shared backend endpoint to feed into the parlay engine
    let scheduleContext = "";
    try {
        const res = await fetch('/api/nba/games/today');
        if (res.ok) {
            const games = await res.json();
            if (games && games.length > 0) {
                scheduleContext = `VERIFIED CURRENT NBA PLAYSLATE (including Playoffs):
${games.map((g: any) => `- MATCH: ${g.awayTeam} at ${g.homeTeam} (${g.gameTime}) - Spread: ${g.bookSpread}, Total: ${g.bookTotal} ${g.seriesInfo ? `[${g.seriesInfo}]` : ''}`).join('\n')}

STRICT PLAY-SLATE FOCUS: You MUST focus search grounding on finding live player prop lines for players actively belongs to the teams listed in the verified schedule above. Do not recommend players for teams not active in this slate unless specifically asked by the filter context.`;
            }
        }
    } catch (e) {
        console.error("Failed to load live schedule in generateParlays", e);
    }

    let mlbPrompting = "";
    if ((league as any) === League.MLB || (league as any) === 'MLB') {
        mlbPrompting = `
      MLB SPECIFIC INSTRUCTION (STATCAST & BASEBALL DATA INTEGRATION):
      For MLB bets, we are running a specialized Statcast Mathematical engine. You MUST search and try to fetch the following advanced parameters for each player prop:
      
      - For Pitcher Strikeouts (most predictive prop): search for the pitcher's current season "pitcherK9", "avgIpLast5" starts, opposition/opponent "oppKRate" (typically 20% to 25% or 0.20-0.25), "umpireKRate" (often between 0.95 and 1.08), "handednessAdjustment" (platoon split, default 1.0 if balanced, 1.15 if lefty-righty advantage).
      - For Batter Total Bases: search/estimate the batter's Statcast "xBA" (expected BA), SLG minus AVG which is "iso" (e.g., 0.170), opposing starting pitcher "oppPitcherEraPlus" (default 100), "platoonFactor" (default 1.12 if platoon advantage, 0.85 if platoon disadvantage), "lineupSpot" (which spot in the lineup, e.g. 1, 2, 3, 4, etc.), "parkHrFactor" (park HR multiplier, e.g., 1.0).
      - For Hits props: search/estimate "xBA" (expected BA), "babipLuckAdjustment" (e.g. -0.02 if BABIP is is too high and regression is expected), "oppPitcherH9Factor" (default 1.0), and batting "lineupSpot".
      - For Earned Runs (pitcher): search season "xFip" (standard: 3.5 - 4.5), pitcher "avgIpLast5", and opponent "oppWrcPlus" (standard: 100).
      - For Walks (batter): search batter's base-on-balls percentage "bbPct" (e.g. 0.085 for 8.5%), and "projectedPA" (e.g., 4.2).
      
      Please populate these fields with realistic or actual grounded Statcast/FanGraphs metrics inside your JSON response legs if available (otherwise supply default/standard estimates as listed in the fields above).
        `;
    }

    const prompt = `
      URGENT MARKET SCAN: Find live player prop lines ${filterContext} for games occurring ONLY on ${marketDate}.
      ${appConstraint}
      
      STRICT TEMPORAL CONSTRAINT: You MUST ONLY return data for games scheduled for ${marketDate} or today's active slate.
      LIVE STATUS CHECK: Only include games that have NOT started yet. Current time is ${currentTime} PT.
      If it is late in the day and no games remain for ${marketDate}, search for the NEXT available slate (tomorrow).
      
      ${scheduleContext}
      
      ${mlbPrompting}
      
      SEARCH DIRECTIVES:
      1. SEARCH GOOGLE for current ${league} player prop lines and injury reports.
      2. VISIT sources like FanDuel, DraftKings, PrizePicks, and Underdog.
      3. EXTRACT the exact line (e.g., 22.5 Points) and the current odds (e.g., -110).
      4. FOR EACH PICK, PROVIDE: "playerName", "team", "line", "statType", "prediction", "gameTime", "gameDate", "dataSource".
      
      TIER CONSTRAINTS:
      - Aim for ${recCount} unique recommendations.
      - Each recommendation should aim for ${legsPerRec} legs.
      - MINIMUM PROBABILITY: Prioritize legs with a hit probability of ${Math.round(minProb * 100)}% or higher. 
      
      DATA SCHEMA:
      {
        "recommendations": [
          {
            "summary": "Strategic rationale",
            "legs": [
              {
                "playerName": "string", "team": "string", "line": number, "statType": "string", "prediction": "Over" | "Under",
                "bookOdds": number, "modelProb": number, "edge": number, "rationale": "string",
                "gameTime": "string", "gameDate": "string", "dataSource": "string"
              }
            ]
          }
        ]
      }
      
      OUTPUT STRICT JSON ONLY.
    `;

    try {
        const data = await callAi({ prompt, temperature: 0.4, useSearch: true, thinking: "LOW" });
        console.log("Raw AI Response:", data.text);
        const parsed = parseResponse(data.text || "");
        return parsed.map(r => ({
            ...r,
            legs: r.legs.map(l => ({ ...l, league }))
        }));
    } catch (err) {
        throw new Error("Market sync failed. The books might be locked for game-time or search grounding is timing out.");
    }
};

export const fetchGroundedOutcomes = async (league: League): Promise<any[]> => {
    const prompt = `Search for 5 recent ${league} prop betting results. JSON: { 'outcomes': [] }`;
    try {
        const data = await callAi({ prompt, temperature: 0.1, useSearch: true });
        const parsed = JSON.parse(cleanJsonText(data.text || ""));
        return (parsed.outcomes || []).map((o: any) => ({ ...o, id: o.id || Math.random() }));
    } catch (err) { return []; }
};
