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
  it("shows every module for an owner with every *.view permission", () => {
    renderSidebar(ownerSnapshot);

    for (const label of ["Dashboard", "Leads", "Clients", "Events", "Contracts", "Finance", "Documents", "Team", "Accounts", "Invitations"]) {
      expect(screen.getByRole("link", { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it("hides Team from the nav for a member without team.view", () => {
    renderSidebar({
      ...ownerSnapshot,
      permissions: ownerSnapshot.permissions.filter((p) => p !== "team.view"),
    });

    expect(screen.queryByRole("link", { name: /Team/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Dashboard/ })).toBeInTheDocument();
  });

  it("renders Accounts and Invitations under their own Client Portal group, separate from Clients under Sales", () => {
    renderSidebar(ownerSnapshot);

    expect(screen.getByText("Client Portal")).toBeInTheDocument();
    expect(screen.getByText("Sales")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Accounts" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Invitations" })).toBeInTheDocument();
  });

  it("hides the Client Portal group entirely for a member without clients.portal_view", () => {
    renderSidebar({
      ...ownerSnapshot,
      permissions: ownerSnapshot.permissions.filter((p) => p !== "clients.portal_view"),
    });

    expect(screen.queryByText("Client Portal")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Accounts" })).not.toBeInTheDocument();
  });

  it("links the Workspace identity footer to the account page", () => {
    renderSidebar(ownerSnapshot);

    expect(screen.getByRole("link", { name: /Amoré Bloom/ })).toHaveAttribute("href", "/account");
  });
});
