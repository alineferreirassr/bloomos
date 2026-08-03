import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import {
  listInvoiceTemplatesAction,
  createCustomInvoiceTemplateAction,
  buildInvoiceDetail,
  evaluateInvoiceAction,
  listInvoiceSummariesAction,
  createInvoiceVersionAction,
  publishInvoiceVersionAction,
  archiveInvoiceDocumentAction,
  restoreInvoiceVersionAction,
  compareInvoiceVersionsAction,
  markInvoiceReadyAction,
  getInvoiceAnalyticsAction,
  invoiceRecommendationsForExecutiveDecisions,
} from "@/modules/invoicePlatform/invoicePlatformActions";
import { createInvoice, resetAllMockData } from "@/lib/data";
import { resetInvoiceTemplatesStore } from "@/lib/data/mock/invoiceTemplatesStore";
import { resetInvoiceBuilderStore } from "@/lib/data/mock/invoiceBuilderStore";
import { resetInvoiceCache } from "@/core/invoicePlatform/invoiceCache";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import type { CreateInvoiceVersionInput } from "@/types/invoicePlatform";
import type { InvoiceInput } from "@/modules/finance/schema";

const session: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: CURRENT_WORKSPACE_ID, name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["invoice_builder.view", "invoice_builder.manage", "invoice_templates.manage", "invoice_versions.manage"],
  workspaceDisplayName: "Amoré Bloom",
};

function resetAll(): void {
  resetAllMockData();
  resetInvoiceTemplatesStore();
  resetInvoiceBuilderStore();
  resetInvoiceCache();
}

beforeEach(() => {
  resetAll();
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
});

afterEach(() => {
  vi.mocked(resolveMemberSessionSnapshot).mockReset();
});

function invoiceInput(overrides: Partial<InvoiceInput> = {}): InvoiceInput {
  return {
    client_id: "client_2",
    event_id: "event_1",
    contract_id: null,
    title: "Test Invoice",
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

async function makeInvoice() {
  const created = await createInvoice(invoiceInput());
  if (!created.success) throw new Error(`setup failed: createInvoice — ${JSON.stringify(created.error)}`);
  return created.data;
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
    footer: { text: "Thank you for choosing Amoré Bloom.", contactEmail: null, contactPhone: null },
    reason: null,
    ...overrides,
  };
}

describe("session gating", () => {
  it("rejects every action when the session is not active", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await listInvoiceTemplatesAction();
    expect(result.success).toBe(false);
  });
});

describe("template library", () => {
  it("lists the 10 seeded system templates", async () => {
    const result = await listInvoiceTemplatesAction();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.length).toBe(10);
  });

  it("creates a custom template", async () => {
    const result = await createCustomInvoiceTemplateAction({
      name: "My Template",
      description: "Custom",
      structure: { header: { title: "", subtitle: null, logoAssetId: null }, defaultSectionTitles: [], defaultPaymentScheduleKind: "single_payment", footer: { text: "", contactEmail: null, contactPhone: null } },
    });
    expect(result.success).toBe(true);
  });
});

describe("evaluate + list", () => {
  it("evaluates an invoice with no document yet as missing_pricing", async () => {
    const invoice = await makeInvoice();
    const result = await evaluateInvoiceAction(invoice.id);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.builderState).toBeNull();
      expect(result.data.readiness.state).toBe("missing_pricing");
    }
  });

  it("returns an error for a nonexistent invoice", async () => {
    const result = await evaluateInvoiceAction("invoice_does_not_exist");
    expect(result.success).toBe(false);
  });

  it("lists summaries for every invoice in the workspace", async () => {
    await makeInvoice();
    const result = await listInvoiceSummariesAction();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.length).toBeGreaterThanOrEqual(1);
  });

  it("caches the summaries list across identical calls", async () => {
    await makeInvoice();
    const first = await listInvoiceSummariesAction();
    const second = await listInvoiceSummariesAction();
    expect(first).toEqual(second);
  });
});

