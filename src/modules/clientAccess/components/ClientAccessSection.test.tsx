import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/data", () => ({
  getClientAccountsByClientId: vi.fn(),
  getClientInvitations: vi.fn(),
  expireClientInvitations: vi.fn(),
  createClientInvitation: vi.fn(),
  resendClientInvitation: vi.fn(),
  revokeClientInvitation: vi.fn(),
  suspendClientAccount: vi.fn(),
  reactivateClientAccount: vi.fn(),
  revokeClientAccount: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { ClientAccessSection } from "@/modules/clientAccess/components/ClientAccessSection";
import { getClientAccountsByClientId, getClientInvitations, expireClientInvitations } from "@/lib/data";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

function snapshotWithPermissions(permissions: string[]): MemberSessionSnapshot {
  return {
    kind: "active",
    user: { id: "user_1", email: "owner@amorebloom.com" },
    profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
    workspace: { id: "ws_amore_bloom", name: "Amoré Bloom" },
    membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
    permissions: permissions as never,
    workspaceDisplayName: "Amoré Bloom",
  };
}

describe("ClientAccessSection", () => {
  it("renders accounts/invitations for a member with clients.portal_view", async () => {
    vi.mocked(expireClientInvitations).mockResolvedValue(undefined);
    vi.mocked(getClientAccountsByClientId).mockResolvedValue([
      { id: "acct_1", email: "client@example.com", status: "active", last_access_at: null } as never,
    ]);
    vi.mocked(getClientInvitations).mockResolvedValue([]);

    render(
      <MemberSessionProvider snapshot={snapshotWithPermissions(["clients.portal_view"])}>
        <ClientAccessSection clientId="client_1" clientEmail="client@example.com" />
      </MemberSessionProvider>,
    );

    await waitFor(() => expect(screen.getByText("client@example.com")).toBeInTheDocument());
    expect(screen.getByText("Client Portal Access")).toBeInTheDocument();
  });

  it("never fetches or renders for a member without clients.portal_view", () => {
    render(
      <MemberSessionProvider snapshot={snapshotWithPermissions([])}>
        <ClientAccessSection clientId="client_1" clientEmail="client@example.com" />
      </MemberSessionProvider>,
    );

    expect(getClientAccountsByClientId).not.toHaveBeenCalled();
    expect(screen.queryByText("Client Portal Access")).not.toBeInTheDocument();
  });

  it("shows the Invite button only with clients.portal_invite", async () => {
    vi.mocked(expireClientInvitations).mockResolvedValue(undefined);
    vi.mocked(getClientAccountsByClientId).mockResolvedValue([]);
    vi.mocked(getClientInvitations).mockResolvedValue([]);

    render(
      <MemberSessionProvider snapshot={snapshotWithPermissions(["clients.portal_view"])}>
        <ClientAccessSection clientId="client_1" clientEmail="client@example.com" />
      </MemberSessionProvider>,
    );

    await waitFor(() => expect(screen.getByText("Client Portal Access")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Invite" })).not.toBeInTheDocument();
  });

  it("shows suspend/revoke actions only with the matching permission", async () => {
    vi.mocked(expireClientInvitations).mockResolvedValue(undefined);
    vi.mocked(getClientAccountsByClientId).mockResolvedValue([
      { id: "acct_1", email: "client@example.com", status: "active", last_access_at: null } as never,
    ]);
    vi.mocked(getClientInvitations).mockResolvedValue([]);

    render(
      <MemberSessionProvider snapshot={snapshotWithPermissions(["clients.portal_view"])}>
        <ClientAccessSection clientId="client_1" clientEmail="client@example.com" />
      </MemberSessionProvider>,
    );

    await waitFor(() => expect(screen.getByText("client@example.com")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Suspend" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revoke" })).not.toBeInTheDocument();
  });
});
