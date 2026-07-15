import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EventScheduleView } from "@/modules/events/components/EventScheduleView";
import { makeEvent, makeScheduleItem } from "@/modules/events/testUtils";
import { makeClient } from "@/modules/clients/testUtils";
import type { EventScheduleItem } from "@/types/eventScheduleItem";

vi.mock("@/lib/data", () => ({
  getEventById: vi.fn(),
  getClientById: vi.fn(),
  getScheduleByEventId: vi.fn(),
  createScheduleItem: vi.fn(),
  updateScheduleItem: vi.fn(),
  updateScheduleItemStatus: vi.fn(),
  deleteScheduleItem: vi.fn(),
  reorderScheduleItems: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

function mockReady(items: EventScheduleItem[], eventOverrides: Partial<ReturnType<typeof makeEvent>> = {}) {
  const event = makeEvent({
    id: "event_1",
    title: "Malibu Sunset Proposal",
    client_id: "client_1",
    status: "confirmed",
    event_date: "2026-08-22",
    ...eventOverrides,
  });
  vi.mocked(dataLayer.getEventById).mockResolvedValue(event);
  vi.mocked(dataLayer.getClientById).mockResolvedValue(
    makeClient({ id: "client_1", first_name: "Jordan", last_name: "Ellis" }),
  );
  vi.mocked(dataLayer.getScheduleByEventId).mockResolvedValue(items);
  return event;
}

function getRow(itemId: string) {
  return within(screen.getByTestId(`schedule-item-${itemId}`));
}

// The Timeline Summary card also renders the first/last item's title (e.g.
// "First: Team arrival"), so unscoped screen.getByText/queryByText on a
// title can be ambiguous. All list-content assertions below go through this
// helper, scoped to the item list itself, to avoid that collision.
function list() {
  return within(screen.getByTestId("schedule-item-list"));
}

async function openMenu(itemId: string, user: ReturnType<typeof userEvent.setup>) {
  const row = getRow(itemId);
  await user.click(row.getByRole("button", { name: /item actions/i }));
  return row;
}

describe("EventScheduleView", () => {
  // Mocks created by vi.mock() above are module-level singletons whose call
  // history persists across tests in this file (this project doesn't set
  // clearMocks/restoreMocks globally), so a later `not.toHaveBeenCalled()`
  // assertion can otherwise see calls left over from an earlier test.
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the header, timeline summary, and items once loaded", async () => {
    mockReady([
      makeScheduleItem({ id: "s1", title: "Team arrival", start_time: "17:00", end_time: "17:45", sort_order: 0 }),
      makeScheduleItem({ id: "s2", title: "Breakdown", start_time: "20:00", end_time: "20:30", sort_order: 1 }),
    ]);

    render(<EventScheduleView eventId="event_1" />);

    expect(await screen.findByTestId("schedule-item-s1")).toBeInTheDocument();
    expect(list().getByText("Team arrival")).toBeInTheDocument();
    expect(list().getByText("Breakdown")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to malibu sunset proposal/i })).toHaveAttribute(
      "href",
      "/events/event_1",
    );
    expect(screen.getByText("Timeline Summary")).toBeInTheDocument();
  });

  it("shows an empty state when there are no schedule items yet", async () => {
    mockReady([]);
    render(<EventScheduleView eventId="event_1" />);
    expect(await screen.findByText("No schedule items yet")).toBeInTheDocument();
  });

  it("renders items in chronological order by start_time, not array/sort_order", async () => {
    mockReady([
      makeScheduleItem({ id: "s1", title: "Later item", start_time: "20:00", sort_order: 0 }),
      makeScheduleItem({ id: "s2", title: "Earlier item", start_time: "17:00", sort_order: 1 }),
    ]);
    render(<EventScheduleView eventId="event_1" />);
    await screen.findByTestId("schedule-item-s1");

    const titles = list()
      .getAllByText(/item$/)
      .map((el) => el.textContent);
    expect(titles.indexOf("Earlier item")).toBeLessThan(titles.indexOf("Later item"));
  });

  it("places untimed items after every timed item", async () => {
    mockReady([
      makeScheduleItem({ id: "s1", title: "No time set", start_time: null, sort_order: 0 }),
      makeScheduleItem({ id: "s2", title: "Has a time", start_time: "09:00", sort_order: 1 }),
    ]);
    render(<EventScheduleView eventId="event_1" />);
    await screen.findByTestId("schedule-item-s1");

    const cards = list()
      .getAllByText(/^(No time set|Has a time)$/)
      .map((el) => el.textContent);
    expect(cards).toEqual(["Has a time", "No time set"]);
  });

  it("filters items by search text", async () => {
    const user = userEvent.setup();
    mockReady([
      makeScheduleItem({ id: "s1", title: "Team arrival", start_time: "17:00", sort_order: 0 }),
      makeScheduleItem({ id: "s2", title: "Breakdown", start_time: "20:00", sort_order: 1 }),
    ]);
    render(<EventScheduleView eventId="event_1" />);
    await screen.findByTestId("schedule-item-s1");

    await user.type(screen.getByLabelText(/search schedule items/i), "breakdown");

    expect(list().queryByText("Team arrival")).not.toBeInTheDocument();
    expect(list().getByText("Breakdown")).toBeInTheDocument();
  });

  it("filters to delayed-only items", async () => {
    const user = userEvent.setup();
    mockReady([
      makeScheduleItem({ id: "s1", title: "On track", status: "planned", start_time: "17:00", sort_order: 0 }),
      makeScheduleItem({ id: "s2", title: "Running late", status: "delayed", start_time: "18:00", sort_order: 1 }),
    ]);
    render(<EventScheduleView eventId="event_1" />);
    await screen.findByTestId("schedule-item-s1");

    await user.click(screen.getByLabelText(/delayed only/i));

    expect(list().queryByText("On track")).not.toBeInTheDocument();
    expect(list().getByText("Running late")).toBeInTheDocument();
  });

  it("creates a new schedule item", async () => {
    const user = userEvent.setup();
    mockReady([]);
    vi.mocked(dataLayer.createScheduleItem).mockResolvedValue({
      success: true,
      data: makeScheduleItem({ id: "new_1", title: "New item" }),
    });

    render(<EventScheduleView eventId="event_1" />);
    await screen.findByText("No schedule items yet");

    await user.click(screen.getAllByRole("button", { name: /add schedule item/i })[0]);
    await user.type(screen.getByLabelText(/^title/i), "New item");
    await user.click(screen.getByRole("button", { name: /^add item$/i }));

    expect(dataLayer.createScheduleItem).toHaveBeenCalledWith(
      "event_1",
      expect.objectContaining({ title: "New item" }),
    );
  });

  it("edits an existing item", async () => {
    const user = userEvent.setup();
    const item = makeScheduleItem({ id: "s1", title: "Team arrival", sort_order: 0 });
    mockReady([item]);
    vi.mocked(dataLayer.updateScheduleItem).mockResolvedValue({ success: true, data: item });

    render(<EventScheduleView eventId="event_1" />);
    await screen.findByTestId("schedule-item-s1");

    await openMenu("s1", user);
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));

    const titleInput = await screen.findByDisplayValue("Team arrival");
    await user.clear(titleInput);
    await user.type(titleInput, "Team arrival & setup");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(dataLayer.updateScheduleItem).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ title: "Team arrival & setup" }),
    );
  });

  it("assigns a responsible person and changes category through the edit form", async () => {
    const user = userEvent.setup();
    const item = makeScheduleItem({ id: "s1", title: "Team arrival", category: "setup", sort_order: 0 });
    mockReady([item]);
    vi.mocked(dataLayer.updateScheduleItem).mockResolvedValue({ success: true, data: item });

    render(<EventScheduleView eventId="event_1" />);
    await screen.findByTestId("schedule-item-s1");

    await openMenu("s1", user);
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));

    await screen.findByDisplayValue("Team arrival");
    await user.type(screen.getByLabelText(/assigned to/i), "Jamie Rivera");
    await user.selectOptions(screen.getByLabelText(/^category/i), "arrival");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(dataLayer.updateScheduleItem).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ assigned_to: "Jamie Rivera", category: "arrival" }),
    );
  });

  it("clears assignment through the item menu", async () => {
    const user = userEvent.setup();
    const item = makeScheduleItem({ id: "s1", title: "Team arrival", assigned_to: "Jamie Rivera", sort_order: 0 });
    mockReady([item]);
    vi.mocked(dataLayer.updateScheduleItem).mockResolvedValue({ success: true, data: item });

    render(<EventScheduleView eventId="event_1" />);
    await screen.findByTestId("schedule-item-s1");

    await openMenu("s1", user);
    await user.click(screen.getByRole("menuitem", { name: "Clear assignment" }));

    expect(dataLayer.updateScheduleItem).toHaveBeenCalledWith("s1", expect.objectContaining({ assigned_to: null }));
  });

  it("marks an item confirmed via the menu", async () => {
    const user = userEvent.setup();
    const item = makeScheduleItem({ id: "s1", title: "Team arrival", status: "planned", sort_order: 0 });
    mockReady([item]);
    vi.mocked(dataLayer.updateScheduleItemStatus).mockResolvedValue({ success: true, data: item });

    render(<EventScheduleView eventId="event_1" />);
    await screen.findByTestId("schedule-item-s1");

    await openMenu("s1", user);
    await user.click(screen.getByRole("menuitem", { name: "Mark confirmed" }));

    expect(dataLayer.updateScheduleItemStatus).toHaveBeenCalledWith("s1", "confirmed");
  });

  it("marks an item delayed via the menu", async () => {
    const user = userEvent.setup();
    const item = makeScheduleItem({ id: "s1", title: "Team arrival", status: "confirmed", sort_order: 0 });
    mockReady([item]);
    vi.mocked(dataLayer.updateScheduleItemStatus).mockResolvedValue({ success: true, data: item });

    render(<EventScheduleView eventId="event_1" />);
    await screen.findByTestId("schedule-item-s1");

    await openMenu("s1", user);
    await user.click(screen.getByRole("menuitem", { name: "Mark delayed" }));

    expect(dataLayer.updateScheduleItemStatus).toHaveBeenCalledWith("s1", "delayed");
  });

  it("marks an item completed via the menu", async () => {
    const user = userEvent.setup();
    const item = makeScheduleItem({ id: "s1", title: "Team arrival", status: "confirmed", sort_order: 0 });
    mockReady([item]);
    vi.mocked(dataLayer.updateScheduleItemStatus).mockResolvedValue({ success: true, data: item });

    render(<EventScheduleView eventId="event_1" />);
    await screen.findByTestId("schedule-item-s1");

    await openMenu("s1", user);
    await user.click(screen.getByRole("menuitem", { name: "Mark completed" }));

    expect(dataLayer.updateScheduleItemStatus).toHaveBeenCalledWith("s1", "completed");
  });

  it("cancels an item via the menu", async () => {
    const user = userEvent.setup();
    const item = makeScheduleItem({ id: "s1", title: "Team arrival", status: "planned", sort_order: 0 });
    mockReady([item]);
    vi.mocked(dataLayer.updateScheduleItemStatus).mockResolvedValue({ success: true, data: item });

    render(<EventScheduleView eventId="event_1" />);
    await screen.findByTestId("schedule-item-s1");

    await openMenu("s1", user);
    await user.click(screen.getByRole("menuitem", { name: "Cancel item" }));

    expect(dataLayer.updateScheduleItemStatus).toHaveBeenCalledWith("s1", "cancelled");
  });

  it("still offers Delete for a completed item (no data-layer restriction, unlike Checklist)", async () => {
    const user = userEvent.setup();
    mockReady([makeScheduleItem({ id: "s1", title: "Team arrival", status: "completed", sort_order: 0 })]);
    render(<EventScheduleView eventId="event_1" />);
    await screen.findByTestId("schedule-item-s1");

    await openMenu("s1", user);
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
  });

  it("deletes an item after confirmation", async () => {
    const user = userEvent.setup();
    mockReady([makeScheduleItem({ id: "s1", title: "Team arrival", sort_order: 0 })]);
    vi.mocked(dataLayer.deleteScheduleItem).mockResolvedValue({ success: true, data: null });

    render(<EventScheduleView eventId="event_1" />);
    await screen.findByTestId("schedule-item-s1");

    await openMenu("s1", user);
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    const dialog = screen.getByRole("dialog", { name: /delete schedule item/i });
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    expect(dataLayer.deleteScheduleItem).toHaveBeenCalledWith("s1");
  });

  it("reorders items that share the same start time", async () => {
    const user = userEvent.setup();
    const items = [
      makeScheduleItem({ id: "s1", title: "First tied item", start_time: "17:00", sort_order: 0 }),
      makeScheduleItem({ id: "s2", title: "Second tied item", start_time: "17:00", sort_order: 1 }),
    ];
    mockReady(items);
    vi.mocked(dataLayer.reorderScheduleItems).mockResolvedValue({ success: true, data: items });

    render(<EventScheduleView eventId="event_1" />);
    await screen.findByTestId("schedule-item-s1");

    await user.click(getRow("s1").getByRole("button", { name: /move down/i }));

    expect(dataLayer.reorderScheduleItems).toHaveBeenCalledWith("event_1", ["s2", "s1"]);
  });

  it("disables reorder controls between items with different concrete times", async () => {
    mockReady([
      makeScheduleItem({ id: "s1", title: "Earlier item", start_time: "17:00", sort_order: 0 }),
      makeScheduleItem({ id: "s2", title: "Later item", start_time: "20:00", sort_order: 1 }),
    ]);
    render(<EventScheduleView eventId="event_1" />);
    await screen.findByTestId("schedule-item-s1");

    expect(getRow("s1").getByRole("button", { name: /move down/i })).toBeDisabled();
    expect(getRow("s2").getByRole("button", { name: /move up/i })).toBeDisabled();
  });

  it("rejects an end time before the start time in the create form", async () => {
    const user = userEvent.setup();
    mockReady([]);
    render(<EventScheduleView eventId="event_1" />);
    await screen.findByText("No schedule items yet");

    await user.click(screen.getAllByRole("button", { name: /add schedule item/i })[0]);
    await user.type(screen.getByLabelText(/^title/i), "Bad time item");
    await user.type(screen.getByLabelText(/start time/i), "18:00");
    await user.type(screen.getByLabelText(/end time/i), "17:00");
    await user.click(screen.getByRole("button", { name: /^add item$/i }));

    expect(await screen.findByText(/end time cannot be before start time/i)).toBeInTheDocument();
    expect(dataLayer.createScheduleItem).not.toHaveBeenCalled();
  });

  it("hides all mutation controls for an archived event", async () => {
    mockReady([makeScheduleItem({ id: "s1", title: "Team arrival", sort_order: 0 })], { status: "archived" });
    render(<EventScheduleView eventId="event_1" />);
    await screen.findByTestId("schedule-item-s1");

    expect(screen.queryByRole("button", { name: /add schedule item/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /item actions/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /move down/i })).not.toBeInTheDocument();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });

  it("hides all mutation controls for a cancelled event", async () => {
    mockReady([makeScheduleItem({ id: "s1", title: "Team arrival", sort_order: 0 })], { status: "cancelled" });
    render(<EventScheduleView eventId="event_1" />);
    await screen.findByTestId("schedule-item-s1");

    expect(screen.queryByRole("button", { name: /add schedule item/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /item actions/i })).not.toBeInTheDocument();
  });

  it("keeps schedule management available for a completed event", async () => {
    mockReady([makeScheduleItem({ id: "s1", title: "Team arrival", status: "planned", sort_order: 0 })], {
      status: "completed",
    });
    render(<EventScheduleView eventId="event_1" />);
    await screen.findByTestId("schedule-item-s1");

    expect(screen.getAllByRole("button", { name: /add schedule item/i }).length).toBeGreaterThan(0);
  });

  it("shows an error state when the schedule fails to load", async () => {
    vi.mocked(dataLayer.getEventById).mockRejectedValue(new Error("network error"));
    render(<EventScheduleView eventId="does_not_exist" />);
    expect(await screen.findByText(/could not load this schedule/i)).toBeInTheDocument();
  });
});