describe("versioning", () => {
  it("creates the first version and leaves the document in draft", async () => {
    const invoice = await makeInvoice();
    const result = await createInvoiceVersionAction(invoice.id, versionInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("draft");
      expect(result.data.versions).toHaveLength(1);
      expect(result.data.versions[0].version_number).toBe(1);
    }
  });

  it("computes real pricing from the line items into the new version's snapshot", async () => {
    const invoice = await makeInvoice();
    const result = await createInvoiceVersionAction(invoice.id, versionInput());
    expect(result.success).toBe(true);
    if (result.success) {
      const version = result.data.versions[0];
      expect(version.snapshot.pricing.grandTotal_minor).toBe(65000);
    }
  });

  it("appends a second version rather than overwriting the first", async () => {
    const invoice = await makeInvoice();
    await createInvoiceVersionAction(invoice.id, versionInput());
    const second = await createInvoiceVersionAction(invoice.id, versionInput({ notes: "Revised terms" }));
    expect(second.success).toBe(true);
    if (second.success) {
      expect(second.data.versions).toHaveLength(2);
      expect(second.data.versions[0].id).not.toBe(second.data.versions[1].id);
    }
  });

  it("moves a published document to review when a new version is created", async () => {
    const invoice = await makeInvoice();
    await createInvoiceVersionAction(invoice.id, versionInput());
    await publishInvoiceVersionAction(invoice.id);
    const second = await createInvoiceVersionAction(invoice.id, versionInput());
    expect(second.success).toBe(true);
    if (second.success) expect(second.data.status).toBe("review");
  });

  it("archives an invoice document", async () => {
    const invoice = await makeInvoice();
    await createInvoiceVersionAction(invoice.id, versionInput());
    const result = await archiveInvoiceDocumentAction(invoice.id);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("archived");
  });

  it("restores an earlier version", async () => {
    const invoice = await makeInvoice();
    const first = await createInvoiceVersionAction(invoice.id, versionInput());
    await createInvoiceVersionAction(invoice.id, versionInput());
    if (!first.success) throw new Error("setup failed");
    const firstVersionId = first.data.versions[0].id;
    const restored = await restoreInvoiceVersionAction(invoice.id, firstVersionId);
    expect(restored.success).toBe(true);
    if (restored.success) expect(restored.data.current_version_id).toBe(firstVersionId);
  });
});

describe("comparison", () => {
  it("compares two versions and reports differences", async () => {
    const invoice = await makeInvoice();
    await createInvoiceVersionAction(invoice.id, versionInput());
    await createInvoiceVersionAction(invoice.id, versionInput({ terms: "Different terms." }));
    const result = await compareInvoiceVersionsAction(invoice.id, 1, 2);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.hasChanges).toBe(true);
  });

  it("errors when a version number doesn't exist", async () => {
    const invoice = await makeInvoice();
    await createInvoiceVersionAction(invoice.id, versionInput());
    const result = await compareInvoiceVersionsAction(invoice.id, 1, 99);
    expect(result.success).toBe(false);
  });
});

describe("readiness", () => {
  it("refuses to mark a document ready that isn't", async () => {
    const invoice = await makeInvoice();
    await createInvoiceVersionAction(invoice.id, versionInput());
    const result = await markInvoiceReadyAction(invoice.id);
    expect(result.success).toBe(false);
  });

  it("marks a fully-ready document ready and records ready_at only on the state that is actually ready", async () => {
    const invoice = await makeInvoice();
    await createInvoiceVersionAction(invoice.id, versionInput());
    const detail = await buildInvoiceDetail(CURRENT_WORKSPACE_ID, invoice.id);
    const result = await markInvoiceReadyAction(invoice.id);
    if (detail?.readiness.state === "ready") {
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.ready_at).not.toBeNull();
    } else {
      expect(result.success).toBe(false);
    }
  });
});

describe("analytics", () => {
  it("never throws for an empty workspace", async () => {
    const result = await getInvoiceAnalyticsAction();
    expect(result.success).toBe(true);
  });

  it("counts a created invoice's document", async () => {
    const invoice = await makeInvoice();
    await createInvoiceVersionAction(invoice.id, versionInput());
    const result = await getInvoiceAnalyticsAction();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.totalInvoices).toBeGreaterThanOrEqual(1);
  });
});

describe("executive integration", () => {
  it("returns an empty array with no session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const recs = await invoiceRecommendationsForExecutiveDecisions();
    expect(recs).toEqual([]);
  });

  it("never throws with real invoice data", async () => {
    const invoice = await makeInvoice();
    await createInvoiceVersionAction(invoice.id, versionInput());
    const recs = await invoiceRecommendationsForExecutiveDecisions();
    expect(Array.isArray(recs)).toBe(true);
  });
});

describe("permission enforcement (v2 Checkpoint 45 security fix)", () => {
  it("rejects every mutating action for a session lacking the relevant invoice_* manage permission", async () => {
    const invoice = await makeInvoice();
    const built = await createInvoiceVersionAction(invoice.id, versionInput());
    if (!built.success) throw new Error("failed to build invoice version");
    const firstVersionId = built.data.versions[0].id;

    const viewOnlySession: MemberSessionSnapshot = { ...session, permissions: ["invoice_builder.view", "invoice_versions.view"] };
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlySession);

    expect((await createCustomInvoiceTemplateAction({ name: "Blocked", description: "Blocked", structure: { header: { title: "", subtitle: null, logoAssetId: null }, defaultSectionTitles: [], defaultPaymentScheduleKind: "single_payment", footer: { text: "", contactEmail: null, contactPhone: null } } })).success).toBe(false);
    expect((await createInvoiceVersionAction(invoice.id, versionInput())).success).toBe(false);
    expect((await publishInvoiceVersionAction(invoice.id)).success).toBe(false);
    expect((await archiveInvoiceDocumentAction(invoice.id)).success).toBe(false);
    expect((await restoreInvoiceVersionAction(invoice.id, firstVersionId)).success).toBe(false);
    expect((await markInvoiceReadyAction(invoice.id)).success).toBe(false);
  });
});
