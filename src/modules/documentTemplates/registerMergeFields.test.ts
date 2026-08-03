import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({ resolveMemberSessionSnapshot: vi.fn() }));
vi.mock("@/lib/data", () => ({
  getClientById: vi.fn(),
  getEventById: vi.fn(),
  getInvoiceById: vi.fn(),
  getContract: vi.fn(),
  getLeadById: vi.fn(),
  getVendorById: vi.fn(),
  getPayments: vi.fn(),
}));
vi.mock("@/lib/data/proposals", () => ({ getProposalsRepository: vi.fn() }));
vi.mock("@/core/ai/memory", () => ({ getMemoryManager: vi.fn() }));
vi.mock("@/core/automation/registry", () => ({ getAutomation: vi.fn() }));
vi.mock("@/core/timeline", () => ({ getCoreTimelineService: vi.fn() }));
vi.mock("@/modules/clientJourney/clientJourneyActions", () => ({ buildClientJourney: vi.fn() }));

import { resetMergeFieldRegistry } from "@/core/documents/mergeFieldRegistry";
import { resetMergeResolvers, resolveMergeFields } from "@/core/documents/mergeEngine";
import { registerMergeFields, resetMergeFieldsRegistration } from "@/modules/documentTemplates/registerMergeFields";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getClientById, getEventById, getInvoiceById, getContract, getLeadById, getVendorById, getPayments } from "@/lib/data";
import { getProposalsRepository } from "@/lib/data/proposals";
import { getMemoryManager } from "@/core/ai/memory";
import { getAutomation } from "@/core/automation/registry";
import { getCoreTimelineService } from "@/core/timeline";
import { buildClientJourney } from "@/modules/clientJourney/clientJourneyActions";

const activeSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["documents.create"],
  workspaceDisplayName: "Amoré Bloom",
};

const fullContext = {
  workspaceId: "ws_1",
  memberId: "member_1",
  clientId: "client_1",
  eventId: "event_1",
  invoiceId: "invoice_1",
  contractId: "contract_1",
  leadId: "lead_1",
  vendorId: "vendor_1",
  proposalId: "proposal_1",
  automationId: "workflow-wf_1-trigger-invoice.overdue-path-0",
};

