import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditEventView } from "@/modules/events/components/EditEventView";
import { makeEvent } from "@/modules/events/testUtils";
import { makeClient } from "@/modules/clients/testUtils";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/data", () => ({
  getEventById: vi.fn(),
  updateEvent: vi.fn(),
  getClients: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("EditEventView", () => {
  it("preloads the form with the event's existing data", async () => {
    vi.mocked(dataLayer.getEventById).mockResolvedValue(
      makeEvent({ id: "event_1", title: "Malibu Sunset Proposal", client_id: "client_1" }),
    );
    vi.mocked(dataLayer.getClients).mockResolvedValue([makeClient({ id: "client_1" })]);

    render(<EditEventView eventId="event_1" />);

    expect(await screen.findByDisplayValue("Malibu Sunset Proposal")).toBeInTheDocument();
    expect(screen.getByText(/edit malibu sunset proposal/i)).toBeInTheDocument();
  });

  it("submits changes through updateEvent, not createEvent", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getEventById).mockResolvedValue(
      makeEvent({ id: "event_1", title: "Original Title", client_id: "client_1" }),
    );
    vi.mocked(dataLayer.getClients).mockResolvedValue([makeClient({ id: "client_1" })]);
    vi.mocked(dataLayer.updateEvent).mockResolvedValue({ success: true, data: makeEvent({ id: "event_1" }) });

    render(<EditEventView eventId="event_1" />);

    const titleInput = await screen.findByDisplayValue("Original Title");
    await user.clear(titleInput);
    await user.type(titleInput, "Updated Title");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(dataLayer.updateEvent).toHaveBeenCalledWith(
        "event_1",
        expect.objectContaining({ title: "Updated Title" }),
      ),
    );
  });

  it("shows an error state when the event can't be found", async () => {
    vi.mocked(dataLayer.getEventById).mockRejectedValue(new Error("not found"));
    vi.mocked(dataLayer.getClients).mockResolvedValue([]);

    render(<EditEventView eventId="does_not_exist" />);

    expect(await screen.findByText(/could not load this event/i)).toBeInTheDocument();
  });
});
