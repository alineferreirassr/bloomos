import { NextResponse, type NextRequest } from "next/server";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getPendingAuthorizationForCaller } from "@/core/integrations/oauthEngine";
import { completeProviderOAuthConnectionAction } from "@/modules/integrations/manageOAuthConnectionActions";
import { getLogger } from "@/core/observability/logger";

export const dynamic = "force-dynamic";

const INTEGRATIONS_RETURN_PATH = "/developer";

/**
 * GC02-02 — every provider's OAuth completion returns to
 * `INTEGRATIONS_RETURN_PATH` (`/developer`'s Integrations Config Tab) by
 * default, unchanged. `google-calendar-readonly` is the one exception:
 * its own management surface lives at `/settings/integrations/google-
 * calendar`, not `/developer` (member-owned personal connections don't
 * belong in the workspace-admin console the way Gmail/Stripe's do — see
 * GC02-01's own audit). This is a fixed, internal, allowlisted mapping —
 * never influenced by any request/query input — so it can't become an
 * open redirect.
 *
 * SOCIAL-02 — `meta` is a second exception, for the same reason: its own
 * account/Page/Instagram-selection surface lives at
 * `/settings/integrations/meta`, not the workspace-admin `/developer`
 * console.
 */
function getIntegrationReturnPath(providerId: string): string {
  if (providerId === "google-calendar-readonly") return "/settings/integrations/google-calendar";
  if (providerId === "meta") return "/settings/integrations/meta";
  return INTEGRATIONS_RETURN_PATH;
}

/**
 * GMAIL-03R2 — the one generic OAuth provider callback route every
 * OAuth-capable provider (gmail today; google-calendar/google-drive/
 * docusign/dropbox whenever their own product flow needs one) redirects
 * back to, mirroring the docusign/stripe/twilio webhook routes' own
 * shape: a thin, provider-agnostic Route Handler that does no business
 * logic of its own, only orchestrates the existing, already-tested
 * engine/action layer. Deliberately NOT `src/app/auth/callback/route.ts`
 * — that route is Supabase's own password-reset/session-recovery
 * callback, an unrelated concern.
 *
 * The provider itself is never named in the query string — it's derived
 * from the durable pending-authorization row the `state` value keys,
 * the same "state IS the authorization" CSRF discipline `oauthEngine.ts`
 * already established. This also means the caller's own workspace/member
 * identity is checked against that row (via `getPendingAuthorizationForCaller`)
 * before anything else happens — a signed-in member who didn't start this
 * exact flow gets the same safe "expired or already used" outcome as an
 * unknown state, never a hint about whose flow it actually is.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const providerError = searchParams.get("error");

  const returnUrl = (status: string, detail?: string, returnPath: string = INTEGRATIONS_RETURN_PATH): NextResponse => {
    const url = new URL(returnPath, origin);
    url.searchParams.set("integration_status", status);
    if (detail) url.searchParams.set("integration_detail", detail);
    return NextResponse.redirect(url);
  };

  if (providerError) {
    getLogger().warn("OAuth provider returned an error on callback", { providerError });
    return returnUrl("error", "provider_error");
  }
  if (!state || !code) return returnUrl("error", "missing_params");

  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return returnUrl("error", "unauthenticated");

  const pending = await getPendingAuthorizationForCaller(state, { workspaceId: session.workspace.id, memberId: session.user.id });
  if (!pending) return returnUrl("error", "invalid_or_expired_state");

  // Must exactly match the redirect_uri beginAuthorization built the
  // authorization URL with — this route's own absolute URL, no query string.
  const redirectUri = new URL(request.url);
  redirectUri.search = "";

  const result = await completeProviderOAuthConnectionAction(pending.provider_id, code, state, redirectUri.toString());
  const returnPath = getIntegrationReturnPath(pending.provider_id);
  if (!result.success) return returnUrl("error", "completion_failed", returnPath);
  if ("pendingConfiguration" in result.data) return returnUrl("pending_configuration", undefined, returnPath);

  return returnUrl("connected", pending.provider_id, returnPath);
}
