import { DatabaseSync } from "node:sqlite";
import { logMonitoringEvent } from "../db/database";
import { VenueMetadata, WeatherForecastVintage } from "../core/types";

const gridUrlCache = new Map<string, string>();
const forecastCache = new Map<string, { data: any; fetchedUtc: string; expiresAtMs: number }>();

/**
 * Computes relative air density index (1.00 = sea level at 70F).
 * Higher altitude and warmer air reduce density (carry increases in MLB, kicking distance slightly increases in NFL).
 */
export function computeAirDensityIndex(tempF: number | null, altitudeFt: number): number | null {
  if (tempF === null || !Number.isFinite(tempF)) return null;
  const pressureRatio = Math.exp(-altitudeFt / 27000);
  const tempKelvinRatio = 294.26 / ((tempF - 32) * (5 / 9) + 273.15);
  return Number((pressureRatio * tempKelvinRatio).toFixed(4));
}

function parseWindSpeedMph(windStr: string | undefined): number | null {
  if (!windStr) return null;
  const nums = windStr.match(/\d+/g)?.map(Number) || [];
  if (nums.length === 0) return null;
  if (nums.length === 1) return nums[0];
  return Number(((nums[0] + nums[1]) / 2).toFixed(1));
}

function compassToDegrees(dir: string | undefined): number | null {
  if (!dir) return null;
  const map: Record<string, number> = {
    N: 0, NNE: 22.5, NE: 45, ENE: 67.5,
    E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
    S: 180, SSW: 202.5, SW: 225, WSW: 247.5,
    W: 270, WNW: 292.5, NW: 315, NNW: 337.5
  };
  return map[dir.trim().toUpperCase()] ?? null;
}

