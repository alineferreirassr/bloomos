import { afterEach, describe, expect, it } from "vitest";
import { mockClientPortalRepository } from "@/lib/data/clientPortal/mockRepository";
import { readEvents, writeEvents, resetEventsStore } from "@/lib/data/mock/eventsStore";
import { readContracts, writeContracts, resetContractsStore } from "@/lib/data/mock/contractsStore";
import { readInvoices, writeInvoices, resetInvoicesStore } from "@/lib/data/mock/invoicesStore";
import { readPayments, writePayments, resetPaymentsStore } from "@/lib/data/mock/paymentsStore";
import { readDocuments, writeDocuments, resetDocumentsStore } from "@/lib/data/mock/documentsStore";
import { MOCK_CURRENT_CLIENT_ACCOUNT_ID, readClientAccounts } from "@/lib/data/mock/clientAccountsStore";
import { makeEvent } from "@/modules/events/testUtils";
import { makeContract } from "@/modules/contracts/testUtils";
import { makeInvoice, makePayment } from "@/modules/finance/testUtils";
import { makeDocument } from "@/modules/documents/testUtils";
import { NotFoundError } from "@/core/errors";

const CURRENT_CLIENT_ID = readClientAccounts().find((a) => a.id === MOCK_CURRENT_CLIENT_ACCOUNT_ID)!.client_id;
const OTHER_CLIENT_ID = "client_other_for_client_portal_tests";

afterEach(() => {
  resetEventsStore();
  resetContractsStore();
  resetInvoicesStore();
  resetPaymentsStore();
  resetDocumentsStore();
});

describe("mockClientPortalRepository.getClientPortalEvents / getClientPortalEventById", () => {
  it("returns only the current client's non-archived events", async () => {
    const mine = makeEvent({ id: "cp_event_mine", client_id: CURRENT_CLIENT_ID, title: "My Event" });
    const someoneElses = makeEvent({ id: "cp_event_other", client_id: OTHER_CLIENT_ID, title: "Not Mine" });
    const archived = makeEvent({ id: "cp_event_archived", client_id: CURRENT_CLIENT_ID, archived_at: "2026-01-01T00:00:00Z" });
    writeEvents([...readEvents(), mine, someoneElses, archived]);

    const events = await mockClientPortalRepository.getClientPortalEvents();
    expect(events.some((e) => e.id === "cp_event_mine")).toBe(true);
    expect(events.some((e) => e.id === "cp_event_other")).toBe(false);
    expect(events.some((e) => e.id === "cp_event_archived")).toBe(false);
  });

  it("never includes internal-only fields (budget, internal_summary, assigned_owner) on the returned DTO", async () => {
    const mine = makeEvent({ id: "cp_event_internal_check", client_id: CURRENT_CLIENT_ID, budget_min: 5000, internal_summary: "staff notes" });
    writeEvents([...readEvents(), mine]);

    const event = await mockClientPortalRepository.getClientPortalEventById("cp_event_internal_check");
    expect(event).not.toHaveProperty("budget_min");
    expect(event).not.toHaveProperty("internal_summary");
    expect(event).not.toHaveProperty("assigned_owner");
  });

  it("throws NotFoundError for another client's event id (manipulated id blocked)", async () => {
    const someoneElses = makeEvent({ id: "cp_event_manipulated", client_id: OTHER_CLIENT_ID });
    writeEvents([...readEvents(), someoneElses]);

    await expect(mockClientPortalRepository.getClientPortalEventById("cp_event_manipulated")).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError for a nonexistent event id", async () => {
    await expect(mockClientPortalRepository.getClientPortalEventById("nope")).rejects.toThrow(NotFoundError);
  });
});

describe("mockClientPortalRepository.getClientPortalContracts / getClientPortalContractById", () => {
  it("returns only the current client's non-archived contracts", async () => {
    const mine = makeContract({ id: "cp_contract_mine", client_id: CURRENT_CLIENT_ID });
    const someoneElses = makeContract({ id: "cp_contract_other", client_id: OTHER_CLIENT_ID });
    writeContracts([...readContracts(), mine, someoneElses]);

    const contracts = await mockClientPortalRepository.getClientPortalContracts();
    expect(contracts.some((c) => c.id === "cp_contract_mine")).toBe(true);
    expect(contracts.some((c) => c.id === "cp_contract_other")).toBe(false);
  });

  it("never includes internal-only fields (notes, version_history) on the returned DTO", async () => {
    const mine = makeContract({ id: "cp_contract_internal_check", client_id: CURRENT_CLIENT_ID, notes: "internal staff notes" });
    writeContracts([...readContracts(), mine]);

    const contract = await mockClientPortalRepository.getClientPortalContractById("cp_contract_internal_check");
    expect(contract).not.toHaveProperty("notes");
    expect(contract).not.toHaveProperty("version_history");
  });

  it("throws NotFoundError for another client's contract id", async () => {
    const someoneElses = makeContract({ id: "cp_contract_manipulated", client_id: OTHER_CLIENT_ID });
    writeContracts([...readContracts(), someoneElses]);

    await expect(mockClientPortalRepository.getClientPortalContractById("cp_contract_manipulated")).rejects.toThrow(NotFoundError);
  });
});

