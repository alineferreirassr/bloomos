import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data", () => ({
  getInvoiceById: vi.fn(),
  getCurrentClientAccountContext: vi.fn(),
}));

vi.mock("@/core/documents/manager", () => ({
  getDocumentsManager: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { getClientPortalReceiptForInvoice } from "@/modules/clientPortal/getClientPortalReceiptAction";
import { getInvoiceById, getCurrentClientAccountContext } from "@/lib/data";
import { getDocumentsManager } from "@/core/documents/manager";

const INVOICE = { id: "invoice_1", workspace_id: "ws_1", client_id: "client_1" };
const CONTEXT = { account: { id: "account_1", workspace_id: "ws_1", client_id: "client_1" }, clientName: "Jane Doe", workspaceName: "Amoré Bloom" };

function receipt(overrides: Partial<{ documentTypeId: string; mergeContext: Record<string, unknown>; updatedAt: string; content: unknown }> = {}) {
  return {
    id: "doc_1",
    documentTypeId: "receipt",
    mergeContext: { invoiceId: "invoice_1" },
    updatedAt: "2026-01-01T00:00:00.000Z",
    content: [{ type: "paragraph", runs: [{ text: "Paid in full." }] }],
    ...overrides,
  };
}

describe("getClientPortalReceiptForInvoice", () => {
  it("rejects when there is no resolvable client session", async () => {
    vi.mocked(getCurrentClientAccountContext).mockResolvedValue(null);
    const result = await getClientPortalReceiptForInvoice("invoice_1");
    expect(result.success).toBe(false);
  });

  it("rejects when the invoice belongs to a different workspace or client than the resolved session", async () => {
    vi.mocked(getCurrentClientAccountContext).mockResolvedValue(CONTEXT as never);
    vi.mocked(getInvoiceById).mockResolvedValue({ ...INVOICE, client_id: "someone_else" } as never);
    const result = await getClientPortalReceiptForInvoice("invoice_1");
    expect(result.success).toBe(false);
  });

  it("rejects when the invoice cannot be found", async () => {
    vi.mocked(getCurrentClientAccountContext).mockResolvedValue(CONTEXT as never);
    vi.mocked(getInvoiceById).mockRejectedValue(new Error("not found"));
    const result = await getClientPortalReceiptForInvoice("invoice_1");
    expect(result.success).toBe(false);
  });

  it("returns null text when no receipt has been compiled yet", async () => {
    vi.mocked(getCurrentClientAccountContext).mockResolvedValue(CONTEXT as never);
    vi.mocked(getInvoiceById).mockResolvedValue(INVOICE as never);
    vi.mocked(getDocumentsManager).mockReturnValue({ listComposedDocuments: vi.fn().mockResolvedValue([]) } as never);
    const result = await getClientPortalReceiptForInvoice("invoice_1");
    expect(result).toEqual({ success: true, text: null });
  });

  it("renders the most recently updated matching receipt as plain text", async () => {
    vi.mocked(getCurrentClientAccountContext).mockResolvedValue(CONTEXT as never);
    vi.mocked(getInvoiceById).mockResolvedValue(INVOICE as never);
    vi.mocked(getDocumentsManager).mockReturnValue({
      listComposedDocuments: vi.fn().mockResolvedValue([
        receipt({ updatedAt: "2026-01-01T00:00:00.000Z" }),
        receipt({ updatedAt: "2026-02-01T00:00:00.000Z" }),
      ]),
    } as never);
    const result = await getClientPortalReceiptForInvoice("invoice_1");
    expect(result.success).toBe(true);
    if (result.success) expect(result.text).toContain("Paid in full.");
  });
});
