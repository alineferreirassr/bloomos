import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/modules/clientPortal/getClientPortalJourneyDetail", () => ({
  getClientPortalJourneyDetailAction: vi.fn(),
  respondToClientPortalJourneyNoteAction: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { ClientPortalJourneyView } from "@/modules/clientPortal/components/ClientPortalJourneyView";
import { getClientPortalJourneyDetailAction } from "@/modules/clientPortal/getClientPortalJourneyDetail";

const DETAIL = {
  currentStageLabel: "Planning",
  progressPercentage: 54,
  currentStageProgress: 30,
  steps: [
    { stage: "intake", label: "Intake", status: "completed" as const },
    { stage: "planning", label: "Planning", status: "current" as const },
    { stage: "closed", label: "Closed", status: "upcoming" as const },
  ],
  milestones: [{ label: "Deposit paid", completed: true, completedAt: "2026-01-05T00:00:00.000Z" }],
  notes: [
    { id: "req_1", title: "Confirm guest count", description: "Let us know your final headcount.", requiredFields: [], requiredDocuments: [], dueDate: null, status: "pending" as const, clientResponse: null },
  ],
};

describe("ClientPortalJourneyView", () => {
  it("renders the current stage, steps, milestones, and a pending note", async () => {
    vi.mocked(getClientPortalJourneyDetailAction).mockResolvedValue({ success: true, data: DETAIL } as never);
    render(<ClientPortalJourneyView />);
    await waitFor(() => expect(screen.getByText("Currently: Planning")).toBeInTheDocument());
    expect(screen.getByText("Deposit paid")).toBeInTheDocument();
    expect(screen.getByText("Confirm guest count")).toBeInTheDocument();
  });

  it("renders an already-answered note as the client's response, not an input", async () => {
    const answered = { ...DETAIL, notes: [{ ...DETAIL.notes[0], status: "fulfilled" as const, clientResponse: "12 guests" }] };
    vi.mocked(getClientPortalJourneyDetailAction).mockResolvedValue({ success: true, data: answered } as never);
    render(<ClientPortalJourneyView />);
    await waitFor(() => expect(screen.getByText(/12 guests/)).toBeInTheDocument());
    expect(screen.queryByPlaceholderText("Type your response…")).not.toBeInTheDocument();
  });

  it("shows an error state with retry on failure", async () => {
    vi.mocked(getClientPortalJourneyDetailAction).mockResolvedValue({ success: false, error: "boom" } as never);
    render(<ClientPortalJourneyView />);
    await waitFor(() => expect(screen.getByText("Could not load your journey.")).toBeInTheDocument());
  });
});
