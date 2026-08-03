import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({ resolveMemberSessionSnapshot: vi.fn() }));
vi.mock("@/lib/data", () => ({ getContract: vi.fn(), getInvoiceById: vi.fn() }));
vi.mock("@/lib/data/proposals", () => ({ getProposalsRepository: vi.fn() }));

import { resolveBundleItems } from "@/core/documents/bundleResolver";
import { getDocumentsManager } from "@/core/documents/manager";
import { resetDocumentsStore } from "@/lib/data/core/documents/mockRepository";
import { getContract, getInvoiceById } from "@/lib/data";
import { getProposalsRepository } from "@/lib/data/proposals";
import type { DocumentBundleItem, MergeContext } from "@/types/documentPlatform";

const context: MergeContext = { workspaceId: "ws_1", memberId: "member_1" };
const openPermissions = { permissions: [], role: null };

beforeEach(() => {
  resetDocumentsStore();
  vi.mocked(getContract).mockResolvedValue({ id: "contract_1", contract_number: "CON-1001", status: "sent" } as never);
  vi.mocked(getInvoiceById).mockResolvedValue({ id: "invoice_1", invoice_number: "INV-1001", status: "sent" } as never);
  vi.mocked(getProposalsRepository).mockReturnValue({
    getProposalById: vi.fn().mockResolvedValue({ id: "proposal_1", status: "accepted", version: 2 }),
  } as never);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("resolveBundleItems", () => {
  it("resolves a composed_document item to its own real title/status", async () => {
    const created = await getDocumentsManager().createTemplate("ws_1", "member_1", {
      documentTypeId: "contract",
      name: "Wedding Contract",
      description: "",
      content: [{ id: "p1", type: "paragraph", runs: [{ text: "Hello." }] }],
      header: [],
      footer: [],
      variables: [],
      requiredPermissions: [],
      featureFlag: null,
      minimumRole: null,
    });
    if (!created.success) throw new Error("setup failed");
    const compiled = await getDocumentsManager().compileAndCreateDocument(created.data.id, context, openPermissions);
    if (!compiled.success) throw new Error("setup failed");

    const items: DocumentBundleItem[] = [{ id: "item_1", kind: "composed_document", refId: compiled.document.id, addedAt: "2026-08-01T00:00:00Z" }];
    const resolved = await resolveBundleItems(items);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].available).toBe(true);
    expect(resolved[0].title).toBe(compiled.document.metadata.title);
  });

  it("resolves proposal/contract/invoice items to their own real display summaries", async () => {
    const items: DocumentBundleItem[] = [
      { id: "item_1", kind: "proposal", refId: "proposal_1", addedAt: "2026-08-01T00:00:00Z" },
      { id: "item_2", kind: "contract", refId: "contract_1", addedAt: "2026-08-01T00:00:00Z" },
      { id: "item_3", kind: "invoice", refId: "invoice_1", addedAt: "2026-08-01T00:00:00Z" },
    ];
    const resolved = await resolveBundleItems(items);
    expect(resolved[0]).toMatchObject({ title: "Proposal v2", subtitle: "accepted", available: true });
    expect(resolved[1]).toMatchObject({ title: "CON-1001", subtitle: "sent", available: true });
    expect(resolved[2]).toMatchObject({ title: "INV-1001", subtitle: "sent", available: true });
  });

  it("marks an item unavailable (never throws) when its referenced record no longer exists", async () => {
    const items: DocumentBundleItem[] = [{ id: "item_1", kind: "composed_document", refId: "does-not-exist", addedAt: "2026-08-01T00:00:00Z" }];
    const resolved = await resolveBundleItems(items);
    expect(resolved[0]).toMatchObject({ available: false, title: "No longer available" });
  });
});
