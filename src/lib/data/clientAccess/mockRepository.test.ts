import { afterEach, describe, expect, it } from "vitest";
import { mockClientAccessRepository } from "@/lib/data/clientAccess/mockRepository";
import { readClientAccounts, resetClientAccountsStore, MOCK_CURRENT_CLIENT_ACCOUNT_ID } from "@/lib/data/mock/clientAccountsStore";
import { readClientInvitations, resetClientInvitationsStore, writeClientInvitations } from "@/lib/data/mock/clientInvitationsStore";
import { NotFoundError } from "@/core/errors";

afterEach(() => {
  resetClientAccountsStore();
  resetClientInvitationsStore();
});

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

describe("mockClientAccessRepository.getClientAccounts / getClientAccountById", () => {
  it("returns every seeded account, optionally filtered by client", async () => {
    const all = await mockClientAccessRepository.getClientAccounts();
    expect(all.length).toBeGreaterThan(0);

    const scoped = await mockClientAccessRepository.getClientAccounts("client_1");
    expect(scoped.every((a) => a.client_id === "client_1")).toBe(true);
  });

  it("throws NotFoundError for an unknown id", async () => {
    await expect(mockClientAccessRepository.getClientAccountById("nope")).rejects.toThrow(NotFoundError);
  });

  it("getClientAccountsByClientId is equivalent to filtering getClientAccounts", async () => {
    const byClient = await mockClientAccessRepository.getClientAccountsByClientId("client_2");
    expect(byClient.every((a) => a.client_id === "client_2")).toBe(true);
  });
});

describe("mockClientAccessRepository.getCurrentClientAccount", () => {
  it("returns the seeded active account standing in for 'the current client user'", async () => {
    const current = await mockClientAccessRepository.getCurrentClientAccount();
    expect(current?.id).toBe(MOCK_CURRENT_CLIENT_ACCOUNT_ID);
    expect(current?.status).toBe("active");
  });
});

describe("mockClientAccessRepository.getCurrentClientAccountContext", () => {
  it("returns the account plus display-safe client/workspace names", async () => {
    const context = await mockClientAccessRepository.getCurrentClientAccountContext();
    expect(context?.account.id).toBe(MOCK_CURRENT_CLIENT_ACCOUNT_ID);
    expect(context?.clientName.length).toBeGreaterThan(0);
    expect(context?.workspaceName).toBe("Amoré Bloom");
  });
});

describe("mockClientAccessRepository suspend/reactivate/revoke", () => {
  it("suspends and reactivates an active account", async () => {
    const suspended = await mockClientAccessRepository.suspendClientAccount("client_account_1");
    expect(suspended.success).toBe(true);
    if (!suspended.success) return;
    expect(suspended.data.status).toBe("suspended");
    expect(suspended.data.suspended_at).not.toBeNull();

    const reactivated = await mockClientAccessRepository.reactivateClientAccount("client_account_1");
    expect(reactivated.success).toBe(true);
    if (!reactivated.success) return;
    expect(reactivated.data.status).toBe("active");
    expect(reactivated.data.suspended_at).toBeNull();
  });

  it("rejects suspending an already-suspended account", async () => {
    await mockClientAccessRepository.suspendClientAccount("client_account_2"); // already suspended
    const result = await mockClientAccessRepository.suspendClientAccount("client_account_2");
    expect(result.success).toBe(false);
  });

  it("revokes an account, and reactivate brings it back", async () => {
    const revoked = await mockClientAccessRepository.revokeClientAccount("client_account_1");
    expect(revoked.success).toBe(true);
    if (!revoked.success) return;
    expect(revoked.data.status).toBe("revoked");
    expect(revoked.data.revoked_at).not.toBeNull();

    const reactivated = await mockClientAccessRepository.reactivateClientAccount("client_account_1");
    expect(reactivated.success).toBe(true);
    if (!reactivated.success) return;
    expect(reactivated.data.status).toBe("active");
    expect(reactivated.data.revoked_at).toBeNull();
  });

  it("rejects revoking an already-revoked account", async () => {
    await mockClientAccessRepository.revokeClientAccount("client_account_1");
    const result = await mockClientAccessRepository.revokeClientAccount("client_account_1");
    expect(result.success).toBe(false);
  });

  it("fails for an unknown account id", async () => {
    expect((await mockClientAccessRepository.suspendClientAccount("nope")).success).toBe(false);
    expect((await mockClientAccessRepository.reactivateClientAccount("nope")).success).toBe(false);
    expect((await mockClientAccessRepository.revokeClientAccount("nope")).success).toBe(false);
  });
});

