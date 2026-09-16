import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

import { supabaseNotificationsRepository } from "@/lib/data/core/notifications/supabaseRepository";
import { createClient } from "@/lib/supabase/client";

type QueryResult = { data: unknown; error: unknown };
type RecordedCall = { table: string; method: string; args: unknown[] };

function createMockSupabase(responses: QueryResult[]) {
  const calls: RecordedCall[] = [];
  let i = 0;
  function nextResult(): QueryResult {
    if (i >= responses.length) throw new Error(`No mock Supabase response queued for call #${i + 1}`);
    return responses[i++];
  }
  function builder(table: string) {
    const b: Record<string, unknown> = {};
    const chain =
      (method: string) =>
      (...args: unknown[]) => {
        calls.push({ table, method, args });
        return b;
      };
    b.select = chain("select");
    b.insert = chain("insert");
    b.update = chain("update");
    b.eq = chain("eq");
    b.is = chain("is");
    b.not = chain("not");
    b.order = chain("order");
    b.maybeSingle = async () => {
      calls.push({ table, method: "maybeSingle", args: [] });
      return nextResult();
    };
    b.single = async () => {
      calls.push({ table, method: "single", args: [] });
      return nextResult();
    };
    b.then = (resolve: (value: QueryResult) => void) => {
      calls.push({ table, method: "then", args: [] });
      resolve(nextResult());
    };
    return b;
  }
  const client = { from: (table: string) => builder(table) };
  return { client, calls };
}

function notificationRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "notification_1",
    workspace_id: "ws_1",
    recipient_member_id: "member_1",
    recipient_client_account_id: null,
    channel: "in_app",
    title: "Lead Created",
    body: "A new lead arrived.",
    read_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    related_owner_type: "lead",
    related_owner_id: "lead_1",
    kind: "lead_created",
    priority: "normal",
    pinned_at: null,
    archived_at: null,
    ...overrides,
  };
}

