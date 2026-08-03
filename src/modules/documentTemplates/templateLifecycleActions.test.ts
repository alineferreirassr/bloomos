import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({ resolveMemberSessionSnapshot: vi.fn() }));

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { publishTemplateAction, archiveTemplateAction, unarchiveTemplateAction, duplicateTemplateAction } from "@/modules/documentTemplates/templateLifecycleActions";
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

const staffSession: MemberSessionSnapshot = {
  ...ownerSession,
  membership: { ...ownerSession.membership, role: "staff" },
  permissions: [],
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

describe("templateLifecycleActions", () => {
  it("publishTemplateAction fails for a member without the elevated permission", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
    const created = await getDocumentsManager().createTemplate("ws_1", "user_1", templateInput);
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(staffSession);
    const result = await publishTemplateAction(created.data.id);
    expect(result.success).toBe(false);
  });

  it("publishTemplateAction succeeds for a member with the elevated permission, and the Template really is published", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
    const created = await getDocumentsManager().createTemplate("ws_1", "user_1", templateInput);
    if (!created.success) throw new Error("setup failed");

    const result = await publishTemplateAction(created.data.id);
    expect(result.success).toBe(true);
    const template = await getDocumentsManager().getTemplateById(created.data.id);
    expect(template?.status).toBe("published");
  });

  it("fails for a Template belonging to a different workspace, even with the elevated permission", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
    const created = await getDocumentsManager().createTemplate("ws_other", "user_1", templateInput);
    if (!created.success) throw new Error("setup failed");

    const result = await archiveTemplateAction(created.data.id);
    expect(result.success).toBe(false);
  });

  it("fails gracefully for a nonexistent Template id", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
    const result = await archiveTemplateAction("template_missing");
    expect(result.success).toBe(false);
  });

  it("unarchiveTemplateAction returns a Template to draft when it was never published", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
    const created = await getDocumentsManager().createTemplate("ws_1", "user_1", templateInput);
    if (!created.success) throw new Error("setup failed");
    await archiveTemplateAction(created.data.id);

    const result = await unarchiveTemplateAction(created.data.id);
    expect(result.success).toBe(true);
    const template = await getDocumentsManager().getTemplateById(created.data.id);
    expect(template?.status).toBe("draft");
  });

  it("duplicateTemplateAction creates an independent copy owned by the acting member", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
    const created = await getDocumentsManager().createTemplate("ws_1", "user_1", templateInput);
    if (!created.success) throw new Error("setup failed");

    const result = await duplicateTemplateAction(created.data.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.templateId).not.toBe(created.data.id);
    const duplicated = await getDocumentsManager().getTemplateById(result.templateId);
    expect(duplicated?.createdBy).toBe("user_1");
  });

  it("every action fails when the caller isn't signed in", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await publishTemplateAction("any-id");
    expect(result.success).toBe(false);
  });
});
