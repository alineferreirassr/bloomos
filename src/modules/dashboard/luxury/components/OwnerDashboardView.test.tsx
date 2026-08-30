import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/dashboard",
}));
// ProfileMenu (signOut Server Action) and OwnerAIBriefCard
// (generateDailyOperationsBrief Server Action, itself pulling in a deep AI
// Skills/Memory import graph) both transitively reach server-only-gated
// modules (@/lib/supabase/server, next/headers) several layers down. Neither
// is part of what this test verifies — the greeting/time-of-day/first-name
// behavior lives entirely in the header above them — so they're stubbed out
// here rather than chased through every transitive import.
vi.mock("@/modules/dashboard/luxury/components/ProfileMenu", () => ({
  ProfileMenu: () => null,
}));
vi.mock("@/modules/dashboard/luxury/components/OwnerAIBriefCard", () => ({
  OwnerAIBriefCard: () => null,
}));
// CalendarWidget/MoodCheckInCard/WaterTrackerCard each call a "use server"
// action (getCalendarEventsAction / wellnessActions.ts) that transitively
// imports @/lib/supabase/server, which itself imports the `server-only`
// package — same reason OwnerAIBriefCard is stubbed above. None of their
// internals are what this test verifies.
vi.mock("@/modules/dashboard/luxury/components/CalendarWidget", () => ({
  CalendarWidget: () => null,
}));
vi.mock("@/modules/dashboard/luxury/components/MoodCheckInCard", () => ({
  MoodCheckInCard: () => null,
}));
vi.mock("@/modules/dashboard/luxury/components/WaterTrackerCard", () => ({
  WaterTrackerCard: () => null,
}));
// WorldClockCard's own timer/Intl behavior is fully covered by its dedicated
// test file — stubbed here so this file's `vi.useFakeTimers()` calls (for
// the greeting tests) can't interact with WorldClockCard's own interval.
vi.mock("@/modules/dashboard/luxury/components/WorldClockCard", () => ({
  WorldClockCard: () => <div>World Clock</div>,
}));

import { OwnerDashboardView } from "@/modules/dashboard/luxury/components/OwnerDashboardView";
import type { OwnerDashboardData } from "@/modules/dashboard/luxury/getOwnerDashboardData";
import type { LuxuryBranding } from "@/modules/dashboard/luxury/components/LuxuryDashboardShell";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import { CopilotProvider } from "@/modules/ai/copilot/CopilotProvider";

const branding: LuxuryBranding = { logoUrl: null, brandName: "Amoré Bloom", tagline: "", inspirationalMessage: "" };

// LuxurySidebar (rendered inside LuxuryDashboardShell) reads useMemberSession()
// to filter nav items — same MemberSessionProvider wrapping precedent as
// MobileNav.test.tsx.
const ownerSnapshot: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Aline Ferreira", avatar_url: null },
  workspace: { id: CURRENT_WORKSPACE_ID, name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: [],
  workspaceDisplayName: "Amoré Bloom",
};

function data(overrides: Partial<OwnerDashboardData> = {}): OwnerDashboardData {
  return {
    welcome: { greeting: "Good evening, there", subtitle: "Here's what's happening across Amoré Bloom today." },
    firstName: "there",
    metrics: [],
    upcomingEvents: [],
    nextEventWeather: null,
    homeWeatherFallback: null,
    weekAgenda: [],
    calendarWidget: { initialEvents: [], initialAnchorIso: "2026-01-01T00:00:00.000Z" },
    priorities: [],
    todaysPriority: null,
    todaysTimeline: [],
    todaysPulse: [],
    revenueSeries: [],
    recentMessages: [],
    teamActivity: [],
    littleReminder: null,
    notificationCount: 0,
    messageCount: 0,
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("OwnerDashboardView", () => {
  it("corrects the server-guessed greeting to the visitor's own local time of day + real first name once mounted", () => {
    // The server (Vercel/Node clock) guessed "evening" and had no name — the
    // exact bug this test guards against. The browser's own clock says 9am.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 9, 0));

    render(
      <MemberSessionProvider snapshot={ownerSnapshot}>
        <CopilotProvider>
          <OwnerDashboardView data={data({ welcome: { greeting: "Good evening, there", subtitle: "x" }, firstName: "Aline" })} branding={branding} profileName="Aline Ferreira" profileRoleLabel="Owner" profileAvatarUrl={null} />
        </CopilotProvider>
      </MemberSessionProvider>,
    );

    expect(screen.getByText("Good morning, Aline")).toBeInTheDocument();
    expect(screen.queryByText("Good evening, there")).not.toBeInTheDocument();
  });

  it("falls back to 'there' when no profile name is available, without hardcoding a name", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 15, 0));

    render(
      <MemberSessionProvider snapshot={ownerSnapshot}>
        <CopilotProvider>
          <OwnerDashboardView data={data({ firstName: "there" })} branding={branding} profileName="there" profileRoleLabel="Owner" profileAvatarUrl={null} />
        </CopilotProvider>
      </MemberSessionProvider>,
    );

    expect(screen.getByText("Good afternoon, there")).toBeInTheDocument();
  });
});

