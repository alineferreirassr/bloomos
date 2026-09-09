import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LiveEventModePanel } from "@/modules/operations/components/LiveEventModePanel";

vi.mock("@/lib/data", () => ({
  getChecklistByEventId: vi.fn(),
  completeChecklistItem: vi.fn(),
  createEventNote: vi.fn(),
  createExpense: vi.fn(),
  uploadMediaAsset: vi.fn(),
}));

vi.mock("@/core/operations/operationsStore", () => ({
  logLiveEventEntry: vi.fn(),
  getLiveEventLog: vi.fn(),
}));

import * as dataLayer from "@/lib/data";
import * as operationsStore from "@/core/operations/operationsStore";

const EVENT = {
  id: "event_1",
  workspace_id: "ws_1",
  client_id: "client_1",
  title: "Sunset Wedding",
} as never;

function mockCommon() {
  vi.mocked(dataLayer.getChecklistByEventId).mockResolvedValue([]);
  vi.mocked(operationsStore.getLiveEventLog).mockResolvedValue([]);
}

function makeExpense(overrides: Partial<{ id: string }> = {}) {
  return { id: "expense_new", description: "test", amount_minor: 1000, status: "planned", ...overrides } as never;
}

async function fillAndSubmitExpense(user: ReturnType<typeof userEvent.setup>, description: string, amount: string) {
  const descriptionInput = screen.getByLabelText(/expense description/i);
  await user.clear(descriptionInput);
  await user.type(descriptionInput, description);
  const amountInput = screen.getByLabelText(/expense amount/i);
  await user.clear(amountInput);
  await user.type(amountInput, amount);
  await user.click(screen.getByRole("button", { name: /register expense/i }));
}

describe("LiveEventModePanel — Register Expense request identity (Finance F2.1C-F-E-D-B2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Note: LiveEventModePanel's own runAction has no try/catch around
  // action() (unlike PaymentForm/InvoiceForm/ExpenseForm's shared E-B
  // resilience) — a genuinely THROWN rejection leaves `busy` stuck forever
  // with no UI-driven retry path, a pre-existing characteristic this
  // checkpoint's approved scope (identity lifecycle only) does not touch.
  // The realistic, UI-recoverable "failed attempt, retry" path here is a
  // RESOLVED {success:false} result, which is what these tests exercise.
  it("A: a resolved-failure submit followed by an unchanged retry reuses the SAME expenseId", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(dataLayer.createExpense)
      .mockResolvedValueOnce({ success: false, error: "Something went wrong." })
      .mockResolvedValueOnce({ success: true, data: makeExpense() });

    render(<LiveEventModePanel event={EVENT} loggedByName="Jordan" onClose={vi.fn()} onChanged={vi.fn()} />);
    await fillAndSubmitExpense(user, "Parking", "20");
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/something went wrong/i));

    // The failed attempt's fields are NOT cleared (only a successful create clears them) — resubmit unchanged.
    await user.click(screen.getByRole("button", { name: /register expense/i }));
    await waitFor(() => expect(dataLayer.createExpense).toHaveBeenCalledTimes(2));

    const firstId = vi.mocked(dataLayer.createExpense).mock.calls[0][1];
    const secondId = vi.mocked(dataLayer.createExpense).mock.calls[1][1];
    expect(secondId).toBe(firstId);
  });

  it("B: a resolved-failure first attempt followed by a materially changed payload rotates to a DIFFERENT expenseId", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(dataLayer.createExpense)
      .mockResolvedValueOnce({ success: false, error: "Something went wrong." })
      .mockResolvedValueOnce({ success: true, data: makeExpense() });

    render(<LiveEventModePanel event={EVENT} loggedByName="Jordan" onClose={vi.fn()} onChanged={vi.fn()} />);
    await fillAndSubmitExpense(user, "Parking", "20");
    await waitFor(() => expect(dataLayer.createExpense).toHaveBeenCalledTimes(1));

    await fillAndSubmitExpense(user, "Parking", "35");
    await waitFor(() => expect(dataLayer.createExpense).toHaveBeenCalledTimes(2));

    const firstId = vi.mocked(dataLayer.createExpense).mock.calls[0][1];
    const secondCall = vi.mocked(dataLayer.createExpense).mock.calls[1];
    expect(secondCall[1]).not.toBe(firstId);
    expect(secondCall[0]).toEqual(expect.objectContaining({ amount_minor: 3500 }));
  });

  it("C: a successful Expense #1 followed by a distinct Expense #2 get DIFFERENT expenseIds", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(dataLayer.createExpense)
      .mockResolvedValueOnce({ success: true, data: makeExpense({ id: "expense_1" }) })
      .mockResolvedValueOnce({ success: true, data: makeExpense({ id: "expense_2" }) });

    render(<LiveEventModePanel event={EVENT} loggedByName="Jordan" onClose={vi.fn()} onChanged={vi.fn()} />);
    await fillAndSubmitExpense(user, "Parking", "20");
    await waitFor(() => expect(dataLayer.createExpense).toHaveBeenCalledTimes(1));

    await fillAndSubmitExpense(user, "Extra flowers", "50");
    await waitFor(() => expect(dataLayer.createExpense).toHaveBeenCalledTimes(2));

    const firstId = vi.mocked(dataLayer.createExpense).mock.calls[0][1];
    const secondId = vi.mocked(dataLayer.createExpense).mock.calls[1][1];
    expect(secondId).not.toBe(firstId);
  });

  it("D (mandatory): a successful Expense #1 followed later by an Expense #2 with a COINCIDENTALLY IDENTICAL payload still gets a DIFFERENT expenseId — never silently replayed", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(dataLayer.createExpense)
      .mockResolvedValueOnce({ success: true, data: makeExpense({ id: "expense_1" }) })
      .mockResolvedValueOnce({ success: true, data: makeExpense({ id: "expense_2" }) });

    render(<LiveEventModePanel event={EVENT} loggedByName="Jordan" onClose={vi.fn()} onChanged={vi.fn()} />);
    await fillAndSubmitExpense(user, "Parking", "20");
    await waitFor(() => expect(dataLayer.createExpense).toHaveBeenCalledTimes(1));

    // A second, genuinely separate parking receipt for the identical amount —
    // this must NOT be collapsed into a replay of the first.
    await fillAndSubmitExpense(user, "Parking", "20");
    await waitFor(() => expect(dataLayer.createExpense).toHaveBeenCalledTimes(2));

    const firstCall = vi.mocked(dataLayer.createExpense).mock.calls[0];
    const secondCall = vi.mocked(dataLayer.createExpense).mock.calls[1];
    expect(secondCall[0]).toEqual(firstCall[0]); // identical payload
    expect(secondCall[1]).not.toBe(firstCall[1]); // but a distinct id
  });

  it("clears the description/amount fields after a successful Register Expense, exactly as before", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(dataLayer.createExpense).mockResolvedValue({ success: true, data: makeExpense() });

    render(<LiveEventModePanel event={EVENT} loggedByName="Jordan" onClose={vi.fn()} onChanged={vi.fn()} />);
    await fillAndSubmitExpense(user, "Parking", "20");
    await waitFor(() => expect(dataLayer.createExpense).toHaveBeenCalledTimes(1));

    expect(screen.getByLabelText(/expense description/i)).toHaveValue("");
    expect(screen.getByLabelText(/expense amount/i)).toHaveValue("");
  });
});

