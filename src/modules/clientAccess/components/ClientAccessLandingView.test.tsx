import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/data", () => ({
  updateClientLastAccess: vi.fn(),
  getClientPortalOverview: vi.fn(),
}));
vi.mock("@/lib/auth/actions", () => ({
  signOut: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { ClientAccessLandingView } from "@/modules/clientAccess/components/ClientAccessLandingView";
import { updateClientLastAccess, getClientPortalOverview } from "@/lib/data";
import { ClientAccountSessionProvider } from "@/components/providers/ClientAccountSessionProvider";

const SESSION_SEED = {
  authUserId: "auth_client_1",
  accountId: "client_account_1",
  clientId: "client_1",
  workspaceId: "ws_amore_bloom",
  email: "naomi.whitfield@example.com",
  clientName: "Naomi Whitfield",
  workspaceName: "Amoré Bloom",
  acceptedAt: "2026-06-01T00:00:00.000Z",
  lastAccessAt: null,
};

const EMPTY_OVERVIEW = {
  clientName: "Naomi Whitfield",
  upcomingEvent: null,
  contractsInProgress: 0,
  totalOutstandingBalanceMinor: 0,
  currency: "USD",
  nextPaymentDue: null,
  recentDocuments: [],
  nextRecommendedAction: null,
};

function renderLanding() {
  return render(
    <ClientAccountSessionProvider value={SESSION_SEED}>
      <ClientAccessLandingView />
    </ClientAccountSessionProvider>,
  );
}

describe("ClientAccessLandingView", () => {
  it("renders a welcome message with the client's name and Workspace name", async () => {
    vi.mocked(getClientPortalOverview).mockResolvedValue(EMPTY_OVERVIEW as never);
    renderLanding();
    expect(screen.getByText(/Welcome, Naomi Whitfield/)).toBeInTheDocument();
    expect(screen.getByText(/Amoré Bloom Client Portal/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Account status")).toBeInTheDocument());
  });

  it("shows an upcoming event card only when one exists", async () => {
    vi.mocked(getClientPortalOverview).mockResolvedValue({
      ...EMPTY_OVERVIEW,
      upcomingEvent: { id: "event_1", title: "Beach Proposal", event_date: "2099-01-01" },
    } as never);
    renderLanding();
    await waitFor(() => expect(screen.getByText("Beach Proposal")).toBeInTheDocument());
  });

  it("shows nothing-to-show state when every card would be empty", async () => {
    vi.mocked(getClientPortalOverview).mockResolvedValue(EMPTY_OVERVIEW as never);
    renderLanding();
    await waitFor(() => expect(screen.getByText(/Nothing to show yet/)).toBeInTheDocument());
  });

  it("touches last access once on mount", async () => {
    vi.mocked(getClientPortalOverview).mockResolvedValue(EMPTY_OVERVIEW as never);
    renderLanding();
    await waitFor(() => expect(getClientPortalOverview).toHaveBeenCalled());
    expect(updateClientLastAccess).toHaveBeenCalledWith("client_account_1");
    expect(updateClientLastAccess).toHaveBeenCalledTimes(1);
  });

  it("shows an error state with retry when the overview fails to load", async () => {
    vi.mocked(getClientPortalOverview).mockRejectedValue(new Error("boom"));
    renderLanding();
    await waitFor(() => expect(screen.getByText("Could not load your overview.")).toBeInTheDocument());
  });
});
