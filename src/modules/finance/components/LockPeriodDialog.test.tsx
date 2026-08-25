import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LockPeriodDialog } from "@/modules/finance/components/LockPeriodDialog";
import { makeAccountingPeriod } from "@/modules/finance/testUtils";

vi.mock("@/lib/data", () => ({
  lockAccountingPeriod: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("LockPeriodDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the confirmation dialog", () => {
    render(
      <LockPeriodDialog open period={makeAccountingPeriod({ status: "closed" })} onClose={vi.fn()} onLocked={vi.fn()} />,
    );

    expect(screen.getByRole("dialog", { name: /lock accounting period/i })).toBeInTheDocument();
  });

  it("on success calls onLocked with the updated period and closes the dialog", async () => {
    const user = userEvent.setup();
    const period = makeAccountingPeriod({ status: "locked" });
    vi.mocked(dataLayer.lockAccountingPeriod).mockResolvedValue({ success: true, data: period });
    const onLocked = vi.fn();
    const onClose = vi.fn();
    render(
      <LockPeriodDialog open period={makeAccountingPeriod({ status: "closed" })} onClose={onClose} onLocked={onLocked} />,
    );

    await user.click(screen.getByRole("button", { name: /lock period/i }));

    expect(onLocked).toHaveBeenCalledWith(period);
    expect(onClose).toHaveBeenCalled();
  });

  it("displays a resolved DataResult failure and keeps the dialog open", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.lockAccountingPeriod).mockResolvedValue({
      success: false,
      error: "Cannot lock a period with status open — a period must be closed before it can be locked.",
    });
    const onClose = vi.fn();
    render(
      <LockPeriodDialog open period={makeAccountingPeriod({ status: "closed" })} onClose={onClose} onLocked={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: /lock period/i }));

    expect(await screen.findByText(/must be closed before it can be locked/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("recovers from an unexpected thrown error — resets submitting, shows a generic fallback, does not hang, and refetches", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.lockAccountingPeriod).mockRejectedValue(new Error("relation accounting_periods does not exist"));
    const onClose = vi.fn();
    const onLocked = vi.fn();
    render(
      <LockPeriodDialog open period={makeAccountingPeriod({ status: "closed" })} onClose={onClose} onLocked={onLocked} />,
    );

    await user.click(screen.getByRole("button", { name: /lock period/i }));

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.queryByText(/relation accounting_periods does not exist/i)).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onLocked).toHaveBeenCalledWith();
    expect(screen.getByRole("button", { name: /lock period/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /^cancel$/i })).not.toBeDisabled();
  });

  it("allows retry after a thrown failure, calling lockAccountingPeriod again", async () => {
    const user = userEvent.setup();
    const period = makeAccountingPeriod({ status: "locked" });
    vi.mocked(dataLayer.lockAccountingPeriod)
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce({ success: true, data: period });
    render(
      <LockPeriodDialog open period={makeAccountingPeriod({ status: "closed" })} onClose={vi.fn()} onLocked={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: /lock period/i }));
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /lock period/i }));

    expect(dataLayer.lockAccountingPeriod).toHaveBeenCalledTimes(2);
  });
});
