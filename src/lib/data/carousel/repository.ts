import type { CarouselItem, CarouselStatus } from "@/types/carouselItem";
import type { CarouselSlide } from "@/types/carouselSlide";
import type { DataResult } from "@/lib/data/result";

export interface CreateCarouselItemInput {
  workspaceId: string;
  /** The real `auth.users.id` UUID — never a display name/email. Mirrors `script_items.created_by`'s own uuid FK convention. */
  createdBy: string | null;
  title: string;
  /** Ownership against the caller's own workspace must already be verified by the Action layer before this is ever called — mirrors `createScriptItem`'s own `sourceIdeaId` trust boundary. */
  sourceIdeaId: string | null;
}

export interface UpdateCarouselItemInput {
  title?: string;
  sourceIdeaId?: string | null;
}

export type CarouselArchivedFilter = "active" | "archived" | "all";

export interface ListCarouselItemsFilters {
  /** Defaults to "active" — an archived Carousel never appears in a plain list unless explicitly asked for. */
  archived?: CarouselArchivedFilter;
  /** Plain substring text, matched against title only. Never a filter DSL. */
  search?: string;
  /** Defaults to 50; a future Action layer clamps this before it ever reaches the repository — see `scriptActions.ts`'s own precedent. */
  limit?: number;
  offset?: number;
}

export interface CreateCarouselSlideInput {
  carouselId: string;
  workspaceId: string;
  content: string;
  sortOrder: number;
  mediaAssetId: string | null;
}

export interface UpdateCarouselSlideInput {
  content?: string;
  sortOrder?: number;
  mediaAssetId?: string | null;
}

/**
 * SOCIAL-10C — the production data-access layer for Carousel Studio.
 * Mirrors `ScriptRepository`'s own combined-domain shape (one repository
 * covering a parent entity and its ordered child rows) rather than Idea/
 * Inspiration's single-table shape, since Carousel is genuinely a
 * two-table domain (carousel_items → carousel_slides) — splitting it into
 * two separate repository files would fragment operations that share the
 * same ownership chain for no benefit. Simpler than `ScriptRepository`
 * itself: no version layer exists (SOCIAL-10B decided against
 * versioning), so slides are scoped to `carousel_id` directly, never
 * through an intermediate version row. Reads return raw domain values (or
 * throw, for a must-exist single read), writes return `DataResult<T>`.
 *
 * Workspace ownership for any operation taking an existing `id` is
 * verified by a future Action layer's own `loadOwned*` helpers before any
 * of these are called — the exact same trust boundary `loadOwnedScriptItem`
 * already establishes — so these methods take only an `id`, never a
 * redundant `workspaceId`, except where the input itself already carries
 * one (create calls).
 *
 * No destructive delete exists for `carousel_items` (archive-only,
 * matching Idea/Script's own convention). `carousel_slides` is the one
 * exception: SOCIAL-10C's own migration includes a workspace-member-gated
 * DELETE policy for it from the start (see the migration's own header
 * comment for why this was decided immediately rather than deferred).
 */
export interface CarouselRepository {
  createCarouselItem(input: CreateCarouselItemInput): Promise<DataResult<CarouselItem>>;
  /** Throws if no row with this id exists at all — mirrors `getScriptItemById` exactly. Cross-workspace ownership is the caller's own responsibility (a future `loadOwnedCarouselItem`). */
  getCarouselItemById(id: string): Promise<CarouselItem>;
  listCarouselItems(workspaceId: string, filters?: ListCarouselItemsFilters): Promise<CarouselItem[]>;
  updateCarouselItem(id: string, input: UpdateCarouselItemInput): Promise<DataResult<CarouselItem>>;
  /** Idempotent — archiving an already-archived item returns it unchanged rather than erroring or re-stamping `archived_at`. */
  archiveCarouselItem(id: string): Promise<DataResult<CarouselItem>>;
  /** Idempotent — unarchiving an already-active item returns it unchanged. */
  unarchiveCarouselItem(id: string): Promise<DataResult<CarouselItem>>;

  createCarouselSlide(input: CreateCarouselSlideInput): Promise<DataResult<CarouselSlide>>;
  listCarouselSlides(carouselId: string): Promise<CarouselSlide[]>;
  updateCarouselSlide(id: string, input: UpdateCarouselSlideInput): Promise<DataResult<CarouselSlide>>;
  /** The one real physical deletion anywhere in Carousel Studio, authorized specifically for this table by SOCIAL-10C's own migration. Idempotent-unfriendly by design (mirrors `removeScriptBlock`'s own shape): returns a not-found error rather than silently succeeding if the slide is already gone. */
  removeCarouselSlide(id: string): Promise<DataResult<null>>;
}

export type { CarouselStatus };
