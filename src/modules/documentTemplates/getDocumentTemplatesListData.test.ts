import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({ resolveMemberSessionSnapshot: vi.fn() }));

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getDocumentTemplatesListData } from "@/modules/documentTemplates/getDocumentTemplatesListData";
import { getDocumentsManager } from "@/core/documents/manager";
import { resetDocumentsStore } from "@/lib/data/core/documents/mockRepository";
import type { CreateTemplateInput } from "@/lib/data/core/documents/repository";

const ownerSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["documents.create"],
  workspaceDisplayName: "Amoré Bloom",
};

const templateInput: CreateTemplateInput = {
  documentTypeId: "contract",
  name: "Wedding Contract",
  description: "",
  content: [],
  header: [],
  footer: [],
  variables: [],
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
};

beforeEach(() => {
  resetDocumentsStore();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("getDocumentTemplatesListData", () => {
  it("returns an error when the session isn't active", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await getDocumentTemplatesListData();
    expect(result.success).toBe(false);
  });

  it("lists all 15 registered document types even with no Templates yet", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
    const result = await getDocumentTemplatesListData();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.documentTypes.length).toBe(15);
    expect(result.data.stats.totalTemplates).toBe(0);
  });

  it("reflects a real, created Template in both the templates list and stats", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
    await getDocumentsManager().createTemplate("ws_1", "user_1", templateInput);

    const result = await getDocumentTemplatesListData();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.stats.totalTemplates).toBe(1);
    expect(result.data.stats.publishedTemplates).toBe(0);
    expect(result.data.templates[0].name).toBe("Wedding Contract");
  });

  it("counts a published Template correctly", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
    const created = await getDocumentsManager().createTemplate("ws_1", "user_1", templateInput);
    if (!created.success) throw new Error("setup failed");
    await getDocumentsManager().publishTemplate(created.data.id);

    const result = await getDocumentTemplatesListData();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.stats.publishedTemplates).toBe(1);
  });

  it("scopes Templates strictly to the caller's own workspace", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
    await getDocumentsManager().createTemplate("ws_other", "user_1", templateInput);

    const result = await getDocumentTemplatesListData();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.templates).toEqual([]);
  });
});
