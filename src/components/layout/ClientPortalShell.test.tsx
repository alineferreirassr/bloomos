import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/lib/auth/actions", () => ({
  signOut: vi.fn(),
}));

// Checkpoint 19 — `/client-access` itself (only) now renders bare, its own
// full-page Luxury Client Dashboard shell taking over entirely (see
// `LUXURY_CLIENT_SHELL_ROUTES` in ClientPortalShell.tsx). Every test below
// that exercises this Classical top-nav chrome uses a sibling route
// instead — the exact same route this file's own "highlights the active
// route" test already used before this checkpoint.
let currentPathname = "/client-access/events";
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => currentPathname,
}));

afterEach(() => {
  vi.clearAllMocks();
  currentPathname = "/client-access/events";
});

import { ClientPortalShell } from "@/components/layout/ClientPortalShell";

describe("ClientPortalShell", () => {
  it("renders bare (no Classical chrome) for /client-access — the Luxury Client Dashboard owns that route's own shell", () => {
    currentPathname = "/client-access";
    render(
      <ClientPortalShell>
        <div>Luxury dashboard content</div>
      </ClientPortalShell>,
    );

    expect(screen.getByText("Luxury dashboard content")).toBeInTheDocument();
    expect(screen.queryByText("Client Portal")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open navigation menu" })).not.toBeInTheDocument();
  });

  it("renders Client Portal branding and every nav item, never internal Team Portal navigation", () => {
    render(
      <ClientPortalShell>
        <div>Page content</div>
      </ClientPortalShell>,
    );

    expect(screen.getByText("Client Portal")).toBeInTheDocument();
    for (const label of ["Overview", "My Events", "My Contracts", "My Invoices", "My Documents", "Account"]) {
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

    const eventsLinks = screen.getAllByRole("link", { name: "My Events" });
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
