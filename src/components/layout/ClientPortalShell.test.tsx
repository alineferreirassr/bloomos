import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/lib/auth/actions", () => ({
  signOut: vi.fn(),
}));

let currentPathname = "/client-access";
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => currentPathname,
}));

afterEach(() => {
  vi.clearAllMocks();
  currentPathname = "/client-access";
});

import { ClientPortalShell } from "@/components/layout/ClientPortalShell";

describe("ClientPortalShell", () => {
  it("renders Client Portal branding and every nav item, never internal Team Portal navigation", () => {
    render(
      <ClientPortalShell>
        <div>Page content</div>
      </ClientPortalShell>,
    );

    expect(screen.getByText("Client Portal")).toBeInTheDocument();
    for (const label of ["Overview", "Events", "Contracts", "Invoices", "Documents", "Account"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Leads")).not.toBeInTheDocument();
    expect(screen.queryByText("Team")).not.toBeInTheDocument();
  });

  it("highlights the active route", () => {
    currentPathname = "/client-access/events";
    render(
      <ClientPortalShell>
        <div>Page content</div>
      </ClientPortalShell>,
    );

    const eventsLinks = screen.getAllByRole("link", { name: "Events" });
    expect(eventsLinks[0].className).toMatch(/text-accent/);
  });

  it("opens and closes the mobile navigation menu", () => {
    render(
      <ClientPortalShell>
        <div>Page content</div>
      </ClientPortalShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    expect(screen.getByRole("button", { name: "Close navigation menu" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close navigation menu" }));
    expect(screen.queryByRole("button", { name: "Close navigation menu" })).not.toBeInTheDocument();
  });

  it("renders the page content passed as children", () => {
    render(
      <ClientPortalShell>
        <div>Unique page content marker</div>
      </ClientPortalShell>,
    );
    expect(screen.getByText("Unique page content marker")).toBeInTheDocument();
  });
});
