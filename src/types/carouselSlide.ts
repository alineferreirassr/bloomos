/**
 * SOCIAL-10C — one ordered, plain-text content slide within a `Carousel`.
 * Scoped to `carousel_id` directly (no version layer — SOCIAL-10B decided
 * Carousel needs no versioning), mirroring `ScriptBlock`'s own
 * minimalism: no title/body split, no slide "type". At most one optional
 * `media_asset_id` per slide (SOCIAL-10B Section F) — never multiple,
 * never the polymorphic owner_type/owner_id MediaAsset pattern.
 */

export interface CarouselSlide {
  id: string;
  carousel_id: string;
  workspace_id: string;
  content: string;
  sort_order: number;
  media_asset_id: string | null;
  created_at: string;
  updated_at: string;
}
