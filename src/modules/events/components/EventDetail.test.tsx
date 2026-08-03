import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EventDetailView } from "@/modules/events/components/EventDetailView";
import { makeEvent } from "@/modules/events/testUtils";
import { makeClient } from "@/modules/clients/testUtils";
import { makeContract } from "@/modules/contracts/testUtils";
import { makeEventService } from "@/modules/services/testUtils";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

const fullPermissionSnapshot: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_amore_bloom", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["events.view", "events.create", "events.update", "events.archive"],
  workspaceDisplayName: "Amoré Bloom",
};

function renderEventDetail(eventId: string) {
  return render(
    <MemberSessionProvider snapshot={fullPermissionSnapshot}>
      <EventDetailView eventId={eventId} />
    </MemberSessionProvider>,
  );
}

// `BloomAISkillPicker` (Checkpoint 4) calls `useRouter` for its fallback
// navigation — same convention as every other component under test that
// uses `next/navigation` (see `EventEdit.test.tsx`, etc.).
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/data", () => ({
  getEventById: vi.fn(),
  getClientById: vi.fn(),
  getNotesByEventId: vi.fn(),
  getTimelineByEventId: vi.fn(),
  getChecklistByEventId: vi.fn(),
  getScheduleByEventId: vi.fn(),
  getEventNextAction: vi.fn(),
  createEventNote: vi.fn(),
  togglePinNote: vi.fn(),
  getEventFinancialSummary: vi.fn(),
  getEventFinancialStatus: vi.fn(),
  getDocumentOwnerSummary: vi.fn(),
  getContracts: vi.fn(),
  listEventServicesByEvent: vi.fn(),
  // Bloom AI's EventAssistantCard (Checkpoint 20, Step 14) reads these directly.
  listEventServiceInventoryRequirements: vi.fn(),
  getVendors: vi.fn(),
  getWorkspaceMembers: vi.fn(),
  // Event Command Center (Checkpoint 21, Step 1) reads all of these via
  // `getEventOperationsData` directly.
  listEventServicePurchaseRequirements: vi.fn(),
  listEventServiceBudgetLines: vi.fn(),
  listEventServiceTeamRequirements: vi.fn(),
  listEventServiceVendorAssignments: vi.fn(),
  getInventoryItem: vi.fn(),
  listInventoryMovements: vi.fn(),
  getLowStockInventoryItems: vi.fn(),
  getPayments: vi.fn(),
  getExpenses: vi.fn(),
  getMediaAssetsByOwner: vi.fn(),
  getOverduePurchases: vi.fn(),
  getPurchase: vi.fn(),
  recordInventoryMovement: vi.fn(),
}));

// `generateEventOperationsBrief` is a `"use server"` action whose real
// module graph reaches `fetchEventContext.server.ts` (guarded by the
// `server-only` package) — Next's real RSC build compiles a `"use server"`
// export into a client-safe reference and never bundles that graph into the
// client at all, but Vitest has no equivalent transform and would naively
// try to load the real server-only chain into this jsdom test. Mocking it
// here (exactly like `@/lib/data` above) is the same "don't load the real
// implementation into a UI test" pattern already used throughout this file.
vi.mock("@/modules/ai/generateEventOperationsBrief", () => ({
  generateEventOperationsBrief: vi.fn(),
}));

// `ProposalGeneratorPanel` (rendered by `EventDetailView`) calls
// `getLatestProposalForEvent` on mount — a `"use server"` action whose real
// module graph reaches `resolveMemberSessionSnapshot` -> `getWorkspaceSession`
// -> `@/lib/supabase/server` (guarded by `server-only`). Mocked for the same
// reason as `generateEventOperationsBrief` above; the other 3 Proposal
// actions are mocked alongside it since they share the same real graph.
vi.mock("@/modules/ai/proposal/getLatestProposalForEvent", () => ({
  getLatestProposalForEvent: vi.fn().mockResolvedValue({ success: true, data: null }),
}));
vi.mock("@/modules/ai/proposal/generateProposalDraft", () => ({
  generateProposalDraft: vi.fn(),
}));
vi.mock("@/modules/ai/proposal/acceptProposalDraft", () => ({
  acceptProposalDraft: vi.fn(),
}));
vi.mock("@/modules/ai/proposal/rejectProposalDraft", () => ({
  rejectProposalDraft: vi.fn(),
}));

// `BloomAISkillPicker` (also rendered by `EventDetailView`, Checkpoint 4)
// calls `getBloomAIOverview` when opened — a `"use server"` action reaching
// the same `server-only`-guarded graph as the actions above. Mocked for the
// same reason; never opened in these tests, so the resolved value is unused.
vi.mock("@/modules/ai/getBloomAIOverview", () => ({
  getBloomAIOverview: vi.fn().mockResolvedValue({ success: true, data: { providerConfigured: false, skills: [], installedSkillsCount: 0, activeSkillsCount: 0, comingSoonSkillsCount: 0, recentProposals: [], stats: { totalGenerated: 0, accepted: 0, rejected: 0, awaitingReview: 0 } } }),
}));

