import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClientSection } from "@/modules/services/components/ClientSection";
import { makeClient } from "@/modules/services/testUtils";

describe("ClientSection", () => {
  it("renders the client's name, email, phone, and links to the full Client record", () => {
    render(<ClientSection client={makeClient({ id: "client_9", first_name: "Amelia", last_name: "Carter", email: "amelia@example.com", phone: "555-0100" })} />);
    expect(screen.getByRole("link", { name: "Amelia Carter" })).toHaveAttribute("href", "/clients/client_9");
    expect(screen.getByText("amelia@example.com")).toBeInTheDocument();
    expect(screen.getByText("555-0100")).toBeInTheDocument();
  });

  it("shows a dash for a missing phone rather than blank space", () => {
    render(<ClientSection client={makeClient({ phone: null })} />);
    expect(screen.getByText("Phone").nextElementSibling).toHaveTextContent("—");
  });
});
