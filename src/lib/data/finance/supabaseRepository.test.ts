import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/auth/workspaceSessionClient", () => ({
  getClientWorkspaceSession: vi.fn(),
}));

import { supabaseFinanceRepository } from "@/lib/data/finance/supabaseRepository";
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
    b.in = chain("in");
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

function invoiceRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "invoice_1",
    workspace_id: "workspace_1",
    client_id: "client_1",
    event_id: null,
    contract_id: null,
    invoice_number: "INV-2026-0001",
    title: "Test Invoice",
    description: null,
    status: "draft",
    issue_date: null,
    due_date: "2026-08-01",
    subtotal_minor: 100000,
    tax_minor: 5000,
    discount_minor: 2000,
    total_minor: 103000,
    paid_minor: 0,
    balance_minor: 103000,
    currency: "USD",
    notes: null,
    sent_at: null,
    viewed_at: null,
    paid_at: null,
    overdue_at: null,
    voided_at: null,
    archived_at: null,
    created_at: "2026-07-20T00:00:00Z",
    updated_at: "2026-07-20T00:00:00Z",
    ...overrides,
  };
}

function paymentRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "payment_1",
    workspace_id: "workspace_1",
    invoice_id: "invoice_1",
    client_id: "client_1",
    event_id: null,
    contract_id: null,
    payment_type: "deposit",
    status: "succeeded",
    amount_minor: 50000,
    currency: "USD",
    payment_method: "cash",
    reference: null,
    transaction_date: "2026-07-20",
    received_at: "2026-07-20T00:00:00Z",
    failed_at: null,
    refunded_at: null,
    notes: null,
    document_id: null,
    created_at: "2026-07-20T00:00:00Z",
    updated_at: "2026-07-20T00:00:00Z",
    ...overrides,
  };
}

function expenseRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "expense_1",
    workspace_id: "workspace_1",
    event_id: null,
    client_id: "client_1",
    contract_id: null,
    supplier_id: null,
    team_member_id: null,
    category: "flowers",
    status: "planned",
    description: "Test expense",
    amount_minor: 10000,
    currency: "USD",
    transaction_date: "2026-07-20",
    due_date: null,
    paid_at: null,
    reimbursable: false,
    reimbursed_at: null,
    reference: null,
    notes: null,
    document_id: null,
    created_at: "2026-07-20T00:00:00Z",
    updated_at: "2026-07-20T00:00:00Z",
    archived_at: null,
    ...overrides,
  };
}

const INVOICE_INPUT = {
  client_id: "client_1",
  event_id: null,
  contract_id: null,
  title: "Test Invoice",
  description: null,
  issue_date: null,
  due_date: "2026-08-01",
  subtotal_minor: 100000,
  tax_minor: 5000,
  discount_minor: 2000,
  currency: "USD",
  notes: null,
};

const PAYMENT_INPUT = {
  invoice_id: "invoice_1",
  client_id: "client_1",
  event_id: null,
  contract_id: null,
  payment_type: "deposit" as const,
  amount_minor: 50000,
  currency: "USD",
  payment_method: "cash" as const,
  reference: null,
  transaction_date: "2026-07-20",
  notes: null,
};

const EXPENSE_INPUT = {
  event_id: null,
  client_id: "client_1",
  contract_id: null,
  supplier_id: null,
  team_member_id: null,
  category: "flowers" as const,
  description: "Test expense",
  amount_minor: 10000,
  currency: "USD",
  transaction_date: "2026-07-20",
  due_date: null,
  reimbursable: false,
  reference: null,
  notes: null,
};

afterEach(() => {
  vi.clearAllMocks();
});

function mockSession() {
  vi.mocked(getClientWorkspaceSession).mockResolvedValue(SESSION as never);
}

