import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContractListTable } from "@/modules/contracts/components/ContractListTable";
import { ContractListCards } from "@/modules/contracts/components/ContractListCards";
import { makeContract } from "@/modules/contracts/testUtils";
import { makeClient } from "@/modules/clients/testUtils";
import { makeEvent } from "@/modules/events/testUtils";
import type { ContractListRow } from "@/modules/contracts/components/ContractsListView";

const rows: ContractListRow[] = [
  {
    contract: makeContract({
      id: "contract_a",
      contract_number: "CT-2026-0001",
      title: "Malibu Sunset Proposal — Event Services Agreement",
      status: "signed",
      signature_status: "signed",
      version: 2,
      total_value: 8500,
      currency: "USD",
      deposit_required: true,
      deposit_amount: 2500,
      effective_date: "2026-06-10",
    }),
    client: makeClient({ id: "client_a", first_name: "Jordan", last_name: "Ellis" }),
    event: makeEvent({ id: "event_a", title: "Malibu Sunset Proposal" }),
    template: undefined,
    nextAction: "Mark the contract as completed",
  },
  {
    contract: makeContract({
      id: "contract_b",
      contract_number: "CT-2026-0002",
      title: "Sonoma Vineyard Luxury Picnic — Event Services Agreement",
      status: "draft",
      signature_status: "unsigned",
      version: 1,
      total_value: null,
      currency: "USD",
      deposit_required: false,
      deposit_amount: null,
      effective_date: null,
    }),
    client: makeClient({ id: "client_b", first_name: "Isabella", last_name: "Cruz" }),
    event: undefined,
    template: undefined,
    nextAction: "Set the contract value",
  },
];

describe("ContractListTable (desktop)", () => {
  it("renders every contract's number, title, client, event, status, and value", () => {
    render(<ContractListTable rows={rows} />);
    expect(screen.getByText("CT-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("Malibu Sunset Proposal — Event Services Agreement")).toBeInTheDocument();
    expect(screen.getByText("Jordan Ellis")).toBeInTheDocument();
    expect(screen.getByText("Malibu Sunset Proposal")).toBeInTheDocument();
    // "Signed" appears twice for contract_a: the status badge and the signature-status badge.
    expect(screen.getAllByText("Signed")).toHaveLength(2);
    // Version now lives on the detail view only (Relationships/CRM visual pass trimmed
    // the list to 7 columns), so the list no longer renders "v2".
    expect(screen.getByText("$8,500.00")).toBeInTheDocument();

    expect(screen.getByText("CT-2026-0002")).toBeInTheDocument();
    expect(screen.getByText("Isabella Cruz")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });
});

describe("ContractListCards (mobile)", () => {
  it("renders every contract's title, number, client, event, and next action", () => {
    render(<ContractListCards rows={rows} />);
    expect(screen.getByText("Malibu Sunset Proposal — Event Services Agreement")).toBeInTheDocument();
    expect(screen.getByText("CT-2026-0001")).toBeInTheDocument();
    expect(screen.getByText(/Jordan Ellis/)).toBeInTheDocument();
    expect(screen.getByText("Mark the contract as completed")).toBeInTheDocument();

    expect(screen.getByText("Sonoma Vineyard Luxury Picnic — Event Services Agreement")).toBeInTheDocument();
    expect(screen.getByText(/Isabella Cruz/)).toBeInTheDocument();
    expect(screen.getByText("Set the contract value")).toBeInTheDocument();
  });
});
