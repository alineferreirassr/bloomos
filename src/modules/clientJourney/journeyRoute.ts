import type { JourneySubjectType } from "@/types/clientJourney";

/**
 * v2.0 Checkpoint 32 — a `ClientJourney` has no persisted id of its own
 * (it is a computed read model over a Lead or Client, see
 * `types/clientJourney.ts`), so the Journey Detail route needs a
 * composite id encoding which subject it's for. `subjectId` values never
 * contain a colon (see `generateId` in `lib/data/utils.ts`), so splitting
 * on the first colon only is always unambiguous.
 */
export function journeyRouteId(subjectType: JourneySubjectType, subjectId: string): string {
  return `${subjectType}:${subjectId}`;
}

export function parseJourneyRouteId(routeId: string): { subjectType: JourneySubjectType; subjectId: string } | null {
  const decoded = decodeURIComponent(routeId);
  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) return null;
  const subjectType = decoded.slice(0, separatorIndex);
  const subjectId = decoded.slice(separatorIndex + 1);
  if (subjectType !== "lead" && subjectType !== "client") return null;
  if (!subjectId) return null;
  return { subjectType, subjectId };
}
