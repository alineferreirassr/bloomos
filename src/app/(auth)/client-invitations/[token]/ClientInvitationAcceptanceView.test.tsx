import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/data", () => ({
  getClientInvitationByToken: vi.fn(),
  acceptClientInvitation: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/auth/actions", () => ({
  signUpWithPassword: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { ClientInvitationAcceptanceView } from "@/app/(auth)/client-invitations/[token]/ClientInvitationAcceptanceView";
import { getClientInvitationByToken } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";

function mockAuthUser(user: { id: string } | null) {
  vi.mocked(createClient).mockReturnValue({
    auth: { getUser: async () => ({ data: { user } }) },
  } as never);
}

const PREVIEW = {
  workspace_name: "Amoré Bloom",
  client_name: "Naomi Whitfield",
  email: "naomi.whitfield@example.com",
  status: "pending" as const,
  expires_at: "2099-01-01T00:00:00.000Z",
};

describe("ClientInvitationAcceptanceView", () => {
  it("shows an invalid-invitation message for an unknown token", async () => {
    vi.mocked(getClientInvitationByToken).mockResolvedValue(null);
    mockAuthUser(null);

    render(<ClientInvitationAcceptanceView token="bad-token" />);

    await waitFor(() => expect(screen.getByText("Invalid invitation")).toBeInTheDocument());
  });

  it("shows a revoked message for a revoked invitation", async () => {
    vi.mocked(getClientInvitationByToken).mockResolvedValue({ ...PREVIEW, status: "revoked" });
    mockAuthUser(null);

    render(<ClientInvitationAcceptanceView token="revoked-token" />);

    await waitFor(() => expect(screen.getByText("This invitation has been revoked.")).toBeInTheDocument());
  });

  it("shows an expired message for an expired invitation", async () => {
    vi.mocked(getClientInvitationByToken).mockResolvedValue({ ...PREVIEW, status: "expired" });
    mockAuthUser(null);

    render(<ClientInvitationAcceptanceView token="expired-token" />);

    await waitFor(() => expect(screen.getByText("This invitation has expired.")).toBeInTheDocument());
  });

  it("shows an already-accepted message for an accepted invitation", async () => {
    vi.mocked(getClientInvitationByToken).mockResolvedValue({ ...PREVIEW, status: "accepted" });
    mockAuthUser(null);

    render(<ClientInvitationAcceptanceView token="accepted-token" />);

    await waitFor(() => expect(screen.getByText("This invitation has already been accepted.")).toBeInTheDocument());
  });

  it("shows the Client name and an Accept button for an authenticated visitor with a valid pending invitation", async () => {
    vi.mocked(getClientInvitationByToken).mockResolvedValue(PREVIEW);
    mockAuthUser({ id: "auth_1" });

    render(<ClientInvitationAcceptanceView token="good-token" />);

    await waitFor(() => expect(screen.getByText(/Naomi Whitfield/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Accept Invitation" })).toBeInTheDocument();
  });

  it("shows sign-up/sign-in choices for an unauthenticated visitor with a valid pending invitation", async () => {
    vi.mocked(getClientInvitationByToken).mockResolvedValue(PREVIEW);
    mockAuthUser(null);

    render(<ClientInvitationAcceptanceView token="good-token" />);

    await waitFor(() => expect(screen.getByText("Create your account")).toBeInTheDocument());
    expect(screen.getByText("Already have an account? Sign in")).toBeInTheDocument();
  });
});
