import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({ resolveMemberSessionSnapshot: vi.fn() }));
// v2 Checkpoint 45 — the compiler's own MergeContext ownership check (security fix) now calls
// the real `@/lib/data` accessors for every id-bearing context field; this suite tests document
// health scoring, not real CRM linkage, so `client_1` is stubbed to belong to `ws_1`.
vi.mock("@/lib/data", () => ({
  getClientById: vi.fn().mockResolvedValue({ id: "client_1", workspace_id: "ws_1" }),
  getLeadById: vi.fn().mockRejectedValue(new Error("not used in this suite")),
  getEventById: vi.fn().mockRejectedValue(new Error("not used in this suite")),
  getInvoiceById: vi.fn().mockRejectedValue(new Error("not used in this suite")),
  getContract: vi.fn().mockRejectedValue(new Error("not used in this suite")),
  getVendorById: vi.fn().mockRejectedValue(new Error("not used in this suite")),
}));
vi.mock("@/lib/data/proposals", () => ({ getProposalsRepository: () => ({ getProposalById: vi.fn().mockResolvedValue(null) }) }));

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getComposedDocumentHealthAction, getDocumentBundleHealthAction } from "@/modules/documentTemplates/getDocumentHealthAction";
import { getDocumentsManager } from "@/core/documents/manager";
import { resetDocumentsStore } from "@/lib/data/core/documents/mockRepository";
import { registerMergeField, resetMergeFieldRegistry } from "@/core/documents/mergeFieldRegistry";
import { registerMergeResolver, resetMergeResolvers } from "@/core/documents/mergeEngine";
import type { CreateTemplateInput } from "@/lib/data/core/documents/repository";
import type { MergeContext } from "@/types/documentPlatform";

const session: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: [],
  workspaceDisplayName: "Amoré Bloom",
};

const context: MergeContext = { workspaceId: "ws_1", memberId: "member_1", clientId: "client_1" };

const templateInput: CreateTemplateInput = {
  documentTypeId: "welcome_guide",
  name: "Welcome Guide",
  description: "",
  content: [{ id: "p1", type: "paragraph", runs: [{ text: "Dear {{client_name}}." }] }],
  header: [],
  footer: [],
  variables: [],
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
};

beforeEach(() => {
  resetDocumentsStore();
  resetMergeFieldRegistry();
  resetMergeResolvers();
  registerMergeField({ key: "client_name", label: "Client Name", description: "", domain: "crm", valueType: "string", required: false });
  registerMergeResolver("client_name", async () => "Jordan Ellis");
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("getComposedDocumentHealthAction", () => {
  it("returns an error when the session isn't active", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await getComposedDocumentHealthAction("doc_missing");
    expect(result.success).toBe(false);
  });

  it("returns an error for a document that doesn't exist", async () => {
    const result = await getComposedDocumentHealthAction("doc_missing");
    expect(result.success).toBe(false);
  });

  it("scores a real, freshly-compiled document", async () => {
    const template = await getDocumentsManager().createTemplate("ws_1", "member_1", templateInput);
    if (!template.success) throw new Error("setup failed");
    const compiled = await getDocumentsManager().compileAndCreateDocument(template.data.id, context, { permissions: [], role: null });
    if (!compiled.success) throw new Error("setup failed");

    const result = await getComposedDocumentHealthAction(compiled.document.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.data.categories.length).toBe(3);
  });
});

describe("getDocumentBundleHealthAction", () => {
  it("returns an error for a bundle that doesn't exist", async () => {
    const result = await getDocumentBundleHealthAction("bundle_missing");
    expect(result.success).toBe(false);
  });

  it("scores a real, freshly-created bundle", async () => {
    const bundle = await getDocumentsManager().createDocumentBundle("ws_1", "member_1", { clientId: "client_1", eventId: null, title: "Welcome Packet", description: "" });
    if (!bundle.success) throw new Error("setup failed");

    const result = await getDocumentBundleHealthAction(bundle.data.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.data.categories.length).toBe(4);
  });
});
