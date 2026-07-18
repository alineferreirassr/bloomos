import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/data", () => ({
  getWorkspaceInvitations: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { PendingInvitationsCard } from "@/modules/dashboard/components/PendingInvitationsCard";
import { getWorkspaceInvitations } from "@/lib/data";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

function snapshotWithPermissions(permissions: string[]): MemberSessionSnapshot {
  return {
    kind: "active",
    user: { id: "user_1", email: "owner@amorebloom.com" },
    profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
    workspace: { id: "ws_amore_bloom", name: "Amoré Bloom" },
    membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
    permissions: permissions as never,
    workspaceDisplayName: "Amoré Bloom",
  };
}

describe("PendingInvitationsCard", () => {
  it("renders the pending count for a member with team.invite", async () => {
    vi.mocked(getWorkspaceInvitations).mockResolvedValue([
      { id: "inv_1" } as never,
      { id: "inv_2" } as never,
    ]);

    render(
      <MemberSessionProvider snapshot={snapshotWithPermissions(["team.view", "team.invite"])}>
        <PendingInvitationsCard />
      </MemberSessionProvider>,
    );

    await waitFor(() => expect(screen.getByText("2")).toBeInTheDocument());
    expect(screen.getByText("Pending Team Invitations")).toBeInTheDocument();
  });

  it("never fetches or renders for a member without team.invite, even with team.view", () => {
    render(
      <MemberSessionProvider snapshot={snapshotWithPermissions(["team.view"])}>
        <PendingInvitationsCard />
      </MemberSessionProvider>,
    );

    expect(getWorkspaceInvitations).not.toHaveBeenCalled();
    expect(screen.queryByText("Pending Team Invitations")).not.toBeInTheDocument();
  });
});
