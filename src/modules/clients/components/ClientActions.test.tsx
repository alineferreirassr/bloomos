import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClientActions } from "@/modules/clients/components/ClientActions";
import { makeClient } from "@/modules/clients/testUtils";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/data", () => ({
  archiveClient: vi.fn(),
  restoreClient: vi.fn(),
  setClientVipStatus: vi.fn(),
  updateClientStatus: vi.fn(),
  updateClientContactPreference: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

const fullPermissionSnapshot: Extract<MemberSessionSnapshot, { kind: "active" }> = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_amore_bloom", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["clients.view", "clients.create", "clients.update", "clients.archive"],
  workspaceDisplayName: "Amoré Bloom",
};

function renderClientActions(props: Parameters<typeof ClientActions>[0], permissions = fullPermissionSnapshot.permissions) {
  return render(
    <MemberSessionProvider snapshot={{ ...fullPermissionSnapshot, permissions }}>
      <ClientActions {...props} />
    </MemberSessionProvider>,
  );
}

describe("ClientActions — VIP toggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("optimistically flips the button label and calls setClientVipStatus", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.setClientVipStatus).mockResolvedValue({
      success: true,
      data: makeClient({ is_vip: true }),
    });
    const onChanged = vi.fn();

    renderClientActions({ client: makeClient({ id: "client_1", is_vip: false }), onChanged });

    await user.click(screen.getByRole("button", { name: /mark as vip/i }));

    expect(screen.getByRole("button", { name: /remove vip/i })).toBeInTheDocument();
    await waitFor(() => expect(dataLayer.setClientVipStatus).toHaveBeenCalledWith("client_1", true));
    expect(onChanged).toHaveBeenCalled();
  });

  it("rolls back the optimistic update if the mutation fails", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.setClientVipStatus).mockResolvedValue({
      success: false,
      error: "Client not found.",
    });
    const onChanged = vi.fn();

    renderClientActions({ client: makeClient({ id: "client_1", is_vip: false }), onChanged });

    await user.click(screen.getByRole("button", { name: /mark as vip/i }));

    await screen.findByText(/client not found/i);
    expect(screen.getByRole("button", { name: /mark as vip/i })).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });
});

describe("ClientActions — archive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls archiveClient and reports the change", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.archiveClient).mockResolvedValue({
      success: true,
      data: makeClient({ internal_status: "archived", archived_at: "2026-01-01T00:00:00.000Z" }),
    });
    const onChanged = vi.fn();

    renderClientActions({ client: makeClient({ id: "client_1" }), onChanged });

    await user.click(screen.getByRole("button", { name: /^archive$/i }));

    await waitFor(() => expect(dataLayer.archiveClient).toHaveBeenCalledWith("client_1"));
    expect(onChanged).toHaveBeenCalled();
  });
});

describe("ClientActions — restore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls restoreClient and reports the change", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.restoreClient).mockResolvedValue({
      success: true,
      data: makeClient({ id: "client_1", internal_status: "active", archived_at: null }),
    });
    const onChanged = vi.fn();

    renderClientActions({
      client: makeClient({ id: "client_1", internal_status: "archived", archived_at: "2026-01-01T00:00:00.000Z" }),
      onChanged,
    });

    await user.click(screen.getByRole("button", { name: /restore/i }));

    await waitFor(() => expect(dataLayer.restoreClient).toHaveBeenCalledWith("client_1"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("does not show Edit or VIP toggle for an archived client", () => {
    renderClientActions({
      client: makeClient({ internal_status: "archived", archived_at: "2026-01-01T00:00:00.000Z" }),
      onChanged: vi.fn(),
    });

    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mark as vip/i })).not.toBeInTheDocument();
  });

  it("hides Edit, VIP, and the status/contact selects for a member without clients.update, while still allowing archive", () => {
    renderClientActions({ client: makeClient({ id: "client_1" }), onChanged: vi.fn() }, ["clients.view", "clients.archive"]);

    expect(screen.queryByRole("link", { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mark as vip/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^archive$/i })).toBeInTheDocument();
  });

  it("hides Archive for a member without clients.archive, while still allowing Edit", () => {
    renderClientActions({ client: makeClient({ id: "client_1" }), onChanged: vi.fn() }, ["clients.view", "clients.update"]);

    expect(screen.getByRole("link", { name: /edit/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^archive$/i })).not.toBeInTheDocument();
  });
});