describe("LiveEventModePanel — general rendering and action wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const OPEN_TASK = { id: "task_1", event_id: "event_1", title: "Set up centerpieces", status: "pending" } as never;
  const LOG_ENTRY = { id: "log_1", kind: "check_in", note: "Jordan checked in", occurred_at: "2026-01-01T12:00:00.000Z" } as never;

  it("renders the open checklist item and the Event-Day Activity log entry", async () => {
    vi.mocked(dataLayer.getChecklistByEventId).mockResolvedValue([OPEN_TASK]);
    vi.mocked(operationsStore.getLiveEventLog).mockResolvedValue([LOG_ENTRY]);

    render(<LiveEventModePanel event={EVENT} loggedByName="Jordan" onClose={vi.fn()} onChanged={vi.fn()} />);

    expect(await screen.findByText("Set up centerpieces")).toBeInTheDocument();
    expect(await screen.findByText("Checked in")).toBeInTheDocument();
    expect(screen.getByText("Jordan checked in")).toBeInTheDocument();
  });

  it("shows the empty-state copy for no open tasks and no logged activity", async () => {
    mockCommon();

    render(<LiveEventModePanel event={EVENT} loggedByName="Jordan" onClose={vi.fn()} onChanged={vi.fn()} />);

    expect(await screen.findByText("No open checklist tasks.")).toBeInTheDocument();
    expect(screen.getByText("Nothing logged yet.")).toBeInTheDocument();
  });

  it("checks in: logs the correct entry and calls onChanged after the shared success/refresh path", async () => {
    const user = userEvent.setup();
    mockCommon();
    const onChanged = vi.fn();
    vi.mocked(operationsStore.logLiveEventEntry).mockResolvedValue({ success: true, data: {} as never });

    render(<LiveEventModePanel event={EVENT} loggedByName="Jordan" onClose={vi.fn()} onChanged={onChanged} />);
    await user.click(screen.getByRole("button", { name: "Check In" }));

    await waitFor(() => {
      expect(operationsStore.logLiveEventEntry).toHaveBeenCalledWith("ws_1", "event_1", "check_in", "Jordan checked in", "Jordan");
    });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("checks out: logs the correct entry", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(operationsStore.logLiveEventEntry).mockResolvedValue({ success: true, data: {} as never });

    render(<LiveEventModePanel event={EVENT} loggedByName="Jordan" onClose={vi.fn()} onChanged={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Check Out" }));

    await waitFor(() => {
      expect(operationsStore.logLiveEventEntry).toHaveBeenCalledWith("ws_1", "event_1", "check_out", "Jordan checked out", "Jordan");
    });
  });

  it("requests help with no text entered: logs the entry with a null note", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(operationsStore.logLiveEventEntry).mockResolvedValue({ success: true, data: {} as never });

    render(<LiveEventModePanel event={EVENT} loggedByName="Jordan" onClose={vi.fn()} onChanged={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Request Help" }));

    await waitFor(() => {
      expect(operationsStore.logLiveEventEntry).toHaveBeenCalledWith("ws_1", "event_1", "help_requested", null, "Jordan");
    });
  });

  it("completes an open checklist task", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getChecklistByEventId).mockResolvedValue([OPEN_TASK]);
    vi.mocked(operationsStore.getLiveEventLog).mockResolvedValue([]);
    vi.mocked(dataLayer.completeChecklistItem).mockResolvedValue({ success: true, data: { id: "task_1", event_id: "event_1", title: "Set up centerpieces", status: "completed" } as never });

    render(<LiveEventModePanel event={EVENT} loggedByName="Jordan" onClose={vi.fn()} onChanged={vi.fn()} />);
    await screen.findByText("Set up centerpieces");
    await user.click(screen.getByRole("button", { name: "Complete" }));

    await waitFor(() => {
      expect(dataLayer.completeChecklistItem).toHaveBeenCalledWith("task_1");
    });
  });

  it("adds a note, disabled while blank, clearing the field on success", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(dataLayer.createEventNote).mockResolvedValue({ success: true, data: {} as never });

    render(<LiveEventModePanel event={EVENT} loggedByName="Jordan" onClose={vi.fn()} onChanged={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Add Note" })).toBeDisabled();

    await user.type(screen.getByLabelText("Note"), "Bride has arrived on-site");
    await user.click(screen.getByRole("button", { name: "Add Note" }));

    await waitFor(() => {
      expect(dataLayer.createEventNote).toHaveBeenCalledWith("event_1", {
        title: "Live Event Note",
        content: "Bride has arrived on-site",
        category: "reminder",
        priority: "normal",
      });
    });
    await waitFor(() => expect(screen.getByLabelText("Note")).toHaveValue(""));
  });

  it("reports an issue, disabled while blank, clearing the field on success", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(operationsStore.logLiveEventEntry).mockResolvedValue({ success: true, data: {} as never });

    render(<LiveEventModePanel event={EVENT} loggedByName="Jordan" onClose={vi.fn()} onChanged={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Report Issue" })).toBeDisabled();

    await user.type(screen.getByLabelText("Issue description"), "Generator is running low on fuel");
    await user.click(screen.getByRole("button", { name: "Report Issue" }));

    await waitFor(() => {
      expect(operationsStore.logLiveEventEntry).toHaveBeenCalledWith("ws_1", "event_1", "issue_reported", "Generator is running low on fuel", "Jordan");
    });
    await waitFor(() => expect(screen.getByLabelText("Issue description")).toHaveValue(""));
  });

  it("uploads a valid photo through the real validation helpers", async () => {
    mockCommon();
    vi.mocked(dataLayer.uploadMediaAsset).mockResolvedValue({ success: true, data: {} as never });
    const { container } = render(<LiveEventModePanel event={EVENT} loggedByName="Jordan" onClose={vi.fn()} onChanged={vi.fn()} />);

    const file = new File(["binary-image-data"], "site-photo.jpg", { type: "image/jpeg" });
    const input = container.querySelector<HTMLInputElement>("#live_event_media_upload");
    await userEvent.upload(input!, file);

    await waitFor(() => {
      expect(dataLayer.uploadMediaAsset).toHaveBeenCalledWith(
        expect.objectContaining({ ownerType: "event", ownerId: "event_1", file, originalFilename: "site-photo.jpg" }),
      );
    });
  });

  it("rejects an upload with a disallowed file type before calling uploadMediaAsset", async () => {
    mockCommon();
    const { container } = render(<LiveEventModePanel event={EVENT} loggedByName="Jordan" onClose={vi.fn()} onChanged={vi.fn()} />);

    // The input's accept="image/*,video/*" makes userEvent.upload filter out
    // a file whose declared MIME type doesn't match that pattern — so this
    // uses a matching top-level type with a blocked/disallowed extension,
    // which is exactly what production's own extension-based check rejects.
    const file = new File(["binary"], "malware.exe", { type: "image/jpeg" });
    const input = container.querySelector<HTMLInputElement>("#live_event_media_upload");
    await userEvent.upload(input!, file);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/\.exe" extension are not supported/i);
    });
    expect(dataLayer.uploadMediaAsset).not.toHaveBeenCalled();
  });
});
