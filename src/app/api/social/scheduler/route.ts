import { NextResponse } from "next/server";
import { runScheduledSocialPostBatch } from "@/core/social/scheduledPostExecutor";
import { getLogger } from "@/core/observability/logger";

export const dynamic = "force-dynamic";

/**
 * SOCIAL-04B — the narrow internal route Vercel Cron invokes (a plain GET
 * request, Vercel's own documented convention). Never accepts caller-supplied
 * post ids or any other input — the only thing an invocation can do is
 * trigger `runScheduledSocialPostBatch()`'s own claim of whatever is
 * actually due, so a replayed or forged request is harmless at worst (it
 * finds nothing new to claim), never a way to act on an arbitrary post.
 *
 * CRON_SECRET is the sole trust boundary. Both "not configured" and "wrong
 * secret" return the identical generic 401 — never distinguishing them in
 * the response, so a prober learns nothing about this deployment's
 * configuration state either way (fail closed, never an unauthenticated
 * fallback).
 */

const CRON_SECRET_ENV_VAR = "CRON_SECRET";

function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env[CRON_SECRET_ENV_VAR]?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!isAuthorizedCronRequest(request)) {
    getLogger().error("Social scheduler route: rejected an unauthorized invocation");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runScheduledSocialPostBatch();
  if (!result.success) {
    // `result.reason` is one of a fixed, safe enum ("service_role_unavailable" |
    // "claim_failed" | "reclaim_failed") — never a raw provider error or
    // exception message.
    return NextResponse.json({ success: false, reason: result.reason }, { status: 500 });
  }

  return NextResponse.json({ success: true, summary: result.summary });
}
