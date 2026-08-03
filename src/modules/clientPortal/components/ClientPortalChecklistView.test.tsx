import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("@/lib/data", () => ({
  getClientPortalChecklist: vi.fn(),
  completeClientPortalChecklistItem: vi.fn(),
  commentOnClientPortalChecklistItem: vi.fn(),
  logClientPortalActivityForCurrentSession: vi.fn(),
}));
vi.mock("@/modules/clientPortal/dispatchClientPortalTriggerActions", () => ({
  dispatchChecklistItemCompletedTrigger: vi.fn(),
}));
vi.mock("@/components/providers/ClientAccountSessionProvider", () => ({
  useClientAccountSession: () => ({ workspaceId: "ws_1", clientId: "client_1", accountId: "account_1" }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { ClientPortalChecklistView } from "@/modules/clientPortal/components/ClientPortalChecklistView";
import { getClientPortalChecklist, completeClientPortalChecklistItem, logClientPortalActivityForCurrentSession } from "@/lib/data";
import { dispatchChecklistItemCompletedTrigger } from "@/modules/clientPortal/dispatchClientPortalTriggerActions";

const ITEM = {
  id: "item_1",
  event_id: "event_1",
  title: "Send final guest count",
  description: "We need this two weeks before your event.",
  status: "pending" as const,
  due_date: null,
  completed_at: null,
  client_comment: null,
};

describe("ClientPortalChecklistView", () => {
  it("renders only client-visible checklist items, never a title/description edit control", async () => {
    vi.mocked(getClientPortalChecklist).mockResolvedValue([ITEM] as never);
    render(<ClientPortalChecklistView />);
    await waitFor(() => expect(screen.getByText("Send final guest count")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /^edit$/i })).not.toBeInTheDocument();
  });

  it("shows an empty state when nothing has been shared yet", async () => {
    vi.mocked(getClientPortalChecklist).mockResolvedValue([] as never);
    render(<ClientPortalChecklistView />);
    await waitFor(() => expect(screen.getByText("Nothing shared yet")).toBeInTheDocument());
  });

  it("shows an error state with retry on failure", async () => {
    vi.mocked(getClientPortalChecklist).mockRejectedValue(new Error("boom"));
    render(<ClientPortalChecklistView />);
    await waitFor(() => expect(screen.getByText("Could not load your checklist.")).toBeInTheDocument());
  });

  it("Upload Attachment is an inert, explicitly-disabled placeholder", async () => {
    vi.mocked(getClientPortalChecklist).mockResolvedValue([ITEM] as never);
    render(<ClientPortalChecklistView />);
    await waitFor(() => expect(screen.getByText("Send final guest count")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /upload attachment/i })).toBeDisabled();
  });

  it("Step 7 + Step 10 + Step 14: completing an item logs the activity and dispatches the checklist_item.completed Workflow Trigger", async () => {
    vi.mocked(getClientPortalChecklist).mockResolvedValue([ITEM] as never);
    vi.mocked(completeClientPortalChecklistItem).mockResolvedValue({ success: true, data: { ...ITEM, status: "completed" } } as never);

    render(<ClientPortalChecklistView />);
    await waitFor(() => expect(screen.getByRole("button", { name: /mark complete/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /mark complete/i }));

    await waitFor(() => expect(completeClientPortalChecklistItem).toHaveBeenCalledWith("item_1"));
    expect(logClientPortalActivityForCurrentSession).toHaveBeenCalledWith("checklist_item_completed", "item_1", "Send final guest count");
    expect(dispatchChecklistItemCompletedTrigger).toHaveBeenCalledWith("item_1", "Send final guest count");
  });
});
