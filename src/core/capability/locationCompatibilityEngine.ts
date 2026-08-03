import type { LocationSnapshot } from "@/types/workforce";
import type { CapabilityLocationRequirement, DistanceResult } from "@/types/capability";

/**
 * v2.0 Checkpoint 26.1, Step 9 — Distance Foundation. Deterministic
 * straight-line (haversine) distance only, reusing Checkpoint 26's
 * Location Foundation (`LocationSnapshot`) — no maps, no routes, no
 * travel-time prediction, no external map provider, per the stop
 * condition.
 */
const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Pure haversine formula — the same great-circle distance calculation every GPS-free "as the crow flies" tool uses, deterministic to the bit for the same two coordinate pairs. */
function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * `kind: "unknown"` — not `0` — whenever the worker has no recorded
 * location. Treating "we don't know" as "co-located" would silently
 * inflate a worker's location score and eligibility; the honest result
 * says exactly why the distance is unknown.
 */
export function computeDistanceToRequirement(workerLocation: LocationSnapshot | null, locationRequirement: CapabilityLocationRequirement | null): DistanceResult {
  if (locationRequirement === null) return { kind: "unknown", distanceKm: null, reason: "This requirement has no location requirement to measure against." };
  if (workerLocation === null) return { kind: "unknown", distanceKm: null, reason: "This worker has no recorded location snapshot." };

  const distanceKm = haversineDistanceKm(workerLocation.latitude, workerLocation.longitude, locationRequirement.latitude, locationRequirement.longitude);
  return { kind: "known", distanceKm, reason: null };
}

/** A `maximumDistanceKm: null` means no distance limit is configured — always compatible. An `"unknown"` distance is never treated as within range; it's a real, disclosed "can't tell" state a caller must handle explicitly (see `eligibilityEngine.ts`'s `"unknown"` `EligibilityState`). */
export function isWithinMaximumDistance(distance: DistanceResult, maximumDistanceKm: number | null): boolean | null {
  if (maximumDistanceKm === null) return true;
  if (distance.kind === "unknown") return null;
  return distance.distanceKm! <= maximumDistanceKm;
}
