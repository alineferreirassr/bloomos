import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("@/lib/data", () => ({
  getClientInvitations: vi.fn(),
  getClients: vi.fn(),
  expireClientInvitations: vi.fn(),
  resendClientInvitation: vi.fn(),
  revokeClientInvitation: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { ClientInvitationsAdminView } from "@/modules/clientAccess/components/ClientInvitationsAdminView";
import { getClientInvitations, getClients, expireClientInvitations, revokeClientInvitation } from "@/lib/data";
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

const CLIENTS = [
  { id: "client_1", first_name: "Naomi", last_name: "Whitfield" },
  { id: "client_2", first_name: "Owen", last_name: "Pierce" },
] as never;

const INVITATIONS = [
  { id: "inv_1", client_id: "client_1", email: "naomi@example.com", status: "pending", expires_at: "2026-08-01T00:00:00.000Z" },
  { id: "inv_2", client_id: "client_2", email: "owen@example.com", status: "expired", expires_at: "2026-06-01T00:00:00.000Z" },
] as never;

function renderView(permissions: string[]) {
  return render(
    <MemberSessionProvider snapshot={snapshotWithPermissions(permissions)}>
      <ClientInvitationsAdminView />
    </MemberSessionProvider>,
  );
}

describe("ClientInvitationsAdminView", () => {
  it("expires stale invitations once, then lists every invitation Workspace-wide with the linked client's name", async () => {
    vi.mocked(expireClientInvitations).mockResolvedValue(undefined);
    vi.mocked(getClientInvitations).mockResolvedValue(INVITATIONS);
    vi.mocked(getClients).mockResolvedValue(CLIENTS);

    renderView(["clients.portal_view"]);

    await waitFor(() => expect(screen.getByText("Naomi Whitfield")).toBeInTheDocument());
    expect(screen.getByText("Owen Pierce")).toBeInTheDocument();
    expect(expireClientInvitations).toHaveBeenCalledTimes(1);
  });

  it("filters by search across email and client name", async () => {
    vi.mocked(expireClientInvitations).mockResolvedValue(undefined);
    vi.mocked(getClientInvitations).mockResolvedValue(INVITATIONS);
    vi.mocked(getClients).mockResolvedValue(CLIENTS);

    renderView(["clients.portal_view"]);
    await waitFor(() => expect(screen.getByText("Naomi Whitfield")).toBeInTheDocument());

    fireEvent.change(screen.getByRole("searchbox", { name: "Search client invitations" }), { target: { value: "owen" } });
    expect(screen.queryByText("Naomi Whitfield")).not.toBeInTheDocument();
    expect(screen.getByText("Owen Pierce")).toBeInTheDocument();
  });

  it("filters by status", async () => {
    vi.mocked(expireClientInvitations).mockResolvedValue(undefined);
    vi.mocked(getClientInvitations).mockResolvedValue(INVITATIONS);
    vi.mocked(getClients).mockResolvedValue(CLIENTS);

    renderView(["clients.portal_view"]);
    await waitFor(() => expect(screen.getByText("Naomi Whitfield")).toBeInTheDocument());

    fireEvent.change(screen.getByRole("combobox", { name: "Filter by status" }), { target: { value: "expired" } });
    expect(screen.queryByText("Naomi Whitfield")).not.toBeInTheDocument();
    expect(screen.getByText("Owen Pierce")).toBeInTheDocument();
  });

  it("links each row to its Client Detail page", async () => {
    vi.mocked(expireClientInvitations).mockResolvedValue(undefined);
    vi.mocked(getClientInvitations).mockResolvedValue(INVITATIONS);
    vi.mocked(getClients).mockResolvedValue(CLIENTS);

    renderView(["clients.portal_view"]);
    await waitFor(() => expect(screen.getByText("Naomi Whitfield")).toBeInTheDocument());
    expect(screen.getByText("Naomi Whitfield").closest("a")).toHaveAttribute("href", "/clients/client_1");
  });

  it("hides resend/revoke actions for a viewer without clients.portal_invite", async () => {
    vi.mocked(expireClientInvitations).mockResolvedValue(undefined);
    vi.mocked(getClientInvitations).mockResolvedValue(INVITATIONS);
    vi.mocked(getClients).mockResolvedValue(CLIENTS);

    renderView(["clients.portal_view"]);
    await waitFor(() => expect(screen.getByText("Naomi Whitfield")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Resend" })).not.toBeInTheDocument();
  });

  it("revokes a pending invitation when clients.portal_invite is granted", async () => {
    vi.mocked(expireClientInvitations).mockResolvedValue(undefined);
    vi.mocked(getClientInvitations).mockResolvedValue(INVITATIONS);
    vi.mocked(getClients).mockResolvedValue(CLIENTS);
    vi.mocked(revokeClientInvitation).mockResolvedValue({ success: true, data: {} } as never);

    renderView(["clients.portal_view", "clients.portal_invite"]);
    await waitFor(() => expect(screen.getByText("Naomi Whitfield")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(revokeClientInvitation).toHaveBeenCalledWith("inv_1"));
  });

  it("shows an empty state when no invitations match the filters", async () => {
    vi.mocked(expireClientInvitations).mockResolvedValue(undefined);
    vi.mocked(getClientInvitations).mockResolvedValue([]);
    vi.mocked(getClients).mockResolvedValue(CLIENTS);

    renderView(["clients.portal_view"]);
    await waitFor(() => expect(screen.getByText("No invitations found")).toBeInTheDocument());
  });
});
