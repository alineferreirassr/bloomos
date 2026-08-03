import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ClientJourneyDashboardView } from "@/modules/clientJourney/components/ClientJourneyDashboardView";
import type { ClientJourneySummary } from "@/modules/clientJourney/clientJourneyActions";

vi.mock("@/modules/clientJourney/clientJourneyActions", () => ({
  listClientJourneysAction: vi.fn(),
}));

import { listClientJourneysAction } from "@/modules/clientJourney/clientJourneyActions";

function makeSummary(overrides: Partial<ClientJourneySummary> = {}): ClientJourneySummary {
  return {
    subjectType: "client",
    subjectId: "client_1",
    displayName: "Priya Nair",
    currentStage: "proposal_sent",
    status: "active",
    overallHealth: 90,
    overallProgress: 40,
    blockerCount: 0,
    criticalBlockerCount: 0,
    ...overrides,
  };
}

describe("ClientJourneyDashboardView", () => {
  it("renders KPIs and the journey list once loaded", async () => {
    vi.mocked(listClientJourneysAction).mockResolvedValue({ success: true, data: [makeSummary()] });
    render(<ClientJourneyDashboardView />);
    await waitFor(() => expect(screen.getByText("Priya Nair")).toBeInTheDocument());
    expect(screen.getByText("Active Journeys")).toBeInTheDocument();
  });

  it("shows an accessible empty state when the action fails", async () => {
    vi.mocked(listClientJourneysAction).mockResolvedValue({ success: false, error: "The Client Journey Platform isn't available." });
    render(<ClientJourneyDashboardView />);
    await waitFor(() => expect(screen.getByText("The Client Journey Platform isn't available")).toBeInTheDocument());
  });

  it("shows a blocker badge for journeys that have critical blockers", async () => {
    vi.mocked(listClientJourneysAction).mockResolvedValue({ success: true, data: [makeSummary({ blockerCount: 2, criticalBlockerCount: 1 })] });
    render(<ClientJourneyDashboardView />);
    await waitFor(() => expect(screen.getByText("1 critical blocker")).toBeInTheDocument());
  });

  it("shows a friendly empty state when no journeys are active", async () => {
    vi.mocked(listClientJourneysAction).mockResolvedValue({ success: true, data: [] });
    render(<ClientJourneyDashboardView />);
    await waitFor(() => expect(screen.getByText("No journeys match this filter")).toBeInTheDocument());
  });
});
