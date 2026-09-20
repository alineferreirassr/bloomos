import type { Metadata } from "next";
import { headers } from "next/headers";
import { getPublishedMediaKitContent, resolvePublicMediaAssetUrls, computeVisitorHash, recordPublicMediaKitViewEvent } from "@/lib/mediaKit/publicMediaKit";
import { PublicMediaKitView } from "@/modules/mediaKit/components/PublicMediaKitView";
import { PublicMediaKitUnavailable } from "@/modules/mediaKit/components/PublicMediaKitUnavailable";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * MEDIAKIT-04 — the public, unauthenticated Amoré Bloom Media Kit. Lives
 * outside every route group (`(app)`/`(auth)`), so it gets only the root
 * layout's fonts/global CSS, never the AppShell/sidebar — and `/m` is
 * absent from `PROTECTED_ROUTE_PREFIXES`
 * (src/lib/middleware/routeProtection.ts), so it's already reachable with
 * zero session and zero middleware changes.
 *
 * The distinct `/m/[slug]` path is deliberate: the authenticated Manager
 * already owns `/media-kit` (MEDIAKIT-02) — this route can never collide
 * with it. `slug` is the Media Kit's own canonical identifier
 * (`media_kits.slug`), matching `get_published_media_kit(p_slug)`'s own
 * parameter exactly.
 */
export default async function PublicMediaKitPage({ params }: PageProps) {
  const { slug } = await params;
  const content = await getPublishedMediaKitContent(slug);

  if (!content) {
    return <PublicMediaKitUnavailable />;
  }

  const heroMediaAssetId = typeof content.appearance.hero_media_asset_id === "string" ? content.appearance.hero_media_asset_id : null;
  const assetIds = [
    ...content.gallery.map((image) => image.media_asset_id),
    ...content.portfolio.flatMap((item) => item.gallery.map((image) => image.media_asset_id)),
    ...content.portfolio.map((item) => item.cover_media_asset_id).filter((id): id is string => id !== null),
    ...content.partners.map((partner) => partner.logo_media_asset_id).filter((id): id is string => id !== null),
    ...content.testimonials.map((testimonial) => testimonial.photo_media_asset_id).filter((id): id is string => id !== null),
    ...content.press.map((feature) => feature.logo_media_asset_id).filter((id): id is string => id !== null),
    ...(heroMediaAssetId ? [heroMediaAssetId] : []),
  ];
  const assetUrls = await resolvePublicMediaAssetUrls(assetIds);

  const brandName = "Amoré Bloom";

  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = requestHeaders.get("user-agent") ?? "unknown";
  const referrer = requestHeaders.get("referer");
  void recordPublicMediaKitViewEvent(slug, computeVisitorHash(ip, userAgent), referrer, `/m/${slug}`);

  return <PublicMediaKitView content={content} assetUrls={assetUrls} brandName={brandName} slug={slug} />;
}

/** MEDIAKIT-04 — basic SEO/share metadata from real persisted content only. No fabricated OG image (no suitable public image field exists this checkpoint) and no metadata at all for an unpublished/unknown slug. */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const content = await getPublishedMediaKitContent(slug);
  if (!content) return { title: "Amoré Bloom" };

  const title = content.brand.headline ? `Amoré Bloom — ${content.brand.headline}` : "Amoré Bloom";
  const description = content.brand.positioning_statement ?? undefined;

  return { title, description };
}
