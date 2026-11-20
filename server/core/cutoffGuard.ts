import { DataStatus, ProvenancedValue } from "./types";

export interface CutoffCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Enforces strict point-in-time cutoff: an observation or forecast
 * cannot be used in prediction or evaluation at `cutoffUtc` if it was only
 * knowable after `cutoffUtc`.
 */
export function isAvailableAtCutoff(earliestKnownUtc: string | null | undefined, cutoffUtc: string): CutoffCheckResult {
  if (!earliestKnownUtc) {
    return { allowed: false, reason: "Missing earliestKnownUtc timestamp; rejected to prevent data leakage." };
  }
  const knownMs = Date.parse(earliestKnownUtc);
  const cutoffMs = Date.parse(cutoffUtc);
  if (Number.isNaN(knownMs) || Number.isNaN(cutoffMs)) {
    return { allowed: false, reason: "Invalid ISO timestamp in cutoff comparison." };
  }
  if (knownMs > cutoffMs) {
    return {
      allowed: false,
      reason: `Leakage blocked: earliestKnownUtc (${earliestKnownUtc}) > cutoffUtc (${cutoffUtc}).`
    };
  }
  return { allowed: true };
}

export function filterByCutoff<T extends { earliestKnownUtc?: string; issuedUtc?: string; capturedUtc?: string }>(
  items: T[],
  cutoffUtc: string
): T[] {
  const cutoffMs = Date.parse(cutoffUtc);
  if (Number.isNaN(cutoffMs)) return [];
  return items.filter(item => {
    const ts = item.earliestKnownUtc || item.issuedUtc || item.capturedUtc;
    if (!ts) return false;
    const ms = Date.parse(ts);
    return !Number.isNaN(ms) && ms <= cutoffMs;
  });
}

export function checkFreshnessStatus(
  sourceTimestampUtc: string | null,
  cutoffUtc: string,
  staleThresholdMinutes: number
): DataStatus {
  if (!sourceTimestampUtc) return "missing";
  const srcMs = Date.parse(sourceTimestampUtc);
  const cutMs = Date.parse(cutoffUtc);
  if (Number.isNaN(srcMs) || Number.isNaN(cutMs)) return "missing";
  if (srcMs > cutMs) return "missing"; // Future data cannot be treated as present
  const ageMinutes = (cutMs - srcMs) / 60000;
  if (ageMinutes > staleThresholdMinutes) return "stale";
  return "confirmed";
}

export function makeProvenancedValue<T>(params: {
  value: T | null;
  units: string;
  source: string;
  sourcePublishedUtc: string | null;
  eventTimeUtc: string;
  ingestedUtc?: string;
  cutoffUtc?: string;
  status: DataStatus;
  notes?: string;
}): ProvenancedValue<T> {
  const ingestedUtc = params.ingestedUtc || new Date().toISOString();
  const earliestKnownUtc = params.sourcePublishedUtc || ingestedUtc;
  let finalStatus = params.status;
  let finalValue = params.value;

  if (params.cutoffUtc) {
    const check = isAvailableAtCutoff(earliestKnownUtc, params.cutoffUtc);
    if (!check.allowed && params.status !== "not_applicable") {
      finalStatus = "missing";
      finalValue = null;
    }
  }

  return {
    value: finalValue,
    units: params.units,
    source: params.source,
    sourcePublishedUtc: params.sourcePublishedUtc,
    eventTimeUtc: params.eventTimeUtc,
    ingestedUtc,
    earliestKnownUtc,
    status: finalStatus,
    notes: params.notes
  };
}
