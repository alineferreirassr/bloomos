import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";

vi.mock("@/lib/data", () => ({
  getClientPortalTimeline: vi.fn(),
  logClientPortalActivityForCurrentSession: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { ClientPortalTimelineView } from "@/modules/clientPortal/components/ClientPortalTimelineView";
import { getClientPortalTimeline, logClientPortalActivityForCurrentSession } from "@/lib/data";

const ENTRY = {
  id: "entry_1",
  kind: "payment_received" as const,
  title: "Deposit received",
  description: null,
  occurred_at: "2026-01-05T00:00:00.000Z",
};

describe("ClientPortalTimelineView", () => {
  it("renders client-safe timeline entries", async () => {
    vi.mocked(getClientPortalTimeline).mockResolvedValue([ENTRY] as never);
    render(<ClientPortalTimelineView />);
    await waitFor(() => expect(screen.getByText("Deposit received")).toBeInTheDocument());
    expect(within(screen.getByRole("list", { name: "Event timeline" })).getByText("Payment Received")).toBeInTheDocument();
  });

  it("Step 6: never surfaces an Automation/Workflow's own name — only a generic 'Workflow Update' label", async () => {
    vi.mocked(getClientPortalTimeline).mockResolvedValue([
      { ...ENTRY, kind: "workflow_milestone", title: "Follow-up sent" },
    ] as never);
    render(<ClientPortalTimelineView />);
    await waitFor(() => expect(screen.getByText("Follow-up sent")).toBeInTheDocument());
    expect(within(screen.getByRole("list", { name: "Event timeline" })).getByText("Workflow Update")).toBeInTheDocument();
  });

  it("shows an empty state when there is no history yet", async () => {
    vi.mocked(getClientPortalTimeline).mockResolvedValue([] as never);
    render(<ClientPortalTimelineView />);
    await waitFor(() => expect(screen.getByText("Nothing yet")).toBeInTheDocument());
  });

  it("shows an error state with retry on failure", async () => {
    vi.mocked(getClientPortalTimeline).mockRejectedValue(new Error("boom"));
    render(<ClientPortalTimelineView />);
    await waitFor(() => expect(screen.getByText("Could not load your timeline.")).toBeInTheDocument());
  });

  it("Step 14: logs a timeline_viewed activity entry once on mount", async () => {
    vi.mocked(getClientPortalTimeline).mockResolvedValue([] as never);
    render(<ClientPortalTimelineView />);
    await waitFor(() => expect(logClientPortalActivityForCurrentSession).toHaveBeenCalledWith("timeline_viewed"));
  });
});
