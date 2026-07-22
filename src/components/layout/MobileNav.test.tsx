import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

import { MobileNav } from "@/components/layout/MobileNav";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

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
    expect(screen.getByRole("link", { name: "Leads" })).toBeInTheDocument();
  });

  it("renders the CRM module expanded by default with Client Accounts and Client Invitations children", () => {
    render(
      <MemberSessionProvider snapshot={staffSnapshot}>
        <MobileNav open onClose={() => {}} workspaceDisplayName="Amoré Bloom Team" />
      </MemberSessionProvider>,
    );

    expect(screen.getByText("CRM")).toBeInTheDocument();
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

  it("toggles a default-expanded module's children closed and back open on click, without closing the drawer", () => {
    const onClose = vi.fn();
    render(
      <MemberSessionProvider snapshot={staffSnapshot}>
        <MobileNav open onClose={onClose} workspaceDisplayName="Amoré Bloom Team" />
      </MemberSessionProvider>,
    );

    expect(screen.getByRole("link", { name: "Leads" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /CRM/ }));
    expect(screen.queryByRole("link", { name: "Leads" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /CRM/ }));
    expect(screen.getByRole("link", { name: "Leads" })).toBeInTheDocument();

    expect(onClose).not.toHaveBeenCalled();
  });
});
