import { describe, expect, it } from "vitest";
import {
  computeEventFinancialSummary,
  computeWorkspaceFinancialSummary,
  computeAllTimeFinancialTotals,
} from "@/modules/finance/financialSummary";
import { makeInvoice, makePayment, makeExpense } from "@/modules/finance/testUtils";
import { makeContract } from "@/modules/contracts/testUtils";

describe("computeEventFinancialSummary", () => {
  it("computes contracted value from the linked Contract's total_value (converted to minor units)", () => {
    const contracts = [makeContract({ event_id: "event_1", total_value: 1000, status: "signed" })];
    const summary = computeEventFinancialSummary("event_1", contracts, [], [], []);
    expect(summary.contracted_value_minor).toBe(100000);
  });

  it("excludes cancelled/declined/expired/archived Contracts from contracted value", () => {
    const contracts = [makeContract({ event_id: "event_1", total_value: 1000, status: "cancelled" })];
    const summary = computeEventFinancialSummary("event_1", contracts, [], [], []);
    expect(summary.contracted_value_minor).toBe(0);
  });

  it("sums invoiced_total_minor across non-voided Invoices, excluding voided", () => {
    const invoices = [
      makeInvoice({ event_id: "event_1", total_minor: 100000, status: "sent" }),
      makeInvoice({ event_id: "event_1", total_minor: 50000, status: "voided" }),
    ];
    const summary = computeEventFinancialSummary("event_1", [], invoices, [], []);
    expect(summary.invoiced_total_minor).toBe(100000);
  });

  it("sums outstanding_minor from each non-voided Invoice's own balance_minor", () => {
    const invoices = [
      makeInvoice({ event_id: "event_1", total_minor: 100000, paid_minor: 40000, balance_minor: 60000 }),
    ];
    const summary = computeEventFinancialSummary("event_1", [], invoices, [], []);
    expect(summary.outstanding_minor).toBe(60000);
  });

  it("computes collected_minor net of refunds", () => {
    const payments = [
      makePayment({ event_id: "event_1", amount_minor: 100000, status: "succeeded", payment_type: "deposit" }),
      makePayment({ event_id: "event_1", amount_minor: 20000, status: "succeeded", payment_type: "refund" }),
    ];
    const summary = computeEventFinancialSummary("event_1", [], [], payments, []);
    expect(summary.collected_minor).toBe(80000);
    expect(summary.refunded_minor).toBe(20000);
  });

  it("excludes pending/failed/cancelled Payments from collected_minor", () => {
    const payments = [
      makePayment({ event_id: "event_1", amount_minor: 100000, status: "pending" }),
      makePayment({ event_id: "event_1", amount_minor: 50000, status: "failed" }),
      makePayment({ event_id: "event_1", amount_minor: 30000, status: "cancelled" }),
    ];
    const summary = computeEventFinancialSummary("event_1", [], [], payments, []);
    expect(summary.collected_minor).toBe(0);
  });

  it("sums expense_total_minor, excluding cancelled Expenses", () => {
    const expenses = [
      makeExpense({ event_id: "event_1", amount_minor: 40000, status: "paid" }),
      makeExpense({ event_id: "event_1", amount_minor: 10000, status: "cancelled" }),
    ];
    const summary = computeEventFinancialSummary("event_1", [], [], [], expenses);
    expect(summary.expense_total_minor).toBe(40000);
  });

  it("computes gross_profit (revenue-basis) and net_profit (cash-basis) distinctly", () => {
    const invoices = [makeInvoice({ event_id: "event_1", total_minor: 100000, paid_minor: 60000, balance_minor: 40000 })];
    const payments = [makePayment({ event_id: "event_1", amount_minor: 60000, status: "succeeded" })];
    const expenses = [makeExpense({ event_id: "event_1", amount_minor: 20000, status: "paid" })];
    const summary = computeEventFinancialSummary("event_1", [], invoices, payments, expenses);
    expect(summary.gross_profit_minor).toBe(80000); // 100000 invoiced - 20000 expenses
    expect(summary.net_profit_minor).toBe(40000); // 60000 collected - 20000 expenses
  });

  it("computes deposit_required/deposit_paid/deposit_balance", () => {
    const contracts = [
      makeContract({ event_id: "event_1", status: "signed", deposit_required: true, deposit_amount: 500 }),
    ];
    const payments = [
      makePayment({ event_id: "event_1", payment_type: "deposit", amount_minor: 20000, status: "succeeded" }),
    ];
    const summary = computeEventFinancialSummary("event_1", contracts, [], payments, []);
    expect(summary.deposit_required_minor).toBe(50000);
    expect(summary.deposit_paid_minor).toBe(20000);
    expect(summary.deposit_balance_minor).toBe(30000);
  });

  it("computes payment_completion_percentage and expense_percentage_of_revenue", () => {
    const invoices = [makeInvoice({ event_id: "event_1", total_minor: 100000, paid_minor: 50000, balance_minor: 50000 })];
    const payments = [makePayment({ event_id: "event_1", amount_minor: 50000, status: "succeeded" })];
    const expenses = [makeExpense({ event_id: "event_1", amount_minor: 25000, status: "paid" })];
    const summary = computeEventFinancialSummary("event_1", [], invoices, payments, expenses);
    expect(summary.payment_completion_percentage).toBe(50);
    expect(summary.expense_percentage_of_revenue).toBe(25);
  });

  it("returns all zeros for an Event with no financial records", () => {
    const summary = computeEventFinancialSummary("event_1", [], [], [], []);
    expect(summary.contracted_value_minor).toBe(0);
    expect(summary.invoiced_total_minor).toBe(0);
    expect(summary.collected_minor).toBe(0);
    expect(summary.outstanding_minor).toBe(0);
    expect(summary.payment_completion_percentage).toBe(0);
  });

  it("scopes every figure to the requested Event only", () => {
    const invoices = [
      makeInvoice({ event_id: "event_1", total_minor: 100000 }),
      makeInvoice({ event_id: "event_2", total_minor: 999999 }),
    ];
    const summary = computeEventFinancialSummary("event_1", [], invoices, [], []);
    expect(summary.invoiced_total_minor).toBe(100000);
  });
});

