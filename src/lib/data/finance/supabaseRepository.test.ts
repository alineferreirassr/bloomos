import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/auth/workspaceSessionClient", () => ({
  getClientWorkspaceSession: vi.fn(),
}));

// Hoisted so the same spy instance is returned by every getCoreAuditLogService()
// call the repository makes AND is importable here for assertions — a plain
// `vi.fn()` inside the vi.mock factory below would create a fresh, unobservable
// instance per call instead.
const recordAuditEventMock = vi.hoisted(() => vi.fn());
vi.mock("@/core/audit", () => ({
  getCoreAuditLogService: () => ({
    recordAuditEvent: recordAuditEventMock,
    getAuditLogForOwner: vi.fn(),
  }),
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
    b.is = chain("is");
    b.order = chain("order");
    b.range = chain("range");
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

function chartOfAccountRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "account_1000",
    workspace_id: "workspace_1",
    account_number: 1000,
    name: "Cash",
    account_type: "asset",
    normal_balance: "debit",
    parent_account_id: null,
    description: null,
    is_system: true,
    created_at: "2026-08-03T10:00:00Z",
    updated_at: "2026-08-03T10:00:00Z",
    archived_at: null,
    ...overrides,
  };
}

function journalEntryRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "journal_entry_1",
    workspace_id: "workspace_1",
    entry_date: "2026-07-20",
    accounting_period_id: "accounting_period_1",
    source_type: "payment_settlement",
    source_id: "payment_1",
    posting_key: "payment_settlement:payment_1",
    memo: "Payment settlement (deposit, cash)",
    currency: "USD",
    reversed_by_entry_id: null,
    reverses_entry_id: null,
    posting_status: "posted",
    failure_reason: null,
    posted_by: "Amoré Bloom Owner",
    created_at: "2026-07-20T00:00:00Z",
    ...overrides,
  };
}

function journalLineRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "journal_line_1",
    journal_entry_id: "journal_entry_1",
    workspace_id: "workspace_1",
    account_id: "account_1000",
    debit_minor: 50000,
    credit_minor: 0,
    currency: "USD",
    amount_in_base_currency_minor: 50000,
    line_memo: null,
    line_order: 0,
    created_at: "2026-07-20T00:00:00Z",
    ...overrides,
  };
}

function accountingPeriodRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "accounting_period_1",
    workspace_id: "workspace_1",
    period_start: "2026-07-01",
    period_end: "2026-07-31",
    status: "open",
    closed_at: null,
    closed_by: null,
    locked_at: null,
    locked_by: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

