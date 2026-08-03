import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/data", () => ({
  getClientAccountsByClientId: vi.fn(),
  getClientPortalActivityForAccount: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { ClientPortalActivitySection } from "@/modules/clients/components/ClientPortalActivitySection";
import { getClientAccountsByClientId, getClientPortalActivityForAccount } from "@/lib/data";
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

describe("ClientPortalActivitySection", () => {
  it("renders activity for a member with client_portal.view", async () => {
    vi.mocked(getClientAccountsByClientId).mockResolvedValue([{ id: "acct_1", workspace_id: "ws_1", client_id: "client_1", status: "active" } as never]);
    vi.mocked(getClientPortalActivityForAccount).mockResolvedValue([
      { id: "act_1", workspace_id: "ws_1", client_account_id: "acct_1", kind: "login", entity_id: null, entity_label: null, occurred_at: "2026-01-05T00:00:00.000Z" },
    ] as never);

    render(
      <MemberSessionProvider snapshot={snapshotWithPermissions(["client_portal.view"])}>
        <ClientPortalActivitySection clientId="client_1" />
      </MemberSessionProvider>,
    );

    await waitFor(() => expect(screen.getByText("Logged in")).toBeInTheDocument());
    expect(screen.getByText("Client Portal Activity")).toBeInTheDocument();
  });

  it("never fetches or renders for a member without client_portal.view", () => {
    render(
      <MemberSessionProvider snapshot={snapshotWithPermissions([])}>
        <ClientPortalActivitySection clientId="client_1" />
      </MemberSessionProvider>,
    );

    expect(getClientAccountsByClientId).not.toHaveBeenCalled();
    expect(screen.queryByText("Client Portal Activity")).not.toBeInTheDocument();
  });

  it("shows an empty state when the client has no portal account yet", async () => {
    vi.mocked(getClientAccountsByClientId).mockResolvedValue([]);

    render(
      <MemberSessionProvider snapshot={snapshotWithPermissions(["client_portal.view"])}>
        <ClientPortalActivitySection clientId="client_1" />
      </MemberSessionProvider>,
    );

    await waitFor(() => expect(screen.getByText("No Client Portal activity yet.")).toBeInTheDocument());
    expect(getClientPortalActivityForAccount).not.toHaveBeenCalled();
  });

  it("shows an error state on failure", async () => {
    vi.mocked(getClientAccountsByClientId).mockRejectedValue(new Error("boom"));

    render(
      <MemberSessionProvider snapshot={snapshotWithPermissions(["client_portal.view"])}>
        <ClientPortalActivitySection clientId="client_1" />
      </MemberSessionProvider>,
    );

    await waitFor(() => expect(screen.getByText("Could not load Client Portal activity.")).toBeInTheDocument());
  });
});