describe("OwnerDashboardView — A little look at today ♡ (World Clock + Weather, no Calendar card)", () => {
  it("renders the eyebrow/heading, World Clock, and a Weather card with a graceful state, even when there is no eligible upcoming event", () => {
    render(
      <MemberSessionProvider snapshot={ownerSnapshot}>
        <CopilotProvider>
          <OwnerDashboardView data={data({ nextEventWeather: null })} branding={branding} profileName="Aline Ferreira" profileRoleLabel="Owner" profileAvatarUrl={null} />
        </CopilotProvider>
      </MemberSessionProvider>,
    );

    expect(screen.getByText("Your Day")).toBeInTheDocument();
    expect(screen.getByText("A little look at today ♡")).toBeInTheDocument();
    expect(screen.getByText("World Clock")).toBeInTheDocument();

    // Weather no longer vanishes when nextEventWeather is null — it still renders its own section, once.
    expect(screen.getAllByText("♡ Weather")).toHaveLength(1);
    expect(screen.getByText("No upcoming event with a set location yet — weather appears here once one is scheduled.")).toBeInTheDocument();

    // The Founder addendum explicitly requires the dashboard Calendar card gone from this composition — /calendar itself is untouched.
    expect(screen.queryByText("Calendar")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open" })).not.toBeInTheDocument();
  });

  it("renders the real forecast beside World Clock when an eligible upcoming event has weather", () => {
    render(
      <MemberSessionProvider snapshot={ownerSnapshot}>
        <CopilotProvider>
          <OwnerDashboardView
            data={data({
              nextEventWeather: {
                eventId: "event_1",
                title: "Amelia & Noah Wedding",
                dateLabel: "Sep 13",
                timeLabel: "5:00 PM",
                forecast: {
                  point: { latitude: 34.05, longitude: -118.24, timezone: "America/Los_Angeles" },
                  eventTime: { time: "2026-09-13T17:00:00", condition: "SUNNY", weatherCode: 0, temperatureF: 78, precipitationProbability: 5, windSpeedMph: 4, windDirectionDeg: 180, isDay: true },
                  day: { date: "2026-09-13", condition: "SUNNY", weatherCode: 0, highF: 82, lowF: 61, precipitationProbabilityMax: 5, windSpeedMaxMph: 6, sunrise: "x", sunset: "x" },
                  sunset: "x",
                },
              },
            })}
            branding={branding}
            profileName="Aline Ferreira"
            profileRoleLabel="Owner"
            profileAvatarUrl={null}
          />
        </CopilotProvider>
      </MemberSessionProvider>,
    );

    expect(screen.getAllByText("♡ Weather")).toHaveLength(1);
    expect(screen.getByText("78°")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Amelia & Noah Wedding" })).toHaveAttribute("href", "/events/event_1");
  });
});

describe("OwnerDashboardView — Dashboard Compact Composition Refinement: Little Reminder moved into My Day, Priority+Upcoming Events side by side", () => {
  it("renders My Day directly below Clock+Weather, with Little Reminder inside it (not beside Priority), then Today's Priority + Upcoming Events as one row", () => {
    const { container } = render(
      <MemberSessionProvider snapshot={ownerSnapshot}>
        <CopilotProvider>
          <OwnerDashboardView data={data({ todaysPriority: null })} branding={branding} profileName="Aline Ferreira" profileRoleLabel="Owner" profileAvatarUrl={null} />
        </CopilotProvider>
      </MemberSessionProvider>,
    );

    expect(screen.getByText("Today's Priority")).toBeInTheDocument();
    expect(screen.getByText("Nothing needs your attention right now ♡")).toBeInTheDocument();
    expect(screen.getByText("A little breathing room is a good thing.")).toBeInTheDocument();
    expect(screen.getByText("Little Reminder ♡")).toBeInTheDocument();
    // No real notification supplied — the shared LittleReminderCard's own graceful fallback, never fabricated priority/event/deadline data.
    expect(screen.getByText("Small steps still move you forward.")).toBeInTheDocument();
    expect(screen.getByText("Upcoming Events")).toBeInTheDocument();

    // Section order: "A little look at today ♡" heading, then My Day, then the Priority+Upcoming row — never Revenue/Messages/etc. in between.
    const headings = Array.from(container.querySelectorAll("h2")).map((h) => h.textContent);
    const glanceIndex = headings.indexOf("A little look at today ♡");
    const myDayIndex = headings.indexOf("My Day");
    const priorityIndex = headings.indexOf("Today's Priority");
    const upcomingIndex = headings.indexOf("Upcoming Events");
    expect(glanceIndex).toBeGreaterThanOrEqual(0);
    expect(myDayIndex).toBeGreaterThan(glanceIndex);
    expect(priorityIndex).toBeGreaterThan(myDayIndex);
    expect(upcomingIndex).toBeGreaterThan(priorityIndex);

    // Little Reminder now lives INSIDE the My Day composition (stagger-3), never beside Priority.
    const myDaySection = container.querySelector(".stagger-3");
    expect(myDaySection?.textContent).toContain("Little Reminder ♡");

    // Today's Priority and Upcoming Events belong to the SAME composition row (stagger-4), side by side.
    const priorityUpcomingRow = container.querySelector(".stagger-4");
    expect(priorityUpcomingRow?.textContent).toContain("Today's Priority");
    expect(priorityUpcomingRow?.textContent).toContain("Upcoming Events");
  });

  it("renders My Day and Little Reminder exactly once each", () => {
    render(
      <MemberSessionProvider snapshot={ownerSnapshot}>
        <CopilotProvider>
          <OwnerDashboardView data={data()} branding={branding} profileName="Aline Ferreira" profileRoleLabel="Owner" profileAvatarUrl={null} />
        </CopilotProvider>
      </MemberSessionProvider>,
    );

    expect(screen.getAllByRole("heading", { name: "My Day" })).toHaveLength(1);
    expect(screen.getAllByText("Little Reminder ♡")).toHaveLength(1);
    expect(screen.getAllByRole("heading", { name: "Today's Priority" })).toHaveLength(1);
    expect(screen.getAllByRole("heading", { name: "Upcoming Events" })).toHaveLength(1);
  });

  it("renders the Founder's own real latest unread notification instead of the fallback when one exists", () => {
    render(
      <MemberSessionProvider snapshot={ownerSnapshot}>
        <CopilotProvider>
          <OwnerDashboardView
            data={data({ littleReminder: { title: "Client replied", body: "Naomi Whitfield sent a new message." } })}
            branding={branding}
            profileName="Aline Ferreira"
            profileRoleLabel="Owner"
            profileAvatarUrl={null}
          />
        </CopilotProvider>
      </MemberSessionProvider>,
    );

    expect(screen.getByText("Client replied")).toBeInTheDocument();
    expect(screen.getByText("Naomi Whitfield sent a new message.")).toBeInTheDocument();
    expect(screen.queryByText("Small steps still move you forward.")).not.toBeInTheDocument();
  });

  it("renders the real headline instead of the empty state when a today's priority exists", () => {
    render(
      <MemberSessionProvider snapshot={ownerSnapshot}>
        <CopilotProvider>
          <OwnerDashboardView
            data={data({ todaysPriority: { headline: "Confirm final headcount", meta: "Due Sep 1" } })}
            branding={branding}
            profileName="Aline Ferreira"
            profileRoleLabel="Owner"
            profileAvatarUrl={null}
          />
        </CopilotProvider>
      </MemberSessionProvider>,
    );

    expect(screen.getByText("Confirm final headcount")).toBeInTheDocument();
    expect(screen.getByText("Due Sep 1")).toBeInTheDocument();
    expect(screen.queryByText("Nothing needs your attention right now ♡")).not.toBeInTheDocument();
  });
});

describe("OwnerDashboardView — My Day composition (Mood + Water only)", () => {
  it("no longer contains a Weather card in My Day now that Weather lives in Today at a glance", () => {
    render(
      <MemberSessionProvider snapshot={ownerSnapshot}>
        <CopilotProvider>
          <OwnerDashboardView data={data()} branding={branding} profileName="Aline Ferreira" profileRoleLabel="Owner" profileAvatarUrl={null} />
        </CopilotProvider>
      </MemberSessionProvider>,
    );

    expect(screen.getByText("My Day")).toBeInTheDocument();
    expect(screen.getByText("A few things just for you.")).toBeInTheDocument();
    // Exactly one Weather card exists on the whole page (in Today at a glance), never a second copy inside My Day.
    expect(screen.getAllByText("♡ Weather")).toHaveLength(1);
  });
});
