import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManualAdjustmentForm } from "@/modules/finance/components/ManualAdjustmentForm";
import { makeChartOfAccount, makeJournalEntry } from "@/modules/finance/testUtils";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/data", () => ({
  getChartOfAccounts: vi.fn(),
  recordManualAdjustment: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

function mockAccounts() {
  vi.mocked(dataLayer.getChartOfAccounts).mockResolvedValue([
    makeChartOfAccount({ id: "cash", account_number: 1000, name: "Cash" }),
    makeChartOfAccount({ id: "revenue", account_number: 4000, name: "Service Revenue" }),
  ]);
}

async function waitForAccountOptions() {
  const selects = await screen.findAllByLabelText(/^account\b/i);
  await waitFor(() => expect(selects[0]).not.toBeDisabled());
  return selects;
}

describe("ManualAdjustmentForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with exactly two lines and disables Remove until a third is added", async () => {
    mockAccounts();
    render(<ManualAdjustmentForm />);

    const removeButtons = await screen.findAllByRole("button", { name: /remove/i });
    expect(removeButtons).toHaveLength(2);
    expect(removeButtons[0]).toBeDisabled();
    expect(removeButtons[1]).toBeDisabled();
  });

  it("adds and removes lines dynamically", async () => {
    const user = userEvent.setup();
    mockAccounts();
    render(<ManualAdjustmentForm />);
    await screen.findAllByRole("button", { name: /remove/i });

    await user.click(screen.getByRole("button", { name: /add line/i }));
    let removeButtons = await screen.findAllByRole("button", { name: /remove/i });
    expect(removeButtons).toHaveLength(3);
    expect(removeButtons[0]).not.toBeDisabled();

    await user.click(removeButtons[2]);
    removeButtons = await screen.findAllByRole("button", { name: /remove/i });
    expect(removeButtons).toHaveLength(2);
  });

  it("rejects submission with a blank memo even when the lines are balanced", async () => {
    const user = userEvent.setup();
    mockAccounts();
    render(<ManualAdjustmentForm />);
    const accountSelects = await waitForAccountOptions();

    await user.selectOptions(accountSelects[0], "cash");
    await user.selectOptions(accountSelects[1], "revenue");
    await user.type(screen.getAllByLabelText(/^debit$/i)[0], "50");
    await user.type(screen.getAllByLabelText(/^credit$/i)[1], "50");

    await user.click(screen.getByRole("button", { name: /record manual adjustment/i }));

    expect(await screen.findByText(/a memo is required/i)).toBeInTheDocument();
    expect(dataLayer.recordManualAdjustment).not.toHaveBeenCalled();
  });

  it("keeps submit disabled while debits and credits are not balanced", async () => {
    const user = userEvent.setup();
    mockAccounts();
    render(<ManualAdjustmentForm />);
    const accountSelects = await waitForAccountOptions();

    await user.selectOptions(accountSelects[0], "cash");
    await user.selectOptions(accountSelects[1], "revenue");
    const debitInputs = screen.getAllByLabelText(/^debit$/i);
    await user.type(debitInputs[0], "100");
    const creditInputs = screen.getAllByLabelText(/^credit$/i);
    await user.type(creditInputs[1], "50");

    expect(screen.getByText(/not balanced/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /record manual adjustment/i })).toBeDisabled();
  });

  it("enables submit and calls recordManualAdjustment with safe minor-unit conversion plus a generated manualAdjustmentId once balanced", async () => {
    const user = userEvent.setup();
    mockAccounts();
    vi.mocked(dataLayer.recordManualAdjustment).mockResolvedValue({
      success: true,
      data: makeJournalEntry({ id: "entry_new" }),
    });
    render(<ManualAdjustmentForm />);
    const accountSelects = await waitForAccountOptions();

    await user.selectOptions(accountSelects[0], "cash");
    await user.selectOptions(accountSelects[1], "revenue");
    await user.type(screen.getAllByLabelText(/^debit$/i)[0], "125.50");
    await user.type(screen.getAllByLabelText(/^credit$/i)[1], "125.50");
    await user.type(screen.getByLabelText(/^memo\b/i), "Correcting a misposted deposit");

    expect(screen.getByText(/^balanced$/i)).toBeInTheDocument();
    const submitButton = screen.getByRole("button", { name: /record manual adjustment/i });
    expect(submitButton).not.toBeDisabled();

    await user.click(submitButton);

    await waitFor(() =>
      expect(dataLayer.recordManualAdjustment).toHaveBeenCalledWith(
        expect.objectContaining({
          memo: "Correcting a misposted deposit",
          lines: [
            expect.objectContaining({ account_id: "cash", debit_minor: 12550, credit_minor: 0 }),
            expect.objectContaining({ account_id: "revenue", debit_minor: 0, credit_minor: 12550 }),
          ],
        }),
        expect.any(String),
      ),
    );
    const manualAdjustmentId = vi.mocked(dataLayer.recordManualAdjustment).mock.calls[0][1];
    expect(manualAdjustmentId.length).toBeGreaterThan(0);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/finance/journal/entry_new"));
  });

  it("surfaces a translated error from the Repository without navigating", async () => {
    const user = userEvent.setup();
    mockAccounts();
    vi.mocked(dataLayer.recordManualAdjustment).mockResolvedValue({
      success: false,
      error: "This accounting period is locked and cannot receive new postings.",
    });
    render(<ManualAdjustmentForm />);
    const accountSelects = await waitForAccountOptions();

    await user.selectOptions(accountSelects[0], "cash");
    await user.selectOptions(accountSelects[1], "revenue");
    await user.type(screen.getAllByLabelText(/^debit$/i)[0], "50");
    await user.type(screen.getAllByLabelText(/^credit$/i)[1], "50");
    await user.type(screen.getByLabelText(/^memo\b/i), "Adjustment");

    await user.click(screen.getByRole("button", { name: /record manual adjustment/i }));

    expect(await screen.findByText(/this accounting period is locked/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("recovers from an unexpected thrown error — resets submitting, shows a generic fallback, hides the raw error, preserves form state, does not navigate, and remains retryable", async () => {
    const user = userEvent.setup();
    mockAccounts();
    vi.mocked(dataLayer.recordManualAdjustment).mockRejectedValue(new Error("relation journal_entries does not exist"));
    render(<ManualAdjustmentForm />);
    const accountSelects = await waitForAccountOptions();

    await user.selectOptions(accountSelects[0], "cash");
    await user.selectOptions(accountSelects[1], "revenue");
    await user.type(screen.getAllByLabelText(/^debit$/i)[0], "50");
    await user.type(screen.getAllByLabelText(/^credit$/i)[1], "50");
    await user.type(screen.getByLabelText(/^memo\b/i), "Testing an unexpected failure");

    const submitButton = screen.getByRole("button", { name: /record manual adjustment/i });
    await user.click(submitButton);

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.queryByText(/relation journal_entries does not exist/i)).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/^memo\b/i)).toHaveValue("Testing an unexpected failure");
    expect(screen.getAllByLabelText(/^debit$/i)[0]).toHaveValue(50);
    expect(screen.getAllByLabelText(/^credit$/i)[1]).toHaveValue(50);
    expect(screen.getByRole("button", { name: /record manual adjustment/i })).not.toBeDisabled();
  });

  it("reuses the SAME manualAdjustmentId across a thrown-then-retried submit with an unchanged payload", async () => {
    const user = userEvent.setup();
    mockAccounts();
    vi.mocked(dataLayer.recordManualAdjustment)
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce({ success: true, data: makeJournalEntry({ id: "entry_new" }) });
    render(<ManualAdjustmentForm />);
    const accountSelects = await waitForAccountOptions();

    await user.selectOptions(accountSelects[0], "cash");
    await user.selectOptions(accountSelects[1], "revenue");
    await user.type(screen.getAllByLabelText(/^debit$/i)[0], "50");
    await user.type(screen.getAllByLabelText(/^credit$/i)[1], "50");
    await user.type(screen.getByLabelText(/^memo\b/i), "Retry after throw");

    const submitButton = screen.getByRole("button", { name: /record manual adjustment/i });
    await user.click(submitButton);
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    await user.click(submitButton);

    await waitFor(() => expect(dataLayer.recordManualAdjustment).toHaveBeenCalledTimes(2));
    const firstId = vi.mocked(dataLayer.recordManualAdjustment).mock.calls[0][1];
    const secondId = vi.mocked(dataLayer.recordManualAdjustment).mock.calls[1][1];
    expect(secondId).toBe(firstId);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/finance/journal/entry_new"));
  });

  it("generates a NEW manualAdjustmentId when the Founder edits the payload after a failed attempt, and submits with the edited payload", async () => {
    const user = userEvent.setup();
    mockAccounts();
    vi.mocked(dataLayer.recordManualAdjustment)
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce({ success: true, data: makeJournalEntry({ id: "entry_new" }) });
    render(<ManualAdjustmentForm />);
    const accountSelects = await waitForAccountOptions();

    await user.selectOptions(accountSelects[0], "cash");
    await user.selectOptions(accountSelects[1], "revenue");
    const debitInput = screen.getAllByLabelText(/^debit$/i)[0];
    await user.type(debitInput, "50");
    await user.type(screen.getAllByLabelText(/^credit$/i)[1], "50");
    await user.type(screen.getByLabelText(/^memo\b/i), "Original memo");

    const submitButton = screen.getByRole("button", { name: /record manual adjustment/i });
    await user.click(submitButton);
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();

    // Founder edits the memo (a payload-identity field) before retrying.
    await user.clear(screen.getByLabelText(/^memo\b/i));
    await user.type(screen.getByLabelText(/^memo\b/i), "Edited memo after failure");
    await user.click(submitButton);

    await waitFor(() => expect(dataLayer.recordManualAdjustment).toHaveBeenCalledTimes(2));
    const firstId = vi.mocked(dataLayer.recordManualAdjustment).mock.calls[0][1];
    const secondCall = vi.mocked(dataLayer.recordManualAdjustment).mock.calls[1];
    expect(secondCall[1]).not.toBe(firstId);
    expect(secondCall[0]).toEqual(expect.objectContaining({ memo: "Edited memo after failure" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/finance/journal/entry_new"));
  });

  it("does not allow a duplicate submit while a request is pending", async () => {
    const user = userEvent.setup();
    mockAccounts();
    let resolveRecord: (value: { success: true; data: ReturnType<typeof makeJournalEntry> }) => void;
    vi.mocked(dataLayer.recordManualAdjustment).mockReturnValue(
      new Promise((resolve) => {
        resolveRecord = resolve;
      }),
    );
    render(<ManualAdjustmentForm />);
    const accountSelects = await waitForAccountOptions();

    await user.selectOptions(accountSelects[0], "cash");
    await user.selectOptions(accountSelects[1], "revenue");
    await user.type(screen.getAllByLabelText(/^debit$/i)[0], "50");
    await user.type(screen.getAllByLabelText(/^credit$/i)[1], "50");
    await user.type(screen.getByLabelText(/^memo\b/i), "Adjustment");

    const submitButton = screen.getByRole("button", { name: /record manual adjustment/i });
    await user.click(submitButton);
    await waitFor(() => expect(submitButton).toBeDisabled());
    await user.click(submitButton);

    expect(dataLayer.recordManualAdjustment).toHaveBeenCalledTimes(1);
    resolveRecord!({ success: true, data: makeJournalEntry({ id: "entry_new" }) });
  });
});
