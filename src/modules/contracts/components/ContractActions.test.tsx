import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContractActions } from "@/modules/contracts/components/ContractActions";
import { makeContract } from "@/modules/contracts/testUtils";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

const fullPermissionSnapshot: Extract<MemberSessionSnapshot, { kind: "active" }> = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_amore_bloom", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["contracts.view", "contracts.create", "contracts.update", "contracts.lifecycle"],
  workspaceDisplayName: "Amoré Bloom",
};

function renderContractActions(props: Parameters<typeof ContractActions>[0], permissions = fullPermissionSnapshot.permissions) {
  return render(
    <MemberSessionProvider snapshot={{ ...fullPermissionSnapshot, permissions }}>
      <ContractActions {...props} />
    </MemberSessionProvider>,
  );
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/data", () => ({
  archiveContract: vi.fn(),
  cancelContract: vi.fn(),
  completeContract: vi.fn(),
  duplicateContract: vi.fn(),
  expireContract: vi.fn(),
  markDeclined: vi.fn(),
  markSigned: vi.fn(),
  markViewed: vi.fn(),
  restoreContract: vi.fn(),
  sendContract: vi.fn(),
  updateContractStatus: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("ContractActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Edit, Send, Cancel, Archive, Duplicate, and the status select for a draft contract", () => {
    renderContractActions({ contract: makeContract({ status: "draft" }), onChanged: vi.fn() });

    expect(screen.getByRole("link", { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send contract/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel contract/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^archive$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^duplicate$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/contract status/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mark viewed/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mark signed/i })).not.toBeInTheDocument();
  });

  it("shows Mark Viewed, Mark Signed, Mark Declined, and Expire for a sent contract, and hides the status select", () => {
    renderContractActions({ contract: makeContract({ status: "sent" }), onChanged: vi.fn() });

    expect(screen.getByRole("button", { name: /mark viewed/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mark signed/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mark declined/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^expire$/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/contract status/i)).not.toBeInTheDocument();
  });

  it("shows Complete only for a signed contract", () => {
    renderContractActions({ contract: makeContract({ status: "signed" }), onChanged: vi.fn() });
    expect(screen.getByRole("button", { name: /^complete$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mark viewed/i })).not.toBeInTheDocument();
  });

  it("shows only Restore and Duplicate for an archived contract", () => {
    renderContractActions({ contract: makeContract({ status: "archived" }), onChanged: vi.fn() });
    expect(screen.getByRole("button", { name: /restore/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^duplicate$/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^archive$/i })).not.toBeInTheDocument();
  });

  it("hides Cancel for a completed contract but still allows Archive", () => {
    renderContractActions({ contract: makeContract({ status: "completed" }), onChanged: vi.fn() });
    expect(screen.queryByRole("button", { name: /cancel contract/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^archive$/i })).toBeInTheDocument();
  });

  it("sends the contract through a confirmation modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.sendContract).mockResolvedValue({ success: true, data: makeContract({ status: "sent" }) });
    const onChanged = vi.fn();
    renderContractActions({ contract: makeContract({ id: "contract_1", status: "ready" }), onChanged: onChanged });

    await user.click(screen.getByRole("button", { name: /send contract/i }));
    const dialog = screen.getByRole("dialog", { name: /send contract/i });
    await user.click(within(dialog).getByRole("button", { name: /^send$/i }));

    await waitFor(() => expect(dataLayer.sendContract).toHaveBeenCalledWith("contract_1"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("marks viewed directly, without a confirmation modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.markViewed).mockResolvedValue({ success: true, data: makeContract({ status: "viewed" }) });
    const onChanged = vi.fn();
    renderContractActions({ contract: makeContract({ id: "contract_1", status: "sent" }), onChanged: onChanged });

    await user.click(screen.getByRole("button", { name: /mark viewed/i }));

    await waitFor(() => expect(dataLayer.markViewed).toHaveBeenCalledWith("contract_1"));
    expect(onChanged).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("marks signed through a confirmation modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.markSigned).mockResolvedValue({ success: true, data: makeContract({ status: "signed" }) });
    const onChanged = vi.fn();
    renderContractActions({ contract: makeContract({ id: "contract_1", status: "viewed" }), onChanged: onChanged });

    await user.click(screen.getByRole("button", { name: /mark signed/i }));
    const dialog = screen.getByRole("dialog", { name: /mark signed/i });
    await user.click(within(dialog).getByRole("button", { name: /mark signed/i }));

    await waitFor(() => expect(dataLayer.markSigned).toHaveBeenCalledWith("contract_1"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("declines through a confirmation modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.markDeclined).mockResolvedValue({ success: true, data: makeContract({ status: "declined" }) });
    const onChanged = vi.fn();
    renderContractActions({ contract: makeContract({ id: "contract_1", status: "sent" }), onChanged: onChanged });

    await user.click(screen.getByRole("button", { name: /mark declined/i }));
    const dialog = screen.getByRole("dialog", { name: /mark declined/i });
    await user.click(within(dialog).getByRole("button", { name: /mark declined/i }));

    await waitFor(() => expect(dataLayer.markDeclined).toHaveBeenCalledWith("contract_1"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("expires through a confirmation modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.expireContract).mockResolvedValue({ success: true, data: makeContract({ status: "expired" }) });
    const onChanged = vi.fn();
    renderContractActions({ contract: makeContract({ id: "contract_1", status: "sent" }), onChanged: onChanged });

    await user.click(screen.getByRole("button", { name: /^expire$/i }));
    const dialog = screen.getByRole("dialog", { name: /expire contract/i });
    await user.click(within(dialog).getByRole("button", { name: /^expire$/i }));

    await waitFor(() => expect(dataLayer.expireContract).toHaveBeenCalledWith("contract_1"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("cancels through a confirmation modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.cancelContract).mockResolvedValue({ success: true, data: makeContract({ status: "cancelled" }) });
    const onChanged = vi.fn();
    renderContractActions({ contract: makeContract({ id: "contract_1", status: "draft" }), onChanged: onChanged });

    await user.click(screen.getByRole("button", { name: /cancel contract/i }));
    const dialog = screen.getByRole("dialog", { name: /cancel contract/i });
    await user.click(within(dialog).getByRole("button", { name: /cancel contract/i }));

    await waitFor(() => expect(dataLayer.cancelContract).toHaveBeenCalledWith("contract_1"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("completes through a confirmation modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.completeContract).mockResolvedValue({ success: true, data: makeContract({ status: "completed" }) });
    const onChanged = vi.fn();
    renderContractActions({ contract: makeContract({ id: "contract_1", status: "signed" }), onChanged: onChanged });

    await user.click(screen.getByRole("button", { name: /^complete$/i }));
    const dialog = screen.getByRole("dialog", { name: /complete contract/i });
    await user.click(within(dialog).getByRole("button", { name: /^complete$/i }));

    await waitFor(() => expect(dataLayer.completeContract).toHaveBeenCalledWith("contract_1"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("archives through a confirmation modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.archiveContract).mockResolvedValue({ success: true, data: makeContract({ status: "archived" }) });
    const onChanged = vi.fn();
    renderContractActions({ contract: makeContract({ id: "contract_1", status: "draft" }), onChanged: onChanged });

    await user.click(screen.getByRole("button", { name: /^archive$/i }));
    const dialog = screen.getByRole("dialog", { name: /archive contract/i });
    await user.click(within(dialog).getByRole("button", { name: /^archive$/i }));

    await waitFor(() => expect(dataLayer.archiveContract).toHaveBeenCalledWith("contract_1"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("restores directly, without a confirmation modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.restoreContract).mockResolvedValue({ success: true, data: makeContract({ status: "draft" }) });
    const onChanged = vi.fn();
    renderContractActions({ contract: makeContract({ id: "contract_1", status: "archived" }), onChanged: onChanged });

    await user.click(screen.getByRole("button", { name: /restore/i }));

    await waitFor(() => expect(dataLayer.restoreContract).toHaveBeenCalledWith("contract_1"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("duplicates directly and navigates to the new contract, without a confirmation modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.duplicateContract).mockResolvedValue({
      success: true,
      data: makeContract({ id: "contract_2" }),
    });
    renderContractActions({ contract: makeContract({ id: "contract_1", status: "draft" }), onChanged: vi.fn() });

    await user.click(screen.getByRole("button", { name: /^duplicate$/i }));

    await waitFor(() => expect(dataLayer.duplicateContract).toHaveBeenCalledWith("contract_1"));
  });

  it("surfaces an error and does not call onChanged when a quick action fails", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.archiveContract).mockResolvedValue({ success: false, error: "This contract is already archived." });
    const onChanged = vi.fn();
    renderContractActions({ contract: makeContract({ id: "contract_1", status: "draft" }), onChanged: onChanged });

    await user.click(screen.getByRole("button", { name: /^archive$/i }));
    const dialog = screen.getByRole("dialog", { name: /archive contract/i });
    await user.click(within(dialog).getByRole("button", { name: /^archive$/i }));

    expect(await screen.findByText(/this contract is already archived/i)).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });
});

describe("ContractActions — permission gating", () => {
  it("hides every lifecycle action for a member without contracts.lifecycle, while keeping Edit and Duplicate", () => {
    renderContractActions({ contract: makeContract({ status: "draft" }), onChanged: vi.fn() }, [
      "contracts.view",
      "contracts.create",
      "contracts.update",
    ]);

    expect(screen.getByRole("link", { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^duplicate$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send contract/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^archive$/i })).not.toBeInTheDocument();
  });

  it("hides Edit and the status select for a member without contracts.update, while keeping lifecycle actions", () => {
    renderContractActions({ contract: makeContract({ status: "draft" }), onChanged: vi.fn() }, [
      "contracts.view",
      "contracts.lifecycle",
    ]);

    expect(screen.queryByRole("link", { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/contract status/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send contract/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^archive$/i })).toBeInTheDocument();
  });
});
