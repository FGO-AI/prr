import fs from "node:fs";
import path from "node:path";
import { normalizeTeam } from "../core/venues";

export interface NflverseGameRow {
  game_id: string;
  season: number;
  game_type: string;
  week: number;
  gameday: string;
  gametime: string;
  away_team: string;
  away_score: number | null;
  home_team: string;
  home_score: number | null;
  location: string;
  result: number | null; // home_score - away_score
  total: number | null;
  overtime: number;
  away_rest: number | null;
  home_rest: number | null;
  away_moneyline: number | null;
  home_moneyline: number | null;
  spread_line: number | null; // nflverse convention: positive = home favored by X points!
  total_line: number | null;
  div_game: number;
  roof: string;
  surface: string;
  temp: number | null;
  wind: number | null;
  away_qb_name: string;
  home_qb_name: string;
  away_coach: string;
  home_coach: string;
  referee: string;
  stadium: string;
}

export interface NflverseTeamWeekRow {
  season: number;
  week: number;
  team: string;
  opponent_team: string;
  game_id: string;
  passing_epa: number;
  rushing_epa: number;
  passing_cpoe: number;
  sacks_suffered: number;
  def_sacks: number;
  def_qb_hits: number;
  passing_interceptions: number;
  def_interceptions: number;
  fumbles_lost_total: number;
  fumble_recovery_opp: number;
  passing_first_downs: number;
  rushing_first_downs: number;
  attempts: number;
  carries: number;
  passing_20: number;
  rushing_20: number;
  penalties: number;
  penalty_yards: number;
  fg_made: number;
  fg_att: number;
  pt_net_yards: number;
  pt_att: number;
}

export interface NflTeamRollingMetrics {
  teamAbbr: string;
  gamesPlayed: number;
  offPassEpaPerPlay: number;
  offRushEpaPerPlay: number;
  defPassEpaAllowedPerPlay: number;
  defRushEpaAllowedPerPlay: number;
  offSuccessProxy: number; // First downs / total plays (pass+rush)
  defSuccessAllowedProxy: number;
  explosivePlayRate: number; // (pass20+ + rush20+) / total plays
  cpoe: number;
  sackAllowedRate: number;
  defPressureProxyRate: number; // (def_sacks + 0.5*qb_hits) / opp_dropbacks_proxy
  interceptionRate: number;
  fumbleLuckNet: number; // fumble recoveries opp - own fumbles lost (high-variance luck indicator)
  penaltyYardsPerGame: number;
  fgPct: number;
  lastGameQb?: string;
  lastGameCoach?: string;
  lastGameday?: string;
}

const CACHE_DIR = path.join(process.cwd(), "data", "cache");

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

