export type MediaKitStatus = "draft" | "published" | "unpublished";
export type MediaKitCtaType = "inquiry_form" | "external_url";

export interface MediaKitSocialLink {
  platform: string;
  handle_or_url: string;
  is_visible: boolean;
}

/**
 * Mirrors `media_kits` (supabase/migrations/20260929100200_media_kit_foundation.sql)
 * exactly — one row per workspace (`unique(workspace_id)`). `social_links`/
 * `appearance` are the two genuinely variable-shape config fields the
 * migration deliberately kept as JSONB rather than fragmenting into more
 * tables; every other field is a plain column.
 */
export interface MediaKit {
  id: string;
  workspace_id: string;
  slug: string;
  headline: string | null;
  positioning_statement: string | null;
  brand_narrative: string | null;
  location_label: string | null;
  service_area: string | null;
  established_year: number | null;
  specialty_label: string | null;
  contact_headline: string | null;
  contact_subtext: string | null;
  primary_cta_label: string;
  primary_cta_type: MediaKitCtaType;
  primary_cta_external_url: string | null;
  secondary_cta_label: string | null;
  secondary_cta_url: string | null;
  social_links: MediaKitSocialLink[];
  appearance: Record<string, unknown>;
  status: MediaKitStatus;
  current_published_snapshot_id: string | null;
  published_at: string | null;
  published_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

/**
 * A section's readiness is always a deterministic, documented rule — never
 * a fabricated percentage or subjective score. `in_progress` only appears
 * where a real "started but not yet sufficient" state is actually
 * distinguishable from the data (Brand: some but not the required fields
 * populated; Services: curation rows exist but none are included) — a
 * section with no editor yet can only ever be `not_started`/`ready`
 * (existence of an included/approved row, per the exact rule documented on
 * each field of `MediaKitContentStatus` below), since there's no
 * meaningful partial state to report without one.
 *
 * MEDIAKIT-03 rules:
 * - brand: not_started when headline, positioning_statement, and
 *   brand_narrative are ALL empty; ready when BOTH headline AND
 *   positioning_statement are non-empty (the two fields explicitly called
 *   out as "the primary statement visitors will see"); in_progress
 *   otherwise. brand_narrative/location/service_area/established_year/
 *   specialty are never required to reach ready.
 * - services: not_started when zero media_kit_services rows exist;
 *   in_progress when rows exist but none are is_included; ready when at
 *   least one non-archived row is is_included.
 *
 * Sections without an editor yet (portfolio/partners/testimonials/press/
 * gallery/contact) keep the original two-outcome rule: at least one
 * non-archived, `is_included` row exists (testimonials additionally
 * requires `is_approved`; contact requires contact_headline or
 * contact_subtext) — never `in_progress`, since no editor exists yet to
 * produce a real partial state for them.
 */
export type MediaKitSectionReadiness = "not_started" | "in_progress" | "ready";

export interface MediaKitContentStatus {
  brand: MediaKitSectionReadiness;
  services: MediaKitSectionReadiness;
  portfolio: MediaKitSectionReadiness;
  partners: MediaKitSectionReadiness;
  testimonials: MediaKitSectionReadiness;
  press: MediaKitSectionReadiness;
  gallery: MediaKitSectionReadiness;
  contact: MediaKitSectionReadiness;
}

/**
 * Derived from `media_kit_view_events` (count per event_type). Every field
 * is a real aggregate query, never a placeholder — if there are zero rows,
 * every field here is genuinely `0`, not omitted or estimated.
 */
export interface MediaKitAnalyticsSummary {
  totalViews: number;
  approxUniqueVisitors: number;
  inquiries: number;
  leadsGenerated: number;
}

export type MediaKitEventType = "viewed" | "cta_clicked" | "contact_started" | "inquiry_submitted";

export interface MediaKitRecentActivityItem {
  id: string;
  eventType: MediaKitEventType;
  occurredAt: string;
}

export interface MediaKitOverview {
  mediaKit: MediaKit;
  contentStatus: MediaKitContentStatus;
  analytics: MediaKitAnalyticsSummary;
  recentActivity: MediaKitRecentActivityItem[];
}

/**
 * MEDIAKIT-03 — Brand editor. Only the identity/story/location fields this
 * checkpoint owns; `contact_*`/`primary_cta_*`/`secondary_cta_*` (Contact &
 * CTA) and `social_links`/`appearance` (Social/Appearance) stay out of
 * scope, per each future section's own ownership.
 */
export interface MediaKitBrandInput {
  headline: string | null;
  positioning_statement: string | null;
  brand_narrative: string | null;
  location_label: string | null;
  service_area: string | null;
  established_year: number | null;
  specialty_label: string | null;
}

/**
 * Mirrors `media_kit_services` (supabase/migrations/20260929100200_media_kit_foundation.sql)
 * exactly. This is curation OVER an existing canonical `services` row
 * (`service_id`) — never a duplicate service record. `headline_override`/
 * `description_override` are nullable by design: null means "fall back to
 * the canonical Service's own name/description," never an empty string
 * silently copied in at creation time.
 */
export interface MediaKitServiceCuration {
  id: string;
  workspace_id: string;
  media_kit_id: string;
  service_id: string;
  headline_override: string | null;
  description_override: string | null;
  icon_key: string | null;
  public_starting_price_minor: number | null;
  public_price_label: string | null;
  is_featured: boolean;
  is_included: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

/** The editable subset of a curation row — everything except identity/ordering/inclusion, which have their own dedicated actions. */
export interface MediaKitServiceCurationInput {
  headline_override: string | null;
  description_override: string | null;
  public_starting_price_minor: number | null;
  public_price_label: string | null;
  is_featured: boolean;
}

/**
 * The Services curator's own view model — one row per canonical Service the
 * workspace owns, joined (in memory, never a second Service catalog) with
 * its Media Kit curation row if one exists yet. `curation: null` means this
 * Service has never been added to the Media Kit at all.
 */
export interface MediaKitCuratedServiceRow {
  serviceId: string;
  serviceName: string;
  serviceDescription: string | null;
  categoryName: string | null;
  /** Null when the Service has never been published — no real public price exists to show yet. */
  publishedPriceMinor: number | null;
  publishedCurrency: string | null;
  curation: MediaKitServiceCuration | null;
}
