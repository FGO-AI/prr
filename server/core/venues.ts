import { LeagueCode, VenueMetadata } from "./types";

interface TeamCanon {
  abbr: string;
  name: string;
  aliases: string[];
  venue: VenueMetadata;
}

const NFL_TEAMS: TeamCanon[] = [
  { abbr: "ARI", name: "Arizona Cardinals", aliases: ["cardinals", "arizona", "ari"], venue: { venueId: "nfl_ari", name: "State Farm Stadium", teamAbbr: "ARI", league: "NFL", city: "Glendale", state: "AZ", timezone: "America/Phoenix", lat: 33.5276, lon: -112.2626, altitudeFt: 1086, roofType: "retractable", surface: "grass" } },
  { abbr: "ATL", name: "Atlanta Falcons", aliases: ["falcons", "atlanta", "atl"], venue: { venueId: "nfl_atl", name: "Mercedes-Benz Stadium", teamAbbr: "ATL", league: "NFL", city: "Atlanta", state: "GA", timezone: "America/New_York", lat: 33.7554, lon: -84.4008, altitudeFt: 1050, roofType: "retractable", surface: "turf" } },
  { abbr: "BAL", name: "Baltimore Ravens", aliases: ["ravens", "baltimore", "bal"], venue: { venueId: "nfl_bal", name: "M&T Bank Stadium", teamAbbr: "BAL", league: "NFL", city: "Baltimore", state: "MD", timezone: "America/New_York", lat: 39.2780, lon: -76.6227, altitudeFt: 20, roofType: "outdoor", surface: "grass" } },
  { abbr: "BUF", name: "Buffalo Bills", aliases: ["bills", "buffalo", "buf"], venue: { venueId: "nfl_buf", name: "Highmark Stadium", teamAbbr: "BUF", league: "NFL", city: "Orchard Park", state: "NY", timezone: "America/New_York", lat: 42.7738, lon: -78.7870, altitudeFt: 620, roofType: "outdoor", surface: "turf" } },
  { abbr: "CAR", name: "Carolina Panthers", aliases: ["panthers", "carolina", "car"], venue: { venueId: "nfl_car", name: "Bank of America Stadium", teamAbbr: "CAR", league: "NFL", city: "Charlotte", state: "NC", timezone: "America/New_York", lat: 35.2258, lon: -80.8528, altitudeFt: 730, roofType: "outdoor", surface: "turf" } },
  { abbr: "CHI", name: "Chicago Bears", aliases: ["bears", "chicago", "chi"], venue: { venueId: "nfl_chi", name: "Soldier Field", teamAbbr: "CHI", league: "NFL", city: "Chicago", state: "IL", timezone: "America/Chicago", lat: 41.8623, lon: -87.6167, altitudeFt: 594, roofType: "outdoor", surface: "grass" } },
  { abbr: "CIN", name: "Cincinnati Bengals", aliases: ["bengals", "cincinnati", "cin"], venue: { venueId: "nfl_cin", name: "Paycor Stadium", teamAbbr: "CIN", league: "NFL", city: "Cincinnati", state: "OH", timezone: "America/New_York", lat: 39.0955, lon: -84.5161, altitudeFt: 490, roofType: "outdoor", surface: "turf" } },
  { abbr: "CLE", name: "Cleveland Browns", aliases: ["browns", "cleveland", "cle"], venue: { venueId: "nfl_cle", name: "Huntington Bank Field", teamAbbr: "CLE", league: "NFL", city: "Cleveland", state: "OH", timezone: "America/New_York", lat: 41.5061, lon: -81.6995, altitudeFt: 583, roofType: "outdoor", surface: "grass" } },
  { abbr: "DAL", name: "Dallas Cowboys", aliases: ["cowboys", "dallas", "dal"], venue: { venueId: "nfl_dal", name: "AT&T Stadium", teamAbbr: "DAL", league: "NFL", city: "Arlington", state: "TX", timezone: "America/Chicago", lat: 32.7473, lon: -97.0945, altitudeFt: 604, roofType: "retractable", surface: "turf" } },
  { abbr: "DEN", name: "Denver Broncos", aliases: ["broncos", "denver", "den"], venue: { venueId: "nfl_den", name: "Empower Field at Mile High", teamAbbr: "DEN", league: "NFL", city: "Denver", state: "CO", timezone: "America/Denver", lat: 39.7439, lon: -105.0201, altitudeFt: 5280, roofType: "outdoor", surface: "grass" } },
  { abbr: "DET", name: "Detroit Lions", aliases: ["lions", "detroit", "det"], venue: { venueId: "nfl_det", name: "Ford Field", teamAbbr: "DET", league: "NFL", city: "Detroit", state: "MI", timezone: "America/New_York", lat: 42.3400, lon: -83.0456, altitudeFt: 600, roofType: "dome", surface: "turf" } },
  { abbr: "GB", name: "Green Bay Packers", aliases: ["packers", "green bay", "gb", "gnb"], venue: { venueId: "nfl_gb", name: "Lambeau Field", teamAbbr: "GB", league: "NFL", city: "Green Bay", state: "WI", timezone: "America/Chicago", lat: 44.5013, lon: -88.0622, altitudeFt: 640, roofType: "outdoor", surface: "grass" } },
  { abbr: "HOU", name: "Houston Texans", aliases: ["texans", "houston", "hou"], venue: { venueId: "nfl_hou", name: "NRG Stadium", teamAbbr: "HOU", league: "NFL", city: "Houston", state: "TX", timezone: "America/Chicago", lat: 29.6847, lon: -95.4107, altitudeFt: 50, roofType: "retractable", surface: "turf" } },
  { abbr: "IND", name: "Indianapolis Colts", aliases: ["colts", "indianapolis", "ind"], venue: { venueId: "nfl_ind", name: "Lucas Oil Stadium", teamAbbr: "IND", league: "NFL", city: "Indianapolis", state: "IN", timezone: "America/New_York", lat: 39.7601, lon: -86.1639, altitudeFt: 715, roofType: "retractable", surface: "turf" } },
  { abbr: "JAX", name: "Jacksonville Jaguars", aliases: ["jaguars", "jacksonville", "jax", "jac"], venue: { venueId: "nfl_jax", name: "EverBank Stadium", teamAbbr: "JAX", league: "NFL", city: "Jacksonville", state: "FL", timezone: "America/New_York", lat: 30.3239, lon: -81.6373, altitudeFt: 16, roofType: "outdoor", surface: "grass" } },
  { abbr: "KC", name: "Kansas City Chiefs", aliases: ["chiefs", "kansas city", "kc", "kan"], venue: { venueId: "nfl_kc", name: "GEHA Field at Arrowhead Stadium", teamAbbr: "KC", league: "NFL", city: "Kansas City", state: "MO", timezone: "America/Chicago", lat: 39.0489, lon: -94.4839, altitudeFt: 886, roofType: "outdoor", surface: "grass" } },
  { abbr: "LV", name: "Las Vegas Raiders", aliases: ["raiders", "las vegas", "lv", "lvr", "oak", "oakland"], venue: { venueId: "nfl_lv", name: "Allegiant Stadium", teamAbbr: "LV", league: "NFL", city: "Las Vegas", state: "NV", timezone: "America/Los_Angeles", lat: 36.0909, lon: -115.1833, altitudeFt: 2001, roofType: "dome", surface: "grass" } },
  { abbr: "LAC", name: "Los Angeles Chargers", aliases: ["chargers", "la chargers", "lac", "sd"], venue: { venueId: "nfl_lac", name: "SoFi Stadium", teamAbbr: "LAC", league: "NFL", city: "Inglewood", state: "CA", timezone: "America/Los_Angeles", lat: 33.9535, lon: -118.3392, altitudeFt: 131, roofType: "dome", surface: "turf" } },
  { abbr: "LAR", name: "Los Angeles Rams", aliases: ["rams", "la rams", "lar", "la", "stl"], venue: { venueId: "nfl_lar", name: "SoFi Stadium", teamAbbr: "LAR", league: "NFL", city: "Inglewood", state: "CA", timezone: "America/Los_Angeles", lat: 33.9535, lon: -118.3392, altitudeFt: 131, roofType: "dome", surface: "turf" } },
  { abbr: "MIA", name: "Miami Dolphins", aliases: ["dolphins", "miami", "mia"], venue: { venueId: "nfl_mia", name: "Hard Rock Stadium", teamAbbr: "MIA", league: "NFL", city: "Miami Gardens", state: "FL", timezone: "America/New_York", lat: 25.9580, lon: -80.2389, altitudeFt: 7, roofType: "outdoor", surface: "grass" } },
  { abbr: "MIN", name: "Minnesota Vikings", aliases: ["vikings", "minnesota", "min"], venue: { venueId: "nfl_min", name: "U.S. Bank Stadium", teamAbbr: "MIN", league: "NFL", city: "Minneapolis", state: "MN", timezone: "America/Chicago", lat: 44.9736, lon: -93.2575, altitudeFt: 830, roofType: "dome", surface: "turf" } },
  { abbr: "NE", name: "New England Patriots", aliases: ["patriots", "new england", "ne", "nwe"], venue: { venueId: "nfl_ne", name: "Gillette Stadium", teamAbbr: "NE", league: "NFL", city: "Foxborough", state: "MA", timezone: "America/New_York", lat: 42.0909, lon: -71.2643, altitudeFt: 280, roofType: "outdoor", surface: "turf" } },
  { abbr: "NO", name: "New Orleans Saints", aliases: ["saints", "new orleans", "no", "nor"], venue: { venueId: "nfl_no", name: "Caesars Superdome", teamAbbr: "NO", league: "NFL", city: "New Orleans", state: "LA", timezone: "America/Chicago", lat: 29.9511, lon: -90.0812, altitudeFt: 3, roofType: "dome", surface: "turf" } },
  { abbr: "NYG", name: "New York Giants", aliases: ["giants", "ny giants", "nyg"], venue: { venueId: "nfl_nyg", name: "MetLife Stadium", teamAbbr: "NYG", league: "NFL", city: "East Rutherford", state: "NJ", timezone: "America/New_York", lat: 40.8128, lon: -74.0742, altitudeFt: 7, roofType: "outdoor", surface: "turf" } },
  { abbr: "NYJ", name: "New York Jets", aliases: ["jets", "ny jets", "nyj"], venue: { venueId: "nfl_nyj", name: "MetLife Stadium", teamAbbr: "NYJ", league: "NFL", city: "East Rutherford", state: "NJ", timezone: "America/New_York", lat: 40.8128, lon: -74.0742, altitudeFt: 7, roofType: "outdoor", surface: "turf" } },
  { abbr: "PHI", name: "Philadelphia Eagles", aliases: ["eagles", "philadelphia", "phi"], venue: { venueId: "nfl_phi", name: "Lincoln Financial Field", teamAbbr: "PHI", league: "NFL", city: "Philadelphia", state: "PA", timezone: "America/New_York", lat: 39.9008, lon: -75.1675, altitudeFt: 39, roofType: "outdoor", surface: "grass" } },
  { abbr: "PIT", name: "Pittsburgh Steelers", aliases: ["steelers", "pittsburgh", "pit"], venue: { venueId: "nfl_pit", name: "Acrisure Stadium", teamAbbr: "PIT", league: "NFL", city: "Pittsburgh", state: "PA", timezone: "America/New_York", lat: 40.4468, lon: -80.0158, altitudeFt: 730, roofType: "outdoor", surface: "grass" } },
  { abbr: "SF", name: "San Francisco 49ers", aliases: ["49ers", "san francisco", "sf", "sfo"], venue: { venueId: "nfl_sf", name: "Levi's Stadium", teamAbbr: "SF", league: "NFL", city: "Santa Clara", state: "CA", timezone: "America/Los_Angeles", lat: 37.4033, lon: -121.9694, altitudeFt: 43, roofType: "outdoor", surface: "grass" } },
  { abbr: "SEA", name: "Seattle Seahawks", aliases: ["seahawks", "seattle", "sea"], venue: { venueId: "nfl_sea", name: "Lumen Field", teamAbbr: "SEA", league: "NFL", city: "Seattle", state: "WA", timezone: "America/Los_Angeles", lat: 47.5952, lon: -122.3316, altitudeFt: 20, roofType: "outdoor", surface: "turf" } },
  { abbr: "TB", name: "Tampa Bay Buccaneers", aliases: ["buccaneers", "tampa bay", "tb", "tam"], venue: { venueId: "nfl_tb", name: "Raymond James Stadium", teamAbbr: "TB", league: "NFL", city: "Tampa", state: "FL", timezone: "America/New_York", lat: 27.9759, lon: -82.5033, altitudeFt: 36, roofType: "outdoor", surface: "grass" } },
  { abbr: "TEN", name: "Tennessee Titans", aliases: ["titans", "tennessee", "ten"], venue: { venueId: "nfl_ten", name: "Nissan Stadium", teamAbbr: "TEN", league: "NFL", city: "Nashville", state: "TN", timezone: "America/Chicago", lat: 36.1665, lon: -86.7713, altitudeFt: 400, roofType: "outdoor", surface: "turf" } },
  { abbr: "WAS", name: "Washington Commanders", aliases: ["commanders", "washington", "was", "wsh"], venue: { venueId: "nfl_was", name: "Northwest Stadium", teamAbbr: "WAS", league: "NFL", city: "Landover", state: "MD", timezone: "America/New_York", lat: 38.9076, lon: -76.8645, altitudeFt: 164, roofType: "outdoor", surface: "grass" } }
];