describe("supabaseFinanceRepository.getInvoices", () => {
  it("scopes the query to the current Workspace", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([{ data: [invoiceRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const invoices = await supabaseFinanceRepository.getInvoices();
    expect(invoices).toHaveLength(1);
    expect(calls.some((c) => c.table === "invoices" && c.method === "eq" && c.args[0] === "workspace_id" && c.args[1] === "workspace_1")).toBe(true);
  });
});

describe("supabaseFinanceRepository.getInvoiceById", () => {
  it("throws NotFoundError when the row is invisible (RLS)", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseFinanceRepository.getInvoiceById("nope")).rejects.toThrow("was not found");
  });
});

describe("supabaseFinanceRepository.createInvoice — numbering and retries", () => {
  it("rejects an unknown client", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.createInvoice(INVOICE_INPUT);
    expect(result.success).toBe(false);
  });

  it("generates an invoice_number via RPC, inserts, and logs a timeline entry", async () => {
    mockSession();
    const { client, calls, rpcCalls } = createMockSupabase([
      { data: clientRow(), error: null }, // client lookup
      { data: "INV-2026-0001", error: null }, // generate_invoice_number rpc
      { data: invoiceRow(), error: null }, // insert
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.createInvoice(INVOICE_INPUT);
    expect(result.success).toBe(true);
    expect(rpcCalls[0].name).toBe("generate_invoice_number");

    const insertCall = calls.find((c) => c.table === "invoices" && c.method === "insert");
    const insertPayload = insertCall?.args[0] as { invoice_number: string; status: string };
    expect(insertPayload.invoice_number).toBe("INV-2026-0001");
    expect(insertPayload.status).toBe("draft");

    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    const timelinePayload = timelineInsert?.args[0] as { owner_type: string; type: string };
    expect(timelinePayload.owner_type).toBe("invoice");
    expect(timelinePayload.type).toBe("invoice_created");
  });

  it("retries with a fresh number on a unique-violation and succeeds on the second attempt", async () => {
    mockSession();
    const { client, rpcCalls } = createMockSupabase([
      { data: clientRow(), error: null }, // client lookup
      { data: "INV-2026-0001", error: null }, // first generated number
      { data: null, error: { code: "23505", message: "duplicate key" } }, // insert collides
      { data: "INV-2026-0002", error: null }, // second generated number
      { data: invoiceRow({ invoice_number: "INV-2026-0002" }), error: null }, // insert succeeds
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.createInvoice(INVOICE_INPUT);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.invoice_number).toBe("INV-2026-0002");
    expect(rpcCalls).toHaveLength(2);
  });
});

describe("supabaseFinanceRepository.updateInvoice", () => {
  it("blocks edits once terminal", async () => {
    const { client } = createMockSupabase([{ data: invoiceRow({ status: "voided" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.updateInvoice("invoice_1", INVOICE_INPUT);
    expect(result.success).toBe(false);
  });

  it("rejects changing client_id", async () => {
    const { client } = createMockSupabase([{ data: invoiceRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.updateInvoice("invoice_1", {
      ...INVOICE_INPUT,
      client_id: "client_2",
    });
    expect(result.success).toBe(false);
  });

  it("recomputes total_minor/balance_minor and updates", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: invoiceRow(), error: null }, // fetch existing
      { data: invoiceRow({ total_minor: 200000, balance_minor: 200000 }), error: null }, // update
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.updateInvoice("invoice_1", {
      ...INVOICE_INPUT,
      subtotal_minor: 200000,
      tax_minor: 0,
      discount_minor: 0,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.total_minor).toBe(200000);

    const updateCall = calls.find((c) => c.table === "invoices" && c.method === "update");
    const payload = updateCall?.args[0] as { total_minor: number; balance_minor: number };
    expect(payload.total_minor).toBe(200000);
    expect(payload.balance_minor).toBe(200000);
  });
});

describe("supabaseFinanceRepository Invoice lifecycle actions", () => {
  it("issueInvoice fails from a non-draft status", async () => {
    const { client } = createMockSupabase([{ data: invoiceRow({ status: "issued" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.issueInvoice("invoice_1");
    expect(result.success).toBe(false);
  });

  it("issueInvoice succeeds from draft and logs invoice_issued", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: invoiceRow(), error: null },
      { data: invoiceRow({ status: "issued", issue_date: "2026-07-20" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.issueInvoice("invoice_1");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("issued");

    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    const payload = timelineInsert?.args[0] as { type: string };
    expect(payload.type).toBe("invoice_issued");
  });

  it("sendInvoice fails when the invoice hasn't been issued", async () => {
    const { client } = createMockSupabase([{ data: invoiceRow({ status: "draft" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.sendInvoice("invoice_1");
    expect(result.success).toBe(false);
  });

  it("voidInvoice succeeds from draft", async () => {
    mockSession();
    const { client } = createMockSupabase([
      { data: invoiceRow(), error: null },
      { data: invoiceRow({ status: "voided", voided_at: "2026-07-20T01:00:00Z" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.voidInvoice("invoice_1");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("voided");
  });

  it("archiveInvoice then restoreInvoice resets status to draft", async () => {
    mockSession();
    const archiveHarness = createMockSupabase([
      { data: invoiceRow(), error: null },
      { data: invoiceRow({ status: "archived", archived_at: "2026-07-20T02:00:00Z" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(archiveHarness.client as never);
    const archived = await supabaseFinanceRepository.archiveInvoice("invoice_1");
    expect(archived.success).toBe(true);
    if (archived.success) expect(archived.data.status).toBe("archived");

    const restoreHarness = createMockSupabase([
      { data: invoiceRow({ status: "archived", archived_at: "2026-07-20T02:00:00Z" }), error: null },
      { data: invoiceRow({ status: "draft", archived_at: null }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(restoreHarness.client as never);
    const restored = await supabaseFinanceRepository.restoreInvoice("invoice_1");
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data.status).toBe("draft");
      expect(restored.data.archived_at).toBeNull();
    }
  });
});

describe("supabaseFinanceRepository.duplicateInvoice", () => {
  it("generates a new number via RPC and creates an independent Invoice", async () => {
    mockSession();
    const { client, rpcCalls } = createMockSupabase([
      { data: invoiceRow(), error: null }, // fetch existing
      { data: "INV-2026-0099", error: null }, // generate number
      { data: invoiceRow({ id: "invoice_2", invoice_number: "INV-2026-0099" }), error: null }, // insert
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.duplicateInvoice("invoice_1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe("invoice_2");
      expect(result.data.invoice_number).toBe("INV-2026-0099");
    }
    expect(rpcCalls[0].name).toBe("generate_invoice_number");
  });
});

describe("supabaseFinanceRepository.createPayment", () => {
  it("rejects a succeeded payment that would exceed the linked invoice's balance_minor", async () => {
    const { client } = createMockSupabase([
      { data: clientRow(), error: null }, // client lookup
      { data: invoiceRow({ balance_minor: 10000 }), error: null }, // linked invoice lookup
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.createPayment({
      ...PAYMENT_INPUT,
      amount_minor: 50000,
      payment_method: "cash",
    });
    expect(result.success).toBe(false);
  });

  it("a succeeded payment linked to an invoice calls recompute_invoice_balance", async () => {
    mockSession();
    const { client, rpcCalls } = createMockSupabase([
      { data: clientRow(), error: null }, // client lookup
      { data: invoiceRow({ balance_minor: 100000 }), error: null }, // linked invoice lookup
      { data: paymentRow(), error: null }, // insert
      { data: null, error: null }, // timeline insert
      { data: null, error: null }, // recompute_invoice_balance rpc
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.createPayment({
      ...PAYMENT_INPUT,
      amount_minor: 50000,
      payment_method: "cash",
    });
    expect(result.success).toBe(true);
    expect(rpcCalls.some((c) => c.name === "recompute_invoice_balance")).toBe(true);
  });

  it("a pending payment (non-immediate method) doesn't call recompute_invoice_balance", async () => {
    mockSession();
    const { client, rpcCalls } = createMockSupabase([
      { data: clientRow(), error: null }, // client lookup
      { data: invoiceRow({ balance_minor: 100000 }), error: null }, // linked invoice lookup
      { data: paymentRow({ status: "pending", received_at: null }), error: null }, // insert
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.createPayment({
      ...PAYMENT_INPUT,
      amount_minor: 50000,
      payment_method: "credit_card",
    });
    expect(result.success).toBe(true);
    expect(rpcCalls).toHaveLength(0);
  });
});

describe("supabaseFinanceRepository.markPaymentSucceeded", () => {
  it("re-checks overpayment against the linked invoice's current balance", async () => {
    const { client } = createMockSupabase([
      { data: paymentRow({ status: "pending", amount_minor: 50000 }), error: null }, // fetch payment
      { data: invoiceRow({ balance_minor: 10000 }), error: null }, // linked invoice lookup
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.markPaymentSucceeded("payment_1");
    expect(result.success).toBe(false);
  });

  it("succeeds and calls recompute_invoice_balance", async () => {
    mockSession();
    const { client, rpcCalls } = createMockSupabase([
      { data: paymentRow({ status: "pending", amount_minor: 50000 }), error: null }, // fetch payment
      { data: invoiceRow({ balance_minor: 100000 }), error: null }, // linked invoice lookup
      { data: paymentRow({ status: "succeeded" }), error: null }, // update
      { data: null, error: null }, // timeline insert
      { data: null, error: null }, // recompute_invoice_balance rpc
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.markPaymentSucceeded("payment_1");
    expect(result.success).toBe(true);
    expect(rpcCalls.some((c) => c.name === "recompute_invoice_balance")).toBe(true);
  });
});

describe("supabaseFinanceRepository.refundPayment", () => {
  it("calls process_payment_refund then recompute_invoice_balance, in order, for an invoice-linked payment", async () => {
    mockSession();
    const { client, rpcCalls } = createMockSupabase([
      { data: paymentRow({ status: "succeeded" }), error: null }, // fetch original payment
      { data: paymentRow({ id: "payment_2", payment_type: "refund", amount_minor: 20000 }), error: null }, // process_payment_refund rpc
      { data: null, error: null }, // recompute_invoice_balance rpc
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.refundPayment("payment_1", 20000);
    expect(result.success).toBe(true);
    expect(rpcCalls.map((c) => c.name)).toEqual(["process_payment_refund", "recompute_invoice_balance"]);
  });

  it("does not call recompute_invoice_balance when the original payment has no linked invoice", async () => {
    mockSession();
    const { client, rpcCalls } = createMockSupabase([
      { data: paymentRow({ status: "succeeded", invoice_id: null }), error: null }, // fetch original payment
      { data: paymentRow({ id: "payment_2", payment_type: "refund", invoice_id: null, amount_minor: 20000 }), error: null }, // process_payment_refund rpc
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.refundPayment("payment_1", 20000);
    expect(result.success).toBe(true);
    expect(rpcCalls.map((c) => c.name)).toEqual(["process_payment_refund"]);
  });

  it("translates a P0004 (excess refund) RPC error into a DataResult failure rather than throwing", async () => {
    mockSession();
    const { client, rpcCalls } = createMockSupabase([
      { data: paymentRow({ status: "succeeded" }), error: null }, // fetch original payment
      { data: null, error: { code: "P0004", message: "Cannot refund more than the refundable amount (10000 minor units remaining)." } }, // process_payment_refund rpc
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.refundPayment("payment_1", 50000);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe("Cannot refund more than the refundable amount (10000 minor units remaining).");
    expect(rpcCalls.map((c) => c.name)).toEqual(["process_payment_refund"]);
  });

  it("rejects a payment that isn't refundable before ever calling the RPC", async () => {
    const { client, rpcCalls } = createMockSupabase([{ data: paymentRow({ status: "failed" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.refundPayment("payment_1", 1000);
    expect(result.success).toBe(false);
    expect(rpcCalls).toHaveLength(0);
  });
});

describe("supabaseFinanceRepository.getPaymentRefundableAmount", () => {
  it("sums prior refunds via the reference = 'refund_of:{id}' convention", async () => {
    const { client, calls } = createMockSupabase([
      { data: paymentRow({ status: "succeeded", amount_minor: 100000 }), error: null }, // fetch payment
      { data: [{ amount_minor: 30000, status: "succeeded" }], error: null }, // refunds lookup
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const refundable = await supabaseFinanceRepository.getPaymentRefundableAmount("payment_1");
    expect(refundable).toBe(70000);

    const refundsLookup = calls.find((c) => c.table === "payments" && c.method === "eq" && c.args[0] === "reference");
    expect(refundsLookup?.args[1]).toBe("refund_of:payment_1");
  });

  it("returns 0 for a payment that isn't refundable", async () => {
    const { client } = createMockSupabase([{ data: paymentRow({ status: "failed" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const refundable = await supabaseFinanceRepository.getPaymentRefundableAmount("payment_1");
    expect(refundable).toBe(0);
  });
});

describe("supabaseFinanceRepository.createExpense / updateExpense — Event/Contract must belong to Client", () => {
  it("rejects an event that doesn't belong to the selected client", async () => {
    const { client } = createMockSupabase([{ data: { client_id: "client_2" }, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.createExpense({
      ...EXPENSE_INPUT,
      client_id: "client_1",
      event_id: "event_1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a contract that doesn't belong to the selected client", async () => {
    const { client } = createMockSupabase([{ data: { client_id: "client_2" }, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.createExpense({
      ...EXPENSE_INPUT,
      client_id: "client_1",
      contract_id: "contract_1",
    });
    expect(result.success).toBe(false);
  });

  it("creates an expense with a null client_id and no consistency checks required", async () => {
    mockSession();
    const { client } = createMockSupabase([
      { data: expenseRow({ client_id: null }), error: null }, // insert
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.createExpense({ ...EXPENSE_INPUT, client_id: null });
    expect(result.success).toBe(true);
  });

  it("updateExpense rejects an event/client mismatch", async () => {
    const { client } = createMockSupabase([
      { data: expenseRow(), error: null }, // fetch existing
      { data: { client_id: "client_2" }, error: null }, // event lookup
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.updateExpense("expense_1", {
      ...EXPENSE_INPUT,
      client_id: "client_1",
      event_id: "event_1",
    });
    expect(result.success).toBe(false);
  });
});

describe("supabaseFinanceRepository Expense lifecycle", () => {
  it("approveExpense succeeds from planned and logs expense_approved", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: expenseRow(), error: null },
      { data: expenseRow({ status: "approved" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.approveExpense("expense_1");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("approved");

    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    const payload = timelineInsert?.args[0] as { type: string };
    expect(payload.type).toBe("expense_approved");
  });

  it("markExpenseReimbursed fails when the expense isn't reimbursable", async () => {
    const { client } = createMockSupabase([{ data: expenseRow({ status: "paid", reimbursable: false }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.markExpenseReimbursed("expense_1");
    expect(result.success).toBe(false);
  });
});

describe("supabaseFinanceRepository.getPayments / getExpenses workspace isolation", () => {
  it("getPayments scopes the query to the current Workspace", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([{ data: [paymentRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const payments = await supabaseFinanceRepository.getPayments();
    expect(payments).toHaveLength(1);
    expect(calls.some((c) => c.table === "payments" && c.method === "eq" && c.args[0] === "workspace_id" && c.args[1] === "workspace_1")).toBe(true);
  });

  it("getExpenses scopes the query to the current Workspace", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([{ data: [expenseRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const expenses = await supabaseFinanceRepository.getExpenses();
    expect(expenses).toHaveLength(1);
    expect(calls.some((c) => c.table === "expenses" && c.method === "eq" && c.args[0] === "workspace_id" && c.args[1] === "workspace_1")).toBe(true);
  });
});

describe("supabaseFinanceRepository Notes and Timeline", () => {
  it("creates an invoice note and logs note_added against owner_type invoice", async () => {
    mockSession();
    const noteRow = {
      id: "note_1",
      workspace_id: "workspace_1",
      owner_type: "invoice",
      owner_id: "invoice_1",
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
      { data: invoiceRow(), error: null }, // fetch invoice
      { data: noteRow, error: null }, // insert note
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.createInvoiceNote("invoice_1", {
      title: "Deposit received",
      content: "Confirmed via Zelle.",
      category: "general",
      priority: "normal",
    });
    expect(result.success).toBe(true);

    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    const payload = timelineInsert?.args[0] as { type: string; owner_type: string };
    expect(payload.type).toBe("note_added");
    expect(payload.owner_type).toBe("invoice");
  });

  it("togglePinInvoiceNote returns null when the note row isn't found", async () => {
    mockSession();
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.togglePinInvoiceNote("note_x");
    expect(result).toBeNull();
  });
});
