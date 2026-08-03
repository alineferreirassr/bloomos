import { describe, expect, it } from "vitest";
import { buildCrmAssistantContext } from "@/modules/ai/crmAssistant/contextBuilder";
import type { CrmAssistantMaterials } from "@/modules/ai/crmAssistant/fetchCrmAssistantContext.server";
import { makeClient } from "@/modules/clients/testUtils";
import { makeLead } from "@/modules/leads/testUtils";
import { makeEvent } from "@/modules/events/testUtils";
import { makeContract } from "@/modules/contracts/testUtils";
import { makeInvoice } from "@/modules/finance/testUtils";
import type { ProposalDraft } from "@/types/proposal";
import type { AuditLogEntry } from "@/core/audit/types";

function makeProposal(overrides: Partial<ProposalDraft> = {}): ProposalDraft {
  return {
    id: "proposal_test",
    workspace_id: "ws_test",
    event_id: "event_test",
    client_id: "client_test",
    status: "draft",
    version: 1,
    parent_proposal_id: null,
    executive_summary: "",
    event_overview: "",
    services_included: [],
    timeline_summary: "",
    pricing_summary: { subtotal_minor: 0, currency: "USD" },
    payment_terms: [],
    recommendations: [],
    optional_add_ons: [],
    questions_for_client: [],
    ai_confidence: 80,
    missing_information: [],
    provider: "mock",
    model: "mock-1",
    prompt_version: "proposal-generator-v1",
    mock: true,
    generation_latency_ms: 10,
    generated_at: "2026-07-20T00:00:00.000Z",
    reviewed_by: null,
    reviewed_at: null,
    created_at: "2026-07-20T00:00:00.000Z",
    updated_at: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

function makeActivityEntry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: "audit_test",
    workspace_id: "ws_test",
    actor: "member_1",
    action: "client_updated",
    owner_type: "client",
    owner_id: "client_test",
    before: null,
    after: null,
    occurred_at: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

function materials(overrides: Partial<CrmAssistantMaterials> = {}): CrmAssistantMaterials {
  return {
    clients: [],
    leads: [],
    events: [],
    contracts: [],
    invoices: [],
    proposals: [],
    dailyBriefExecutions: [],
    activity: [],
    unavailableCategories: [],
    ...overrides,
  };
}

const NOW = new Date("2026-07-26T12:00:00.000Z");

describe("buildCrmAssistantContext — Priority/Inactive Clients", () => {
  it("classifies a VIP client as priority", () => {
    const context = buildCrmAssistantContext(materials({ clients: [makeClient({ id: "c1", is_vip: true })] }), NOW);
    expect(context.priorityClients.map((c) => c.clientId)).toContain("c1");
  });

  it("classifies a client with an Event within 14 days as priority", () => {
    const context = buildCrmAssistantContext(
      materials({
        clients: [makeClient({ id: "c1", is_vip: false })],
        events: [makeEvent({ id: "e1", client_id: "c1", event_date: "2026-08-02" })],
      }),
      NOW,
    );
    expect(context.priorityClients.map((c) => c.clientId)).toContain("c1");
  });

  it("does not classify a non-VIP client with a far-future Event as priority", () => {
    const context = buildCrmAssistantContext(
      materials({
        clients: [makeClient({ id: "c1", is_vip: false })],
        events: [makeEvent({ id: "e1", client_id: "c1", event_date: "2027-01-01" })],
      }),
      NOW,
    );
    expect(context.priorityClients.map((c) => c.clientId)).not.toContain("c1");
  });

  it("classifies internal_status: inactive clients as inactive, directly from status", () => {
    const context = buildCrmAssistantContext(
      materials({ clients: [makeClient({ id: "c1", internal_status: "inactive" }), makeClient({ id: "c2", internal_status: "active" })] }),
      NOW,
    );
    expect(context.inactiveClients.map((c) => c.clientId)).toEqual(["c1"]);
  });
});

describe("buildCrmAssistantContext — Clients At Risk", () => {
  it("flags a client with an unsigned contract", () => {
    const context = buildCrmAssistantContext(
      materials({
        clients: [makeClient({ id: "c1" })],
        contracts: [makeContract({ id: "ct1", client_id: "c1", contract_number: "C-1", signature_status: "unsigned" })],
      }),
      NOW,
    );
    expect(context.clientsAtRisk).toHaveLength(1);
    expect(context.clientsAtRisk[0].clientId).toBe("c1");
    expect(context.clientsAtRisk[0].reasons[0]).toContain("C-1");
  });

  it("flags a client with an overdue invoice, formatting the amount", () => {
    const context = buildCrmAssistantContext(
      materials({
        clients: [makeClient({ id: "c1" })],
        invoices: [makeInvoice({ id: "inv1", client_id: "c1", invoice_number: "INV-1", status: "overdue", balance_minor: 5000, currency: "USD" })],
      }),
      NOW,
    );
    expect(context.clientsAtRisk).toHaveLength(1);
    expect(context.clientsAtRisk[0].reasons[0]).toBe("Overdue invoice INV-1 ($50.00)");
  });

  it("never flags a client whose contract is already signed or invoice isn't overdue", () => {
    const context = buildCrmAssistantContext(
      materials({
        clients: [makeClient({ id: "c1" })],
        contracts: [makeContract({ id: "ct1", client_id: "c1", signature_status: "signed" })],
        invoices: [makeInvoice({ id: "inv1", client_id: "c1", status: "sent", balance_minor: 5000 })],
      }),
      NOW,
    );
    expect(context.clientsAtRisk).toHaveLength(0);
  });
});

describe("buildCrmAssistantContext — Active Leads", () => {
  it("includes leads not in a terminal status", () => {
    const context = buildCrmAssistantContext(materials({ leads: [makeLead({ id: "l1", status: "qualified" })] }), NOW);
    expect(context.activeLeads.map((l) => l.leadId)).toEqual(["l1"]);
  });

  it("excludes converted, lost, and archived leads", () => {
    const context = buildCrmAssistantContext(
      materials({
        leads: [makeLead({ id: "l1", status: "converted" }), makeLead({ id: "l2", status: "lost" }), makeLead({ id: "l3", status: "archived" })],
      }),
      NOW,
    );
    expect(context.activeLeads).toHaveLength(0);
  });
});

describe("buildCrmAssistantContext — Events", () => {
  it("splits Events into upcoming (including today/unscheduled) and past", () => {
    const context = buildCrmAssistantContext(
      materials({
        events: [
          makeEvent({ id: "e1", event_date: "2026-07-26" }),
          makeEvent({ id: "e2", event_date: "2026-08-01" }),
          makeEvent({ id: "e3", event_date: "2026-07-01" }),
          makeEvent({ id: "e4", event_date: null }),
        ],
      }),
      NOW,
    );
    expect(context.upcomingEvents.map((e) => e.eventId).sort()).toEqual(["e1", "e2", "e4"].sort());
    expect(context.pastEvents.map((e) => e.eventId)).toEqual(["e3"]);
  });
});

describe("buildCrmAssistantContext — Contracts and Invoices", () => {
  it("surfaces only unsigned contracts", () => {
    const context = buildCrmAssistantContext(
      materials({ contracts: [makeContract({ id: "ct1", signature_status: "unsigned" }), makeContract({ id: "ct2", signature_status: "signed" })] }),
      NOW,
    );
    expect(context.unsignedContracts.map((c) => c.contractId)).toEqual(["ct1"]);
  });

  it("sums outstanding balance across non-voided, non-archived invoices with a positive balance", () => {
    const context = buildCrmAssistantContext(
      materials({
        invoices: [
          makeInvoice({ id: "i1", balance_minor: 1000, status: "sent" }),
          makeInvoice({ id: "i2", balance_minor: 2000, status: "overdue" }),
          makeInvoice({ id: "i3", balance_minor: 500, status: "voided" }),
          makeInvoice({ id: "i4", balance_minor: 0, status: "paid" }),
        ],
      }),
      NOW,
    );
    expect(context.outstandingInvoices.map((i) => i.invoiceId).sort()).toEqual(["i1", "i2"]);
    expect(context.outstandingBalanceMinor).toBe(3000);
  });
});

describe("buildCrmAssistantContext — Proposal History, Daily Briefs, Activity", () => {
  it("sorts proposal history newest first and caps it", () => {
    const context = buildCrmAssistantContext(
      materials({
        proposals: [makeProposal({ id: "p1", generated_at: "2026-07-01T00:00:00.000Z" }), makeProposal({ id: "p2", generated_at: "2026-07-20T00:00:00.000Z" })],
      }),
      NOW,
    );
    expect(context.proposalHistory.map((p) => p.proposalId)).toEqual(["p2", "p1"]);
  });

  it("computes a communication summary from communication-adjacent activity types only", () => {
    const context = buildCrmAssistantContext(
      materials({
        activity: [
          makeActivityEntry({ action: "note_added", occurred_at: "2026-07-20T00:00:00.000Z" }),
          makeActivityEntry({ action: "welcome_guide_sent", occurred_at: "2026-07-22T00:00:00.000Z" }),
          makeActivityEntry({ action: "client_updated", occurred_at: "2026-07-25T00:00:00.000Z" }),
        ],
      }),
      NOW,
    );
    expect(context.communicationSummary.totalLoggedTouchpoints).toBe(2);
    expect(context.communicationSummary.mostRecentTouchpointAt).toBe("2026-07-22T00:00:00.000Z");
  });

  it("never exposes before/after on activity entries — safe projection only", () => {
    const context = buildCrmAssistantContext(
      materials({ activity: [makeActivityEntry({ before: { email: "secret@example.com" }, after: { email: "new@example.com" } })] }),
      NOW,
    );
    expect(context.recentActivity[0]).toEqual({ action: "client_updated", ownerType: "client", occurredAt: "2026-07-20T00:00:00.000Z" });
  });
});

describe("buildCrmAssistantContext — unavailableCategories passthrough", () => {
  it("passes unavailableCategories straight through from materials", () => {
    const context = buildCrmAssistantContext(materials({ unavailableCategories: ["finance", "activity"] }), NOW);
    expect(context.unavailableCategories).toEqual(["finance", "activity"]);
  });

  it("starts with an empty recentMemories array — populated later by composeContext, never fetched here", () => {
    const context = buildCrmAssistantContext(materials(), NOW);
    expect(context.recentMemories).toEqual([]);
  });
});
