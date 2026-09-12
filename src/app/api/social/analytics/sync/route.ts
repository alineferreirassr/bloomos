import { NextResponse } from "next/server";
import { runSocialAnalyticsSyncBatch } from "@/core/social/socialAnalyticsSyncExecutor";
import { getLogger } from "@/core/observability/logger";

export const dynamic = "force-dynamic";

/**
 * SOCIAL-05D — the narrow internal route a future cron (or manual trigger)
 * invokes to run the analytics sync. Mirrors
 * `app/api/social/scheduler/route.ts`'s own exact CRON_SECRET-Bearer
 * pattern — a deliberately separate route, never reusing the publishing
 * scheduler's, since analytics sync and post publishing are two
 * independent concerns with independent failure domains (a broken
 * analytics sync must never affect publishing, and vice versa).
 *
 * Never accepts caller-supplied workspace/post/account ids — the only
 * thing an invocation can do is trigger `runSocialAnalyticsSyncBatch()`'s
 * own scan of whatever is actually eligible, so a replayed or forged
 * request is harmless at worst (it just re-syncs the same day's data,
 * upserting the same rows via SOCIAL-05C's own idempotency keys), never a
 * way to act on an arbitrary workspace.
 *
 * CRON_SECRET is the sole trust boundary. Both "not configured" and
 * "wrong secret" return the identical generic 401 — never distinguishing
 * them in the response, matching the scheduler route's own fail-closed,
 * no-unauthenticated-fallback discipline exactly.
 */

const CRON_SECRET_ENV_VAR = "CRON_SECRET";

function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env[CRON_SECRET_ENV_VAR]?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!isAuthorizedCronRequest(request)) {
    getLogger().error("Social analytics sync route: rejected an unauthorized invocation");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runSocialAnalyticsSyncBatch();
  if (!result.success) {
    // `result.reason` is one of a fixed, safe enum — never a raw provider
    // error or exception message.
    return NextResponse.json({ success: false, reason: result.reason }, { status: 500 });
  }

  return NextResponse.json({ success: true, summary: result.summary });
}
