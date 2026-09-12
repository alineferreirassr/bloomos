import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SocialScheduleDialog } from "@/modules/socialPosts/components/SocialScheduleDialog";

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

function setDateTime(dateValue: string, timeValue: string) {
  fireEvent.change(screen.getByLabelText("Date"), { target: { value: dateValue } });
  fireEvent.change(screen.getByLabelText("Time"), { target: { value: timeValue } });
}

describe("SocialScheduleDialog", () => {
  it("does not render when closed", () => {
    render(<SocialScheduleDialog open={false} onClose={vi.fn()} title="Schedule post" submitLabel="Schedule" onSubmit={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("has an accessible name and accessible labels for both inputs", () => {
    render(<SocialScheduleDialog open onClose={vi.fn()} title="Schedule post" submitLabel="Schedule" onSubmit={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Schedule post" })).toBeInTheDocument();
    expect(screen.getByLabelText("Date")).toBeInTheDocument();
    expect(screen.getByLabelText("Time")).toBeInTheDocument();
  });

  it("rejects submission with no date/time chosen", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SocialScheduleDialog open onClose={vi.fn()} title="Schedule post" submitLabel="Schedule" onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Schedule" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/choose a date and time/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects a past date/time before ever calling onSubmit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SocialScheduleDialog open onClose={vi.fn()} title="Schedule post" submitLabel="Schedule" onSubmit={onSubmit} />);

    setDateTime("2020-01-01", "09:00");
    await user.click(screen.getByRole("button", { name: "Schedule" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/choose a time in the future/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("resolves the browser's own IANA timezone and sends a real UTC instant — never a bare local string with 'Z' appended", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({ success: true });
    render(<SocialScheduleDialog open onClose={vi.fn()} title="Schedule post" submitLabel="Schedule" onSubmit={onSubmit} />);

    const resolvedZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setDateTime("2099-06-01", "15:00");
    await user.click(screen.getByRole("button", { name: "Schedule" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const call = onSubmit.mock.calls[0][0];
    expect(call.scheduledTimezone).toBe(resolvedZone);
    // A genuine UTC conversion of "2099-06-01T15:00" local time is never
    // literally "2099-06-01T15:00:00.000Z" unless the runtime's own zone
    // happens to be UTC — assert it round-trips through Date correctly
    // instead of asserting a naive string.
    const expectedUtc = new Date(2099, 5, 1, 15, 0, 0, 0).toISOString();
    expect(call.scheduledAt).toBe(expectedUtc);
    expect(call.scheduledAt.endsWith("Z")).toBe(true);
  });

  it("closes on successful submission", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue({ success: true });
    render(<SocialScheduleDialog open onClose={onClose} title="Schedule post" submitLabel="Schedule" onSubmit={onSubmit} />);

    setDateTime("2099-06-01", "15:00");
    await user.click(screen.getByRole("button", { name: "Schedule" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("shows the controlled failure message and releases the busy state, keeping the dialog open with inputs intact", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue({ success: false, error: "That isn't available. You may not have access to it." });
    render(<SocialScheduleDialog open onClose={onClose} title="Schedule post" submitLabel="Schedule" onSubmit={onSubmit} />);

    setDateTime("2099-06-01", "15:00");
    await user.click(screen.getByRole("button", { name: "Schedule" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("That isn't available. You may not have access to it.");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Schedule" })).not.toBeDisabled();
    expect((screen.getByLabelText("Date") as HTMLInputElement).value).toBe("2099-06-01");
  });

  it("releases the busy state on an unexpected rejection instead of hanging forever", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSubmit = vi.fn().mockRejectedValue(new Error("network exploded"));
    render(<SocialScheduleDialog open onClose={onClose} title="Schedule post" submitLabel="Schedule" onSubmit={onSubmit} />);

    setDateTime("2099-06-01", "15:00");
    await user.click(screen.getByRole("button", { name: "Schedule" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/something went wrong/i);
    expect(screen.getByRole("button", { name: "Schedule" })).not.toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("disables both the Cancel and submit buttons while busy, exposing aria-busy — no double submission", async () => {
    const user = userEvent.setup();
    let resolveSubmit: (value: { success: boolean }) => void = () => {};
    const onSubmit = vi.fn(() => new Promise<{ success: boolean }>((resolve) => (resolveSubmit = resolve)));
    render(<SocialScheduleDialog open onClose={vi.fn()} title="Schedule post" submitLabel="Schedule" onSubmit={onSubmit} />);

    setDateTime("2099-06-01", "15:00");
    await user.click(screen.getByRole("button", { name: "Schedule" }));

    const submitButton = screen.getByRole("button", { name: "Saving…" });
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(onSubmit).toHaveBeenCalledTimes(1);

    resolveSubmit({ success: true });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Saving…" })).not.toBeInTheDocument());
  });

  it("pre-populates Reschedule's inputs from the post's existing schedule, rendered in its own stored timezone", () => {
    // 2099-06-01T19:00:00Z is 15:00 in America/New_York (EDT, UTC-4) in June.
    render(
      <SocialScheduleDialog
        open
        onClose={vi.fn()}
        title="Reschedule post"
        submitLabel="Reschedule"
        initialScheduledAt="2099-06-01T19:00:00.000Z"
        initialScheduledTimezone="America/New_York"
        onSubmit={vi.fn()}
      />,
    );

    expect((screen.getByLabelText("Date") as HTMLInputElement).value).toBe("2099-06-01");
    expect((screen.getByLabelText("Time") as HTMLInputElement).value).toBe("15:00");
  });

  it("re-derives fresh initial values every time it reopens rather than keeping stale state", () => {
    const { rerender } = render(
      <SocialScheduleDialog open={false} onClose={vi.fn()} title="Reschedule post" submitLabel="Reschedule" initialScheduledAt="2099-06-01T19:00:00.000Z" initialScheduledTimezone="America/New_York" onSubmit={vi.fn()} />,
    );
    rerender(
      <SocialScheduleDialog open onClose={vi.fn()} title="Reschedule post" submitLabel="Reschedule" initialScheduledAt="2099-06-01T19:00:00.000Z" initialScheduledTimezone="America/New_York" onSubmit={vi.fn()} />,
    );
    expect((screen.getByLabelText("Date") as HTMLInputElement).value).toBe("2099-06-01");
    expect((screen.getByLabelText("Time") as HTMLInputElement).value).toBe("15:00");
  });

  it("never displays a raw ISO string anywhere in the dialog", () => {
    render(
      <SocialScheduleDialog open onClose={vi.fn()} title="Reschedule post" submitLabel="Reschedule" initialScheduledAt="2099-06-01T19:00:00.000Z" initialScheduledTimezone="America/New_York" onSubmit={vi.fn()} />,
    );
    expect(screen.queryByText(/2099-06-01T19:00:00/)).not.toBeInTheDocument();
  });
});
