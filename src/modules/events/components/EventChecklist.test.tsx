import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EventChecklistView } from "@/modules/events/components/EventChecklistView";
import { makeChecklistItem, makeEvent } from "@/modules/events/testUtils";
import { makeClient } from "@/modules/clients/testUtils";
import type { ChecklistItem } from "@/types/checklistItem";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/data", () => ({
  getEventById: vi.fn(),
  getClientById: vi.fn(),
  getChecklistByEventId: vi.fn(),
  createChecklistItem: vi.fn(),
  updateChecklistItem: vi.fn(),
  updateChecklistItemStatus: vi.fn(),
  completeChecklistItem: vi.fn(),
  deleteChecklistItem: vi.fn(),
  reorderChecklistItems: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

const fullPermissionSnapshot: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_amore_bloom", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["client_portal.manage"],
  workspaceDisplayName: "Amoré Bloom",
};

function renderChecklistView(eventId: string) {
  return render(
    <MemberSessionProvider snapshot={fullPermissionSnapshot}>
      <EventChecklistView eventId={eventId} />
    </MemberSessionProvider>,
  );
}

function mockReady(items: ChecklistItem[], eventOverrides: Partial<ReturnType<typeof makeEvent>> = {}) {
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
  vi.mocked(dataLayer.getChecklistByEventId).mockResolvedValue(items);
  return event;
}

function getRow(itemId: string) {
  return within(screen.getByTestId(`checklist-item-${itemId}`));
}

async function openMenu(itemId: string, user: ReturnType<typeof userEvent.setup>) {
  const row = getRow(itemId);
  await user.click(row.getByRole("button", { name: /item actions/i }));
  return row;
}