async function fetchCachedText(filename: string, url: string, maxAgeHours: number = 12): Promise<string> {
  ensureCacheDir();
  const filePath = path.join(CACHE_DIR, filename);
  if (fs.existsSync(filePath)) {
    const stat = fs.statSync(filePath);
    if (Date.now() - stat.mtimeMs < maxAgeHours * 3600 * 1000) {
      return fs.readFileSync(filePath, "utf8");
    }
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    if (fs.existsSync(filePath)) return fs.readFileSync(filePath, "utf8");
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  const text = await res.text();
  fs.writeFileSync(filePath, text, "utf8");
  return text;
}

const numOrNull = (v: string | undefined): number | null => {
  if (v === undefined || v === "" || v === "NA" || v === "NaN") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const numOrZero = (v: string | undefined): number => numOrNull(v) ?? 0;

export async function loadNflverseGames(): Promise<NflverseGameRow[]> {
  const csv = await fetchCachedText(
    "nflverse_games.csv",
    "https://github.com/nflverse/nfldata/raw/master/data/games.csv",
    12
  );
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  const idx = Object.fromEntries(headers.map((h, i) => [h, i]));

  const rows: NflverseGameRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = parseCsvLine(lines[i]);
    if (c.length < 10) continue;
    rows.push({
      game_id: c[idx.game_id],
      season: Number(c[idx.season]),
      game_type: c[idx.game_type],
      week: Number(c[idx.week]),
      gameday: c[idx.gameday],
      gametime: c[idx.gametime] || "13:00",
      away_team: c[idx.away_team],
      away_score: numOrNull(c[idx.away_score]),
      home_team: c[idx.home_team],
      home_score: numOrNull(c[idx.home_score]),
      location: c[idx.location] || "Home",
      result: numOrNull(c[idx.result]),
      total: numOrNull(c[idx.total]),
      overtime: Number(c[idx.overtime] || 0),
      away_rest: numOrNull(c[idx.away_rest]),
      home_rest: numOrNull(c[idx.home_rest]),
      away_moneyline: numOrNull(c[idx.away_moneyline]),
      home_moneyline: numOrNull(c[idx.home_moneyline]),
      spread_line: numOrNull(c[idx.spread_line]),
      total_line: numOrNull(c[idx.total_line]),
      div_game: Number(c[idx.div_game] || 0),
      roof: c[idx.roof] || "outdoors",
      surface: c[idx.surface] || "grass",
      temp: numOrNull(c[idx.temp]),
      wind: numOrNull(c[idx.wind]),
      away_qb_name: c[idx.away_qb_name] || "",
      home_qb_name: c[idx.home_qb_name] || "",
      away_coach: c[idx.away_coach] || "",
      home_coach: c[idx.home_coach] || "",
      referee: c[idx.referee] || "",
      stadium: c[idx.stadium] || ""
    });
  }
  return rows;
}

export async function loadNflverseTeamWeekStats(seasons: number[]): Promise<NflverseTeamWeekRow[]> {
  const allRows: NflverseTeamWeekRow[] = [];
  for (const season of seasons) {
    try {
      const csv = await fetchCachedText(
        `nflverse_team_week_${season}.csv`,
        `https://github.com/nflverse/nflverse-data/releases/download/stats_team/stats_team_week_${season}.csv`,
        24
      );
      const lines = csv.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) continue;
      const headers = parseCsvLine(lines[0]);
      const idx = Object.fromEntries(headers.map((h, i) => [h, i]));
      for (let i = 1; i < lines.length; i++) {
        const c = parseCsvLine(lines[i]);
        if (c.length < 15) continue;
        allRows.push({
          season: Number(c[idx.season]),
          week: Number(c[idx.week]),
          team: c[idx.team],
          opponent_team: c[idx.opponent_team],
          game_id: c[idx.game_id],
          passing_epa: numOrZero(c[idx.passing_epa]),
          rushing_epa: numOrZero(c[idx.rushing_epa]),
          passing_cpoe: numOrZero(c[idx.passing_cpoe]),
          sacks_suffered: numOrZero(c[idx.sacks_suffered]),
          def_sacks: numOrZero(c[idx.def_sacks]),
          def_qb_hits: numOrZero(c[idx.def_qb_hits]),
          passing_interceptions: numOrZero(c[idx.passing_interceptions]),
          def_interceptions: numOrZero(c[idx.def_interceptions]),
          fumbles_lost_total: numOrZero(c[idx.fumbles_lost_total]),
          fumble_recovery_opp: numOrZero(c[idx.fumble_recovery_opp]),
          passing_first_downs: numOrZero(c[idx.passing_first_downs]),
          rushing_first_downs: numOrZero(c[idx.rushing_first_downs]),
          attempts: numOrZero(c[idx.attempts]),
          carries: numOrZero(c[idx.carries]),
          passing_20: numOrZero(c[idx.passing_20]),
          rushing_20: numOrZero(c[idx.rushing_20]),
          penalties: numOrZero(c[idx.penalties]),
          penalty_yards: numOrZero(c[idx.penalty_yards]),
          fg_made: numOrZero(c[idx.fg_made]),
          fg_att: numOrZero(c[idx.fg_att]),
          pt_net_yards: numOrZero(c[idx.pt_net_yards]),
          pt_att: numOrZero(c[idx.pt_att])
        });
      }
    } catch {
      // Season file might not exist yet (e.g. future season)
    }
  }
  return allRows;
}

/**
 * Computes point-in-time-safe rolling NFL team metrics strictly BEFORE `cutoffGameday` (YYYY-MM-DD).
 * Never uses games on or after `cutoffGameday`.
 */
