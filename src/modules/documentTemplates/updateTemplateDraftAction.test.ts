import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({ resolveMemberSessionSnapshot: vi.fn() }));

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { updateTemplateDraftAction } from "@/modules/documentTemplates/updateTemplateDraftAction";
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

const managerSession: MemberSessionSnapshot = {
  ...ownerSession,
  membership: { ...ownerSession.membership, id: "member_2", role: "manager" },
  permissions: ["documents.create"],
};

/** Only `documents.view`, matching Staff's real default in `permissionMatrix.ts` — has never been granted `documents.create`. */
const viewOnlyStaffSession: MemberSessionSnapshot = {
  ...ownerSession,
  membership: { ...ownerSession.membership, id: "member_3", role: "staff" },
  permissions: ["documents.view"],
};

const crossWorkspaceSession: MemberSessionSnapshot = {
  ...ownerSession,
  workspace: { id: "ws_other", name: "Another Workspace" },
  membership: { ...ownerSession.membership, id: "member_4", role: "owner" },
  permissions: ["documents.create"],
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

describe("updateTemplateDraftAction — security regression (Phase 06B)", () => {
  it("rejects a view-only member — this is the bug the audit found: autosave had zero permission check", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
    const created = await getDocumentsManager().createTemplate("ws_1", "user_1", templateInput);
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlyStaffSession);
    const result = await updateTemplateDraftAction(created.data.id, { name: "Tampered by a viewer" });
    expect(result.success).toBe(false);

    const template = await getDocumentsManager().getTemplateById(created.data.id);
    expect(template?.name).toBe("Wedding Contract");
  });

  it("succeeds for a member holding documents.create (Founder), and the draft really is updated", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
    const created = await getDocumentsManager().createTemplate("ws_1", "user_1", templateInput);
    if (!created.success) throw new Error("setup failed");

    const result = await updateTemplateDraftAction(created.data.id, { name: "Wedding Contract v2" });
    expect(result.success).toBe(true);
    const template = await getDocumentsManager().getTemplateById(created.data.id);
    expect(template?.name).toBe("Wedding Contract v2");
  });

  it("succeeds for Manager, who is granted documents.create by default", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
    const created = await getDocumentsManager().createTemplate("ws_1", "user_1", templateInput);
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(managerSession);
    const result = await updateTemplateDraftAction(created.data.id, { description: "Updated by Manager" });
    expect(result.success).toBe(true);
  });

  it("rejects an unauthenticated caller", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await updateTemplateDraftAction("any-id", { name: "x" });
    expect(result.success).toBe(false);
  });

  it("rejects mutation of a Template belonging to a different workspace, even with documents.create", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
    const created = await getDocumentsManager().createTemplate("ws_1", "user_1", templateInput);
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(crossWorkspaceSession);
    const result = await updateTemplateDraftAction(created.data.id, { name: "Cross-tenant tamper" });
    expect(result.success).toBe(false);

    const template = await getDocumentsManager().getTemplateById(created.data.id);
    expect(template?.name).toBe("Wedding Contract");
  });

  it("fails gracefully for a nonexistent Template id even with documents.create", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
    const result = await updateTemplateDraftAction("template_missing", { name: "x" });
    expect(result.success).toBe(false);
  });
});
