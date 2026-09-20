import { selectRepository } from "@/lib/data/provider";
import { mockMediaKitRepository } from "@/lib/data/mediaKit/mockRepository";
import { supabaseMediaKitRepository } from "@/lib/data/mediaKit/supabaseRepository";
import type { DataResult } from "@/lib/data/result";
import type {
  MediaKit,
  MediaKitAppearance,
  MediaKitBrandInput,
  MediaKitContactCtaInput,
  MediaKitGalleryItem,
  MediaKitGalleryItemInput,
  MediaKitOverview,
  MediaKitPartner,
  MediaKitPartnerInput,
  MediaKitPortfolioItem,
  MediaKitPortfolioItemInput,
  MediaKitPressFeature,
  MediaKitPressFeatureInput,
  MediaKitServiceCuration,
  MediaKitServiceCurationInput,
  MediaKitSocialLink,
  MediaKitTestimonial,
  MediaKitTestimonialInput,
} from "@/types/mediaKit";

const repository = selectRepository({ mock: mockMediaKitRepository, supabase: supabaseMediaKitRepository });

/**
 * Self-contained module entry point — kept out of the central
 * `lib/data/index.ts` (which every other Phase 1 MVP business module wires
 * through) deliberately: that file is a single, very large, shared surface
 * covering dozens of unrelated modules, and Media Kit's own repository is
 * small enough this phase (read + explicit-create only) that adding it
 * there would be a wide-blast-radius edit for no real benefit.
 * `selectRepository` — the one thing that actually matters for the
 * mock/Supabase convention — is still used exactly the same way.
 *
 * MEDIAKIT-02.1 — a plain page load must never persist a row. Returns
 * `null` when the workspace has no Media Kit yet; the caller (the Server
 * Action, then the view) renders the first-use setup state instead of
 * silently creating one.
 */
export async function getMediaKitOverview(workspaceId: string): Promise<MediaKitOverview | null> {
  const mediaKit = await repository.getMediaKit(workspaceId);
  if (!mediaKit) return null;

  const [contentStatus, analytics, recentActivity] = await Promise.all([
    repository.getMediaKitContentStatus(workspaceId, mediaKit.id),
    repository.getMediaKitAnalyticsSummary(workspaceId, mediaKit.id),
    repository.getMediaKitRecentActivity(workspaceId, mediaKit.id, 8),
  ]);
  return { mediaKit, contentStatus, analytics, recentActivity };
}

/** The one explicit creation path — invoked only from the founder's own "Create Media Kit" action. */
export async function createMediaKitForWorkspace(workspaceId: string): Promise<DataResult<MediaKit>> {
  return repository.createMediaKit(workspaceId);
}

/**
 * MEDIAKIT-03 — the server-side id resolver every Brand/Services Server
 * Action uses instead of trusting a client-supplied `mediaKitId`: re-derive
 * it from the session's own `workspaceId` on every mutation, matching the
 * "never trust a client id" convention the DB-layer functions already
 * enforce.
 */
export async function getMediaKitForWorkspace(workspaceId: string): Promise<MediaKit | null> {
  return repository.getMediaKit(workspaceId);
}

/** MEDIAKIT-03 — Brand editor save. Only the identity/story/location fields; no other `media_kits` field is ever touched here. */
export async function updateMediaKitBrandForWorkspace(workspaceId: string, mediaKitId: string, input: MediaKitBrandInput): Promise<DataResult<MediaKit>> {
  return repository.updateMediaKitBrand(workspaceId, mediaKitId, input);
}

/**
 * Raw curation rows only — never composed with the canonical Services
 * catalog here. `getServicesCatalog()` (the canonical, never-duplicated
 * Services read path) resolves its own session via
 * `requireWorkspaceSession()` → `getClientWorkspaceSession()`, which is a
 * browser-only Supabase client (see `src/lib/supabase/client.ts`) — it has
 * no request cookies to read when called from inside a `"use server"`
 * Server Action's own call chain, and throws `UnauthorizedError` there even
 * though the caller is genuinely signed in. So the Services catalog is
 * fetched directly from the Client Component instead (the same
 * already-proven entry point `useServicesCatalog.ts` uses), and joined
 * there against these curation rows — see `MediaKitServicesCurator.tsx`.
 */
export async function getMediaKitServiceCurationsForWorkspace(workspaceId: string, mediaKitId: string): Promise<MediaKitServiceCuration[]> {
  return repository.listMediaKitServiceCurations(workspaceId, mediaKitId);
}

export async function setMediaKitServiceIncludedForWorkspace(
  workspaceId: string,
  mediaKitId: string,
  serviceId: string,
  included: boolean,
): Promise<DataResult<MediaKitServiceCuration>> {
  return repository.setMediaKitServiceIncluded(workspaceId, mediaKitId, serviceId, included);
}

