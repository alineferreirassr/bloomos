import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EventForm } from "@/modules/events/components/EventForm";
import { makeEvent } from "@/modules/events/testUtils";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

async function waitForClientOptions() {
  const select = await screen.findByLabelText(/^client\b/i);
  await waitFor(() => {
    expect(within(select).getAllByRole("option").length).toBeGreaterThan(1);
  });
  return select;
}

describe("EventForm", () => {
  it("shows validation errors for missing required fields and does not submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<EventForm submitLabel="Create Event" cancelHref="/events" onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: /create event/i }));

    expect(await screen.findByText(/client is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/title is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects an end time before the start time", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<EventForm submitLabel="Create Event" cancelHref="/events" onSubmit={onSubmit} />);

    const clientSelect = await waitForClientOptions();
    await user.selectOptions(clientSelect, "client_1");
    await user.type(screen.getByLabelText(/^title\b/i), "Test Event");
    await user.type(screen.getByLabelText(/start time/i), "18:00");
    await user.type(screen.getByLabelText(/end time/i), "17:00");
    await user.click(screen.getByRole("button", { name: /create event/i }));

    expect(await screen.findByText(/end time cannot be before start time/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects a maximum budget below the minimum budget", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<EventForm submitLabel="Create Event" cancelHref="/events" onSubmit={onSubmit} />);

    const clientSelect = await waitForClientOptions();
    await user.selectOptions(clientSelect, "client_1");
    await user.type(screen.getByLabelText(/^title\b/i), "Test Event");
    await user.type(screen.getByLabelText(/budget min/i), "5000");
    await user.type(screen.getByLabelText(/budget max/i), "1000");
    await user.click(screen.getByRole("button", { name: /create event/i }));

    expect(
      await screen.findByText(/maximum budget must be greater than or equal to minimum budget/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits with the entered fields once required fields are valid", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({ success: true, data: makeEvent() });
    render(<EventForm submitLabel="Create Event" cancelHref="/events" onSubmit={onSubmit} />);

    const clientSelect = await waitForClientOptions();
    await user.selectOptions(clientSelect, "client_1");
    await user.type(screen.getByLabelText(/^title\b/i), "Malibu Sunset Proposal");
    await user.click(screen.getByRole("button", { name: /create event/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: "client_1",
        title: "Malibu Sunset Proposal",
        event_type: "other",
        priority: "normal",
        surprise_event: false,
      }),
    );
  });

  it("does not construct checklist records itself — onSubmit only ever receives the raw form input", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({ success: true, data: makeEvent() });
    render(<EventForm submitLabel="Create Event" cancelHref="/events" onSubmit={onSubmit} />);

    const clientSelect = await waitForClientOptions();
    await user.selectOptions(clientSelect, "client_1");
    await user.type(screen.getByLabelText(/^title\b/i), "Test Event");
    await user.click(screen.getByRole("button", { name: /create event/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const submittedValue = onSubmit.mock.calls[0][0];
    expect(submittedValue).not.toHaveProperty("checklist");
    expect(submittedValue).not.toHaveProperty("checklist_items");
  });
});
