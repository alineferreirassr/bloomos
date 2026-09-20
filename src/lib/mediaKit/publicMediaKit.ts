import "server-only";
import { cache } from "react";
import { createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createMediaKitServiceRoleClient } from "@/lib/mediaKit/mediaKitServiceRole";
import type { PublicMediaKitContent } from "@/types/mediaKit";

/**
 * MEDIAKIT-04 — the one anonymous read path into Media Kit content,
 * `get_published_media_kit(p_slug)` (SECURITY DEFINER, granted to `anon`).
 * Returns `null` for an unknown slug, an unpublished/draft-only Media Kit,
 * or an archived one — the RPC itself enforces `status = 'published'`
 * server-side, so this function can never return draft data no matter what
 * the caller passes. The ordinary anon-key server client is sufficient
 * here (no service-role client needed) since the function is explicitly
 * granted to the `anon` role.
 *
 * `cache()`-wrapped so `page.tsx`'s own render and its sibling
 * `generateMetadata()` (which both need the same slug's content) share one
 * request instead of issuing the RPC twice per page load.
 */
export const getPublishedMediaKitContent = cache(async (slug: string): Promise<PublicMediaKitContent | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_published_media_kit", { p_slug: slug });
  if (error) return null;
  if (!data) return null;
  return data as unknown as PublicMediaKitContent;
});

/**
 * Resolves fresh signed URLs for a batch of `media_asset_id`s that already
 * came from a real published snapshot (never an arbitrary caller-supplied
 * id — see `mediaKitServiceRole.ts`). The `media-assets` bucket is
 * `authenticated`-only, so an anonymous visitor's browser could never do
 * this itself; only the service-role client can bypass that RLS.
 *
 * Fails soft, by design (section 12/26 of the MEDIAKIT-04 directive): if
 * the service-role client isn't configured in this environment, or any
 * individual asset can't be resolved, that asset is simply left out of the
 * returned map — the public page renders an elegant image-empty layout
 * rather than crashing or exposing an error.
 */
export async function resolvePublicMediaAssetUrls(mediaAssetIds: string[]): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  const uniqueIds = Array.from(new Set(mediaAssetIds));
  if (uniqueIds.length === 0) return resolved;

  const client = createMediaKitServiceRoleClient();
  if (!client) return resolved;

  const { data: rows, error } = await client.from("media_assets").select("id, storage_bucket, storage_path").in("id", uniqueIds);
  if (error || !rows) return resolved;

  await Promise.all(
    rows.map(async (row) => {
      const { data: signed, error: signError } = await client.storage.from(row.storage_bucket).createSignedUrl(row.storage_path, 3600);
      if (signError || !signed) return;
      resolved.set(row.id, signed.signedUrl);
    }),
  );

  return resolved;
}

/**
 * MEDIAKIT-01B.1's approved design: a stable, non-rotating per-visitor hash
 * (never a raw IP), computed server-side and never persisted anywhere but
 * the `media_kit_view_events` row itself. `record_public_media_kit_event`
 * already throttles/validates everything else (event_type allow-list, 20
 * events/60s per hash) — this only has to produce a consistent hash for the
 * same visitor across requests, not cryptographic security.
 */
export function computeVisitorHash(ip: string, userAgent: string): string {
  return createHash("sha256").update(`${ip}:${userAgent}`).digest("hex");
}

/**
 * MEDIAKIT-05 — the general form behind `recordPublicMediaKitViewEvent`:
 * any anon-safe event type through the SAME existing writer/hash mechanism
 * (`record_public_media_kit_event`, frozen since MEDIAKIT-01C) — never a
 * second event-recording path. `metadata` only ever reaches the RPC for
 * `cta_clicked`, and the RPC itself re-applies its own fixed allow-list
 * server-side regardless of what's passed here. Fails silently — a
 * tracking failure must never break the page render or block an
 * interaction.
 */
export async function recordPublicMediaKitEvent(
  slug: string,
  eventType: "viewed" | "cta_clicked" | "contact_started",
  visitorHash: string,
  referrer: string | null,
  path: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("record_public_media_kit_event", {
      p_slug: slug,
      p_event_type: eventType,
      p_visitor_hash: visitorHash,
      p_referrer: referrer,
      p_path: path,
      p_metadata: metadata as never,
    });
  } catch {
    // Analytics is best-effort — never surface a tracking failure to the visitor.
  }
}

/** Records one `viewed` event. Thin wrapper over `recordPublicMediaKitEvent` — kept for the exact call shape `page.tsx` already uses. */
export async function recordPublicMediaKitViewEvent(slug: string, visitorHash: string, referrer: string | null, path: string): Promise<void> {
  return recordPublicMediaKitEvent(slug, "viewed", visitorHash, referrer, path);
}