const NBA_TEAMS: TeamCanon[] = [
  { abbr: "ATL", name: "Atlanta Hawks", aliases: ["hawks", "atlanta", "atl"], venue: { venueId: "nba_atl", name: "State Farm Arena", teamAbbr: "ATL", league: "NBA", city: "Atlanta", state: "GA", timezone: "America/New_York", lat: 33.7573, lon: -84.3963, altitudeFt: 1050, roofType: "indoor", surface: "hardwood" } },
  { abbr: "BOS", name: "Boston Celtics", aliases: ["celtics", "boston", "bos"], venue: { venueId: "nba_bos", name: "TD Garden", teamAbbr: "BOS", league: "NBA", city: "Boston", state: "MA", timezone: "America/New_York", lat: 42.3662, lon: -71.0621, altitudeFt: 20, roofType: "indoor", surface: "hardwood" } },
  { abbr: "BKN", name: "Brooklyn Nets", aliases: ["nets", "brooklyn", "bkn", "brk"], venue: { venueId: "nba_bkn", name: "Barclays Center", teamAbbr: "BKN", league: "NBA", city: "Brooklyn", state: "NY", timezone: "America/New_York", lat: 40.6826, lon: -73.9754, altitudeFt: 40, roofType: "indoor", surface: "hardwood" } },
  { abbr: "CHA", name: "Charlotte Hornets", aliases: ["hornets", "charlotte", "cha", "cho"], venue: { venueId: "nba_cha", name: "Spectrum Center", teamAbbr: "CHA", league: "NBA", city: "Charlotte", state: "NC", timezone: "America/New_York", lat: 35.2251, lon: -80.8392, altitudeFt: 730, roofType: "indoor", surface: "hardwood" } },
  { abbr: "CHI", name: "Chicago Bulls", aliases: ["bulls", "chicago", "chi"], venue: { venueId: "nba_chi", name: "United Center", teamAbbr: "CHI", league: "NBA", city: "Chicago", state: "IL", timezone: "America/Chicago", lat: 41.8807, lon: -87.6742, altitudeFt: 594, roofType: "indoor", surface: "hardwood" } },
  { abbr: "CLE", name: "Cleveland Cavaliers", aliases: ["cavaliers", "cavs", "cleveland", "cle"], venue: { venueId: "nba_cle", name: "Rocket Arena", teamAbbr: "CLE", league: "NBA", city: "Cleveland", state: "OH", timezone: "America/New_York", lat: 41.4965, lon: -81.6882, altitudeFt: 653, roofType: "indoor", surface: "hardwood" } },
  { abbr: "DAL", name: "Dallas Mavericks", aliases: ["mavericks", "mavs", "dallas", "dal"], venue: { venueId: "nba_dal", name: "American Airlines Center", teamAbbr: "DAL", league: "NBA", city: "Dallas", state: "TX", timezone: "America/Chicago", lat: 32.7905, lon: -96.8103, altitudeFt: 430, roofType: "indoor", surface: "hardwood" } },
  { abbr: "DEN", name: "Denver Nuggets", aliases: ["nuggets", "denver", "den"], venue: { venueId: "nba_den", name: "Ball Arena", teamAbbr: "DEN", league: "NBA", city: "Denver", state: "CO", timezone: "America/Denver", lat: 39.7487, lon: -105.0077, altitudeFt: 5280, roofType: "indoor", surface: "hardwood" } },
  { abbr: "DET", name: "Detroit Pistons", aliases: ["pistons", "detroit", "det"], venue: { venueId: "nba_det", name: "Little Caesars Arena", teamAbbr: "DET", league: "NBA", city: "Detroit", state: "MI", timezone: "America/New_York", lat: 42.3411, lon: -83.0553, altitudeFt: 600, roofType: "indoor", surface: "hardwood" } },
  { abbr: "GSW", name: "Golden State Warriors", aliases: ["warriors", "golden state", "gsw", "gs"], venue: { venueId: "nba_gsw", name: "Chase Center", teamAbbr: "GSW", league: "NBA", city: "San Francisco", state: "CA", timezone: "America/Los_Angeles", lat: 37.7680, lon: -122.3877, altitudeFt: 10, roofType: "indoor", surface: "hardwood" } },
  { abbr: "HOU", name: "Houston Rockets", aliases: ["rockets", "houston", "hou"], venue: { venueId: "nba_hou", name: "Toyota Center", teamAbbr: "HOU", league: "NBA", city: "Houston", state: "TX", timezone: "America/Chicago", lat: 29.7508, lon: -95.3621, altitudeFt: 50, roofType: "indoor", surface: "hardwood" } },
  { abbr: "IND", name: "Indiana Pacers", aliases: ["pacers", "indiana", "ind"], venue: { venueId: "nba_ind", name: "Gainbridge Fieldhouse", teamAbbr: "IND", league: "NBA", city: "Indianapolis", state: "IN", timezone: "America/New_York", lat: 39.7639, lon: -86.1555, altitudeFt: 715, roofType: "indoor", surface: "hardwood" } },
  { abbr: "LAC", name: "LA Clippers", aliases: ["clippers", "la clippers", "los angeles clippers", "lac"], venue: { venueId: "nba_lac", name: "Intuit Dome", teamAbbr: "LAC", league: "NBA", city: "Inglewood", state: "CA", timezone: "America/Los_Angeles", lat: 33.9445, lon: -118.3422, altitudeFt: 131, roofType: "indoor", surface: "hardwood" } },
  { abbr: "LAL", name: "Los Angeles Lakers", aliases: ["lakers", "la lakers", "lal"], venue: { venueId: "nba_lal", name: "Crypto.com Arena", teamAbbr: "LAL", league: "NBA", city: "Los Angeles", state: "CA", timezone: "America/Los_Angeles", lat: 34.0430, lon: -118.2673, altitudeFt: 285, roofType: "indoor", surface: "hardwood" } },
  { abbr: "MEM", name: "Memphis Grizzlies", aliases: ["grizzlies", "memphis", "mem"], venue: { venueId: "nba_mem", name: "FedExForum", teamAbbr: "MEM", league: "NBA", city: "Memphis", state: "TN", timezone: "America/Chicago", lat: 35.1382, lon: -90.0505, altitudeFt: 260, roofType: "indoor", surface: "hardwood" } },
  { abbr: "MIA", name: "Miami Heat", aliases: ["heat", "miami", "mia"], venue: { venueId: "nba_mia", name: "Kaseya Center", teamAbbr: "MIA", league: "NBA", city: "Miami", state: "FL", timezone: "America/New_York", lat: 25.7814, lon: -80.1870, altitudeFt: 7, roofType: "indoor", surface: "hardwood" } },
  { abbr: "MIL", name: "Milwaukee Bucks", aliases: ["bucks", "milwaukee", "mil"], venue: { venueId: "nba_mil", name: "Fiserv Forum", teamAbbr: "MIL", league: "NBA", city: "Milwaukee", state: "WI", timezone: "America/Chicago", lat: 43.0451, lon: -87.9174, altitudeFt: 617, roofType: "indoor", surface: "hardwood" } },
  { abbr: "MIN", name: "Minnesota Timberwolves", aliases: ["timberwolves", "wolves", "minnesota", "min"], venue: { venueId: "nba_min", name: "Target Center", teamAbbr: "MIN", league: "NBA", city: "Minneapolis", state: "MN", timezone: "America/Chicago", lat: 44.9795, lon: -93.2761, altitudeFt: 830, roofType: "indoor", surface: "hardwood" } },
  { abbr: "NOP", name: "New Orleans Pelicans", aliases: ["pelicans", "new orleans", "nop", "no"], venue: { venueId: "nba_nop", name: "Smoothie King Center", teamAbbr: "NOP", league: "NBA", city: "New Orleans", state: "LA", timezone: "America/Chicago", lat: 29.9490, lon: -90.0821, altitudeFt: 3, roofType: "indoor", surface: "hardwood" } },
  { abbr: "NYK", name: "New York Knicks", aliases: ["knicks", "new york knicks", "nyk", "ny"], venue: { venueId: "nba_nyk", name: "Madison Square Garden", teamAbbr: "NYK", league: "NBA", city: "New York", state: "NY", timezone: "America/New_York", lat: 40.7505, lon: -73.9934, altitudeFt: 33, roofType: "indoor", surface: "hardwood" } },
  { abbr: "OKC", name: "Oklahoma City Thunder", aliases: ["thunder", "oklahoma city", "okc"], venue: { venueId: "nba_okc", name: "Paycom Center", teamAbbr: "OKC", league: "NBA", city: "Oklahoma City", state: "OK", timezone: "America/Chicago", lat: 35.4634, lon: -97.5151, altitudeFt: 1201, roofType: "indoor", surface: "hardwood" } },
  { abbr: "ORL", name: "Orlando Magic", aliases: ["magic", "orlando", "orl"], venue: { venueId: "nba_orl", name: "Kia Center", teamAbbr: "ORL", league: "NBA", city: "Orlando", state: "FL", timezone: "America/New_York", lat: 28.5392, lon: -81.3839, altitudeFt: 82, roofType: "indoor", surface: "hardwood" } },
  { abbr: "PHI", name: "Philadelphia 76ers", aliases: ["76ers", "sixers", "philadelphia", "phi"], venue: { venueId: "nba_phi", name: "Wells Fargo Center", teamAbbr: "PHI", league: "NBA", city: "Philadelphia", state: "PA", timezone: "America/New_York", lat: 39.9012, lon: -75.1720, altitudeFt: 39, roofType: "indoor", surface: "hardwood" } },
  { abbr: "PHX", name: "Phoenix Suns", aliases: ["suns", "phoenix", "phx", "pho"], venue: { venueId: "nba_phx", name: "PHX Arena", teamAbbr: "PHX", league: "NBA", city: "Phoenix", state: "AZ", timezone: "America/Phoenix", lat: 33.4457, lon: -112.0712, altitudeFt: 1086, roofType: "indoor", surface: "hardwood" } },
  { abbr: "POR", name: "Portland Trail Blazers", aliases: ["trail blazers", "blazers", "portland", "por"], venue: { venueId: "nba_por", name: "Moda Center", teamAbbr: "POR", league: "NBA", city: "Portland", state: "OR", timezone: "America/Los_Angeles", lat: 45.5316, lon: -122.6668, altitudeFt: 50, roofType: "indoor", surface: "hardwood" } },
  { abbr: "SAC", name: "Sacramento Kings", aliases: ["kings", "sacramento", "sac"], venue: { venueId: "nba_sac", name: "Golden 1 Center", teamAbbr: "SAC", league: "NBA", city: "Sacramento", state: "CA", timezone: "America/Los_Angeles", lat: 38.5802, lon: -121.4997, altitudeFt: 30, roofType: "indoor", surface: "hardwood" } },
  { abbr: "SAS", name: "San Antonio Spurs", aliases: ["spurs", "san antonio", "sas", "sa"], venue: { venueId: "nba_sas", name: "Frost Bank Center", teamAbbr: "SAS", league: "NBA", city: "San Antonio", state: "TX", timezone: "America/Chicago", lat: 29.4270, lon: -98.4375, altitudeFt: 650, roofType: "indoor", surface: "hardwood" } },
  { abbr: "TOR", name: "Toronto Raptors", aliases: ["raptors", "toronto", "tor"], venue: { venueId: "nba_tor", name: "Scotiabank Arena", teamAbbr: "TOR", league: "NBA", city: "Toronto", state: "ON", timezone: "America/Toronto", lat: 43.6435, lon: -79.3791, altitudeFt: 250, roofType: "indoor", surface: "hardwood" } },
  { abbr: "UTA", name: "Utah Jazz", aliases: ["jazz", "utah", "uta", "uth"], venue: { venueId: "nba_uta", name: "Delta Center", teamAbbr: "UTA", league: "NBA", city: "Salt Lake City", state: "UT", timezone: "America/Denver", lat: 40.7683, lon: -111.9011, altitudeFt: 4226, roofType: "indoor", surface: "hardwood" } },
  { abbr: "WAS", name: "Washington Wizards", aliases: ["wizards", "washington", "was", "wsh"], venue: { venueId: "nba_was", name: "Capital One Arena", teamAbbr: "WAS", league: "NBA", city: "Washington", state: "DC", timezone: "America/New_York", lat: 38.8981, lon: -77.0209, altitudeFt: 30, roofType: "indoor", surface: "hardwood" } }
];

