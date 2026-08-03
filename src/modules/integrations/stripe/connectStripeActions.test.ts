import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

const fakeStripeClient = {
  balance: { retrieve: vi.fn().mockResolvedValue({ available: [] }) },
};

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(function StripeMock() {
    return fakeStripeClient;
  }),
}));

import { connectStripeAction, disconnectStripeAction, getStripeConnectionAction, reconnectStripeAction, testStripeConnectionAction } from "@/modules/integrations/stripe/connectStripeActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resetConnectionStore } from "@/lib/data/core/integrations/connectionStore";
import { resetCredentialStore } from "@/lib/data/core/integrations/credentialStore";
import { resetEncryptionProvider } from "@/core/integrations/credentialManager";

const activeSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["workspace.manage"],
  workspaceDisplayName: "Amoré Bloom",
};

afterEach(() => {
  vi.clearAllMocks();
  fakeStripeClient.balance.retrieve = vi.fn().mockResolvedValue({ available: [] });
  resetConnectionStore();
  resetCredentialStore();
  resetEncryptionProvider();
});

describe("connectStripeAction", () => {
  it("requires workspace.manage", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, permissions: [] });
    const result = await connectStripeAction("sk_test_abc", "sandbox");
    expect(result.success).toBe(false);
  });

  it("rejects a key that doesn't look like a real Stripe secret", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await connectStripeAction("not-a-real-key", "sandbox");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/doesn't look like a real Stripe secret key/);
  });

  it("rejects a live key when Sandbox mode is selected", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await connectStripeAction("sk_live_abc123", "sandbox");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/live\/production key/);
  });

  it("never persists a key that fails the real Stripe test", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    fakeStripeClient.balance.retrieve = vi.fn().mockRejectedValue(new Error("Invalid API Key provided"));
    const result = await connectStripeAction("sk_test_bad", "sandbox");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/Stripe rejected this key/);

    const summary = await getStripeConnectionAction();
    if (summary.success) expect(summary.data.connection).toBeNull();
  });

  it("walks disconnected -> connecting -> connected on a real successful test, storing the mode and a real credential", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await connectStripeAction("sk_test_good", "sandbox");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.state).toBe("connected");
      expect(result.data.config.mode).toBe("sandbox");
      expect(result.data.credential_id).not.toBeNull();
    }
  });
});

describe("testStripeConnectionAction", () => {
  it("re-tests an already-connected connection without asking for the secret again", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const connectResult = await connectStripeAction("sk_test_good", "sandbox");
    if (!connectResult.success) throw new Error("setup failed");

    const testResult = await testStripeConnectionAction(connectResult.data.id);
    expect(testResult.success).toBe(true);
    if (testResult.success) expect(testResult.data.ok).toBe(true);
  });
});

describe("disconnectStripeAction / reconnectStripeAction", () => {
  it("disables then reconnects a connection, re-verifying with a real call", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const connectResult = await connectStripeAction("sk_test_good", "sandbox");
    if (!connectResult.success) throw new Error("setup failed");

    const disconnected = await disconnectStripeAction(connectResult.data.id);
    expect(disconnected.success).toBe(true);
    if (disconnected.success) expect(disconnected.data.state).toBe("disabled");

    const reconnected = await reconnectStripeAction(connectResult.data.id);
    expect(reconnected.success).toBe(true);
    if (reconnected.success) expect(reconnected.data.state).toBe("connected");
  });

  it("reconnect fails cleanly when the stored key no longer works", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const connectResult = await connectStripeAction("sk_test_good", "sandbox");
    if (!connectResult.success) throw new Error("setup failed");
    await disconnectStripeAction(connectResult.data.id);

    fakeStripeClient.balance.retrieve = vi.fn().mockRejectedValue(new Error("Key revoked"));
    const reconnected = await reconnectStripeAction(connectResult.data.id);
    expect(reconnected.success).toBe(false);
  });
});
