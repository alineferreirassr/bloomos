import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateAccountingPeriodDialog } from "@/modules/finance/components/CreateAccountingPeriodDialog";
import { makeAccountingPeriod } from "@/modules/finance/testUtils";

vi.mock("@/lib/data", () => ({
  createAccountingPeriod: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

async function fillValidRange() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/start date/i), "2026-02-01");
  await user.type(screen.getByLabelText(/end date/i), "2026-02-28");
  return user;
}

describe("CreateAccountingPeriodDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the create dialog", () => {
    render(<CreateAccountingPeriodDialog open onClose={vi.fn()} onCreated={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: /create accounting period/i })).toBeInTheDocument();
  });

  it("on success calls onCreated with the new period and closes the dialog", async () => {
    const period = makeAccountingPeriod({ id: "period_new", period_start: "2026-02-01", period_end: "2026-02-28" });
    vi.mocked(dataLayer.createAccountingPeriod).mockResolvedValue({ success: true, data: period });
    const onCreated = vi.fn();
    const onClose = vi.fn();
    render(<CreateAccountingPeriodDialog open onClose={onClose} onCreated={onCreated} />);

    const user = await fillValidRange();
    await user.click(screen.getByRole("button", { name: /create period/i }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(period));
    expect(onClose).toHaveBeenCalled();
  });

  it("displays a resolved DataResult failure and keeps the dialog open", async () => {
    vi.mocked(dataLayer.createAccountingPeriod).mockResolvedValue({
      success: false,
      error: "This period overlaps an existing accounting period.",
    });
    const onClose = vi.fn();
    render(<CreateAccountingPeriodDialog open onClose={onClose} onCreated={vi.fn()} />);

    const user = await fillValidRange();
    await user.click(screen.getByRole("button", { name: /create period/i }));

    expect(await screen.findByText(/overlaps an existing accounting period/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("recovers from an unexpected thrown error — shows a generic fallback, does not call onClose, preserves fields, and remains retryable", async () => {
    vi.mocked(dataLayer.createAccountingPeriod).mockRejectedValue(new Error("relation accounting_periods does not exist"));
    const onClose = vi.fn();
    const onCreated = vi.fn();
    render(<CreateAccountingPeriodDialog open onClose={onClose} onCreated={onCreated} />);

    const user = await fillValidRange();
    await user.click(screen.getByRole("button", { name: /create period/i }));

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.queryByText(/relation accounting_periods does not exist/i)).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onCreated).toHaveBeenCalledWith();
    expect(screen.getByLabelText(/start date/i)).toHaveValue("2026-02-01");
    expect(screen.getByLabelText(/end date/i)).toHaveValue("2026-02-28");
    expect(screen.getByRole("button", { name: /create period/i })).not.toBeDisabled();
  });

  it("allows retry after a thrown failure, calling createAccountingPeriod again with the same values", async () => {
    const period = makeAccountingPeriod({ id: "period_new", period_start: "2026-02-01", period_end: "2026-02-28" });
    vi.mocked(dataLayer.createAccountingPeriod)
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce({ success: true, data: period });
    const onCreated = vi.fn();
    render(<CreateAccountingPeriodDialog open onClose={vi.fn()} onCreated={onCreated} />);

    const user = await fillValidRange();
    await user.click(screen.getByRole("button", { name: /create period/i }));
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /create period/i }));

    await waitFor(() => expect(dataLayer.createAccountingPeriod).toHaveBeenCalledTimes(2));
    expect(onCreated).toHaveBeenCalledTimes(2);
    const firstCallInput = vi.mocked(dataLayer.createAccountingPeriod).mock.calls[0][0];
    const secondCallInput = vi.mocked(dataLayer.createAccountingPeriod).mock.calls[1][0];
    expect(secondCallInput).toEqual(firstCallInput);
  });
});
