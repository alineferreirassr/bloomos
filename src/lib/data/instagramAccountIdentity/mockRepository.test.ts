import { afterEach, describe, expect, it } from "vitest";
import { mockInstagramAccountIdentityRepository, resetInstagramAccountIdentitiesStore } from "@/lib/data/instagramAccountIdentity/mockRepository";
import type { UpsertInstagramAccountIdentityInput } from "@/lib/data/instagramAccountIdentity/repository";

function stubInput(overrides: Partial<UpsertInstagramAccountIdentityInput> = {}): UpsertInstagramAccountIdentityInput {
  return {
    workspaceId: "ws_1",
    connectionId: "connection_1",
    instagramAccountId: "17841400000000000",
    instagramUsername: "amorebloomstudio",
    ...overrides,
  };
}

afterEach(() => resetInstagramAccountIdentitiesStore());

describe("mockInstagramAccountIdentityRepository", () => {
  it("creates a new identity, assigning a stable generated id", async () => {
    const result = await mockInstagramAccountIdentityRepository.upsertInstagramAccountIdentity(stubInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.id).toMatch(/^instagram_account_identity_/);
    expect(result.data.workspace_id).toBe("ws_1");
    expect(result.data.connection_id).toBe("connection_1");
    expect(result.data.instagram_account_id).toBe("17841400000000000");
    expect(result.data.instagram_username).toBe("amorebloomstudio");
  });

  it("associates the identity with the Meta connection it was selected through", async () => {
    const result = await mockInstagramAccountIdentityRepository.upsertInstagramAccountIdentity(stubInput({ connectionId: "connection_42" }));
    expect(result.success && result.data.connection_id).toBe("connection_42");
  });

  it("re-selecting the same account for the same workspace updates in place rather than creating a second row", async () => {
    const first = await mockInstagramAccountIdentityRepository.upsertInstagramAccountIdentity(stubInput({ instagramUsername: "old_handle" }));
    if (!first.success) throw new Error("setup failed");

    const second = await mockInstagramAccountIdentityRepository.upsertInstagramAccountIdentity(stubInput({ instagramUsername: "new_handle" }));
    expect(second.success).toBe(true);
    if (!second.success) return;
    expect(second.data.id).toBe(first.data.id);
    expect(second.data.instagram_username).toBe("new_handle");

    const all = await mockInstagramAccountIdentityRepository.listInstagramAccountIdentitiesForWorkspace("ws_1");
    expect(all).toHaveLength(1);
  });

  it("SOCIAL-11F — a genuine reconnect (a new connection_id for the same external account) updates connection_id in place, preserving the same identity id — disconnect/reconnect never corrupts historical comment/message records, which reference this identity's own id, never connection_id", async () => {
    const first = await mockInstagramAccountIdentityRepository.upsertInstagramAccountIdentity(stubInput({ connectionId: "connection_old" }));
    if (!first.success) throw new Error("setup failed");

    const reconnected = await mockInstagramAccountIdentityRepository.upsertInstagramAccountIdentity(stubInput({ connectionId: "connection_new_after_reconnect" }));
    expect(reconnected.success).toBe(true);
    if (!reconnected.success) return;
    expect(reconnected.data.id).toBe(first.data.id);
    expect(reconnected.data.connection_id).toBe("connection_new_after_reconnect");

    const all = await mockInstagramAccountIdentityRepository.listInstagramAccountIdentitiesForWorkspace("ws_1");
    expect(all).toHaveLength(1);
  });

  it("rejects claiming an external Instagram account already connected to a different workspace — duplicate external account handling", async () => {
    await mockInstagramAccountIdentityRepository.upsertInstagramAccountIdentity(stubInput({ workspaceId: "ws_1" }));
    const result = await mockInstagramAccountIdentityRepository.upsertInstagramAccountIdentity(stubInput({ workspaceId: "ws_2" }));
    expect(result.success).toBe(false);

    const wsTwoIdentities = await mockInstagramAccountIdentityRepository.listInstagramAccountIdentitiesForWorkspace("ws_2");
    expect(wsTwoIdentities).toHaveLength(0);
  });

  it("workspace isolation — listInstagramAccountIdentitiesForWorkspace scopes strictly by workspaceId", async () => {
    await mockInstagramAccountIdentityRepository.upsertInstagramAccountIdentity(stubInput({ workspaceId: "ws_1", instagramAccountId: "acct_1" }));
    await mockInstagramAccountIdentityRepository.upsertInstagramAccountIdentity(stubInput({ workspaceId: "ws_2", instagramAccountId: "acct_2" }));

    const wsOne = await mockInstagramAccountIdentityRepository.listInstagramAccountIdentitiesForWorkspace("ws_1");
    expect(wsOne).toHaveLength(1);
    expect(wsOne[0].instagram_account_id).toBe("acct_1");
  });

  it("getInstagramAccountIdentityByExternalId finds the owning identity regardless of workspace, or returns null", async () => {
    await mockInstagramAccountIdentityRepository.upsertInstagramAccountIdentity(stubInput({ instagramAccountId: "acct_1" }));
    expect(await mockInstagramAccountIdentityRepository.getInstagramAccountIdentityByExternalId("acct_1")).toMatchObject({ instagram_account_id: "acct_1" });
    expect(await mockInstagramAccountIdentityRepository.getInstagramAccountIdentityByExternalId("missing")).toBeNull();
  });

  it("resetInstagramAccountIdentitiesStore clears all identities", async () => {
    await mockInstagramAccountIdentityRepository.upsertInstagramAccountIdentity(stubInput());
    resetInstagramAccountIdentitiesStore();
    expect(await mockInstagramAccountIdentityRepository.listInstagramAccountIdentitiesForWorkspace("ws_1")).toEqual([]);
  });
});
