import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/team",
}));
vi.mock("@/modules/dashboard/luxury/components/CompactClockWeatherPanel", () => ({
  CompactClockWeatherPanel: ({ forecast }: { forecast: { highF: number } | null }) => (
    <div>Compact Clock+Weather{forecast ? ` ${forecast.highF}°` : ""}</div>
  ),
}));
vi.mock("@/modules/dashboard/luxury/components/CalendarWidget", () => ({
  CalendarWidget: () => null,
}));
vi.mock("@/modules/team/components/NewInvitationModal", () => ({
  NewInvitationModal: () => null,
}));
vi.mock("@/modules/dashboard/luxury/components/ProfileMenu", () => ({
  ProfileMenu: () => null,
}));
vi.mock("@/modules/dashboard/teamRoleLabelActions", () => ({
  listTeamRoleLabelsAction: vi.fn().mockResolvedValue({ success: true, data: {} }),
  setTeamRoleLabelAction: vi.fn(),
}));
vi.mock("@/lib/data", () => ({
  getWorkspaceMembers: vi.fn().mockResolvedValue([
    {
      id: "member_1",
      workspace_id: "workspace_1",
      user_id: "user_1",
      role: "owner",
      status: "active",
      full_name: "Amoré Bloom Owner",
      email: "owner@amorebloom.com",
      avatar_url: null,
      created_at: "2025-12-31T00:00:00Z",
      updated_at: "2025-12-31T00:00:00Z",
    },
    {
      id: "member_2",
      workspace_id: "workspace_1",
      user_id: "user_2",
      role: "staff",
      status: "active",
      full_name: "Jordan Rivera",
      email: "staff@amorebloom.com",
      avatar_url: null,
      created_at: "2026-02-09T00:00:00Z",
      updated_at: "2026-02-09T00:00:00Z",
    },
  ]),
  getWorkspaceInvitations: vi.fn().mockResolvedValue([]),
  expireWorkspaceInvitations: vi.fn().mockResolvedValue(undefined),
  createWorkspaceInvitation: vi.fn(),
  resendWorkspaceInvitation: vi.fn(),
  revokeWorkspaceInvitation: vi.fn(),
  updateWorkspaceMemberRole: vi.fn(),
  deactivateWorkspaceMember: vi.fn(),
  reactivateWorkspaceMember: vi.fn(),
  removeWorkspaceMember: vi.fn(),
}));

import { TeamView } from "@/modules/team/components/TeamView";
import type { LuxuryBranding } from "@/modules/dashboard/luxury/components/LuxuryDashboardShell";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import { CopilotProvider } from "@/modules/ai/copilot/CopilotProvider";
import type { Permission } from "@/core/enums/permission";

const branding: LuxuryBranding = { logoUrl: null, brandName: "Amoré Bloom", tagline: "", inspirationalMessage: "" };

function snapshot(permissions: Permission[]): MemberSessionSnapshot {
  return {
    kind: "active",
    user: { id: "user_1", email: "owner@amorebloom.com" },
    profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
    workspace: { id: CURRENT_WORKSPACE_ID, name: "Amoré Bloom" },
    membership: { id: "member_1", role: "owner", status: "active", created_at: "2025-12-31T00:00:00Z" },
    permissions,
    workspaceDisplayName: "Amoré Bloom",
  };
}

function renderTeam(permissions: Permission[] = ["team.view", "team.manage_roles", "team.invite"]) {
  return render(
    <MemberSessionProvider snapshot={snapshot(permissions)}>
      <CopilotProvider>
        <TeamView
          branding={branding}
          profileName="Amoré Bloom Owner"
          profileRoleLabel="Owner"
          profileAvatarUrl={null}
          operationalForecast={null}
          calendarWidget={{ initialEvents: [], initialAnchorIso: "2026-01-01T00:00:00.000Z" }}
        />
      </CopilotProvider>
    </MemberSessionProvider>,
  );
}

describe("TeamView — shares the Founder dashboard's Luxury system", () => {
  it("renders the compact Clock+Weather panel and a compact Calendar with an Open link", () => {
    renderTeam();

    expect(screen.getByText("Today, at a glance")).toBeInTheDocument();
    expect(screen.getByText("Compact Clock+Weather")).toBeInTheDocument();
    expect(screen.getAllByText("Calendar")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("href", "/calendar");
  });

  it("passes the fetched operational forecast through to the compact panel", () => {
    render(
      <MemberSessionProvider snapshot={snapshot(["team.view"])}>
        <CopilotProvider>
          <TeamView
            branding={branding}
            profileName="Amoré Bloom Owner"
            profileRoleLabel="Owner"
            profileAvatarUrl={null}
            operationalForecast={{ date: "2026-08-29", condition: "PARTLY_CLOUDY", weatherCode: 2, highF: 78, lowF: 60, precipitationProbabilityMax: 10, windSpeedMaxMph: 7, sunrise: "x", sunset: "x" }}
            calendarWidget={{ initialEvents: [], initialAnchorIso: "2026-01-01T00:00:00.000Z" }}
          />
        </CopilotProvider>
      </MemberSessionProvider>,
    );

    expect(screen.getByText("Compact Clock+Weather 78°")).toBeInTheDocument();
  });

  it("preserves the existing roster: members load, roles are manageable when permitted", async () => {
    renderTeam(["team.view", "team.manage_roles", "team.invite"]);

    await waitFor(() => expect(screen.getByText("Jordan Rivera")).toBeInTheDocument());
    expect(screen.getByText("Amoré Bloom Owner")).toBeInTheDocument();
    expect(screen.getByLabelText("Role for staff@amorebloom.com")).toBeInTheDocument();
    expect(screen.getAllByText("Deactivate").length).toBeGreaterThan(0);
  });

  it("hides role-management controls for a viewer without team.manage_roles", async () => {
    renderTeam(["team.view"]);

    await waitFor(() => expect(screen.getByText("Jordan Rivera")).toBeInTheDocument());
    expect(screen.queryByLabelText("Role for staff@amorebloom.com")).not.toBeInTheDocument();
    expect(screen.queryByText("Deactivate")).not.toBeInTheDocument();
  });
});
