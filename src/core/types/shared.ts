import type { EntityType } from "@/core/enums/entityType";

/** Re-exported so a Core consumer has one import path for the result envelope every repository already returns. */
export type { DataResult } from "@/lib/data/result";
export { ok, fail } from "@/lib/data/result";

/**
 * The polymorphic-owner pair every Core concern (Notes, Timeline, Tags,
 * Comments, Audit Log) repeats individually as `ownerType`/`ownerId`
 * parameters — this named shape exists for the places that want to pass it
 * as one value (e.g. a UI component prop, a batched lookup), not to replace
 * the individual-parameter convention those repositories already use.
 */
export interface OwnerRef {
  workspaceId: string;
  ownerType: EntityType;
  ownerId: string;
}

/** A minimal cursor-paginated result shape — not used by any Core repository yet (none needs pagination this phase), available for the first one that does. */
export interface Paginated<T> {
  items: T[];
  total: number;
  cursor: string | null;
}