describe("computeWorkspaceFinancialSummary", () => {
  const reference = new Date("2026-07-15T00:00:00.000Z");

  it("sums revenue_this_month_minor only for Invoices issued in the reference month", () => {
    const invoices = [
      makeInvoice({ total_minor: 100000, issue_date: "2026-07-01", status: "sent" }),
      makeInvoice({ total_minor: 50000, issue_date: "2026-06-01", status: "sent" }),
    ];
    const summary = computeWorkspaceFinancialSummary([], invoices, [], [], reference);
    expect(summary.revenue_this_month_minor).toBe(100000);
  });

  it("sums collected_this_month_minor net of refunds in the reference month", () => {
    const payments = [
      makePayment({ amount_minor: 100000, status: "succeeded", transaction_date: "2026-07-10" }),
      makePayment({ amount_minor: 20000, status: "succeeded", payment_type: "refund", transaction_date: "2026-07-12" }),
    ];
    const summary = computeWorkspaceFinancialSummary([], [], payments, [], reference);
    expect(summary.collected_this_month_minor).toBe(80000);
  });

  it("computes outstanding_receivables_minor as a point-in-time snapshot, not month-scoped", () => {
    const invoices = [makeInvoice({ total_minor: 100000, paid_minor: 0, balance_minor: 100000, issue_date: "2025-01-01" })];
    const summary = computeWorkspaceFinancialSummary([], invoices, [], [], reference);
    expect(summary.outstanding_receivables_minor).toBe(100000);
  });

  it("computes overdue_receivables_minor only from overdue Invoices", () => {
    const invoices = [
      makeInvoice({ total_minor: 100000, balance_minor: 100000, status: "overdue" }),
      makeInvoice({ total_minor: 50000, balance_minor: 50000, status: "sent" }),
    ];
    const summary = computeWorkspaceFinancialSummary([], invoices, [], [], reference);
    expect(summary.overdue_receivables_minor).toBe(100000);
  });

  it("sums expenses_this_month_minor, excluding cancelled", () => {
    const expenses = [
      makeExpense({ amount_minor: 30000, transaction_date: "2026-07-05", status: "paid" }),
      makeExpense({ amount_minor: 10000, transaction_date: "2026-07-05", status: "cancelled" }),
    ];
    const summary = computeWorkspaceFinancialSummary([], [], [], expenses, reference);
    expect(summary.expenses_this_month_minor).toBe(30000);
  });

  it("computes refunds_this_month_minor from refund-type Payments in the month", () => {
    const payments = [makePayment({ amount_minor: 15000, payment_type: "refund", status: "succeeded", transaction_date: "2026-07-08" })];
    const summary = computeWorkspaceFinancialSummary([], [], payments, [], reference);
    expect(summary.refunds_this_month_minor).toBe(15000);
  });

  it("computes deposits_pending_minor across every deposit-required Contract", () => {
    const contracts = [
      makeContract({ id: "c1", event_id: "event_1", status: "signed", deposit_required: true, deposit_amount: 500 }),
    ];
    const payments = [makePayment({ contract_id: "c1", payment_type: "deposit", amount_minor: 30000, status: "succeeded" })];
    const summary = computeWorkspaceFinancialSummary(contracts, [], payments, [], reference);
    expect(summary.deposits_pending_minor).toBe(20000);
  });
});

describe("computeAllTimeFinancialTotals", () => {
  it("sums total_invoiced_minor across all non-voided Invoices regardless of date", () => {
    const invoices = [
      makeInvoice({ total_minor: 100000, issue_date: "2020-01-01", status: "paid" }),
      makeInvoice({ total_minor: 50000, issue_date: "2026-07-01", status: "sent" }),
      makeInvoice({ total_minor: 99999, status: "voided" }),
    ];
    const totals = computeAllTimeFinancialTotals(invoices, []);
    expect(totals.total_invoiced_minor).toBe(150000);
  });

  it("sums total_collected_minor across all succeeded Payments, net of refunds, regardless of date", () => {
    const payments = [
      makePayment({ amount_minor: 100000, status: "succeeded", transaction_date: "2020-01-01" }),
      makePayment({ amount_minor: 20000, status: "succeeded", payment_type: "refund", transaction_date: "2026-07-01" }),
    ];
    const totals = computeAllTimeFinancialTotals([], payments);
    expect(totals.total_collected_minor).toBe(80000);
  });
});
