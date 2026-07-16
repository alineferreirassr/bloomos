import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/auth/workspaceSessionClient", () => ({
  getClientWorkspaceSession: vi.fn(),
}));

import { supabaseLeadsRepository } from "@/lib/data/leads/supabaseRepository";
import { createClient } from "@/lib/supabase/client";
import { getClientWorkspaceSession } from "@/lib/auth/workspaceSessionClient";

type QueryResult = { data: unknown; error: unknown };
type RecordedCall = { table: string; method: string; args: unknown[] };

function createMockSupabase(responses: QueryResult[]) {
  const calls: RecordedCall[] = [];
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
    b.order = chain("order");
    b.insert = chain("insert");
    b.update = chain("update");
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
  return { client: { from: (table: string) => builder(table) }, calls };
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
      created_at: "2026-07-16T00:00:00Z",
      updated_at: "2026-07-16T00:00:00Z",
    },
    workspace: {
      id: "workspace_1",
      name: "Amoré Bloom",
      slug: "amore-bloom",
      created_by: "user_1",
      created_at: "2026-07-16T00:00:00Z",
      updated_at: "2026-07-16T00:00:00Z",
      archived_at: null,
    },
    membership: {
      id: "member_1",
      workspace_id: "workspace_1",
      user_id: "user_1",
      role: "owner" as const,
      status: "active" as const,
      created_at: "2026-07-16T00:00:00Z",
      updated_at: "2026-07-16T00:00:00Z",
    },
  },
};

function leadRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "lead_1",
    workspace_id: "workspace_1",
    first_name: "Sofia",
    last_name: "Marchetti",
    email: "sofia@example.com",
    phone: null,
    instagram: null,
    source: "Instagram",
    event_type: "Proposal",
    event_date: null,
    location: null,
    budget_min: null,
    budget_max: null,
    message: null,
    status: "new",
    assigned_to: null,
    converted_client_id: null,
    created_at: "2026-07-16T00:00:00Z",
    updated_at: "2026-07-16T00:00:00Z",
    archived_at: null,
    ...overrides,
  };
}

const LEAD_FORM_INPUT = {
  first_name: "Sofia",
  last_name: "Marchetti",
  email: "sofia@example.com",
  phone: "",
  instagram: "",
  source: "Instagram",
  event_type: "",
  event_date: "",
  location: "",
  budget_min: "",
  budget_max: "",
  message: "",
  assigned_to: "",
};

afterEach(() => {
  vi.clearAllMocks();
});

function mockSession() {
  vi.mocked(getClientWorkspaceSession).mockResolvedValue(SESSION as never);
}