const MLB_TEAMS: TeamCanon[] = [
  { abbr: "ARI", name: "Arizona Diamondbacks", aliases: ["diamondbacks", "d-backs", "arizona", "ari", "az"], venue: { venueId: "mlb_ari", name: "Chase Field", teamAbbr: "ARI", league: "MLB", city: "Phoenix", state: "AZ", timezone: "America/Phoenix", lat: 33.4455, lon: -112.0667, altitudeFt: 1086, roofType: "retractable", surface: "turf", cfAzimuthDeg: 0, parkRunIndex100: 103, parkHrIndex100: 96, parkIndexType: "relative", parkSeason: 2025 } },
  { abbr: "ATL", name: "Atlanta Braves", aliases: ["braves", "atlanta", "atl"], venue: { venueId: "mlb_atl", name: "Truist Park", teamAbbr: "ATL", league: "MLB", city: "Atlanta", state: "GA", timezone: "America/New_York", lat: 33.8907, lon: -84.4677, altitudeFt: 1050, roofType: "outdoor", surface: "grass", cfAzimuthDeg: 145, parkRunIndex100: 101, parkHrIndex100: 104, parkIndexType: "relative", parkSeason: 2025 } },
  { abbr: "BAL", name: "Baltimore Orioles", aliases: ["orioles", "baltimore", "bal"], venue: { venueId: "mlb_bal", name: "Oriole Park at Camden Yards", teamAbbr: "BAL", league: "MLB", city: "Baltimore", state: "MD", timezone: "America/New_York", lat: 39.2838, lon: -76.6217, altitudeFt: 33, roofType: "outdoor", surface: "grass", cfAzimuthDeg: 32, parkRunIndex100: 99, parkHrIndex100: 101, parkIndexType: "relative", parkSeason: 2025 } },
  { abbr: "BOS", name: "Boston Red Sox", aliases: ["red sox", "boston", "bos"], venue: { venueId: "mlb_bos", name: "Fenway Park", teamAbbr: "BOS", league: "MLB", city: "Boston", state: "MA", timezone: "America/New_York", lat: 42.3467, lon: -71.0972, altitudeFt: 20, roofType: "outdoor", surface: "grass", cfAzimuthDeg: 45, parkRunIndex100: 106, parkHrIndex100: 98, parkIndexType: "relative", parkSeason: 2025 } },
  { abbr: "CHC", name: "Chicago Cubs", aliases: ["cubs", "chicago cubs", "chc"], venue: { venueId: "mlb_chc", name: "Wrigley Field", teamAbbr: "CHC", league: "MLB", city: "Chicago", state: "IL", timezone: "America/Chicago", lat: 41.9484, lon: -87.6553, altitudeFt: 597, roofType: "outdoor", surface: "grass", cfAzimuthDeg: 37, parkRunIndex100: 101, parkHrIndex100: 103, parkIndexType: "relative", parkSeason: 2025 } },
  { abbr: "CWS", name: "Chicago White Sox", aliases: ["white sox", "chicago white sox", "cws", "chw"], venue: { venueId: "mlb_cws", name: "Rate Field", teamAbbr: "CWS", league: "MLB", city: "Chicago", state: "IL", timezone: "America/Chicago", lat: 41.8299, lon: -87.6338, altitudeFt: 594, roofType: "outdoor", surface: "grass", cfAzimuthDeg: 130, parkRunIndex100: 100, parkHrIndex100: 107, parkIndexType: "relative", parkSeason: 2025 } },
  { abbr: "CIN", name: "Cincinnati Reds", aliases: ["reds", "cincinnati", "cin"], venue: { venueId: "mlb_cin", name: "Great American Ball Park", teamAbbr: "CIN", league: "MLB", city: "Cincinnati", state: "OH", timezone: "America/New_York", lat: 39.0974, lon: -84.5061, altitudeFt: 490, roofType: "outdoor", surface: "grass", cfAzimuthDeg: 120, parkRunIndex100: 107, parkHrIndex100: 118, parkIndexType: "relative", parkSeason: 2025 } },
  { abbr: "CLE", name: "Cleveland Guardians", aliases: ["guardians", "cleveland", "cle"], venue: { venueId: "mlb_cle", name: "Progressive Field", teamAbbr: "CLE", league: "MLB", city: "Cleveland", state: "OH", timezone: "America/New_York", lat: 41.4962, lon: -81.6852, altitudeFt: 653, roofType: "outdoor", surface: "grass", cfAzimuthDeg: 0, parkRunIndex100: 98, parkHrIndex100: 95, parkIndexType: "relative", parkSeason: 2025 } },
  { abbr: "COL", name: "Colorado Rockies", aliases: ["rockies", "colorado", "col"], venue: { venueId: "mlb_col", name: "Coors Field", teamAbbr: "COL", league: "MLB", city: "Denver", state: "CO", timezone: "America/Denver", lat: 39.7559, lon: -104.9942, altitudeFt: 5280, roofType: "outdoor", surface: "grass", cfAzimuthDeg: 4, parkRunIndex100: 115, parkHrIndex100: 112, parkIndexType: "relative", parkSeason: 2025 } },
  { abbr: "DET", name: "Detroit Tigers", aliases: ["tigers", "detroit", "det"], venue: { venueId: "mlb_det", name: "Comerica Park", teamAbbr: "DET", league: "MLB", city: "Detroit", state: "MI", timezone: "America/New_York", lat: 42.3390, lon: -83.0485, altitudeFt: 600, roofType: "outdoor", surface: "grass", cfAzimuthDeg: 150, parkRunIndex100: 98, parkHrIndex100: 91, parkIndexType: "relative", parkSeason: 2025 } },
  { abbr: "HOU", name: "Houston Astros", aliases: ["astros", "houston", "hou"], venue: { venueId: "mlb_hou", name: "Daikin Park", teamAbbr: "HOU", league: "MLB", city: "Houston", state: "TX", timezone: "America/Chicago", lat: 29.7573, lon: -95.3555, altitudeFt: 50, roofType: "retractable", surface: "grass", cfAzimuthDeg: 342, parkRunIndex100: 100, parkHrIndex100: 106, parkIndexType: "relative", parkSeason: 2025 } },
  { abbr: "KC", name: "Kansas City Royals", aliases: ["royals", "kansas city", "kc", "kcr"], venue: { venueId: "mlb_kc", name: "Kauffman Stadium", teamAbbr: "KC", league: "MLB", city: "Kansas City", state: "MO", timezone: "America/Chicago", lat: 39.0517, lon: -94.4803, altitudeFt: 886, roofType: "outdoor", surface: "grass", cfAzimuthDeg: 47, parkRunIndex100: 102, parkHrIndex100: 90, parkIndexType: "relative", parkSeason: 2025 } },
  { abbr: "LAA", name: "Los Angeles Angels", aliases: ["angels", "la angels", "laa", "ana"], venue: { venueId: "mlb_laa", name: "Angel Stadium", teamAbbr: "LAA", league: "MLB", city: "Anaheim", state: "CA", timezone: "America/Los_Angeles", lat: 33.8003, lon: -117.8827, altitudeFt: 160, roofType: "outdoor", surface: "grass", cfAzimuthDeg: 45, parkRunIndex100: 99, parkHrIndex100: 103, parkIndexType: "relative", parkSeason: 2025 } },
  { abbr: "LAD", name: "Los Angeles Dodgers", aliases: ["dodgers", "la dodgers", "lad"], venue: { venueId: "mlb_lad", name: "Dodger Stadium", teamAbbr: "LAD", league: "MLB", city: "Los Angeles", state: "CA", timezone: "America/Los_Angeles", lat: 34.0739, lon: -118.2400, altitudeFt: 515, roofType: "outdoor", surface: "grass", cfAzimuthDeg: 25, parkRunIndex100: 99, parkHrIndex100: 109, parkIndexType: "relative", parkSeason: 2025 } },
  { abbr: "MIA", name: "Miami Marlins", aliases: ["marlins", "miami", "mia"], venue: { venueId: "mlb_mia", name: "loanDepot park", teamAbbr: "MIA", league: "MLB", city: "Miami", state: "FL", timezone: "America/New_York", lat: 25.7781, lon: -80.2196, altitudeFt: 7, roofType: "retractable", surface: "grass", cfAzimuthDeg: 130, parkRunIndex100: 98, parkHrIndex100: 92, parkIndexType: "relative", parkSeason: 2025 } },
  { abbr: "MIL", name: "Milwaukee Brewers", aliases: ["brewers", "milwaukee", "mil"], venue: { venueId: "mlb_mil", name: "American Family Field", teamAbbr: "MIL", league: "MLB", city: "Milwaukee", state: "WI", timezone: "America/Chicago", lat: 43.0280, lon: -87.9712, altitudeFt: 617, roofType: "retractable", surface: "grass", cfAzimuthDeg: 128, parkRunIndex100: 100, parkHrIndex100: 107, parkIndexType: "relative", parkSeason: 2025 } },
  { abbr: "MIN", name: "Minnesota Twins", aliases: ["twins", "minnesota", "min"], venue: { venueId: "mlb_min", name: "Target Field", teamAbbr: "MIN", league: "MLB", city: "Minneapolis", state: "MN", timezone: "America/Chicago", lat: 44.9817, lon: -93.2776, altitudeFt: 830, roofType: "outdoor", surface: "grass", cfAzimuthDeg: 90, parkRunIndex100: 101, parkHrIndex100: 101, parkIndexType: "relative", parkSeason: 2025 } },
  { abbr: "NYM", name: "New York Mets", aliases: ["mets", "ny mets", "nym"], venue: { venueId: "mlb_nym", name: "Citi Field", teamAbbr: "NYM", league: "MLB", city: "Queens", state: "NY", timezone: "America/New_York", lat: 40.7571, lon: -73.8458, altitudeFt: 10, roofType: "outdoor", surface: "grass", cfAzimuthDeg: 15, parkRunIndex100: 96, parkHrIndex100: 98, parkIndexType: "relative", parkSeason: 2025 } },
  { abbr: "NYY", name: "New York Yankees", aliases: ["yankees", "ny yankees", "nyy"], venue: { venueId: "mlb_nyy", name: "Yankee Stadium", teamAbbr: "NYY", league: "MLB", city: "Bronx", state: "NY", timezone: "America/New_York", lat: 40.8296, lon: -73.9262, altitudeFt: 55, roofType: "outdoor", surface: "grass", cfAzimuthDeg: 75, parkRunIndex100: 101, parkHrIndex100: 115, parkIndexType: "relative", parkSeason: 2025 } },
  { abbr: "ATH", name: "Athletics", aliases: ["athletics", "oakland", "sacramento athletics", "oak", "ath"], venue: { venueId: "mlb_ath", name: "Sutter Health Park", teamAbbr: "ATH", league: "MLB", city: "West Sacramento", state: "CA", timezone: "America/Los_Angeles", lat: 38.5803, lon: -121.5138, altitudeFt: 25, roofType: "outdoor", surface: "grass", cfAzimuthDeg: 30, parkRunIndex100: 102, parkHrIndex100: 102, parkIndexType: "relative", parkSeason: 2025 } },
  { abbr: "PHI", name: "Philadelphia Phillies", aliases: ["phillies", "philadelphia", "phi"], venue: { venueId: "mlb_phi", name: "Citizens Bank Park", teamAbbr: "PHI", league: "MLB", city: "Philadelphia", state: "PA", timezone: "America/New_York", lat: 39.9061, lon: -75.1665, altitudeFt: 30, roofType: "outdoor", surface: "grass", cfAzimuthDeg: 10, parkRunIndex100: 103, parkHrIndex100: 112, parkIndexType: "relative", parkSeason: 2025 } },
  { abbr: "PIT", name: "Pittsburgh Pirates", aliases: ["pirates", "pittsburgh", "pit"], venue: { venueId: "mlb_pit", name: "PNC Park", teamAbbr: "PIT", league: "MLB", city: "Pittsburgh", state: "PA", timezone: "America/New_York", lat: 40.4469, lon: -80.0057, altitudeFt: 725, roofType: "outdoor", surface: "grass", cfAzimuthDeg: 65, parkRunIndex100: 97, parkHrIndex100: 89, parkIndexType: "relative", parkSeason: 2025 } },
  { abbr: "SD", name: "San Diego Padres", aliases: ["padres", "san diego", "sd", "sdp"], venue: { venueId: "mlb_sd", name: "Petco Park", teamAbbr: "SD", league: "MLB", city: "San Diego", state: "CA", timezone: "America/Los_Angeles", lat: 32.7076, lon: -117.1570, altitudeFt: 16, roofType: "outdoor", surface: "grass", cfAzimuthDeg: 0, parkRunIndex100: 95, parkHrIndex100: 94, parkIndexType: "relative", parkSeason: 2025 } },
  { abbr: "SF", name: "San Francisco Giants", aliases: ["giants", "san francisco", "sf", "sfg"], venue: { venueId: "mlb_sf", name: "Oracle Park", teamAbbr: "SF", league: "MLB", city: "San Francisco", state: "CA", timezone: "America/Los_Angeles", lat: 37.7786, lon: -122.3893, altitudeFt: 10, roofType: "outdoor", surface: "grass", cfAzimuthDeg: 85, parkRunIndex100: 95, parkHrIndex100: 84, parkIndexType: "relative", parkSeason: 2025 } },
  { abbr: "SEA", name: "Seattle Mariners", aliases: ["mariners", "seattle", "sea"], venue: { venueId: "mlb_sea", name: "T-Mobile Park", teamAbbr: "SEA", league: "MLB", city: "Seattle", state: "WA", timezone: "America/Los_Angeles", lat: 47.5914, lon: -122.3325, altitudeFt: 16, roofType: "retractable", surface: "grass", cfAzimuthDeg: 50, parkRunIndex100: 93, parkHrIndex100: 93, parkIndexType: "relative", parkSeason: 2025 } },
  { abbr: "STL", name: "St. Louis Cardinals", aliases: ["cardinals", "st. louis", "st louis", "stl"], venue: { venueId: "mlb_stl", name: "Busch Stadium", teamAbbr: "STL", league: "MLB", city: "St. Louis", state: "MO", timezone: "America/Chicago", lat: 38.6226, lon: -90.1928, altitudeFt: 455, roofType: "outdoor", surface: "grass", cfAzimuthDeg: 60, parkRunIndex100: 98, parkHrIndex100: 94, parkIndexType: "relative", parkSeason: 2025 } },
  { abbr: "TB", name: "Tampa Bay Rays", aliases: ["rays", "tampa bay", "tb", "tbr"], venue: { venueId: "mlb_tb", name: "Tropicana Field", teamAbbr: "TB", league: "MLB", city: "St. Petersburg", state: "FL", timezone: "America/New_York", lat: 27.7682, lon: -82.6534, altitudeFt: 44, roofType: "dome", surface: "turf", cfAzimuthDeg: 45, parkRunIndex100: 96, parkHrIndex100: 95, parkIndexType: "relative", parkSeason: 2025 } },
  { abbr: "TEX", name: "Texas Rangers", aliases: ["rangers", "texas", "tex"], venue: { venueId: "mlb_tex", name: "Globe Life Field", teamAbbr: "TEX", league: "MLB", city: "Arlington", state: "TX", timezone: "America/Chicago", lat: 32.7473, lon: -97.0842, altitudeFt: 604, roofType: "retractable", surface: "turf", cfAzimuthDeg: 10, parkRunIndex100: 101, parkHrIndex100: 102, parkIndexType: "relative", parkSeason: 2025 } },
  { abbr: "TOR", name: "Toronto Blue Jays", aliases: ["blue jays", "toronto", "tor"], venue: { venueId: "mlb_tor", name: "Rogers Centre", teamAbbr: "TOR", league: "MLB", city: "Toronto", state: "ON", timezone: "America/Toronto", lat: 43.6414, lon: -79.3894, altitudeFt: 250, roofType: "retractable", surface: "turf", cfAzimuthDeg: 345, parkRunIndex100: 100, parkHrIndex100: 103, parkIndexType: "relative", parkSeason: 2025 } },
  { abbr: "WSH", name: "Washington Nationals", aliases: ["nationals", "washington", "wsh", "was"], venue: { venueId: "mlb_wsh", name: "Nationals Park", teamAbbr: "WSH", league: "MLB", city: "Washington", state: "DC", timezone: "America/New_York", lat: 38.8730, lon: -77.0074, altitudeFt: 25, roofType: "outdoor", surface: "grass", cfAzimuthDeg: 28, parkRunIndex100: 100, parkHrIndex100: 100, parkIndexType: "relative", parkSeason: 2025 } }
];

