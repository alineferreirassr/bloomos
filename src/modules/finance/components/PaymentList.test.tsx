import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PaymentListTable } from "@/modules/finance/components/PaymentListTable";
import { PaymentListCards } from "@/modules/finance/components/PaymentListCards";
import { makePayment } from "@/modules/finance/testUtils";
import { makeClient } from "@/modules/clients/testUtils";
import type { PaymentListRow } from "@/modules/finance/components/PaymentsListView";

const rows: PaymentListRow[] = [
  {
    payment: makePayment({
      id: "payment_a",
      payment_type: "deposit",
      status: "succeeded",
      amount_minor: 250000,
      payment_method: "cash",
      reference: "DEP-001",
      transaction_date: "2026-06-01",
    }),
    client: makeClient({ id: "client_a", first_name: "Jordan", last_name: "Ellis" }),
    event: undefined,
    invoice: undefined,
  },
  {
    payment: makePayment({
      id: "payment_b",
      payment_type: "refund",
      status: "refunded",
      amount_minor: 50000,
      payment_method: "credit_card",
      reference: "REF-001",
      transaction_date: "2026-06-10",
    }),
    client: makeClient({ id: "client_b", first_name: "Isabella", last_name: "Cruz" }),
    event: undefined,
    invoice: undefined,
  },
];

describe("PaymentListTable (desktop)", () => {
  it("renders every payment's client, type, status, amount, and reference", () => {
    render(<PaymentListTable rows={rows} />);
    expect(screen.getByText("Jordan Ellis")).toBeInTheDocument();
    expect(screen.getByText("$2,500.00")).toBeInTheDocument();
    expect(screen.getByText("DEP-001")).toBeInTheDocument();
    expect(screen.getByText("Succeeded")).toBeInTheDocument();

    expect(screen.getByText("Isabella Cruz")).toBeInTheDocument();
    expect(screen.getByText("$500.00")).toBeInTheDocument();
    expect(screen.getByText("REF-001")).toBeInTheDocument();
    expect(screen.getByText("Refunded")).toBeInTheDocument();
  });
});

describe("PaymentListCards (mobile)", () => {
  it("renders every payment's amount, date, and client", () => {
    render(<PaymentListCards rows={rows} />);
    expect(screen.getByText(/Jordan Ellis/)).toBeInTheDocument();
    expect(screen.getByText(/Isabella Cruz/)).toBeInTheDocument();
    expect(screen.getAllByText("$2,500.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$500.00").length).toBeGreaterThan(0);
  });
});
