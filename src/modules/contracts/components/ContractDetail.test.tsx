import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContractDetailView } from "@/modules/contracts/components/ContractDetailView";
import { makeContract, makeContractExhibit, makeContractTemplate } from "@/modules/contracts/testUtils";
import { makeClient } from "@/modules/clients/testUtils";
import { makeEvent } from "@/modules/events/testUtils";
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

function renderContractDetail(contractId: string) {
  return render(
    <MemberSessionProvider snapshot={fullPermissionSnapshot}>
      <ContractDetailView contractId={contractId} />
    </MemberSessionProvider>,
  );
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/data", () => ({
  getContract: vi.fn(),
  getClientById: vi.fn(),
  getEventById: vi.fn(),
  getContractTemplateById: vi.fn(),
  getContractExhibitsByContractId: vi.fn(),
  getNotesByContractId: vi.fn(),
  getTimelineByContractId: vi.fn(),
  getContractNextAction: vi.fn(),
  getContractFinanceSummary: vi.fn(),
  createContractNote: vi.fn(),
  togglePinNote: vi.fn(),
  getDocumentOwnerSummary: vi.fn(),
}));

vi.mock("@/modules/contractPlatform/contractPlatformActions", () => ({
  evaluateContractAction: vi.fn().mockResolvedValue({ success: false, error: "not available in this test" }),
  listContractBuilderTemplatesAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
  createContractVersionAction: vi.fn(),
  publishContractVersionAction: vi.fn(),
  archiveContractDocumentAction: vi.fn(),
  restoreContractVersionAction: vi.fn(),
  compareContractVersionsAction: vi.fn(),
  markContractReadyAction: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

function mockReady(overrides: Partial<ReturnType<typeof makeContract>> = {}) {
  const contract = makeContract({
    id: "contract_1",
    contract_number: "CT-2026-0001",
    title: "Malibu Sunset Proposal — Event Services Agreement",
    client_id: "client_1",
    event_id: "event_1",
    template_id: "template_1",
    status: "signed",
    signature_status: "signed",
    version: 2,
    total_value: 8500,
    deposit_required: true,
    deposit_amount: 2500,
    remaining_balance: 6000,
    ...overrides,
  });
  vi.mocked(dataLayer.getContract).mockResolvedValue(contract);
  vi.mocked(dataLayer.getClientById).mockResolvedValue(
    makeClient({ id: "client_1", first_name: "Jordan", last_name: "Ellis" }),
  );
  vi.mocked(dataLayer.getEventById).mockResolvedValue(
    makeEvent({ id: "event_1", title: "Malibu Sunset Proposal" }),
  );
  vi.mocked(dataLayer.getContractTemplateById).mockResolvedValue(
    makeContractTemplate({ id: "template_1", name: "Standard Event Services Agreement" }),
  );
  vi.mocked(dataLayer.getContractExhibitsByContractId).mockResolvedValue([
    makeContractExhibit({ id: "exhibit_1", title: "Payment Schedule" }),
  ]);
  vi.mocked(dataLayer.getNotesByContractId).mockResolvedValue([]);
  vi.mocked(dataLayer.getTimelineByContractId).mockResolvedValue([]);
  vi.mocked(dataLayer.getContractNextAction).mockResolvedValue("Mark the contract as completed");
  vi.mocked(dataLayer.getContractFinanceSummary).mockResolvedValue({
    invoices: [],
    totalInvoicedMinor: 0,
    totalCollectedMinor: 0,
    outstandingMinor: 0,
    depositStatus: "not_required",
    depositRequiredMinor: 0,
    depositPaidMinor: 0,
  });
  vi.mocked(dataLayer.getDocumentOwnerSummary).mockResolvedValue({
    total: 0,
    active: 0,
    draft: 0,
    expiringSoon: 0,
    expired: 0,
    archived: 0,
    deleted: 0,
    totalStorageBytes: 0,
    byCategory: {} as never,
    latestUploads: [],
  });
  return contract;
}

describe("ContractDetailView", () => {
  it("renders the header, client/event links, badges, and every overview section once loaded", async () => {
    mockReady();
    renderContractDetail("contract_1");

    expect(await screen.findByText("Malibu Sunset Proposal — Event Services Agreement")).toBeInTheDocument();
    expect(screen.getByText("CT-2026-0001")).toBeInTheDocument();
    // "Jordan Ellis"/"Malibu Sunset Proposal" links appear twice each: once in the header intro line, once in the Client/Event sections below.
    for (const link of screen.getAllByRole("link", { name: "Jordan Ellis" })) {
      expect(link).toHaveAttribute("href", "/clients/client_1");
    }
    for (const link of screen.getAllByRole("link", { name: "Malibu Sunset Proposal" })) {
      expect(link).toHaveAttribute("href", "/events/event_1");
    }
    expect(screen.getAllByText("Signed").length).toBeGreaterThan(0);
    expect(screen.getByText("Mark the contract as completed")).toBeInTheDocument();

    expect(screen.getByText("Commercial Summary")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Client" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Event" })).toBeInTheDocument();
    expect(screen.getByText("Dates")).toBeInTheDocument();
    expect(screen.getByText("Financial Terms")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Template" })).toBeInTheDocument();
    expect(screen.getByText("Version History")).toBeInTheDocument();
    expect(screen.getByText("Exhibits")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Notes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Timeline" })).toBeInTheDocument();
    expect(screen.getByText("Future Integrations")).toBeInTheDocument();
    expect(screen.getByText("Standard Event Services Agreement")).toBeInTheDocument();
    expect(screen.getByText("Payment Schedule")).toBeInTheDocument();
  });

  it("shows 'no linked event' when event_id is null", async () => {
    mockReady({ event_id: null, template_id: null });
    renderContractDetail("contract_1");

    expect(await screen.findByText(/no linked event/i)).toBeInTheDocument();
    expect(screen.getByText(/no template selected/i)).toBeInTheDocument();
  });

  it("keeps Notes editable for a signed contract (commercial-term lock doesn't restrict notes)", async () => {
    mockReady({ status: "signed" });
    renderContractDetail("contract_1");

    await screen.findByText("Malibu Sunset Proposal — Event Services Agreement");
    // NotesSection renders an "Add note" affordance when not read-only.
    expect(screen.getByRole("button", { name: /add note/i })).toBeInTheDocument();
  });

  it("makes Notes read-only for an archived contract", async () => {
    mockReady({ status: "archived", archived_at: "2026-01-01T00:00:00.000Z" });
    renderContractDetail("contract_1");

    await screen.findByText("Malibu Sunset Proposal — Event Services Agreement");
    expect(screen.queryByRole("button", { name: /add note/i })).not.toBeInTheDocument();
  });

  it("hides Add Exhibit for a signed contract (exhibits are commercial-term locked)", async () => {
    mockReady({ status: "signed" });
    renderContractDetail("contract_1");

    await screen.findByText("Malibu Sunset Proposal — Event Services Agreement");
    expect(screen.queryByRole("button", { name: /add exhibit/i })).not.toBeInTheDocument();
  });

  it("shows Add Exhibit for a draft contract", async () => {
    mockReady({ status: "draft", signature_status: "unsigned" });
    renderContractDetail("contract_1");

    await screen.findByText("Malibu Sunset Proposal — Event Services Agreement");
    expect(screen.getByRole("button", { name: /add exhibit/i })).toBeInTheDocument();
  });

  it("shows an error state when the contract can't be found", async () => {
    vi.mocked(dataLayer.getContract).mockRejectedValue(new Error("not found"));
    renderContractDetail("does_not_exist");

    expect(await screen.findByText(/could not (be found|load this contract)/i)).toBeInTheDocument();
  });
});
