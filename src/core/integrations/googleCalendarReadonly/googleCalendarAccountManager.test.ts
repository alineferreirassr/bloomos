import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { registerBuiltinProviders } from "@/modules/integrations/registerBuiltinProviders";
import { getProvider } from "@/core/integrations/providerRegistry";
import { resetConnectionStore } from "@/lib/data/core/integrations/connectionStore";
import { installProvider } from "@/core/integrations/integrationManager";
import { resetGoogleCalendarAccountStore } from "@/lib/data/core/integrations/googleCalendarReadonly/accountStore";
import { getAccountForCaller, getOwnAccount, upsertAccount } from "@/core/integrations/googleCalendarReadonly/googleCalendarAccountManager";

registerBuiltinProviders();

const WORKSPACE_ID = "ws_1";
const OTHER_WORKSPACE_ID = "ws_other";
const MEMBER_1 = "user_1";
const MEMBER_2 = "user_2";

async function installGoogleCalendarReadonlyConnection(workspaceId: string, memberId: string): Promise<string> {
  const connection = await installProvider({ workspaceId, providerId: "google-calendar-readonly", installedBy: memberId, memberId });
  return connection.id;
}

beforeEach(() => {
  resetConnectionStore();
  resetGoogleCalendarAccountStore();
});

describe("google-calendar-readonly provider registration (GCAL-02)", () => {
  it("1 & 2. registers the exact new provider id", () => {
    const provider = getProvider("google-calendar-readonly");
    expect(provider).toBeDefined();
    expect(provider?.id).toBe("google-calendar-readonly");
  });

  it("3. requests exactly the calendar.readonly scope", () => {
    const provider = getProvider("google-calendar-readonly");
    expect(provider?.oauth?.defaultScopes).toEqual(["https://www.googleapis.com/auth/calendar.readonly"]);
  });

  it("4. does not request the broad calendar scope or any other Google scope", () => {
    const provider = getProvider("google-calendar-readonly");
    expect(provider?.oauth?.defaultScopes).not.toContain("https://www.googleapis.com/auth/calendar");
    expect(provider?.oauth?.defaultScopes).toHaveLength(1);
  });

  it("uses the existing integrations.calendar permission — no new permission key", () => {
    const provider = getProvider("google-calendar-readonly");
    expect(provider?.requiredPermission).toBe("integrations.calendar");
  });

  it("supports PKCE", () => {
    const provider = getProvider("google-calendar-readonly");
    expect(provider?.oauth?.supportsPkce).toBe(true);
  });

  it("35. the existing outbound google-calendar provider is completely unaffected", () => {
    const provider = getProvider("google-calendar");
    expect(provider?.id).toBe("google-calendar");
    expect(provider?.requiredPermission).toBe("integrations.calendar");
    expect(provider?.oauth?.defaultScopes).toEqual(["https://www.googleapis.com/auth/calendar"]);
    expect(provider?.subscribedWebhookEvents).toEqual(["event.created"]);
    expect(provider?.description).toContain("Sync Event schedules to an external Google Calendar");
  });
});

describe("upsertAccount", () => {
  async function seedConnection(): Promise<string> {
    return installGoogleCalendarReadonlyConnection(WORKSPACE_ID, MEMBER_1);
  }

  it("creates an account bound to the caller's own connection", async () => {
    const connectionId = await seedConnection();
    const account = await upsertAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId });

    expect(account.workspace_id).toBe(WORKSPACE_ID);
    expect(account.member_id).toBe(MEMBER_1);
    expect(account.integration_connection_id).toBe(connectionId);
    expect(account.sync_status).toBe("not_synced");
  });

  it("15 & 20. supports null provider_account_id/email until identified, and persists the minimum identity fields once supplied", async () => {
    const connectionId = await seedConnection();
    const created = await upsertAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId });
    expect(created.provider_account_id).toBeNull();
    expect(created.provider_account_email).toBeNull();

    const identified = await upsertAccount({
      workspaceId: WORKSPACE_ID,
      memberId: MEMBER_1,
      integrationConnectionId: connectionId,
      providerAccountId: "ana@amorebloom.com",
      providerAccountEmail: "ana@amorebloom.com",
      syncStatus: "synced",
    });
    expect(identified.id).toBe(created.id);
    expect(identified.provider_account_id).toBe("ana@amorebloom.com");
    expect(identified.provider_account_email).toBe("ana@amorebloom.com");
    expect(identified.sync_status).toBe("synced");
  });

  it("is idempotent — a second upsert for the same connection updates rather than duplicating", async () => {
    const connectionId = await seedConnection();
    const first = await upsertAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId, syncStatus: "syncing" });
    const second = await upsertAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId, syncStatus: "synced" });

    expect(second.id).toBe(first.id);
    expect(second.sync_status).toBe("synced");
  });

  it("34. never persists a sync_token, calendar list, or event content field — the schema has none", async () => {
    const connectionId = await seedConnection();
    const account = await upsertAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId });
    const keys = Object.keys(account);
    expect(keys).not.toContain("sync_token");
    expect(keys).not.toContain("calendars");
    expect(keys).not.toContain("events");
    expect(keys).not.toContain("event_count");
  });

  it("rejects (forged account ownership) when the caller's workspaceId/memberId don't match the connection's own ownership", async () => {
    const connectionId = await seedConnection();
    await expect(upsertAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_2, integrationConnectionId: connectionId })).rejects.toThrow(/not owned by the caller/);
    await expect(upsertAccount({ workspaceId: OTHER_WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId })).rejects.toThrow();
  });

  it("rejects binding to a connection that isn't a google-calendar-readonly connection (e.g. the existing outbound google-calendar provider)", async () => {
    const connection = await installProvider({ workspaceId: WORKSPACE_ID, providerId: "google-calendar", installedBy: MEMBER_1 });
    await expect(upsertAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connection.id })).rejects.toThrow(/not a Google Calendar \(read-only\) connection/);
  });

  it("17 & 18. rejects an unknown connection id (foreign account / foreign connection denial)", async () => {
    await expect(upsertAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: "connection_missing" })).rejects.toThrow(/No integration connection/);
  });
});

describe("getAccountForCaller / getOwnAccount — ownership isolation (12, 13, 14, 16)", () => {
  it("12 & 16. the owning member can read their own account", async () => {
    const connectionId = await installGoogleCalendarReadonlyConnection(WORKSPACE_ID, MEMBER_1);
    const account = await upsertAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId });

    const own = await getOwnAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1 });
    expect(own?.id).toBe(account.id);
  });

  it("13. denies a same-workspace, different member from reading the account", async () => {
    const connectionId = await installGoogleCalendarReadonlyConnection(WORKSPACE_ID, MEMBER_1);
    const account = await upsertAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId });

    expect(await getAccountForCaller(account.id, { workspaceId: WORKSPACE_ID, memberId: MEMBER_2 })).toBeNull();
    expect(await getOwnAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_2 })).toBeNull();
  });

  it("14. denies a cross-workspace caller from reading the account", async () => {
    const connectionId = await installGoogleCalendarReadonlyConnection(WORKSPACE_ID, MEMBER_1);
    const account = await upsertAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId });

    expect(await getAccountForCaller(account.id, { workspaceId: OTHER_WORKSPACE_ID, memberId: MEMBER_1 })).toBeNull();
  });
});
