import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EventFinancialSummaryCard } from "@/modules/finance/components/EventFinancialSummaryCard";
import type { EventFinancialSummary } from "@/modules/finance/financialSummary";

const summary: EventFinancialSummary = {
  contracted_value_minor: 850000,
  invoiced_total_minor: 510000,
  collected_minor: 320000,
  refunded_minor: 0,
  outstanding_minor: 190000,
  expense_total_minor: 110000,
  planned_expense_total_minor: 0,
  committed_expense_total_minor: 0,
  paid_expense_total_minor: 110000,
  gross_profit_minor: 400000,
  net_profit_minor: 210000,
  cash_profit_minor: 210000,
  gross_margin_percent: 78,
  deposit_required_minor: 250000,
  deposit_paid_minor: 250000,
  deposit_balance_minor: 0,
  payment_completion_percentage: 60,
  expense_percentage_of_revenue: 20,
};

describe("EventFinancialSummaryCard", () => {
  it("renders every financial figure and the deposit-paid status badge", () => {
    render(
      <EventFinancialSummaryCard eventId="event_1" clientId="client_1" summary={summary} status="deposit_paid" />,
    );

    expect(screen.getByText("$8,500.00")).toBeInTheDocument();
    expect(screen.getByText("$5,100.00")).toBeInTheDocument();
    expect(screen.getByText("$3,200.00")).toBeInTheDocument();
    expect(screen.getByText("$1,900.00")).toBeInTheDocument();
    expect(screen.getByText("$1,100.00")).toBeInTheDocument();
    expect(screen.getByText("$4,000.00")).toBeInTheDocument();
    expect(screen.getByText("$2,100.00")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("Deposit Paid")).toBeInTheDocument();
  });

  it("links Create Invoice to the new-invoice route with the event and client prefilled", () => {
    render(
      <EventFinancialSummaryCard eventId="event_1" clientId="client_1" summary={summary} status="balance_due" />,
    );

    expect(screen.getByRole("link", { name: /create invoice/i })).toHaveAttribute(
      "href",
      "/finance/invoices/new?eventId=event_1&clientId=client_1",
    );
  });
});
