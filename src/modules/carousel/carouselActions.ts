"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import {
  createCarouselItem,
  getCarouselItemById,
  listCarouselItems,
  updateCarouselItem,
  archiveCarouselItem,
  unarchiveCarouselItem,
  createCarouselSlide,
  listCarouselSlides,
  updateCarouselSlide,
  removeCarouselSlide,
  getIdeaItemById,
  getMediaAssetById,
} from "@/lib/data";
import { carouselItemInputSchema, carouselItemUpdateSchema, carouselSlideInputSchema, carouselSlideUpdateSchema } from "@/modules/carousel/schema";
import type { CarouselItem } from "@/types/carouselItem";
import type { CarouselSlide } from "@/types/carouselSlide";
import type { CarouselArchivedFilter } from "@/lib/data/carousel/repository";

/**
 * SOCIAL-10D — the production data-access/action layer for Carousel
 * Studio. Repository + Server Actions only, no UI (SOCIAL-10E owns that) —
 * mirrors `scriptActions.ts`'s own conventions exactly: its own local
 * `requireActiveSession`/`Result<T>`/`GENERIC_ACCESS_ERROR` (copied, not
 * imported — every domain action file in this codebase does this),
 * workspace id and actor id resolved entirely server-side from
 * `resolveMemberSessionSnapshot()`, never trusted from the browser. The
 * MediaAsset ownership check mirrors `ideaActions.ts`'s own
 * `validateOwnedMediaAssetReference` exactly (copied, not imported, per
 * that file's own established per-domain-copy convention).
 *
 * `social.publish` is never used anywhere in this file — Carousel Studio
 * has no publishing feature at all (SOCIAL-10B's own explicit decision).
 */

const GENERIC_ACCESS_ERROR = "That isn't available. You may not have access to it.";
const CAROUSEL_NOT_FOUND_ERROR = "This Carousel could not be found.";
const CAROUSEL_SLIDE_NOT_FOUND_ERROR = "This Carousel slide could not be found.";
const VALIDATION_ERROR = "Please fix the highlighted fields.";
/**
 * Matches the established, repeated precedent across every other
 * archive-capable domain (Idea, Inspiration, Script, Media Assets):
 * editing an archived record is blocked, not silently allowed — restore
 * it first. Applied both to the Carousel's own fields and to its slides
 * (mutating a slide is a form of editing the Carousel, mirroring
 * `verifyScriptNotArchivedForVersion`'s own SOCIAL-08E reasoning), never
 * to reads.
 */
const ARCHIVED_EDIT_ERROR = "An archived Carousel cannot be edited — restore it first.";

type Result<T> = { success: true; data: T } | { success: false; error: string };

type ActiveSessionResult =
  | { success: false; error: string }
  | { success: true; session: Awaited<ReturnType<typeof resolveMemberSessionSnapshot>> & { kind: "active" } };

async function requireActiveSession(permission: "social.view" | "social.create"): Promise<ActiveSessionResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes(permission)) return { success: false, error: GENERIC_ACCESS_ERROR };
  return { success: true, session };
}

async function loadOwnedCarouselItem(id: string, workspaceId: string): Promise<CarouselItem | null> {
  const item = await getCarouselItemById(id).catch(() => null);
  if (!item || item.workspace_id !== workspaceId) return null;
  return item;
}

type ReferenceValidationResult = { success: true } | { success: false; error: string };

/**
 * Ownership-only, same shape as `validateOwnedIdeaReference` already
 * established in `scriptActions.ts`. Never copies the referenced Idea's
 * own content — this only proves the caller is allowed to point at it. A
 * Carousel's `source_idea_id` records that an Idea triggered it, nothing
 * more (SOCIAL-10B's own design) — never synced, never mutated.
 */
async function validateOwnedIdeaReference(ideaId: string, workspaceId: string): Promise<ReferenceValidationResult> {
  const idea = await getIdeaItemById(ideaId).catch(() => null);
  if (!idea || idea.workspace_id !== workspaceId) return { success: false, error: "That Idea reference could not be found." };
  return { success: true };
}

/** Ownership-only, mirrors `ideaActions.ts`'s own `validateOwnedMediaAssetReference` exactly. Deliberately does not require an "approved" status — Carousel Studio is a private planning surface, not a publish pipeline. */
async function validateOwnedMediaAssetReference(assetId: string, workspaceId: string): Promise<ReferenceValidationResult> {
  const asset = await getMediaAssetById(assetId).catch(() => null);
  if (!asset || asset.workspace_id !== workspaceId) return { success: false, error: "That file could not be found." };
  return { success: true };
}

