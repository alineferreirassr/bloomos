"use server";

import { headers } from "next/headers";
import { createMediaKitServiceRoleClient } from "@/lib/mediaKit/mediaKitServiceRole";
import { computeVisitorHash } from "@/lib/mediaKit/publicMediaKit";
import type { DataResult } from "@/lib/data/result";
import { ok, fail } from "@/lib/data/result";
import type { MediaKitInquiryInput } from "@/types/mediaKit";

const GENERIC_ERROR = "We couldn't send your inquiry right now. Please try again in a moment.";
const MAX_NAME_LENGTH = 160;
const MAX_INTEREST_LENGTH = 160;
const MAX_MESSAGE_LENGTH = 2000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const THROTTLE_WINDOW_SECONDS = 60;

function splitName(name: string): { firstName: string | null; lastName: string | null } {
  const trimmed = name.trim().replace(/\s+/g, " ");
  const spaceIndex = trimmed.indexOf(" ");
  if (spaceIndex === -1) return { firstName: trimmed || null, lastName: null };
  return { firstName: trimmed.slice(0, spaceIndex), lastName: trimmed.slice(spaceIndex + 1) };
}

function validate(input: MediaKitInquiryInput): string | null {
  if (!input.name.trim()) return "Name is required.";
  if (input.name.length > MAX_NAME_LENGTH) return `Name must be ${MAX_NAME_LENGTH} characters or fewer.`;
  if (!input.email.trim() || !EMAIL_PATTERN.test(input.email.trim())) return "A valid email address is required.";
  if (input.interest && input.interest.length > MAX_INTEREST_LENGTH) return `Interest must be ${MAX_INTEREST_LENGTH} characters or fewer.`;
  if (!input.message.trim()) return "Message is required.";
  if (input.message.length > MAX_MESSAGE_LENGTH) return `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`;
  return null;
}

/**
 * MEDIAKIT-05 — the public "Work With Us" inquiry flow. Uses the EXISTING
 * BloomOS CRM (`leads` table) — never a second Leads table, never a
 * parallel CRM. A genuinely anonymous visitor has no workspace session, so
 * the ordinary `createLead()` repository path (browser-session-scoped,
 * same class of issue already fixed twice for Services/Media Assets) can't
 * be used here — this goes through the narrow Media Kit service-role
 * boundary instead, exactly like `resolvePublicMediaAssetUrls`/
 * `record_media_kit_inquiry_event` already do.
 *
 * The anonymous caller NEVER supplies `lead_id`, `workspace_id`, or any
 * other identifier — both are re-resolved server-side, here, from the
 * published Media Kit's own `slug`, mirroring exactly how
 * `record_media_kit_inquiry_event()` itself re-resolves the Media Kit
 * rather than trusting a passed id.
 */
export async function submitMediaKitInquiryAction(slug: string, input: MediaKitInquiryInput): Promise<DataResult<{ submitted: true }>> {
  // Honeypot — a real visitor never fills this hidden field in. Bots that
  // do get a harmless, generic success so nothing tips them off; nothing
  // is created.
  if (input.companyWebsite.trim().length > 0) {
    return ok({ submitted: true });
  }

  const validationError = validate(input);
  if (validationError) return fail(validationError);

  const client = createMediaKitServiceRoleClient();
  if (!client) return fail(GENERIC_ERROR);

  const { data: mediaKit, error: mediaKitError } = await client
    .from("media_kits")
    .select("id, workspace_id")
    .eq("slug", slug)
    .eq("status", "published")
    .is("archived_at", null)
    .maybeSingle();
  if (mediaKitError || !mediaKit) return fail(GENERIC_ERROR);

  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = requestHeaders.get("user-agent") ?? "unknown";
  const referrer = requestHeaders.get("referer");
  const path = `/m/${slug}`;
  const visitorHash = computeVisitorHash(ip, userAgent);

  // Basic double-submit/spam guard — the same throttle window the anon
  // view-event writer already uses, applied here against this visitor's
  // own recent inquiries specifically, so a retried/duplicated network
  // request can't silently create two Leads.
  const { count: recentInquiries, error: throttleError } = await client
    .from("media_kit_view_events")
    .select("id", { count: "exact", head: true })
    .eq("media_kit_id", mediaKit.id)
    .eq("event_type", "inquiry_submitted")
    .eq("visitor_hash", visitorHash)
    .gt("occurred_at", new Date(Date.now() - THROTTLE_WINDOW_SECONDS * 1000).toISOString());
  if (throttleError) return fail(GENERIC_ERROR);
  if ((recentInquiries ?? 0) > 0) return ok({ submitted: true });

  const { firstName, lastName } = splitName(input.name);

  const { data: lead, error: leadError } = await client
    .from("leads")
    .insert({
      workspace_id: mediaKit.workspace_id,
      source: "Media Kit",
      first_name: firstName,
      last_name: lastName,
      email: input.email.trim(),
      event_type: input.interest?.trim() || null,
      message: input.message.trim(),
      status: "new",
    })
    .select("id")
    .single();
  if (leadError || !lead) return fail(GENERIC_ERROR);

  const { error: eventError } = await client.rpc("record_media_kit_inquiry_event", {
    p_slug: slug,
    p_lead_id: lead.id,
    p_visitor_hash: visitorHash,
    p_referrer: referrer,
    p_path: path,
  });
  // The Lead is already real and created — a failure recording the
  // analytics/attribution event is never surfaced as a failed inquiry to
  // the visitor, since the thing they actually asked for (their inquiry
  // reaching the studio) already succeeded.
  void eventError;

  return ok({ submitted: true });
}
