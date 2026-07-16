import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/auth/workspaceSessionClient", () => ({
  getClientWorkspaceSession: vi.fn(),
}));

import { supabaseClientsRepository } from "@/lib/data/clients/supabaseRepository";
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
    b.overlaps = chain("overlaps");
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

const CLIENT_FORM_INPUT = {
  first_name: "Naomi",
  last_name: "Whitfield",
  email: "naomi@example.com",
  phone: "",
  instagram: "",
  partner_name: "",
  relationship_status: "",
  address: "",
  city: "",
  state: "",
  zip_code: "",
  source: "",
  important_dates: [],
  how_they_met: "",
  first_date: "",
  relationship_anniversary: "",
  engagement_date: "",
  wedding_date: "",
  favorite_colors: "",
  favorite_flowers: "",
  favorite_music: "",
  favorite_food: "",
  favorite_drinks: "",
  preferred_style: "",
  disliked_elements: "",
  allergies: "",
  accessibility_needs: "",
  dietary_restrictions: "",
  preferred_communication_time: "",
  do_not_call: false,
  surprise_event_confidentiality: false,
  emergency_contact_name: "",
  emergency_contact_phone: "",
};

afterEach(() => {
  vi.clearAllMocks();
});

function mockSession() {
  vi.mocked(getClientWorkspaceSession).mockResolvedValue(SESSION as never);
}