describe("supabaseLeadsRepository.getLeads", () => {
  it("scopes the query to the current Workspace and does not filter out archived by default (excludes them via SQL)", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([{ data: [leadRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const leads = await supabaseLeadsRepository.getLeads();

    expect(leads).toHaveLength(1);
    expect(leads[0].id).toBe("lead_1");
    const eqWorkspace = calls.find((c) => c.method === "eq" && c.args[0] === "workspace_id");
    expect(eqWorkspace?.args[1]).toBe("workspace_1");
    const neqArchived = calls.find((c) => c.method === "neq");
    expect(neqArchived?.args).toEqual(["status", "archived"]);
    const orderCall = calls.find((c) => c.method === "order");
    expect(orderCall?.args).toEqual(["created_at", { ascending: false }]);
    // No .limit() call anywhere — the full matching result set is returned,
    // matching the mock (which never paginated either).
    expect(calls.some((c) => c.method === "limit")).toBe(false);
  });

  it("includes archived leads when includeArchived is true (skips the neq filter)", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([{ data: [leadRow({ status: "archived" })], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const leads = await supabaseLeadsRepository.getLeads({ includeArchived: true });

    expect(leads).toHaveLength(1);
    expect(calls.some((c) => c.method === "neq")).toBe(false);
  });

  it("applies status/source/eventType filters as eq() calls", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([{ data: [], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabaseLeadsRepository.getLeads({ status: "qualified", source: "Instagram", eventType: "Proposal" });

    expect(calls.some((c) => c.method === "eq" && c.args[0] === "status" && c.args[1] === "qualified")).toBe(true);
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "source" && c.args[1] === "Instagram")).toBe(true);
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "event_type" && c.args[1] === "Proposal")).toBe(
      true,
    );
  });

  it("matches search across first name, last name, and email combined, exactly like the mock", async () => {
    mockSession();
    const rows = [
      leadRow({ id: "lead_1", first_name: "Sofia", last_name: "Marchetti", email: "sofia@example.com" }),
      leadRow({ id: "lead_2", first_name: "Daniel", last_name: "Reyes", email: "daniel@example.com" }),
    ];
    const { client } = createMockSupabase([{ data: rows, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const leads = await supabaseLeadsRepository.getLeads({ search: "Sofia Marchetti" });

    expect(leads).toHaveLength(1);
    expect(leads[0].id).toBe("lead_1");
  });

  it("throws a normalized error when the query fails", async () => {
    mockSession();
    const { client } = createMockSupabase([{ data: null, error: { code: "42501", message: "permission denied" } }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseLeadsRepository.getLeads()).rejects.toThrow("You don't have permission to do that.");
  });
});

describe("supabaseLeadsRepository.getLeadById", () => {
  it("returns the mapped lead when found", async () => {
    const { client } = createMockSupabase([{ data: leadRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const lead = await supabaseLeadsRepository.getLeadById("lead_1");
    expect(lead.id).toBe("lead_1");
    expect(lead.first_name).toBe("Sofia");
  });

  it("throws NotFoundError when the lead does not exist (or belongs to another Workspace, per RLS)", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseLeadsRepository.getLeadById("missing")).rejects.toThrow("was not found");
  });
});

describe("supabaseLeadsRepository.createLead", () => {
  it("returns a validation failure without touching Supabase when input is invalid", async () => {
    const { client } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseLeadsRepository.createLead({ ...LEAD_FORM_INPUT, first_name: "" });
    expect(result.success).toBe(false);
  });

  it("throws Unauthorized when there is no signed-in user", async () => {
    vi.mocked(getClientWorkspaceSession).mockResolvedValue({ status: "unauthenticated" });
    const { client } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseLeadsRepository.createLead(LEAD_FORM_INPUT)).rejects.toThrow(
      "Authentication is required.",
    );
  });

  it("throws Forbidden when the user has no active Workspace membership", async () => {
    vi.mocked(getClientWorkspaceSession).mockResolvedValue({ status: "no-workspace" });
    const { client } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseLeadsRepository.createLead(LEAD_FORM_INPUT)).rejects.toThrow(
      "You don't have permission to do that.",
    );
  });

  it("inserts the lead scoped to the current Workspace and records a lead_created timeline entry", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: leadRow(), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseLeadsRepository.createLead(LEAD_FORM_INPUT);

    expect(result.success).toBe(true);
    const insertCall = calls.find((c) => c.table === "leads" && c.method === "insert");
    expect((insertCall?.args[0] as Record<string, unknown>).workspace_id).toBe("workspace_1");
    expect((insertCall?.args[0] as Record<string, unknown>).status).toBe("new");
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect((timelineInsert?.args[0] as Record<string, unknown>).type).toBe("lead_created");
    expect((timelineInsert?.args[0] as Record<string, unknown>).actor).toBe("Amoré Bloom Owner");
  });
});

describe("supabaseLeadsRepository.updateLead", () => {
  it("fails when the lead does not exist", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseLeadsRepository.updateLead("missing", LEAD_FORM_INPUT);
    expect(result).toEqual({ success: false, error: "Lead not found.", fieldErrors: undefined });
  });

  it("fails when the lead was already converted", async () => {
    const { client } = createMockSupabase([{ data: leadRow({ status: "converted" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseLeadsRepository.updateLead("lead_1", LEAD_FORM_INPUT);
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error).toContain("read-only");
  });

  it("updates the row and records a lead_updated timeline entry on success", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: leadRow(), error: null },
      { data: leadRow({ first_name: "Sofia-Updated" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseLeadsRepository.updateLead("lead_1", LEAD_FORM_INPUT);

    expect(result.success).toBe(true);
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect((timelineInsert?.args[0] as Record<string, unknown>).type).toBe("lead_updated");
  });
});

describe("supabaseLeadsRepository.updateLeadStatus", () => {
  it("rejects an illegal transition", async () => {
    const { client } = createMockSupabase([{ data: leadRow({ status: "archived" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseLeadsRepository.updateLeadStatus("lead_1", "qualified");
    expect(result.success).toBe(false);
  });

  it("updates status and records status_changed with from/to metadata", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: leadRow({ status: "contacted" }), error: null },
      { data: leadRow({ status: "qualified" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseLeadsRepository.updateLeadStatus("lead_1", "qualified");

    expect(result.success).toBe(true);
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    const payload = timelineInsert?.args[0] as Record<string, unknown>;
    expect(payload.type).toBe("status_changed");
    expect(payload.metadata).toEqual({ from: "contacted", to: "qualified" });
  });
});

describe("supabaseLeadsRepository.archiveLead", () => {
  it("fails when already archived", async () => {
    const { client } = createMockSupabase([{ data: leadRow({ status: "archived" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseLeadsRepository.archiveLead("lead_1");
    expect(result.success).toBe(false);
  });

  it("fails when converted", async () => {
    const { client } = createMockSupabase([{ data: leadRow({ status: "converted" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseLeadsRepository.archiveLead("lead_1");
    expect(result.success).toBe(false);
  });

  it("sets status=archived and stamps archived_at, then records lead_archived", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: leadRow({ status: "qualified" }), error: null },
      { data: leadRow({ status: "archived", archived_at: "2026-07-16T00:00:00Z" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseLeadsRepository.archiveLead("lead_1");

    expect(result.success).toBe(true);
    const updateCall = calls.find((c) => c.table === "leads" && c.method === "update");
    const payload = updateCall?.args[0] as Record<string, unknown>;
    expect(payload.status).toBe("archived");
    expect(typeof payload.archived_at).toBe("string");
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect((timelineInsert?.args[0] as Record<string, unknown>).type).toBe("lead_archived");
  });
});

describe("supabaseLeadsRepository.markWelcomeGuideSent", () => {
  it("fails for a terminal (converted/archived) lead", async () => {
    const { client } = createMockSupabase([{ data: leadRow({ status: "archived" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseLeadsRepository.markWelcomeGuideSent("lead_1");
    expect(result.success).toBe(false);
  });

  it("advances status from new to welcome_guide_sent", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: leadRow({ status: "new" }), error: null },
      { data: leadRow({ status: "welcome_guide_sent" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseLeadsRepository.markWelcomeGuideSent("lead_1");

    expect(result.success).toBe(true);
    const updateCall = calls.find((c) => c.table === "leads" && c.method === "update");
    expect((updateCall?.args[0] as Record<string, unknown>).status).toBe("welcome_guide_sent");
  });

  it("does not advance status from qualified, but still succeeds and logs the timeline entry", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: leadRow({ status: "qualified" }), error: null },
      { data: leadRow({ status: "qualified" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseLeadsRepository.markWelcomeGuideSent("lead_1");

    expect(result.success).toBe(true);
    const updateCall = calls.find((c) => c.table === "leads" && c.method === "update");
    expect((updateCall?.args[0] as Record<string, unknown>).status).toBe("qualified");
  });
});

describe("supabaseLeadsRepository notes", () => {
  it("getNotesByLeadId returns [] when the lead does not exist", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const notes = await supabaseLeadsRepository.getNotesByLeadId("missing");
    expect(notes).toEqual([]);
  });

  it("getNotesByLeadId scopes by workspace_id + owner_type + owner_id and orders pinned-first", async () => {
    const noteRow = {
      id: "note_1",
      workspace_id: "workspace_1",
      owner_type: "lead",
      owner_id: "lead_1",
      title: "Allergy",
      content: "Shellfish allergy",
      category: "allergy",
      priority: "critical",
      is_pinned: true,
      attachments: [],
      created_by: "Amoré Bloom Owner",
      created_at: "2026-07-16T00:00:00Z",
      updated_at: "2026-07-16T00:00:00Z",
    };
    const { client, calls } = createMockSupabase([
      { data: leadRow(), error: null },
      { data: [noteRow], error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const notes = await supabaseLeadsRepository.getNotesByLeadId("lead_1");

    expect(notes).toHaveLength(1);
    expect(notes[0].title).toBe("Allergy");
    const ownerFilters = calls.filter((c) => c.table === "notes" && c.method === "eq");
    expect(ownerFilters.some((c) => c.args[0] === "owner_type" && c.args[1] === "lead")).toBe(true);
    expect(ownerFilters.some((c) => c.args[0] === "owner_id" && c.args[1] === "lead_1")).toBe(true);
  });

  it("createNote fails when the lead is converted", async () => {
    const { client } = createMockSupabase([{ data: leadRow({ status: "converted" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseLeadsRepository.createNote("lead_1", {
      title: "Note",
      content: "Content",
      category: "general",
      priority: "normal",
    });
    expect(result.success).toBe(false);
  });

  it("createNote inserts scoped to the lead's Workspace and records note_added", async () => {
    mockSession();
    const noteRow = {
      id: "note_1",
      workspace_id: "workspace_1",
      owner_type: "lead",
      owner_id: "lead_1",
      title: "Note",
      content: "Content",
      category: "general",
      priority: "normal",
      is_pinned: false,
      attachments: [],
      created_by: "Amoré Bloom Owner",
      created_at: "2026-07-16T00:00:00Z",
      updated_at: "2026-07-16T00:00:00Z",
    };
    const { client, calls } = createMockSupabase([
      { data: leadRow(), error: null },
      { data: noteRow, error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseLeadsRepository.createNote("lead_1", {
      title: "Note",
      content: "Content",
      category: "general",
      priority: "normal",
    });

    expect(result.success).toBe(true);
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect((timelineInsert?.args[0] as Record<string, unknown>).type).toBe("note_added");
  });
});

describe("supabaseLeadsRepository.getTimelineByLeadId", () => {
  it("returns [] when the lead does not exist", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const timeline = await supabaseLeadsRepository.getTimelineByLeadId("missing");
    expect(timeline).toEqual([]);
  });

  it("orders newest-first and scopes by workspace_id + owner_type + owner_id", async () => {
    const activityRow = {
      id: "activity_1",
      workspace_id: "workspace_1",
      owner_type: "lead",
      owner_id: "lead_1",
      type: "lead_created",
      description: "Lead created",
      actor: "Amoré Bloom Owner",
      timestamp: "2026-07-16T00:00:00Z",
      metadata: null,
    };
    const { client, calls } = createMockSupabase([
      { data: leadRow(), error: null },
      { data: [activityRow], error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const timeline = await supabaseLeadsRepository.getTimelineByLeadId("lead_1");

    expect(timeline).toHaveLength(1);
    const orderCall = calls.find((c) => c.table === "timeline_activities" && c.method === "order");
    expect(orderCall?.args).toEqual(["timestamp", { ascending: false }]);
  });
});
