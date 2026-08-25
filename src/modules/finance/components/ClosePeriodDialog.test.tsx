import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClosePeriodDialog } from "@/modules/finance/components/ClosePeriodDialog";
import { makeAccountingPeriod } from "@/modules/finance/testUtils";

vi.mock("@/lib/data", () => ({
  closeAccountingPeriod: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("ClosePeriodDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the confirmation dialog", () => {
    render(
      <ClosePeriodDialog open period={makeAccountingPeriod()} onClose={vi.fn()} onClosed={vi.fn()} />,
    );

    expect(screen.getByRole("dialog", { name: /close accounting period/i })).toBeInTheDocument();
  });

  it("on success calls onClosed with the updated period and closes the dialog", async () => {
    const user = userEvent.setup();
    const period = makeAccountingPeriod({ status: "closed" });
    vi.mocked(dataLayer.closeAccountingPeriod).mockResolvedValue({ success: true, data: period });
    const onClosed = vi.fn();
    const onClose = vi.fn();
    render(<ClosePeriodDialog open period={makeAccountingPeriod()} onClose={onClose} onClosed={onClosed} />);

    await user.click(screen.getByRole("button", { name: /close period/i }));

    expect(onClosed).toHaveBeenCalledWith(period);
    expect(onClose).toHaveBeenCalled();
  });

  it("displays a resolved DataResult failure and keeps the dialog open", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.closeAccountingPeriod).mockResolvedValue({
      success: false,
      error: "Cannot close a period with status closed.",
    });
    const onClose = vi.fn();
    render(<ClosePeriodDialog open period={makeAccountingPeriod()} onClose={onClose} onClosed={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /close period/i }));

    expect(await screen.findByText(/cannot close a period with status closed/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("recovers from an unexpected thrown error — resets submitting, shows a generic fallback, does not hang, and refetches", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.closeAccountingPeriod).mockRejectedValue(new Error("relation accounting_periods does not exist"));
    const onClose = vi.fn();
    const onClosed = vi.fn();
    render(<ClosePeriodDialog open period={makeAccountingPeriod()} onClose={onClose} onClosed={onClosed} />);

    await user.click(screen.getByRole("button", { name: /close period/i }));

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.queryByText(/relation accounting_periods does not exist/i)).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onClosed).toHaveBeenCalledWith();
    expect(screen.getByRole("button", { name: /close period/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /^cancel$/i })).not.toBeDisabled();
  });

  it("allows retry after a thrown failure, calling closeAccountingPeriod again", async () => {
    const user = userEvent.setup();
    const period = makeAccountingPeriod({ status: "closed" });
    vi.mocked(dataLayer.closeAccountingPeriod)
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce({ success: true, data: period });
    render(<ClosePeriodDialog open period={makeAccountingPeriod()} onClose={vi.fn()} onClosed={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /close period/i }));
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /close period/i }));

    expect(dataLayer.closeAccountingPeriod).toHaveBeenCalledTimes(2);
  });
});
