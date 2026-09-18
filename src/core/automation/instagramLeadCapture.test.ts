import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createClientMock = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: (...args: unknown[]) => createClientMock(...args) }));

// SOCIAL-16D — real dispatch calls (see findOrCreateInstagramLead's own
// dispatch gated on `created === true`) route through this module; mocked
// the same way metaWebhookProcessing.test.ts already mocks it, so the
// assertions below can inspect exactly what was dispatched.
vi.mock("@/core/automation/resolver", () => ({ dispatchAutomationTrigger: vi.fn().mockResolvedValue([]) }));

import { findOrCreateInstagramLead } from "@/core/automation/instagramLeadCapture";
import { readLeads, resetLeadsStore } from "@/lib/data/mock/leadsStore";
import { dispatchAutomationTrigger } from "@/core/automation/resolver";
import type { InstagramLeadCaptureInput } from "@/types/lead";

const dispatchMock = vi.mocked(dispatchAutomationTrigger);

const ORIGINAL_ENV = { ...process.env };

function input(overrides: Partial<InstagramLeadCaptureInput> = {}): InstagramLeadCaptureInput {
  return {
    workspaceId: "ws_1",
    source: "Instagram",
    instagramExternalId: "17841400000000001",
    instagram: "@curious_bride",
    message: "Do you have June availability?",
    firstName: null,
    lastName: null,
    email: null,
    ...overrides,
  };
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.clearAllMocks();
});

