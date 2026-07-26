import type { ServiceStatus } from "@/core/enums/serviceStatus";

/**
 * The catalog identity of a reusable operational unit ("Photography",
 * "Luxury Picnic") — mutable, and deliberately holds none of the actual
 * operational content itself. Every template row, every piece of AI
 * knowledge, every operational-metadata field (setup duration, difficulty,
 * weather sensitivity, ...) lives on `ServiceVersion` instead
 * (`types/serviceVersion.ts`), scoped to `service_version_id` — this row is
 * only the stable thing a name/category/status hang off of, and the thing an
 * EventService's `service_id` points at for "what kind of Service is this,
 * generally" grouping/reporting, independent of which specific version was
 * actually assigned.
 *
 * `draft_version_id` always points at the one ServiceVersion currently being
 * edited (every Service has exactly one, from the moment it's created).
 * `current_published_version_id` is null until the first "Publish new
 * version" action, then always points at the most recent published version
 * — new Event assignments default to this one, though a caller may pin to
 * any older published version explicitly (rare, but not disallowed).
 *
 * A Service with no published version yet cannot be assigned to any Event —
 * see canAssignService in core/workflows/serviceWorkflow.ts.
 */
export interface Service {
  id: string;
  workspace_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  status: ServiceStatus;
  draft_version_id: string | null;
  current_published_version_id: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}
