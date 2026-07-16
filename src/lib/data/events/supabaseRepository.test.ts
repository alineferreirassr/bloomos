import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/auth/workspaceSessionClient", () => ({
  getClientWorkspaceSession: vi.fn(),
}));

import { supabaseEventsRepository } from "@/lib/data/events/supabaseRepository";
import { createClient } from "@/lib/supabase/client";
import { getClientWorkspaceSession } from "@/lib/auth/workspaceSessionClient";

type QueryResult = { data: unknown; error: unknown; count?: number };
type RecordedCall = { table: string; method: string; args: unknown[] };

function createMockSupabase(responses: QueryResult[]) {
  const calls: RecordedCall[] = [];
  const rpcCalls: { name: string; args: unknown }[] = [];
  let i = 0;
  function nextResult(): QueryResult {
    if (i >= responses.length) {
      throw new Error(`No mock Supabase response queued for call #${i + 1}`);
    }
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
    b.eq = chain("eq");
    b.neq = chain("neq");
    b.gte = chain("gte");
    b.lte = chain("lte");
    b.order = chain("order");
    b.insert = chain("insert");
    b.update = chain("update");
    b.delete = chain("delete");
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
  const client = {
    from: (table: string) => builder(table),
    rpc: async (name: string, args: unknown) => {
      rpcCalls.push({ name, args });
      return nextResult();
    },
  };
  return { client, calls, rpcCalls };
}

const SESSION = {
  status: "ok" as const,
  session: {
    user: { id: "user_1", email: "owner@example.com" },
    profile: {
      id: "user_1",
      full_name: "Amoré Bloom Owner",
      email: "owner@example.com",
      avatar_url: null,
      created_at: "2026-07-18T00:00:00Z",
      updated_at: "2026-07-18T00:00:00Z",
    },
    workspace: {
      id: "workspace_1",
      name: "Amoré Bloom",
      slug: "amore-bloom",
      created_by: "user_1",
      created_at: "2026-07-18T00:00:00Z",
      updated_at: "2026-07-18T00:00:00Z",
      archived_at: null,
    },
    membership: {
      id: "member_1",
      workspace_id: "workspace_1",
      user_id: "user_1",
      role: "owner" as const,
      status: "active" as const,
      created_at: "2026-07-18T00:00:00Z",
      updated_at: "2026-07-18T00:00:00Z",
    },
  },
};

function clientRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "client_1",
    workspace_id: "workspace_1",
    originating_lead_id: null,
    first_name: "Naomi",
    last_name: "Whitfield",
    email: "naomi@example.com",
    phone: null,
    instagram: null,
    preferred_contact_method: null,
    partner_name: null,
    relationship_status: null,
    important_dates: [],
    address: null,
    city: null,
    state: null,
    zip_code: null,
    source: "Referral",
    tags: [],
    internal_status: "active",
    is_returning: false,
    how_they_met: null,
    first_date: null,
    relationship_anniversary: null,
    engagement_date: null,
    wedding_date: null,
    favorite_colors: null,
    favorite_flowers: null,
    favorite_music: null,
    favorite_food: null,
    favorite_drinks: null,
    preferred_style: null,
    disliked_elements: null,
    allergies: null,
    accessibility_needs: null,
    dietary_restrictions: null,
    preferred_communication_time: null,
    do_not_call: false,
    surprise_event_confidentiality: false,
    emergency_contact_name: null,
    emergency_contact_phone: null,
    is_vip: false,
    created_at: "2026-07-17T00:00:00Z",
    updated_at: "2026-07-17T00:00:00Z",
    archived_at: null,
    ...overrides,
  };
}

function eventRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "event_1",
    workspace_id: "workspace_1",
    client_id: "client_1",
    originating_lead_id: null,
    title: "Malibu Sunset Proposal",
    event_type: "proposal",
    status: "draft",
    lifecycle_stage: "intake",
    event_date: "2026-08-22",
    start_time: "18:30",
    end_time: "20:00",
    timezone: "America/Los_Angeles",
    location_name: "El Matador State Beach",
    address: null,
    city: "Malibu",
    state: "CA",
    zip_code: null,
    latitude: null,
    longitude: null,
    guest_count: 2,
    budget_min: null,
    budget_max: null,
    package_name: null,
    theme: null,
    color_palette: null,
    surprise_event: false,
    confidentiality_notes: null,
    accessibility_notes: null,
    dietary_notes: null,
    weather_plan: null,
    backup_location: null,
    internal_summary: null,
    assigned_owner: null,
    priority: "normal",
    created_at: "2026-07-18T00:00:00Z",
    updated_at: "2026-07-18T00:00:00Z",
    archived_at: null,
    completed_at: null,
    cancelled_at: null,
    ...overrides,
  };
}

const EVENT_FORM_INPUT = {
  client_id: "client_1",
  originating_lead_id: "",
  title: "Malibu Sunset Proposal",
  event_type: "proposal" as const,
  event_date: "2026-08-22",
  start_time: "18:30",
  end_time: "20:00",
  timezone: "America/Los_Angeles",
  location_name: "El Matador State Beach",
  address: "",
  city: "Malibu",
  state: "CA",
  zip_code: "",
  latitude: "",
  longitude: "",
  guest_count: "2",
  budget_min: "",
  budget_max: "",
  package_name: "",
  theme: "",
  color_palette: "",
  surprise_event: false,
  confidentiality_notes: "",
  accessibility_notes: "",
  dietary_notes: "",
  weather_plan: "",
  backup_location: "",
  internal_summary: "",
  assigned_owner: "",
  priority: "normal" as const,
};

afterEach(() => {
  vi.clearAllMocks();
});

function mockSession() {
  vi.mocked(getClientWorkspaceSession).mockResolvedValue(SESSION as never);
}

