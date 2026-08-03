import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/auth/workspaceSessionClient", () => ({
  getClientWorkspaceSession: vi.fn(),
}));

import { supabaseServicesRepository } from "@/lib/data/services/supabaseRepository";
import { createClient } from "@/lib/supabase/client";
import { getClientWorkspaceSession } from "@/lib/auth/workspaceSessionClient";
import { ConflictError } from "@/core/errors";
import { resetTimelineStore } from "@/lib/data/mock/timelineStore";
import { resetNotesStore } from "@/lib/data/mock/notesStore";

/**
 * Same rationale as purchases/supabaseRepository.test.ts's own doc comment:
 * getCoreTimelineService()/getCoreNotesService() branch on
 * NEXT_PUBLIC_DATA_MODE, unset (defaults to "mock") in this Vitest
 * environment — so Notes/Timeline calls resolve against the real shared
 * mock store, not the fake Supabase client below. Only direct
 * `.from(...)`/`.rpc(...)` calls exercise the fake client.
 *
 * Coverage here is representative, not exhaustive per-method: the 16
 * template-table CRUD method quadruples (list/create/update/remove) all run
 * through the one `createSupabaseTemplateCrud` factory in
 * supabaseRepository.ts, so exercising it via `service_included_items` and
 * `service_capability_requirements` (one with, one without an enum field to
 * cast) covers every other template table's identical code path. Every
 * other DISTINCT behavior in the file — the multi-step createService, both
 * RPC wrappers and their error-code mapping, removeEventService's
 * removable-item filtering, and the questionnaire-response upsert — gets
 * its own direct test.
 */

type QueryResult = { data: unknown; error: unknown; count?: number | null };
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
    b.in = chain("in");
    b.is = chain("is");
    b.order = chain("order");
    b.insert = chain("insert");
    b.update = chain("update");
    b.delete = chain("delete");
    b.upsert = chain("upsert");
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
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
    },
    workspace: {
      id: "workspace_1",
      name: "Amoré Bloom",
      slug: "amore-bloom",
      created_by: "user_1",
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
      archived_at: null,
    },
    membership: {
      id: "member_1",
      workspace_id: "workspace_1",
      user_id: "user_1",
      role: "owner" as const,
      status: "active" as const,
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
    },
  },
};

function mockSession() {
  vi.mocked(getClientWorkspaceSession).mockResolvedValue(SESSION as never);
}

afterEach(() => {
  vi.clearAllMocks();
  resetTimelineStore();
  resetNotesStore();
});

function serviceVersionRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "version_1",
    service_id: "service_1",
    workspace_id: "workspace_1",
    version_number: null,
    status: "draft",
    name_snapshot: null,
    description_snapshot: null,
    base_price_minor: 100000,
    currency: "USD",
    setup_duration_minutes: null,
    breakdown_duration_minutes: null,
    difficulty_score: null,
    experience_level_required: null,
    weather_sensitivity: "none",
    surprise_friendly: false,
    estimated_profit_minor: null,
    change_summary: null,
    published_at: null,
    published_by: null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

function serviceRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "service_1",
    workspace_id: "workspace_1",
    category_id: null,
    name: "Photography",
    description: null,
    status: "draft",
    draft_version_id: "version_1",
    current_published_version_id: null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    archived_at: null,
    ...overrides,
  };
}

function includedItemRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "item_1",
    workspace_id: "workspace_1",
    service_version_id: "version_1",
    label: "Photo booth",
    description: null,
    display_order: 0,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

function eventServiceRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "event_service_1",
    workspace_id: "workspace_1",
    event_id: "event_1",
    service_id: "service_1",
    service_version_id: "version_1",
    name: "Photography",
    name_template_value: "Photography",
    price_minor: 100000,
    price_template_value: 100000,
    currency: "USD",
    selected_add_on_ids: [],
    status: "proposed",
    assigned_at: "2026-08-01T00:00:00Z",
    assigned_by: "Amoré Bloom Owner",
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

