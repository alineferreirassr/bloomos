import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/team",
}));
// Same server-action-heavy-child stubbing precedent as OwnerDashboardView.test.tsx —
// none of these components' internals are what this file verifies.
vi.mock("@/modules/dashboard/luxury/components/ProfileMenu", () => ({
  ProfileMenu: () => null,
}));
vi.mock("@/modules/dashboard/luxury/components/CalendarWidget", () => ({
  CalendarWidget: () => null,
}));
vi.mock("@/modules/dashboard/luxury/components/MoodCheckInCard", () => ({
  MoodCheckInCard: () => null,
}));
vi.mock("@/modules/dashboard/luxury/components/WaterTrackerCard", () => ({
  WaterTrackerCard: () => null,
}));
vi.mock("@/modules/dashboard/luxury/components/NoteForAlineCard", () => ({
  NoteForAlineCard: () => null,
}));
vi.mock("@/modules/dashboard/luxury/components/WorldClockCard", () => ({
  WorldClockCard: () => <div>World Clock</div>,
}));

import { TeamDashboardView } from "@/modules/dashboard/luxury/components/TeamDashboardView";
import type { TeamDashboardData } from "@/modules/dashboard/luxury/getTeamDashboardData";
import type { LuxuryBranding } from "@/modules/dashboard/luxury/components/LuxuryDashboardShell";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import { CopilotProvider } from "@/modules/ai/copilot/CopilotProvider";
import { DEFAULT_TEAM_ROLE_LABEL } from "@/types/teamRoleLabel";

const branding: LuxuryBranding = { logoUrl: null, brandName: "Amoré Bloom", tagline: "", inspirationalMessage: "" };

const teamSnapshot: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_2", email: "staff@amorebloom.com" },
  profile: { full_name: "Jordan Rivera", avatar_url: null },
  workspace: { id: CURRENT_WORKSPACE_ID, name: "Amoré Bloom" },
  membership: { id: "member_2", role: "staff", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: [],
  workspaceDisplayName: "Amoré Bloom",
};

function data(overrides: Partial<TeamDashboardData> = {}): TeamDashboardData {
  return {
    welcome: { greeting: "Good evening, Jordan", subtitle: "Here's what's happening today." },
    memberName: "Jordan Rivera",
    teamRoleLabel: DEFAULT_TEAM_ROLE_LABEL,
    metrics: [],
    schedule: [],
    tasks: [],
    currentEvent: null,
    currentEventIsToday: false,
    calendarWidget: { initialEvents: [], initialAnchorIso: "2026-01-01T00:00:00.000Z" },
    progressPercent: 0,
    progressStages: [],
    teamUpdates: [],
    importantNote: null,
    weather: null,
    nextEventWeather: null,
    reminder: null,
    littleReminder: null,
    notificationCount: 0,
    messageCount: 0,
    ...overrides,
  };
}

function renderTeam(overrides: Partial<TeamDashboardData> = {}) {
  return render(
    <MemberSessionProvider snapshot={teamSnapshot}>
      <CopilotProvider>
        <TeamDashboardView data={data(overrides)} branding={branding} profileName="Jordan Rivera" profileRoleLabel="Staff" profileAvatarUrl={null} />
      </CopilotProvider>
    </MemberSessionProvider>,
  );
}

describe("TeamDashboardView — shares the Founder dashboard's Today, at a glance composition", () => {
  it("renders the eyebrow/heading, the same World Clock component, and a Weather card with a graceful state when no eligible event has weather", () => {
    renderTeam({ nextEventWeather: null });

    expect(screen.getByText("Your Day")).toBeInTheDocument();
    expect(screen.getByText("Today, at a glance")).toBeInTheDocument();
    expect(screen.getByText("World Clock")).toBeInTheDocument();

    expect(screen.getAllByText("♡ Weather")).toHaveLength(1);
    expect(screen.getByText("No upcoming event with a set location yet — weather appears here once one is scheduled.")).toBeInTheDocument();

    // Calendar now lives beside Weather as a compact card, not a full-width row.
    expect(screen.getAllByText("Calendar")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("href", "/calendar");
  });

  it("passes the founder-authored contingency plan into the shared Weather card, alongside a real forecast", () => {
    renderTeam({
      weather: { description: "Tent has a full rain backup plan.", highLabel: "—", lowLabel: "—" },
      nextEventWeather: {
        eventId: "event_9",
        title: "Whitfield Anniversary Dinner",
        dateLabel: "Aug 28",
        timeLabel: "7:00 PM",
        forecast: {
          point: { latitude: 33.66, longitude: -117.99, timezone: "America/Los_Angeles" },
          eventTime: { time: "2026-08-28T19:00:00", condition: "PARTLY_CLOUDY", weatherCode: 2, temperatureF: 74, precipitationProbability: 15, windSpeedMph: 6, windDirectionDeg: 200, isDay: false },
          day: { date: "2026-08-28", condition: "PARTLY_CLOUDY", weatherCode: 2, highF: 79, lowF: 63, precipitationProbabilityMax: 15, windSpeedMaxMph: 8, sunrise: "x", sunset: "x" },
          sunset: "x",
        },
      },
    });

    expect(screen.getByText("74°")).toBeInTheDocument();
    expect(screen.getByText("Contingency plan:")).toBeInTheDocument();
    expect(screen.getByText(/Tent has a full rain backup plan\./)).toBeInTheDocument();
  });

  it("preserves Today's Work (Schedule/Tasks/Current Event) and My Day below the new section", () => {
    renderTeam();

    expect(screen.getByText("Today's Schedule")).toBeInTheDocument();
    expect(screen.getByText("My Tasks")).toBeInTheDocument();
    // "My Day" also labels the sidebar's Team-specific Dashboard nav link, so scope to the section heading.
    expect(screen.getByRole("heading", { name: "My Day" })).toBeInTheDocument();
  });
});
