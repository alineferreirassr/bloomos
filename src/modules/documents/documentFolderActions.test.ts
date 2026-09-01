import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({ resolveMemberSessionSnapshot: vi.fn() }));

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import {
  createDocumentFolderAction,
  updateDocumentFolderAction,
  moveDocumentFolderAction,
  applyDefaultFolderTemplateAction,
  createDocumentVersionAction,
} from "@/modules/documents/documentActions";
import { createDocumentFolder as repoCreateDocumentFolder, createDocumentMetadata as repoCreateDocumentMetadata } from "@/lib/data";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

const ownerSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: CURRENT_WORKSPACE_ID, name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["documents.view", "documents.create", "documents.update", "documents.archive"],
  workspaceDisplayName: "Amoré Bloom",
};

const managerSession: MemberSessionSnapshot = {
  ...ownerSession,
  membership: { ...ownerSession.membership, id: "member_2", role: "manager" },
  permissions: ["documents.view", "documents.create", "documents.update", "documents.archive"],
};

/** Only `documents.view`, matching Staff's real default in `permissionMatrix.ts`. */
const viewOnlyStaffSession: MemberSessionSnapshot = {
  ...ownerSession,
  membership: { ...ownerSession.membership, id: "member_3", role: "staff" },
  permissions: ["documents.view"],
};

const crossWorkspaceSession: MemberSessionSnapshot = {
  ...ownerSession,
  workspace: { id: "ws_other", name: "Another Workspace" },
  membership: { ...ownerSession.membership, id: "member_4", role: "owner" },
};