export async function fetchNwsVenueWeather(params: {
  gameId: string;
  venue: VenueMetadata | null;
  scheduledStartUtc: string;
  cutoffUtc?: string;
  db?: DatabaseSync;
}): Promise<WeatherForecastVintage> {
  const nowIso = new Date().toISOString();
  const cutoffMs = params.cutoffUtc ? Date.parse(params.cutoffUtc) : Date.now();
  const venue = params.venue;

  // Indoor basketball (NBA) and closed domes do NOT receive outdoor weather adjustments
  if (!venue || venue.league === "NBA" || venue.roofType === "indoor" || venue.roofType === "dome") {
    return {
      forecastId: `wx_na_${params.gameId}`,
      gameId: params.gameId,
      venueId: venue?.venueId || "unknown_venue",
      source: "venue_controlled_environment",
      issuedUtc: nowIso,
      validUtc: params.scheduledStartUtc,
      ingestedUtc: nowIso,
      tempF: 70,
      windMph: 0,
      windGustMph: 0,
      windDirDeg: null,
      precipProb: 0,
      precipIn: 0,
      roofStatus: venue?.roofType === "dome" ? "dome" : "indoor",
      surface: venue?.surface || "hardwood",
      altitudeFt: venue?.altitudeFt ?? 0,
      airDensityIndex: venue ? computeAirDensityIndex(70, venue.altitudeFt) : 1.0,
      delayRiskScore: 0,
      status: "not_applicable",
      shortForecast: venue?.league === "NBA" ? "Indoor arena (outdoor weather N/A)" : "Closed dome environment"
    };
  }

  // Check if game is historical (more than 12 hours in the past) — NWS only serves future/recent hourly forecasts
  const gameStartMs = Date.parse(params.scheduledStartUtc);
  if (Number.isFinite(gameStartMs) && gameStartMs < Date.now() - 12 * 3600 * 1000) {
    // Try stored vintage in DB before cutoff
    if (params.db) {
      const row = params.db.prepare(
        `SELECT * FROM weather_forecasts WHERE game_id = ? AND issued_utc <= ? ORDER BY issued_utc DESC LIMIT 1`
      ).get(params.gameId, new Date(cutoffMs).toISOString()) as any;
      if (row) {
        return {
          forecastId: row.forecast_id,
          gameId: row.game_id,
          venueId: row.venue_id,
          source: row.source,
          issuedUtc: row.issued_utc,
          validUtc: row.valid_utc,
          ingestedUtc: row.ingested_utc,
          tempF: row.temp_f,
          windMph: row.wind_mph,
          windGustMph: row.wind_gust_mph,
          windDirDeg: row.wind_dir_deg,
          precipProb: row.precip_prob,
          precipIn: row.precip_in,
          roofStatus: row.roof_status,
          surface: row.surface,
          altitudeFt: row.altitude_ft,
          airDensityIndex: row.air_density_index,
          delayRiskScore: row.delay_risk_score,
          status: row.status,
          shortForecast: row.short_forecast
        };
      }
    }

    return {
      forecastId: `wx_missing_hist_${params.gameId}`,
      gameId: params.gameId,
      venueId: venue.venueId,
      source: "nws_api_unavailable_historical",
      issuedUtc: nowIso,
      validUtc: params.scheduledStartUtc,
      ingestedUtc: nowIso,
      tempF: null,
      windMph: null,
      windGustMph: null,
      windDirDeg: null,
      precipProb: null,
      precipIn: null,
      roofStatus: venue.roofType === "retractable" ? "unknown" : "open",
      surface: venue.surface,
      altitudeFt: venue.altitudeFt,
      airDensityIndex: null,
      delayRiskScore: null,
      status: "missing",
      shortForecast: "Historical NWS forecast vintage unavailable without archived forecast snapshot"
    };
  }

  // Non-US venues (e.g. Toronto, London, Munich) are outside NWS grid coverage
  if (venue.state === "ON" || venue.state === "UK" || venue.state === "DE" || venue.state === "ES" || venue.state === "BR") {
    return {
      forecastId: `wx_non_us_${params.gameId}`,
      gameId: params.gameId,
      venueId: venue.venueId,
      source: "nws_outside_coverage",
      issuedUtc: nowIso,
      validUtc: params.scheduledStartUtc,
      ingestedUtc: nowIso,
      tempF: null,
      windMph: null,
      windGustMph: null,
      windDirDeg: null,
      precipProb: null,
      precipIn: null,
      roofStatus: venue.roofType === "retractable" ? "unknown" : "open",
      surface: venue.surface,
      altitudeFt: venue.altitudeFt,
      airDensityIndex: null,
      delayRiskScore: null,
      status: "missing",
      shortForecast: `Venue (${venue.city}) is outside US NWS API coverage`
    };
  }

  try {
    const ptKey = `${venue.lat.toFixed(4)},${venue.lon.toFixed(4)}`;
    let hourlyUrl = gridUrlCache.get(ptKey);
    if (!hourlyUrl) {
      const ptRes = await fetch(`https://api.weather.gov/points/${ptKey}`, {
        headers: { "User-Agent": "sports-analytics-engine/1.0 (quant@local)" },
        signal: AbortSignal.timeout(5000)
      });
      if (!ptRes.ok) throw new Error(`NWS points status ${ptRes.status}`);
      const ptJson = await ptRes.json();
      hourlyUrl = ptJson.properties?.forecastHourly;
      if (hourlyUrl) gridUrlCache.set(ptKey, hourlyUrl);
    }
    if (!hourlyUrl) throw new Error("NWS hourly URL missing");

    let cached = forecastCache.get(hourlyUrl);
    if (!cached || Date.now() >= cached.expiresAtMs) {
      const fRes = await fetch(hourlyUrl, {
        headers: { "User-Agent": "sports-analytics-engine/1.0 (quant@local)" },
        signal: AbortSignal.timeout(6000)
      });
      if (!fRes.ok) throw new Error(`NWS hourly forecast status ${fRes.status}`);
      const fJson = await fRes.json();
      cached = {
        data: fJson,
        fetchedUtc: new Date().toISOString(),
        expiresAtMs: Date.now() + 15 * 60 * 1000
      };
      forecastCache.set(hourlyUrl, cached);
    }

    const issuedUtc = cached.data.properties?.updateTime
      ? new Date(cached.data.properties.updateTime).toISOString()
      : cached.fetchedUtc;
    const periods: any[] = cached.data.properties?.periods || [];
    if (periods.length === 0) throw new Error("Empty NWS periods");

    // Pick hourly period closest to scheduledStartUtc
    let best = periods[0];
    let bestDiff = Math.abs(Date.parse(best.startTime) - gameStartMs);
    for (const p of periods) {
      const diff = Math.abs(Date.parse(p.startTime) - gameStartMs);
      if (diff < bestDiff) {
        best = p;
        bestDiff = diff;
      }
    }

    const tempF = typeof best.temperature === "number" ? best.temperature : null;
    const windMph = parseWindSpeedMph(best.windSpeed);
    const windDirDeg = compassToDegrees(best.windDirection);
    const precipProb = typeof best.probabilityOfPrecipitation?.value === "number"
      ? best.probabilityOfPrecipitation.value / 100
      : null;
    const shortForecast = best.shortForecast || "";
    const stormBoost = /thunder|storm|heavy rain/i.test(shortForecast) ? 0.35 : 0;
    const delayRiskScore = precipProb !== null ? Number(Math.min(1, precipProb * 0.7 + stormBoost).toFixed(2)) : null;

    const vintage: WeatherForecastVintage = {
      forecastId: `wx_nws_${params.gameId}_${Date.parse(issuedUtc)}`,
      gameId: params.gameId,
      venueId: venue.venueId,
      source: "national_weather_service_api",
      issuedUtc,
      validUtc: new Date(best.startTime).toISOString(),
      ingestedUtc: cached.fetchedUtc,
      tempF,
      windMph,
      windGustMph: null,
      windDirDeg,
      precipProb,
      precipIn: null,
      roofStatus: venue.roofType === "retractable" ? (precipProb !== null && precipProb >= 0.45 ? "closed" : "open") : "open",
      surface: venue.surface,
      altitudeFt: venue.altitudeFt,
      airDensityIndex: computeAirDensityIndex(tempF, venue.altitudeFt),
      delayRiskScore,
      status: bestDiff > 7 * 24 * 3600 * 1000 ? "projected" : "confirmed",
      shortForecast
    };

    if (params.db) {
      params.db.prepare(
        `INSERT OR IGNORE INTO weather_forecasts (
          forecast_id, game_id, venue_id, source, issued_utc, valid_utc, ingested_utc,
          temp_f, wind_mph, wind_gust_mph, wind_dir_deg, precip_prob, precip_in,
          roof_status, surface, altitude_ft, air_density_index, delay_risk_score, status, short_forecast
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        vintage.forecastId, vintage.gameId, vintage.venueId, vintage.source,
        vintage.issuedUtc, vintage.validUtc, vintage.ingestedUtc,
        vintage.tempF, vintage.windMph, vintage.windGustMph, vintage.windDirDeg,
        vintage.precipProb, vintage.precipIn, vintage.roofStatus, vintage.surface,
        vintage.altitudeFt, vintage.airDensityIndex, vintage.delayRiskScore,
        vintage.status, vintage.shortForecast || null
      );
    }

    return vintage;
  } catch (err: any) {
    if (params.db) {
      logMonitoringEvent(params.db, {
        severity: "warn",
        source: "nws_weather",
        league: venue.league,
        eventType: "weather_fetch_failed",
        message: `NWS weather failed for ${venue.name}: ${err?.message}`
      });
    }
    return {
      forecastId: `wx_missing_${params.gameId}`,
      gameId: params.gameId,
      venueId: venue.venueId,
      source: "nws_fetch_failed",
      issuedUtc: nowIso,
      validUtc: params.scheduledStartUtc,
      ingestedUtc: nowIso,
      tempF: null,
      windMph: null,
      windGustMph: null,
      windDirDeg: null,
      precipProb: null,
      precipIn: null,
      roofStatus: venue.roofType === "retractable" ? "unknown" : "open",
      surface: venue.surface,
      altitudeFt: venue.altitudeFt,
      airDensityIndex: null,
      delayRiskScore: null,
      status: "missing",
      shortForecast: "NWS forecast temporarily unavailable"
    };
  }
}