describe("supabaseNotificationsRepository — createInAppNotification", () => {
  it("inserts the expected payload, hardcodes channel to in_app, and maps the returned row", async () => {
    const { client, calls } = createMockSupabase([{ data: notificationRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseNotificationsRepository.createInAppNotification("ws_1", {
      recipientMemberId: "member_1",
      title: "Lead Created",
      body: "A new lead arrived.",
      relatedOwnerType: "lead",
      relatedOwnerId: "lead_1",
      kind: "lead_created",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.workspace_id).toBe("ws_1");
    expect(result.data.kind).toBe("lead_created");
    expect(result.data.channel).toBe("in_app");

    const insertCall = calls.find((c) => c.method === "insert");
    expect(insertCall?.args[0]).toMatchObject({
      workspace_id: "ws_1",
      recipient_member_id: "member_1",
      channel: "in_app",
      title: "Lead Created",
      related_owner_type: "lead",
      related_owner_id: "lead_1",
      kind: "lead_created",
      priority: "normal",
    });
  });

  it("defaults kind to null and priority to normal when omitted — metadata preservation matches mockRepository.ts exactly", async () => {
    const { client, calls } = createMockSupabase([{ data: notificationRow({ kind: null, related_owner_type: null, related_owner_id: null }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabaseNotificationsRepository.createInAppNotification("ws_1", { recipientMemberId: "member_1", title: "Hello", body: "World" });

    const insertCall = calls.find((c) => c.method === "insert");
    expect(insertCall?.args[0]).toMatchObject({ kind: null, priority: "normal", related_owner_type: null, related_owner_id: null });
  });

  it("rejects a blank title without ever calling insert", async () => {
    const { calls } = createMockSupabase([]);
    const result = await supabaseNotificationsRepository.createInAppNotification("ws_1", { recipientMemberId: "member_1", title: "   ", body: "x" });
    expect(result.success).toBe(false);
    expect(calls.find((c) => c.method === "insert")).toBeUndefined();
  });

  it("rejects a notification with no recipient at all without ever calling insert", async () => {
    const { calls } = createMockSupabase([]);
    const result = await supabaseNotificationsRepository.createInAppNotification("ws_1", { title: "Hello", body: "World" });
    expect(result.success).toBe(false);
    expect(calls.find((c) => c.method === "insert")).toBeUndefined();
  });

  it("creates a client-account-recipient notification the same way (Client Portal path)", async () => {
    const { client } = createMockSupabase([{ data: notificationRow({ recipient_member_id: null, recipient_client_account_id: "client_account_1" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseNotificationsRepository.createInAppNotification("ws_1", { recipientClientAccountId: "client_account_1", title: "Welcome to your Client Portal", body: "..." });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.recipient_client_account_id).toBe("client_account_1");
    expect(result.data.recipient_member_id).toBeNull();
  });
});

describe("supabaseNotificationsRepository — list/query", () => {
  it("getNotificationsForMember scopes by workspace AND recipient, ordered newest first", async () => {
    const { client, calls } = createMockSupabase([{ data: [notificationRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const results = await supabaseNotificationsRepository.getNotificationsForMember("ws_1", "member_1");
    expect(results).toHaveLength(1);
    const eqArgs = calls.filter((c) => c.method === "eq").map((c) => c.args);
    expect(eqArgs).toContainEqual(["workspace_id", "ws_1"]);
    expect(eqArgs).toContainEqual(["recipient_member_id", "member_1"]);
    expect(calls.find((c) => c.method === "order")?.args).toEqual(["created_at", { ascending: false }]);
  });

  it("getNotificationsForClientAccount scopes by workspace AND client account", async () => {
    const { client, calls } = createMockSupabase([{ data: [notificationRow({ recipient_member_id: null, recipient_client_account_id: "client_account_1" })], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const results = await supabaseNotificationsRepository.getNotificationsForClientAccount("ws_1", "client_account_1");
    expect(results).toHaveLength(1);
    const eqArgs = calls.filter((c) => c.method === "eq").map((c) => c.args);
    expect(eqArgs).toContainEqual(["recipient_client_account_id", "client_account_1"]);
  });

  it("getMemberNotificationsForWorkspace never includes client-account rows (excludes null recipient_member_id)", async () => {
    const { client, calls } = createMockSupabase([{ data: [notificationRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabaseNotificationsRepository.getMemberNotificationsForWorkspace("ws_1");
    const notArgs = calls.filter((c) => c.method === "not").map((c) => c.args);
    expect(notArgs).toContainEqual(["recipient_member_id", "is", null]);
  });

  it("getClientPortalNotificationsForWorkspace never includes member rows (excludes null recipient_client_account_id)", async () => {
    const { client, calls } = createMockSupabase([{ data: [notificationRow({ recipient_member_id: null, recipient_client_account_id: "client_account_1" })], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabaseNotificationsRepository.getClientPortalNotificationsForWorkspace("ws_1");
    const notArgs = calls.filter((c) => c.method === "not").map((c) => c.args);
    expect(notArgs).toContainEqual(["recipient_client_account_id", "is", null]);
  });
});

describe("supabaseNotificationsRepository — unread/read state", () => {
  it("markNotificationRead sets read_at when currently unread", async () => {
    const { client, calls } = createMockSupabase([
      { data: notificationRow({ read_at: null }), error: null },
      { data: notificationRow({ read_at: "2026-01-02T00:00:00.000Z" }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseNotificationsRepository.markNotificationRead("notification_1");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.read_at).not.toBeNull();
    const updateCall = calls.find((c) => c.method === "update");
    expect(updateCall?.args[0]).toHaveProperty("read_at");
  });

  it("markNotificationRead is a no-op (no update call) when already read", async () => {
    const { client, calls } = createMockSupabase([{ data: notificationRow({ read_at: "2026-01-01T00:00:00.000Z" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseNotificationsRepository.markNotificationRead("notification_1");
    expect(result.success).toBe(true);
    expect(calls.find((c) => c.method === "update")).toBeUndefined();
  });

  it("markNotificationRead fails for an unknown id without ever calling update", async () => {
    const { client, calls } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseNotificationsRepository.markNotificationRead("missing");
    expect(result.success).toBe(false);
    expect(calls.find((c) => c.method === "update")).toBeUndefined();
  });

  it("markNotificationUnread sets read_at back to null", async () => {
    const { client, calls } = createMockSupabase([
      { data: notificationRow({ read_at: "2026-01-01T00:00:00.000Z" }), error: null },
      { data: notificationRow({ read_at: null }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseNotificationsRepository.markNotificationUnread("notification_1");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.read_at).toBeNull();
    const updateCall = calls.find((c) => c.method === "update");
    expect(updateCall?.args[0]).toEqual({ read_at: null });
  });

  it("markAllNotificationsRead scopes by workspace, recipient, and only currently-unread rows", async () => {
    const { client, calls } = createMockSupabase([{ data: [{ id: "notification_1" }, { id: "notification_2" }], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseNotificationsRepository.markAllNotificationsRead("ws_1", "member_1");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toBe(2);
    const eqArgs = calls.filter((c) => c.method === "eq").map((c) => c.args);
    expect(eqArgs).toContainEqual(["workspace_id", "ws_1"]);
    expect(eqArgs).toContainEqual(["recipient_member_id", "member_1"]);
    const isArgs = calls.filter((c) => c.method === "is").map((c) => c.args);
    expect(isArgs).toContainEqual(["read_at", null]);
  });
});

describe("supabaseNotificationsRepository — pin/archive", () => {
  it("pinNotification sets pinned_at when not already pinned", async () => {
    const { client, calls } = createMockSupabase([
      { data: notificationRow({ pinned_at: null }), error: null },
      { data: notificationRow({ pinned_at: "2026-01-02T00:00:00.000Z" }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseNotificationsRepository.pinNotification("notification_1");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.pinned_at).not.toBeNull();
    expect(calls.find((c) => c.method === "update")?.args[0]).toHaveProperty("pinned_at");
  });

  it("unpinNotification clears pinned_at", async () => {
    const { client, calls } = createMockSupabase([
      { data: notificationRow({ pinned_at: "2026-01-01T00:00:00.000Z" }), error: null },
      { data: notificationRow({ pinned_at: null }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabaseNotificationsRepository.unpinNotification("notification_1");
    expect(calls.find((c) => c.method === "update")?.args[0]).toEqual({ pinned_at: null });
  });

  it("archiveNotification sets archived_at", async () => {
    const { client } = createMockSupabase([
      { data: notificationRow({ archived_at: null }), error: null },
      { data: notificationRow({ archived_at: "2026-01-02T00:00:00.000Z" }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseNotificationsRepository.archiveNotification("notification_1");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.archived_at).not.toBeNull();
  });

  it("unarchiveNotification clears archived_at", async () => {
    const { client, calls } = createMockSupabase([
      { data: notificationRow({ archived_at: "2026-01-01T00:00:00.000Z" }), error: null },
      { data: notificationRow({ archived_at: null }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabaseNotificationsRepository.unarchiveNotification("notification_1");
    expect(calls.find((c) => c.method === "update")?.args[0]).toEqual({ archived_at: null });
  });
});

describe("supabaseNotificationsRepository — persistence mapping", () => {
  it("maps every existing NotificationKind value through unchanged", async () => {
    const kinds = ["lead_created", "proposal_sent", "invoice_paid", "escalation", "message_received"];
    for (const kind of kinds) {
      const { client } = createMockSupabase([{ data: [notificationRow({ kind })], error: null }]);
      vi.mocked(createClient).mockReturnValue(client as never);
      const results = await supabaseNotificationsRepository.getNotificationsForMember("ws_1", "member_1");
      expect(results[0].kind).toBe(kind);
    }
  });

  it("maps a null kind through as null, never coerced to a string", async () => {
    const { client } = createMockSupabase([{ data: [notificationRow({ kind: null })], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    const results = await supabaseNotificationsRepository.getNotificationsForMember("ws_1", "member_1");
    expect(results[0].kind).toBeNull();
  });

  it("preserves related_owner_type/related_owner_id verbatim", async () => {
    const { client } = createMockSupabase([{ data: [notificationRow({ related_owner_type: "lead", related_owner_id: "lead_42" })], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    const results = await supabaseNotificationsRepository.getNotificationsForMember("ws_1", "member_1");
    expect(results[0].related_owner_type).toBe("lead");
    expect(results[0].related_owner_id).toBe("lead_42");
  });

  it("preserves every NotificationChannel/NotificationPriority value verbatim", async () => {
    const { client } = createMockSupabase([{ data: [notificationRow({ channel: "email", priority: "critical" })], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    const results = await supabaseNotificationsRepository.getNotificationsForMember("ws_1", "member_1");
    expect(results[0].channel).toBe("email");
    expect(results[0].priority).toBe("critical");
  });
});
