import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("@/lib/data", () => ({
  getClientAccounts: vi.fn(),
  getClients: vi.fn(),
  suspendClientAccount: vi.fn(),
  reactivateClientAccount: vi.fn(),
  revokeClientAccount: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { ClientAccountsAdminView } from "@/modules/clientAccess/components/ClientAccountsAdminView";
import { getClientAccounts, getClients, suspendClientAccount } from "@/lib/data";
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

const ACCOUNTS = [
  { id: "acct_1", client_id: "client_1", email: "naomi@example.com", status: "active", last_access_at: "2026-07-01T00:00:00.000Z" },
  { id: "acct_2", client_id: "client_2", email: "owen@example.com", status: "suspended", last_access_at: null },
] as never;

function renderView(permissions: string[]) {
  return render(
    <MemberSessionProvider snapshot={snapshotWithPermissions(permissions)}>
      <ClientAccountsAdminView />
    </MemberSessionProvider>,
  );
}

describe("ClientAccountsAdminView", () => {
  it("lists every account Workspace-wide with the linked client's name", async () => {
    vi.mocked(getClientAccounts).mockResolvedValue(ACCOUNTS);
    vi.mocked(getClients).mockResolvedValue(CLIENTS);

    renderView(["clients.portal_view"]);

    await waitFor(() => expect(screen.getByText("Naomi Whitfield")).toBeInTheDocument());
    expect(screen.getByText("Owen Pierce")).toBeInTheDocument();
    expect(screen.getByText("naomi@example.com")).toBeInTheDocument();
  });

  it("filters by search across email and client name", async () => {
    vi.mocked(getClientAccounts).mockResolvedValue(ACCOUNTS);
    vi.mocked(getClients).mockResolvedValue(CLIENTS);

    renderView(["clients.portal_view"]);
    await waitFor(() => expect(screen.getByText("Naomi Whitfield")).toBeInTheDocument());

    fireEvent.change(screen.getByRole("searchbox", { name: "Search client accounts" }), { target: { value: "owen" } });
    expect(screen.queryByText("Naomi Whitfield")).not.toBeInTheDocument();
    expect(screen.getByText("Owen Pierce")).toBeInTheDocument();
  });

  it("filters by status", async () => {
    vi.mocked(getClientAccounts).mockResolvedValue(ACCOUNTS);
    vi.mocked(getClients).mockResolvedValue(CLIENTS);

    renderView(["clients.portal_view"]);
    await waitFor(() => expect(screen.getByText("Naomi Whitfield")).toBeInTheDocument());

    fireEvent.change(screen.getByRole("combobox", { name: "Filter by status" }), { target: { value: "suspended" } });
    expect(screen.queryByText("Naomi Whitfield")).not.toBeInTheDocument();
    expect(screen.getByText("Owen Pierce")).toBeInTheDocument();
  });

  it("links each row to its Client Detail page", async () => {
    vi.mocked(getClientAccounts).mockResolvedValue(ACCOUNTS);
    vi.mocked(getClients).mockResolvedValue(CLIENTS);

    renderView(["clients.portal_view"]);
    await waitFor(() => expect(screen.getByText("Naomi Whitfield")).toBeInTheDocument());
    expect(screen.getByText("Naomi Whitfield").closest("a")).toHaveAttribute("href", "/clients/client_1");
  });

  it("hides suspend/reactivate/revoke actions for a viewer without the matching permission", async () => {
    vi.mocked(getClientAccounts).mockResolvedValue(ACCOUNTS);
    vi.mocked(getClients).mockResolvedValue(CLIENTS);

    renderView(["clients.portal_view"]);
    await waitFor(() => expect(screen.getByText("Naomi Whitfield")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Suspend" })).not.toBeInTheDocument();
  });

  it("suspends an account when clients.portal_suspend is granted", async () => {
    vi.mocked(getClientAccounts).mockResolvedValue(ACCOUNTS);
    vi.mocked(getClients).mockResolvedValue(CLIENTS);
    vi.mocked(suspendClientAccount).mockResolvedValue({ success: true, data: {} } as never);

    renderView(["clients.portal_view", "clients.portal_suspend"]);
    await waitFor(() => expect(screen.getByText("Naomi Whitfield")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Suspend" }));
    await waitFor(() => expect(suspendClientAccount).toHaveBeenCalledWith("acct_1"));
  });

  it("shows an empty state when no accounts match the filters", async () => {
    vi.mocked(getClientAccounts).mockResolvedValue([]);
    vi.mocked(getClients).mockResolvedValue(CLIENTS);

    renderView(["clients.portal_view"]);
    await waitFor(() => expect(screen.getByText("No client accounts found")).toBeInTheDocument());
  });
});
