import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/lib/auth/actions", () => ({
  signOut: vi.fn(),
}));

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { ClientPortalAccountView } from "@/modules/clientPortal/components/ClientPortalAccountView";
import { ClientAccountSessionProvider } from "@/components/providers/ClientAccountSessionProvider";
import { signOut } from "@/lib/auth/actions";

const SESSION_SEED = {
  authUserId: "auth_client_1",
  accountId: "client_account_1",
  clientId: "client_1",
  workspaceId: "ws_amore_bloom",
  email: "naomi.whitfield@example.com",
  clientName: "Naomi Whitfield",
  workspaceName: "Amoré Bloom",
  acceptedAt: "2026-06-01T00:00:00.000Z",
  lastAccessAt: "2026-07-10T00:00:00.000Z",
};

function renderAccount() {
  return render(
    <ClientAccountSessionProvider value={SESSION_SEED}>
      <ClientPortalAccountView />
    </ClientAccountSessionProvider>,
  );
}

describe("ClientPortalAccountView", () => {
  it("renders display name, email, status, dates, and Workspace name", () => {
    renderAccount();
    expect(screen.getByText("Naomi Whitfield")).toBeInTheDocument();
    expect(screen.getByText("naomi.whitfield@example.com")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText("Amoré Bloom")).toBeInTheDocument();
  });

  it("never renders billing, MFA, or account-deletion controls", () => {
    renderAccount();
    expect(screen.queryByText(/billing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/multi-factor|MFA/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete account/i })).not.toBeInTheDocument();
  });

  it("signs out and redirects to /sign-in on Sign out", async () => {
    vi.mocked(signOut).mockResolvedValue({ success: true } as never);
    renderAccount();
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(pushMock).toHaveBeenCalledWith("/sign-in");
  });
});
