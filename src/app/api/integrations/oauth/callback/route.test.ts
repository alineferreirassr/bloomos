import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({ resolveMemberSessionSnapshot: vi.fn() }));
vi.mock("@/core/integrations/oauthEngine", () => ({ getPendingAuthorizationForCaller: vi.fn() }));
vi.mock("@/modules/integrations/manageOAuthConnectionActions", () => ({ completeProviderOAuthConnectionAction: vi.fn() }));

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getPendingAuthorizationForCaller } from "@/core/integrations/oauthEngine";
import { completeProviderOAuthConnectionAction } from "@/modules/integrations/manageOAuthConnectionActions";
import { GET } from "@/app/api/integrations/oauth/callback/route";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

const ACTIVE_SESSION: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["integrations.connect"],
  workspaceDisplayName: "Amoré Bloom",
};

function request(query: string): Request {
  return new Request(`https://app.test/api/integrations/oauth/callback${query}`);
}

function statusOf(response: Response): { status: string | null; detail: string | null } {
  const url = new URL(response.headers.get("location")!);
  return { status: url.searchParams.get("integration_status"), detail: url.searchParams.get("integration_detail") };
}

function pathOf(response: Response): string {
  return new URL(response.headers.get("location")!).pathname;
}

function pendingFor(providerId: string) {
  return {
    state: "xyz",
    provider_id: providerId,
    connection_id: "conn_1",
    workspace_id: "ws_1",
    member_id: "user_1",
    redirect_uri: "https://app.test/api/integrations/oauth/callback",
    created_at: "2026-01-01T00:00:00Z",
    expires_at: "2026-01-01T00:10:00Z",
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/integrations/oauth/callback", () => {
  it("redirects with a provider_error status when the provider itself reports an error", async () => {
    const response = await GET(request("?error=access_denied") as never);
    expect(statusOf(response)).toEqual({ status: "error", detail: "provider_error" });
  });

  it("redirects with missing_params when code or state is absent", async () => {
    const response = await GET(request("?code=abc") as never);
    expect(statusOf(response)).toEqual({ status: "error", detail: "missing_params" });
  });

  it("redirects with unauthenticated when there is no active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const response = await GET(request("?code=abc&state=xyz") as never);
    expect(statusOf(response)).toEqual({ status: "error", detail: "unauthenticated" });
  });

  it("scopes the pending-authorization lookup to the caller's own workspace and member id", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ACTIVE_SESSION);
    vi.mocked(getPendingAuthorizationForCaller).mockResolvedValue(null);

    await GET(request("?code=abc&state=xyz") as never);

    expect(getPendingAuthorizationForCaller).toHaveBeenCalledWith("xyz", { workspaceId: "ws_1", memberId: "user_1" });
  });

  it("redirects with invalid_or_expired_state for an unknown, expired, or not-owned-by-caller state — the same outcome whichever it is", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ACTIVE_SESSION);
    vi.mocked(getPendingAuthorizationForCaller).mockResolvedValue(null);

    const response = await GET(request("?code=abc&state=xyz") as never);

    expect(statusOf(response)).toEqual({ status: "error", detail: "invalid_or_expired_state" });
    expect(completeProviderOAuthConnectionAction).not.toHaveBeenCalled();
  });

  it("completes the flow using the pending authorization's own provider_id and this route's own URL as redirectUri", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ACTIVE_SESSION);
    vi.mocked(getPendingAuthorizationForCaller).mockResolvedValue({
      state: "xyz",
      provider_id: "gmail",
      connection_id: "conn_1",
      workspace_id: "ws_1",
      member_id: "user_1",
      redirect_uri: "https://app.test/api/integrations/oauth/callback",
      created_at: "2026-01-01T00:00:00Z",
      expires_at: "2026-01-01T00:10:00Z",
    });
    vi.mocked(completeProviderOAuthConnectionAction).mockResolvedValue({ success: true, data: { id: "conn_1" } as never });

    const response = await GET(request("?code=abc&state=xyz") as never);

    expect(completeProviderOAuthConnectionAction).toHaveBeenCalledWith("gmail", "abc", "xyz", "https://app.test/api/integrations/oauth/callback");
    expect(statusOf(response)).toEqual({ status: "connected", detail: "gmail" });
  });

  it("redirects with pending_configuration when the environment has no OAuth client configured for the provider", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ACTIVE_SESSION);
    vi.mocked(getPendingAuthorizationForCaller).mockResolvedValue({
      state: "xyz",
      provider_id: "gmail",
      connection_id: "conn_1",
      workspace_id: "ws_1",
      member_id: "user_1",
      redirect_uri: "https://app.test/api/integrations/oauth/callback",
      created_at: "2026-01-01T00:00:00Z",
      expires_at: "2026-01-01T00:10:00Z",
    });
    vi.mocked(completeProviderOAuthConnectionAction).mockResolvedValue({ success: true, data: { pendingConfiguration: true, reason: "no client" } });

    const response = await GET(request("?code=abc&state=xyz") as never);

    expect(statusOf(response)).toEqual({ status: "pending_configuration", detail: null });
  });

  it("redirects with completion_failed when the completion action itself reports failure", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ACTIVE_SESSION);
    vi.mocked(getPendingAuthorizationForCaller).mockResolvedValue({
      state: "xyz",
      provider_id: "gmail",
      connection_id: "conn_1",
      workspace_id: "ws_1",
      member_id: "user_1",
      redirect_uri: "https://app.test/api/integrations/oauth/callback",
      created_at: "2026-01-01T00:00:00Z",
      expires_at: "2026-01-01T00:10:00Z",
    });
    vi.mocked(completeProviderOAuthConnectionAction).mockResolvedValue({ success: false, error: "Gmail rejected this connection." });

    const response = await GET(request("?code=abc&state=xyz") as never);

    expect(statusOf(response)).toEqual({ status: "error", detail: "completion_failed" });
  });

  it("never includes the authorization code, or any token, in the redirect response", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ACTIVE_SESSION);
    vi.mocked(getPendingAuthorizationForCaller).mockResolvedValue({
      state: "xyz",
      provider_id: "gmail",
      connection_id: "conn_1",
      workspace_id: "ws_1",
      member_id: "user_1",
      redirect_uri: "https://app.test/api/integrations/oauth/callback",
      created_at: "2026-01-01T00:00:00Z",
      expires_at: "2026-01-01T00:10:00Z",
    });
    vi.mocked(completeProviderOAuthConnectionAction).mockResolvedValue({ success: true, data: { id: "conn_1" } as never });

    const response = await GET(request("?code=secret-auth-code&state=xyz") as never);

    expect(response.headers.get("location")).not.toContain("secret-auth-code");
    expect(response.headers.get("location")).not.toContain("token");
  });
});

