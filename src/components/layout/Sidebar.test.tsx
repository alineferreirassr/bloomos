import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

import { Sidebar } from "@/components/layout/Sidebar";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

function renderSidebar(snapshot: MemberSessionSnapshot) {
  return render(
    <MemberSessionProvider snapshot={snapshot}>
      <Sidebar workspaceDisplayName="Amoré Bloom" />
    </MemberSessionProvider>,
  );
}

const ownerSnapshot: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_amore_bloom", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: [
    "workspace.view",
    "workspace.manage",
    "team.view",
    "team.invite",
    "leads.view",
    "clients.view",
    "events.view",
    "contracts.view",
    "finance.view",
    "documents.view",
    "clients.portal_view",
  ],
  workspaceDisplayName: "Amoré Bloom",
};

describe("Sidebar", () => {
  it("shows every top-level module and every default-expanded child for an owner with every *.view permission", () => {
    renderSidebar(ownerSnapshot);

    for (const label of ["Dashboard", "CRM", "Inventory", "Vendors", "Finance", "Documents", "Team", "Services", "Bloom AI", "Settings"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // "Events" is both the module label and its default-expanded "Events" child leaf label.
    expect(screen.getAllByText("Events").length).toBe(2);
    for (const label of ["Leads", "Clients", "Commercial Pipeline", "Contracts", "Client Accounts", "Client Invitations"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("hides Team from the nav for a member without team.view", () => {
    renderSidebar({
      ...ownerSnapshot,
      permissions: ownerSnapshot.permissions.filter((p) => p !== "team.view"),
    });

    expect(screen.queryByText("Team")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("drops Client Accounts/Client Invitations, but keeps CRM and its other children, for a member without clients.portal_view", () => {
    renderSidebar({
      ...ownerSnapshot,
      permissions: ownerSnapshot.permissions.filter((p) => p !== "clients.portal_view"),
    });

    expect(screen.getByText("CRM")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Leads" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Client Accounts" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Client Invitations" })).not.toBeInTheDocument();
  });

  it("renders disabled placeholder modules (Inventory, Vendors, Services, Bloom AI) as non-links with a Soon badge", () => {
    renderSidebar(ownerSnapshot);

    expect(screen.queryByRole("link", { name: "Inventory" })).not.toBeInTheDocument();
    expect(screen.getByText("Inventory")).toBeInTheDocument();
    expect(screen.getAllByText("Soon").length).toBeGreaterThan(0);
  });

  it("links the Workspace identity footer to the account page", () => {
    renderSidebar(ownerSnapshot);

    expect(screen.getByRole("link", { name: /Amoré Bloom/ })).toHaveAttribute("href", "/account");
  });
});
