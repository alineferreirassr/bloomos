import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { createInvoice, resetAllMockData } from "@/lib/data";
import { getClientPortalInvoiceDocumentAction, compareClientPortalInvoiceVersionsAction } from "@/modules/clientPortal/getClientPortalInvoiceDocument";
import { createInvoiceVersionAction, publishInvoiceVersionAction } from "@/modules/invoicePlatform/invoicePlatformActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resetInvoiceTemplatesStore } from "@/lib/data/mock/invoiceTemplatesStore";
import { resetInvoiceBuilderStore } from "@/lib/data/mock/invoiceBuilderStore";
import { resetInvoiceCache } from "@/core/invoicePlatform/invoiceCache";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import { readClientAccounts, writeClientAccounts, resetClientAccountsStore, MOCK_CURRENT_CLIENT_ACCOUNT_ID } from "@/lib/data/mock/clientAccountsStore";
import type { InvoiceInput } from "@/modules/finance/schema";
import type { CreateInvoiceVersionInput } from "@/types/invoicePlatform";

const memberSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: CURRENT_WORKSPACE_ID, name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["invoice_builder.view", "invoice_builder.manage", "invoice_versions.manage"],
  workspaceDisplayName: "Amoré Bloom",
};

function resetAll(): void {
  resetAllMockData();
  resetInvoiceTemplatesStore();
  resetInvoiceBuilderStore();
  resetInvoiceCache();
}

function invoiceInput(overrides: Partial<InvoiceInput> = {}): InvoiceInput {
  return {
    client_id: "client_2",
    event_id: "event_1",
    contract_id: null,
    title: "Test Portal Invoice",
    description: null,
    issue_date: "2026-07-31",
    due_date: "2026-08-14",
    subtotal_minor: 65000,
    tax_minor: 0,
    discount_minor: 0,
    currency: "USD",
    notes: null,
    ...overrides,
  };
}

function versionInput(overrides: Partial<CreateInvoiceVersionInput> = {}): CreateInvoiceVersionInput {
  return {
    templateId: null,
    templateKey: "luxury_event",
    header: { title: "Luxury Event Invoice", subtitle: null, logoAssetId: null },
    sections: [{ id: "sec_1", title: "Services", isCustom: false }],
    lineItems: [{ id: "li_1", sectionId: "sec_1", kind: "service", label: "Luxury Picnic Package", description: null, quantity: 1, unitPrice_minor: 65000, amount_minor: 65000 }],
    adjustments: [],
    paymentSchedule: [{ id: "inst_1", kind: "final_payment", label: "Payment in Full", dueDate: null, amount_minor: 65000 }],
    terms: "Standard terms apply.",
    policies: "Standard cancellation policy applies.",
    notes: "",
    footer: { text: "Thank you.", contactEmail: null, contactPhone: null },
    reason: null,
    ...overrides,
  };
}

/** Mock mode has no real Client Portal auth — the seeded `MOCK_CURRENT_CLIENT_ACCOUNT_ID` account stands in for "the current client," matching `getClientPortalContract.test.ts`'s own precedent. */
function pointCurrentClientAccountAt(clientId: string): void {
  const accounts = readClientAccounts();
  writeClientAccounts(accounts.map((a) => (a.id === MOCK_CURRENT_CLIENT_ACCOUNT_ID ? { ...a, client_id: clientId, workspace_id: CURRENT_WORKSPACE_ID, status: "active" as const } : a)));
}

async function makePublishedInvoice(): Promise<{ invoiceId: string; clientId: string }> {
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(memberSession);
  const created = await createInvoice(invoiceInput(), crypto.randomUUID());
  if (!created.success) throw new Error(`setup failed: createInvoice — ${JSON.stringify(created.error)}`);
  await createInvoiceVersionAction(created.data.id, versionInput());
  await publishInvoiceVersionAction(created.data.id);
  return { invoiceId: created.data.id, clientId: created.data.client_id };
}

beforeEach(() => {
  resetAll();
  resetClientAccountsStore();
});

afterEach(() => {
  vi.mocked(resolveMemberSessionSnapshot).mockReset();
});

describe("getClientPortalInvoiceDocumentAction", () => {
  it("rejects when the current client account has no matching invoice", async () => {
    pointCurrentClientAccountAt("client_with_nothing");
    const result = await getClientPortalInvoiceDocumentAction("invoice_nonexistent");
    expect(result.success).toBe(false);
  });

  it("rejects an invoice belonging to a different client", async () => {
    const { invoiceId } = await makePublishedInvoice();
    pointCurrentClientAccountAt("client_someone_else");
    const result = await getClientPortalInvoiceDocumentAction(invoiceId);
    expect(result.success).toBe(false);
  });

  it("rejects a document that has not been published yet", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(memberSession);
    const created = await createInvoice(invoiceInput(), crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    await createInvoiceVersionAction(created.data.id, versionInput());
    pointCurrentClientAccountAt(created.data.client_id);
    const result = await getClientPortalInvoiceDocumentAction(created.data.id);
    expect(result.success).toBe(false);
  });

  it("returns the client-safe document for a published invoice, with real computed pricing", async () => {
    const { invoiceId, clientId } = await makePublishedInvoice();
    pointCurrentClientAccountAt(clientId);
    const result = await getClientPortalInvoiceDocumentAction(invoiceId);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currentVersionNumber).toBe(1);
      expect(result.data.documentStatus).toBe("published");
      expect(result.data.pricing.grandTotal_minor).toBe(65000);
      expect(result.data.lineItems).toHaveLength(1);
      expect(result.data.paymentSchedule).toHaveLength(1);
    }
  });
});

describe("compareClientPortalInvoiceVersionsAction", () => {
  it("compares two versions for the owning client", async () => {
    const { invoiceId, clientId } = await makePublishedInvoice();
    // A new version moves the document out of "published" back to "review" —
    // republish so the client-visibility gate (`status === "published"`) still
    // passes, matching the same rule `getClientPortalInvoiceDocumentAction`
    // enforces.
    await createInvoiceVersionAction(invoiceId, versionInput({ terms: "Different terms." }));
    await publishInvoiceVersionAction(invoiceId);
    pointCurrentClientAccountAt(clientId);
    const result = await compareClientPortalInvoiceVersionsAction(invoiceId, 1, 2);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.hasChanges).toBe(true);
  });

  it("errors for a nonexistent version", async () => {
    const { invoiceId, clientId } = await makePublishedInvoice();
    pointCurrentClientAccountAt(clientId);
    const result = await compareClientPortalInvoiceVersionsAction(invoiceId, 1, 99);
    expect(result.success).toBe(false);
  });
});
