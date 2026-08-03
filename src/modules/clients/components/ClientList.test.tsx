import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClientListTable } from "@/modules/clients/components/ClientListTable";
import { ClientListCards } from "@/modules/clients/components/ClientListCards";
import { makeClient } from "@/modules/clients/testUtils";

const clients = [
  makeClient({ id: "client_a", first_name: "Naomi", last_name: "Whitfield", is_vip: true, tags: ["vip"] }),
  makeClient({ id: "client_b", first_name: "Priya", last_name: "Nair", internal_status: "planning" }),
];

const nextActionByClientId = {
  client_a: null,
  client_b: "Add a note for this client",
};

describe("ClientListTable (desktop)", () => {
  it("renders every client's name, status, VIP badge, and next action", () => {
    render(<ClientListTable clients={clients} nextActionByClientId={nextActionByClientId} />);
    expect(screen.getByText("Naomi Whitfield")).toBeInTheDocument();
    expect(screen.getByText("Priya Nair")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Planning")).toBeInTheDocument();
    // "VIP" appears both as the column header and as client_a's badge.
    expect(screen.getAllByText("VIP")).toHaveLength(2);
    expect(screen.getByText("Add a note for this client")).toBeInTheDocument();
  });
});

describe("ClientListCards (mobile)", () => {
  it("renders every client's name and status", () => {
    render(<ClientListCards clients={clients} nextActionByClientId={nextActionByClientId} />);
    expect(screen.getByText("Naomi Whitfield")).toBeInTheDocument();
    expect(screen.getByText("Priya Nair")).toBeInTheDocument();
    expect(screen.getByText("Add a note for this client")).toBeInTheDocument();
  });
});
