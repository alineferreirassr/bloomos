import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { InvoiceListTable } from "@/modules/finance/components/InvoiceListTable";
import { InvoiceListCards } from "@/modules/finance/components/InvoiceListCards";
import { makeInvoice } from "@/modules/finance/testUtils";
import { makeClient } from "@/modules/clients/testUtils";
import { makeEvent } from "@/modules/events/testUtils";
import type { InvoiceListRow } from "@/modules/finance/components/InvoicesListView";

const rows: InvoiceListRow[] = [
  {
    invoice: makeInvoice({
      id: "invoice_a",
      invoice_number: "INV-2026-0001",
      title: "Malibu Sunset Proposal — Deposit Invoice",
      status: "sent",
      total_minor: 250000,
      paid_minor: 0,
      balance_minor: 250000,
      issue_date: "2026-06-01",
      due_date: "2026-06-15",
    }),
    client: makeClient({ id: "client_a", first_name: "Jordan", last_name: "Ellis" }),
    event: makeEvent({ id: "event_a", title: "Malibu Sunset Proposal" }),
    contract: undefined,
    nextAction: "Follow up on the outstanding balance",
  },
  {
    invoice: makeInvoice({
      id: "invoice_b",
      invoice_number: "INV-2026-0002",
      title: "Sonoma Vineyard Picnic — Final Invoice",
      status: "paid",
      total_minor: 500000,
      paid_minor: 500000,
      balance_minor: 0,
      issue_date: "2026-05-01",
      due_date: "2026-05-15",
    }),
    client: makeClient({ id: "client_b", first_name: "Isabella", last_name: "Cruz" }),
    event: undefined,
    contract: undefined,
    nextAction: null,
  },
];

describe("InvoiceListTable (desktop)", () => {
  it("renders every invoice's number, client, event, status, and amounts", () => {
    render(<InvoiceListTable rows={rows} />);
    expect(screen.getByText("INV-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("Jordan Ellis")).toBeInTheDocument();
    expect(screen.getByText("Malibu Sunset Proposal")).toBeInTheDocument();
    expect(screen.getByText("Sent")).toBeInTheDocument();
    expect(screen.getAllByText("$2,500.00").length).toBeGreaterThan(0);
    expect(screen.getByText("Follow up on the outstanding balance")).toBeInTheDocument();

    expect(screen.getByText("INV-2026-0002")).toBeInTheDocument();
    expect(screen.getByText("Isabella Cruz")).toBeInTheDocument();
    expect(screen.getAllByText("Paid").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$5,000.00").length).toBeGreaterThan(0);
  });
});

describe("InvoiceListCards (mobile)", () => {
  it("renders every invoice's title, number, client, balance, and next action", () => {
    render(<InvoiceListCards rows={rows} />);
    expect(screen.getByText("Malibu Sunset Proposal — Deposit Invoice")).toBeInTheDocument();
    expect(screen.getByText("INV-2026-0001")).toBeInTheDocument();
    expect(screen.getByText(/Jordan Ellis/)).toBeInTheDocument();
    expect(screen.getByText("$2,500.00 due")).toBeInTheDocument();
    expect(screen.getByText("Follow up on the outstanding balance")).toBeInTheDocument();

    expect(screen.getByText("Sonoma Vineyard Picnic — Final Invoice")).toBeInTheDocument();
    expect(screen.getByText("$0.00 due")).toBeInTheDocument();
  });
});
