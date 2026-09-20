"use server";

import { headers } from "next/headers";
import { computeVisitorHash, recordPublicMediaKitEvent } from "@/lib/mediaKit/publicMediaKit";

/** MEDIAKIT-05 — fire-and-forget from the public inquiry form's first real interaction (`PublicMediaKitInquiryForm.tsx`), once per mount. */
export async function recordMediaKitContactStartedAction(slug: string): Promise<void> {
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = requestHeaders.get("user-agent") ?? "unknown";
  const referrer = requestHeaders.get("referer");
  await recordPublicMediaKitEvent(slug, "contact_started", computeVisitorHash(ip, userAgent), referrer, `/m/${slug}`);
}
