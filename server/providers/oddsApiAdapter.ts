import { DatabaseSync } from "node:sqlite";
import { americanToDecimal, SETTLEMENT_RULES_VERSIONS } from "../core/marketPricing";
import { LeagueCode, MarketSnapshot } from "../core/types";
import { logMonitoringEvent } from "../db/database";

const SPORT_KEYS: Record<LeagueCode, string> = {
  NBA: "basketball_nba",
  NFL: "americanfootball_nfl",
  MLB: "baseball_mlb"
};

export async function fetchOddsSnapshotForGame(params: {
  league: LeagueCode;
  gameId: string;
  homeTeamName: string;
  awayTeamName: string;
  cutoffUtc?: string;
  userSupplied?: {
    homePriceAmerican?: number | null;
    awayPriceAmerican?: number | null;
    spreadLine?: number | null;
  };
  db?: DatabaseSync;
}): Promise<MarketSnapshot | null> {
  const cutoffIso = params.cutoffUtc || new Date().toISOString();

  // 1. Check persisted immutable odds snapshot before cutoffUtc first
  if (params.db) {
    const existing = params.db.prepare(
      `SELECT * FROM odds_snapshots WHERE game_id = ? AND captured_utc <= ? AND is_user_supplied = 0 ORDER BY captured_utc DESC LIMIT 1`
    ).get(params.gameId, cutoffIso) as any;
    if (existing) {
      return {
        oddsId: existing.odds_id,
        gameId: existing.game_id,
        league: existing.league,
        sportsbook: existing.sportsbook,
        marketType: existing.market_type,
        period: existing.period,
        line: existing.line,
        homePriceAmerican: existing.home_price_american,
        awayPriceAmerican: existing.away_price_american,
        overPriceAmerican: existing.over_price_american,
        underPriceAmerican: existing.under_price_american,
        homeDecimal: existing.home_decimal,
        awayDecimal: existing.away_decimal,
        settlementRulesVersion: existing.settlement_rules_version,
        capturedUtc: existing.captured_utc,
        source: existing.source,
        isUserSupplied: false,
        status: existing.status
      };
    }
  }

  // 2. Try live Odds API if key is configured and cutoff is near-real-time
  const apiKey = process.env.ODDS_API_KEY;
  if (apiKey) {
    try {
      const sportKey = SPORT_KEYS[params.league];
      const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${apiKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const list = await res.json();
        const match = Array.isArray(list)
          ? list.find(
              (g: any) =>
                g.home_team?.toLowerCase().includes(params.homeTeamName.split(" ").pop()?.toLowerCase() || "") &&
                g.away_team?.toLowerCase().includes(params.awayTeamName.split(" ").pop()?.toLowerCase() || "")
            )
          : null;
        if (match) {
          const book = match.bookmakers?.find((b: any) => ["pinnacle", "draftkings", "fanduel", "betmgm"].includes(b.key)) || match.bookmakers?.[0];
          const h2h = book?.markets?.find((m: any) => m.key === "h2h");
          const spreadM = book?.markets?.find((m: any) => m.key === "spreads");
          const homeH2H = h2h?.outcomes?.find((o: any) => o.name === match.home_team)?.price ?? null;
          const awayH2H = h2h?.outcomes?.find((o: any) => o.name === match.away_team)?.price ?? null;
          const homeSpread = spreadM?.outcomes?.find((o: any) => o.name === match.home_team)?.point ?? null;
          const capturedUtc = new Date().toISOString();

          const snap: MarketSnapshot = {
            oddsId: `odds_${params.gameId}_${Date.now()}`,
            gameId: params.gameId,
            league: params.league,
            sportsbook: book?.title || "TheOddsAPI",
            marketType: "h2h",
            period: "full_game",
            line: homeSpread,
            homePriceAmerican: homeH2H,
            awayPriceAmerican: awayH2H,
            overPriceAmerican: null,
            underPriceAmerican: null,
            homeDecimal: homeH2H ? americanToDecimal(homeH2H) : null,
            awayDecimal: awayH2H ? americanToDecimal(awayH2H) : null,
            settlementRulesVersion: SETTLEMENT_RULES_VERSIONS[params.league],
            capturedUtc,
            source: "the_odds_api_v4",
            isUserSupplied: false,
            status: "confirmed"
          };

          if (params.db) {
            persistOddsSnapshot(params.db, snap);
          }
          return snap;
        }
      } else if (params.db) {
        logMonitoringEvent(params.db, {
          severity: "warn",
          source: "the_odds_api",
          league: params.league,
          eventType: "odds_api_http_error",
          message: `The Odds API returned HTTP ${res.status}`
        });
      }
    } catch (err: any) {
      if (params.db) {
        logMonitoringEvent(params.db, {
          severity: "warn",
          source: "the_odds_api",
          league: params.league,
          eventType: "odds_api_error",
          message: err?.message || "Odds fetch error"
        });
      }
    }
  }

  // 3. If user explicitly supplied market prices in UI, record as user_supplied snapshot (never claim live feed!)
  const uHome = params.userSupplied?.homePriceAmerican;
  const uAway = params.userSupplied?.awayPriceAmerican;
  if (typeof uHome === "number" && Number.isFinite(uHome) && uHome !== 0 && typeof uAway === "number" && Number.isFinite(uAway) && uAway !== 0) {
    const snap: MarketSnapshot = {
      oddsId: `odds_user_${params.gameId}_${Date.now()}`,
      gameId: params.gameId,
      league: params.league,
      sportsbook: "User-Supplied Sportsbook Input",
      marketType: "h2h",
      period: "full_game",
      line: params.userSupplied?.spreadLine ?? null,
      homePriceAmerican: uHome,
      awayPriceAmerican: uAway,
      overPriceAmerican: null,
      underPriceAmerican: null,
      homeDecimal: americanToDecimal(uHome),
      awayDecimal: americanToDecimal(uAway),
      settlementRulesVersion: SETTLEMENT_RULES_VERSIONS[params.league],
      capturedUtc: cutoffIso,
      source: "user_input",
      isUserSupplied: true,
      status: "confirmed"
    };
    if (params.db) persistOddsSnapshot(params.db, snap);
    return snap;
  }

  // 4. Explicit unavailable state — never fabricate odds
  return null;
}

export function persistOddsSnapshot(db: DatabaseSync, snap: MarketSnapshot) {
  db.prepare(
    `INSERT OR IGNORE INTO odds_snapshots (
      odds_id, game_id, league, sportsbook, market_type, period, line,
      home_price_american, away_price_american, draw_price_american,
      over_price_american, under_price_american, home_decimal, away_decimal,
      settlement_rules_version, captured_utc, source, is_user_supplied, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    snap.oddsId, snap.gameId, snap.league, snap.sportsbook, snap.marketType, snap.period, snap.line,
    snap.homePriceAmerican, snap.awayPriceAmerican, snap.drawPriceAmerican ?? null,
    snap.overPriceAmerican, snap.underPriceAmerican, snap.homeDecimal, snap.awayDecimal,
    snap.settlementRulesVersion, snap.capturedUtc, snap.source, snap.isUserSupplied ? 1 : 0, snap.status
  );
}
