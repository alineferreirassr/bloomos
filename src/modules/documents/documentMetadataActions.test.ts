import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({ resolveMemberSessionSnapshot: vi.fn() }));

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { createDocumentMetadataAction, updateDocumentMetadataAction } from "@/modules/documents/documentActions";
import { createDocumentFolder as repoCreateDocumentFolder } from "@/lib/data";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import type { DocumentMetadataInput } from "@/modules/documents/schema";

const ownerSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: CURRENT_WORKSPACE_ID, name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["documents.view", "documents.create", "documents.update", "documents.archive"],
  workspaceDisplayName: "Amoré Bloom",
};

const adminSession: MemberSessionSnapshot = {
  ...ownerSession,
  membership: { ...ownerSession.membership, id: "member_admin", role: "admin" },
};

/** Manager's real default from permissionMatrix.ts includes documents.create/documents.update. */
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

function baseCreateInput(overrides: Partial<DocumentMetadataInput> = {}): DocumentMetadataInput {
  return {
    owner_type: "workspace",
    owner_id: CURRENT_WORKSPACE_ID,
    folder_id: null,
    title: "New Document",
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
    ...overrides,
  };
}

async function createTestDocument(title: string) {
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
  const result = await createDocumentMetadataAction(baseCreateInput({ title }));
  if (!result.success) throw new Error("setup failed");
  return result.data;
}

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

describe("createDocumentMetadataAction (Phase 06D)", () => {
  it("rejects a view-only member — this was the confirmed Phase 06C audit gap: zero permission check", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlyStaffSession);
    const result = await createDocumentMetadataAction(baseCreateInput());
    expect(result.success).toBe(false);
  });

  it("succeeds for Founder/Owner (documents.create)", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
    const result = await createDocumentMetadataAction(baseCreateInput({ title: "Founder Doc" }));
    expect(result.success).toBe(true);
  });

  it("succeeds for Admin (documents.create)", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(adminSession);
    const result = await createDocumentMetadataAction(baseCreateInput({ title: "Admin Doc" }));
    expect(result.success).toBe(true);
  });

  it("succeeds for Manager, granted documents.create by default in permissionMatrix.ts", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(managerSession);
    const result = await createDocumentMetadataAction(baseCreateInput({ title: "Manager Doc" }));
    expect(result.success).toBe(true);
  });

  it("rejects an unauthenticated caller", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await createDocumentMetadataAction(baseCreateInput());
    expect(result.success).toBe(false);
  });

  it("rejects a folder_id belonging to a different workspace", async () => {
    const folder = await createTestFolder("Create-Target Folder");
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(crossWorkspaceSession);
    const result = await createDocumentMetadataAction(baseCreateInput({ folder_id: folder.id }));
    expect(result.success).toBe(false);
  });

  it("cannot be used to spoof a workspace — DocumentMetadataInput carries no workspace_id field for a client to supply", () => {
    const input = baseCreateInput();
    expect(input).not.toHaveProperty("workspace_id");
  });
});

describe("updateDocumentMetadataAction (Phase 06D)", () => {
  it("rejects a view-only member — this was the confirmed Phase 06C audit gap: zero permission check", async () => {
    const document = await createTestDocument("Update Target A");
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlyStaffSession);
    const result = await updateDocumentMetadataAction(document.id, {
      title: "Tampered by a viewer",
      description: null,
      category: "internal",
      expires_at: null,
    });
    expect(result.success).toBe(false);
  });

  it("succeeds for Founder/Owner and the edit really happens", async () => {
    const document = await createTestDocument("Update Target B");
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
    const result = await updateDocumentMetadataAction(document.id, {
      title: "Renamed by Founder",
      description: null,
      category: "internal",
      expires_at: null,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBe("Renamed by Founder");
  });

  it("succeeds for Admin", async () => {
    const document = await createTestDocument("Update Target B2");
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(adminSession);
    const result = await updateDocumentMetadataAction(document.id, {
      title: "Renamed by Admin",
      description: null,
      category: "internal",
      expires_at: null,
    });
    expect(result.success).toBe(true);
  });

  it("succeeds for Manager, granted documents.update by default in permissionMatrix.ts", async () => {
    const document = await createTestDocument("Update Target C");
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(managerSession);
    const result = await updateDocumentMetadataAction(document.id, {
      title: "Renamed by Manager",
      description: null,
      category: "internal",
      expires_at: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unauthenticated caller", async () => {
    const document = await createTestDocument("Update Target D");
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await updateDocumentMetadataAction(document.id, {
      title: "x",
      description: null,
      category: "internal",
      expires_at: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects mutation of a Document from a different workspace, even with documents.update", async () => {
    const document = await createTestDocument("Update Target E");
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(crossWorkspaceSession);
    const result = await updateDocumentMetadataAction(document.id, {
      title: "Cross-tenant tamper",
      description: null,
      category: "internal",
      expires_at: null,
    });
    expect(result.success).toBe(false);
  });

  it("fails gracefully for a nonexistent Document id even with documents.update", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
    const result = await updateDocumentMetadataAction("document_missing", {
      title: "x",
      description: null,
      category: "internal",
      expires_at: null,
    });
    expect(result.success).toBe(false);
  });

  it("DocumentMetadataUpdateInput carries no folder_id — folder reassignment is not reachable through this action (it's handled by the already-protected moveDocumentToFolderAction)", async () => {
    const document = await createTestDocument("Update Target F");
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
    const input = { title: document.title, description: null, category: "internal" as const, expires_at: null };
    expect(input).not.toHaveProperty("folder_id");
  });
});