const LEAGUE_TEAMS: Record<LeagueCode, TeamCanon[]> = {
  NFL: NFL_TEAMS,
  NBA: NBA_TEAMS,
  MLB: MLB_TEAMS
};

const NEUTRAL_VENUES: Record<string, VenueMetadata> = {
  london_tottenham: { venueId: "neutral_london_tot", name: "Tottenham Hotspur Stadium", teamAbbr: "NEUT", league: "NFL", city: "London", state: "UK", timezone: "Europe/London", lat: 51.6042, lon: -0.0662, altitudeFt: 45, roofType: "outdoor", surface: "turf" },
  london_wembley: { venueId: "neutral_london_wem", name: "Wembley Stadium", teamAbbr: "NEUT", league: "NFL", city: "London", state: "UK", timezone: "Europe/London", lat: 51.5560, lon: -0.2796, altitudeFt: 110, roofType: "outdoor", surface: "grass" },
  munich: { venueId: "neutral_munich", name: "Allianz Arena", teamAbbr: "NEUT", league: "NFL", city: "Munich", state: "DE", timezone: "Europe/Berlin", lat: 48.2188, lon: 11.6247, altitudeFt: 1690, roofType: "outdoor", surface: "grass" },
  madrid: { venueId: "neutral_madrid", name: "Santiago Bernabeu", teamAbbr: "NEUT", league: "NFL", city: "Madrid", state: "ES", timezone: "Europe/Madrid", lat: 40.4531, lon: -3.6883, altitudeFt: 2150, roofType: "retractable", surface: "grass" },
  sao_paulo: { venueId: "neutral_sp", name: "Arena Corinthians", teamAbbr: "NEUT", league: "NFL", city: "Sao Paulo", state: "BR", timezone: "America/Sao_Paulo", lat: -23.5453, lon: -46.4742, altitudeFt: 2500, roofType: "outdoor", surface: "grass" }
};

