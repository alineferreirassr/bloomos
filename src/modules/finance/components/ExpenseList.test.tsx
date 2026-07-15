import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExpenseListTable } from "@/modules/finance/components/ExpenseListTable";
import { ExpenseListCards } from "@/modules/finance/components/ExpenseListCards";
import { makeExpense } from "@/modules/finance/testUtils";
import { makeEvent } from "@/modules/events/testUtils";
import type { ExpenseListRow } from "@/modules/finance/components/ExpensesListView";

const rows: ExpenseListRow[] = [
  {
    expense: makeExpense({
      id: "expense_a",
      description: "Florist deposit",
      category: "flowers",
      status: "due",
      amount_minor: 75000,
      due_date: "2026-06-15",
      reimbursable: true,
      reference: "FL-001",
    }),
    event: makeEvent({ id: "event_a", title: "Malibu Sunset Proposal" }),
    nextAction: "Pay this expense",
  },
  {
    expense: makeExpense({
      id: "expense_b",
      description: "Catering final balance",
      category: "food_beverage",
      status: "paid",
      amount_minor: 320000,
      due_date: null,
      reimbursable: false,
      reference: null,
    }),
    event: undefined,
    nextAction: null,
  },
];

describe("ExpenseListTable (desktop)", () => {
  it("renders every expense's description, category, status, amount, and reimbursable flag", () => {
    render(<ExpenseListTable rows={rows} />);
    expect(screen.getByText("Florist deposit")).toBeInTheDocument();
    expect(screen.getByText("Malibu Sunset Proposal")).toBeInTheDocument();
    expect(screen.getByText("$750.00")).toBeInTheDocument();
    expect(screen.getByText("FL-001")).toBeInTheDocument();
    expect(screen.getByText("Pay this expense")).toBeInTheDocument();

    expect(screen.getByText("Catering final balance")).toBeInTheDocument();
    expect(screen.getByText("$3,200.00")).toBeInTheDocument();
  });
});

describe("ExpenseListCards (mobile)", () => {
  it("renders every expense's description, event, amount, and next action", () => {
    render(<ExpenseListCards rows={rows} />);
    expect(screen.getByText("Florist deposit")).toBeInTheDocument();
    expect(screen.getByText("Malibu Sunset Proposal")).toBeInTheDocument();
    expect(screen.getByText("Reimbursable")).toBeInTheDocument();
    expect(screen.getByText("Pay this expense")).toBeInTheDocument();

    expect(screen.getByText("Catering final balance")).toBeInTheDocument();
  });
});
