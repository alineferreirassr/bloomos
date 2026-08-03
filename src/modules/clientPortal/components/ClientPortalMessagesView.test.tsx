import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("@/lib/data", () => ({
  getClientPortalMessages: vi.fn(),
  sendClientPortalMessageAsClient: vi.fn(),
  markClientPortalThreadReadForCurrentSession: vi.fn(),
  logClientPortalActivityForCurrentSession: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { ClientPortalMessagesView } from "@/modules/clientPortal/components/ClientPortalMessagesView";
import {
  getClientPortalMessages,
  sendClientPortalMessageAsClient,
  markClientPortalThreadReadForCurrentSession,
  logClientPortalActivityForCurrentSession,
} from "@/lib/data";

const MESSAGE = {
  id: "message_1",
  thread_id: "thread_1",
  author_type: "workspace" as const,
  author_name: "Naomi (Planner)",
  body: "Excited for your big day!",
  created_at: "2026-01-01T00:00:00.000Z",
};

describe("ClientPortalMessagesView", () => {
  it("renders the conversation and marks the thread read on mount", async () => {
    vi.mocked(getClientPortalMessages).mockResolvedValue([MESSAGE] as never);
    render(<ClientPortalMessagesView />);
    await waitFor(() => expect(screen.getByText("Excited for your big day!")).toBeInTheDocument());
    expect(markClientPortalThreadReadForCurrentSession).toHaveBeenCalledTimes(1);
  });

  it("shows an empty state when there is no conversation yet", async () => {
    vi.mocked(getClientPortalMessages).mockResolvedValue([] as never);
    render(<ClientPortalMessagesView />);
    await waitFor(() => expect(screen.getByText("No messages yet")).toBeInTheDocument());
  });

  it("shows an error state with retry on failure", async () => {
    vi.mocked(getClientPortalMessages).mockRejectedValue(new Error("boom"));
    render(<ClientPortalMessagesView />);
    await waitFor(() => expect(screen.getByText("Could not load your messages.")).toBeInTheDocument());
  });

  it("Attach is an inert, explicitly-disabled placeholder — no realtime, no attachments this phase", async () => {
    vi.mocked(getClientPortalMessages).mockResolvedValue([MESSAGE] as never);
    render(<ClientPortalMessagesView />);
    await waitFor(() => expect(screen.getByRole("button", { name: /attach/i })).toBeDisabled());
  });

  it("Step 14: sending a message logs a message_sent activity entry", async () => {
    vi.mocked(getClientPortalMessages).mockResolvedValue([]);
    vi.mocked(sendClientPortalMessageAsClient).mockResolvedValue({ success: true, data: MESSAGE } as never);

    render(<ClientPortalMessagesView />);
    await waitFor(() => expect(screen.getByLabelText("Write a message")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Write a message"), { target: { value: "Thank you!" } });
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));

    await waitFor(() => expect(sendClientPortalMessageAsClient).toHaveBeenCalledWith("Thank you!"));
    expect(logClientPortalActivityForCurrentSession).toHaveBeenCalledWith("message_sent");
  });
});
