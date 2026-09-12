import type { InspirationSourceType, InspirationContentFormat } from "@/types/inspirationItem";

/**
 * SOCIAL-06D — plain text/Badge labels, not per-platform icons. lucide-react
 * (this codebase's only icon library) has no first-class TikTok/Pinterest
 * glyph, and mixing icons for some platforms with text for others would
 * look inconsistent — the established codebase convention for an enum like
 * this (`OWNER_TYPE_LABELS`, `MEDIA_ASSET_STATUS_LABELS`) is a
 * `Record<EnumValue, string>` rendered inside a `Badge` anyway, so this
 * matches existing precedent rather than adding a new dependency.
 */
export const INSPIRATION_SOURCE_TYPE_LABELS: Record<InspirationSourceType, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  pinterest: "Pinterest",
  website: "Website",
  manual: "Manual",
  other: "Other",
};

export const INSPIRATION_CONTENT_FORMAT_LABELS: Record<InspirationContentFormat, string> = {
  reel: "Reel",
  carousel: "Carousel",
  story: "Story",
  static: "Static",
  video: "Video",
  other: "Other",
};
