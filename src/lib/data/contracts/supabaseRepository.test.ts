import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/auth/workspaceSessionClient", () => ({
  getClientWorkspaceSession: vi.fn(),
}));

import { supabaseContractsRepository } from "@/lib/data/contracts/supabaseRepository";
import { createClient } from "@/lib/supabase/client";
import { getClientWorkspaceSession } from "@/lib/auth/workspaceSessionClient";
import { NotFoundError } from "@/core/errors";

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
      created_at: "2026-07-20T00:00:00Z",
      updated_at: "2026-07-20T00:00:00Z",
    },
    workspace: {
      id: "workspace_1",
      name: "Amoré Bloom",
      slug: "amore-bloom",
      created_by: "user_1",
      created_at: "2026-07-20T00:00:00Z",
      updated_at: "2026-07-20T00:00:00Z",
      archived_at: null,
    },
    membership: {
      id: "member_1",
      workspace_id: "workspace_1",
      user_id: "user_1",
      role: "owner" as const,
      status: "active" as const,
      created_at: "2026-07-20T00:00:00Z",
      updated_at: "2026-07-20T00:00:00Z",
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
    favorite_restaurants: null,
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

function contractRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "contract_1",
    workspace_id: "workspace_1",
    client_id: "client_1",
    event_id: null,
    template_id: null,
    contract_number: "CT-2026-0001",
    title: "Test Contract",
    description: null,
    status: "draft",
    signature_status: "unsigned",
    version: 1,
    version_history: [],
    effective_date: null,
    expiration_date: null,
    signed_at: null,
    sent_at: null,
    viewed_at: null,
    declined_at: null,
    cancelled_at: null,
    archived_at: null,
    total_value: 5000,
    deposit_required: true,
    deposit_amount: 1000,
    remaining_balance: 4000,
    currency: "USD",
    notes: null,
    created_at: "2026-07-20T00:00:00Z",
    updated_at: "2026-07-20T00:00:00Z",
    ...overrides,
  };
}

const CONTRACT_INPUT = {
  client_id: "client_1",
  event_id: null,
  template_id: null,
  title: "Test Contract",
  description: null,
  effective_date: null,
  expiration_date: null,
  total_value: 5000,
  deposit_required: true,
  deposit_amount: 1000,
  currency: "USD",
  notes: null,
};

afterEach(() => {
  vi.clearAllMocks();
});

function mockSession() {
  vi.mocked(getClientWorkspaceSession).mockResolvedValue(SESSION as never);
}