describe("GET /api/integrations/oauth/callback — provider-aware return path (GC02-02)", () => {
  it("GC02-02R-I:1. google-calendar-readonly success returns to /settings/integrations/google-calendar", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ACTIVE_SESSION);
    vi.mocked(getPendingAuthorizationForCaller).mockResolvedValue(pendingFor("google-calendar-readonly"));
    vi.mocked(completeProviderOAuthConnectionAction).mockResolvedValue({ success: true, data: { id: "conn_1" } as never });

    const response = await GET(request("?code=abc&state=xyz") as never);

    expect(pathOf(response)).toBe("/settings/integrations/google-calendar");
    expect(statusOf(response)).toEqual({ status: "connected", detail: "google-calendar-readonly" });
  });

  it("GC02-02R-I:2. google-calendar-readonly failure (completion_failed) returns to the same safe settings route", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ACTIVE_SESSION);
    vi.mocked(getPendingAuthorizationForCaller).mockResolvedValue(pendingFor("google-calendar-readonly"));
    vi.mocked(completeProviderOAuthConnectionAction).mockResolvedValue({ success: false, error: "Google Calendar rejected this connection." });

    const response = await GET(request("?code=abc&state=xyz") as never);

    expect(pathOf(response)).toBe("/settings/integrations/google-calendar");
    expect(statusOf(response)).toEqual({ status: "error", detail: "completion_failed" });
  });

  it("google-calendar-readonly pending_configuration also returns to the settings subpage", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ACTIVE_SESSION);
    vi.mocked(getPendingAuthorizationForCaller).mockResolvedValue(pendingFor("google-calendar-readonly"));
    vi.mocked(completeProviderOAuthConnectionAction).mockResolvedValue({ success: true, data: { pendingConfiguration: true, reason: "no client" } });

    const response = await GET(request("?code=abc&state=xyz") as never);

    expect(pathOf(response)).toBe("/settings/integrations/google-calendar");
    expect(statusOf(response)).toEqual({ status: "pending_configuration", detail: null });
  });

  it("GC02-02R-I:3. Gmail retains its existing /developer return route exactly", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ACTIVE_SESSION);
    vi.mocked(getPendingAuthorizationForCaller).mockResolvedValue(pendingFor("gmail"));
    vi.mocked(completeProviderOAuthConnectionAction).mockResolvedValue({ success: true, data: { id: "conn_1" } as never });

    const response = await GET(request("?code=abc&state=xyz") as never);

    expect(pathOf(response)).toBe("/developer");
  });

  it("GC02-02R-I:4. Stripe retains its existing /developer return route exactly", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ACTIVE_SESSION);
    vi.mocked(getPendingAuthorizationForCaller).mockResolvedValue(pendingFor("stripe"));
    vi.mocked(completeProviderOAuthConnectionAction).mockResolvedValue({ success: true, data: { id: "conn_1" } as never });

    const response = await GET(request("?code=abc&state=xyz") as never);

    expect(pathOf(response)).toBe("/developer");
  });

  it("GC02-02R-I:5. the old workspace-owned google-calendar provider retains its existing /developer return route exactly", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ACTIVE_SESSION);
    vi.mocked(getPendingAuthorizationForCaller).mockResolvedValue(pendingFor("google-calendar"));
    vi.mocked(completeProviderOAuthConnectionAction).mockResolvedValue({ success: true, data: { id: "conn_1" } as never });

    const response = await GET(request("?code=abc&state=xyz") as never);

    expect(pathOf(response)).toBe("/developer");
  });

  it("GC02-02R-I:6. an unknown/default provider id retains the existing default /developer behavior", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ACTIVE_SESSION);
    vi.mocked(getPendingAuthorizationForCaller).mockResolvedValue(pendingFor("docusign"));
    vi.mocked(completeProviderOAuthConnectionAction).mockResolvedValue({ success: true, data: { id: "conn_1" } as never });

    const response = await GET(request("?code=abc&state=xyz") as never);

    expect(pathOf(response)).toBe("/developer");
  });

  it("GC02-02R-I:7 & GC02-02R-H. no caller-supplied query parameter can override the allowlisted return path", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ACTIVE_SESSION);
    vi.mocked(getPendingAuthorizationForCaller).mockResolvedValue(pendingFor("gmail"));
    vi.mocked(completeProviderOAuthConnectionAction).mockResolvedValue({ success: true, data: { id: "conn_1" } as never });

    const response = await GET(request("?code=abc&state=xyz&returnTo=https://evil.example.com&next=/settings/integrations/google-calendar") as never);

    expect(pathOf(response)).toBe("/developer");
    expect(response.headers.get("location")).not.toContain("evil.example.com");
  });

  it("early failures (before the pending authorization resolves the provider) use the existing default path even for what would become a google-calendar-readonly flow — the provider identity genuinely isn't known yet", async () => {
    const response = await GET(request("?error=access_denied") as never);
    expect(pathOf(response)).toBe("/developer");
  });
});