describe("findOrCreateInstagramLead — mock mode", () => {
  beforeEach(() => {
    resetLeadsStore();
    process.env.NEXT_PUBLIC_DATA_MODE = "mock";
  });

  it("creates a new Lead with exactly the specified fields, no invented data", async () => {
    const result = await findOrCreateInstagramLead(input());

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.created).toBe(true);
    expect(result.data.lead).toMatchObject({
      workspace_id: "ws_1",
      first_name: null,
      last_name: null,
      email: null,
      phone: null,
      instagram: "@curious_bride",
      instagram_external_id: "17841400000000001",
      source: "Instagram",
      message: "Do you have June availability?",
      status: "new",
      assigned_to: null,
      converted_client_id: null,
    });
  });

  it("recognizes an existing Lead for the same workspace+external id — never creates a duplicate, never overwrites its fields", async () => {
    const first = await findOrCreateInstagramLead(input());
    expect(first.success && first.data.created).toBe(true);

    const second = await findOrCreateInstagramLead(input({ instagram: "@a_totally_different_handle_now", message: "a different message entirely" }));

    expect(second.success).toBe(true);
    if (!second.success || !first.success) return;
    expect(second.data.created).toBe(false);
    expect(second.data.lead.id).toBe(first.data.lead.id);
    // The existing Lead's own fields are untouched by the duplicate capture.
    expect(second.data.lead.instagram).toBe("@curious_bride");
    expect(second.data.lead.message).toBe("Do you have June availability?");

    expect(readLeads().filter((l) => l.workspace_id === "ws_1" && l.instagram_external_id === "17841400000000001")).toHaveLength(1);
  });

  it("workspace isolation — the same external id in two different workspaces creates two distinct Leads, never cross-linked", async () => {
    const a = await findOrCreateInstagramLead(input({ workspaceId: "ws_a", instagramExternalId: "17841400000000099" }));
    const b = await findOrCreateInstagramLead(input({ workspaceId: "ws_b", instagramExternalId: "17841400000000099" }));

    expect(a.success && a.data.created).toBe(true);
    expect(b.success && b.data.created).toBe(true);
    if (!a.success || !b.success) return;
    expect(a.data.lead.id).not.toBe(b.data.lead.id);
    expect(a.data.lead.workspace_id).toBe("ws_a");
    expect(b.data.lead.workspace_id).toBe("ws_b");
  });

  it("a Lead in workspace A is never found/reused by a lookup scoped to workspace B", async () => {
    const created = await findOrCreateInstagramLead(input({ workspaceId: "ws_a" }));
    expect(created.success && created.data.created).toBe(true);

    const fromOtherWorkspace = await findOrCreateInstagramLead(input({ workspaceId: "ws_b" }));
    expect(fromOtherWorkspace.success).toBe(true);
    if (!fromOtherWorkspace.success) return;
    expect(fromOtherWorkspace.data.created).toBe(true);
    if (!created.success) return;
    expect(fromOtherWorkspace.data.lead.id).not.toBe(created.data.lead.id);
  });

  it("preserves a null instagram username and null message exactly — never fabricates a value, never substitutes the external id", async () => {
    const result = await findOrCreateInstagramLead(input({ instagram: null, message: null, instagramExternalId: "17841400000000042" }));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.lead.instagram).toBeNull();
    expect(result.data.lead.message).toBeNull();
    expect(result.data.lead.instagram_external_id).toBe("17841400000000042");
  });

  describe("SOCIAL-15C — content attribution", () => {
    it("a new Lead created from a comment receives instagram_comment_id and social_post_id exactly as provided", async () => {
      const result = await findOrCreateInstagramLead(input({ instagramCommentId: "comment_1", socialPostId: "post_1" }));

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.lead.instagram_comment_id).toBe("comment_1");
      expect(result.data.lead.social_post_id).toBe("post_1");
      expect(result.data.lead.instagram_conversation_id).toBeNull();
    });

    it("a new Lead created from a DM receives instagram_conversation_id exactly as provided, and never a social_post_id", async () => {
      const result = await findOrCreateInstagramLead(input({ instagramConversationId: "conversation_1" }));

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.lead.instagram_conversation_id).toBe("conversation_1");
      expect(result.data.lead.social_post_id).toBeNull();
      expect(result.data.lead.instagram_comment_id).toBeNull();
    });

    it("attribution is null by construction when the caller resolved none (a comment with no matching Social Post) — never fabricated", async () => {
      const result = await findOrCreateInstagramLead(input({ instagramCommentId: "comment_1", socialPostId: null }));

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.lead.instagram_comment_id).toBe("comment_1");
      expect(result.data.lead.social_post_id).toBeNull();
    });

    it("redelivery/idempotency — a second capture of the same identity never creates a second Lead, and never overwrites the first Lead's existing attribution with a different (or null) one", async () => {
      const first = await findOrCreateInstagramLead(input({ instagramExternalId: "17841400000000077", instagramCommentId: "comment_first", socialPostId: "post_first" }));
      expect(first.success && first.data.created).toBe(true);

      // A redelivered/duplicate webhook for the SAME identity, arriving with
      // a DIFFERENT (or absent) attribution — simulates the exact risk
      // Section 8 of this checkpoint warns against.
      const second = await findOrCreateInstagramLead(input({ instagramExternalId: "17841400000000077", instagramCommentId: "comment_second", socialPostId: null }));

      expect(second.success).toBe(true);
      if (!second.success || !first.success) return;
      expect(second.data.created).toBe(false);
      expect(second.data.lead.id).toBe(first.data.lead.id);
      // The existing Lead's own attribution is completely untouched.
      expect(second.data.lead.instagram_comment_id).toBe("comment_first");
      expect(second.data.lead.social_post_id).toBe("post_first");

      expect(readLeads().filter((l) => l.workspace_id === "ws_1" && l.instagram_external_id === "17841400000000077")).toHaveLength(1);
    });

    it("a manually-created (non-Instagram) Lead shape — no attribution fields provided at all — still creates cleanly with every attribution field null", async () => {
      const result = await findOrCreateInstagramLead(input({ instagramExternalId: "17841400000000088" }));

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.lead.social_post_id).toBeNull();
      expect(result.data.lead.instagram_comment_id).toBeNull();
      expect(result.data.lead.instagram_conversation_id).toBeNull();
    });
  });

  describe("SOCIAL-16D — lead.created trigger dispatch", () => {
    /** Mock-mode `recordTimelineActivity` also fires its own, pre-existing, unrelated `timeline_event` dispatch for every Lead timeline entry — filtering to `lead.created` isolates SOCIAL-16D's own event from that legitimate, untouched behavior. */
    function leadCreatedCalls() {
      return dispatchMock.mock.calls.filter(([trigger]) => trigger.type === "lead.created");
    }

    it("dispatches lead.created exactly once for a genuine new Lead captured from a comment (instagramCommentId/socialPostId present), with the correct workspaceId/leadId/source", async () => {
      const result = await findOrCreateInstagramLead(input({ instagramExternalId: "17841400000000201", instagramCommentId: "comment_1", socialPostId: "post_1" }));
      expect(result.success && result.data.created).toBe(true);
      if (!result.success) return;

      const calls = leadCreatedCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0][0]).toEqual(
        expect.objectContaining({ type: "lead.created", workspaceId: "ws_1", facts: { leadId: result.data.lead.id, source: "Instagram" } }),
      );
    });

    it("dispatches lead.created exactly once for a genuine new Lead captured from a DM (instagramConversationId present, no socialPostId)", async () => {
      const result = await findOrCreateInstagramLead(input({ instagramExternalId: "17841400000000202", instagramConversationId: "conversation_1" }));
      expect(result.success && result.data.created).toBe(true);
      if (!result.success) return;

      const calls = leadCreatedCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0][0]).toEqual(
        expect.objectContaining({ type: "lead.created", workspaceId: "ws_1", facts: { leadId: result.data.lead.id, source: "Instagram" } }),
      );
    });

    it("never dispatches lead.created when an existing Lead is found — a redelivered/duplicate capture is a pure no-op read", async () => {
      const first = await findOrCreateInstagramLead(input({ instagramExternalId: "17841400000000203" }));
      expect(first.success && first.data.created).toBe(true);
      dispatchMock.mockClear();

      const second = await findOrCreateInstagramLead(input({ instagramExternalId: "17841400000000203" }));
      expect(second.success && !second.data.created).toBe(true);
      expect(leadCreatedCalls()).toHaveLength(0);
    });
  });
});

