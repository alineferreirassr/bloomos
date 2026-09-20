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
 * A section is "ready" only by a deterministic, documented rule — never a
 * fabricated percentage. Brand/Contact: at least one of their own text
 * fields is non-empty. Services/Portfolio/Partners/Press/Gallery: at least
 * one non-archived, `is_included` row exists. Testimonials: at least one
 * non-archived row that is both `is_included` AND `is_approved` (an
 * unapproved testimonial never counts as "ready" — it can't be published).
 */
export type MediaKitSectionReadiness = "not_started" | "ready";

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
