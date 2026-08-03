import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/auth/actions", () => ({
  signOut: vi.fn(),
}));

import { AccountView } from "@/modules/account/components/AccountView";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import { signOut } from "@/lib/auth/actions";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

const ownerSnapshot: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_amore_bloom", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["workspace.view"],
  workspaceDisplayName: "Amoré Bloom",
};

afterEach(() => {
  vi.clearAllMocks();
});

function renderAccount(snapshot: MemberSessionSnapshot) {
  return render(
    <MemberSessionProvider snapshot={snapshot}>
      <AccountView />
    </MemberSessionProvider>,
  );
}

describe("AccountView", () => {
  it("displays name, email, role, membership status, and Workspace name", () => {
    renderAccount(ownerSnapshot);

    expect(screen.getByText("Amoré Bloom Owner")).toBeInTheDocument();
    expect(screen.getByText("owner@amorebloom.com")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getAllByText("Amoré Bloom").length).toBeGreaterThan(0);
  });

  it("links to the existing change-password flow", () => {
    renderAccount(ownerSnapshot);

    expect(screen.getByRole("link", { name: "Change password" })).toHaveAttribute("href", "/update-password");
  });

  it("navigates to /sign-in after a successful sign-out (mock mode)", async () => {
    vi.mocked(signOut).mockResolvedValue({ success: true });
    renderAccount(ownerSnapshot);

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/sign-in"));
  });

  it("shows a suspended member's status without crashing", () => {
    renderAccount({
      kind: "inactive",
      user: { id: "user_4", email: "sofia@amorebloom.com" },
      profile: { full_name: "Sofia Lima", avatar_url: null },
      workspace: { id: "ws_amore_bloom", name: "Amoré Bloom" },
      membership: { id: "member_4", role: "staff", status: "suspended", created_at: "2026-04-01T00:00:00Z" },
      workspaceDisplayName: "Amoré Bloom Team",
    });

    expect(screen.getByText("Sofia Lima")).toBeInTheDocument();
    expect(screen.getByText("Suspended")).toBeInTheDocument();
  });
});
