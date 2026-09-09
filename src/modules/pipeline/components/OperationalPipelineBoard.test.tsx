import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OperationalPipelineBoard } from "@/modules/pipeline/components/OperationalPipelineBoard";
import { makeEvent, makeChecklistItem, makeScheduleItem } from "@/modules/events/testUtils";
import { makeClient } from "@/modules/clients/testUtils";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import type { Permission } from "@/core/enums/permission";
import type { DragEndEvent } from "@dnd-kit/core";
import type { ReactNode } from "react";

function snapshotWith(permissions: Permission[]): MemberSessionSnapshot {
  return {
    kind: "active",
    user: { id: "user_1", email: "owner@amorebloom.com" },
    profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
    workspace: { id: "ws_amore_bloom", name: "Amoré Bloom" },
    membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
    permissions,
    workspaceDisplayName: "Amoré Bloom",
  };
}

const fullPermissions: Permission[] = ["events.update"];

function renderBoard(permissions: Permission[] = fullPermissions) {
  render(
    <MemberSessionProvider snapshot={snapshotWith(permissions)}>
      <OperationalPipelineBoard />
    </MemberSessionProvider>,
  );
  // Desktop and mobile both render in jsdom (no real CSS to hide via
  // `hidden`/`md:hidden`) — every content assertion is scoped to the
  // desktop board so it isn't ambiguous with the mobile view's duplicate,
  // matching CommercialPipelineBoard.test.tsx's own established pattern.
  return () => within(screen.getByTestId("operational-pipeline-desktop"));
}

/** Both the label and its "N events" count live as sibling <p>s inside the
 * column's own header <div> — scoping through that real DOM relationship
 * (not a Tailwind class) proves which column an event currently sits in. */
function columnCountText(desktop: () => ReturnType<typeof within>, label: string) {
  const heading = desktop().getByText(label, { selector: "p" });
  return within(heading.parentElement as HTMLElement).getByText(/events?$/);
}

vi.mock("@/lib/data", () => ({
  getEvents: vi.fn(),
  getClients: vi.fn(),
  getChecklistByEventId: vi.fn(),
  getScheduleByEventId: vi.fn(),
  getEventNextAction: vi.fn(),
  updateEventLifecycleStage: vi.fn(),
}));

// Test-only DnD boundary mock (reused verbatim from POST-VM D4A's
// CommercialPipelineBoard.test.tsx): jsdom can't reliably simulate
// @dnd-kit's real pointer-sensor activation, so DndContext is replaced with
// a pass-through that captures the real, unexported `handleDragEnd` closure
// OperationalPipelineBoard supplies as `onDragEnd` — tests below invoke that
// captured closure directly with a minimal DragEndEvent-shaped object, which
// exercises the board's actual production DnD wiring, not dnd-kit itself.
let capturedOnDragEnd: ((event: DragEndEvent) => void) | undefined;

vi.mock("@dnd-kit/core", async () => {
  const actual = await vi.importActual<typeof import("@dnd-kit/core")>("@dnd-kit/core");
  return {
    ...actual,
    DndContext: ({ children, onDragEnd }: { children: ReactNode; onDragEnd: (event: DragEndEvent) => void }) => {
      capturedOnDragEnd = onDragEnd;
      return children;
    },
  };
});

import * as dataLayer from "@/lib/data";

const READY_EVENT = makeEvent({
  id: "event_1",
  title: "Grand Ballroom Wedding",
  client_id: "client_1",
  lifecycle_stage: "planning",
  status: "confirmed",
  priority: "high",
  location_name: "Grand Ballroom",
  budget_min: 500000,
  event_date: "2027-06-01",
});
const READY_CLIENT = makeClient({ id: "client_1", first_name: "Priya", last_name: "Nair" });

function mockReadyBoard(overrides: { events?: ReturnType<typeof makeEvent>[]; clients?: ReturnType<typeof makeClient>[] } = {}) {
  vi.mocked(dataLayer.getEvents).mockResolvedValue(overrides.events ?? [READY_EVENT]);
  vi.mocked(dataLayer.getClients).mockResolvedValue(overrides.clients ?? [READY_CLIENT]);
  vi.mocked(dataLayer.getChecklistByEventId).mockResolvedValue([makeChecklistItem({ status: "completed" })]);
  vi.mocked(dataLayer.getScheduleByEventId).mockResolvedValue([makeScheduleItem()]);
  vi.mocked(dataLayer.getEventNextAction).mockResolvedValue("Send final invoice");
}

