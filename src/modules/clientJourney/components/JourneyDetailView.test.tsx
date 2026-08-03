import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { JourneyDetailView } from "@/modules/clientJourney/components/JourneyDetailView";
import type { ClientJourney } from "@/types/clientJourney";

vi.mock("@/modules/clientJourney/clientJourneyActions", () => ({
  evaluateClientJourneyAction: vi.fn(),
  transitionClientJourneyAction: vi.fn(),
  assignJourneyOwnerAction: vi.fn(),
  listInformationRequestsAction: vi.fn(),
  createInformationRequestAction: vi.fn(),
}));

vi.mock("@/modules/communication/comments/components/CommentsPanel", () => ({
  CommentsPanel: () => <div data-testid="comments-panel" />,
}));

import { evaluateClientJourneyAction, listInformationRequestsAction } from "@/modules/clientJourney/clientJourneyActions";

function makeJourney(overrides: Partial<ClientJourney> = {}): ClientJourney {
  return {
    subjectType: "client",
    subjectId: "client_1",
    workspaceId: "ws_1",
    displayName: "Priya Nair",
    currentStage: "proposal_sent",
    status: "active",
    progress: { overallPercentage: 40, currentStageProgress: 100, completedStages: ["new_lead", "contacted", "qualified"], remainingRequiredStages: ["proposal_accepted"], optionalStages: [], blockedStages: [], skippedStages: [], weightingMethod: "test" },
    health: { leadHealth: 100, proposalHealth: 100, contractHealth: 100, invoiceHealth: 100, paymentHealth: 100, communicationHealth: 100, portalHealth: 100, planningHealth: 100, operationalReadiness: 100, clientResponseHealth: 100, overallJourneyHealth: 100 },
    milestones: [{ stage: "new_lead", label: "New Lead", weight: 1, completed: true, completedAt: null }],
    requirements: [],
    blockers: [],
    risks: [],
    nextBestActions: [],
    owners: [{ role: "primary", memberId: null, assignedAt: null, assignedByMemberId: null }],
    context: { journeySummary: "", currentStage: "proposal_sent", progressPercentage: 40, blockers: [], nextActions: [], recentActivity: [], communicationSummary: "", relatedCommercialRecords: [], relatedOperationalRecords: [] },
    evaluatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("JourneyDetailView", () => {
  it("renders the journey's stage and progress once loaded", async () => {
    vi.mocked(evaluateClientJourneyAction).mockResolvedValue({ success: true, data: makeJourney() });
    vi.mocked(listInformationRequestsAction).mockResolvedValue({ success: true, data: [] });
    render(<JourneyDetailView subjectType="client" subjectId="client_1" />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Priya Nair" })).toBeInTheDocument());
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  it("shows an accessible empty state when the journey can't be found", async () => {
    vi.mocked(evaluateClientJourneyAction).mockResolvedValue({ success: false, error: "This client or lead could not be found." });
    render(<JourneyDetailView subjectType="client" subjectId="nonexistent" />);
    await waitFor(() => expect(screen.getByText("This journey isn't available")).toBeInTheDocument());
  });

  it("shows a positive message when there are no blockers", async () => {
    vi.mocked(evaluateClientJourneyAction).mockResolvedValue({ success: true, data: makeJourney({ blockers: [] }) });
    vi.mocked(listInformationRequestsAction).mockResolvedValue({ success: true, data: [] });
    render(<JourneyDetailView subjectType="client" subjectId="client_1" />);
    await waitFor(() => expect(screen.getByText("No blockers detected.")).toBeInTheDocument());
  });

  it("offers to cancel a non-terminal journey", async () => {
    vi.mocked(evaluateClientJourneyAction).mockResolvedValue({ success: true, data: makeJourney({ currentStage: "proposal_sent" }) });
    vi.mocked(listInformationRequestsAction).mockResolvedValue({ success: true, data: [] });
    render(<JourneyDetailView subjectType="client" subjectId="client_1" />);
    await waitFor(() => expect(screen.getByText("Cancel Journey")).toBeInTheDocument());
  });

  it("offers to restore a lost journey instead of cancel", async () => {
    vi.mocked(evaluateClientJourneyAction).mockResolvedValue({ success: true, data: makeJourney({ currentStage: "lost", status: "lost" }) });
    vi.mocked(listInformationRequestsAction).mockResolvedValue({ success: true, data: [] });
    render(<JourneyDetailView subjectType="client" subjectId="client_1" />);
    await waitFor(() => expect(screen.getByText("Restore")).toBeInTheDocument());
    expect(screen.queryByText("Cancel Journey")).not.toBeInTheDocument();
  });
});
