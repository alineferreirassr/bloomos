import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/client-access",
}));
vi.mock("@/modules/dashboard/luxury/components/CompactClockWeatherPanel", () => ({
  CompactClockWeatherPanel: ({ location, forecast }: { location: { city: string }; forecast: { highF: number } | null }) => (
    <div>
      Compact Clock+Weather for {location.city}
      {forecast ? ` ${forecast.highF}°` : ""}
    </div>
  ),
}));
vi.mock("@/modules/clientJourney/components/ClientPortalJourneyCard", () => ({
  ClientPortalJourneyCard: () => null,
}));
vi.mock("@/modules/proposalPlatform/components/ClientPortalProposalCard", () => ({
  ClientPortalProposalCard: () => null,
}));

import { ClientDashboardView } from "@/modules/dashboard/luxury/components/ClientDashboardView";
import type { ClientDashboardData } from "@/modules/clientAccess/getClientDashboardData";

function data(overrides: Partial<ClientDashboardData> = {}): ClientDashboardData {
  return {
    welcome: { greeting: "Good evening, Naomi", subtitle: "Here's what's happening with your event." },
    logoUrl: null,
    brandName: "Amoré Bloom",
    emotionalMessage: "Every detail is planned with love.",
    hero: null,
    checklist: [],
    checklistCompleteCount: 0,
    checklistTotalCount: 0,
    timeline: [],
    todaysPriority: null,
    todaysTimeline: [],
    includedServices: [],
    paymentTotalLabel: "$0.00",
    paymentRows: [],
    planner: { name: "Amoré Bloom", avatarUrl: null, email: null, phone: null },
    portalSummary: {
      journeyStageLabel: null,
      journeyProgressPercentage: null,
      journeyNextStepLabel: null,
      unreadMessageCount: 0,
      openProposalsCount: 0,
      openContractsCount: 0,
      outstandingBalanceLabel: "$0.00",
      latestDocuments: [],
      announcements: [],
    },
    recentActivity: [],
    operationalForecast: null,
    ...overrides,
  };
}

describe("ClientDashboardView — same compact Clock+Weather variant as Team, never the Founder World Clock", () => {
  it("renders exactly one compact panel for the shared operational location", () => {
    render(<ClientDashboardView data={data()} />);

    expect(screen.getAllByText(/Compact Clock\+Weather for Huntington Beach/)).toHaveLength(1);
  });

  it("passes the real fetched forecast through, never a fabricated value", () => {
    render(<ClientDashboardView data={data({ operationalForecast: { date: "2026-08-29", condition: "SUNNY", weatherCode: 0, highF: 82, lowF: 65, precipitationProbabilityMax: 0, windSpeedMaxMph: 4, sunrise: "x", sunset: "x" } })} />);

    expect(screen.getByText(/82°/)).toBeInTheDocument();
  });

  it("never exposes a Founder-specific or client-event location — only the shared operational location", () => {
    render(<ClientDashboardView data={data()} />);

    expect(screen.queryByText("Honolulu")).not.toBeInTheDocument();
    expect(screen.queryByText("Sorocaba")).not.toBeInTheDocument();
  });
});

describe("ClientDashboardView — AF-Inspired Today's Priority + Little Reminder + Today's Timeline", () => {
  it("renders the real recommended-action headline instead of the empty state when one exists", () => {
    render(<ClientDashboardView data={data({ todaysPriority: "Sign your final contract" })} />);

    expect(screen.getByText("Today's Priority")).toBeInTheDocument();
    expect(screen.getByText("Sign your final contract")).toBeInTheDocument();
    expect(screen.queryByText("Nothing needs your attention right now ♡")).not.toBeInTheDocument();
  });

  it("falls back to the shared graceful empty state when there is no real recommended action, and shows Little Reminder's own fallback (no per-client notification feed exists)", () => {
    render(<ClientDashboardView data={data({ todaysPriority: null })} />);

    expect(screen.getByText("Nothing needs your attention right now ♡")).toBeInTheDocument();
    expect(screen.getByText("Little Reminder ♡")).toBeInTheDocument();
    expect(screen.getByText("Small steps still move you forward.")).toBeInTheDocument();
  });

  it("renders Today's Timeline with no footer navigation links (no client-facing /calendar route exists) and never renders Upcoming Events or Today's Pulse", () => {
    render(
      <ClientDashboardView
        data={data({ todaysTimeline: [{ id: "e1", timeLabel: "Today", title: "Whitfield Anniversary Dinner", subtitle: "Anniversary", icon: "Calendar" }] })}
      />,
    );

    expect(screen.getByText("Today's Timeline")).toBeInTheDocument();
    expect(screen.getByText("Whitfield Anniversary Dinner")).toBeInTheDocument();
    expect(screen.queryByText("+ Add event")).not.toBeInTheDocument();
    expect(screen.queryByText("View full calendar")).not.toBeInTheDocument();
    expect(screen.queryByText("Upcoming Events")).not.toBeInTheDocument();
    expect(screen.queryByText("Today's Pulse")).not.toBeInTheDocument();
  });
});
