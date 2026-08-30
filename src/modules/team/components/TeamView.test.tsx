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
import type { PriorityItemData } from "@/modules/dashboard/luxury/components/PriorityList";
import type { LittleReminderData } from "@/modules/dashboard/luxury/components/LittleReminderCard";

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

function renderTeam(
  permissions: Permission[] = ["team.view", "team.manage_roles", "team.invite"],
  overrides: { priorities?: PriorityItemData[]; littleReminder?: LittleReminderData | null } = {},
) {
  return render(
    <MemberSessionProvider snapshot={snapshot(permissions)}>
      <CopilotProvider>
        <TeamView
          branding={branding}
          profileName="Amoré Bloom Owner"
          profileRoleLabel="Owner"
          profileAvatarUrl={null}
          operationalForecast={null}
          priorities={overrides.priorities ?? []}
          littleReminder={overrides.littleReminder ?? null}
        />
      </CopilotProvider>
    </MemberSessionProvider>,
  );
}

describe("TeamView — shares the Founder dashboard's Luxury system", () => {
  it("renders the compact Clock+Weather panel, Today's Focus, and Little Reminder — never a Calendar card", () => {
    renderTeam();

    expect(screen.getByText("Today, at a glance")).toBeInTheDocument();
    expect(screen.getByText("Compact Clock+Weather")).toBeInTheDocument();
    expect(screen.getByText("Today's Focus")).toBeInTheDocument();
    expect(screen.getByText("No priorities set")).toBeInTheDocument();
    expect(screen.getByText("Little Reminder ♡")).toBeInTheDocument();
    expect(screen.getByText("Small steps still move you forward.")).toBeInTheDocument();
    expect(screen.queryByText("Calendar")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open" })).not.toBeInTheDocument();
  });

  it("renders real workspace-wide priority items instead of the empty state when they exist", () => {
    renderTeam(["team.view"], { priorities: [{ id: "p1", title: "Confirm final headcount", dueLabel: "Due Sep 1", completed: false, urgent: true }] });

    expect(screen.getByText("Confirm final headcount")).toBeInTheDocument();
    expect(screen.queryByText("No priorities set")).not.toBeInTheDocument();
  });

  it("renders the viewer's own real notification in Little Reminder when one exists", () => {
    renderTeam(["team.view"], { littleReminder: { title: "Client replied", body: "Naomi Whitfield sent a new message." } });

    expect(screen.getByText("Client replied")).toBeInTheDocument();
    expect(screen.getByText("Naomi Whitfield sent a new message.")).toBeInTheDocument();
    expect(screen.queryByText("Small steps still move you forward.")).not.toBeInTheDocument();
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
            priorities={[]}
            littleReminder={null}
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