describe("findOrCreateInstagramLead — supabase mode", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_DATA_MODE = "supabase";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    createClientMock.mockReset();
  });

  function leadRow(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: "lead_db_1",
      workspace_id: "ws_1",
      first_name: null,
      last_name: null,
      email: null,
      phone: null,
      instagram: "@curious_bride",
      instagram_external_id: "17841400000000001",
      source: "Instagram",
      event_type: null,
      event_date: null,
      location: null,
      budget_min: null,
      budget_max: null,
      message: "Do you have June availability?",
      status: "new",
      assigned_to: null,
      converted_client_id: null,
      social_post_id: null,
      instagram_comment_id: null,
      instagram_conversation_id: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      archived_at: null,
      ...overrides,
    };
  }

  /** selectResults are consumed in order, one per successive `.maybeSingle()` call — models "nothing existed at first SELECT time, then a concurrent insert won" without a full filter-matching row store. */
  function makeStub(config: { selectResults: Array<{ data: Record<string, unknown> | null; error: unknown }>; insertResult: { data: Record<string, unknown> | null; error: unknown }; timelineError?: unknown }) {
    let selectCallIndex = 0;
    const timelineInsert = vi.fn(async () => ({ error: config.timelineError ?? null }));

    const from = vi.fn((table: string) => {
      if (table === "leads") {
        const builder: Record<string, unknown> = {};
        builder.select = vi.fn(() => builder);
        builder.eq = vi.fn(() => builder);
        builder.maybeSingle = vi.fn(async () => {
          const result = config.selectResults[selectCallIndex] ?? { data: null, error: null };
          selectCallIndex += 1;
          return result;
        });
        builder.insert = vi.fn(() => {
          const insertBuilder: Record<string, unknown> = {};
          insertBuilder.select = vi.fn(() => insertBuilder);
          insertBuilder.single = vi.fn(async () => config.insertResult);
          return insertBuilder;
        });
        return builder;
      }
      if (table === "timeline_activities") {
        return { insert: timelineInsert };
      }
      throw new Error(`Unexpected table in test stub: ${table}`);
    });

    return { from, timelineInsert };
  }

  it("fails closed when SUPABASE_SERVICE_ROLE_KEY is not configured, without any network call", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const result = await findOrCreateInstagramLead(input());
    expect(result.success).toBe(false);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("creates a new Lead when none exists — inserts with the exact specified fields and records a timeline entry", async () => {
    const stub = makeStub({
      selectResults: [{ data: null, error: null }],
      insertResult: { data: leadRow(), error: null },
    });
    createClientMock.mockReturnValue(stub);

    const result = await findOrCreateInstagramLead(input());

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.created).toBe(true);
    expect(result.data.lead.instagram_external_id).toBe("17841400000000001");
    expect(result.data.lead.first_name).toBeNull();
    expect(stub.timelineInsert).toHaveBeenCalledTimes(1);
    // SOCIAL-16D — a genuine insert dispatches lead.created exactly once.
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(dispatchMock).toHaveBeenCalledWith(expect.objectContaining({ type: "lead.created", workspaceId: "ws_1", facts: { leadId: result.data.lead.id, source: "Instagram" } }), expect.anything());
  });

  it("SOCIAL-15C — the insert payload carries the exact attribution fields provided, never fabricated or omitted", async () => {
    let insertPayload: Record<string, unknown> | undefined;
    const from = vi.fn((table: string) => {
      if (table === "leads") {
        const builder: Record<string, unknown> = {};
        builder.select = vi.fn(() => builder);
        builder.eq = vi.fn(() => builder);
        builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
        builder.insert = vi.fn((payload: Record<string, unknown>) => {
          insertPayload = payload;
          const insertBuilder: Record<string, unknown> = {};
          insertBuilder.select = vi.fn(() => insertBuilder);
          insertBuilder.single = vi.fn(async () => ({ data: leadRow({ social_post_id: "post_1", instagram_comment_id: "comment_1" }), error: null }));
          return insertBuilder;
        });
        return builder;
      }
      return { insert: vi.fn(async () => ({ error: null })) };
    });
    createClientMock.mockReturnValue({ from });

    const result = await findOrCreateInstagramLead(input({ instagramCommentId: "comment_1", socialPostId: "post_1" }));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.lead.social_post_id).toBe("post_1");
    expect(result.data.lead.instagram_comment_id).toBe("comment_1");
    expect(insertPayload).toMatchObject({ social_post_id: "post_1", instagram_comment_id: "comment_1", instagram_conversation_id: null });
  });

  it("recognizes an existing Lead found on the first lookup — never inserts, never calls timeline", async () => {
    const stub = makeStub({
      selectResults: [{ data: leadRow(), error: null }],
      insertResult: { data: null, error: null },
    });
    createClientMock.mockReturnValue(stub);

    const result = await findOrCreateInstagramLead(input());

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.created).toBe(false);
    expect(result.data.lead.id).toBe("lead_db_1");
    expect(stub.timelineInsert).not.toHaveBeenCalled();
    // SOCIAL-16D — "found existing" never dispatches lead.created.
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("concurrent-race unique violation on insert — re-reads and returns the winning row, never throws, never a duplicate, never dispatches lead.created for the losing racer", async () => {
    const stub = makeStub({
      // First .maybeSingle(): not found yet. Insert then hits the unique index
      // (someone else's concurrent insert already landed). Second
      // .maybeSingle(): the race re-query finds their row.
      selectResults: [
        { data: null, error: null },
        { data: leadRow({ id: "lead_race_winner" }), error: null },
      ],
      insertResult: { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } },
    });
    createClientMock.mockReturnValue(stub);

    const result = await findOrCreateInstagramLead(input());

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.created).toBe(false);
    expect(result.data.lead.id).toBe("lead_race_winner");
    // SOCIAL-16D — the race-loser branch (created: false) never dispatches.
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("throws a normalized error for a genuine, non-unique-violation database failure — never silently swallowed", async () => {
    const stub = makeStub({
      selectResults: [{ data: null, error: null }],
      insertResult: { data: null, error: { code: "42501", message: "permission denied" } },
    });
    createClientMock.mockReturnValue(stub);

    await expect(findOrCreateInstagramLead(input())).rejects.toThrow();
  });

  it("never exposes the service role key in any result", async () => {
    const stub = makeStub({ selectResults: [{ data: null, error: null }], insertResult: { data: leadRow(), error: null } });
    createClientMock.mockReturnValue(stub);

    const result = await findOrCreateInstagramLead(input());
    expect(JSON.stringify(result)).not.toContain("test-service-role-key");
  });
});