describe("mockClientPortalRepository.getClientPortalInvoices / getClientPortalInvoiceById", () => {
  it("returns only the current client's non-archived, non-voided invoices", async () => {
    const mine = makeInvoice({ id: "cp_invoice_mine", client_id: CURRENT_CLIENT_ID });
    const someoneElses = makeInvoice({ id: "cp_invoice_other", client_id: OTHER_CLIENT_ID });
    const voided = makeInvoice({ id: "cp_invoice_voided", client_id: CURRENT_CLIENT_ID, voided_at: "2026-01-01T00:00:00Z" });
    writeInvoices([...readInvoices(), mine, someoneElses, voided]);

    const invoices = await mockClientPortalRepository.getClientPortalInvoices();
    expect(invoices.some((i) => i.id === "cp_invoice_mine")).toBe(true);
    expect(invoices.some((i) => i.id === "cp_invoice_other")).toBe(false);
    expect(invoices.some((i) => i.id === "cp_invoice_voided")).toBe(false);
  });

  it("includes only this invoice's own client-safe payment history, excluding internal reference/notes fields", async () => {
    const invoice = makeInvoice({ id: "cp_invoice_with_payments", client_id: CURRENT_CLIENT_ID });
    const payment = makePayment({ id: "cp_payment_mine", invoice_id: "cp_invoice_with_payments", client_id: CURRENT_CLIENT_ID, reference: "internal-ref-123", notes: "internal note" });
    const unrelatedPayment = makePayment({ id: "cp_payment_unrelated", invoice_id: "some_other_invoice", client_id: CURRENT_CLIENT_ID });
    writeInvoices([...readInvoices(), invoice]);
    writePayments([...readPayments(), payment, unrelatedPayment]);

    const result = await mockClientPortalRepository.getClientPortalInvoiceById("cp_invoice_with_payments");
    expect(result.payments).toHaveLength(1);
    expect(result.payments[0].id).toBe("cp_payment_mine");
    expect(result.payments[0]).not.toHaveProperty("reference");
    expect(result.payments[0]).not.toHaveProperty("notes");
  });

  it("throws NotFoundError for another client's invoice id", async () => {
    const someoneElses = makeInvoice({ id: "cp_invoice_manipulated", client_id: OTHER_CLIENT_ID });
    writeInvoices([...readInvoices(), someoneElses]);

    await expect(mockClientPortalRepository.getClientPortalInvoiceById("cp_invoice_manipulated")).rejects.toThrow(NotFoundError);
  });
});

