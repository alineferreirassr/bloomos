import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContractFinanceSummaryCard } from "@/modules/finance/components/ContractFinanceSummaryCard";
import type { ContractFinancialSummaryView } from "@/modules/finance/financeActions";

describe("ContractFinanceSummaryCard", () => {
  it("renders totals, the deposit status badge, and linked invoices", () => {
    const summary: ContractFinancialSummaryView = {
      invoices: [
        { id: "invoice_1", invoice_number: "INV-2026-0001", status: "sent", currency: "USD", total_minor: 250000 },
      ],
      totalInvoicedMinor: 250000,
      totalCollectedMinor: 100000,
      outstandingMinor: 150000,
      depositStatus: "deposit_partial",
      depositRequiredMinor: 250000,
      depositPaidMinor: 100000,
    };

    render(<ContractFinanceSummaryCard contractId="contract_1" clientId="client_1" summary={summary} />);

    expect(screen.getAllByText("$2,500.00").length).toBeGreaterThan(0);
    expect(screen.getByText("$1,000.00")).toBeInTheDocument();
    expect(screen.getByText("$1,500.00")).toBeInTheDocument();
    expect(screen.getByText("Deposit partially paid")).toBeInTheDocument();
    expect(screen.getByText("INV-2026-0001")).toBeInTheDocument();
  });

  it("shows a no-invoices message when nothing is linked yet", () => {
    const summary: ContractFinancialSummaryView = {
      invoices: [],
      totalInvoicedMinor: 0,
      totalCollectedMinor: 0,
      outstandingMinor: 0,
      depositStatus: "not_required",
      depositRequiredMinor: 0,
      depositPaidMinor: 0,
    };

    render(<ContractFinanceSummaryCard contractId="contract_1" clientId="client_1" summary={summary} />);

    expect(screen.getByText(/no invoices linked to this contract yet/i)).toBeInTheDocument();
    expect(screen.getByText("Not required")).toBeInTheDocument();
  });

  it("links Create Invoice to the new-invoice route with the contract and client prefilled", () => {
    const summary: ContractFinancialSummaryView = {
      invoices: [],
      totalInvoicedMinor: 0,
      totalCollectedMinor: 0,
      outstandingMinor: 0,
      depositStatus: "not_required",
      depositRequiredMinor: 0,
      depositPaidMinor: 0,
    };

    render(<ContractFinanceSummaryCard contractId="contract_1" clientId="client_1" summary={summary} />);

    expect(screen.getByRole("link", { name: /create invoice/i })).toHaveAttribute(
      "href",
      "/finance/invoices/new?contractId=contract_1&clientId=client_1",
    );
  });

  it("Phase 06C — renders redacted amounts as '—' when the caller lacks finance.amounts.view, without profit/margin ever appearing", () => {
    const summary: ContractFinancialSummaryView = {
      invoices: [{ id: "invoice_1", invoice_number: "INV-2026-0001", status: "sent", currency: "USD", total_minor: null }],
      totalInvoicedMinor: null,
      totalCollectedMinor: null,
      outstandingMinor: null,
      depositStatus: "deposit_partial",
      depositRequiredMinor: null,
      depositPaidMinor: null,
    };

    render(<ContractFinanceSummaryCard contractId="contract_1" clientId="client_1" summary={summary} />);

    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText("INV-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("Deposit partially paid")).toBeInTheDocument();
  });
});