// v2 Checkpoint 24 — same "use server" / server-only reasoning as the mocks above.
vi.mock("@/modules/communication/timeline/components/EntityTimelinePanel", () => ({ EntityTimelinePanel: () => null }));
vi.mock("@/modules/communication/comments/components/CommentsPanel", () => ({ CommentsPanel: () => null }));

import * as dataLayer from "@/lib/data";

function mockReady(overrides: Partial<ReturnType<typeof makeEvent>> = {}) {
  const event = makeEvent({
    id: "event_1",
    title: "Malibu Sunset Proposal",
    client_id: "client_1",
    status: "confirmed",
    lifecycle_stage: "booking",
    priority: "high",
    event_date: "2026-08-22",
    location_name: "El Matador State Beach",
    ...overrides,
  });
  vi.mocked(dataLayer.getEventById).mockResolvedValue(event);
  vi.mocked(dataLayer.getClientById).mockResolvedValue(
    makeClient({ id: "client_1", first_name: "Jordan", last_name: "Ellis" }),
  );
  vi.mocked(dataLayer.getNotesByEventId).mockResolvedValue([]);
  vi.mocked(dataLayer.getTimelineByEventId).mockResolvedValue([]);
  vi.mocked(dataLayer.getChecklistByEventId).mockResolvedValue([]);
  vi.mocked(dataLayer.getScheduleByEventId).mockResolvedValue([]);
  vi.mocked(dataLayer.getEventNextAction).mockResolvedValue(null);
  vi.mocked(dataLayer.getEventFinancialSummary).mockResolvedValue({
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
  });
  vi.mocked(dataLayer.getEventFinancialStatus).mockResolvedValue("no_contract");
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
  vi.mocked(dataLayer.getContracts).mockResolvedValue([]);
  vi.mocked(dataLayer.listEventServicesByEvent).mockResolvedValue([]);
  vi.mocked(dataLayer.listEventServiceInventoryRequirements).mockResolvedValue([]);
  vi.mocked(dataLayer.getVendors).mockResolvedValue([]);
  vi.mocked(dataLayer.getWorkspaceMembers).mockResolvedValue([]);
  vi.mocked(dataLayer.listEventServicePurchaseRequirements).mockResolvedValue([]);
  vi.mocked(dataLayer.listEventServiceBudgetLines).mockResolvedValue([]);
  vi.mocked(dataLayer.listEventServiceTeamRequirements).mockResolvedValue([]);
  vi.mocked(dataLayer.listEventServiceVendorAssignments).mockResolvedValue([]);
  vi.mocked(dataLayer.listInventoryMovements).mockResolvedValue([]);
  vi.mocked(dataLayer.getLowStockInventoryItems).mockResolvedValue([]);
  vi.mocked(dataLayer.getPayments).mockResolvedValue([]);
  vi.mocked(dataLayer.getExpenses).mockResolvedValue([]);
  vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValue([]);
  vi.mocked(dataLayer.getOverduePurchases).mockResolvedValue([]);
  return event;
}

