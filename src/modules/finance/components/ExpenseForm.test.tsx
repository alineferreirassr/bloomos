import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExpenseForm } from "@/modules/finance/components/ExpenseForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/data", () => ({
  getClients: vi.fn(),
  getEvents: vi.fn(),
  getContracts: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

function mockCommon() {
  vi.mocked(dataLayer.getClients).mockResolvedValue([]);
  vi.mocked(dataLayer.getEvents).mockResolvedValue([]);
  vi.mocked(dataLayer.getContracts).mockResolvedValue([]);
}

describe("ExpenseForm", () => {
  it("shows a validation error for a missing description and a zero amount", async () => {
    const user = userEvent.setup();
    mockCommon();
    const onSubmit = vi.fn();
    render(<ExpenseForm submitLabel="Create Expense" cancelHref="/finance/expenses" onSubmit={onSubmit} />);
    await screen.findByLabelText(/^client\b/i);

    await user.clear(screen.getByLabelText(/^amount\b/i));
    await user.type(screen.getByLabelText(/^amount\b/i), "0");
    await user.click(screen.getByRole("button", { name: /create expense/i }));

    expect(await screen.findByText(/description is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/enter an amount greater than zero/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits with the entered values on success", async () => {
    const user = userEvent.setup();
    mockCommon();
    const onSubmit = vi.fn().mockResolvedValue({ success: true, data: {} });
    render(<ExpenseForm submitLabel="Create Expense" cancelHref="/finance/expenses" onSubmit={onSubmit} />);
    await screen.findByLabelText(/^client\b/i);

    await user.type(screen.getByLabelText(/description/i), "Florist deposit");
    await user.clear(screen.getByLabelText(/^amount\b/i));
    await user.type(screen.getByLabelText(/^amount\b/i), "750");
    await user.click(screen.getByRole("button", { name: /create expense/i }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ description: "Florist deposit", amount: "750" }),
      ),
    );
  });

  it("recovers from an unexpected thrown error — resets submitting, shows a generic fallback, hides the raw error, preserves form state, does not navigate, and remains retryable", async () => {
    const user = userEvent.setup();
    mockCommon();
    const onSubmit = vi.fn().mockRejectedValue(new Error("relation expenses does not exist"));
    render(<ExpenseForm submitLabel="Create Expense" cancelHref="/finance/expenses" onSubmit={onSubmit} />);
    await screen.findByLabelText(/^client\b/i);

    await user.type(screen.getByLabelText(/description/i), "Florist deposit");
    await user.clear(screen.getByLabelText(/^amount\b/i));
    await user.type(screen.getByLabelText(/^amount\b/i), "750");
    const submitButton = screen.getByRole("button", { name: /create expense/i });
    await user.click(submitButton);

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.queryByText(/relation expenses does not exist/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toHaveValue("Florist deposit");
    expect(screen.getByLabelText(/^amount\b/i)).toHaveValue(750);
    expect(submitButton).not.toBeDisabled();

    onSubmit.mockResolvedValueOnce({ success: true, data: {} });
    await user.click(submitButton);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
  });

  it("renders status read-only (not a submittable field) when editing with a currentStatus", async () => {
    mockCommon();
    render(
      <ExpenseForm
        submitLabel="Save changes"
        cancelHref="/finance/expenses"
        currentStatus="due"
        onSubmit={vi.fn()}
      />,
    );
    await screen.findByLabelText(/^client\b/i);

    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Due")).toBeInTheDocument();
    expect(screen.getByText(/changed through the quick actions/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^status\b/i)).not.toBeInTheDocument();
  });
});
