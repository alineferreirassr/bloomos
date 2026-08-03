import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/documents/manager", () => ({
  getDocumentsManager: vi.fn(),
}));
vi.mock("@/lib/data/clientPortal/clientPortalActivityStore", () => ({
  listClientPortalActivityForWorkspace: vi.fn(),
}));
vi.mock("@/lib/data/clientPortal/clientDocumentApprovalStore", () => ({
  listClientDocumentApprovalsForWorkspace: vi.fn(),
}));

import { getDocumentsManager } from "@/core/documents/manager";
import { listClientPortalActivityForWorkspace } from "@/lib/data/clientPortal/clientPortalActivityStore";
import { listClientDocumentApprovalsForWorkspace } from "@/lib/data/clientPortal/clientDocumentApprovalStore";
import { getMetric } from "@/core/analytics/metricRegistry";
import { registerDocumentMetrics } from "@/modules/analytics/metrics/documentMetrics";
import type { MetricComputeContext } from "@/types/analytics";

registerDocumentMetrics();

const WINDOW = { start: "2026-07-01T00:00:00.000Z", end: "2026-07-15T00:00:00.000Z" };
const PREVIOUS_WINDOW = { start: "2026-06-17T00:00:00.000Z", end: "2026-07-01T00:00:00.000Z" };
const CONTEXT: MetricComputeContext = { workspaceId: "ws_1", window: WINDOW, previousWindow: PREVIOUS_WINDOW, permissions: [], role: "owner" };

const listTemplates = vi.fn();
const listComposedDocuments = vi.fn();

afterEach(() => {
  vi.clearAllMocks();
});

describe("documents.templates", () => {
  it("is a current-total snapshot, not window-filtered", async () => {
    vi.mocked(getDocumentsManager).mockReturnValue({ listTemplates, listComposedDocuments } as never);
    listTemplates.mockResolvedValue([{ id: "t1" }, { id: "t2" }]);
    const result = await getMetric("documents.templates")!.compute(CONTEXT);
    expect(result.value).toBe(2);
    expect(result.previousValue).toBeNull();
  });
});

describe("documents.generated", () => {
  it("counts Documents compiled within the window", async () => {
    vi.mocked(getDocumentsManager).mockReturnValue({ listTemplates, listComposedDocuments } as never);
    listComposedDocuments.mockResolvedValue([{ id: "d1", createdAt: "2026-07-05T00:00:00.000Z" }, { id: "d2", createdAt: "2026-06-20T00:00:00.000Z" }]);
    const result = await getMetric("documents.generated")!.compute(CONTEXT);
    expect(result.value).toBe(1);
  });
});

describe("documents.downloads / documents.views", () => {
  it("reads the Client Portal Activity log, filtered by kind", async () => {
    vi.mocked(listClientPortalActivityForWorkspace).mockReturnValue([
      { id: "a1", workspace_id: "ws_1", client_account_id: "acc_1", kind: "document_downloaded", entity_id: null, entity_label: null, occurred_at: "2026-07-05T00:00:00.000Z" },
      { id: "a2", workspace_id: "ws_1", client_account_id: "acc_1", kind: "document_viewed", entity_id: null, entity_label: null, occurred_at: "2026-07-06T00:00:00.000Z" },
    ] as never);
    const downloads = await getMetric("documents.downloads")!.compute(CONTEXT);
    const views = await getMetric("documents.views")!.compute(CONTEXT);
    expect(downloads.value).toBe(1);
    expect(views.value).toBe(1);
  });
});

describe("documents.portalApprovals", () => {
  it("computes the approved share of decided approvals only, ignoring undecided ones", async () => {
    vi.mocked(listClientDocumentApprovalsForWorkspace).mockReturnValue([
      { id: "ap1", workspace_id: "ws_1", document_id: "d1", client_account_id: "acc_1", status: "approved", comment: null, decided_at: "2026-07-05T00:00:00.000Z", created_at: "", updated_at: "" },
      { id: "ap2", workspace_id: "ws_1", document_id: "d2", client_account_id: "acc_1", status: "rejected", comment: null, decided_at: "2026-07-06T00:00:00.000Z", created_at: "", updated_at: "" },
      { id: "ap3", workspace_id: "ws_1", document_id: "d3", client_account_id: "acc_1", status: "pending", comment: null, decided_at: null, created_at: "", updated_at: "" },
    ] as never);
    const result = await getMetric("documents.portalApprovals")!.compute(CONTEXT);
    expect(result.value).toBe(50);
  });
});
