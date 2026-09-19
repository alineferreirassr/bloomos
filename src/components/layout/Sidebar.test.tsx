import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

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

/** Opens a collapsed nav group ("Relationships", "Business", ...) by clicking its accordion header — every group but "Workspace" starts collapsed unless it contains the active route (see NavigationTree.tsx). */
function openGroup(label: string) {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
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
  it("shows every top-level module for an owner with every *.view permission, once each group is opened", () => {
    renderSidebar(ownerSnapshot);

    // "Workspace" is the only group that renders flat/always-open (see NavigationTree.tsx).
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();

    // Every other group starts collapsed on "/dashboard" (it isn't the active route for any of them).
    for (const groupLabel of ["Relationships", "Business", "Knowledge", "Team", "System"]) {
      openGroup(groupLabel);
    }

    // getByRole("link") throughout — several of these labels are shared by their own
    // group's accordion header (e.g. the "Relationships" module link vs. the "Relationships"
    // group header button), so a plain getByText would match both and throw.
    for (const label of [
      "Relationships",
      "Inventory",
      "Vendors",
      "Finance",
      "Documents",
      "Team",
      "Services",
      "Bloom AI",
      "Settings",
      "Leads",
      "Clients",
      "Commercial Pipeline",
      "Contracts",
      "Client Accounts",
      "Client Invitations",
    ]) {
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

  it("drops Client Accounts/Client Invitations, but keeps the rest of Relationships, for a member without clients.portal_view", () => {
    renderSidebar({
      ...ownerSnapshot,
      permissions: ownerSnapshot.permissions.filter((p) => p !== "clients.portal_view"),
    });

    openGroup("Relationships");

    expect(screen.getByRole("link", { name: "Relationships" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Leads" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Client Accounts" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Client Invitations" })).not.toBeInTheDocument();
  });

  it("renders the now-activated Settings module as a real link, no longer showing a Soon badge", () => {
    renderSidebar(ownerSnapshot);
    openGroup("System");

    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  });

  it("renders the now-activated Inventory module as a real link", () => {
    renderSidebar(ownerSnapshot);
    openGroup("Business");

    expect(screen.getByRole("link", { name: "Inventory" })).toHaveAttribute("href", "/inventory");
  });

  it("renders the now-activated Services module as a real link", () => {
    renderSidebar(ownerSnapshot);
    openGroup("Business");

    expect(screen.getByRole("link", { name: "Services" })).toHaveAttribute("href", "/services");
  });

  it("renders the now-activated Bloom AI module as a real link, no longer showing a Soon badge", () => {
    renderSidebar(ownerSnapshot);
    openGroup("System");

    const bloomAiLink = screen.getByRole("link", { name: "Bloom AI" });
    expect(bloomAiLink).toHaveAttribute("href", "/bloom-ai");
  });

  it("links the Workspace identity footer to the account page", () => {
    renderSidebar(ownerSnapshot);

    expect(screen.getByRole("link", { name: /Amoré Bloom/ })).toHaveAttribute("href", "/account");
  });

  it("auto-opens only the group containing the active route, leaving other groups collapsed", () => {
    renderSidebar(ownerSnapshot);

    // "/dashboard" belongs to "Workspace" (always open) — every other group stays collapsed
    // until its own header is clicked, so navigating to Calendar doesn't also dump Relationships/
    // Business/etc. open at once (GLOBAL-VISUAL-01 Round 4.5 "sidebar must remain compact" fix).
    expect(screen.queryByRole("link", { name: "Leads" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();

    openGroup("Relationships");
    expect(screen.getByRole("link", { name: "Leads" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
  });
});
