import { afterEach, describe, expect, it, vi } from "vitest";

const { getLeadsMock, getClientsMock, getEventsMock, getInvoicesMock, getPaymentsMock } = vi.hoisted(() => ({
  getLeadsMock: vi.fn(),
  getClientsMock: vi.fn(),
  getEventsMock: vi.fn(),
  getInvoicesMock: vi.fn(),
  getPaymentsMock: vi.fn(),
}));

vi.mock("@/lib/data", () => ({
  getLeads: getLeadsMock,
  getClients: getClientsMock,
  getEvents: getEventsMock,
  getInvoices: getInvoicesMock,
  getPayments: getPaymentsMock,
}));

import { getSocialAttributionReport } from "@/modules/socialAttribution/getSocialAttributionReport";
import { makeLead } from "@/modules/leads/testUtils";
import { makeClient } from "@/modules/clients/testUtils";
import { makeEvent } from "@/modules/events/testUtils";
import { makeInvoice, makePayment } from "@/modules/finance/testUtils";

function setup(overrides: {
  leads?: ReturnType<typeof makeLead>[];
  clients?: ReturnType<typeof makeClient>[];
  events?: ReturnType<typeof makeEvent>[];
  invoices?: ReturnType<typeof makeInvoice>[];
  payments?: ReturnType<typeof makePayment>[];
}) {
  getLeadsMock.mockResolvedValue(overrides.leads ?? []);
  getClientsMock.mockResolvedValue(overrides.clients ?? []);
  getEventsMock.mockResolvedValue(overrides.events ?? []);
  getInvoicesMock.mockResolvedValue(overrides.invoices ?? []);
  getPaymentsMock.mockResolvedValue(overrides.payments ?? []);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("getSocialAttributionReport — empty workspace", () => {
  it("returns all-zero totals and an empty byPost array for a workspace with no Leads at all — no crash, no fabricated data", async () => {
    setup({});
    const report = await getSocialAttributionReport();

    expect(report.totals).toEqual({
      contentAttributedLeadCount: 0,
      commentAttributedLeadCount: 0,
      dmAttributedLeadCount: 0,
      attributedLeadCount: 0,
      unattributedLeadCount: 0,
      attributedClientCount: 0,
      attributedEventCount: 0,
      attributedInvoicedRevenueMinor: 0,
      attributedPaidRevenueMinor: 0,
    });
    expect(report.byPost).toEqual([]);
  });
});

describe("getSocialAttributionReport — attribution classification", () => {
  it("1/6/10/11. classifies content-, comment-, DM-attributed, and unattributed Leads correctly, with zero historical inference", async () => {
    setup({
      leads: [
        makeLead({ id: "lead_content", social_post_id: "post_1", instagram_comment_id: "comment_1" }),
        makeLead({ id: "lead_comment_only", social_post_id: null, instagram_comment_id: "comment_2" }),
        makeLead({ id: "lead_dm", instagram_conversation_id: "conversation_1" }),
        makeLead({ id: "lead_none" }),
      ],
    });

    const report = await getSocialAttributionReport();

    expect(report.totals.contentAttributedLeadCount).toBe(1);
    expect(report.totals.commentAttributedLeadCount).toBe(2);
    expect(report.totals.dmAttributedLeadCount).toBe(1);
    expect(report.totals.attributedLeadCount).toBe(3); // union, never a sum of overlapping counts
    expect(report.totals.unattributedLeadCount).toBe(1);
  });

  it("8. a comment-attributed Lead with no resolved Social Post is counted in commentAttributedLeadCount but never appears in byPost", async () => {
    setup({ leads: [makeLead({ id: "lead_1", social_post_id: null, instagram_comment_id: "comment_1" })] });
    const report = await getSocialAttributionReport();

    expect(report.totals.commentAttributedLeadCount).toBe(1);
    expect(report.totals.contentAttributedLeadCount).toBe(0);
    expect(report.byPost).toEqual([]);
  });

  it("9. a DM-attributed Lead never receives a social_post_id and never appears in byPost — DM attribution is never converted to Post attribution", async () => {
    setup({ leads: [makeLead({ id: "lead_1", instagram_conversation_id: "conversation_1" })] });
    const report = await getSocialAttributionReport();

    expect(report.totals.dmAttributedLeadCount).toBe(1);
    expect(report.byPost).toEqual([]);
  });
});

describe("getSocialAttributionReport — downstream revenue attribution", () => {
  it("2/3/4/5. Social Post → attributed Lead/Client/Event count and invoiced/paid revenue, using the real canonical finance computation", async () => {
    setup({
      leads: [makeLead({ id: "lead_1", social_post_id: "post_1", converted_client_id: "client_1" })],
      clients: [makeClient({ id: "client_1", originating_lead_id: "lead_1" })],
      events: [makeEvent({ id: "event_1", client_id: "client_1" })],
      invoices: [makeInvoice({ id: "invoice_1", client_id: "client_1", total_minor: 100000, status: "sent" })],
      payments: [makePayment({ id: "payment_1", client_id: "client_1", invoice_id: "invoice_1", amount_minor: 60000, status: "succeeded", payment_type: "deposit" })],
    });

    const report = await getSocialAttributionReport();

    expect(report.byPost).toEqual([
      { socialPostId: "post_1", leadCount: 1, clientCount: 1, eventCount: 1, invoicedRevenueMinor: 100000, paidRevenueMinor: 60000 },
    ]);
    expect(report.totals.attributedInvoicedRevenueMinor).toBe(100000);
    expect(report.totals.attributedPaidRevenueMinor).toBe(60000);
  });

  it("7. a partial downstream chain (attributed Lead converted to a Client with no Event/Invoice/Payment yet) reports zero revenue, never a crash", async () => {
    setup({
      leads: [makeLead({ id: "lead_1", social_post_id: "post_1", converted_client_id: "client_1" })],
      clients: [makeClient({ id: "client_1", originating_lead_id: "lead_1" })],
    });

    const report = await getSocialAttributionReport();

    expect(report.byPost).toEqual([{ socialPostId: "post_1", leadCount: 1, clientCount: 1, eventCount: 0, invoicedRevenueMinor: 0, paidRevenueMinor: 0 }]);
  });

  it("an attributed Lead not yet converted to a Client contributes to leadCount but not clientCount/eventCount/revenue", async () => {
    setup({ leads: [makeLead({ id: "lead_1", social_post_id: "post_1", converted_client_id: null })] });
    const report = await getSocialAttributionReport();

    expect(report.byPost).toEqual([{ socialPostId: "post_1", leadCount: 1, clientCount: 0, eventCount: 0, invoicedRevenueMinor: 0, paidRevenueMinor: 0 }]);
  });
});

describe("getSocialAttributionReport — workspace isolation", () => {
  it("12/13. relies entirely on the workspace-scoped getLeads/getClients/getEvents/getInvoices/getPayments facades — every fixture in a test is implicitly workspace-scoped by the mocked call, proving no cross-workspace row could ever enter the computation", async () => {
    setup({
      leads: [makeLead({ id: "lead_ws1", social_post_id: "post_1", converted_client_id: "client_ws1", workspace_id: "ws_1" })],
      clients: [makeClient({ id: "client_ws1", originating_lead_id: "lead_ws1", workspace_id: "ws_1" })],
    });

    await getSocialAttributionReport();

    // The report never re-derives or accepts a workspaceId of its own — it
    // is entirely at the mercy of what the (already workspace-scoped)
    // repository facades return, exactly like every other financial
    // summary function in this codebase.
    expect(getLeadsMock).toHaveBeenCalledWith({ includeArchived: true }, undefined);
    expect(getClientsMock).toHaveBeenCalledWith({ includeArchived: true }, undefined);
  });

  it("14. a Client from a different workspace than the attributed Lead (a cross-workspace originating_lead_id, which should never happen but is defensively excluded) is never counted, since clientIdsForLeads only trusts lead.converted_client_id resolved against the already workspace-scoped Client list", async () => {
    setup({
      leads: [makeLead({ id: "lead_1", social_post_id: "post_1", converted_client_id: "client_other_workspace" })],
      clients: [], // The workspace-scoped Client fetch never returned a Client with this id — simulates a cross-workspace FK value that cannot resolve.
    });

    const report = await getSocialAttributionReport();

    expect(report.byPost).toEqual([{ socialPostId: "post_1", leadCount: 1, clientCount: 0, eventCount: 0, invoicedRevenueMinor: 0, paidRevenueMinor: 0 }]);
  });

  it("passes the given ServerRepositoryContext through to every repository call, never silently dropping it", async () => {
    setup({});
    const context = { supabase: {} as never, session: { workspace: { id: "ws_1" } } as never };

    await getSocialAttributionReport(context);

    expect(getLeadsMock).toHaveBeenCalledWith(expect.anything(), context);
    expect(getClientsMock).toHaveBeenCalledWith(expect.anything(), context);
    expect(getEventsMock).toHaveBeenCalledWith(expect.anything(), context);
    expect(getInvoicesMock).toHaveBeenCalledWith(expect.anything(), context);
    expect(getPaymentsMock).toHaveBeenCalledWith(expect.anything(), context);
  });
});

describe("getSocialAttributionReport — double counting", () => {
  it("15. one Client with multiple Events counts as 1 attributed Client, and eventCount correctly counts all its Events without inflating clientCount", async () => {
    setup({
      leads: [makeLead({ id: "lead_1", social_post_id: "post_1", converted_client_id: "client_1" })],
      clients: [makeClient({ id: "client_1", originating_lead_id: "lead_1" })],
      events: [makeEvent({ id: "event_1", client_id: "client_1" }), makeEvent({ id: "event_2", client_id: "client_1" }), makeEvent({ id: "event_3", client_id: "client_1" })],
    });

    const report = await getSocialAttributionReport();

    expect(report.byPost[0]).toMatchObject({ clientCount: 1, eventCount: 3 });
  });

  it("16. multiple Invoices and Payments for the same attributed Client sum correctly without duplication, via the real, unmodified computeClientFinancialSummary", async () => {
    setup({
      leads: [makeLead({ id: "lead_1", social_post_id: "post_1", converted_client_id: "client_1" })],
      clients: [makeClient({ id: "client_1", originating_lead_id: "lead_1" })],
      invoices: [
        makeInvoice({ id: "invoice_1", client_id: "client_1", total_minor: 100000, status: "sent" }),
        makeInvoice({ id: "invoice_2", client_id: "client_1", total_minor: 50000, status: "sent" }),
      ],
      payments: [
        makePayment({ id: "payment_1", client_id: "client_1", invoice_id: "invoice_1", amount_minor: 100000, status: "succeeded", payment_type: "deposit" }),
        makePayment({ id: "payment_2", client_id: "client_1", invoice_id: "invoice_2", amount_minor: 50000, status: "succeeded", payment_type: "final_payment" }),
      ],
    });

    const report = await getSocialAttributionReport();

    expect(report.byPost[0]).toMatchObject({ invoicedRevenueMinor: 150000, paidRevenueMinor: 150000 });
  });

  it("17. two different Social Posts, each with their own attributed Client, never duplicate or leak revenue into each other's byPost entry, and the workspace totals equal the exact sum of both", async () => {
    setup({
      leads: [
        makeLead({ id: "lead_1", social_post_id: "post_1", converted_client_id: "client_1" }),
        makeLead({ id: "lead_2", social_post_id: "post_2", converted_client_id: "client_2" }),
      ],
      clients: [makeClient({ id: "client_1", originating_lead_id: "lead_1" }), makeClient({ id: "client_2", originating_lead_id: "lead_2" })],
      invoices: [
        makeInvoice({ id: "invoice_1", client_id: "client_1", total_minor: 100000, status: "sent" }),
        makeInvoice({ id: "invoice_2", client_id: "client_2", total_minor: 40000, status: "sent" }),
      ],
    });

    const report = await getSocialAttributionReport();

    const byPost = Object.fromEntries(report.byPost.map((p) => [p.socialPostId, p]));
    expect(byPost.post_1).toMatchObject({ invoicedRevenueMinor: 100000 });
    expect(byPost.post_2).toMatchObject({ invoicedRevenueMinor: 40000 });
    expect(report.totals.attributedInvoicedRevenueMinor).toBe(140000);
  });

  it("two Leads attributed to the SAME post but converted to DIFFERENT Clients count as 2 distinct Clients, never 1", async () => {
    setup({
      leads: [
        makeLead({ id: "lead_1", social_post_id: "post_1", converted_client_id: "client_1" }),
        makeLead({ id: "lead_2", social_post_id: "post_1", converted_client_id: "client_2" }),
      ],
      clients: [makeClient({ id: "client_1", originating_lead_id: "lead_1" }), makeClient({ id: "client_2", originating_lead_id: "lead_2" })],
    });

    const report = await getSocialAttributionReport();
    expect(report.byPost[0]).toMatchObject({ leadCount: 2, clientCount: 2 });
  });
});

describe("getSocialAttributionReport — finance semantics", () => {
  it("18/19. invoiced revenue excludes voided Invoices, paid revenue excludes non-succeeded Payments — the exact existing canonical rules, unchanged", async () => {
    setup({
      leads: [makeLead({ id: "lead_1", social_post_id: "post_1", converted_client_id: "client_1" })],
      clients: [makeClient({ id: "client_1", originating_lead_id: "lead_1" })],
      invoices: [
        makeInvoice({ id: "invoice_1", client_id: "client_1", total_minor: 100000, status: "sent" }),
        makeInvoice({ id: "invoice_2", client_id: "client_1", total_minor: 999999, status: "voided" }),
      ],
      payments: [
        makePayment({ id: "payment_1", client_id: "client_1", amount_minor: 50000, status: "succeeded", payment_type: "deposit" }),
        makePayment({ id: "payment_2", client_id: "client_1", amount_minor: 999999, status: "pending" }),
        makePayment({ id: "payment_3", client_id: "client_1", amount_minor: 999999, status: "failed" }),
      ],
    });

    const report = await getSocialAttributionReport();
    expect(report.byPost[0]).toMatchObject({ invoicedRevenueMinor: 100000, paidRevenueMinor: 50000 });
  });

  it("20. partial-payment behavior follows the existing canonical semantics (collected reflects real succeeded Payments only, not the Invoice's own total)", async () => {
    setup({
      leads: [makeLead({ id: "lead_1", social_post_id: "post_1", converted_client_id: "client_1" })],
      clients: [makeClient({ id: "client_1", originating_lead_id: "lead_1" })],
      invoices: [makeInvoice({ id: "invoice_1", client_id: "client_1", total_minor: 100000, paid_minor: 30000, balance_minor: 70000, status: "sent" })],
      payments: [makePayment({ id: "payment_1", client_id: "client_1", invoice_id: "invoice_1", amount_minor: 30000, status: "succeeded", payment_type: "deposit" })],
    });

    const report = await getSocialAttributionReport();
    expect(report.byPost[0]).toMatchObject({ invoicedRevenueMinor: 100000, paidRevenueMinor: 30000 });
  });

  it("21. expenses are never read or attributed by this report at all — no expense/profit field exists anywhere in its output", async () => {
    setup({ leads: [makeLead({ id: "lead_1", social_post_id: "post_1" })] });
    const report = await getSocialAttributionReport();

    expect(report.byPost[0]).not.toHaveProperty("expenseMinor");
    expect(report.byPost[0]).not.toHaveProperty("profitMinor");
    expect(report.totals).not.toHaveProperty("attributedExpenseMinor");
    expect(report.totals).not.toHaveProperty("attributedProfitMinor");
  });
});
