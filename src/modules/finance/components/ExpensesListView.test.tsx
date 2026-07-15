import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExpensesListView } from "@/modules/finance/components/ExpensesListView";
import { makeExpense } from "@/modules/finance/testUtils";

vi.mock("@/lib/data", () => ({
  getExpenses: vi.fn(),
  getEvents: vi.fn(),
  getExpenseNextAction: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

function mockCommon() {
  vi.mocked(dataLayer.getEvents).mockResolvedValue([]);
  vi.mocked(dataLayer.getExpenseNextAction).mockResolvedValue(null);
}

describe("ExpensesListView", () => {
  it("renders expenses sorted by transaction date, newest first", async () => {
    mockCommon();
    vi.mocked(dataLayer.getExpenses).mockResolvedValue([
      makeExpense({ id: "e_old", description: "Older Expense", transaction_date: "2026-01-01" }),
      makeExpense({ id: "e_new", description: "Newer Expense", transaction_date: "2026-06-01" }),
    ]);

    render(<ExpensesListView />);

    const rows = await screen.findAllByText(/^(Newer|Older) Expense$/);
    expect(rows[0]).toHaveTextContent("Newer Expense");
  });

  it("re-fetches with the entered search text", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(dataLayer.getExpenses).mockResolvedValue([]);

    render(<ExpensesListView />);
    await waitFor(() => expect(dataLayer.getExpenses).toHaveBeenCalled());

    await user.type(screen.getByLabelText(/search expenses/i), "florist");

    await waitFor(() =>
      expect(dataLayer.getExpenses).toHaveBeenLastCalledWith(expect.objectContaining({ search: "florist" })),
    );
  });

  it("re-fetches with the selected category filter", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(dataLayer.getExpenses).mockResolvedValue([]);

    render(<ExpensesListView />);
    await waitFor(() => expect(dataLayer.getExpenses).toHaveBeenCalled());

    await user.selectOptions(screen.getByLabelText(/filter by category/i), "food_beverage");

    await waitFor(() =>
      expect(dataLayer.getExpenses).toHaveBeenLastCalledWith(
        expect.objectContaining({ category: "food_beverage" }),
      ),
    );
  });

  it("re-fetches with unpaidOnly when the checkbox is checked", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(dataLayer.getExpenses).mockResolvedValue([]);

    render(<ExpensesListView />);
    await waitFor(() => expect(dataLayer.getExpenses).toHaveBeenCalled());

    await user.click(screen.getByRole("checkbox", { name: /unpaid only/i }));

    await waitFor(() =>
      expect(dataLayer.getExpenses).toHaveBeenLastCalledWith(expect.objectContaining({ unpaidOnly: true })),
    );
  });

  it("re-fetches with reimbursableOnly when the checkbox is checked", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(dataLayer.getExpenses).mockResolvedValue([]);

    render(<ExpensesListView />);
    await waitFor(() => expect(dataLayer.getExpenses).toHaveBeenCalled());

    await user.click(screen.getByRole("checkbox", { name: /reimbursable only/i }));

    await waitFor(() =>
      expect(dataLayer.getExpenses).toHaveBeenLastCalledWith(expect.objectContaining({ reimbursableOnly: true })),
    );
  });

  it("shows an empty state when no expenses match", async () => {
    mockCommon();
    vi.mocked(dataLayer.getExpenses).mockResolvedValue([]);

    render(<ExpensesListView />);

    expect(await screen.findByText(/no expenses yet/i)).toBeInTheDocument();
  });

  it("shows an error state when loading fails", async () => {
    mockCommon();
    vi.mocked(dataLayer.getExpenses).mockRejectedValue(new Error("boom"));

    render(<ExpensesListView />);

    expect(await screen.findByText(/could not load expenses/i)).toBeInTheDocument();
  });
});