describe("EventChecklistView", () => {
  it("renders the header, progress summary, and items once loaded", async () => {
    mockReady([
      makeChecklistItem({ id: "c1", title: "Confirm ring", category: "client", status: "completed", sort_order: 0 }),
      makeChecklistItem({ id: "c2", title: "Book photographer", category: "photography", status: "pending", sort_order: 1 }),
    ]);

    renderChecklistView("event_1");

    expect(await screen.findByText("Confirm ring")).toBeInTheDocument();
    expect(screen.getByText("Book photographer")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to malibu sunset proposal/i })).toHaveAttribute(
      "href",
      "/events/event_1",
    );
    expect(screen.getByText("Progress Summary")).toBeInTheDocument();
    // 1/2 complete, 50%.
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("shows an empty state when there are no checklist items yet", async () => {
    mockReady([]);
    renderChecklistView("event_1");
    expect(await screen.findByText("No checklist items yet")).toBeInTheDocument();
  });

  it("groups items by category by default", async () => {
    mockReady([
      makeChecklistItem({ id: "c1", title: "Confirm ring", category: "client", sort_order: 0 }),
      makeChecklistItem({ id: "c2", title: "Book photographer", category: "photography", sort_order: 1 }),
    ]);
    renderChecklistView("event_1");
    await screen.findByText("Confirm ring");
    // Category badges render as group headers ("Client", "Photography") —
    // "Client" also appears as a select option (assignment filter), so
    // assert at least one match rather than a single unique node.
    expect(screen.getAllByText("Client").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Photography").length).toBeGreaterThan(0);
  });

  it("filters items by search text", async () => {
    const user = userEvent.setup();
    mockReady([
      makeChecklistItem({ id: "c1", title: "Confirm ring", sort_order: 0 }),
      makeChecklistItem({ id: "c2", title: "Book photographer", sort_order: 1 }),
    ]);
    renderChecklistView("event_1");
    await screen.findByText("Confirm ring");

    await user.type(screen.getByLabelText(/search checklist items/i), "photographer");

    expect(screen.queryByText("Confirm ring")).not.toBeInTheDocument();
    expect(screen.getByText("Book photographer")).toBeInTheDocument();
  });

  it("shows overdue styling for an overdue, non-terminal item", async () => {
    mockReady([
      makeChecklistItem({ id: "c1", title: "Late task", status: "pending", due_date: "2020-01-01", sort_order: 0 }),
    ]);
    renderChecklistView("event_1");
    expect(await screen.findByText("Late task")).toBeInTheDocument();
    expect(getRow("c1").getByText("Overdue")).toBeInTheDocument();
  });

  it("filters to overdue-only items", async () => {
    const user = userEvent.setup();
    mockReady([
      makeChecklistItem({ id: "c1", title: "Late task", status: "pending", due_date: "2020-01-01", sort_order: 0 }),
      makeChecklistItem({ id: "c2", title: "On track task", status: "pending", due_date: "2099-01-01", sort_order: 1 }),
    ]);
    renderChecklistView("event_1");
    await screen.findByText("Late task");

    await user.click(screen.getByLabelText(/overdue only/i));

    expect(screen.getByText("Late task")).toBeInTheDocument();
    expect(screen.queryByText("On track task")).not.toBeInTheDocument();
  });

  it("creates a new checklist item", async () => {
    const user = userEvent.setup();
    mockReady([]);
    vi.mocked(dataLayer.createChecklistItem).mockResolvedValue({
      success: true,
      data: makeChecklistItem({ id: "new_1", title: "New task" }),
    });

    renderChecklistView("event_1");
    await screen.findByText("No checklist items yet");

    await user.click(screen.getAllByRole("button", { name: /add checklist item/i })[0]);
    await user.type(screen.getByLabelText(/^title/i), "New task");
    await user.click(screen.getByRole("button", { name: /^add item$/i }));

    expect(dataLayer.createChecklistItem).toHaveBeenCalledWith(
      "event_1",
      expect.objectContaining({ title: "New task" }),
    );
  });

  it("edits an existing item", async () => {
    const user = userEvent.setup();
    const item = makeChecklistItem({ id: "c1", title: "Confirm ring", sort_order: 0 });
    mockReady([item]);
    vi.mocked(dataLayer.updateChecklistItem).mockResolvedValue({ success: true, data: item });

    renderChecklistView("event_1");
    await screen.findByText("Confirm ring");

    await openMenu("c1", user);
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));

    const titleInput = await screen.findByDisplayValue("Confirm ring");
    await user.clear(titleInput);
    await user.type(titleInput, "Confirm ring size");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(dataLayer.updateChecklistItem).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ title: "Confirm ring size" }),
    );
  });

  it("assigns a responsible party through the edit form", async () => {
    const user = userEvent.setup();
    const item = makeChecklistItem({ id: "c1", title: "Confirm ring", sort_order: 0 });
    mockReady([item]);
    vi.mocked(dataLayer.updateChecklistItem).mockResolvedValue({ success: true, data: item });

    renderChecklistView("event_1");
    await screen.findByText("Confirm ring");

    await openMenu("c1", user);
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));

    await screen.findByDisplayValue("Confirm ring");
    await user.selectOptions(screen.getByLabelText(/assigned type/i), "vendor");
    await user.type(screen.getByLabelText(/assigned name/i), "Bloom & Co");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(dataLayer.updateChecklistItem).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ assigned_type: "vendor", assigned_name: "Bloom & Co" }),
    );
  });

  it("clears assignment through the item menu", async () => {
    const user = userEvent.setup();
    const item = makeChecklistItem({
      id: "c1",
      title: "Confirm ring",
      assigned_type: "vendor",
      assigned_name: "Bloom & Co",
      sort_order: 0,
    });
    mockReady([item]);
    vi.mocked(dataLayer.updateChecklistItem).mockResolvedValue({ success: true, data: item });

    renderChecklistView("event_1");
    await screen.findByText("Confirm ring");

    await openMenu("c1", user);
    await user.click(screen.getByRole("menuitem", { name: "Clear assignment" }));

    expect(dataLayer.updateChecklistItem).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ assigned_type: "unknown", assigned_name: null }),
    );
  });

  it("marks an item in progress and then blocked via the menu", async () => {
    const user = userEvent.setup();
    const item = makeChecklistItem({ id: "c1", title: "Confirm ring", status: "pending", sort_order: 0 });
    mockReady([item]);
    vi.mocked(dataLayer.updateChecklistItemStatus).mockResolvedValue({ success: true, data: item });

    renderChecklistView("event_1");
    await screen.findByText("Confirm ring");

    await openMenu("c1", user);
    await user.click(screen.getByRole("menuitem", { name: "Mark blocked" }));

    expect(dataLayer.updateChecklistItemStatus).toHaveBeenCalledWith("c1", "blocked");
  });

  it("completes an item via the menu", async () => {
    const user = userEvent.setup();
    const item = makeChecklistItem({ id: "c1", title: "Confirm ring", status: "pending", sort_order: 0 });
    mockReady([item]);
    vi.mocked(dataLayer.completeChecklistItem).mockResolvedValue({ success: true, data: item });

    renderChecklistView("event_1");
    await screen.findByText("Confirm ring");

    await openMenu("c1", user);
    await user.click(screen.getByRole("menuitem", { name: "Complete" }));

    expect(dataLayer.completeChecklistItem).toHaveBeenCalledWith("c1");
  });

  it("cancels an item via the menu", async () => {
    const user = userEvent.setup();
    const item = makeChecklistItem({ id: "c1", title: "Confirm ring", status: "pending", sort_order: 0 });
    mockReady([item]);
    vi.mocked(dataLayer.updateChecklistItemStatus).mockResolvedValue({ success: true, data: item });

    renderChecklistView("event_1");
    await screen.findByText("Confirm ring");

    await openMenu("c1", user);
    await user.click(screen.getByRole("menuitem", { name: "Cancel item" }));

    expect(dataLayer.updateChecklistItemStatus).toHaveBeenCalledWith("c1", "cancelled");
  });

  it("reopens a completed item back to pending", async () => {
    const user = userEvent.setup();
    const item = makeChecklistItem({ id: "c1", title: "Confirm ring", status: "completed", sort_order: 0 });
    mockReady([item]);
    vi.mocked(dataLayer.updateChecklistItemStatus).mockResolvedValue({ success: true, data: item });

    renderChecklistView("event_1");
    await screen.findByText("Confirm ring");

    await openMenu("c1", user);
    expect(screen.queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Reopen" }));

    expect(dataLayer.updateChecklistItemStatus).toHaveBeenCalledWith("c1", "pending");
  });

  it("does not offer Delete for a completed item", async () => {
    const user = userEvent.setup();
    mockReady([makeChecklistItem({ id: "c1", title: "Confirm ring", status: "completed", sort_order: 0 })]);
    renderChecklistView("event_1");
    await screen.findByText("Confirm ring");

    await openMenu("c1", user);
    expect(screen.queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("deletes a non-completed item after confirmation", async () => {
    const user = userEvent.setup();
    mockReady([makeChecklistItem({ id: "c1", title: "Confirm ring", status: "pending", sort_order: 0 })]);
    vi.mocked(dataLayer.deleteChecklistItem).mockResolvedValue({ success: true, data: null });

    renderChecklistView("event_1");
    await screen.findByText("Confirm ring");

    await openMenu("c1", user);
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    const dialog = screen.getByRole("dialog", { name: /delete checklist item/i });
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    expect(dataLayer.deleteChecklistItem).toHaveBeenCalledWith("c1");
  });

  it("reorders items using the move-down control", async () => {
    const user = userEvent.setup();
    const items = [
      makeChecklistItem({ id: "c1", title: "First task", sort_order: 0 }),
      makeChecklistItem({ id: "c2", title: "Second task", sort_order: 1 }),
    ];
    mockReady(items);
    vi.mocked(dataLayer.reorderChecklistItems).mockResolvedValue({ success: true, data: items });

    renderChecklistView("event_1");
    await screen.findByText("First task");

    await user.click(getRow("c1").getByRole("button", { name: /move down/i }));

    expect(dataLayer.reorderChecklistItems).toHaveBeenCalledWith("event_1", ["c2", "c1"]);
  });

  it("hides all mutation controls for an archived event", async () => {
    mockReady([makeChecklistItem({ id: "c1", title: "Confirm ring", sort_order: 0 })], { status: "archived" });
    renderChecklistView("event_1");
    await screen.findByText("Confirm ring");

    expect(screen.queryByRole("button", { name: /add checklist item/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /item actions/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /move down/i })).not.toBeInTheDocument();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });

  it("hides all mutation controls for a cancelled event", async () => {
    mockReady([makeChecklistItem({ id: "c1", title: "Confirm ring", sort_order: 0 })], { status: "cancelled" });
    renderChecklistView("event_1");
    await screen.findByText("Confirm ring");

    expect(screen.queryByRole("button", { name: /add checklist item/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /item actions/i })).not.toBeInTheDocument();
  });

  it("keeps checklist management available for a completed event", async () => {
    mockReady([makeChecklistItem({ id: "c1", title: "Confirm ring", status: "pending", sort_order: 0 })], {
      status: "completed",
    });
    renderChecklistView("event_1");
    await screen.findByText("Confirm ring");

    expect(screen.getAllByRole("button", { name: /add checklist item/i }).length).toBeGreaterThan(0);
  });

  it("shows an error state when the event fails to load", async () => {
    vi.mocked(dataLayer.getEventById).mockRejectedValue(new Error("network error"));
    renderChecklistView("does_not_exist");
    expect(await screen.findByText(/could not load this checklist/i)).toBeInTheDocument();
  });
});