export async function updateMediaKitServiceCurationForWorkspace(
  workspaceId: string,
  curationId: string,
  input: MediaKitServiceCurationInput,
): Promise<DataResult<MediaKitServiceCuration>> {
  return repository.updateMediaKitServiceCuration(workspaceId, curationId, input);
}

export async function reorderMediaKitServicesForWorkspace(
  workspaceId: string,
  mediaKitId: string,
  orderedCurationIds: string[],
): Promise<DataResult<MediaKitServiceCuration[]>> {
  return repository.reorderMediaKitServices(workspaceId, mediaKitId, orderedCurationIds);
}

// ── MEDIAKIT-04 — Portfolio ────────────────────────────────────────────

export async function listMediaKitPortfolioItemsForWorkspace(workspaceId: string, mediaKitId: string): Promise<MediaKitPortfolioItem[]> {
  return repository.listMediaKitPortfolioItems(workspaceId, mediaKitId);
}

export async function createMediaKitPortfolioItemForWorkspace(
  workspaceId: string,
  mediaKitId: string,
  input: MediaKitPortfolioItemInput,
): Promise<DataResult<MediaKitPortfolioItem>> {
  return repository.createMediaKitPortfolioItem(workspaceId, mediaKitId, input);
}

export async function updateMediaKitPortfolioItemForWorkspace(
  workspaceId: string,
  itemId: string,
  input: MediaKitPortfolioItemInput,
): Promise<DataResult<MediaKitPortfolioItem>> {
  return repository.updateMediaKitPortfolioItem(workspaceId, itemId, input);
}

export async function archiveMediaKitPortfolioItemForWorkspace(workspaceId: string, itemId: string): Promise<DataResult<MediaKitPortfolioItem>> {
  return repository.archiveMediaKitPortfolioItem(workspaceId, itemId);
}

export async function reorderMediaKitPortfolioItemsForWorkspace(
  workspaceId: string,
  mediaKitId: string,
  orderedItemIds: string[],
): Promise<DataResult<MediaKitPortfolioItem[]>> {
  return repository.reorderMediaKitPortfolioItems(workspaceId, mediaKitId, orderedItemIds);
}

// ── MEDIAKIT-04 — Gallery ──────────────────────────────────────────────

export async function listMediaKitGalleryItemsForWorkspace(workspaceId: string, mediaKitId: string, portfolioItemId: string | null): Promise<MediaKitGalleryItem[]> {
  return repository.listMediaKitGalleryItems(workspaceId, mediaKitId, portfolioItemId);
}

export async function addMediaKitGalleryItemForWorkspace(
  workspaceId: string,
  mediaKitId: string,
  portfolioItemId: string | null,
  mediaAssetId: string,
): Promise<DataResult<MediaKitGalleryItem>> {
  return repository.addMediaKitGalleryItem(workspaceId, mediaKitId, portfolioItemId, mediaAssetId);
}

export async function updateMediaKitGalleryItemForWorkspace(workspaceId: string, itemId: string, input: MediaKitGalleryItemInput): Promise<DataResult<MediaKitGalleryItem>> {
  return repository.updateMediaKitGalleryItem(workspaceId, itemId, input);
}

export async function archiveMediaKitGalleryItemForWorkspace(workspaceId: string, itemId: string): Promise<DataResult<MediaKitGalleryItem>> {
  return repository.archiveMediaKitGalleryItem(workspaceId, itemId);
}

export async function reorderMediaKitGalleryItemsForWorkspace(
  workspaceId: string,
  mediaKitId: string,
  portfolioItemId: string | null,
  orderedItemIds: string[],
): Promise<DataResult<MediaKitGalleryItem[]>> {
  return repository.reorderMediaKitGalleryItems(workspaceId, mediaKitId, portfolioItemId, orderedItemIds);
}

// ── MEDIAKIT-04 — Publish ──────────────────────────────────────────────

export async function publishMediaKitForWorkspace(workspaceId: string, mediaKitId: string): Promise<DataResult<MediaKit>> {
  return repository.publishMediaKit(workspaceId, mediaKitId);
}

// ── MEDIAKIT-05 — Partners ─────────────────────────────────────────────

