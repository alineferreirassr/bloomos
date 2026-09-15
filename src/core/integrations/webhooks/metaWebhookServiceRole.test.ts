import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { resolveInstagramAccountOwnership, recordMetaWebhookEvent } from "@/core/integrations/webhooks/metaWebhookServiceRole";

function mockClient(response: { data: unknown; error: unknown }) {
  const eq = vi.fn().mockReturnThis();
  const select = vi.fn().mockReturnThis();
  const insert = vi.fn().mockReturnThis();
  const maybeSingle = vi.fn().mockResolvedValue(response);
  const single = vi.fn().mockResolvedValue(response);
  const from = vi.fn().mockReturnValue({ select, insert, eq, maybeSingle, single });
  return { client: { from } as never, select, insert, eq, maybeSingle, single };
}

describe("resolveInstagramAccountOwnership", () => {
  it("returns the owning workspace and identity id when a row matches", async () => {
    const { client } = mockClient({ data: { id: "identity_1", workspace_id: "ws_1" }, error: null });
    const result = await resolveInstagramAccountOwnership(client, "acct_1");
    expect(result).toEqual({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1" });
  });

  it("returns null (never throws) when no row matches", async () => {
    const { client } = mockClient({ data: null, error: null });
    expect(await resolveInstagramAccountOwnership(client, "unknown_acct")).toBeNull();
  });

  it("returns null (never throws) on a query error", async () => {
    const { client } = mockClient({ data: null, error: { message: "db error" } });
    expect(await resolveInstagramAccountOwnership(client, "acct_1")).toBeNull();
  });
});

describe("recordMetaWebhookEvent", () => {
  it("inserts the expected payload and returns the new row's id", async () => {
    const { client, insert } = mockClient({ data: { id: "evt_1" }, error: null });
    const result = await recordMetaWebhookEvent(client, {
      idempotencyKeyId: "idem_1",
      workspaceId: "ws_1",
      instagramAccountIdentityId: "identity_1",
      externalAccountId: "acct_1",
      objectType: "instagram",
      eventType: "comments",
      payload: { object: "instagram", entry: [] },
    });
    expect(result).toEqual({ success: true, id: "evt_1" });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ idempotency_key_id: "idem_1", workspace_id: "ws_1", instagram_account_identity_id: "identity_1", external_account_id: "acct_1" }),
    );
  });

  it("allows a null idempotencyKeyId/workspaceId for an unresolved event", async () => {
    const { client } = mockClient({ data: { id: "evt_2" }, error: null });
    const result = await recordMetaWebhookEvent(client, {
      idempotencyKeyId: null,
      workspaceId: null,
      instagramAccountIdentityId: null,
      externalAccountId: "acct_unknown",
      objectType: "instagram",
      eventType: "unknown",
      payload: {},
    });
    expect(result.success).toBe(true);
  });

  it("returns a controlled error, never throwing, on an insert failure", async () => {
    const { client } = mockClient({ data: null, error: { message: "constraint violation" } });
    const result = await recordMetaWebhookEvent(client, {
      idempotencyKeyId: "idem_1",
      workspaceId: "ws_1",
      instagramAccountIdentityId: "identity_1",
      externalAccountId: "acct_1",
      objectType: "instagram",
      eventType: "comments",
      payload: {},
    });
    expect(result.success).toBe(false);
  });
});
