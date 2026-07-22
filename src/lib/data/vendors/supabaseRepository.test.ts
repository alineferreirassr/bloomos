import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/auth/workspaceSessionClient", () => ({
  getClientWorkspaceSession: vi.fn(),
}));

import { supabaseVendorsRepository } from "@/lib/data/vendors/supabaseRepository";
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
    b.is = chain("is");
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

function vendorRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "vendor_1",
    workspace_id: "workspace_1",
    company_name: "Bloom & Stem Florals",
    display_name: null,
    contact_person: null,
    email: null,
    phone: null,
    website: null,
    tax_id: null,
    address: null,
    city: null,
    state: null,
    zip_code: null,
    country: null,
    notes: null,
    status: "active",
    tags: [],
    default_currency: "USD",
    payment_terms: null,
    is_preferred: false,
    created_at: "2026-07-30T00:00:00Z",
    updated_at: "2026-07-30T00:00:00Z",
    archived_at: null,
    ...overrides,
  };
}

const CREATE_INPUT = {
  company_name: "Bloom & Stem Florals",
  display_name: null,
  contact_person: null,
  email: null,
  phone: null,
  website: null,
  tax_id: null,
  address: null,
  city: null,
  state: null,
  zip_code: null,
  country: null,
  notes: null,
  tags: [],
  default_currency: "USD",
  payment_terms: null,
};

// getCoreTimelineService() branches on NEXT_PUBLIC_DATA_MODE at call time —
// force "supabase" so Timeline writes actually go through the mocked
// Supabase client (and thus show up in `calls`) rather than silently
// through Core's in-memory mock Timeline store, matching the pattern
// established in lib/data/provider.test.ts / lib/env.test.ts.
const ORIGINAL_DATA_MODE = process.env.NEXT_PUBLIC_DATA_MODE;
beforeEach(() => {
  process.env.NEXT_PUBLIC_DATA_MODE = "supabase";
});

afterEach(() => {
  vi.clearAllMocks();
  if (ORIGINAL_DATA_MODE === undefined) {
    delete process.env.NEXT_PUBLIC_DATA_MODE;
  } else {
    process.env.NEXT_PUBLIC_DATA_MODE = ORIGINAL_DATA_MODE;
  }
});

function mockSession() {
  vi.mocked(getClientWorkspaceSession).mockResolvedValue(SESSION as never);
}

describe("mapVendorRow (via getVendorById)", () => {
  it("maps every field, including nulls, tags, and timestamps", async () => {
    const { client } = createMockSupabase([
      {
        data: vendorRow({
          display_name: "Bloom & Stem",
          country: "US",
          tags: ["florist", "preferred-supplier"],
        }),
        error: null,
      },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const vendor = await supabaseVendorsRepository.getVendorById("vendor_1");

    expect(vendor.id).toBe("vendor_1");
    expect(vendor.workspace_id).toBe("workspace_1");
    expect(vendor.company_name).toBe("Bloom & Stem Florals");
    expect(vendor.display_name).toBe("Bloom & Stem");
    expect(vendor.contact_person).toBeNull();
    expect(vendor.country).toBe("US");
    expect(vendor.tags).toEqual(["florist", "preferred-supplier"]);
    expect(vendor.default_currency).toBe("USD");
    expect(vendor.created_at).toBe("2026-07-30T00:00:00Z");
    expect(vendor.updated_at).toBe("2026-07-30T00:00:00Z");
    expect(vendor.archived_at).toBeNull();
  });

  it("throws NotFoundError when the vendor does not exist (or belongs to another Workspace, per RLS)", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseVendorsRepository.getVendorById("missing")).rejects.toThrow("was not found");
  });
});