export function normalizeTeam(league: LeagueCode, rawNameOrAbbr: string): TeamCanon | null {
  const clean = (rawNameOrAbbr || "").trim().toLowerCase();
  if (!clean) return null;
  const list = LEAGUE_TEAMS[league] || [];
  // Exact abbr or exact name match first
  for (const t of list) {
    if (t.abbr.toLowerCase() === clean || t.name.toLowerCase() === clean) return t;
  }
  // Exact alias match
  for (const t of list) {
    if (t.aliases.some(a => a === clean)) return t;
  }
  // Substring match
  for (const t of list) {
    if (t.name.toLowerCase().includes(clean) || clean.includes(t.name.toLowerCase()) || t.aliases.some(a => clean.includes(a))) {
      return t;
    }
  }
  return null;
}

export function getVenueForGame(
  league: LeagueCode,
  homeTeamRaw: string,
  opts?: { venueName?: string; neutralSite?: boolean }
): VenueMetadata | null {
  if (opts?.venueName) {
    const vn = opts.venueName.toLowerCase();
    for (const nv of Object.values(NEUTRAL_VENUES)) {
      if (vn.includes(nv.city.toLowerCase()) || vn.includes(nv.name.toLowerCase().split(" ")[0])) {
        return { ...nv, league };
      }
    }
  }
  const team = normalizeTeam(league, homeTeamRaw);
  return team ? team.venue : null;
}

