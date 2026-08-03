import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemberSessionProvider, useMemberSession } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

function Probe() {
  const session = useMemberSession();
  return (
    <div>
      <div data-testid="status">{session.status}</div>
      <div data-testid="role">{session.role ?? "none"}</div>
      <div data-testid="is-owner">{String(session.isOwner)}</div>
      <div data-testid="can-team-view">{String(session.can("team.view"))}</div>
      <div data-testid="can-team-invite">{String(session.can("team.invite"))}</div>
      <div data-testid="loading">{String(session.loading)}</div>
      <div data-testid="branding">{session.workspaceDisplayName}</div>
    </div>
  );
}

const ownerSnapshot: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_amore_bloom", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["workspace.view", "workspace.manage", "team.view", "team.invite"],
  workspaceDisplayName: "Amoré Bloom",
};

const staffSnapshot: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_4", email: "sofia@amorebloom.com" },
  profile: { full_name: "Sofia Lima", avatar_url: null },
  workspace: { id: "ws_amore_bloom", name: "Amoré Bloom" },
  membership: { id: "member_4", role: "staff", status: "active", created_at: "2026-04-01T00:00:00Z" },
  permissions: ["workspace.view", "team.view", "leads.view"],
  workspaceDisplayName: "Amoré Bloom Team",
};

describe("MemberSessionProvider / useMemberSession", () => {
  it("throws when used outside a provider", () => {
    // Suppress React's expected console.error for this thrown-render case.
    const consoleError = console.error;
    console.error = () => {};
    expect(() => render(<Probe />)).toThrow("useMemberSession must be used within a MemberSessionProvider");
    console.error = consoleError;
  });

  it("exposes owner identity, full permissions, and bare-name branding", () => {
    render(
      <MemberSessionProvider snapshot={ownerSnapshot}>
        <Probe />
      </MemberSessionProvider>,
    );

    expect(screen.getByTestId("status")).toHaveTextContent("active");
    expect(screen.getByTestId("role")).toHaveTextContent("owner");
    expect(screen.getByTestId("is-owner")).toHaveTextContent("true");
    expect(screen.getByTestId("can-team-view")).toHaveTextContent("true");
    expect(screen.getByTestId("can-team-invite")).toHaveTextContent("true");
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
    expect(screen.getByTestId("branding")).toHaveTextContent("Amoré Bloom");
  });

  it("exposes staff identity with a narrower permission set and Team-suffixed branding", () => {
    render(
      <MemberSessionProvider snapshot={staffSnapshot}>
        <Probe />
      </MemberSessionProvider>,
    );

    expect(screen.getByTestId("role")).toHaveTextContent("staff");
    expect(screen.getByTestId("is-owner")).toHaveTextContent("false");
    expect(screen.getByTestId("can-team-view")).toHaveTextContent("true");
    expect(screen.getByTestId("can-team-invite")).toHaveTextContent("false");
    expect(screen.getByTestId("branding")).toHaveTextContent("Amoré Bloom Team");
  });

  it("resolves to a safe empty value for unauthenticated/no-workspace, granting no permissions", () => {
    render(
      <MemberSessionProvider snapshot={{ kind: "no-workspace" }}>
        <Probe />
      </MemberSessionProvider>,
    );

    expect(screen.getByTestId("status")).toHaveTextContent("no-workspace");
    expect(screen.getByTestId("role")).toHaveTextContent("none");
    expect(screen.getByTestId("can-team-view")).toHaveTextContent("false");
  });

  it("resolves to a safe empty value for an inactive member, granting no permissions despite their nominal role", () => {
    render(
      <MemberSessionProvider
        snapshot={{
          kind: "inactive",
          user: { id: "user_4", email: "sofia@amorebloom.com" },
          profile: { full_name: "Sofia Lima", avatar_url: null },
          workspace: { id: "ws_amore_bloom", name: "Amoré Bloom" },
          membership: { id: "member_4", role: "staff", status: "suspended", created_at: "2026-04-01T00:00:00Z" },
          workspaceDisplayName: "Amoré Bloom Team",
        }}
      >
        <Probe />
      </MemberSessionProvider>,
    );

    expect(screen.getByTestId("status")).toHaveTextContent("inactive");
    expect(screen.getByTestId("role")).toHaveTextContent("none");
    expect(screen.getByTestId("is-owner")).toHaveTextContent("false");
    expect(screen.getByTestId("can-team-view")).toHaveTextContent("false");
  });
});
