import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/data", () => ({
  updateClientLastAccess: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { ClientAccessLandingView } from "@/modules/clientAccess/components/ClientAccessLandingView";
import { updateClientLastAccess } from "@/lib/data";
import { ClientAccountSessionProvider } from "@/components/providers/ClientAccountSessionProvider";

function renderLanding() {
  return render(
    <ClientAccountSessionProvider
      value={{ accountId: "client_account_1", clientName: "Naomi Whitfield", workspaceName: "Amoré Bloom", lastAccessAt: null }}
    >
      <ClientAccessLandingView />
    </ClientAccountSessionProvider>,
  );
}

describe("ClientAccessLandingView", () => {
  it("renders a welcome message with the client's name and Workspace name", () => {
    renderLanding();
    expect(screen.getByText(/Welcome, Naomi Whitfield/)).toBeInTheDocument();
    expect(screen.getByText(/Amoré Bloom Client Portal/)).toBeInTheDocument();
  });

  it("shows the account status and placeholder sections, never real business data", () => {
    renderLanding();
    expect(screen.getByText("Account status")).toBeInTheDocument();
    for (const section of ["Events", "Contracts", "Invoices", "Documents"]) {
      expect(screen.getByText(section)).toBeInTheDocument();
    }
  });

  it("touches last access once on mount", () => {
    renderLanding();
    expect(updateClientLastAccess).toHaveBeenCalledWith("client_account_1");
    expect(updateClientLastAccess).toHaveBeenCalledTimes(1);
  });
});