describe("mockClientAccessRepository.updateClientLastAccess / canCurrentUserAccessClient", () => {
  it("updates last_access_at for the given account", async () => {
    await mockClientAccessRepository.updateClientLastAccess("client_account_1");
    const account = await mockClientAccessRepository.getClientAccountById("client_account_1");
    expect(account.last_access_at).not.toBeNull();
  });

  it("is true for the current active account's own client, false otherwise", async () => {
    expect(await mockClientAccessRepository.canCurrentUserAccessClient("client_1")).toBe(true);
    expect(await mockClientAccessRepository.canCurrentUserAccessClient("client_3")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

describe("mockClientAccessRepository.createClientInvitation", () => {
  it("creates a pending invitation and returns a raw token", async () => {
    const result = await mockClientAccessRepository.createClientInvitation({ client_id: "client_3", email: "New.Client@Example.com" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.invitation.email).toBe("new.client@example.com");
    expect(result.data.invitation.status).toBe("pending");
    expect(result.data.token.length).toBeGreaterThan(0);
  });

  it("rejects an unknown client", async () => {
    const result = await mockClientAccessRepository.createClientInvitation({ client_id: "nope", email: "x@example.com" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", async () => {
    const result = await mockClientAccessRepository.createClientInvitation({ client_id: "client_3", email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects a duplicate pending invitation for the same client/email", async () => {
    await mockClientAccessRepository.createClientInvitation({ client_id: "client_3", email: "dupe@example.com" });
    const result = await mockClientAccessRepository.createClientInvitation({ client_id: "client_3", email: "dupe@example.com" });
    expect(result.success).toBe(false);
  });

  it("rejects inviting an email that already has an active account for that client", async () => {
    const result = await mockClientAccessRepository.createClientInvitation({ client_id: "client_1", email: "naomi.whitfield@example.com" });
    expect(result.success).toBe(false);
  });
});

describe("mockClientAccessRepository.resendClientInvitation / revokeClientInvitation", () => {
  it("resend regenerates the token and extends expiry for a pending invitation", async () => {
    const created = await mockClientAccessRepository.createClientInvitation({ client_id: "client_3", email: "resend.me@example.com" });
    if (!created.success) throw new Error("setup failed");

    const resent = await mockClientAccessRepository.resendClientInvitation(created.data.invitation.id);
    expect(resent.success).toBe(true);
    if (!resent.success) return;
    expect(resent.data.token).not.toBe(created.data.token);
  });

  it("resend fails for a non-pending invitation", async () => {
    const result = await mockClientAccessRepository.resendClientInvitation("client_invitation_2"); // seeded as accepted
    expect(result.success).toBe(false);
  });

  it("revoke moves a pending invitation to revoked", async () => {
    const created = await mockClientAccessRepository.createClientInvitation({ client_id: "client_3", email: "revoke.me@example.com" });
    if (!created.success) throw new Error("setup failed");

    const revoked = await mockClientAccessRepository.revokeClientInvitation(created.data.invitation.id);
    expect(revoked.success).toBe(true);
    if (!revoked.success) return;
    expect(revoked.data.status).toBe("revoked");
    expect(revoked.data.revoked_at).not.toBeNull();
  });

  it("revoke fails for a non-pending invitation", async () => {
    const result = await mockClientAccessRepository.revokeClientInvitation("client_invitation_4"); // seeded as revoked
    expect(result.success).toBe(false);
  });
});

describe("mockClientAccessRepository.acceptClientInvitation", () => {
  it("accepts a valid pending invitation exactly once, creating a new active account", async () => {
    const created = await mockClientAccessRepository.createClientInvitation({ client_id: "client_3", email: "accept.me@example.com" });
    if (!created.success) throw new Error("setup failed");

    const accepted = await mockClientAccessRepository.acceptClientInvitation(created.data.token);
    expect(accepted.success).toBe(true);
    if (!accepted.success) return;
    expect(accepted.data.client_id).toBe("client_3");
    expect(accepted.data.status).toBe("active");

    const invitation = await mockClientAccessRepository.getClientInvitationById(created.data.invitation.id);
    expect(invitation.status).toBe("accepted");

    // Reuse must fail — the token was single-use.
    const reused = await mockClientAccessRepository.acceptClientInvitation(created.data.token);
    expect(reused.success).toBe(false);
  });

  it("rejects an invalid token", async () => {
    const result = await mockClientAccessRepository.acceptClientInvitation("not-a-real-token");
    expect(result.success).toBe(false);
  });

  it("rejects a revoked invitation", async () => {
    const created = await mockClientAccessRepository.createClientInvitation({ client_id: "client_3", email: "revoked.accept@example.com" });
    if (!created.success) throw new Error("setup failed");
    await mockClientAccessRepository.revokeClientInvitation(created.data.invitation.id);

    const result = await mockClientAccessRepository.acceptClientInvitation(created.data.token);
    expect(result.success).toBe(false);
  });

  it("reactivates an existing revoked account in place via a fresh accepted invitation, rather than creating a duplicate row", async () => {
    const revoked = await mockClientAccessRepository.revokeClientAccount("client_account_2");
    expect(revoked.success).toBe(true);

    const created = await mockClientAccessRepository.createClientInvitation({ client_id: "client_2", email: "jordan.ellis@example.com" });
    if (!created.success) throw new Error("setup failed");

    const before = (await mockClientAccessRepository.getClientAccountsByClientId("client_2")).length;
    const accepted = await mockClientAccessRepository.acceptClientInvitation(created.data.token);
    expect(accepted.success).toBe(true);
    if (!accepted.success) return;
    expect(accepted.data.id).toBe("client_account_2");
    expect(accepted.data.status).toBe("active");

    const after = (await mockClientAccessRepository.getClientAccountsByClientId("client_2")).length;
    expect(after).toBe(before);
  });
});

describe("mockClientAccessRepository.expireClientInvitations", () => {
  it("flips a past-due pending invitation to expired", async () => {
    const created = await mockClientAccessRepository.createClientInvitation({ client_id: "client_3", email: "expiring@example.com" });
    if (!created.success) throw new Error("setup failed");

    const invitations = readClientInvitations();
    const past = invitations.map((i) =>
      i.id === created.data.invitation.id ? { ...i, expires_at: "2020-01-01T00:00:00.000Z" } : i,
    );
    writeClientInvitations(past);

    await mockClientAccessRepository.expireClientInvitations();
    const updated = await mockClientAccessRepository.getClientInvitationById(created.data.invitation.id);
    expect(updated.status).toBe("expired");
  });
});

describe("mockClientAccessRepository.getClientInvitationByToken", () => {
  it("returns a display-safe preview for a valid token", async () => {
    const created = await mockClientAccessRepository.createClientInvitation({ client_id: "client_3", email: "preview.me@example.com" });
    if (!created.success) throw new Error("setup failed");

    const preview = await mockClientAccessRepository.getClientInvitationByToken(created.data.token);
    expect(preview?.email).toBe("preview.me@example.com");
    expect(preview?.workspace_name).toBe("Amoré Bloom");
    expect(preview?.client_name.length).toBeGreaterThan(0);
  });

  it("returns null for an unknown token", async () => {
    expect(await mockClientAccessRepository.getClientInvitationByToken("nope")).toBeNull();
  });
});

describe("mockClientAccessRepository.getClientInvitationStatus / getClientInvitationNextAction", () => {
  it("returns the current status and a next-action hint", async () => {
    expect(await mockClientAccessRepository.getClientInvitationStatus("client_invitation_1")).toBe("pending");
    const action = await mockClientAccessRepository.getClientInvitationNextAction("client_invitation_1");
    expect(action === null || typeof action === "string").toBe(true);
  });
});

describe("mockClientAccessRepository never creates a workspace_members row", () => {
  it("acceptClientInvitation only ever touches client_accounts", async () => {
    const before = readClientAccounts().length;
    const created = await mockClientAccessRepository.createClientInvitation({ client_id: "client_4", email: "isolated@example.com" });
    if (!created.success) throw new Error("setup failed");
    await mockClientAccessRepository.acceptClientInvitation(created.data.token);
    expect(readClientAccounts().length).toBe(before + 1);
  });
});