export interface CarouselItemActionInput {
  title: string;
  source_idea_id: string | null;
}

export type CarouselItemActionUpdateInput = Partial<CarouselItemActionInput>;

export async function createCarouselItemAction(input: CarouselItemActionInput): Promise<Result<CarouselItem>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;

  const parsed = carouselItemInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: VALIDATION_ERROR };

  if (parsed.data.source_idea_id) {
    const ideaCheck = await validateOwnedIdeaReference(parsed.data.source_idea_id, resolved.session.workspace.id);
    if (!ideaCheck.success) return ideaCheck;
  }

  return createCarouselItem({
    workspaceId: resolved.session.workspace.id,
    createdBy: resolved.session.user.id,
    title: parsed.data.title,
    sourceIdeaId: parsed.data.source_idea_id,
  });
}

export async function updateCarouselItemAction(id: string, input: CarouselItemActionUpdateInput): Promise<Result<CarouselItem>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;

  const existing = await loadOwnedCarouselItem(id, resolved.session.workspace.id);
  if (!existing) return { success: false, error: CAROUSEL_NOT_FOUND_ERROR };
  if (existing.status === "archived") return { success: false, error: ARCHIVED_EDIT_ERROR };

  const parsed = carouselItemUpdateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: VALIDATION_ERROR };

  if (parsed.data.source_idea_id) {
    const ideaCheck = await validateOwnedIdeaReference(parsed.data.source_idea_id, resolved.session.workspace.id);
    if (!ideaCheck.success) return ideaCheck;
  }

  return updateCarouselItem(id, {
    title: parsed.data.title,
    sourceIdeaId: parsed.data.source_idea_id,
  });
}

export async function getCarouselItemAction(id: string): Promise<Result<CarouselItem>> {
  const resolved = await requireActiveSession("social.view");
  if (!resolved.success) return resolved;

  const item = await loadOwnedCarouselItem(id, resolved.session.workspace.id);
  if (!item) return { success: false, error: CAROUSEL_NOT_FOUND_ERROR };
  return { success: true, data: item };
}

export interface ListCarouselItemsActionFilters {
  archived?: CarouselArchivedFilter;
  search?: string;
  limit?: number;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

/** Never allow an unbounded read regardless of what a caller asks for — mirrors `clampLimit` in `scriptActions.ts`/`ideaActions.ts` exactly. */
function clampLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) return DEFAULT_LIST_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIST_LIMIT);
}

export async function listCarouselItemsAction(filters: ListCarouselItemsActionFilters = {}): Promise<Result<CarouselItem[]>> {
  const resolved = await requireActiveSession("social.view");
  if (!resolved.success) return resolved;

  try {
    const items = await listCarouselItems(resolved.session.workspace.id, {
      archived: filters.archived,
      search: filters.search,
      limit: clampLimit(filters.limit),
    });
    return { success: true, data: items };
  } catch {
    return { success: false, error: "Could not load Carousels." };
  }
}

export async function archiveCarouselItemAction(id: string): Promise<Result<CarouselItem>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;

  const existing = await loadOwnedCarouselItem(id, resolved.session.workspace.id);
  if (!existing) return { success: false, error: CAROUSEL_NOT_FOUND_ERROR };

  return archiveCarouselItem(id);
}

export async function unarchiveCarouselItemAction(id: string): Promise<Result<CarouselItem>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;

  const existing = await loadOwnedCarouselItem(id, resolved.session.workspace.id);
  if (!existing) return { success: false, error: CAROUSEL_NOT_FOUND_ERROR };

  return unarchiveCarouselItem(id);
}

export interface CarouselSlideActionInput {
  content: string;
  sort_order: number;
  media_asset_id: string | null;
}

export type CarouselSlideActionUpdateInput = Partial<CarouselSlideActionInput>;

/**
 * Verifies the target Carousel belongs to the caller's own workspace
 * before creating a slide under it — never trusts a caller-supplied
 * `carouselId` alone. Mirrors `createScriptBlockAction`'s own shape.
 */