describe("mockClientPortalRepository.getClientPortalDocuments / getClientPortalDocumentById", () => {
  it("returns only client-visible documents scoped to the current client", async () => {
    const clientVisible = makeDocument({ id: "cp_doc_client", client_id: CURRENT_CLIENT_ID, visibility: "client" });
    const clientAndTeamVisible = makeDocument({ id: "cp_doc_client_and_team", client_id: CURRENT_CLIENT_ID, visibility: "client_and_team" });
    const internalOnly = makeDocument({ id: "cp_doc_internal", client_id: CURRENT_CLIENT_ID, visibility: "internal" });
    const teamOnly = makeDocument({ id: "cp_doc_team", client_id: CURRENT_CLIENT_ID, visibility: "team" });
    const otherClient = makeDocument({ id: "cp_doc_other_client", client_id: OTHER_CLIENT_ID, visibility: "client" });
    const noClientId = makeDocument({ id: "cp_doc_no_client_id", client_id: null, visibility: "client" });
    writeDocuments([...readDocuments(), clientVisible, clientAndTeamVisible, internalOnly, teamOnly, otherClient, noClientId]);

    const documents = await mockClientPortalRepository.getClientPortalDocuments();
    const ids = documents.map((d) => d.id);
    expect(ids).toContain("cp_doc_client");
    expect(ids).toContain("cp_doc_client_and_team");
    expect(ids).not.toContain("cp_doc_internal");
    expect(ids).not.toContain("cp_doc_team");
    expect(ids).not.toContain("cp_doc_other_client");
    expect(ids).not.toContain("cp_doc_no_client_id");
  });

  it("excludes a superseded (non-latest) version even if otherwise client-visible", async () => {
    const superseded = makeDocument({ id: "cp_doc_superseded", client_id: CURRENT_CLIENT_ID, visibility: "client", is_latest_version: false });
    writeDocuments([...readDocuments(), superseded]);

    const documents = await mockClientPortalRepository.getClientPortalDocuments();
    expect(documents.some((d) => d.id === "cp_doc_superseded")).toBe(false);
    await expect(mockClientPortalRepository.getClientPortalDocumentById("cp_doc_superseded")).rejects.toThrow(NotFoundError);
  });

  it("never exposes storage_bucket/storage_path/checksum on the returned DTO, only a derived hasFile boolean", async () => {
    const doc = makeDocument({ id: "cp_doc_storage_check", client_id: CURRENT_CLIENT_ID, visibility: "client", media_asset_id: "media_1" });
    writeDocuments([...readDocuments(), doc]);

    const result = await mockClientPortalRepository.getClientPortalDocumentById("cp_doc_storage_check");
    expect(result).not.toHaveProperty("storage_bucket");
    expect(result).not.toHaveProperty("storage_path");
    expect(result).not.toHaveProperty("checksum");
    expect(result.hasFile).toBe(true);
  });

  it("throws NotFoundError for an internal-only document (manipulated id blocked)", async () => {
    const internalOnly = makeDocument({ id: "cp_doc_manipulated", client_id: CURRENT_CLIENT_ID, visibility: "internal" });
    writeDocuments([...readDocuments(), internalOnly]);

    await expect(mockClientPortalRepository.getClientPortalDocumentById("cp_doc_manipulated")).rejects.toThrow(NotFoundError);
  });

  it("getClientPortalDocumentDownloadUrl fails cleanly for a metadata-only document (no file attached)", async () => {
    const noFile = makeDocument({ id: "cp_doc_no_file", client_id: CURRENT_CLIENT_ID, visibility: "client", media_asset_id: null });
    writeDocuments([...readDocuments(), noFile]);

    const result = await mockClientPortalRepository.getClientPortalDocumentDownloadUrl("cp_doc_no_file");
    expect(result.success).toBe(false);
  });

  it("getClientPortalDocumentDownloadUrl fails for an internal-only document rather than leaking a URL", async () => {
    const internalOnly = makeDocument({ id: "cp_doc_download_manipulated", client_id: CURRENT_CLIENT_ID, visibility: "internal", media_asset_id: "media_1" });
    writeDocuments([...readDocuments(), internalOnly]);

    const result = await mockClientPortalRepository.getClientPortalDocumentDownloadUrl("cp_doc_download_manipulated");
    expect(result.success).toBe(false);
  });
});

describe("mockClientPortalRepository.getClientPortalOverview", () => {
  it("aggregates upcoming event, contracts in progress, outstanding balance, next payment due, and recent documents scoped to the current client only", async () => {
    const soon = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const upcoming = makeEvent({ id: "cp_overview_event", client_id: CURRENT_CLIENT_ID, event_date: soon, status: "confirmed" });
    const inProgressContract = makeContract({ id: "cp_overview_contract", client_id: CURRENT_CLIENT_ID, status: "sent" });
    const dueSoon = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const unpaidInvoice = makeInvoice({ id: "cp_overview_invoice", client_id: CURRENT_CLIENT_ID, balance_minor: 50000, due_date: dueSoon });
    const clientDoc = makeDocument({ id: "cp_overview_doc", client_id: CURRENT_CLIENT_ID, visibility: "client" });
    writeEvents([...readEvents(), upcoming]);
    writeContracts([...readContracts(), inProgressContract]);
    writeInvoices([...readInvoices(), unpaidInvoice]);
    writeDocuments([...readDocuments(), clientDoc]);

    const overview = await mockClientPortalRepository.getClientPortalOverview();
    expect(overview.upcomingEvent?.id).toBe("cp_overview_event");
    expect(overview.contractsInProgress).toBeGreaterThanOrEqual(1);
    // Some seed data for the same client may have an earlier due_date than
    // this test's own fixture, so this only asserts a next-payment-due
    // exists at all (the repository correctly found *some* unpaid
    // invoice), not that it's specifically this test's own row.
    expect(overview.nextPaymentDue).not.toBeNull();
    const invoices = await mockClientPortalRepository.getClientPortalInvoices();
    expect(invoices.some((i) => i.id === "cp_overview_invoice" && i.balance_minor === 50000)).toBe(true);
    expect(overview.recentDocuments.some((d) => d.id === "cp_overview_doc")).toBe(true);
    expect(overview.nextRecommendedAction).not.toBeNull();
  });

  it("never exposes expenses, internal notes, or timeline data anywhere in the overview shape", async () => {
    const overview = await mockClientPortalRepository.getClientPortalOverview();
    expect(overview).not.toHaveProperty("expenses");
    expect(overview).not.toHaveProperty("notes");
    expect(overview).not.toHaveProperty("timeline");
  });
});