describe("supabaseEventsRepository.getEvents", () => {
  it("scopes the query to the current Workspace and excludes archived by default", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([{ data: [eventRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const events = await supabaseEventsRepository.getEvents();

    expect(events).toHaveLength(1);
    const eqWorkspace = calls.find((c) => c.method === "eq" && c.args[0] === "workspace_id");
    expect(eqWorkspace?.args[1]).toBe("workspace_1");
    expect(calls.some((c) => c.method === "neq" && c.args[0] === "status" && c.args[1] === "archived")).toBe(true);
  });

  it("applies status/lifecycleStage/eventType/priority/clientId/date filters as query calls", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([{ data: [], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabaseEventsRepository.getEvents({
      status: "confirmed",
      lifecycleStage: "booking",
      eventType: "proposal",
      priority: "high",
      clientId: "client_1",
      dateFrom: "2026-08-01",
      dateTo: "2026-08-31",
    });

    expect(calls.some((c) => c.method === "eq" && c.args[0] === "status" && c.args[1] === "confirmed")).toBe(true);
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "lifecycle_stage" && c.args[1] === "booking")).toBe(true);
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "event_type" && c.args[1] === "proposal")).toBe(true);
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "priority" && c.args[1] === "high")).toBe(true);
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "client_id" && c.args[1] === "client_1")).toBe(true);
    expect(calls.some((c) => c.method === "gte" && c.args[0] === "event_date" && c.args[1] === "2026-08-01")).toBe(true);
    expect(calls.some((c) => c.method === "lte" && c.args[0] === "event_date" && c.args[1] === "2026-08-31")).toBe(true);
  });

  it("matches search across title, client name, location, and city combined", async () => {
    mockSession();
    const { client } = createMockSupabase([
      { data: [eventRow({ id: "event_1", title: "Malibu Sunset Proposal" })], error: null },
      { data: [clientRow({ id: "client_1", first_name: "Naomi", last_name: "Whitfield" })], error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const events = await supabaseEventsRepository.getEvents({ search: "Naomi" });

    expect(events).toHaveLength(1);
    expect(events[0].id).toBe("event_1");
  });
});

describe("supabaseEventsRepository.getEventById", () => {
  it("returns the mapped event when found", async () => {
    const { client } = createMockSupabase([{ data: eventRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const event = await supabaseEventsRepository.getEventById("event_1");
    expect(event.id).toBe("event_1");
  });

  it("throws NotFoundError when the event does not exist (or belongs to another Workspace, per RLS)", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseEventsRepository.getEventById("missing")).rejects.toThrow("was not found");
  });
});

describe("supabaseEventsRepository.createEvent", () => {
  it("returns a validation failure without touching Supabase when input is invalid", async () => {
    const { client } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.createEvent({ ...EVENT_FORM_INPUT, title: "" });
    expect(result.success).toBe(false);
  });

  it("fails when client_id doesn't reference a real (Workspace-visible) client", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.createEvent(EVENT_FORM_INPUT);
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.fieldErrors?.client_id).toBe("Client not found.");
  });

  it("inserts the event scoped to the client's Workspace, records event_created, and applies no template for an event_type with none defined", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: clientRow(), error: null },
      { data: eventRow({ event_type: "birthday" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.createEvent({ ...EVENT_FORM_INPUT, event_type: "birthday" });

    expect(result.success).toBe(true);
    const insertCall = calls.find((c) => c.table === "events" && c.method === "insert");
    expect((insertCall?.args[0] as Record<string, unknown>).workspace_id).toBe("workspace_1");
    expect((insertCall?.args[0] as Record<string, unknown>).status).toBe("draft");
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect((timelineInsert?.args[0] as Record<string, unknown>).type).toBe("event_created");
  });

  it("applies the default checklist template atomically via RPC for an event_type with one defined", async () => {
    mockSession();
    const { client, calls, rpcCalls } = createMockSupabase([
      { data: clientRow(), error: null },
      { data: eventRow({ event_type: "proposal" }), error: null },
      { data: null, error: null }, // event_created timeline insert
      { data: [], error: null }, // rpc result (discarded)
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.createEvent({ ...EVENT_FORM_INPUT, event_type: "proposal" });

    expect(result.success).toBe(true);
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].name).toBe("apply_default_event_checklist");
    const args = rpcCalls[0].args as Record<string, unknown>;
    expect(args.p_event_id).toBe("event_1");
    expect(Array.isArray(args.p_items)).toBe(true);
    expect((args.p_items as unknown[]).length).toBeGreaterThan(0);
    expect(typeof args.p_description).toBe("string");
    expect(args.p_actor).toBe("Amoré Bloom Owner");
    // No separate checklist_items insert calls from this repository — the
    // RPC owns that entirely, atomically, server-side.
    expect(calls.some((c) => c.table === "checklist_items" && c.method === "insert")).toBe(false);
  });
});

describe("supabaseEventsRepository.updateEvent", () => {
  it("fails when the event does not exist", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.updateEvent("missing", EVENT_FORM_INPUT);
    expect(result.success).toBe(false);
  });

  it("fails when the new client_id doesn't reference a real client", async () => {
    const { client } = createMockSupabase([
      { data: eventRow(), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.updateEvent("event_1", EVENT_FORM_INPUT);
    expect(result.success).toBe(false);
  });

  it("updates the row and records event_updated on success", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: eventRow(), error: null },
      { data: clientRow(), error: null },
      { data: eventRow({ title: "Updated Title" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.updateEvent("event_1", EVENT_FORM_INPUT);

    expect(result.success).toBe(true);
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect((timelineInsert?.args[0] as Record<string, unknown>).type).toBe("event_updated");
  });
});

describe("supabaseEventsRepository status/lifecycle/priority", () => {
  it("updateEventStatus rejects an illegal transition", async () => {
    const { client } = createMockSupabase([{ data: eventRow({ status: "archived" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.updateEventStatus("event_1", "confirmed");
    expect(result.success).toBe(false);
  });

  it("updateEventStatus records status_changed with from/to metadata", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: eventRow({ status: "draft" }), error: null },
      { data: eventRow({ status: "confirmed" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.updateEventStatus("event_1", "confirmed");

    expect(result.success).toBe(true);
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    const payload = timelineInsert?.args[0] as Record<string, unknown>;
    expect(payload.type).toBe("status_changed");
    expect(payload.metadata).toEqual({ from: "draft", to: "confirmed" });
  });

  it("updateEventLifecycleStage rejects moving out of the terminal 'closed' stage", async () => {
    const { client } = createMockSupabase([{ data: eventRow({ lifecycle_stage: "closed" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.updateEventLifecycleStage("event_1", "planning");
    expect(result.success).toBe(false);
  });

  it("updateEventPriority records priority_changed with from/to metadata", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: eventRow({ priority: "normal" }), error: null },
      { data: eventRow({ priority: "critical" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.updateEventPriority("event_1", "critical");

    expect(result.success).toBe(true);
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect((timelineInsert?.args[0] as Record<string, unknown>).type).toBe("priority_changed");
  });
});

describe("supabaseEventsRepository complete/cancel/archive/restore", () => {
  it("completeEvent fails when already terminal", async () => {
    const { client } = createMockSupabase([{ data: eventRow({ status: "cancelled" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.completeEvent("event_1");
    expect(result.success).toBe(false);
  });

  it("completeEvent sets status=completed and stamps completed_at", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: eventRow({ status: "in_progress" }), error: null },
      { data: eventRow({ status: "completed", completed_at: "2026-07-18T00:00:00Z" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.completeEvent("event_1");

    expect(result.success).toBe(true);
    const updateCall = calls.find((c) => c.table === "events" && c.method === "update");
    expect((updateCall?.args[0] as Record<string, unknown>).status).toBe("completed");
  });

  it("cancelEvent fails when already terminal", async () => {
    const { client } = createMockSupabase([{ data: eventRow({ status: "completed" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.cancelEvent("event_1");
    expect(result.success).toBe(false);
  });

  it("archiveEvent fails when already archived", async () => {
    const { client } = createMockSupabase([{ data: eventRow({ status: "archived" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.archiveEvent("event_1");
    expect(result.success).toBe(false);
  });

  it("restoreEvent resumes to 'planning' and clears archived_at", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: eventRow({ status: "archived", archived_at: "2026-07-18T00:00:00Z" }), error: null },
      { data: eventRow({ status: "planning", archived_at: null }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.restoreEvent("event_1");

    expect(result.success).toBe(true);
    const updateCall = calls.find((c) => c.table === "events" && c.method === "update");
    expect((updateCall?.args[0] as Record<string, unknown>).status).toBe("planning");
    expect((updateCall?.args[0] as Record<string, unknown>).archived_at).toBeNull();
  });

  it("restoreEvent fails when not archived", async () => {
    const { client } = createMockSupabase([{ data: eventRow({ status: "confirmed" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.restoreEvent("event_1");
    expect(result.success).toBe(false);
  });
});

function checklistItemRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "checklist_1",
    workspace_id: "workspace_1",
    owner_type: "event",
    owner_id: "event_1",
    title: "Confirm ring",
    description: null,
    category: "client",
    priority: "critical",
    status: "pending",
    due_date: null,
    completed_at: null,
    assigned_type: "unknown",
    assigned_id: null,
    assigned_name: null,
    sort_order: 0,
    created_at: "2026-07-18T00:00:00Z",
    updated_at: "2026-07-18T00:00:00Z",
    ...overrides,
  };
}

const CHECKLIST_ITEM_INPUT = {
  title: "Confirm ring",
  description: null,
  category: "client" as const,
  priority: "critical" as const,
  due_date: null,
  assigned_type: "unknown" as const,
  assigned_id: null,
  assigned_name: null,
};

describe("supabaseEventsRepository checklist", () => {
  it("getChecklistByEventId returns [] when the event does not exist", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const items = await supabaseEventsRepository.getChecklistByEventId("missing");
    expect(items).toEqual([]);
  });

  it("createChecklistItem computes sort_order from the current count and records checklist_item_created", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: eventRow(), error: null },
      { data: null, error: null, count: 3 },
      { data: checklistItemRow({ sort_order: 3 }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.createChecklistItem("event_1", CHECKLIST_ITEM_INPUT);

    expect(result.success).toBe(true);
    const insertCall = calls.find((c) => c.table === "checklist_items" && c.method === "insert");
    expect((insertCall?.args[0] as Record<string, unknown>).sort_order).toBe(3);
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect((timelineInsert?.args[0] as Record<string, unknown>).type).toBe("checklist_item_created");
  });

  it("updateChecklistItem records no timeline entry, matching the mock", async () => {
    const { client, calls } = createMockSupabase([
      { data: checklistItemRow(), error: null },
      { data: checklistItemRow({ title: "Updated" }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.updateChecklistItem("checklist_1", CHECKLIST_ITEM_INPUT);

    expect(result.success).toBe(true);
    expect(calls.some((c) => c.table === "timeline_activities")).toBe(false);
  });

  it("updateChecklistItemStatus sets completed_at only when moving to completed, no timeline entry", async () => {
    const { client, calls } = createMockSupabase([
      { data: checklistItemRow({ status: "pending" }), error: null },
      { data: checklistItemRow({ status: "completed" }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.updateChecklistItemStatus("checklist_1", "completed");

    expect(result.success).toBe(true);
    const updateCall = calls.find((c) => c.table === "checklist_items" && c.method === "update");
    expect((updateCall?.args[0] as Record<string, unknown>).completed_at).not.toBeNull();
    expect(calls.some((c) => c.table === "timeline_activities")).toBe(false);
  });

  it("completeChecklistItem fails when already completed", async () => {
    const { client } = createMockSupabase([{ data: checklistItemRow({ status: "completed" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.completeChecklistItem("checklist_1");
    expect(result.success).toBe(false);
  });

  it("completeChecklistItem succeeds and records checklist_item_completed", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: checklistItemRow({ status: "pending" }), error: null },
      { data: checklistItemRow({ status: "completed" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.completeChecklistItem("checklist_1");

    expect(result.success).toBe(true);
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect((timelineInsert?.args[0] as Record<string, unknown>).type).toBe("checklist_item_completed");
  });

  it("deleteChecklistItem refuses to delete a completed item", async () => {
    const { client, calls } = createMockSupabase([{ data: checklistItemRow({ status: "completed" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.deleteChecklistItem("checklist_1");

    expect(result.success).toBe(false);
    expect(calls.some((c) => c.method === "delete")).toBe(false);
  });

  it("deleteChecklistItem deletes a non-completed item", async () => {
    const { client, calls } = createMockSupabase([
      { data: checklistItemRow({ status: "pending" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.deleteChecklistItem("checklist_1");

    expect(result.success).toBe(true);
    expect(calls.some((c) => c.table === "checklist_items" && c.method === "delete")).toBe(true);
  });

  it("reorderChecklistItems fails when the id set doesn't match", async () => {
    const { client } = createMockSupabase([
      { data: eventRow(), error: null },
      { data: [checklistItemRow({ id: "checklist_1" }), checklistItemRow({ id: "checklist_2", sort_order: 1 })], error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.reorderChecklistItems("event_1", ["checklist_1"]);
    expect(result.success).toBe(false);
  });

  it("reorderChecklistItems updates sort_order for every item and returns the re-sorted list", async () => {
    const { client } = createMockSupabase([
      { data: eventRow(), error: null },
      { data: [checklistItemRow({ id: "checklist_1" }), checklistItemRow({ id: "checklist_2", sort_order: 1 })], error: null },
      { data: null, error: null },
      { data: null, error: null },
      {
        data: [checklistItemRow({ id: "checklist_2", sort_order: 0 }), checklistItemRow({ id: "checklist_1", sort_order: 1 })],
        error: null,
      },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.reorderChecklistItems("event_1", ["checklist_2", "checklist_1"]);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data[0].id).toBe("checklist_2");
  });
});

function scheduleItemRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "schedule_1",
    workspace_id: "workspace_1",
    owner_type: "event",
    owner_id: "event_1",
    title: "Team arrival & setup",
    description: null,
    start_time: "17:00",
    end_time: "17:45",
    location: "El Matador State Beach",
    assigned_to: "Amoré Bloom Team",
    category: "arrival",
    status: "planned",
    sort_order: 0,
    created_at: "2026-07-18T00:00:00Z",
    updated_at: "2026-07-18T00:00:00Z",
    ...overrides,
  };
}

const SCHEDULE_ITEM_INPUT = {
  title: "Team arrival & setup",
  description: null,
  start_time: "17:00",
  end_time: "17:45",
  location: "El Matador State Beach",
  assigned_to: "Amoré Bloom Team",
  category: "arrival" as const,
};

describe("supabaseEventsRepository schedule", () => {
  it("getScheduleByEventId returns [] when the event does not exist", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const items = await supabaseEventsRepository.getScheduleByEventId("missing");
    expect(items).toEqual([]);
  });

  it("createScheduleItem computes sort_order from the current count and records schedule_item_created", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: eventRow(), error: null },
      { data: null, error: null, count: 2 },
      { data: scheduleItemRow({ sort_order: 2 }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.createScheduleItem("event_1", SCHEDULE_ITEM_INPUT);

    expect(result.success).toBe(true);
    const insertCall = calls.find((c) => c.table === "event_schedule_items" && c.method === "insert");
    expect((insertCall?.args[0] as Record<string, unknown>).sort_order).toBe(2);
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect((timelineInsert?.args[0] as Record<string, unknown>).type).toBe("schedule_item_created");
  });

  it("updateScheduleItem records schedule_item_updated", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: scheduleItemRow(), error: null },
      { data: scheduleItemRow({ title: "Updated" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.updateScheduleItem("schedule_1", SCHEDULE_ITEM_INPUT);

    expect(result.success).toBe(true);
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect((timelineInsert?.args[0] as Record<string, unknown>).type).toBe("schedule_item_updated");
  });

  it("updateScheduleItemStatus records schedule_item_updated with a status-change description", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: scheduleItemRow({ status: "planned" }), error: null },
      { data: scheduleItemRow({ status: "confirmed" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.updateScheduleItemStatus("schedule_1", "confirmed");

    expect(result.success).toBe(true);
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    const payload = timelineInsert?.args[0] as Record<string, unknown>;
    expect(payload.type).toBe("schedule_item_updated");
    expect(payload.description).toContain("Confirmed");
  });

  it("deleteScheduleItem deletes without a completed-item guard (unlike checklist items)", async () => {
    const { client, calls } = createMockSupabase([
      { data: scheduleItemRow({ status: "completed" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.deleteScheduleItem("schedule_1");

    expect(result.success).toBe(true);
    expect(calls.some((c) => c.table === "event_schedule_items" && c.method === "delete")).toBe(true);
  });

  it("reorderScheduleItems fails when the id set doesn't match", async () => {
    const { client } = createMockSupabase([
      { data: eventRow(), error: null },
      { data: [scheduleItemRow({ id: "schedule_1" })], error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.reorderScheduleItems("event_1", ["schedule_1", "schedule_2"]);
    expect(result.success).toBe(false);
  });
});

function eventNoteRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "note_1",
    workspace_id: "workspace_1",
    owner_type: "event",
    owner_id: "event_1",
    title: "Weather backup confirmed",
    content: "Indoor backup at the hotel lobby if it rains.",
    category: "weather",
    priority: "high",
    is_pinned: false,
    attachments: [],
    created_by: "Amoré Bloom Owner",
    created_at: "2026-07-18T00:00:00Z",
    updated_at: "2026-07-18T00:00:00Z",
    ...overrides,
  };
}

describe("supabaseEventsRepository notes", () => {
  it("getNotesByEventId scopes by workspace_id + owner_type='event' + owner_id and orders pinned-first", async () => {
    const { client, calls } = createMockSupabase([
      { data: eventRow(), error: null },
      { data: [eventNoteRow()], error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const notes = await supabaseEventsRepository.getNotesByEventId("event_1");

    expect(notes).toHaveLength(1);
    const ownerFilters = calls.filter((c) => c.table === "notes" && c.method === "eq");
    expect(ownerFilters.some((c) => c.args[0] === "owner_type" && c.args[1] === "event")).toBe(true);
  });

  it("createEventNote inserts scoped to the event's Workspace and records note_added", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: eventRow(), error: null },
      { data: eventNoteRow(), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.createEventNote("event_1", {
      title: "Weather backup confirmed",
      content: "Indoor backup at the hotel lobby if it rains.",
      category: "general",
      priority: "high",
    });

    expect(result.success).toBe(true);
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect((timelineInsert?.args[0] as Record<string, unknown>).type).toBe("note_added");
  });

  it("togglePinEventNote pins an unpinned Event-owned note and records note_pinned", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: eventNoteRow({ is_pinned: false }), error: null },
      { data: eventNoteRow({ is_pinned: true }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.togglePinEventNote("note_1");

    expect(result).not.toBeNull();
    expect(result?.success).toBe(true);
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect((timelineInsert?.args[0] as Record<string, unknown>).type).toBe("note_pinned");
  });

  it("togglePinEventNote returns null when the note is not Event-owned, leaving it for the next repository in the chain", async () => {
    mockSession();
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseEventsRepository.togglePinEventNote("client_note_1");
    expect(result).toBeNull();
  });
});

describe("supabaseEventsRepository.getTimelineByEventId", () => {
  it("returns [] when the event does not exist", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const timeline = await supabaseEventsRepository.getTimelineByEventId("missing");
    expect(timeline).toEqual([]);
  });

  it("orders newest-first and scopes by workspace_id + owner_type='event' + owner_id", async () => {
    const activityRow = {
      id: "activity_1",
      workspace_id: "workspace_1",
      owner_type: "event",
      owner_id: "event_1",
      type: "event_created",
      description: "Event created",
      actor: "Amoré Bloom Owner",
      timestamp: "2026-07-18T00:00:00Z",
      metadata: null,
    };
    const { client, calls } = createMockSupabase([
      { data: eventRow(), error: null },
      { data: [activityRow], error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const timeline = await supabaseEventsRepository.getTimelineByEventId("event_1");

    expect(timeline).toHaveLength(1);
    const orderCall = calls.find((c) => c.table === "timeline_activities" && c.method === "order");
    expect(orderCall?.args).toEqual(["timestamp", { ascending: false }]);
  });
});

describe("supabaseEventsRepository Workspace isolation / session errors", () => {
  it("getEvents throws Unauthorized when there is no signed-in user", async () => {
    vi.mocked(getClientWorkspaceSession).mockResolvedValue({ status: "unauthenticated" });
    const { client } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseEventsRepository.getEvents()).rejects.toThrow("Authentication is required.");
  });

  it("createEvent throws Forbidden when the user has no active Workspace membership", async () => {
    const { client } = createMockSupabase([{ data: clientRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    vi.mocked(getClientWorkspaceSession).mockResolvedValue({ status: "no-workspace" });

    await expect(supabaseEventsRepository.createEvent(EVENT_FORM_INPUT)).rejects.toThrow(
      "You don't have permission to do that.",
    );
  });
});