async function createTestFolder(name: string) {
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
  const result = await repoCreateDocumentFolder({
    owner_type: "workspace",
    owner_id: CURRENT_WORKSPACE_ID,
    parent_folder_id: null,
    name,
    description: null,
    sort_order: 0,
    visibility: "internal",
  });
  if (!result.success) throw new Error("setup failed");
  return result.data;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("createDocumentFolderAction (Phase 06C)", () => {
  it("rejects a view-only member — this was the confirmed audit gap: create had zero permission check", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlyStaffSession);
    const result = await createDocumentFolderAction({
      owner_type: "workspace",
      owner_id: CURRENT_WORKSPACE_ID,
      parent_folder_id: null,
      name: "Should Not Exist",
      description: null,
      sort_order: 0,
      visibility: "internal",
    });
    expect(result.success).toBe(false);
  });

  it("succeeds for Founder/Owner (documents.create)", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
    const result = await createDocumentFolderAction({
      owner_type: "workspace",
      owner_id: CURRENT_WORKSPACE_ID,
      parent_folder_id: null,
      name: "Founder Folder",
      description: null,
      sort_order: 0,
      visibility: "internal",
    });
    expect(result.success).toBe(true);
  });

  it("succeeds for Manager, granted documents.create by default", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(managerSession);
    const result = await createDocumentFolderAction({
      owner_type: "workspace",
      owner_id: CURRENT_WORKSPACE_ID,
      parent_folder_id: null,
      name: "Manager Folder",
      description: null,
      sort_order: 0,
      visibility: "internal",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unauthenticated caller", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await createDocumentFolderAction({
      owner_type: "workspace",
      owner_id: CURRENT_WORKSPACE_ID,
      parent_folder_id: null,
      name: "Nope",
      description: null,
      sort_order: 0,
      visibility: "internal",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateDocumentFolderAction (Phase 06C)", () => {
  it("rejects a view-only member — this was the confirmed audit gap: update had zero permission check", async () => {
    const folder = await createTestFolder("Rename Target A");
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlyStaffSession);
    const result = await updateDocumentFolderAction(folder.id, {
      name: "Tampered by a viewer",
      description: null,
      sort_order: 0,
      visibility: "internal",
    });
    expect(result.success).toBe(false);
  });

  it("succeeds for Founder/Admin and the rename really happens", async () => {
    const folder = await createTestFolder("Rename Target B");
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
    const result = await updateDocumentFolderAction(folder.id, {
      name: "Renamed by Founder",
      description: null,
      sort_order: 0,
      visibility: "internal",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Renamed by Founder");
  });

  it("succeeds for Manager, granted documents.update by default", async () => {
    const folder = await createTestFolder("Rename Target C");
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(managerSession);
    const result = await updateDocumentFolderAction(folder.id, {
      name: "Renamed by Manager",
      description: null,
      sort_order: 0,
      visibility: "internal",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unauthenticated caller", async () => {
    const folder = await createTestFolder("Rename Target D");
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await updateDocumentFolderAction(folder.id, {
      name: "x",
      description: null,
      sort_order: 0,
      visibility: "internal",
    });
    expect(result.success).toBe(false);
  });

  it("rejects mutation of a folder from a different workspace, even with documents.update", async () => {
    const folder = await createTestFolder("Rename Target E");
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(crossWorkspaceSession);
    const result = await updateDocumentFolderAction(folder.id, {
      name: "Cross-tenant tamper",
      description: null,
      sort_order: 0,
      visibility: "internal",
    });
    expect(result.success).toBe(false);
  });

  it("fails gracefully for a nonexistent folder id even with documents.update", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
    const result = await updateDocumentFolderAction("docfolder_missing", {
      name: "x",
      description: null,
      sort_order: 0,
      visibility: "internal",
    });
    expect(result.success).toBe(false);
  });
});

describe("moveDocumentFolderAction (Phase 06C — same bug class, found during the mandated final sweep)", () => {
  it("rejects a view-only member", async () => {
    const folder = await createTestFolder("Move Target A");
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlyStaffSession);
    const result = await moveDocumentFolderAction(folder.id, null);
    expect(result.success).toBe(false);
  });

  it("succeeds for Founder/Owner", async () => {
    const folder = await createTestFolder("Move Target B");
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
    const result = await moveDocumentFolderAction(folder.id, null);
    expect(result.success).toBe(true);
  });

  it("rejects an unauthenticated caller", async () => {
    const folder = await createTestFolder("Move Target C");
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await moveDocumentFolderAction(folder.id, null);
    expect(result.success).toBe(false);
  });

  it("rejects cross-workspace mutation", async () => {
    const folder = await createTestFolder("Move Target D");
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(crossWorkspaceSession);
    const result = await moveDocumentFolderAction(folder.id, null);
    expect(result.success).toBe(false);
  });
});

describe("applyDefaultFolderTemplateAction (Phase 06C — same bug class, found during the mandated final sweep)", () => {
  it("rejects a view-only member", async () => {
    const folder = await createTestFolder("Template Target A");
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlyStaffSession);
    const result = await applyDefaultFolderTemplateAction({
      ownerType: folder.owner_type,
      ownerId: folder.owner_id,
      templateKind: "client",
      parentFolderId: folder.id,
    });
    expect(result.success).toBe(false);
  });

  it("succeeds for Founder/Owner", async () => {
    const folder = await createTestFolder("Template Target B");
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
    const result = await applyDefaultFolderTemplateAction({
      ownerType: folder.owner_type,
      ownerId: folder.owner_id,
      templateKind: "client",
      parentFolderId: folder.id,
    });
    expect(result.success).toBe(true);
  });

  it("rejects cross-workspace parentFolderId, even with documents.create", async () => {
    const folder = await createTestFolder("Template Target C");
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(crossWorkspaceSession);
    const result = await applyDefaultFolderTemplateAction({
      ownerType: folder.owner_type,
      ownerId: folder.owner_id,
      templateKind: "client",
      parentFolderId: folder.id,
    });
    expect(result.success).toBe(false);
  });
});

describe("createDocumentVersionAction (Phase 06C — UI/server permission consistency)", () => {
  async function createTestDocument(title: string) {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
    const result = await repoCreateDocumentMetadata({
      owner_type: "workspace",
      owner_id: CURRENT_WORKSPACE_ID,
      folder_id: null,
      title,
      description: null,
      category: "internal",
      visibility: "internal",
      media_asset_id: null,
      expires_at: null,
      uploaded_by: null,
      contract_exhibit_id: null,
      event_id: null,
      client_id: null,
      contract_id: null,
      invoice_id: null,
      payment_id: null,
      expense_id: null,
    });
    if (!result.success) throw new Error("setup failed");
    return result.data;
  }

  it("uses documents.create — the same permission the 'Add New Version' UI button has always checked", async () => {
    const document = await createTestDocument("Version Target A");
    // A member with documents.update but NOT documents.create must be rejected — proves the
    // server no longer accepts the old (inconsistent) documents.update gate.
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({
      ...ownerSession,
      membership: { ...ownerSession.membership, id: "member_5", role: "staff" },
      permissions: ["documents.view", "documents.update"],
    });
    const result = await createDocumentVersionAction({
      document_id: document.id,
      media_asset_id: null,
      uploaded_by: null,
    });
    expect(result.success).toBe(false);
  });

  it("succeeds for a member holding documents.create", async () => {
    const document = await createTestDocument("Version Target B");
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
    const result = await createDocumentVersionAction({
      document_id: document.id,
      media_asset_id: null,
      uploaded_by: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a view-only member", async () => {
    const document = await createTestDocument("Version Target C");
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlyStaffSession);
    const result = await createDocumentVersionAction({
      document_id: document.id,
      media_asset_id: null,
      uploaded_by: null,
    });
    expect(result.success).toBe(false);
  });
});
