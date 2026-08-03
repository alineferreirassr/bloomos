import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContractsListView } from "@/modules/contracts/components/ContractsListView";
import { makeContract, makeContractTemplate } from "@/modules/contracts/testUtils";
import { makeClient } from "@/modules/clients/testUtils";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

const fullPermissionSnapshot: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_amore_bloom", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["contracts.view", "contracts.create", "contracts.update", "contracts.lifecycle"],
  workspaceDisplayName: "Amoré Bloom",
};

function renderContractsListView() {
  return render(
    <MemberSessionProvider snapshot={fullPermissionSnapshot}>
      <ContractsListView />
    </MemberSessionProvider>,
  );
}

vi.mock("@/lib/data", () => ({
  getContracts: vi.fn(),
  getClients: vi.fn(),
  getEvents: vi.fn(),
  getContractTemplates: vi.fn(),
  getContractNextAction: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

function mockCommon() {
  vi.mocked(dataLayer.getClients).mockResolvedValue([
    makeClient({ id: "client_1", first_name: "Jordan", last_name: "Ellis" }),
  ]);
  vi.mocked(dataLayer.getEvents).mockResolvedValue([]);
  vi.mocked(dataLayer.getContractTemplates).mockResolvedValue([makeContractTemplate({ id: "template_1" })]);
  vi.mocked(dataLayer.getContractNextAction).mockResolvedValue(null);
}

describe("ContractsListView", () => {
  it("renders contracts sorted by updated date, newest first, by default", async () => {
    mockCommon();
    vi.mocked(dataLayer.getContracts).mockResolvedValue([
      makeContract({ id: "c_old", title: "Older Contract", client_id: "client_1", updated_at: "2026-01-01T00:00:00.000Z" }),
      makeContract({ id: "c_new", title: "Newer Contract", client_id: "client_1", updated_at: "2026-06-01T00:00:00.000Z" }),
    ]);

    renderContractsListView();

    const titles = await screen.findAllByText(/^(Newer|Older) Contract$/);
    expect(titles[0]).toHaveTextContent("Newer Contract");
  });

  it("re-fetches with the entered search text", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(dataLayer.getContracts).mockResolvedValue([]);

    renderContractsListView();
    await waitFor(() => expect(dataLayer.getContracts).toHaveBeenCalled());

    await user.type(screen.getByLabelText(/search contracts/i), "malibu");

    await waitFor(() =>
      expect(dataLayer.getContracts).toHaveBeenLastCalledWith(expect.objectContaining({ search: "malibu" })),
    );
  });

  it("re-fetches with the selected status filter", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(dataLayer.getContracts).mockResolvedValue([]);

    renderContractsListView();
    await waitFor(() => expect(dataLayer.getContracts).toHaveBeenCalled());

    await user.selectOptions(screen.getByLabelText(/filter by status/i), "signed");

    await waitFor(() =>
      expect(dataLayer.getContracts).toHaveBeenLastCalledWith(expect.objectContaining({ status: "signed" })),
    );
  });

  it("shows an empty state when no contracts match", async () => {
    mockCommon();
    vi.mocked(dataLayer.getContracts).mockResolvedValue([]);

    renderContractsListView();

    expect(await screen.findByText(/no contracts yet/i)).toBeInTheDocument();
  });

  it("shows an error state and allows retrying", async () => {
    mockCommon();
    vi.mocked(dataLayer.getContracts).mockRejectedValue(new Error("boom"));

    renderContractsListView();

    expect(await screen.findByText(/could not load contracts/i)).toBeInTheDocument();
  });
});