export async function listMediaKitPartnersForWorkspace(workspaceId: string, mediaKitId: string): Promise<MediaKitPartner[]> {
  return repository.listMediaKitPartners(workspaceId, mediaKitId);
}
export async function createMediaKitPartnerForWorkspace(workspaceId: string, mediaKitId: string, input: MediaKitPartnerInput): Promise<DataResult<MediaKitPartner>> {
  return repository.createMediaKitPartner(workspaceId, mediaKitId, input);
}
export async function updateMediaKitPartnerForWorkspace(workspaceId: string, partnerId: string, input: MediaKitPartnerInput): Promise<DataResult<MediaKitPartner>> {
  return repository.updateMediaKitPartner(workspaceId, partnerId, input);
}
export async function archiveMediaKitPartnerForWorkspace(workspaceId: string, partnerId: string): Promise<DataResult<MediaKitPartner>> {
  return repository.archiveMediaKitPartner(workspaceId, partnerId);
}
export async function reorderMediaKitPartnersForWorkspace(workspaceId: string, mediaKitId: string, orderedPartnerIds: string[]): Promise<DataResult<MediaKitPartner[]>> {
  return repository.reorderMediaKitPartners(workspaceId, mediaKitId, orderedPartnerIds);
}

// ── MEDIAKIT-05 — Testimonials ───────────────────────────────────────

export async function listMediaKitTestimonialsForWorkspace(workspaceId: string, mediaKitId: string): Promise<MediaKitTestimonial[]> {
  return repository.listMediaKitTestimonials(workspaceId, mediaKitId);
}
export async function createMediaKitTestimonialForWorkspace(workspaceId: string, mediaKitId: string, input: MediaKitTestimonialInput): Promise<DataResult<MediaKitTestimonial>> {
  return repository.createMediaKitTestimonial(workspaceId, mediaKitId, input);
}
export async function updateMediaKitTestimonialForWorkspace(workspaceId: string, testimonialId: string, input: MediaKitTestimonialInput): Promise<DataResult<MediaKitTestimonial>> {
  return repository.updateMediaKitTestimonial(workspaceId, testimonialId, input);
}
export async function setMediaKitTestimonialApprovedForWorkspace(workspaceId: string, testimonialId: string, approved: boolean): Promise<DataResult<MediaKitTestimonial>> {
  return repository.setMediaKitTestimonialApproved(workspaceId, testimonialId, approved);
}
export async function archiveMediaKitTestimonialForWorkspace(workspaceId: string, testimonialId: string): Promise<DataResult<MediaKitTestimonial>> {
  return repository.archiveMediaKitTestimonial(workspaceId, testimonialId);
}
export async function reorderMediaKitTestimonialsForWorkspace(workspaceId: string, mediaKitId: string, orderedTestimonialIds: string[]): Promise<DataResult<MediaKitTestimonial[]>> {
  return repository.reorderMediaKitTestimonials(workspaceId, mediaKitId, orderedTestimonialIds);
}

// ── MEDIAKIT-05 — Press ──────────────────────────────────────────────

export async function listMediaKitPressFeaturesForWorkspace(workspaceId: string, mediaKitId: string): Promise<MediaKitPressFeature[]> {
  return repository.listMediaKitPressFeatures(workspaceId, mediaKitId);
}
export async function createMediaKitPressFeatureForWorkspace(workspaceId: string, mediaKitId: string, input: MediaKitPressFeatureInput): Promise<DataResult<MediaKitPressFeature>> {
  return repository.createMediaKitPressFeature(workspaceId, mediaKitId, input);
}
export async function updateMediaKitPressFeatureForWorkspace(workspaceId: string, pressFeatureId: string, input: MediaKitPressFeatureInput): Promise<DataResult<MediaKitPressFeature>> {
  return repository.updateMediaKitPressFeature(workspaceId, pressFeatureId, input);
}
export async function archiveMediaKitPressFeatureForWorkspace(workspaceId: string, pressFeatureId: string): Promise<DataResult<MediaKitPressFeature>> {
  return repository.archiveMediaKitPressFeature(workspaceId, pressFeatureId);
}
export async function reorderMediaKitPressFeaturesForWorkspace(workspaceId: string, mediaKitId: string, orderedPressFeatureIds: string[]): Promise<DataResult<MediaKitPressFeature[]>> {
  return repository.reorderMediaKitPressFeatures(workspaceId, mediaKitId, orderedPressFeatureIds);
}

// ── MEDIAKIT-05 — Social / Contact & CTA / Appearance ────────────────

export async function updateMediaKitSocialLinksForWorkspace(workspaceId: string, mediaKitId: string, links: MediaKitSocialLink[]): Promise<DataResult<MediaKit>> {
  return repository.updateMediaKitSocialLinks(workspaceId, mediaKitId, links);
}
export async function updateMediaKitContactCtaForWorkspace(workspaceId: string, mediaKitId: string, input: MediaKitContactCtaInput): Promise<DataResult<MediaKit>> {
  return repository.updateMediaKitContactCta(workspaceId, mediaKitId, input);
}
export async function updateMediaKitAppearanceForWorkspace(workspaceId: string, mediaKitId: string, input: MediaKitAppearance): Promise<DataResult<MediaKit>> {
  return repository.updateMediaKitAppearance(workspaceId, mediaKitId, input);
}
