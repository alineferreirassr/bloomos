import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReverseJournalEntryDialog } from "@/modules/finance/components/ReverseJournalEntryDialog";
import { makeJournalEntry } from "@/modules/finance/testUtils";

vi.mock("@/lib/data", () => ({
  reverseJournalEntry: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("ReverseJournalEntryDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the confirmation dialog", () => {
    render(
      <ReverseJournalEntryDialog open onClose={vi.fn()} journalEntryId="entry_1" onReversed={vi.fn()} />,
    );

    expect(screen.getByRole("dialog", { name: /reverse journal entry/i })).toBeInTheDocument();
  });

  it("rejects submission with a blank reversal reason", async () => {
    const user = userEvent.setup();
    render(
      <ReverseJournalEntryDialog open onClose={vi.fn()} journalEntryId="entry_1" onReversed={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: /reverse entry/i }));

    expect(await screen.findByText(/a reversal reason is required/i)).toBeInTheDocument();
    expect(dataLayer.reverseJournalEntry).not.toHaveBeenCalled();
  });

  it("on success calls onReversed with the new reversal entry and closes the dialog", async () => {
    const user = userEvent.setup();
    const reversal = makeJournalEntry({ id: "entry_reversal", reverses_entry_id: "entry_1" });
    vi.mocked(dataLayer.reverseJournalEntry).mockResolvedValue({ success: true, data: reversal });
    const onReversed = vi.fn();
    const onClose = vi.fn();
    render(
      <ReverseJournalEntryDialog open onClose={onClose} journalEntryId="entry_1" onReversed={onReversed} />,
    );

    await user.type(screen.getByLabelText(/reversal reason/i), "Corrected a misposting");
    await user.click(screen.getByRole("button", { name: /reverse entry/i }));

    expect(dataLayer.reverseJournalEntry).toHaveBeenCalledWith("entry_1", { reason: "Corrected a misposting" });
    expect(onReversed).toHaveBeenCalledWith(reversal);
    expect(onClose).toHaveBeenCalled();
  });

  it("displays a resolved DataResult failure and keeps the dialog open", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.reverseJournalEntry).mockResolvedValue({
      success: false,
      error: "This journal entry has already been reversed.",
    });
    const onClose = vi.fn();
    render(
      <ReverseJournalEntryDialog open onClose={onClose} journalEntryId="entry_1" onReversed={vi.fn()} />,
    );

    await user.type(screen.getByLabelText(/reversal reason/i), "Attempted reversal");
    await user.click(screen.getByRole("button", { name: /reverse entry/i }));

    expect(await screen.findByText(/already been reversed/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("recovers from an unexpected thrown error — resets submitting, shows a generic fallback, preserves the reason, does not hang, and refetches", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.reverseJournalEntry).mockRejectedValue(new Error("relation journal_entries does not exist"));
    const onClose = vi.fn();
    const onReversed = vi.fn();
    render(
      <ReverseJournalEntryDialog open onClose={onClose} journalEntryId="entry_1" onReversed={onReversed} />,
    );

    await user.type(screen.getByLabelText(/reversal reason/i), "Testing an unexpected failure");
    await user.click(screen.getByRole("button", { name: /reverse entry/i }));

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.queryByText(/relation journal_entries does not exist/i)).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onReversed).toHaveBeenCalledWith();
    expect(screen.getByLabelText(/reversal reason/i)).toHaveValue("Testing an unexpected failure");
    expect(screen.getByRole("button", { name: /reverse entry/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /^cancel$/i })).not.toBeDisabled();
  });

  it("allows retry after a thrown failure, calling reverseJournalEntry again with the same reason", async () => {
    const user = userEvent.setup();
    const reversal = makeJournalEntry({ id: "entry_reversal", reverses_entry_id: "entry_1" });
    vi.mocked(dataLayer.reverseJournalEntry)
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce({ success: true, data: reversal });
    render(
      <ReverseJournalEntryDialog open onClose={vi.fn()} journalEntryId="entry_1" onReversed={vi.fn()} />,
    );

    await user.type(screen.getByLabelText(/reversal reason/i), "Retry after throw");
    await user.click(screen.getByRole("button", { name: /reverse entry/i }));
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /reverse entry/i }));

    expect(dataLayer.reverseJournalEntry).toHaveBeenCalledTimes(2);
    expect(dataLayer.reverseJournalEntry).toHaveBeenNthCalledWith(2, "entry_1", { reason: "Retry after throw" });
  });
});
