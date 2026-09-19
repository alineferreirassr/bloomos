import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

import { MobileNav } from "@/components/layout/MobileNav";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

/** Opens a collapsed nav group ("Relationships", "Business", ...) by clicking its accordion header — every group but "Workspace" starts collapsed unless it contains the active route (see NavigationTree.tsx). */
function openGroup(label: string) {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
}

const staffSnapshot: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_4", email: "sofia@amorebloom.com" },
  profile: { full_name: "Sofia Lima", avatar_url: null },
  workspace: { id: "ws_amore_bloom", name: "Amoré Bloom" },
  membership: { id: "member_4", role: "staff", status: "active", created_at: "2026-04-01T00:00:00Z" },
  permissions: [
    "workspace.view",
    "team.view",
    "leads.view",
    "clients.view",
    "events.view",
    "contracts.view",
    "finance.view",
    "documents.view",
    "clients.portal_view",
  ],
  workspaceDisplayName: "Amoré Bloom Team",
};

describe("MobileNav", () => {
  it("filters navigation the same way Sidebar does, using the same permission set", () => {
    render(
      <MemberSessionProvider snapshot={{ ...staffSnapshot, permissions: staffSnapshot.permissions.filter((p) => p !== "team.view") }}>
        <MobileNav open onClose={() => {}} workspaceDisplayName="Amoré Bloom Team" />
      </MemberSessionProvider>,
    );

    expect(screen.queryByText("Team")).not.toBeInTheDocument();

    openGroup("Relationships");
    expect(screen.getByRole("link", { name: "Leads" })).toBeInTheDocument();
  });

  it("renders the Relationships group collapsed by default, opening to reveal Client Accounts and Client Invitations", () => {
    render(
      <MemberSessionProvider snapshot={staffSnapshot}>
        <MobileNav open onClose={() => {}} workspaceDisplayName="Amoré Bloom Team" />
      </MemberSessionProvider>,
    );

    expect(screen.queryByRole("link", { name: "Client Accounts" })).not.toBeInTheDocument();

    openGroup("Relationships");

    expect(screen.getByRole("link", { name: "Client Accounts" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Client Invitations" })).toBeInTheDocument();
  });

  it("closes when a navigation link is clicked", () => {
    const onClose = vi.fn();
    render(
      <MemberSessionProvider snapshot={staffSnapshot}>
        <MobileNav open onClose={onClose} workspaceDisplayName="Amoré Bloom Team" />
      </MemberSessionProvider>,
    );

    openGroup("Relationships");
    fireEvent.click(screen.getByRole("link", { name: "Leads" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("closes when the account footer link is clicked, and links to /account", () => {
    const onClose = vi.fn();
    render(
      <MemberSessionProvider snapshot={staffSnapshot}>
        <MobileNav open onClose={onClose} workspaceDisplayName="Amoré Bloom Team" />
      </MemberSessionProvider>,
    );

    const accountLink = screen.getByRole("link", { name: /Amoré Bloom/ });
    expect(accountLink).toHaveAttribute("href", "/account");
    fireEvent.click(accountLink);
    expect(onClose).toHaveBeenCalled();
  });

  it("toggles a nav group open and closed on click, without closing the drawer", () => {
    const onClose = vi.fn();
    render(
      <MemberSessionProvider snapshot={staffSnapshot}>
        <MobileNav open onClose={onClose} workspaceDisplayName="Amoré Bloom Team" />
      </MemberSessionProvider>,
    );

    expect(screen.queryByRole("link", { name: "Leads" })).not.toBeInTheDocument();

    openGroup("Relationships");
    expect(screen.getByRole("link", { name: "Leads" })).toBeInTheDocument();

    openGroup("Relationships");
    expect(screen.queryByRole("link", { name: "Leads" })).not.toBeInTheDocument();

    expect(onClose).not.toHaveBeenCalled();
  });
});