export async function createCarouselSlideAction(carouselId: string, input: CarouselSlideActionInput): Promise<Result<CarouselSlide>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;

  const carousel = await loadOwnedCarouselItem(carouselId, resolved.session.workspace.id);
  if (!carousel) return { success: false, error: CAROUSEL_NOT_FOUND_ERROR };
  if (carousel.status === "archived") return { success: false, error: ARCHIVED_EDIT_ERROR };

  const parsed = carouselSlideInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: VALIDATION_ERROR };

  if (parsed.data.media_asset_id) {
    const assetCheck = await validateOwnedMediaAssetReference(parsed.data.media_asset_id, resolved.session.workspace.id);
    if (!assetCheck.success) return assetCheck;
  }

  return createCarouselSlide({
    carouselId,
    workspaceId: resolved.session.workspace.id,
    content: parsed.data.content,
    sortOrder: parsed.data.sort_order,
    mediaAssetId: parsed.data.media_asset_id,
  });
}

/** Mirrors `listScriptBlocksAction`'s own defensive shape — the repository's `listCarouselSlides` filters only by `carousel_id`, so this action-level ownership check is what actually prevents cross-workspace access in mock mode. Reads remain available on an archived Carousel — only writes are blocked. */
export async function listCarouselSlidesAction(carouselId: string): Promise<Result<CarouselSlide[]>> {
  const resolved = await requireActiveSession("social.view");
  if (!resolved.success) return resolved;

  const carousel = await loadOwnedCarouselItem(carouselId, resolved.session.workspace.id);
  if (!carousel) return { success: false, error: CAROUSEL_NOT_FOUND_ERROR };

  try {
    const slides = await listCarouselSlides(carouselId);
    return { success: true, data: slides };
  } catch {
    return { success: false, error: "Could not load Carousel slides." };
  }
}

/**
 * There is no single-slide `getCarouselSlideById` repository primitive (no
 * call site needs it besides this one and `removeCarouselSlideAction`
 * below) — both re-derive the slide via its own carousel's already-scoped
 * slide list, which is workspace-checked one level up by the carousel
 * ownership check below. This is also what proves a slide belongs to
 * *this specific* Carousel, not merely to the caller's workspace — a
 * slide from a different Carousel (even in the same workspace) simply
 * never appears in `listCarouselSlides(carouselId)`'s own results.
 */
export async function updateCarouselSlideAction(carouselId: string, id: string, input: CarouselSlideActionUpdateInput): Promise<Result<CarouselSlide>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;

  const carousel = await loadOwnedCarouselItem(carouselId, resolved.session.workspace.id);
  if (!carousel) return { success: false, error: CAROUSEL_NOT_FOUND_ERROR };
  if (carousel.status === "archived") return { success: false, error: ARCHIVED_EDIT_ERROR };

  const slides = await listCarouselSlides(carouselId).catch(() => []);
  const existing = slides.find((s) => s.id === id);
  if (!existing) return { success: false, error: CAROUSEL_SLIDE_NOT_FOUND_ERROR };

  const parsed = carouselSlideUpdateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: VALIDATION_ERROR };

  if (parsed.data.media_asset_id) {
    const assetCheck = await validateOwnedMediaAssetReference(parsed.data.media_asset_id, resolved.session.workspace.id);
    if (!assetCheck.success) return assetCheck;
  }

  return updateCarouselSlide(id, {
    content: parsed.data.content,
    sortOrder: parsed.data.sort_order,
    mediaAssetId: parsed.data.media_asset_id,
  });
}

/**
 * The one real physical deletion in Carousel Studio, using the DELETE
 * policy SOCIAL-10C's own migration already authorized specifically for
 * `carousel_slides`. Verifies the target carousel's ownership and the
 * slide's membership in that carousel before ever calling the repository
 * — never trusts `id` alone, and never allows a slide belonging to a
 * different carousel (or a different workspace's carousel) to be removed
 * via this action.
 */
export async function removeCarouselSlideAction(carouselId: string, id: string): Promise<Result<null>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;

  const carousel = await loadOwnedCarouselItem(carouselId, resolved.session.workspace.id);
  if (!carousel) return { success: false, error: CAROUSEL_NOT_FOUND_ERROR };
  if (carousel.status === "archived") return { success: false, error: ARCHIVED_EDIT_ERROR };

  const slides = await listCarouselSlides(carouselId).catch(() => []);
  const existing = slides.find((s) => s.id === id);
  if (!existing) return { success: false, error: CAROUSEL_SLIDE_NOT_FOUND_ERROR };

  return removeCarouselSlide(id);
}