describe("EventDetailView", () => {
  it("renders the header, client link, and every overview section once the event loads", async () => {
    mockReady();

    renderEventDetail("event_1");

    expect(await screen.findByText("Malibu Sunset Proposal")).toBeInTheDocument();
    // Badge text and Status/Lifecycle/Priority select option text legitimately
    // repeat on this page (header badge + the transition select's options),
    // so use getAllByText rather than asserting a single match.
    expect(screen.getAllByText("Confirmed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Booking").length).toBeGreaterThan(0);
    expect(screen.getAllByText("High").length).toBeGreaterThan(0);

    const clientLink = screen.getAllByRole("link", { name: /jordan ellis/i })[0];
    expect(clientLink).toHaveAttribute("href", "/clients/client_1");

    expect(screen.getByText("Event Summary")).toBeInTheDocument();
    expect(screen.getByText("Date & Time")).toBeInTheDocument();
    expect(screen.getByText("Location")).toBeInTheDocument();
    expect(screen.getByText("Budget, Package & Guests")).toBeInTheDocument();
    expect(screen.getByText("Theme & Color Palette")).toBeInTheDocument();
    expect(screen.getByText("Surprise & Confidentiality")).toBeInTheDocument();
    expect(screen.getByText("Accessibility & Dietary Notes")).toBeInTheDocument();
    expect(screen.getByText("Weather Plan & Backup Location")).toBeInTheDocument();
    expect(screen.getByText("Internal Summary")).toBeInTheDocument();
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByText("Event Health")).toBeInTheDocument();
    expect(screen.getByText("Checklist Summary")).toBeInTheDocument();
    expect(screen.getByText("Schedule Summary")).toBeInTheDocument();
    expect(screen.getByText("Timeline")).toBeInTheDocument();
    expect(await screen.findByText("Event Command Center")).toBeInTheDocument();
  });

  it("renders the health score and severity from getEventHealthDetails", async () => {
    mockReady({ location_name: null, address: null, budget_min: null, budget_max: null });
    // Isolate location/budget as the only two triggered factors by giving
    // this event checklist and schedule items (mockReady defaults both to
    // empty, which would otherwise also deduct).
    vi.mocked(dataLayer.getChecklistByEventId).mockResolvedValue([
      {
        id: "c1",
        workspace_id: "ws_test",
        owner_type: "event",
        owner_id: "event_1",
        title: "Item",
        description: null,
        category: "planning",
        priority: "normal",
        status: "pending",
        due_date: null,
        completed_at: null,
        assigned_type: "unknown",
        assigned_id: null,
        assigned_name: null,
        sort_order: 0,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ]);
    vi.mocked(dataLayer.getScheduleByEventId).mockResolvedValue([
      {
        id: "s1",
        workspace_id: "ws_test",
        owner_type: "event",
        owner_id: "event_1",
        title: "Item",
        description: null,
        start_time: null,
        end_time: null,
        location: null,
        assigned_to: null,
        category: "setup",
        status: "planned",
        sort_order: 0,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ]);

    renderEventDetail("event_1");

    await screen.findByText("Event Health");
    // Missing location (15) + missing budget (10) = 100 - 25 = 75.
    expect(screen.getByText("75")).toBeInTheDocument();
    expect(screen.getByText("Missing location")).toBeInTheDocument();
    expect(screen.getByText("Missing budget")).toBeInTheDocument();
  });

  it("renders checklist and schedule summary stats", async () => {
    mockReady();
    vi.mocked(dataLayer.getChecklistByEventId).mockResolvedValue([
      {
        id: "c1",
        workspace_id: "ws_test",
        owner_type: "event",
        owner_id: "event_1",
        title: "Confirm ring",
        description: null,
        category: "client",
        priority: "critical",
        status: "completed",
        due_date: null,
        completed_at: "2026-06-01T00:00:00.000Z",
        assigned_type: "unknown",
        assigned_id: null,
        assigned_name: null,
        sort_order: 0,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ]);

    renderEventDetail("event_1");

    await screen.findByText("Checklist Summary");
    // The Event Command Center's own Checklist summary tile (Checkpoint 21)
    // can legitimately show the same "100%" text alongside the pre-existing
    // Checklist Summary card, so assert at least one match rather than
    // exactly one.
    expect(screen.getAllByText("100%").length).toBeGreaterThan(0);
  });

  it("shows an error state when the event can't be found", async () => {
    vi.mocked(dataLayer.getEventById).mockRejectedValue(new Error("not found"));

    renderEventDetail("does_not_exist");

    expect(await screen.findByText(/could not load this event/i)).toBeInTheDocument();
  });

  it("renders Notes read-only for a cancelled event but not for a completed one", async () => {
    mockReady({ status: "cancelled" });
    renderEventDetail("event_1");
    await screen.findByText("Notes");
    expect(screen.queryByRole("button", { name: /add note/i })).not.toBeInTheDocument();
  });

  it("keeps Notes editable for a completed event", async () => {
    mockReady({ status: "completed" });
    renderEventDetail("event_1");
    await screen.findByText("Notes");
    expect(screen.getByRole("button", { name: /add note/i })).toBeInTheDocument();
  });

  it("shows the EventArchivedBanner for an archived event, and never for any other status", async () => {
    mockReady({ status: "archived" });
    renderEventDetail("event_1");
    expect(await screen.findByText(/This Event is archived/)).toBeInTheDocument();
  });

  it("never shows the EventArchivedBanner for a confirmed event", async () => {
    mockReady({ status: "confirmed" });
    renderEventDetail("event_1");
    await screen.findByText("Malibu Sunset Proposal");
    expect(screen.queryByText(/This Event is archived/)).not.toBeInTheDocument();
  });

  it("renders linked Contracts and Assigned Services, each pointing at its own detail/workspace route", async () => {
    mockReady();
    vi.mocked(dataLayer.getContracts).mockResolvedValue([
      makeContract({ id: "contract_9", event_id: "event_1", title: "Wedding Agreement", status: "signed" }),
    ]);
    vi.mocked(dataLayer.listEventServicesByEvent).mockResolvedValue([
      makeEventService({ id: "es_9", event_id: "event_1", service_id: "service_9", name: "Live Music", status: "confirmed" }),
    ]);

    renderEventDetail("event_1");

    expect(await screen.findByText("Contracts")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Wedding Agreement" })).toHaveAttribute("href", "/contracts/contract_9");

    expect(screen.getByText("Assigned Services")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Live Music" })).toHaveAttribute(
      "href",
      "/services/service_9/assignments/es_9",
    );
  });
});