beforeEach(() => {
  vi.mocked(dataLayer.getClients).mockResolvedValue([]);
  vi.mocked(dataLayer.getChecklistByEventId).mockResolvedValue([]);
  vi.mocked(dataLayer.getScheduleByEventId).mockResolvedValue([]);
  vi.mocked(dataLayer.getEventNextAction).mockResolvedValue(null);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("OperationalPipelineBoard", () => {
  it("shows a loading state before Events resolve", () => {
    vi.mocked(dataLayer.getEvents).mockReturnValue(new Promise(() => {}));
    const { container } = render(
      <MemberSessionProvider snapshot={snapshotWith(fullPermissions)}>
        <OperationalPipelineBoard />
      </MemberSessionProvider>,
    );
    expect(container.querySelectorAll(".luxury-shimmer").length).toBeGreaterThan(0);
  });

  it("shows an error state with retry when getEvents rejects", async () => {
    vi.mocked(dataLayer.getEvents).mockRejectedValueOnce(new Error("boom"));
    renderBoard();
    expect(await screen.findByText(/could not load the operational pipeline/i)).toBeInTheDocument();

    vi.mocked(dataLayer.getEvents).mockResolvedValueOnce([]);
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText(/no active events/i)).toBeInTheDocument();
  });

  it("renders a populated event card: title, client, priority, health, and checklist progress", async () => {
    mockReadyBoard();
    const desktop = renderBoard();
    await screen.findByTestId("operational-pipeline-desktop");

    expect(desktop().getByText("Grand Ballroom Wedding")).toBeInTheDocument();
    expect(desktop().getByText("Priya Nair")).toBeInTheDocument();
    expect(desktop().getByText("High")).toBeInTheDocument();
    expect(desktop().getByText("Ready")).toBeInTheDocument();
    expect(desktop().getByText("Checklist: 1/1")).toBeInTheDocument();
    expect(desktop().getByText("Send final invoice")).toBeInTheDocument();
    expect(columnCountText(desktop, "Planning")).toHaveTextContent("1 event");
  });

  it("shows an empty-board state when there are no active Events", async () => {
    vi.mocked(dataLayer.getEvents).mockResolvedValue([]);
    renderBoard();
    expect(await screen.findByText(/no active events/i)).toBeInTheDocument();
  });

  it("filters by search text across event title and client name", async () => {
    const other = makeEvent({ id: "event_2", title: "Garden Birthday Party", client_id: "client_2", lifecycle_stage: "planning" });
    const otherClient = makeClient({ id: "client_2", first_name: "Sam", last_name: "Ortiz" });
    mockReadyBoard({ events: [READY_EVENT, other], clients: [READY_CLIENT, otherClient] });
    const desktop = renderBoard();
    await screen.findByText("Grand Ballroom Wedding");

    await userEvent.type(screen.getByLabelText(/search events/i), "priya");
    expect(desktop().getByText("Grand Ballroom Wedding")).toBeInTheDocument();
    expect(desktop().queryByText("Garden Birthday Party")).not.toBeInTheDocument();
  });

  it("maps a drag drop onto another column to the correct lifecycle-stage update (real handleDragEnd)", async () => {
    mockReadyBoard();
    vi.mocked(dataLayer.updateEventLifecycleStage).mockResolvedValue({
      success: true,
      data: { ...READY_EVENT, lifecycle_stage: "preparation" },
    });
    const desktop = renderBoard();
    await screen.findByText("Grand Ballroom Wedding");
    expect(columnCountText(desktop, "Planning")).toHaveTextContent("1 event");
    expect(columnCountText(desktop, "Preparation")).toHaveTextContent("0 events");

    await act(async () => {
      capturedOnDragEnd?.({ active: { id: "event_1" }, over: { id: "preparation" } } as DragEndEvent);
    });

    await waitFor(() => {
      expect(dataLayer.updateEventLifecycleStage).toHaveBeenCalledWith("event_1", "preparation");
    });
    await waitFor(() => {
      expect(columnCountText(desktop, "Preparation")).toHaveTextContent("1 event");
    });
    expect(columnCountText(desktop, "Planning")).toHaveTextContent("0 events");
  });

  it("rolls back the optimistic move and shows a board error when the stage update fails", async () => {
    mockReadyBoard();
    vi.mocked(dataLayer.updateEventLifecycleStage).mockResolvedValue({ success: false, error: "Stage update rejected." });
    const desktop = renderBoard();
    await screen.findByText("Grand Ballroom Wedding");

    await act(async () => {
      capturedOnDragEnd?.({ active: { id: "event_1" }, over: { id: "preparation" } } as DragEndEvent);
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Stage update rejected.");
    // Rolled back to its original column — not left stuck mid-move.
    expect(columnCountText(desktop, "Planning")).toHaveTextContent("1 event");
    expect(columnCountText(desktop, "Preparation")).toHaveTextContent("0 events");
  });

  it("does not update the stage on a same-stage drop", async () => {
    mockReadyBoard();
    renderBoard();
    await screen.findByText("Grand Ballroom Wedding");
    const callsBefore = vi.mocked(dataLayer.updateEventLifecycleStage).mock.calls.length;

    await act(async () => {
      capturedOnDragEnd?.({ active: { id: "event_1" }, over: { id: "planning" } } as DragEndEvent);
    });

    expect(vi.mocked(dataLayer.updateEventLifecycleStage).mock.calls.length).toBe(callsBefore);
  });

  it("does not update the stage on an invalid drop with no drop target", async () => {
    mockReadyBoard();
    renderBoard();
    await screen.findByText("Grand Ballroom Wedding");
    const callsBefore = vi.mocked(dataLayer.updateEventLifecycleStage).mock.calls.length;

    await act(async () => {
      capturedOnDragEnd?.({ active: { id: "event_1" }, over: null } as DragEndEvent);
    });

    expect(vi.mocked(dataLayer.updateEventLifecycleStage).mock.calls.length).toBe(callsBefore);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not offer drag on a locked (closed-stage) card", async () => {
    const closedEvent = makeEvent({ id: "event_1", title: "Grand Ballroom Wedding", client_id: "client_1", lifecycle_stage: "closed" });
    mockReadyBoard({ events: [closedEvent] });
    renderBoard();
    await screen.findByText("Grand Ballroom Wedding");

    expect(screen.queryByRole("button", { name: /drag .*'s card/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/drag grand ballroom wedding's card/i)).not.toBeInTheDocument();
  });

  it("does not offer drag when the member lacks events.update", async () => {
    mockReadyBoard();
    renderBoard([]);
    await screen.findByText("Grand Ballroom Wedding");

    expect(screen.queryByRole("button", { name: /drag .*'s card/i })).not.toBeInTheDocument();
  });
});
