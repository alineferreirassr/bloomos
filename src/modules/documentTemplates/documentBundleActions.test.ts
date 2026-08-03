import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({ resolveMemberSessionSnapshot: vi.fn() }));

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import {
  createDocumentBundleAction,
  listDocumentBundlesForClientAction,
  getDocumentBundleDetailAction,
  addDocumentBundleItemAction,
  removeDocumentBundleItemAction,
  updateDocumentBundleStatusAction,
} from "@/modules/documentTemplates/documentBundleActions";
import { getDocumentsManager } from "@/core/documents/manager";
import { resetDocumentsStore } from "@/lib/data/core/documents/mockRepository";

const session: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["documents.create", "documents.update"],
  workspaceDisplayName: "Amoré Bloom",
};

const sessionNoPermissions: MemberSessionSnapshot = { ...session, permissions: [] };

beforeEach(() => {
  resetDocumentsStore();
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
});

afterEach(() => {
  vi.clearAllMocks();
});

async function makeBundle() {
  const created = await getDocumentsManager().createDocumentBundle("ws_1", "member_1", {
    clientId: "client_1",
    eventId: null,
    title: "Welcome Packet",
    description: "",
  });
  if (!created.success) throw new Error("setup failed");
  return created.data;
}

describe("createDocumentBundleAction", () => {
  it("returns an error when the session isn't active", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await createDocumentBundleAction({ clientId: "client_1", eventId: null, title: "New Bundle", description: "" });
    expect(result.success).toBe(false);
  });

  it("returns an error without documents.create permission", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionNoPermissions);
    const result = await createDocumentBundleAction({ clientId: "client_1", eventId: null, title: "New Bundle", description: "" });
    expect(result.success).toBe(false);
  });

  it("creates a real bundle via the DocumentsManager", async () => {
    const result = await createDocumentBundleAction({ clientId: "client_1", eventId: null, title: "New Bundle", description: "" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.title).toBe("New Bundle");
    expect(result.data.status).toBe("draft");
  });
});

describe("listDocumentBundlesForClientAction", () => {
  it("returns an error when the session isn't active", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await listDocumentBundlesForClientAction("client_1");
    expect(result.success).toBe(false);
  });

  it("lists bundles for the given client", async () => {
    await makeBundle();
    const result = await listDocumentBundlesForClientAction("client_1");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.length).toBe(1);
  });
});

describe("getDocumentBundleDetailAction", () => {
  it("returns an error for a bundle that doesn't exist", async () => {
    const result = await getDocumentBundleDetailAction("bundle_missing");
    expect(result.success).toBe(false);
  });

  it("returns an error for a bundle owned by another workspace", async () => {
    const bundle = await makeBundle();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...session, workspace: { id: "ws_other", name: "Other Workspace" } });
    const result = await getDocumentBundleDetailAction(bundle.id);
    expect(result.success).toBe(false);
  });

  it("returns bundle, resolved items, and health for an owned bundle", async () => {
    const bundle = await makeBundle();
    const result = await getDocumentBundleDetailAction(bundle.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.bundle.id).toBe(bundle.id);
    expect(result.data.resolvedItems).toEqual([]);
    expect(result.data.health.categories.length).toBeGreaterThan(0);
  });
});

describe("addDocumentBundleItemAction / removeDocumentBundleItemAction", () => {
  it("returns an error without documents.update permission", async () => {
    const bundle = await makeBundle();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionNoPermissions);
    const result = await addDocumentBundleItemAction(bundle.id, "proposal", "proposal_1");
    expect(result.success).toBe(false);
  });

  it("returns an error for a bundle that doesn't exist", async () => {
    const result = await addDocumentBundleItemAction("bundle_missing", "proposal", "proposal_1");
    expect(result.success).toBe(false);
  });

  it("adds then removes a real item on the bundle", async () => {
    const bundle = await makeBundle();
    const added = await addDocumentBundleItemAction(bundle.id, "proposal", "proposal_1");
    expect(added.success).toBe(true);
    if (!added.success) return;
    expect(added.data.items.length).toBe(1);

    const removed = await removeDocumentBundleItemAction(bundle.id, added.data.items[0].id);
    expect(removed.success).toBe(true);
    if (!removed.success) return;
    expect(removed.data.items.length).toBe(0);
  });
});

describe("updateDocumentBundleStatusAction", () => {
  it("returns an error without documents.update permission", async () => {
    const bundle = await makeBundle();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionNoPermissions);
    const result = await updateDocumentBundleStatusAction(bundle.id, "ready");
    expect(result.success).toBe(false);
  });

  it("advances a real bundle's status", async () => {
    const bundle = await makeBundle();
    const result = await updateDocumentBundleStatusAction(bundle.id, "ready");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("ready");
  });
});
