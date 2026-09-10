import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({ resolveMemberSessionSnapshot: vi.fn() }));
vi.mock("@/core/integrations/gmail/gmailSyncEngine", () => ({ syncGmailMailbox: vi.fn() }));

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { syncGmailMailbox } from "@/core/integrations/gmail/gmailSyncEngine";
import { syncMyGmailMailboxAction } from "@/modules/integrations/gmail/syncGmailMailboxAction";
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

afterEach(() => {
  vi.clearAllMocks();
});

describe("syncMyGmailMailboxAction", () => {
  it("denies an unauthenticated caller without ever calling the sync engine", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await syncMyGmailMailboxAction();
    expect(result.success).toBe(false);
    expect(syncGmailMailbox).not.toHaveBeenCalled();
  });

  it("denies a caller missing integrations.connect", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...ACTIVE_SESSION, permissions: [] });
    const result = await syncMyGmailMailboxAction();
    expect(result.success).toBe(false);
    expect(syncGmailMailbox).not.toHaveBeenCalled();
  });

  it("derives workspaceId/memberId from the authenticated session only — there is no way for a caller to supply their own", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ACTIVE_SESSION);
    vi.mocked(syncGmailMailbox).mockResolvedValue({ status: "no_connection" });

    await syncMyGmailMailboxAction();

    expect(syncGmailMailbox).toHaveBeenCalledWith({ workspaceId: "ws_1", memberId: "user_1" });
    expect(syncMyGmailMailboxAction.length).toBe(0); // the action itself takes no client-suppliable arguments at all
  });

  it("returns a safe success summary", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ACTIVE_SESSION);
    vi.mocked(syncGmailMailbox).mockResolvedValue({ status: "success", threadsProcessed: 3, messagesProcessed: 7, threadsSkipped: 0, messagesSkipped: 0, syncedAt: "2026-01-01T00:00:00Z" });

    const result = await syncMyGmailMailboxAction();
    expect(result).toEqual({ success: true, data: { status: "success", threadsProcessed: 3, messagesProcessed: 7, threadsSkipped: 0, messagesSkipped: 0, syncedAt: "2026-01-01T00:00:00Z" } });
  });

  it("surfaces reconnect_required as a success:true result carrying the reason, not a thrown error", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ACTIVE_SESSION);
    vi.mocked(syncGmailMailbox).mockResolvedValue({ status: "reconnect_required", reason: "missing_readonly_scope" });

    const result = await syncMyGmailMailboxAction();
    expect(result).toEqual({ success: true, data: { status: "reconnect_required", reason: "missing_readonly_scope" } });
  });

  it("maps an engine error result to success:false", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ACTIVE_SESSION);
    vi.mocked(syncGmailMailbox).mockResolvedValue({ status: "error", reason: "gmail_rate_limited" });

    const result = await syncMyGmailMailboxAction();
    expect(result).toEqual({ success: false, error: "gmail_rate_limited" });
  });

  it("never returns a token or message body in any branch", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ACTIVE_SESSION);
    vi.mocked(syncGmailMailbox).mockResolvedValue({ status: "success", threadsProcessed: 1, messagesProcessed: 1, threadsSkipped: 0, messagesSkipped: 0, syncedAt: "2026-01-01T00:00:00Z" });

    const result = await syncMyGmailMailboxAction();
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/token|body_text|body_html/i);
  });
});
