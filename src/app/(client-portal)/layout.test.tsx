import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/auth/clientAccountSession", () => ({
  resolveClientAccountSessionSnapshot: vi.fn(),
}));
vi.mock("@/lib/auth/actions", () => ({
  signOut: vi.fn(),
}));

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/client-access",
}));

afterEach(() => {
  vi.clearAllMocks();
});

import ClientPortalLayout from "@/app/(client-portal)/layout";
import { resolveClientAccountSessionSnapshot } from "@/lib/auth/clientAccountSession";

describe("ClientPortalLayout", () => {
  it("redirects to /sign-in for an unauthenticated visitor, never rendering children", async () => {
    vi.mocked(resolveClientAccountSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });

    render(
      <ClientPortalLayout>
        <div>Landing content</div>
      </ClientPortalLayout>,
    );

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/sign-in"));
    expect(screen.queryByText("Landing content")).not.toBeInTheDocument();
  });

  it("shows a blocked-access state for no-account, never rendering children or the Client Portal shell", async () => {
    vi.mocked(resolveClientAccountSessionSnapshot).mockResolvedValue({ kind: "no-account" });

    render(
      <ClientPortalLayout>
        <div>Landing content</div>
      </ClientPortalLayout>,
    );

    await waitFor(() => expect(screen.getByText("No Client Portal access")).toBeInTheDocument());
    expect(screen.queryByText("Landing content")).not.toBeInTheDocument();
  });

  it("shows a blocked-access state for a suspended account", async () => {
    vi.mocked(resolveClientAccountSessionSnapshot).mockResolvedValue({ kind: "blocked", status: "suspended" });

    render(
      <ClientPortalLayout>
        <div>Landing content</div>
      </ClientPortalLayout>,
    );

    await waitFor(() => expect(screen.getByText("Account inactive")).toBeInTheDocument());
    expect(screen.getByText(/suspended/)).toBeInTheDocument();
  });

  it("renders children inside the Client Portal shell for an active account", async () => {
    vi.mocked(resolveClientAccountSessionSnapshot).mockResolvedValue({
      kind: "active",
      authUserId: "auth_client_1",
      accountId: "client_account_1",
      clientId: "client_1",
      workspaceId: "ws_amore_bloom",
      email: "naomi.whitfield@example.com",
      clientName: "Naomi Whitfield",
      workspaceName: "Amoré Bloom",
      acceptedAt: "2026-06-01T00:00:00.000Z",
      lastAccessAt: null,
    });

    render(
      <ClientPortalLayout>
        <div>Landing content</div>
      </ClientPortalLayout>,
    );

    await waitFor(() => expect(screen.getByText("Landing content")).toBeInTheDocument());
    expect(screen.getByText("Client Portal")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});