export function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Earth radius in miles
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

const TZ_OFFSETS_ESTIMATE: Record<string, number> = {
  "America/New_York": -5,
  "America/Toronto": -5,
  "America/Chicago": -6,
  "America/Denver": -7,
  "America/Phoenix": -7,
  "America/Los_Angeles": -8,
  "Europe/London": 0,
  "Europe/Berlin": 1,
  "Europe/Madrid": 1,
  "America/Sao_Paulo": -3
};

export function computeTimezoneShift(fromTz: string, toTz: string): {
  hoursDiff: number;
  direction: "eastbound" | "westbound" | "neutral";
} {
  const fromOff = TZ_OFFSETS_ESTIMATE[fromTz] ?? -5;
  const toOff = TZ_OFFSETS_ESTIMATE[toTz] ?? -5;
  const diff = toOff - fromOff;
  return {
    hoursDiff: Math.abs(diff),
    direction: diff > 0 ? "eastbound" : diff < 0 ? "westbound" : "neutral"
  };
}

export function formatUtcAndLocal(utcIso: string, timezone: string): { utc: string; local: string } {
  const d = new Date(utcIso);
  if (Number.isNaN(d.getTime())) {
    return { utc: utcIso, local: utcIso };
  }
  const local = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || "America/New_York",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(d);
  return { utc: d.toISOString(), local };
}

export function listTeamsForLeague(league: LeagueCode): TeamCanon[] {
  return LEAGUE_TEAMS[league] || [];
}