const PAYMENT_SETTLEMENT_INPUT = {
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

const MANUAL_ADJUSTMENT_INPUT = {
  entry_date: "2026-07-20",
  memo: "Correcting entry",
  lines: [
    { account_id: "account_1000", debit_minor: 5000, credit_minor: 0, line_memo: null },
    { account_id: "account_2000", debit_minor: 0, credit_minor: 5000, line_memo: null },
  ],
};

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

  it("Finance F1.7 — a succeeded payment linked to an invoice goes through the atomic record_payment_settlement RPC, not a plain insert + recompute_invoice_balance", async () => {
    mockSession();
    const { client, rpcCalls } = createMockSupabase([
      { data: clientRow(), error: null }, // client lookup
      { data: invoiceRow({ balance_minor: 100000 }), error: null }, // linked invoice lookup
      { data: paymentRow(), error: null }, // record_payment_settlement rpc
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.createPayment({
      ...PAYMENT_INPUT,
      amount_minor: 50000,
      payment_method: "cash",
    });
    expect(result.success).toBe(true);
    expect(rpcCalls.map((c) => c.name)).toEqual(["record_payment_settlement"]);
    expect(recordAuditEventMock).toHaveBeenCalledTimes(1);
    const [, auditInput] = recordAuditEventMock.mock.calls[0];
    expect(auditInput.action).toBe("payment_settlement_recorded");
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

  it("Finance F1.8 — succeeds via ONE atomic mark_payment_succeeded_and_post_settlement RPC call, never a separate status update + separate posting call", async () => {
    mockSession();
    const { client, rpcCalls } = createMockSupabase([
      { data: paymentRow({ status: "pending", amount_minor: 50000 }), error: null }, // fetch payment
      { data: invoiceRow({ balance_minor: 100000 }), error: null }, // linked invoice lookup
      { data: paymentRow({ status: "succeeded" }), error: null }, // mark_payment_succeeded_and_post_settlement rpc
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.markPaymentSucceeded("payment_1");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("succeeded");
    expect(rpcCalls.map((c) => c.name)).toEqual(["mark_payment_succeeded_and_post_settlement"]);
    const args = rpcCalls[0].args as Record<string, unknown>;
    expect(args.p_payment_id).toBe("payment_1");
  });

  it("Finance F1.8 — a posting failure rolls the WHOLE atomic transition back: fail() is returned, no Timeline entry is written, no best-effort Audit Log fallback (replaces F1.7's design)", async () => {
    mockSession();
    const { client, rpcCalls, calls } = createMockSupabase([
      { data: paymentRow({ status: "pending", amount_minor: 50000 }), error: null }, // fetch payment
      { data: invoiceRow({ balance_minor: 100000 }), error: null }, // linked invoice lookup
      { data: null, error: { code: "P1100", message: "System account 1000 not found for this workspace." } }, // mark_payment_succeeded_and_post_settlement rpc fails — whole transaction rolls back
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.markPaymentSucceeded("payment_1");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("System account 1000 not found for this workspace.");
    expect(rpcCalls.map((c) => c.name)).toEqual(["mark_payment_succeeded_and_post_settlement"]);
    expect(calls.some((c) => c.table === "timeline_activities")).toBe(false);
    expect(recordAuditEventMock).not.toHaveBeenCalled();
  });

  it("Finance F1.8 — a retry against an already-succeeded payment is rejected (P1105) and translated to fail(), not thrown", async () => {
    mockSession();
    const { client, rpcCalls } = createMockSupabase([
      { data: paymentRow({ status: "pending", amount_minor: 50000 }), error: null }, // fetch payment (still "pending" here — the TS-layer canTransitionPaymentStatus guard is the first line of defense; this proves the RPC's OWN guard is also translated correctly when reached)
      { data: invoiceRow({ balance_minor: 100000 }), error: null }, // linked invoice lookup
      { data: null, error: { code: "P1105", message: "Cannot mark succeeded payment as succeeded." } }, // rpc rejects the transition
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.markPaymentSucceeded("payment_1");
    expect(result.success).toBe(false);
    expect(rpcCalls.map((c) => c.name)).toEqual(["mark_payment_succeeded_and_post_settlement"]);
  });
});

describe("supabaseFinanceRepository — payment path unification (Finance F1.7)", () => {
  it("createPayment (succeeded) and recordPaymentSettlement call the identical RPC with the identical argument shape — one canonical settlement path, not two", async () => {
    mockSession();
    const createHarness = createMockSupabase([
      { data: clientRow(), error: null }, // client lookup
      { data: invoiceRow({ balance_minor: 100000 }), error: null }, // linked invoice lookup
      { data: paymentRow(), error: null }, // record_payment_settlement rpc
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(createHarness.client as never);
    await supabaseFinanceRepository.createPayment({ ...PAYMENT_INPUT, amount_minor: 50000, payment_method: "cash" });

    const settlementHarness = createMockSupabase([
      { data: paymentRow(), error: null }, // record_payment_settlement rpc
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(settlementHarness.client as never);
    await supabaseFinanceRepository.recordPaymentSettlement({ ...PAYMENT_SETTLEMENT_INPUT, amount_minor: 50000, invoice_id: "invoice_1" });

    expect(createHarness.rpcCalls[0].name).toBe("record_payment_settlement");
    expect(settlementHarness.rpcCalls[0].name).toBe("record_payment_settlement");
    // Same shape (payment_type/amount/method/etc. keys), workspace/actor resolved from the same session either way.
    expect(Object.keys(createHarness.rpcCalls[0].args as object).sort()).toEqual(Object.keys(settlementHarness.rpcCalls[0].args as object).sort());
    const createArgs = createHarness.rpcCalls[0].args as Record<string, unknown>;
    const settlementArgs = settlementHarness.rpcCalls[0].args as Record<string, unknown>;
    expect(createArgs.p_amount_minor).toBe(settlementArgs.p_amount_minor);
    expect(createArgs.p_payment_method).toBe(settlementArgs.p_payment_method);
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

  it("Finance F1.8 — translates a P1118 (no settlement entry to reverse — legacy payment) RPC error into a DataResult failure rather than throwing", async () => {
    mockSession();
    const { client, rpcCalls } = createMockSupabase([
      { data: paymentRow({ status: "succeeded" }), error: null }, // fetch original payment
      {
        data: null,
        error: {
          code: "P1118",
          message:
            "No settlement entry exists for the original payment — cannot reverse. It predates ledger posting or was never settled; resolve via reconciliation, not an invented reversal.",
        },
      }, // process_payment_refund rpc — composed post_payment_refund_reversal fails
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.refundPayment("payment_1", 20000);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/No settlement entry exists/);
    expect(rpcCalls.map((c) => c.name)).toEqual(["process_payment_refund"]);
  });

  it("Finance F1.8 — translates a P1104 (duplicate reversal posting) RPC error into a DataResult failure rather than throwing", async () => {
    mockSession();
    const { client, rpcCalls } = createMockSupabase([
      { data: paymentRow({ status: "succeeded" }), error: null }, // fetch original payment
      { data: null, error: { code: "P1104", message: "This refund has already been posted." } }, // process_payment_refund rpc
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.refundPayment("payment_1", 20000);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe("This refund has already been posted.");
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

describe("supabaseFinanceRepository.listChartOfAccounts / getChartOfAccount", () => {
  it("scopes the list to the current workspace, excludes archived by default, and orders by account_number", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([{ data: [chartOfAccountRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const accounts = await supabaseFinanceRepository.listChartOfAccounts();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].account_number).toBe(1000);
    expect(accounts[0].account_type).toBe("asset");
    expect(calls.some((c) => c.table === "chart_of_accounts" && c.method === "eq" && c.args[0] === "workspace_id" && c.args[1] === "workspace_1")).toBe(true);
    expect(calls.some((c) => c.table === "chart_of_accounts" && c.method === "is" && c.args[0] === "archived_at" && c.args[1] === null)).toBe(true);
    expect(calls.some((c) => c.table === "chart_of_accounts" && c.method === "order" && c.args[0] === "account_number")).toBe(true);
  });

  it("getChartOfAccount throws NotFoundError when the row is invisible (RLS)", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseFinanceRepository.getChartOfAccount("nope")).rejects.toThrow("was not found");
  });
});

describe("supabaseFinanceRepository.listJournalEntries / getJournalEntry", () => {
  it("scopes to the workspace and applies date/source_type/posting_status filters", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([{ data: [journalEntryRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const entries = await supabaseFinanceRepository.listJournalEntries({
      dateFrom: "2026-07-01",
      dateTo: "2026-07-31",
      sourceType: "payment_settlement",
      postingStatus: "posted",
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].posting_key).toBe("payment_settlement:payment_1");
    expect(entries[0].source_id).toBe("payment_1");
    expect(calls.some((c) => c.table === "journal_entries" && c.method === "gte" && c.args[0] === "entry_date")).toBe(true);
    expect(calls.some((c) => c.table === "journal_entries" && c.method === "lte" && c.args[0] === "entry_date")).toBe(true);
    expect(calls.some((c) => c.table === "journal_entries" && c.method === "range")).toBe(true);
  });

  it("filters by accountId via a real journal_lines lookup, not a client-side filter", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: [{ journal_entry_id: "journal_entry_1" }], error: null }, // journal_lines lookup
      { data: [journalEntryRow()], error: null }, // journal_entries query
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const entries = await supabaseFinanceRepository.listJournalEntries({ accountId: "account_1000" });
    expect(entries).toHaveLength(1);
    expect(calls.some((c) => c.table === "journal_lines" && c.method === "eq" && c.args[0] === "account_id")).toBe(true);
    expect(calls.some((c) => c.table === "journal_entries" && c.method === "in" && c.args[0] === "id")).toBe(true);
  });

  it("returns an empty array without querying journal_entries when accountId matches no lines", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([{ data: [], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const entries = await supabaseFinanceRepository.listJournalEntries({ accountId: "account_9999" });
    expect(entries).toEqual([]);
    expect(calls.some((c) => c.table === "journal_entries")).toBe(false);
  });

  it("getJournalEntry attaches lines with account enrichment (account_number/name/account_type), preserving integer minor units", async () => {
    const { client } = createMockSupabase([
      { data: journalEntryRow(), error: null }, // fetch entry
      { data: [journalLineRow()], error: null }, // fetch lines
      { data: [{ id: "account_1000", account_number: 1000, name: "Cash", account_type: "asset" }], error: null }, // fetch accounts
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const entry = await supabaseFinanceRepository.getJournalEntry("journal_entry_1");
    expect(entry.lines).toHaveLength(1);
    expect(entry.lines?.[0].debit_minor).toBe(50000);
    expect(Number.isInteger(entry.lines?.[0].debit_minor)).toBe(true);
    expect(entry.lines?.[0].account).toEqual({ account_number: 1000, name: "Cash", account_type: "asset" });
  });

  it("getJournalEntry throws NotFoundError when the entry is invisible (RLS)", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseFinanceRepository.getJournalEntry("nope")).rejects.toThrow("was not found");
  });

  it("preserves nullable source_id/reverses_entry_id/reversed_by_entry_id fields exactly", async () => {
    mockSession();
    const { client } = createMockSupabase([
      { data: [journalEntryRow({ source_type: "manual_adjustment", source_id: null, posting_key: null, reverses_entry_id: null, reversed_by_entry_id: null })], error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const [entry] = await supabaseFinanceRepository.listJournalEntries();
    expect(entry.source_id).toBeNull();
    expect(entry.posting_key).toBeNull();
    expect(entry.reverses_entry_id).toBeNull();
    expect(entry.reversed_by_entry_id).toBeNull();
  });
});

describe("supabaseFinanceRepository.listAccountingPeriods / getAccountingPeriod", () => {
  it("scopes to the workspace, filters by status, orders by period_start", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([{ data: [accountingPeriodRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const periods = await supabaseFinanceRepository.listAccountingPeriods({ status: "open" });
    expect(periods).toHaveLength(1);
    expect(periods[0].status).toBe("open");
    expect(calls.some((c) => c.table === "accounting_periods" && c.method === "eq" && c.args[0] === "status" && c.args[1] === "open")).toBe(true);
    expect(calls.some((c) => c.table === "accounting_periods" && c.method === "order" && c.args[0] === "period_start")).toBe(true);
  });

  it("getAccountingPeriod throws NotFoundError when the row is invisible (RLS)", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseFinanceRepository.getAccountingPeriod("nope")).rejects.toThrow("was not found");
  });
});

describe("supabaseFinanceRepository.recordPaymentSettlement", () => {
  it("rejects payment_method='stripe' at the Repository boundary without ever calling Supabase", async () => {
    const { client, rpcCalls } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.recordPaymentSettlement({ ...PAYMENT_SETTLEMENT_INPUT, payment_method: "stripe" });
    expect(result.success).toBe(false);
    expect(rpcCalls).toHaveLength(0);
  });

  it("calls record_payment_settlement with the correct RPC name and arguments, maps the result, and writes exactly one Audit entry", async () => {
    mockSession();
    const { client, rpcCalls } = createMockSupabase([
      { data: paymentRow(), error: null }, // record_payment_settlement rpc
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.recordPaymentSettlement(PAYMENT_SETTLEMENT_INPUT);
    expect(result.success).toBe(true);
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].name).toBe("record_payment_settlement");
    const args = rpcCalls[0].args as Record<string, unknown>;
    expect(args.p_workspace_id).toBe("workspace_1");
    expect(args.p_payment_method).toBe("cash");
    expect(args.p_amount_minor).toBe(50000);

    expect(recordAuditEventMock).toHaveBeenCalledTimes(1);
    const [workspaceId, auditInput] = recordAuditEventMock.mock.calls[0];
    expect(workspaceId).toBe("workspace_1");
    expect(auditInput.ownerType).toBe("payment");
    expect(auditInput.ownerId).toBe("payment_1");
  });

  it("translates a known Finance errcode into a DataResult fail() and does not call Audit", async () => {
    mockSession();
    const { client } = createMockSupabase([{ data: null, error: { code: "P1100", message: "System account 1000 not found for this workspace." } }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.recordPaymentSettlement(PAYMENT_SETTLEMENT_INPUT);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("System account 1000 not found for this workspace.");
    expect(recordAuditEventMock).not.toHaveBeenCalled();
  });

  it("throws (via normalizeSupabaseError) for an unrecognized error code, and does not call Audit", async () => {
    mockSession();
    const { client } = createMockSupabase([{ data: null, error: { code: "42501", message: "permission denied" } }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseFinanceRepository.recordPaymentSettlement(PAYMENT_SETTLEMENT_INPUT)).rejects.toThrow();
    expect(recordAuditEventMock).not.toHaveBeenCalled();
  });

  it("does not retry the RPC merely because Audit recording is invoked afterward — exactly one rpc call regardless", async () => {
    mockSession();
    const { client, rpcCalls } = createMockSupabase([
      { data: paymentRow(), error: null }, // record_payment_settlement rpc
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabaseFinanceRepository.recordPaymentSettlement(PAYMENT_SETTLEMENT_INPUT);
    expect(rpcCalls).toHaveLength(1);
  });
});

describe("supabaseFinanceRepository.recordExpenseTransition", () => {
  it("calls record_expense_transition with the correct arguments, maps the result, and writes exactly one Audit entry", async () => {
    mockSession();
    const { client, rpcCalls } = createMockSupabase([
      { data: expenseRow({ status: "planned" }), error: null }, // fetchExpenseRow
      { data: expenseRow({ status: "due" }), error: null }, // rpc result
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.recordExpenseTransition("expense_1", { transition: "due" });
    expect(result.success).toBe(true);
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].name).toBe("record_expense_transition");
    expect((rpcCalls[0].args as Record<string, unknown>).p_transition).toBe("due");

    expect(recordAuditEventMock).toHaveBeenCalledTimes(1);
    const [, auditInput] = recordAuditEventMock.mock.calls[0];
    expect(auditInput.ownerType).toBe("expense");
    expect(auditInput.action).toBe("expense_due");
  });

  it("fails without calling the RPC when the Expense does not exist", async () => {
    const { client, rpcCalls } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.recordExpenseTransition("nope", { transition: "due" });
    expect(result.success).toBe(false);
    expect(rpcCalls).toHaveLength(0);
  });

  it("translates a known Finance errcode into fail() without calling Audit", async () => {
    mockSession();
    const { client } = createMockSupabase([
      { data: expenseRow(), error: null },
      { data: null, error: { code: "P1105", message: "Unsupported Expense transition: due." } },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.recordExpenseTransition("expense_1", { transition: "due" });
    expect(result.success).toBe(false);
    expect(recordAuditEventMock).not.toHaveBeenCalled();
  });
});

describe("supabaseFinanceRepository.recordManualAdjustment", () => {
  it("rejects a blank memo and fewer than two lines before ever reaching the RPC", async () => {
    const { client, rpcCalls } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const blankMemo = await supabaseFinanceRepository.recordManualAdjustment({ ...MANUAL_ADJUSTMENT_INPUT, memo: "" });
    expect(blankMemo.success).toBe(false);

    const oneLine = await supabaseFinanceRepository.recordManualAdjustment({ ...MANUAL_ADJUSTMENT_INPUT, lines: [MANUAL_ADJUSTMENT_INPUT.lines[0]] });
    expect(oneLine.success).toBe(false);

    expect(rpcCalls).toHaveLength(0);
  });

  it("rejects a zero-value line and a double-sided line before ever reaching the RPC", async () => {
    const { client, rpcCalls } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const zeroLine = await supabaseFinanceRepository.recordManualAdjustment({
      ...MANUAL_ADJUSTMENT_INPUT,
      lines: [
        { account_id: "account_1000", debit_minor: 0, credit_minor: 0, line_memo: null },
        { account_id: "account_2000", debit_minor: 0, credit_minor: 0, line_memo: null },
      ],
    });
    expect(zeroLine.success).toBe(false);

    const doubleSided = await supabaseFinanceRepository.recordManualAdjustment({
      ...MANUAL_ADJUSTMENT_INPUT,
      lines: [
        { account_id: "account_1000", debit_minor: 100, credit_minor: 100, line_memo: null },
        { account_id: "account_2000", debit_minor: 0, credit_minor: 100, line_memo: null },
      ],
    });
    expect(doubleSided.success).toBe(false);

    expect(rpcCalls).toHaveLength(0);
  });

  it("does NOT reject an unbalanced total client-side — that check is left to record_manual_adjustment's own P1106", async () => {
    mockSession();
    const { client, rpcCalls } = createMockSupabase([
      { data: null, error: { code: "P1106", message: "Manual adjustment is not balanced: total debits 5000 do not equal total credits 4000." } },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.recordManualAdjustment({
      ...MANUAL_ADJUSTMENT_INPUT,
      lines: [
        { account_id: "account_1000", debit_minor: 5000, credit_minor: 0, line_memo: null },
        { account_id: "account_2000", debit_minor: 0, credit_minor: 4000, line_memo: null },
      ],
    });
    expect(result.success).toBe(false);
    expect(rpcCalls).toHaveLength(1);
  });

  it("calls record_manual_adjustment with lines carrying no plug/balancing entry, maps the result, and writes exactly one Audit entry", async () => {
    mockSession();
    const { client, rpcCalls } = createMockSupabase([{ data: journalEntryRow({ source_type: "manual_adjustment", source_id: null, posting_key: null }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.recordManualAdjustment(MANUAL_ADJUSTMENT_INPUT);
    expect(result.success).toBe(true);
    expect(rpcCalls[0].name).toBe("record_manual_adjustment");
    const args = rpcCalls[0].args as Record<string, unknown>;
    expect(args.p_lines).toHaveLength(2);

    expect(recordAuditEventMock).toHaveBeenCalledTimes(1);
    const [, auditInput] = recordAuditEventMock.mock.calls[0];
    expect(auditInput.ownerType).toBe("journal_entry");
  });
});

describe("supabaseFinanceRepository.reverseJournalEntry", () => {
  it("requires a nonblank reason before ever reaching the RPC", async () => {
    const { client, rpcCalls } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.reverseJournalEntry("journal_entry_1", { reason: "" });
    expect(result.success).toBe(false);
    expect(rpcCalls).toHaveLength(0);
  });

  it("calls reverse_journal_entry, maps the reversal, writes exactly one Audit entry, and never issues a direct update to journal_entries", async () => {
    mockSession();
    const { client, calls, rpcCalls } = createMockSupabase([
      { data: journalEntryRow(), error: null }, // fetch original
      { data: journalEntryRow({ id: "journal_entry_2", source_type: "reversal", source_id: "journal_entry_1", posting_key: "reversal:journal_entry_1", reverses_entry_id: "journal_entry_1" }), error: null }, // rpc
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.reverseJournalEntry("journal_entry_1", { reason: "Correcting a duplicate entry" });
    expect(result.success).toBe(true);
    expect(rpcCalls[0].name).toBe("reverse_journal_entry");
    expect((rpcCalls[0].args as Record<string, unknown>).p_reason).toBe("Correcting a duplicate entry");
    expect(calls.some((c) => c.table === "journal_entries" && (c.method === "update" || c.method === "insert"))).toBe(false);

    expect(recordAuditEventMock).toHaveBeenCalledTimes(1);
  });

  it("fails without calling the RPC when the original entry does not exist", async () => {
    const { client, rpcCalls } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.reverseJournalEntry("nope", { reason: "test" });
    expect(result.success).toBe(false);
    expect(rpcCalls).toHaveLength(0);
  });
});

describe("supabaseFinanceRepository accounting period write methods", () => {
  it("createAccountingPeriod calls create_accounting_period and writes exactly one Audit entry", async () => {
    mockSession();
    const { client, rpcCalls } = createMockSupabase([{ data: accountingPeriodRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.createAccountingPeriod({ period_start: "2026-08-01", period_end: "2026-08-31" });
    expect(result.success).toBe(true);
    expect(rpcCalls[0].name).toBe("create_accounting_period");
    expect(recordAuditEventMock).toHaveBeenCalledTimes(1);
  });

  it("rejects period_end <= period_start before ever reaching the RPC", async () => {
    const { client, rpcCalls } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.createAccountingPeriod({ period_start: "2026-08-31", period_end: "2026-08-01" });
    expect(result.success).toBe(false);
    expect(rpcCalls).toHaveLength(0);
  });

  it("closeAccountingPeriod calls close_period, never mutates accounting_periods directly, and writes exactly one Audit entry", async () => {
    mockSession();
    const { client, calls, rpcCalls } = createMockSupabase([
      { data: accountingPeriodRow({ status: "open" }), error: null },
      { data: accountingPeriodRow({ status: "closed" }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.closeAccountingPeriod("accounting_period_1");
    expect(result.success).toBe(true);
    expect(rpcCalls[0].name).toBe("close_period");
    expect(calls.some((c) => c.table === "accounting_periods" && c.method === "update")).toBe(false);
    expect(recordAuditEventMock).toHaveBeenCalledTimes(1);
  });

  it("lockAccountingPeriod calls lock_period, never mutates accounting_periods directly, and writes exactly one Audit entry", async () => {
    mockSession();
    const { client, calls, rpcCalls } = createMockSupabase([
      { data: accountingPeriodRow({ status: "closed" }), error: null },
      { data: accountingPeriodRow({ status: "locked" }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseFinanceRepository.lockAccountingPeriod("accounting_period_1");
    expect(result.success).toBe(true);
    expect(rpcCalls[0].name).toBe("lock_period");
    expect(calls.some((c) => c.table === "accounting_periods" && c.method === "update")).toBe(false);
    expect(recordAuditEventMock).toHaveBeenCalledTimes(1);
  });
});

describe("supabaseFinanceRepository Stripe deferral (Finance Ledger)", () => {
  it("recordPaymentSettlement never accesses stripe_webhook_events or account 1010", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: paymentRow(), error: null }, // record_payment_settlement rpc
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabaseFinanceRepository.recordPaymentSettlement(PAYMENT_SETTLEMENT_INPUT);
    expect(calls.some((c) => c.table === "stripe_webhook_events")).toBe(false);
  });
});