beforeEach(() => {
  resetMergeFieldRegistry();
  resetMergeResolvers();
  resetMergeFieldsRegistration();
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
  vi.mocked(getClientById).mockResolvedValue({
    id: "client_1",
    first_name: "Alex",
    last_name: "Rivera",
    partner_name: "Jordan Lee",
    email: "alex@example.com",
    phone: "555-0100",
    address: "123 Main St",
    city: "Springfield",
    state: "IL",
    zip_code: "62704",
    do_not_call: true,
    internal_status: "inactive",
  } as never);
  vi.mocked(getEventById).mockResolvedValue({ id: "event_1", title: "Rivera Wedding", event_date: "2026-09-12", location_name: "The Grand Hall" } as never);
  vi.mocked(getInvoiceById).mockResolvedValue({
    id: "invoice_1",
    invoice_number: "INV-1001",
    subtotal_minor: 500000,
    tax_minor: 25000,
    discount_minor: 0,
    total_minor: 525000,
    balance_minor: 100000,
    currency: "USD",
    issue_date: "2026-08-01",
    due_date: "2026-08-31",
  } as never);
  vi.mocked(getContract).mockResolvedValue({
    id: "contract_1",
    total_value: 8000,
    deposit_amount: 2000,
    remaining_balance: 6000,
    currency: "USD",
  } as never);
  vi.mocked(getProposalsRepository).mockReturnValue({
    getProposalsByEvent: vi.fn().mockResolvedValue([
      { status: "accepted", version: 2, generated_at: "2026-07-01T00:00:00Z" },
      { status: "superseded", version: 1, generated_at: "2026-06-01T00:00:00Z" },
    ]),
    getProposalById: vi.fn().mockResolvedValue({ id: "proposal_1", status: "accepted", version: 2, pricing_summary: { subtotal_minor: 800000, currency: "USD" } }),
  } as never);
  vi.mocked(getMemoryManager).mockReturnValue({
    filterMemories: vi.fn().mockResolvedValue([{ summary: "Client prefers morning ceremonies.", created_at: "2026-07-01T00:00:00Z" }]),
  } as never);
  vi.mocked(getAutomation).mockReturnValue({ id: "workflow-wf_1-trigger-invoice.overdue-path-0", name: "Invoice Overdue Reminder" } as never);
  vi.mocked(getLeadById).mockResolvedValue({ id: "lead_1", first_name: "Sam", last_name: "Chen", email: "sam@example.com", source: "referral", event_type: "wedding" } as never);
  vi.mocked(getVendorById).mockResolvedValue({ id: "vendor_1", display_name: "Bloom Florals", company_name: "Bloom Florals LLC", email: "hello@bloomflorals.example", phone: "555-0199" } as never);
  vi.mocked(getPayments).mockResolvedValue([
    { status: "succeeded", amount_minor: 200000, currency: "USD", received_at: "2026-08-05T00:00:00Z", transaction_date: "2026-08-05T00:00:00Z", payment_method: "card" },
  ] as never);
  vi.mocked(getCoreTimelineService).mockReturnValue({
    getTimelineForOwner: vi.fn().mockResolvedValue([{ description: "Contract signed", timestamp: "2026-08-06T00:00:00Z" }]),
    recordActivity: vi.fn(),
  } as never);
  vi.mocked(buildClientJourney).mockResolvedValue({ currentStage: "new_lead", progress: { overallPercentage: 55 } } as never);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("registerMergeFields — full domain integration", () => {
  it("resolves a real value from the workspace domain", async () => {
    registerMergeFields();
    const scope = await resolveMergeFields(fullContext);
    expect(scope.workspace_name).toBe("Amoré Bloom");
  });

  it("resolves real values from the crm domain", async () => {
    registerMergeFields();
    const scope = await resolveMergeFields(fullContext);
    expect(scope.client_name).toBe("Alex Rivera");
    expect(scope.partner_name).toBe("Jordan Lee");
    expect(scope.event_title).toBe("Rivera Wedding");
    expect(scope.event_date).toBe("2026-09-12");
    expect(scope.client_risk_flags).toEqual(["Do not call", "Inactive client"]);
    expect(scope.client_proposal_history).toEqual([
      { status: "accepted", version: 2, generated_at: "2026-07-01T00:00:00Z" },
      { status: "superseded", version: 1, generated_at: "2026-06-01T00:00:00Z" },
    ]);
  });

  it("resolves real, formatted values from the finance domain", async () => {
    registerMergeFields();
    const scope = await resolveMergeFields(fullContext);
    expect(scope.invoice_number).toBe("INV-1001");
    expect(scope.invoice_total).toBe("$5,250.00");
    expect(scope.invoice_balance).toBe("$1,000.00");
    expect(scope.invoice_payment_terms).toBe("Net 30");
    expect(scope.contract_total).toBe("$8,000.00");
    expect(scope.contract_deposit_amount).toBe("$2,000.00");
  });

  it("resolves the triggering automation's own name from the automation domain", async () => {
    registerMergeFields();
    const scope = await resolveMergeFields(fullContext);
    expect(scope.generated_by_automation).toBe("Invoice Overdue Reminder");
  });

  it("resolves the originating workflow id from the workflow domain's own id-parsing convention", async () => {
    registerMergeFields();
    const scope = await resolveMergeFields(fullContext);
    expect(scope.generated_via_workflow_id).toBe("wf_1");
  });

  it("resolves null for the workflow domain when the automation wasn't compiled from a Workflow", async () => {
    registerMergeFields();
    const scope = await resolveMergeFields({ ...fullContext, automationId: "manual-automation-id" });
    expect(scope.generated_via_workflow_id).toBeNull();
  });

  it("resolves the most recent approved memory from the memory domain", async () => {
    registerMergeFields();
    const scope = await resolveMergeFields(fullContext);
    expect(scope.recent_memory_summary).toBe("Client prefers morning ceremonies.");
  });

  it("resolves real Setting defaults from the settings domain", async () => {
    registerMergeFields();
    const scope = await resolveMergeFields(fullContext);
    expect(scope.workspace_currency).toBe("USD");
    expect(scope.brand_color).toBe("#b68235");
  });

  it("resolves the acting member's own name from the user domain", async () => {
    registerMergeFields();
    const scope = await resolveMergeFields(fullContext);
    expect(scope.generated_by_member).toBe("Amoré Bloom Owner");
  });

  it("is idempotent — calling twice does not duplicate resolvers or throw", async () => {
    registerMergeFields();
    registerMergeFields();
    const scope = await resolveMergeFields(fullContext);
    expect(scope.workspace_name).toBe("Amoré Bloom");
  });

  it("resolves real values from the v2 Checkpoint 44 lead/vendor/proposal/payments/journey/timeline/brand domains", async () => {
    registerMergeFields();
    const scope = await resolveMergeFields(fullContext);
    expect(scope.lead_name).toBe("Sam Chen");
    expect(scope.lead_source).toBe("referral");
    expect(scope.vendor_name).toBe("Bloom Florals");
    expect(scope.vendor_contact_email).toBe("hello@bloomflorals.example");
    expect(scope.proposal_status).toBe("accepted");
    expect(scope.proposal_total).toBe("$8,000.00");
    expect(scope.last_payment_amount).toBe("$2,000.00");
    expect(scope.last_payment_method).toBe("card");
    expect(scope.journey_progress_percent).toBe(55);
    expect(scope.latest_activity_description).toBe("Contract signed");
    expect(scope.brand_primary_color).toBe("#b68235");
  });

  it("resolves crm fields to null when no clientId/eventId is present in context", async () => {
    registerMergeFields();
    const scope = await resolveMergeFields({ workspaceId: "ws_1", memberId: "member_1" });
    expect(scope.client_name).toBeNull();
    expect(scope.event_title).toBeNull();
    expect(scope.client_risk_flags).toEqual([]);
  });
});
