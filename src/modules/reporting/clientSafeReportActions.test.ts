import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data", () => ({
  getCurrentClientAccountContext: vi.fn(),
  getClientPortalOverview: vi.fn(),
  getClientPortalContracts: vi.fn(),
  getClientPortalInvoices: vi.fn(),
  getClientPortalEvents: vi.fn(),
  getClientPortalDocuments: vi.fn(),
}));

vi.mock("@/modules/clientPortal/getClientPortalJourneySummary", () => ({
  getClientPortalJourneySummaryAction: vi.fn(),
}));

vi.mock("@/modules/clientPortal/getClientPortalProposal", () => ({
  listClientPortalProposalsAction: vi.fn(),
}));

import { getClientSafeReportAction } from "@/modules/reporting/clientSafeReportActions";
import { getCurrentClientAccountContext, getClientPortalOverview, getClientPortalContracts, getClientPortalInvoices, getClientPortalEvents, getClientPortalDocuments } from "@/lib/data";
import { getClientPortalJourneySummaryAction } from "@/modules/clientPortal/getClientPortalJourneySummary";
import { listClientPortalProposalsAction } from "@/modules/clientPortal/getClientPortalProposal";

const CONTEXT = { account: { id: "account_1", workspace_id: "ws_1", client_id: "client_1" }, clientName: "Jordan", workspaceName: "Amoré Bloom" };

function mockHappyPath(): void {
  vi.mocked(getCurrentClientAccountContext).mockResolvedValue(CONTEXT as never);
  vi.mocked(getClientPortalJourneySummaryAction).mockResolvedValue({
    success: true,
    data: { currentStageLabel: "Planning", progressPercentage: 60, nextStepLabel: "Sign contract", pendingSignature: true, pendingPayment: false, pendingInformationRequests: [], completedMilestoneLabels: ["Deposit paid"] },
  } as never);
  vi.mocked(listClientPortalProposalsAction).mockResolvedValue({ success: true, data: [{ proposalId: "p1", title: "Wedding Package", grandTotal_minor: 500000, currency: "usd", sentAt: "2026-01-01T00:00:00.000Z" }] } as never);
  vi.mocked(getClientPortalOverview).mockResolvedValue({ clientName: "Jordan", upcomingEvent: null, contractsInProgress: 1, totalOutstandingBalanceMinor: 0, currency: "usd", nextPaymentDue: null, recentDocuments: [], nextRecommendedAction: null } as never);
  vi.mocked(getClientPortalContracts).mockResolvedValue([{ id: "c1", client_id: "client_1", event_id: null, contract_number: "C-1", title: "Wedding Contract", description: null, status: "sent", signature_status: "pending", effective_date: null, expiration_date: null, sent_at: null, viewed_at: null, signed_at: null, total_value: null, deposit_required: false }] as never);
  vi.mocked(getClientPortalInvoices).mockResolvedValue([{ id: "i1", client_id: "client_1", event_id: null, contract_id: null, invoice_number: "INV-1", title: "Deposit", description: null, status: "sent", issue_date: null, due_date: "2026-02-01T00:00:00.000Z", subtotal_minor: 100000, tax_minor: 0, discount_minor: 0, total_minor: 100000, paid_minor: 0, balance_minor: 100000, currency: "usd", sent_at: null, viewed_at: null, paid_at: null, overdue_at: null, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }] as never);
  vi.mocked(getClientPortalEvents).mockResolvedValue([{ id: "e1", client_id: "client_1", title: "Wedding Day", event_type: "wedding", status: "confirmed", event_date: "2026-06-01T00:00:00.000Z", start_time: null, end_time: null, timezone: null, location_name: null, city: null, state: null, guest_count: 100, package_name: null, theme: null }] as never);
  vi.mocked(getClientPortalDocuments).mockResolvedValue([{ id: "d1", title: "Welcome Guide", description: null, category: "general", status: "published", file_name: null, original_file_name: null, mime_type: null, size_bytes: null, version: 1, is_latest_version: true, hasFile: true, uploaded_at: "2026-01-01T00:00:00.000Z", expires_at: null, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", approvalStatus: "pending", approvalComment: null }] as never);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("clientSafeReportActions — getClientSafeReportAction", () => {
  it("rejects when there is no Client Portal session", async () => {
    vi.mocked(getCurrentClientAccountContext).mockResolvedValue(null);
    const result = await getClientSafeReportAction();
    expect(result.success).toBe(false);
  });

  it("propagates a journey summary failure rather than returning a partial report", async () => {
    vi.mocked(getCurrentClientAccountContext).mockResolvedValue(CONTEXT as never);
    vi.mocked(getClientPortalJourneySummaryAction).mockResolvedValue({ success: false, error: "unavailable" } as never);
    const result = await getClientSafeReportAction();
    expect(result.success).toBe(false);
  });

  it("composes only the named allowlisted fields from every already-client-safe source", async () => {
    mockHappyPath();
    const result = await getClientSafeReportAction();
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.journey).toEqual({ currentStageLabel: "Planning", progressPercentage: 60, nextStepLabel: "Sign contract" });
    expect(result.data.milestones).toEqual(["Deposit paid"]);
    expect(result.data.proposals).toEqual([{ id: "p1", title: "Wedding Package", sentAt: "2026-01-01T00:00:00.000Z" }]);
    expect(result.data.contracts).toEqual([{ id: "c1", title: "Wedding Contract", status: "sent", signatureStatus: "pending", effectiveDate: null }]);
    expect(result.data.paymentSchedule).toEqual([{ id: "i1", invoiceNumber: "INV-1", status: "sent", dueDate: "2026-02-01T00:00:00.000Z", totalMinor: 100000, paidMinor: 0, balanceMinor: 100000, currency: "usd" }]);
    expect(result.data.events).toEqual([{ id: "e1", title: "Wedding Day", eventDate: "2026-06-01T00:00:00.000Z", status: "confirmed", guestCount: 100 }]);
    expect(result.data.recentDocumentActivity).toEqual([{ id: "d1", title: "Welcome Guide", category: "general", uploadedAt: "2026-01-01T00:00:00.000Z" }]);
  });

  it("never leaks internal-only fields onto a projected row (no budget/staff/notes keys)", async () => {
    mockHappyPath();
    const result = await getClientSafeReportAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    const serialized = JSON.stringify(result.data);
    expect(serialized).not.toContain("deposit_required");
    expect(serialized).not.toContain("subtotal_minor");
  });

  it("degrades proposals to an empty list rather than failing the whole report when that one source errors", async () => {
    mockHappyPath();
    vi.mocked(listClientPortalProposalsAction).mockResolvedValue({ success: false, error: "unavailable" } as never);
    const result = await getClientSafeReportAction();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.proposals).toEqual([]);
  });
});
