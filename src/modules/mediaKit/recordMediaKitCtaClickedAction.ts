"use server";

import { headers } from "next/headers";
import { computeVisitorHash, recordPublicMediaKitEvent } from "@/lib/mediaKit/publicMediaKit";

/**
 * MEDIAKIT-05 — fire-and-forget from the public page's own CTA button
 * (`PublicMediaKitCtaButton.tsx`). Recomputes the same IP+UA visitor hash
 * `page.tsx`'s own "viewed" event already used for this same browser, so a
 * click correlates with its page view. Never blocks navigation — the
 * client calls this without awaiting its result.
 */
export async function recordMediaKitCtaClickedAction(slug: string, ctaId: string): Promise<void> {
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = requestHeaders.get("user-agent") ?? "unknown";
  const referrer = requestHeaders.get("referer");
  await recordPublicMediaKitEvent(slug, "cta_clicked", computeVisitorHash(ip, userAgent), referrer, `/m/${slug}`, { cta_id: ctaId });
}
