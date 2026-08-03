import { SERVICE_STATUSES, type ServiceStatus } from "@/core/enums/serviceStatus";
import type { ServiceVersion } from "@/types/serviceVersion";

export { SERVICE_STATUSES };
export type { ServiceStatus };

/**
 * The catalog-identity lifecycle. "draft" is the only status a Service with
 * no published version can ever hold (see canPublishServiceVersion below);
 * "archived" is a real member, not a boolean, matching every other module's
 * status-enum shape (Purchase, Invoice, ...) — a restored Service has one
 * obvious re-entry point.
 */
const SERVICE_TRANSITIONS: Record<ServiceStatus, ServiceStatus[]> = {
  draft: ["active", "archived"],
  active: ["inactive", "archived"],
  inactive: ["active", "archived"],
  archived: ["draft"],
};

export function canTransitionServiceStatus(from: ServiceStatus, to: ServiceStatus): boolean {
  if (from === to) return false;
  return SERVICE_TRANSITIONS[from].includes(to);
}

/**
 * A Service may only be assigned to an Event while it's "active" AND has a
 * published version to pin to — "inactive"/"draft"/"archived" all block new
 * assignments (inactive is a deliberate pause, not a removal; existing
 * EventServices already assigned are completely unaffected either way, since
 * they read their pinned ServiceVersion directly, never this status).
 */
export function canAssignService(service: { status: ServiceStatus; current_published_version_id: string | null }): boolean {
  return service.status === "active" && service.current_published_version_id !== null;
}

/** Every template table (checklist/timeline/inventory/... template rows) may only be inserted, updated, or deleted while their parent ServiceVersion is still "draft" — once "published" a version is frozen forever. */
export function canEditServiceVersionTemplates(version: Pick<ServiceVersion, "status">): boolean {
  return version.status === "draft";
}

/** The Service's own name/category/status may be edited regardless of version state — those are catalog-identity fields, not operational content, and were never versioned in the first place. */
export function canEditServiceCatalogFields(service: { status: ServiceStatus }): boolean {
  return service.status !== "archived";
}

/**
 * The next version_number to stamp when publishing — one past the highest
 * number any of this Service's versions has ever reached. Draft versions
 * always have `version_number: null` (see ServiceVersion's own doc comment),
 * so they're excluded here rather than treated as 0.
 */
export function computeNextServiceVersionNumber(existingVersionNumbers: Array<number | null>): number {
  const highest = existingVersionNumbers.reduce<number>((max, value) => (value != null && value > max ? value : max), 0);
  return highest + 1;
}

/**
 * Minimal, structural publish gate — NOT a completeness/quality score
 * (that's Service Health, Phase 2c). Just "is there enough here to generate
 * anything at all." No name check here: a version has no name of its own
 * to validate (see ServiceVersion's own doc comment) — Service.name is
 * already guaranteed non-blank by serviceInputSchema at creation/update
 * time, so nothing here needs to re-check it.
 */
export function canPublishServiceVersion(version: Pick<ServiceVersion, "status" | "base_price_minor">): string | null {
  if (version.status !== "draft") return "Only a draft version can be published.";
  if (!Number.isInteger(version.base_price_minor) || version.base_price_minor < 0) {
    return "Base price must be a non-negative whole number of minor units.";
  }
  return null;
}