describe("supabaseClientsRepository.getClients", () => {
  it("scopes the query to the current Workspace and excludes archived by default", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([{ data: [clientRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const clients = await supabaseClientsRepository.getClients();

    expect(clients).toHaveLength(1);
    const eqWorkspace = calls.find((c) => c.method === "eq" && c.args[0] === "workspace_id");
    expect(eqWorkspace?.args[1]).toBe("workspace_1");
    const neqArchived = calls.find((c) => c.method === "neq");
    expect(neqArchived?.args).toEqual(["internal_status", "archived"]);
  });

  it("includes archived clients when includeArchived is true", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([{ data: [clientRow({ internal_status: "archived" })], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const clients = await supabaseClientsRepository.getClients({ includeArchived: true });

    expect(clients).toHaveLength(1);
    expect(calls.some((c) => c.method === "neq")).toBe(false);
  });

  it("applies status/source/vipOnly/tags filters", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([{ data: [], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabaseClientsRepository.getClients({
      status: "planning",
      source: "Referral",
      vipOnly: true,
      tags: ["repeat-client"],
    });

    expect(calls.some((c) => c.method === "eq" && c.args[0] === "internal_status" && c.args[1] === "planning")).toBe(true);
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "source" && c.args[1] === "Referral")).toBe(true);
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "is_vip" && c.args[1] === true)).toBe(true);
    expect(calls.some((c) => c.method === "overlaps" && c.args[0] === "tags")).toBe(true);
  });

  it("matches search across first name, last name, email, phone, partner name combined", async () => {
    mockSession();
    const rows = [
      clientRow({ id: "client_1", first_name: "Naomi", last_name: "Whitfield" }),
      clientRow({ id: "client_2", first_name: "Jordan", last_name: "Ellis" }),
    ];
    const { client } = createMockSupabase([{ data: rows, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const clients = await supabaseClientsRepository.getClients({ search: "Naomi Whitfield" });

    expect(clients).toHaveLength(1);
    expect(clients[0].id).toBe("client_1");
  });

  it("throws a normalized error when the query fails", async () => {
    mockSession();
    const { client } = createMockSupabase([{ data: null, error: { code: "42501", message: "permission denied" } }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseClientsRepository.getClients()).rejects.toThrow("You don't have permission to do that.");
  });
});

describe("supabaseClientsRepository.getClientById", () => {
  it("returns the mapped client when found", async () => {
    const { client } = createMockSupabase([{ data: clientRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const found = await supabaseClientsRepository.getClientById("client_1");
    expect(found.id).toBe("client_1");
    expect(found.first_name).toBe("Naomi");
  });

  it("throws NotFoundError when the client does not exist (or belongs to another Workspace, per RLS)", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseClientsRepository.getClientById("missing")).rejects.toThrow("was not found");
  });
});

describe("supabaseClientsRepository.createClient", () => {
  it("returns a validation failure without touching Supabase when input is invalid", async () => {
    const { client } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseClientsRepository.createClient({ ...CLIENT_FORM_INPUT, first_name: "" });
    expect(result.success).toBe(false);
  });

  it("throws Unauthorized when there is no signed-in user", async () => {
    vi.mocked(getClientWorkspaceSession).mockResolvedValue({ status: "unauthenticated" });
    const { client } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseClientsRepository.createClient(CLIENT_FORM_INPUT)).rejects.toThrow(
      "Authentication is required.",
    );
  });

  it("throws Forbidden when the user has no active Workspace membership", async () => {
    vi.mocked(getClientWorkspaceSession).mockResolvedValue({ status: "no-workspace" });
    const { client } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseClientsRepository.createClient(CLIENT_FORM_INPUT)).rejects.toThrow(
      "You don't have permission to do that.",
    );
  });

  it("inserts the client scoped to the current Workspace with originating_lead_id null and records client_created", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: clientRow(), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseClientsRepository.createClient(CLIENT_FORM_INPUT);

    expect(result.success).toBe(true);
    const insertCall = calls.find((c) => c.table === "clients" && c.method === "insert");
    const payload = insertCall?.args[0] as Record<string, unknown>;
    expect(payload.workspace_id).toBe("workspace_1");
    expect(payload.originating_lead_id).toBeNull();
    expect(payload.internal_status).toBe("active");
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect((timelineInsert?.args[0] as Record<string, unknown>).type).toBe("client_created");
    expect((timelineInsert?.args[0] as Record<string, unknown>).owner_type).toBe("client");
  });
});

describe("supabaseClientsRepository.updateClient", () => {
  it("fails when the client does not exist", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseClientsRepository.updateClient("missing", CLIENT_FORM_INPUT);
    expect(result.success).toBe(false);
  });

  it("updates the row and records a client_updated timeline entry on success", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: clientRow(), error: null },
      { data: clientRow({ first_name: "Naomi-Updated" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseClientsRepository.updateClient("client_1", CLIENT_FORM_INPUT);

    expect(result.success).toBe(true);
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect((timelineInsert?.args[0] as Record<string, unknown>).type).toBe("client_updated");
  });
});

describe("supabaseClientsRepository.updateClientStatus", () => {
  it("updates internal_status and records status_changed with from/to metadata", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: clientRow({ internal_status: "active" }), error: null },
      { data: clientRow({ internal_status: "planning" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseClientsRepository.updateClientStatus("client_1", "planning");

    expect(result.success).toBe(true);
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    const payload = timelineInsert?.args[0] as Record<string, unknown>;
    expect(payload.type).toBe("status_changed");
    expect(payload.metadata).toEqual({ from: "active", to: "planning" });
  });
});

describe("supabaseClientsRepository.updateClientTags", () => {
  it("updates tags and records tags_changed", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: clientRow(), error: null },
      { data: clientRow({ tags: ["vip"] }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseClientsRepository.updateClientTags("client_1", ["vip"]);

    expect(result.success).toBe(true);
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect((timelineInsert?.args[0] as Record<string, unknown>).type).toBe("tags_changed");
  });
});

describe("supabaseClientsRepository.setClientVipStatus", () => {
  it("sets is_vip and records vip_status_changed", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: clientRow(), error: null },
      { data: clientRow({ is_vip: true }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseClientsRepository.setClientVipStatus("client_1", true);

    expect(result.success).toBe(true);
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect((timelineInsert?.args[0] as Record<string, unknown>).type).toBe("vip_status_changed");
  });
});

describe("supabaseClientsRepository.updateClientContactPreference", () => {
  it("sets preferred_contact_method and records communication_preference_changed", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: clientRow(), error: null },
      { data: clientRow({ preferred_contact_method: "whatsapp" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseClientsRepository.updateClientContactPreference("client_1", "whatsapp");

    expect(result.success).toBe(true);
    const updateCall = calls.find((c) => c.table === "clients" && c.method === "update");
    expect((updateCall?.args[0] as Record<string, unknown>).preferred_contact_method).toBe("whatsapp");
  });
});

describe("supabaseClientsRepository.archiveClient / restoreClient", () => {
  it("archiveClient fails when already archived", async () => {
    const { client } = createMockSupabase([{ data: clientRow({ archived_at: "2026-07-17T00:00:00Z" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseClientsRepository.archiveClient("client_1");
    expect(result.success).toBe(false);
  });

  it("archiveClient sets internal_status=archived and stamps archived_at, then records client_archived", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: clientRow(), error: null },
      { data: clientRow({ internal_status: "archived", archived_at: "2026-07-17T00:00:00Z" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseClientsRepository.archiveClient("client_1");

    expect(result.success).toBe(true);
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect((timelineInsert?.args[0] as Record<string, unknown>).type).toBe("client_archived");
  });

  it("restoreClient fails when not archived", async () => {
    const { client } = createMockSupabase([{ data: clientRow({ archived_at: null }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseClientsRepository.restoreClient("client_1");
    expect(result.success).toBe(false);
  });

  it("restoreClient clears archived_at and sets internal_status=active, then records client_restored", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: clientRow({ internal_status: "archived", archived_at: "2026-07-17T00:00:00Z" }), error: null },
      { data: clientRow({ internal_status: "active", archived_at: null }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseClientsRepository.restoreClient("client_1");

    expect(result.success).toBe(true);
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect((timelineInsert?.args[0] as Record<string, unknown>).type).toBe("client_restored");
  });
});

describe("supabaseClientsRepository notes", () => {
  it("getNotesByClientId returns [] when the client does not exist", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const notes = await supabaseClientsRepository.getNotesByClientId("missing");
    expect(notes).toEqual([]);
  });

  it("getNotesByClientId scopes by workspace_id + owner_type='client' + owner_id and orders pinned-first", async () => {
    const noteRow = {
      id: "note_1",
      workspace_id: "workspace_1",
      owner_type: "client",
      owner_id: "client_1",
      title: "Prefers champagne",
      content: "Loves Aperol spritz too",
      category: "preference",
      priority: "normal",
      is_pinned: true,
      attachments: [],
      created_by: "Amoré Bloom Owner",
      created_at: "2026-07-17T00:00:00Z",
      updated_at: "2026-07-17T00:00:00Z",
    };
    const { client, calls } = createMockSupabase([
      { data: clientRow(), error: null },
      { data: [noteRow], error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const notes = await supabaseClientsRepository.getNotesByClientId("client_1");

    expect(notes).toHaveLength(1);
    const ownerFilters = calls.filter((c) => c.table === "notes" && c.method === "eq");
    expect(ownerFilters.some((c) => c.args[0] === "owner_type" && c.args[1] === "client")).toBe(true);
    expect(ownerFilters.some((c) => c.args[0] === "owner_id" && c.args[1] === "client_1")).toBe(true);
  });

  it("createClientNote fails when the client does not exist", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseClientsRepository.createClientNote("missing", {
      title: "Note",
      content: "Content",
      category: "general",
      priority: "normal",
    });
    expect(result.success).toBe(false);
  });

  it("createClientNote inserts scoped to the client's Workspace and records note_added", async () => {
    mockSession();
    const noteRow = {
      id: "note_1",
      workspace_id: "workspace_1",
      owner_type: "client",
      owner_id: "client_1",
      title: "Note",
      content: "Content",
      category: "general",
      priority: "normal",
      is_pinned: false,
      attachments: [],
      created_by: "Amoré Bloom Owner",
      created_at: "2026-07-17T00:00:00Z",
      updated_at: "2026-07-17T00:00:00Z",
    };
    const { client, calls } = createMockSupabase([
      { data: clientRow(), error: null },
      { data: noteRow, error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseClientsRepository.createClientNote("client_1", {
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

function clientNoteRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "note_1",
    workspace_id: "workspace_1",
    owner_type: "client",
    owner_id: "client_1",
    title: "Prefers champagne",
    content: "Loves Aperol spritz too",
    category: "preference",
    priority: "normal",
    is_pinned: false,
    attachments: [],
    created_by: "Amoré Bloom Owner",
    created_at: "2026-07-17T00:00:00Z",
    updated_at: "2026-07-17T00:00:00Z",
    ...overrides,
  };
}

describe("supabaseClientsRepository.togglePinClientNote", () => {
  it("pins an unpinned Client-owned note and records a note_pinned timeline entry", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: clientNoteRow({ is_pinned: false }), error: null },
      { data: clientNoteRow({ is_pinned: true }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseClientsRepository.togglePinClientNote("note_1");

    expect(result).not.toBeNull();
    expect(result?.success).toBe(true);
    if (!result || !result.success) throw new Error("expected success");
    expect(result.data.is_pinned).toBe(true);

    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    const payload = timelineInsert?.args[0] as Record<string, unknown>;
    expect(payload.type).toBe("note_pinned");
    expect(payload.owner_type).toBe("client");
    expect(payload.owner_id).toBe("client_1");
  });

  it("unpins a pinned Client-owned note and records a note_unpinned timeline entry", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: clientNoteRow({ is_pinned: true }), error: null },
      { data: clientNoteRow({ is_pinned: false }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseClientsRepository.togglePinClientNote("note_1");

    expect(result?.success).toBe(true);
    if (!result || !result.success) throw new Error("expected success");
    expect(result.data.is_pinned).toBe(false);
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect((timelineInsert?.args[0] as Record<string, unknown>).type).toBe("note_unpinned");
  });

  it("returns null when no note matches this Workspace (cross-Workspace note is invisible, not an error)", async () => {
    mockSession();
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseClientsRepository.togglePinClientNote("note_in_other_workspace");
    expect(result).toBeNull();
  });

  it("returns null when the note is not Client-owned (e.g. a Lead note), leaving it for leadsRepository/the generic mock path", async () => {
    mockSession();
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseClientsRepository.togglePinClientNote("lead_note_1");
    expect(result).toBeNull();
  });

  it("throws Unauthorized when there is no signed-in user", async () => {
    vi.mocked(getClientWorkspaceSession).mockResolvedValue({ status: "unauthenticated" });
    const { client } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseClientsRepository.togglePinClientNote("note_1")).rejects.toThrow(
      "Authentication is required.",
    );
  });
});

describe("supabaseClientsRepository.getTimelineByClientId", () => {
  it("returns [] when the client does not exist", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const timeline = await supabaseClientsRepository.getTimelineByClientId("missing");
    expect(timeline).toEqual([]);
  });

  it("orders newest-first and scopes by workspace_id + owner_type='client' + owner_id", async () => {
    const activityRow = {
      id: "activity_1",
      workspace_id: "workspace_1",
      owner_type: "client",
      owner_id: "client_1",
      type: "client_created",
      description: "Client created",
      actor: "Amoré Bloom Owner",
      timestamp: "2026-07-17T00:00:00Z",
      metadata: null,
    };
    const { client, calls } = createMockSupabase([
      { data: clientRow(), error: null },
      { data: [activityRow], error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const timeline = await supabaseClientsRepository.getTimelineByClientId("client_1");

    expect(timeline).toHaveLength(1);
    const orderCall = calls.find((c) => c.table === "timeline_activities" && c.method === "order");
    expect(orderCall?.args).toEqual(["timestamp", { ascending: false }]);
  });
});

describe("supabaseClientsRepository.getClientNextAction", () => {
  it("recommends adding a phone number first, mirroring the mock's priority order", async () => {
    const { client } = createMockSupabase([
      { data: clientRow({ phone: null }), error: null },
      { data: clientRow({ phone: null }), error: null },
      { data: [], error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const action = await supabaseClientsRepository.getClientNextAction("client_1");
    expect(action).toBe("Add a phone number for this client");
  });

  it("returns null for an archived client", async () => {
    const { client } = createMockSupabase([
      { data: clientRow({ archived_at: "2026-07-17T00:00:00Z" }), error: null },
      { data: clientRow({ archived_at: "2026-07-17T00:00:00Z" }), error: null },
      { data: [], error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const action = await supabaseClientsRepository.getClientNextAction("client_1");
    expect(action).toBeNull();
  });
});
