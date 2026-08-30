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
// MoodCheckInCard/WaterTrackerCard each call a "use server" action module
// (wellnessActions.ts) that isn't safe to import into a Vitest/jsdom
// render tree — same mocking precedent as OwnerDashboardView.test.tsx.
vi.mock("@/modules/dashboard/luxury/components/MoodCheckInCard", () => ({
  MoodCheckInCard: ({ privacyDetail }: { privacyDetail?: string }) => (
    <div>
      Mood Check-In
      {privacyDetail ? <p>{privacyDetail}</p> : null}
    </div>
  ),
}));
vi.mock("@/modules/dashboard/luxury/components/WaterTrackerCard", () => ({
  WaterTrackerCard: ({ privacyDetail }: { privacyDetail?: string }) => (
    <div>
      Water Tracker
      {privacyDetail ? <p>{privacyDetail}</p> : null}
    </div>
  ),
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
import type { TodaysPriorityData } from "@/modules/dashboard/luxury/components/TodaysPriorityCard";
import type { LittleReminderData } from "@/modules/dashboard/luxury/components/LittleReminderCard";
import type { EventPreviewCardData } from "@/modules/dashboard/luxury/components/EventPreviewCard";
import type { ScheduleTimelineItemData } from "@/modules/dashboard/luxury/components/ScheduleTimeline";
import type { TodaysPulseMetric } from "@/modules/dashboard/luxury/components/TodaysPulseCard";

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
  overrides: {
    todaysPriority?: TodaysPriorityData | null;
    littleReminder?: LittleReminderData | null;
    upcomingEvents?: EventPreviewCardData[];
    todaysTimeline?: ScheduleTimelineItemData[];
    todaysPulse?: TodaysPulseMetric[];
  } = {},
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
          todaysPriority={overrides.todaysPriority ?? null}
          littleReminder={overrides.littleReminder ?? null}
          upcomingEvents={overrides.upcomingEvents ?? []}
          todaysTimeline={overrides.todaysTimeline ?? []}
          todaysPulse={overrides.todaysPulse ?? []}
        />
      </CopilotProvider>
    </MemberSessionProvider>,
  );
}

describe("TeamView — shares the Founder dashboard's Luxury system", () => {
  it("renders the compact Clock+Weather panel, Today's Priority, and Little Reminder — never a Calendar dashboard widget", () => {
    renderTeam();

    expect(screen.getByText("A little look at today ♡")).toBeInTheDocument();
    expect(screen.getByText("Compact Clock+Weather")).toBeInTheDocument();
    expect(screen.getByText("Today's Priority")).toBeInTheDocument();
    expect(screen.getByText("Nothing needs your attention right now ♡")).toBeInTheDocument();
    expect(screen.getByText("Little Reminder ♡")).toBeInTheDocument();
    expect(screen.getByText("Small steps still move you forward.")).toBeInTheDocument();
    expect(screen.queryByText("Calendar")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open" })).not.toBeInTheDocument();
  });

  it("never renders the old full-list Today's Focus presentation", () => {
    renderTeam();

    expect(screen.queryByText("Today's Focus")).not.toBeInTheDocument();
  });

  it("renders the real single headline instead of the empty state when a today's priority exists", () => {
    renderTeam(["team.view"], { todaysPriority: { headline: "Confirm final headcount", meta: "Due Sep 1" } });

    expect(screen.getByText("Confirm final headcount")).toBeInTheDocument();
    expect(screen.getByText("Due Sep 1")).toBeInTheDocument();
    expect(screen.queryByText("Nothing needs your attention right now ♡")).not.toBeInTheDocument();
  });

  it("renders the viewer's own real notification in Little Reminder when one exists", () => {
    renderTeam(["team.view"], { littleReminder: { title: "Client replied", body: "Naomi Whitfield sent a new message." } });

    expect(screen.getByText("Client replied")).toBeInTheDocument();
    expect(screen.getByText("Naomi Whitfield sent a new message.")).toBeInTheDocument();
    expect(screen.queryByText("Small steps still move you forward.")).not.toBeInTheDocument();
  });

  it("renders Upcoming Events directly below Priority/Reminder, then Today's Timeline beside Today's Pulse", () => {
    const { container } = renderTeam(["team.view"], {
      upcomingEvents: [{ id: "event_5", title: "Whitfield Anniversary Dinner", dayLabel: "13", monthLabel: "Sep", timeLabel: "19:00:00", categoryLabel: "Anniversary", imageUrl: null, href: "/events/event_5" }],
      todaysPulse: [{ label: "Priorities", value: "1" }, { label: "Today's Events", value: "0" }],
    });

    expect(screen.getByText("Whitfield Anniversary Dinner")).toBeInTheDocument();
    expect(screen.getByText("Today's Timeline")).toBeInTheDocument();
    expect(screen.getByText("Today's Pulse")).toBeInTheDocument();

    const headings = Array.from(container.querySelectorAll("h2")).map((h) => h.textContent);
    const priorityIndex = headings.indexOf("Today's Priority");
    const upcomingIndex = headings.indexOf("Upcoming Events");
    const timelineIndex = headings.indexOf("Today's Timeline");
    expect(priorityIndex).toBeGreaterThanOrEqual(0);
    expect(upcomingIndex).toBeGreaterThan(priorityIndex);
    expect(timelineIndex).toBeGreaterThan(upcomingIndex);
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
            todaysPriority={null}
            littleReminder={null}
            upcomingEvents={[]}
            todaysTimeline={[]}
            todaysPulse={[]}
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

describe("TeamView — My Day ♡ (Mood + Water), directly below Clock+Weather", () => {
  it("renders Mood and Water Tracker directly below Clock+Weather, before Today's Priority, exactly once", () => {
    const { container } = renderTeam();

    expect(screen.getByText("Mood Check-In")).toBeInTheDocument();
    expect(screen.getByText("Water Tracker")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "My Day" })).toHaveLength(1);

    const headings = Array.from(container.querySelectorAll("h2")).map((h) => h.textContent);
    const glanceIndex = headings.indexOf("A little look at today ♡");
    const myDayIndex = headings.indexOf("My Day");
    const priorityIndex = headings.indexOf("Today's Priority");
    const upcomingIndex = headings.indexOf("Upcoming Events");
    expect(glanceIndex).toBeGreaterThanOrEqual(0);
    expect(myDayIndex).toBeGreaterThan(glanceIndex);
    expect(priorityIndex).toBeGreaterThan(myDayIndex);
    expect(upcomingIndex).toBeGreaterThan(priorityIndex);
  });

  it("preserves the existing per-viewer privacy statement — never claims team-shared wellness data", () => {
    renderTeam();

    expect(screen.getAllByText("Your mood and water tracker are personal to you and are never visible to your team.").length).toBeGreaterThan(0);
  });

  it("never renders a second Mood/Water instance for any other team member — exactly the current viewer's own single wellness pair", () => {
    renderTeam();

    expect(screen.getAllByText("Mood Check-In")).toHaveLength(1);
    expect(screen.getAllByText("Water Tracker")).toHaveLength(1);
  });
});
