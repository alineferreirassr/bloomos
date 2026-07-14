import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EventDetailView } from "@/modules/events/components/EventDetailView";
import { makeEvent } from "@/modules/events/testUtils";
import { makeClient } from "@/modules/clients/testUtils";

vi.mock("@/lib/data", () => ({
  getEventById: vi.fn(),
  getClientById: vi.fn(),
  getNotesByEventId: vi.fn(),
  getTimelineByEventId: vi.fn(),
  getChecklistByEventId: vi.fn(),
  getScheduleByEventId: vi.fn(),
  getEventNextAction: vi.fn(),
  createEventNote: vi.fn(),
  togglePinNote: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

function mockReady(overrides: Partial<ReturnType<typeof makeEvent>> = {}) {
  const event = makeEvent({
    id: "event_1",
    title: "Malibu Sunset Proposal",
    client_id: "client_1",
    status: "confirmed",
    lifecycle_stage: "booking",
    priority: "high",
    event_date: "2026-08-22",
    location_name: "El Matador State Beach",
    ...overrides,
  });
  vi.mocked(dataLayer.getEventById).mockResolvedValue(event);
  vi.mocked(dataLayer.getClientById).mockResolvedValue(
    makeClient({ id: "client_1", first_name: "Jordan", last_name: "Ellis" }),
  );
  vi.mocked(dataLayer.getNotesByEventId).mockResolvedValue([]);
  vi.mocked(dataLayer.getTimelineByEventId).mockResolvedValue([]);
  vi.mocked(dataLayer.getChecklistByEventId).mockResolvedValue([]);
  vi.mocked(dataLayer.getScheduleByEventId).mockResolvedValue([]);
  vi.mocked(dataLayer.getEventNextAction).mockResolvedValue(null);
  return event;
}

describe("EventDetailView", () => {
  it("renders the header, client link, and every overview section once the event loads", async () => {
    mockReady();

    render(<EventDetailView eventId="event_1" />);

    expect(await screen.findByText("Malibu Sunset Proposal")).toBeInTheDocument();
    // Badge text and Status/Lifecycle/Priority select option text legitimately
    // repeat on this page (header badge + the transition select's options),
    // so use getAllByText rather than asserting a single match.
    expect(screen.getAllByText("Confirmed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Booking").length).toBeGreaterThan(0);
    expect(screen.getAllByText("High").length).toBeGreaterThan(0);

    const clientLink = screen.getAllByRole("link", { name: /jordan ellis/i })[0];
    expect(clientLink).toHaveAttribute("href", "/clients/client_1");

    expect(screen.getByText("Event Summary")).toBeInTheDocument();
    expect(screen.getByText("Date & Time")).toBeInTheDocument();
    expect(screen.getByText("Location")).toBeInTheDocument();
    expect(screen.getByText("Budget, Package & Guests")).toBeInTheDocument();
    expect(screen.getByText("Theme & Color Palette")).toBeInTheDocument();
    expect(screen.getByText("Surprise & Confidentiality")).toBeInTheDocument();
    expect(screen.getByText("Accessibility & Dietary Notes")).toBeInTheDocument();
    expect(screen.getByText("Weather Plan & Backup Location")).toBeInTheDocument();
    expect(screen.getByText("Internal Summary")).toBeInTheDocument();
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByText("Event Health")).toBeInTheDocument();
    expect(screen.getByText("Checklist Summary")).toBeInTheDocument();
    expect(screen.getByText("Schedule Summary")).toBeInTheDocument();
    expect(screen.getByText("Timeline")).toBeInTheDocument();
    expect(screen.getByText("Future Integrations")).toBeInTheDocument();
  });

  it("renders the health score and severity from getEventHealthDetails", async () => {
    mockReady({ location_name: null, address: null, budget_min: null, budget_max: null });
    // Isolate location/budget as the only two triggered factors by giving
    // this event checklist and schedule items (mockReady defaults both to
    // empty, which would otherwise also deduct).
    vi.mocked(dataLayer.getChecklistByEventId).mockResolvedValue([
      {
        id: "c1",
        workspace_id: "ws_test",
        owner_type: "event",
        owner_id: "event_1",
        title: "Item",
        description: null,
        category: "planning",
        priority: "normal",
        status: "pending",
        due_date: null,
        completed_at: null,
        assigned_type: "unknown",
        assigned_id: null,
        assigned_name: null,
        sort_order: 0,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ]);
    vi.mocked(dataLayer.getScheduleByEventId).mockResolvedValue([
      {
        id: "s1",
        workspace_id: "ws_test",
        owner_type: "event",
        owner_id: "event_1",
        title: "Item",
        description: null,
        start_time: null,
        end_time: null,
        location: null,
        assigned_to: null,
        category: "setup",
        status: "planned",
        sort_order: 0,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ]);

    render(<EventDetailView eventId="event_1" />);

    await screen.findByText("Event Health");
    // Missing location (15) + missing budget (10) = 100 - 25 = 75.
    expect(screen.getByText("75")).toBeInTheDocument();
    expect(screen.getByText("Missing location")).toBeInTheDocument();
    expect(screen.getByText("Missing budget")).toBeInTheDocument();
  });

  it("renders checklist and schedule summary stats", async () => {
    mockReady();
    vi.mocked(dataLayer.getChecklistByEventId).mockResolvedValue([
      {
        id: "c1",
        workspace_id: "ws_test",
        owner_type: "event",
        owner_id: "event_1",
        title: "Confirm ring",
        description: null,
        category: "client",
        priority: "critical",
        status: "completed",
        due_date: null,
        completed_at: "2026-06-01T00:00:00.000Z",
        assigned_type: "unknown",
        assigned_id: null,
        assigned_name: null,
        sort_order: 0,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ]);

    render(<EventDetailView eventId="event_1" />);

    await screen.findByText("Checklist Summary");
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("shows an error state when the event can't be found", async () => {
    vi.mocked(dataLayer.getEventById).mockRejectedValue(new Error("not found"));

    render(<EventDetailView eventId="does_not_exist" />);

    expect(await screen.findByText(/could not load this event/i)).toBeInTheDocument();
  });

  it("renders Notes read-only for a cancelled event but not for a completed one", async () => {
    mockReady({ status: "cancelled" });
    render(<EventDetailView eventId="event_1" />);
    await screen.findByText("Notes");
    expect(screen.queryByRole("button", { name: /add note/i })).not.toBeInTheDocument();
  });

  it("keeps Notes editable for a completed event", async () => {
    mockReady({ status: "completed" });
    render(<EventDetailView eventId="event_1" />);
    await screen.findByText("Notes");
    expect(screen.getByRole("button", { name: /add note/i })).toBeInTheDocument();
  });
});
