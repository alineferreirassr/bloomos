import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClientDetailView } from "@/modules/clients/components/ClientDetailView";
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
  permissions: ["clients.view", "clients.create", "clients.update", "clients.archive"],
  workspaceDisplayName: "Amoré Bloom",
};

function renderClientDetail(clientId: string) {
  return render(
    <MemberSessionProvider snapshot={fullPermissionSnapshot}>
      <ClientDetailView clientId={clientId} />
    </MemberSessionProvider>,
  );
}

vi.mock("@/modules/communication/timeline/components/EntityTimelinePanel", () => ({ EntityTimelinePanel: () => null }));
vi.mock("@/modules/communication/comments/components/CommentsPanel", () => ({ CommentsPanel: () => null }));
// v2.0 Checkpoint 32 — ClientJourneySummaryCard calls this "use server" action; mocked here the same way every other server-action dependency of this component already is, so the real module (and its own lib/data import chain) never loads under jsdom.
vi.mock("@/modules/clientJourney/clientJourneyActions", () => ({ evaluateClientJourneyAction: vi.fn().mockResolvedValue({ success: false, error: "not available in this test" }) }));
// v2 Checkpoint 44, Step 14 — DocumentBundlesSection calls these "use server" actions; mocked the same way clientJourneyActions is above, so the real module (and its own lib/data import chain) never loads under jsdom.
vi.mock("@/modules/documentTemplates/documentBundleActions", () => ({
  listDocumentBundlesForClientAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
  createDocumentBundleAction: vi.fn().mockResolvedValue({ success: false, error: "not available in this test" }),
}));

vi.mock("@/lib/data", () => ({
  getClientById: vi.fn(),
  getNotesByClientId: vi.fn(),
  getTimelineByClientId: vi.fn(),
  getClientNextAction: vi.fn(),
  createClientNote: vi.fn(),
  togglePinNote: vi.fn(),
  archiveClient: vi.fn(),
  restoreClient: vi.fn(),
  setClientVipStatus: vi.fn(),
  updateClientStatus: vi.fn(),
  updateClientContactPreference: vi.fn(),
  updateClientTags: vi.fn(),
  getDocumentOwnerSummary: vi.fn(),
  getEvents: vi.fn(),
  getClientFinancialSummary: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

const EMPTY_DOCUMENT_SUMMARY = {
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
};

const EMPTY_FINANCIAL_SUMMARY = {
  contracted_value_minor: 0,
  invoiced_total_minor: 0,
  collected_minor: 0,
  refunded_minor: 0,
  outstanding_minor: 0,
  expense_total_minor: 0,
  gross_profit_minor: 0,
  net_profit_minor: 0,
  deposit_required_minor: 0,
  deposit_paid_minor: 0,
  deposit_balance_minor: 0,
  payment_completion_percentage: 0,
  expense_percentage_of_revenue: 0,
};

describe("ClientDetailView", () => {
  beforeEach(() => {
    vi.mocked(dataLayer.getDocumentOwnerSummary).mockResolvedValue(EMPTY_DOCUMENT_SUMMARY);
    vi.mocked(dataLayer.getEvents).mockResolvedValue([]);
    vi.mocked(dataLayer.getClientFinancialSummary).mockResolvedValue(EMPTY_FINANCIAL_SUMMARY);
  });

  it("renders header, contact, and internal sections once the client loads", async () => {
    const client = makeClient({
      id: "client_1",
      first_name: "Naomi",
      last_name: "Whitfield",
      partner_name: "James Whitfield",
      is_vip: true,
      tags: ["repeat-client"],
      internal_status: "active",
    });
    vi.mocked(dataLayer.getClientById).mockResolvedValue(client);
    vi.mocked(dataLayer.getNotesByClientId).mockResolvedValue([]);
    vi.mocked(dataLayer.getTimelineByClientId).mockResolvedValue([]);
    vi.mocked(dataLayer.getClientNextAction).mockResolvedValue(null);

    renderClientDetail("client_1");

    expect(await screen.findByText(/Naomi Whitfield & James Whitfield/)).toBeInTheDocument();
    expect(screen.getByText("VIP")).toBeInTheDocument();
    // Tags now render as removable badges via TagsEditor, so match the tag
    // text as a substring rather than the badge's full text (which also
    // includes the "remove" control).
    expect(screen.getByText(/repeat-client/)).toBeInTheDocument();
    expect(screen.getByText("No activity yet")).toBeInTheDocument();
  });

  it("shows an error state when the client can't be found", async () => {
    vi.mocked(dataLayer.getClientById).mockRejectedValue(new Error("not found"));
    vi.mocked(dataLayer.getNotesByClientId).mockResolvedValue([]);
    vi.mocked(dataLayer.getTimelineByClientId).mockResolvedValue([]);
    vi.mocked(dataLayer.getClientNextAction).mockResolvedValue(null);

    renderClientDetail("does_not_exist");

    expect(await screen.findByText(/could not load this client/i)).toBeInTheDocument();
  });

  it("renders linked Events and a Finance summary sourced from getEvents/getClientFinancialSummary", async () => {
    const client = makeClient({ id: "client_1", first_name: "Naomi", last_name: "Whitfield" });
    vi.mocked(dataLayer.getClientById).mockResolvedValue(client);
    vi.mocked(dataLayer.getNotesByClientId).mockResolvedValue([]);
    vi.mocked(dataLayer.getTimelineByClientId).mockResolvedValue([]);
    vi.mocked(dataLayer.getClientNextAction).mockResolvedValue(null);
    vi.mocked(dataLayer.getEvents).mockResolvedValue([
      makeEvent({ id: "event_9", client_id: "client_1", title: "Naomi's Proposal", status: "confirmed" }),
    ]);
    vi.mocked(dataLayer.getClientFinancialSummary).mockResolvedValue({
      ...EMPTY_FINANCIAL_SUMMARY,
      invoiced_total_minor: 500000,
      collected_minor: 250000,
    });

    renderClientDetail("client_1");

    expect(await screen.findByText("Events")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Naomi's Proposal" })).toHaveAttribute("href", "/events/event_9");

    expect(screen.getByText("Finance")).toBeInTheDocument();
    expect(screen.getByText("$5,000.00")).toBeInTheDocument();
    expect(screen.getByText("$2,500.00")).toBeInTheDocument();
  });
});