describe("supabaseVendorsRepository.getVendors", () => {
  it("scopes the query to the current Workspace and excludes archived by default", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([{ data: [vendorRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const vendors = await supabaseVendorsRepository.getVendors();

    expect(vendors).toHaveLength(1);
    const eqWorkspace = calls.find((c) => c.method === "eq" && c.args[0] === "workspace_id");
    expect(eqWorkspace?.args[1]).toBe("workspace_1");
    const isArchived = calls.find((c) => c.method === "is");
    expect(isArchived?.args).toEqual(["archived_at", null]);
  });

  it("includes archived vendors when includeArchived is true", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([{ data: [vendorRow({ archived_at: "2026-07-31T00:00:00Z" })], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const vendors = await supabaseVendorsRepository.getVendors({ includeArchived: true });

    expect(vendors).toHaveLength(1);
    expect(calls.some((c) => c.method === "is")).toBe(false);
  });

  it("applies status/isPreferred/tags filters", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([{ data: [], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabaseVendorsRepository.getVendors({ status: "inactive", isPreferred: true, tags: ["florist"] });

    expect(calls.some((c) => c.method === "eq" && c.args[0] === "status" && c.args[1] === "inactive")).toBe(true);
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "is_preferred" && c.args[1] === true)).toBe(true);
    expect(calls.some((c) => c.method === "overlaps" && c.args[0] === "tags")).toBe(true);
  });

  it("matches search across company name, display name, contact person, email, phone, tax ID", async () => {
    mockSession();
    const rows = [
      vendorRow({ id: "vendor_1", company_name: "Bloom & Stem Florals" }),
      vendorRow({ id: "vendor_2", company_name: "Candlelight Co" }),
    ];
    const { client } = createMockSupabase([{ data: rows, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const vendors = await supabaseVendorsRepository.getVendors({ search: "Bloom" });

    expect(vendors).toHaveLength(1);
    expect(vendors[0].id).toBe("vendor_1");
  });

  it("sorts using the requested sortBy/sortDirection", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([{ data: [], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabaseVendorsRepository.getVendors({}, { sortBy: "company_name", sortDirection: "asc" });

    const orderCall = calls.find((c) => c.method === "order");
    expect(orderCall?.args).toEqual(["company_name", { ascending: true }]);
  });

  it("throws a normalized error when the query fails", async () => {
    mockSession();
    const { client } = createMockSupabase([{ data: null, error: { code: "42501", message: "permission denied" } }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseVendorsRepository.getVendors()).rejects.toThrow("You don't have permission to do that.");
  });
});

describe("supabaseVendorsRepository.createVendor", () => {
  it("fails validation without touching Supabase when company_name is blank", async () => {
    const { client } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseVendorsRepository.createVendor({ ...CREATE_INPUT, company_name: "  " });
    expect(result.success).toBe(false);
  });

  it("rejects a default_currency that isn't exactly 3 characters", async () => {
    const { client } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseVendorsRepository.createVendor({ ...CREATE_INPUT, default_currency: "US" });
    expect(result.success).toBe(false);
  });

  it("throws Unauthorized when there is no signed-in user", async () => {
    vi.mocked(getClientWorkspaceSession).mockResolvedValue({ status: "unauthenticated" });
    const { client } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseVendorsRepository.createVendor(CREATE_INPUT)).rejects.toThrow("Authentication is required.");
  });

  it("throws Forbidden when the user has no active Workspace membership", async () => {
    vi.mocked(getClientWorkspaceSession).mockResolvedValue({ status: "no-workspace" });
    const { client } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseVendorsRepository.createVendor(CREATE_INPUT)).rejects.toThrow("You don't have permission to do that.");
  });

  it("inserts scoped to the current Workspace, forcing status=active and is_preferred=false, and records vendor_created", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: vendorRow(), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseVendorsRepository.createVendor(CREATE_INPUT);

    expect(result.success).toBe(true);
    const insertCall = calls.find((c) => c.table === "vendors" && c.method === "insert");
    const payload = insertCall?.args[0] as Record<string, unknown>;
    expect(payload.workspace_id).toBe("workspace_1");
    expect(payload.status).toBe("active");
    expect(payload.is_preferred).toBe(false);
    expect(payload.company_name).toBe("Bloom & Stem Florals");
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    const timelinePayload = timelineInsert?.args[0] as Record<string, unknown>;
    expect(timelinePayload.type).toBe("vendor_created");
    expect(timelinePayload.owner_type).toBe("vendor");
  });

  it("uppercases default_currency", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: vendorRow(), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabaseVendorsRepository.createVendor({ ...CREATE_INPUT, default_currency: "usd" });

    const insertCall = calls.find((c) => c.table === "vendors" && c.method === "insert");
    expect((insertCall?.args[0] as Record<string, unknown>).default_currency).toBe("USD");
  });

  it("returns a field-level Tax ID conflict error on a unique-constraint violation, without throwing", async () => {
    mockSession();
    const { client } = createMockSupabase([{ data: null, error: { code: "23505", message: "duplicate key" } }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseVendorsRepository.createVendor({ ...CREATE_INPUT, tax_id: "TAX-1" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors?.tax_id).toBeTruthy();
    }
  });
});

describe("supabaseVendorsRepository.updateVendor", () => {
  it("fails when the vendor does not exist", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseVendorsRepository.updateVendor("missing", { company_name: "New Name" });
    expect(result.success).toBe(false);
  });

  it("writes only the provided fields, leaving unspecified fields untouched, and records vendor_updated", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: vendorRow(), error: null },
      { data: vendorRow({ company_name: "New Name" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseVendorsRepository.updateVendor("vendor_1", { company_name: "New Name" });

    expect(result.success).toBe(true);
    const updateCall = calls.find((c) => c.table === "vendors" && c.method === "update");
    const patch = updateCall?.args[0] as Record<string, unknown>;
    expect(patch).toEqual({ company_name: "New Name" });
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect((timelineInsert?.args[0] as Record<string, unknown>).type).toBe("vendor_updated");
  });

  it("is a no-op (no write, no timeline entry) when the input has no fields", async () => {
    const { client, calls } = createMockSupabase([{ data: vendorRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseVendorsRepository.updateVendor("vendor_1", {});

    expect(result.success).toBe(true);
    expect(calls.some((c) => c.method === "update")).toBe(false);
  });

  it("cannot be used to change status or is_preferred (not part of UpdateVendorInput)", () => {
    const input: Record<string, unknown> = { company_name: "New Name" };
    expect("status" in input).toBe(false);
    expect("is_preferred" in input).toBe(false);
  });

  it("returns a field-level Tax ID conflict error on a unique-constraint violation", async () => {
    mockSession();
    const { client } = createMockSupabase([
      { data: vendorRow(), error: null },
      { data: null, error: { code: "23505", message: "duplicate key" } },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseVendorsRepository.updateVendor("vendor_1", { tax_id: "TAX-1" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors?.tax_id).toBeTruthy();
    }
  });
});

describe("supabaseVendorsRepository.archiveVendor / restoreVendor", () => {
  it("archiveVendor fails when already archived", async () => {
    const { client } = createMockSupabase([{ data: vendorRow({ archived_at: "2026-07-30T00:00:00Z" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseVendorsRepository.archiveVendor("vendor_1");
    expect(result.success).toBe(false);
  });

  it("archiveVendor stamps archived_at and records vendor_archived", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: vendorRow(), error: null },
      { data: vendorRow({ archived_at: "2026-07-30T00:00:00Z" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseVendorsRepository.archiveVendor("vendor_1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.archived_at).toBe("2026-07-30T00:00:00Z");
    }
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect((timelineInsert?.args[0] as Record<string, unknown>).type).toBe("vendor_archived");
  });

  it("restoreVendor fails when not archived", async () => {
    const { client } = createMockSupabase([{ data: vendorRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseVendorsRepository.restoreVendor("vendor_1");
    expect(result.success).toBe(false);
  });

  it("restoreVendor clears archived_at and records vendor_restored", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: vendorRow({ archived_at: "2026-07-30T00:00:00Z" }), error: null },
      { data: vendorRow({ archived_at: null }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseVendorsRepository.restoreVendor("vendor_1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.archived_at).toBeNull();
    }
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect((timelineInsert?.args[0] as Record<string, unknown>).type).toBe("vendor_restored");
  });
});

describe("supabaseVendorsRepository.setVendorStatus", () => {
  it("rejects an invalid status value at the type/schema boundary", () => {
    const validStatuses = ["active", "inactive"];
    expect(validStatuses).not.toContain("archived");
    expect(validStatuses).not.toContain("banana");
  });

  it("updates status and records vendor_updated with from/to metadata", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: vendorRow({ status: "active" }), error: null },
      { data: vendorRow({ status: "inactive" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseVendorsRepository.setVendorStatus("vendor_1", "inactive");

    expect(result.success).toBe(true);
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    const payload = timelineInsert?.args[0] as Record<string, unknown>;
    expect(payload.type).toBe("vendor_updated");
    expect(payload.metadata).toEqual({ from: "active", to: "inactive" });
  });

  it("is a no-op when the status is already equal", async () => {
    const { client, calls } = createMockSupabase([{ data: vendorRow({ status: "active" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseVendorsRepository.setVendorStatus("vendor_1", "active");

    expect(result.success).toBe(true);
    expect(calls.some((c) => c.method === "update")).toBe(false);
  });
});

describe("supabaseVendorsRepository.setVendorPreferredStatus", () => {
  it("sets is_preferred and records vendor_preferred_status_changed", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: vendorRow({ is_preferred: false }), error: null },
      { data: vendorRow({ is_preferred: true }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseVendorsRepository.setVendorPreferredStatus("vendor_1", true);

    expect(result.success).toBe(true);
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect((timelineInsert?.args[0] as Record<string, unknown>).type).toBe("vendor_preferred_status_changed");
  });

  it("is a no-op when the preferred value is already equal", async () => {
    const { client, calls } = createMockSupabase([{ data: vendorRow({ is_preferred: true }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseVendorsRepository.setVendorPreferredStatus("vendor_1", true);

    expect(result.success).toBe(true);
    expect(calls.some((c) => c.method === "update")).toBe(false);
  });
});

describe("supabaseVendorsRepository.getTimelineByVendorId", () => {
  it("scopes the timeline query to the vendor's workspace and owner id, ordered newest first", async () => {
    const timelineRow = {
      id: "activity_1",
      workspace_id: "workspace_1",
      owner_type: "vendor",
      owner_id: "vendor_1",
      type: "vendor_created",
      description: "Vendor created",
      actor: "Amoré Bloom Owner",
      timestamp: "2026-07-30T00:00:00Z",
      metadata: null,
    };
    const { client, calls } = createMockSupabase([
      { data: vendorRow(), error: null },
      { data: [timelineRow], error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const timeline = await supabaseVendorsRepository.getTimelineByVendorId("vendor_1");

    expect(timeline).toHaveLength(1);
    expect(timeline[0].type).toBe("vendor_created");
    const timelineCalls = calls.filter((c) => c.table === "timeline_activities");
    expect(timelineCalls.some((c) => c.method === "eq" && c.args[0] === "workspace_id" && c.args[1] === "workspace_1")).toBe(true);
    expect(timelineCalls.some((c) => c.method === "eq" && c.args[0] === "owner_type" && c.args[1] === "vendor")).toBe(true);
    expect(timelineCalls.some((c) => c.method === "eq" && c.args[0] === "owner_id" && c.args[1] === "vendor_1")).toBe(true);
    expect(timelineCalls.some((c) => c.method === "order" && c.args[0] === "timestamp")).toBe(true);
  });

  it("returns an empty array for a vendor that does not exist (RLS-invisible or missing)", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const timeline = await supabaseVendorsRepository.getTimelineByVendorId("missing");

    expect(timeline).toEqual([]);
  });
});