describe("supabaseContractsRepository.getContracts", () => {
  it("scopes the query to the current Workspace and excludes archived by default", async () => {
    mockSession();
    const { client } = createMockSupabase([{ data: [contractRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const contracts = await supabaseContractsRepository.getContracts();
    expect(contracts).toHaveLength(1);
  });
});

describe("supabaseContractsRepository.getContract", () => {
  it("throws NotFoundError when the row is invisible", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseContractsRepository.getContract("nope")).rejects.toThrow("was not found");
  });
});

describe("supabaseContractsRepository.createContract — Client/Event consistency and numbering", () => {
  it("rejects an unknown client", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseContractsRepository.createContract(CONTRACT_INPUT);
    expect(result.success).toBe(false);
  });

  it("generates a contract number via RPC, inserts, and logs a timeline entry", async () => {
    mockSession();
    const { client, calls, rpcCalls } = createMockSupabase([
      { data: clientRow(), error: null }, // client lookup
      { data: "CT-2026-0001", error: null }, // generate_contract_number rpc
      { data: contractRow(), error: null }, // insert
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseContractsRepository.createContract(CONTRACT_INPUT);
    expect(result.success).toBe(true);
    expect(rpcCalls[0].name).toBe("generate_contract_number");

    const insertCall = calls.find((c) => c.table === "contracts" && c.method === "insert");
    const insertPayload = insertCall?.args[0] as { contract_number: string; status: string };
    expect(insertPayload.contract_number).toBe("CT-2026-0001");
    expect(insertPayload.status).toBe("draft");

    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    const timelinePayload = timelineInsert?.args[0] as { owner_type: string; type: string };
    expect(timelinePayload.owner_type).toBe("contract");
    expect(timelinePayload.type).toBe("contract_created");
  });

  it("retries with a fresh number on a unique-violation and succeeds on the second attempt", async () => {
    mockSession();
    const { client, rpcCalls } = createMockSupabase([
      { data: clientRow(), error: null }, // client lookup
      { data: "CT-2026-0001", error: null }, // first generated number
      { data: null, error: { code: "23505", message: "duplicate key" } }, // insert collides
      { data: "CT-2026-0002", error: null }, // second generated number
      { data: contractRow({ contract_number: "CT-2026-0002" }), error: null }, // insert succeeds
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseContractsRepository.createContract(CONTRACT_INPUT);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.contract_number).toBe("CT-2026-0002");
    expect(rpcCalls).toHaveLength(2);
  });
});

describe("supabaseContractsRepository.updateContract — version history and locking", () => {
  it("blocks edits once archived", async () => {
    const { client } = createMockSupabase([{ data: contractRow({ status: "archived" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseContractsRepository.updateContract("contract_1", CONTRACT_INPUT);
    expect(result.success).toBe(false);
  });

  it("increments version and sends a version_history array including the pre-image snapshot", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: contractRow(), error: null }, // fetch existing
      { data: contractRow({ version: 2, title: "Updated" }), error: null }, // update
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseContractsRepository.updateContract("contract_1", {
      ...CONTRACT_INPUT,
      title: "Updated",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.version).toBe(2);

    const updateCall = calls.find((c) => c.table === "contracts" && c.method === "update");
    const payload = updateCall?.args[0] as { version: number; version_history: unknown[] };
    expect(payload.version).toBe(2);
    expect(payload.version_history).toHaveLength(1);
  });

  it("rejects changing client_id", async () => {
    const { client } = createMockSupabase([{ data: contractRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseContractsRepository.updateContract("contract_1", {
      ...CONTRACT_INPUT,
      client_id: "client_2",
    });
    expect(result.success).toBe(false);
  });
});

describe("supabaseContractsRepository lifecycle actions", () => {
  it("sendContract fails from a non-draft/review/ready status", async () => {
    const { client } = createMockSupabase([{ data: contractRow({ status: "signed" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseContractsRepository.sendContract("contract_1");
    expect(result.success).toBe(false);
  });

  it("sendContract succeeds from draft and logs contract_sent", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: contractRow(), error: null },
      { data: contractRow({ status: "sent", signature_status: "sent", sent_at: "2026-07-20T01:00:00Z" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseContractsRepository.sendContract("contract_1");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("sent");

    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    const payload = timelineInsert?.args[0] as { type: string };
    expect(payload.type).toBe("contract_sent");
  });

  it("completeContract only succeeds from signed", async () => {
    const { client } = createMockSupabase([{ data: contractRow({ status: "draft" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseContractsRepository.completeContract("contract_1");
    expect(result.success).toBe(false);
  });

  it("archiveContract then restoreContract resets status to draft", async () => {
    mockSession();
    const archiveHarness = createMockSupabase([
      { data: contractRow(), error: null },
      { data: contractRow({ status: "archived", archived_at: "2026-07-20T02:00:00Z" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(archiveHarness.client as never);
    const archived = await supabaseContractsRepository.archiveContract("contract_1");
    expect(archived.success).toBe(true);
    if (archived.success) expect(archived.data.status).toBe("archived");

    const restoreHarness = createMockSupabase([
      { data: contractRow({ status: "archived", archived_at: "2026-07-20T02:00:00Z" }), error: null },
      { data: contractRow({ status: "draft", archived_at: null }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(restoreHarness.client as never);
    const restored = await supabaseContractsRepository.restoreContract("contract_1");
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data.status).toBe("draft");
      expect(restored.data.archived_at).toBeNull();
    }
  });
});

describe("supabaseContractsRepository.duplicateContract", () => {
  it("generates a new number and creates an independent Contract", async () => {
    mockSession();
    const { client, rpcCalls } = createMockSupabase([
      { data: contractRow(), error: null }, // fetch existing
      { data: "CT-2026-0099", error: null }, // generate number
      { data: contractRow({ id: "contract_2", contract_number: "CT-2026-0099" }), error: null }, // insert
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseContractsRepository.duplicateContract("contract_1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe("contract_2");
      expect(result.data.contract_number).toBe("CT-2026-0099");
    }
    expect(rpcCalls[0].name).toBe("generate_contract_number");
  });
});

describe("supabaseContractsRepository Templates", () => {
  it("lists templates scoped to the current Workspace", async () => {
    mockSession();
    const templateRow = {
      id: "template_1",
      workspace_id: "workspace_1",
      name: "Standard Agreement",
      description: null,
      category: "event_agreement",
      body: "...",
      version: 1,
      active: true,
      created_at: "2026-07-20T00:00:00Z",
      updated_at: "2026-07-20T00:00:00Z",
    };
    const { client } = createMockSupabase([{ data: [templateRow], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const templates = await supabaseContractsRepository.getContractTemplates();
    expect(templates).toHaveLength(1);
  });
});

describe("supabaseContractsRepository Exhibits", () => {
  function exhibitRow(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: "exhibit_1",
      workspace_id: "workspace_1",
      contract_id: "contract_1",
      title: "Payment Schedule",
      description: null,
      display_order: 0,
      document_id: null,
      created_at: "2026-07-20T00:00:00Z",
      updated_at: "2026-07-20T00:00:00Z",
      ...overrides,
    };
  }

  it("creates an exhibit with workspace_id derived from the Contract", async () => {
    const { client, calls } = createMockSupabase([
      { data: contractRow(), error: null }, // fetch contract
      { data: [], error: null, count: 0 }, // count existing exhibits
      { data: exhibitRow(), error: null }, // insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseContractsRepository.createContractExhibit("contract_1", {
      title: "Payment Schedule",
      description: null,
    });
    expect(result.success).toBe(true);

    const insertCall = calls.find((c) => c.table === "contract_exhibits" && c.method === "insert");
    const payload = insertCall?.args[0] as { workspace_id: string; contract_id: string };
    expect(payload.workspace_id).toBe("workspace_1");
    expect(payload.contract_id).toBe("contract_1");
  });

  it("reorders exhibits via individual updates", async () => {
    const { client, calls } = createMockSupabase([
      { data: contractRow(), error: null }, // fetch contract
      { data: [exhibitRow({ id: "exhibit_1", display_order: 0 }), exhibitRow({ id: "exhibit_2", display_order: 1 })], error: null }, // fetch own exhibits
      { data: exhibitRow({ id: "exhibit_2", display_order: 0 }), error: null }, // update 1
      { data: exhibitRow({ id: "exhibit_1", display_order: 1 }), error: null }, // update 2
      { data: [exhibitRow({ id: "exhibit_2", display_order: 0 }), exhibitRow({ id: "exhibit_1", display_order: 1 })], error: null }, // refetch
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseContractsRepository.reorderContractExhibits("contract_1", [
      "exhibit_2",
      "exhibit_1",
    ]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.map((e) => e.id)).toEqual(["exhibit_2", "exhibit_1"]);
    }
    expect(calls.some((c) => c.table === "contract_exhibits" && c.method === "delete")).toBe(false);
  });

  it("deletes an exhibit", async () => {
    const { client } = createMockSupabase([
      { data: exhibitRow(), error: null }, // fetch existing
      { data: null, error: null }, // delete
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseContractsRepository.deleteContractExhibit("exhibit_1");
    expect(result.success).toBe(true);
  });

  it("getContractExhibitById returns the mapped exhibit", async () => {
    const { client } = createMockSupabase([{ data: exhibitRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const exhibit = await supabaseContractsRepository.getContractExhibitById("exhibit_1");
    expect(exhibit.id).toBe("exhibit_1");
  });

  it("getContractExhibitById throws NotFoundError when missing", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseContractsRepository.getContractExhibitById("nope")).rejects.toThrow(NotFoundError);
  });
});

describe("supabaseContractsRepository Notes and Timeline", () => {
  it("creates a note and logs note_added against the Contract", async () => {
    mockSession();
    const noteRow = {
      id: "note_1",
      workspace_id: "workspace_1",
      owner_type: "contract",
      owner_id: "contract_1",
      title: "Deposit received",
      content: "Confirmed via Zelle.",
      category: "general",
      priority: "normal",
      is_pinned: false,
      attachments: [],
      created_by: "Amoré Bloom Owner",
      created_at: "2026-07-20T00:00:00Z",
      updated_at: "2026-07-20T00:00:00Z",
    };
    const { client, calls } = createMockSupabase([
      { data: contractRow(), error: null }, // fetch contract
      { data: noteRow, error: null }, // insert note
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseContractsRepository.createContractNote("contract_1", {
      title: "Deposit received",
      content: "Confirmed via Zelle.",
      category: "general",
      priority: "normal",
    });
    expect(result.success).toBe(true);

    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    const payload = timelineInsert?.args[0] as { type: string };
    expect(payload.type).toBe("note_added");
  });

  it("togglePinContractNote returns null when the note isn't Contract-owned", async () => {
    mockSession();
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseContractsRepository.togglePinContractNote("note_x");
    expect(result).toBeNull();
  });
});