describe("template CRUD (service_included_items — representative of all 16 template tables)", () => {
  it("lists rows scoped to the given service_version_id", async () => {
    mockSession();
    const { client } = createMockSupabase([{ data: [includedItemRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const items = await supabaseServicesRepository.listServiceIncludedItems("version_1");
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe("Photo booth");
  });

  it("creates a row when the parent version is still a draft", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: serviceVersionRow({ status: "draft" }), error: null },
      { data: includedItemRow({ label: "New item" }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseServicesRepository.createServiceIncludedItem("version_1", { label: "New item", description: null, display_order: 0 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.label).toBe("New item");
    const insertCall = calls.find((c) => c.table === "service_included_items" && c.method === "insert");
    expect(insertCall?.args[0]).toMatchObject({ workspace_id: "workspace_1", service_version_id: "version_1", label: "New item" });
  });

  it("rejects creating a row once the parent version has been published", async () => {
    const { client } = createMockSupabase([{ data: serviceVersionRow({ status: "published", version_number: 1 }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseServicesRepository.createServiceIncludedItem("version_1", { label: "New item", description: null, display_order: 0 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/already been published/i);
  });

  it("rejects updating a row once the parent version has been published", async () => {
    const { client } = createMockSupabase([
      { data: includedItemRow(), error: null },
      { data: serviceVersionRow({ status: "published", version_number: 1 }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseServicesRepository.updateServiceIncludedItem("item_1", { label: "Edited", description: null, display_order: 0 });
    expect(result.success).toBe(false);
  });

  it("removes a row while the parent version is still a draft", async () => {
    const { client, calls } = createMockSupabase([
      { data: includedItemRow(), error: null },
      { data: serviceVersionRow({ status: "draft" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseServicesRepository.removeServiceIncludedItem("item_1");
    expect(result.success).toBe(true);
    expect(calls.some((c) => c.table === "service_included_items" && c.method === "delete")).toBe(true);
  });
});

describe("template CRUD — service_capability_requirements (enum-field cast)", () => {
  it("casts capability_type through the mapper", async () => {
    const { client } = createMockSupabase([
      { data: [{ id: "cap_1", workspace_id: "workspace_1", service_version_id: "version_1", capability_type: "equipment", label: "Cargo van", display_order: 0, created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z" }], error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const items = await supabaseServicesRepository.listServiceCapabilityRequirements("version_1");
    expect(items[0].capability_type).toBe("equipment");
  });
});

describe("Service Categories", () => {
  it("lists categories excluding archived by default", async () => {
    mockSession();
    const { client } = createMockSupabase([{ data: [{ id: "cat_1", workspace_id: "workspace_1", name: "Photography", description: null, display_order: 0, created_at: "", updated_at: "", archived_at: null }], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const categories = await supabaseServicesRepository.listServiceCategories();
    expect(categories).toHaveLength(1);
  });

  it("creates a category", async () => {
    mockSession();
    const { client } = createMockSupabase([{ data: { id: "cat_2", workspace_id: "workspace_1", name: "Catering", description: null, display_order: 0, created_at: "", updated_at: "", archived_at: null }, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseServicesRepository.createServiceCategory({ name: "Catering", description: null, display_order: 0 });
    expect(result.success).toBe(true);
  });
});

describe("createService", () => {
  it("creates the Service, then its draft ServiceVersion, then repoints draft_version_id — three sequential calls", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: serviceRow({ draft_version_id: null }), error: null },
      { data: serviceVersionRow(), error: null },
      { data: serviceRow({ draft_version_id: "version_1" }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseServicesRepository.createService({ category_id: null, name: "Photography", description: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.draft_version_id).toBe("version_1");

    expect(calls.filter((c) => c.method === "insert").map((c) => c.table)).toEqual(["services", "service_versions"]);
    const finalUpdate = calls.find((c) => c.table === "services" && c.method === "update");
    expect(finalUpdate?.args[0]).toMatchObject({ draft_version_id: "version_1" });
  });
});

describe("updateServiceVersionDraft", () => {
  it("updates the current draft when it is still editable", async () => {
    const { client } = createMockSupabase([
      { data: serviceRow(), error: null },
      { data: serviceVersionRow(), error: null },
      { data: serviceVersionRow({ base_price_minor: 150000 }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseServicesRepository.updateServiceVersionDraft("service_1", {
      base_price_minor: 150000,
      currency: "USD",
      setup_duration_minutes: null,
      breakdown_duration_minutes: null,
      difficulty_score: null,
      experience_level_required: null,
      weather_sensitivity: "none",
      surprise_friendly: false,
      estimated_profit_minor: null,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.base_price_minor).toBe(150000);
  });
});

describe("publishServiceVersion", () => {
  it("wraps the publish_service_version RPC and maps the published row", async () => {
    mockSession();
    const { client, rpcCalls } = createMockSupabase([{ data: serviceVersionRow({ status: "published", version_number: 1, name_snapshot: "Photography" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseServicesRepository.publishServiceVersion("service_1", { change_summary: "Initial release" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.version_number).toBe(1);
    expect(rpcCalls[0]).toMatchObject({ name: "publish_service_version", args: { p_service_id: "service_1", p_change_summary: "Initial release", p_actor: "Amoré Bloom Owner" } });
  });

  it("maps a P0022 RPC error to a user-facing failure rather than throwing", async () => {
    mockSession();
    const { client } = createMockSupabase([{ data: null, error: { code: "P0022", message: "Draft version not found." } }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseServicesRepository.publishServiceVersion("service_1", { change_summary: null });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Draft version not found.");
  });

  it("throws (does not silently fail) on an unrecognized error code", async () => {
    mockSession();
    const { client } = createMockSupabase([{ data: null, error: { code: "23505", message: "unexpected" } }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseServicesRepository.publishServiceVersion("service_1", { change_summary: null })).rejects.toThrow();
  });

  it("throws a ConflictError (not a plain failure) on P0023 — the draft was already published by someone else", async () => {
    mockSession();
    const { client } = createMockSupabase([{ data: null, error: { code: "P0023", message: "This version is not currently a draft." } }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseServicesRepository.publishServiceVersion("service_1", { change_summary: null })).rejects.toThrow(ConflictError);
  });
});

describe("assignServiceToEvent", () => {
  it("wraps the assign_service_to_event RPC and maps the resulting EventService", async () => {
    mockSession();
    const { client, rpcCalls } = createMockSupabase([{ data: eventServiceRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseServicesRepository.assignServiceToEvent("event_1", { service_id: "service_1", selected_add_on_ids: [] });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Photography");
    expect(rpcCalls[0]).toMatchObject({ name: "assign_service_to_event", args: { p_event_id: "event_1", p_service_id: "service_1", p_selected_add_on_ids: [], p_actor: "Amoré Bloom Owner" } });
  });

  it("maps a P0032 RPC error (no published version) to a user-facing failure", async () => {
    mockSession();
    const { client } = createMockSupabase([{ data: null, error: { code: "P0032", message: "This Service has no published version and cannot be assigned yet." } }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseServicesRepository.assignServiceToEvent("event_1", { service_id: "service_1", selected_add_on_ids: [] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/no published version/i);
  });
});

describe("removeEventService", () => {
  it("deletes only the still-removable generated checklist/schedule items before deleting the EventService", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: eventServiceRow(), error: null },
      { data: [
        { id: "c1", workspace_id: "workspace_1", owner_type: "event", owner_id: "event_1", title: "Pending", description: null, category: "other", priority: "normal", status: "pending", due_date: null, completed_at: null, assigned_type: "unknown", assigned_id: null, assigned_name: null, sort_order: 0, source_event_service_id: "event_service_1", template_snapshot: null, created_at: "", updated_at: "" },
        { id: "c2", workspace_id: "workspace_1", owner_type: "event", owner_id: "event_1", title: "Done", description: null, category: "other", priority: "normal", status: "completed", due_date: null, completed_at: null, assigned_type: "unknown", assigned_id: null, assigned_name: null, sort_order: 1, source_event_service_id: "event_service_1", template_snapshot: null, created_at: "", updated_at: "" },
      ], error: null },
      { data: null, error: null },
      { data: [], error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseServicesRepository.removeEventService("event_service_1");
    expect(result.success).toBe(true);

    const checklistDelete = calls.find((c) => c.table === "checklist_items" && c.method === "delete");
    expect(checklistDelete).toBeDefined();
    const inCall = calls.find((c) => c.table === "checklist_items" && c.method === "in");
    expect(inCall?.args[1]).toEqual(["c1"]);
    expect(calls.some((c) => c.table === "event_services" && c.method === "delete")).toBe(true);
  });
});

describe("transitionEventServiceStatus", () => {
  it("allows the normal forward transition", async () => {
    mockSession();
    const { client } = createMockSupabase([
      { data: eventServiceRow({ status: "proposed" }), error: null },
      { data: eventServiceRow({ status: "confirmed" }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseServicesRepository.transitionEventServiceStatus("event_service_1", "confirmed");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("confirmed");
  });

  it("rejects an invalid transition without touching the database", async () => {
    const { client, calls } = createMockSupabase([{ data: eventServiceRow({ status: "completed" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseServicesRepository.transitionEventServiceStatus("event_service_1", "in_progress");
    expect(result.success).toBe(false);
    expect(calls.some((c) => c.method === "update")).toBe(false);
  });
});

describe("submitEventServiceQuestionnaireResponse", () => {
  it("upserts on the (event_service_id, question_id) constraint", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: { id: "resp_1", workspace_id: "workspace_1", event_service_id: "event_service_1", question_id: "q1", response_text: "Yes please", response_options: null, response_boolean: null, response_date: null, created_at: "", updated_at: "" }, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseServicesRepository.submitEventServiceQuestionnaireResponse("event_service_1", {
      question_id: "q1",
      response_text: "Yes please",
      response_options: null,
      response_boolean: null,
      response_date: null,
    });
    expect(result.success).toBe(true);
    const upsertCall = calls.find((c) => c.table === "event_service_questionnaire_responses" && c.method === "upsert");
    expect(upsertCall?.args[1]).toMatchObject({ onConflict: "event_service_id,question_id" });
  });
});

describe("getServiceUsageCounts", () => {
  it("counts only non-cancelled rows, in one query, scoped by workspace_id and the requested service_ids", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      {
        data: [
          { service_id: "service_1", status: "proposed" },
          { service_id: "service_1", status: "cancelled" },
          { service_id: "service_2", status: "completed" },
        ],
        error: null,
      },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const counts = await supabaseServicesRepository.getServiceUsageCounts(["service_1", "service_2"]);
    expect(counts).toEqual({ service_1: 1, service_2: 1 });

    const query = calls.filter((c) => c.table === "event_services");
    expect(query.some((c) => c.method === "eq" && c.args[0] === "workspace_id")).toBe(true);
    expect(query.some((c) => c.method === "in" && c.args[0] === "service_id" && (c.args[1] as string[]).length === 2)).toBe(true);
    expect(query.filter((c) => c.method === "then")).toHaveLength(1);
  });

  it("returns an empty object without querying at all for an empty id list", async () => {
    const { client, calls } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const counts = await supabaseServicesRepository.getServiceUsageCounts([]);
    expect(counts).toEqual({});
    expect(calls).toHaveLength(0);
  });
});

describe("updateEventServiceOverrides", () => {
  it("writes only name/price_minor and preserves the frozen template snapshot", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: eventServiceRow(), error: null },
      { data: eventServiceRow({ name: "Custom Name", price_minor: 75000 }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseServicesRepository.updateEventServiceOverrides("event_service_1", { name: "Custom Name", price_minor: 75000 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Custom Name");
      expect(result.data.price_minor).toBe(75000);
      expect(result.data.name_template_value).toBe("Photography");
    }

    const updateCall = calls.find((c) => c.table === "event_services" && c.method === "update");
    expect(updateCall?.args[0]).toEqual({ name: "Custom Name", price_minor: 75000 });
  });

  it("rejects once the EventService is completed or cancelled, without issuing an update", async () => {
    const { client, calls } = createMockSupabase([{ data: eventServiceRow({ status: "cancelled" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseServicesRepository.updateEventServiceOverrides("event_service_1", { name: "Too Late" });
    expect(result.success).toBe(false);
    expect(calls.some((c) => c.method === "update")).toBe(false);
  });

  it("rejects an empty input before touching the database", async () => {
    const { client, calls } = createMockSupabase([{ data: eventServiceRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseServicesRepository.updateEventServiceOverrides("event_service_1", {});
    expect(result.success).toBe(false);
    expect(calls.some((c) => c.method === "update")).toBe(false);
  });
});

describe("Notes/Timeline delegation for Service", () => {
  it("creates a note for a Service and reads it back from the shared mock store", async () => {
    mockSession();
    const { client } = createMockSupabase([{ data: serviceRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const created = await supabaseServicesRepository.createServiceNote("service_1", { title: "Add-on request", content: "Client requested extra hour", category: "general", priority: "normal" });
    expect(created.success).toBe(true);

    const { client: client2 } = createMockSupabase([{ data: serviceRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client2 as never);
    const notes = await supabaseServicesRepository.getNotesByServiceId("service_1");
    expect(notes.some((n) => n.content === "Client requested extra hour")).toBe(true);
  });
});