export function computeNflRollingMetricsBeforeDate(params: {
  teamAbbr: string;
  cutoffGameday: string;
  games: NflverseGameRow[];
  teamWeekStats: NflverseTeamWeekRow[];
  lookbackGames?: number;
}): NflTeamRollingMetrics | null {
  const canonAbbr = normalizeTeam("NFL", params.teamAbbr)?.abbr || params.teamAbbr;
  const lookback = params.lookbackGames ?? 12;

  // Map game_id -> gameday for strict cutoff filtering
  const gameById = new Map<string, NflverseGameRow>();
  for (const g of params.games) gameById.set(g.game_id, g);

  // Pair each team-week row with its opponent row in the same game_id to obtain defensive EPA allowed
  const byGameTeam = new Map<string, NflverseTeamWeekRow>();
  for (const r of params.teamWeekStats) {
    byGameTeam.set(`${r.game_id}::${r.team}`, r);
  }

  const teamRows = params.teamWeekStats
    .filter(r => {
      const rAbbr = normalizeTeam("NFL", r.team)?.abbr || r.team;
      if (rAbbr !== canonAbbr) return false;
      const g = gameById.get(r.game_id);
      if (!g || g.home_score === null || g.away_score === null) return false;
      return g.gameday < params.cutoffGameday;
    })
    .sort((a, b) => {
      const ga = gameById.get(a.game_id)!;
      const gb = gameById.get(b.game_id)!;
      return ga.gameday.localeCompare(gb.gameday);
    })
    .slice(-lookback);

  if (teamRows.length === 0) return null;

  let totalWeight = 0;
  let passEpaSum = 0, passDropbacksSum = 0;
  let rushEpaSum = 0, carriesSum = 0;
  let defPassEpaSum = 0, defDropbacksSum = 0;
  let defRushEpaSum = 0, defCarriesSum = 0;
  let offFdSum = 0, offPlaysSum = 0;
  let defFdSum = 0, defPlaysSum = 0;
  let expPlaysSum = 0;
  let cpoeWeighted = 0;
  let sacksSufSum = 0;
  let defSacksHitsSum = 0;
  let intsThrown = 0;
  let fumbleNet = 0;
  let penYdsSum = 0;
  let fgMade = 0, fgAtt = 0;

  teamRows.forEach((r, idx) => {
    const recencyWeight = 0.65 + (0.70 * (idx + 1)) / teamRows.length; // Smooth decay favoring recent games
    totalWeight += recencyWeight;

    const dropbacks = Math.max(1, r.attempts + r.sacks_suffered);
    const carries = Math.max(1, r.carries);
    const plays = dropbacks + carries;

    passEpaSum += r.passing_epa * recencyWeight;
    passDropbacksSum += dropbacks * recencyWeight;
    rushEpaSum += r.rushing_epa * recencyWeight;
    carriesSum += carries * recencyWeight;

    offFdSum += (r.passing_first_downs + r.rushing_first_downs) * recencyWeight;
    offPlaysSum += plays * recencyWeight;
    expPlaysSum += (r.passing_20 + r.rushing_20) * recencyWeight;
    cpoeWeighted += r.passing_cpoe * recencyWeight;
    sacksSufSum += r.sacks_suffered * recencyWeight;
    intsThrown += r.passing_interceptions * recencyWeight;
    fumbleNet += (r.fumble_recovery_opp - r.fumbles_lost_total);
    penYdsSum += r.penalty_yards;
    fgMade += r.fg_made;
    fgAtt += r.fg_att;

    const oppRow = byGameTeam.get(`${r.game_id}::${r.opponent_team}`);
    if (oppRow) {
      const oppDropbacks = Math.max(1, oppRow.attempts + oppRow.sacks_suffered);
      const oppCarries = Math.max(1, oppRow.carries);
      defPassEpaSum += oppRow.passing_epa * recencyWeight;
      defDropbacksSum += oppDropbacks * recencyWeight;
      defRushEpaSum += oppRow.rushing_epa * recencyWeight;
      defCarriesSum += oppCarries * recencyWeight;
      defFdSum += (oppRow.passing_first_downs + oppRow.rushing_first_downs) * recencyWeight;
      defPlaysSum += (oppDropbacks + oppCarries) * recencyWeight;
      defSacksHitsSum += (r.def_sacks + 0.45 * r.def_qb_hits) * recencyWeight;
    }
  });

  const lastRow = teamRows[teamRows.length - 1];
  const lastGame = gameById.get(lastRow.game_id);
  const wasHome = lastGame && (normalizeTeam("NFL", lastGame.home_team)?.abbr || lastGame.home_team) === canonAbbr;

  return {
    teamAbbr: canonAbbr,
    gamesPlayed: teamRows.length,
    offPassEpaPerPlay: Number((passEpaSum / Math.max(1, passDropbacksSum)).toFixed(4)),
    offRushEpaPerPlay: Number((rushEpaSum / Math.max(1, carriesSum)).toFixed(4)),
    defPassEpaAllowedPerPlay: defDropbacksSum > 0 ? Number((defPassEpaSum / defDropbacksSum).toFixed(4)) : 0,
    defRushEpaAllowedPerPlay: defCarriesSum > 0 ? Number((defRushEpaSum / defCarriesSum).toFixed(4)) : 0,
    offSuccessProxy: Number((offFdSum / Math.max(1, offPlaysSum)).toFixed(4)),
    defSuccessAllowedProxy: defPlaysSum > 0 ? Number((defFdSum / defPlaysSum).toFixed(4)) : 0.30,
    explosivePlayRate: Number((expPlaysSum / Math.max(1, offPlaysSum)).toFixed(4)),
    cpoe: Number((cpoeWeighted / Math.max(1, totalWeight)).toFixed(2)),
    sackAllowedRate: Number((sacksSufSum / Math.max(1, passDropbacksSum)).toFixed(4)),
    defPressureProxyRate: defDropbacksSum > 0 ? Number((defSacksHitsSum / defDropbacksSum).toFixed(4)) : 0.14,
    interceptionRate: Number((intsThrown / Math.max(1, passDropbacksSum)).toFixed(4)),
    fumbleLuckNet: fumbleNet,
    penaltyYardsPerGame: Number((penYdsSum / teamRows.length).toFixed(1)),
    fgPct: fgAtt > 0 ? Number((fgMade / fgAtt).toFixed(3)) : 0.84,
    lastGameQb: lastGame ? (wasHome ? lastGame.home_qb_name : lastGame.away_qb_name) : undefined,
    lastGameCoach: lastGame ? (wasHome ? lastGame.home_coach : lastGame.away_coach) : undefined,
    lastGameday: lastGame?.gameday
  };
}
