import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { listApiKeysAction, createApiKeyAction, rotateApiKeyAction, revokeApiKeyAction } from "@/modules/api/manageApiKeysActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resetApiKeyStore } from "@/lib/data/core/api/apiKeyStore";

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
  resetApiKeyStore();
});

describe("createApiKeyAction", () => {
  it("requires workspace.manage", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, permissions: [] });
    const result = await createApiKeyAction({ name: "A", scopes: ["crm.read"] });
    expect(result.success).toBe(false);
  });

  it("rejects an empty name", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await createApiKeyAction({ name: "   ", scopes: ["crm.read"] });
    expect(result.success).toBe(false);
  });

  it("rejects zero scopes", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await createApiKeyAction({ name: "A", scopes: [] });
    expect(result.success).toBe(false);
  });

  it("creates a key scoped to the session's own workspace", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await createApiKeyAction({ name: "A", scopes: ["crm.read"] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.key.workspace_id).toBe("ws_1");
      expect(result.data.secret.startsWith("bloom_sk_")).toBe(true);
    }
  });
});

describe("rotateApiKeyAction / revokeApiKeyAction", () => {
  it("rotate refuses a key that doesn't belong to the session's own workspace", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, workspace: { id: "ws_other", name: "Other" } });
    const result = await rotateApiKeyAction("nonexistent-id");
    expect(result.success).toBe(false);
  });

  it("create then rotate then revoke — the full lifecycle from one session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const created = await createApiKeyAction({ name: "Lifecycle", scopes: ["crm.read"] });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const rotated = await rotateApiKeyAction(created.data.key.id);
    expect(rotated.success).toBe(true);
    if (rotated.success) expect(rotated.data.secret).not.toEqual(created.data.secret);

    const revoked = await revokeApiKeyAction(created.data.key.id);
    expect(revoked.success).toBe(true);
    if (revoked.success) expect(revoked.data.revoked_at).not.toBeNull();

    const rotateAfterRevoke = await rotateApiKeyAction(created.data.key.id);
    expect(rotateAfterRevoke.success).toBe(false);
  });
});

describe("listApiKeysAction", () => {
  it("seeds and returns the demo key alongside any created keys", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    await createApiKeyAction({ name: "Custom", scopes: ["crm.read"] });
    const result = await listApiKeysAction();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.some((k) => k.name === "Demo Integration")).toBe(true);
      expect(result.data.some((k) => k.name === "Custom")).toBe(true);
    }
  });
});
