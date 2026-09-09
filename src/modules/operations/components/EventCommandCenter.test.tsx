import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EventCommandCenter } from "@/modules/operations/components/EventCommandCenter";
import { makeEvent } from "@/modules/events/testUtils";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import type { EventOperationsData } from "@/modules/operations/eventOperationsData";

const snapshot: Extract<MemberSessionSnapshot, { kind: "active" }> = {
  kind: "active",
  user: { id: "user_1", email: "jordan@amorebloom.com" },
  profile: { full_name: "Jordan Ellis", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "staff", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["events.view", "team.view"],
  workspaceDisplayName: "Amoré Bloom",
};

vi.mock("@/modules/operations/eventOperationsData", () => ({
  getEventOperationsData: vi.fn(),
}));
vi.mock("@/lib/data", () => ({
  recordInventoryMovement: vi.fn(),
  getChecklistByEventId: vi.fn(),
  completeChecklistItem: vi.fn(),
  createEventNote: vi.fn(),
  createExpense: vi.fn(),
  uploadMediaAsset: vi.fn(),
}));
vi.mock("@/core/operations/operationsStore", () => ({
  logLiveEventEntry: vi.fn(),
  getLiveEventLog: vi.fn(),
}));

import { getEventOperationsData } from "@/modules/operations/eventOperationsData";
import { recordInventoryMovement, getChecklistByEventId } from "@/lib/data";
import { getLiveEventLog } from "@/core/operations/operationsStore";

function makeData(overrides: Partial<EventOperationsData> = {}): EventOperationsData {
  return {
    event: makeEvent({
      id: "event_1",
      title: "Sunset Wedding",
      lifecycle_stage: "setup",
      event_date: "2026-09-15",
      weather_plan: "Tent with sides in case of rain.",
    }),
    client: null,
    daysUntilEvent: 5,
    health: { score: 92, band: "excellent", factors: [] },
    risks: [],
    budget: {
      estimatedRevenueMinor: 500000,
      estimatedCostMinor: 200000,
      actualRevenueMinor: 300000,
      actualCostMinor: 150000,
      profitMinor: 150000,
      marginPercentage: 30,
      forecastVarianceMinor: 0,
      forecastNote: "On track with the projected margin.",
    },
    packingGroups: [],
    logistics: { phases: [], travelBuffers: [], loadingNote: "Load 2 hours before arrival.", unloadingNote: "Unload immediately on arrival." },
    timeline: [],
    vendorAssignments: [],
    teamRequirements: [],
    purchaseRequirements: [],
    galleryAssetCount: 3,
    checklistCompletionPercentage: 75,
    ...overrides,
  };
}

function renderView(eventId = "event_1") {
  return render(
    <MemberSessionProvider snapshot={snapshot}>
      <EventCommandCenter eventId={eventId} />
    </MemberSessionProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("EventCommandCenter", () => {
  it("does not render command center content before data resolves", () => {
    vi.mocked(getEventOperationsData).mockReturnValue(new Promise(() => {}));

    renderView();

    expect(screen.queryByText("Event Command Center")).not.toBeInTheDocument();
  });

  it("shows an error state and retries the load on demand", async () => {
    vi.mocked(getEventOperationsData).mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(makeData());

    renderView();

    expect(await screen.findByText("Could not load the Event Command Center.")).toBeInTheDocument();
    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Event Command Center")).toBeInTheDocument();
    expect(getEventOperationsData).toHaveBeenCalledTimes(2);
  });

  it("renders the ready base state: health, days-until, summary tiles, and the weather plan", async () => {
    vi.mocked(getEventOperationsData).mockResolvedValue(makeData());

    renderView();

    expect(await screen.findByText("Event Command Center")).toBeInTheDocument();
    expect(screen.getByText("Excellent")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Operations health score" })).toBeInTheDocument();
    expect(screen.getByText("5 days to go")).toBeInTheDocument();
    expect(screen.getByText("Checklist")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("Team")).toBeInTheDocument();
    expect(screen.getByText("Vendors")).toBeInTheDocument();
    expect(screen.getByText("Purchases")).toBeInTheDocument();
    expect(screen.getByText("Budget margin")).toBeInTheDocument();
    expect(screen.getAllByText("30%").length).toBeGreaterThan(0);
    expect(screen.getByText("Gallery")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Tent with sides in case of rain.")).toBeInTheDocument();
  });

  it("renders a populated operational risk", async () => {
    vi.mocked(getEventOperationsData).mockResolvedValue(
      makeData({
        risks: [{ kind: "missing_team", severity: "warning", message: "One team role is still unassigned.", recommendation: "Assign a team member before the event." }],
      }),
    );

    renderView();

    expect(await screen.findByText("One team role is still unassigned.")).toBeInTheDocument();
    expect(screen.getByText("Assign a team member before the event.")).toBeInTheDocument();
  });

  it("shows the empty-state copy when there are no risks, team requirements, or vendor assignments", async () => {
    vi.mocked(getEventOperationsData).mockResolvedValue(makeData({ risks: [], teamRequirements: [], vendorAssignments: [] }));

    renderView();

    expect(await screen.findByText("No operational risks detected right now.")).toBeInTheDocument();
    expect(screen.getByText("No team roles required for this event's assigned Services yet.")).toBeInTheDocument();
    expect(screen.getByText("No vendor requirements for this event's assigned Services yet.")).toBeInTheDocument();
  });

  it("renders team and vendor assignments", async () => {
    vi.mocked(getEventOperationsData).mockResolvedValue(
      makeData({
        teamRequirements: [
          {
            requirement: { id: "req_1", role_label: "Lead Coordinator", assigned_member_id: "member_2" } as never,
            member: { id: "member_2", full_name: "Casey Rivera", email: "casey@amorebloom.com" } as never,
          },
        ],
        vendorAssignments: [
          {
            assignment: { id: "assign_1", vendor_id: "vendor_1", status: "confirmed" } as never,
            vendor: { id: "vendor_1", company_name: "Bloom Florals" } as never,
          },
        ],
      }),
    );

    renderView();

    expect(await screen.findByText("Lead Coordinator")).toBeInTheDocument();
    expect(screen.getByText("Casey Rivera")).toBeInTheDocument();
    expect(screen.getByText("Bloom Florals")).toBeInTheDocument();
    expect(screen.getByText("confirmed")).toBeInTheDocument();
  });

  it("reserves an inventory-sourced packing item and refetches", async () => {
    vi.mocked(getEventOperationsData).mockResolvedValue(
      makeData({
        packingGroups: [
          { category: "decoration", items: [{ itemName: "Centerpiece Vases", quantity: 10, category: "decoration", source: "inventory", inventoryItemId: "inv_1" }] },
        ],
      }),
    );
    vi.mocked(recordInventoryMovement).mockResolvedValue(undefined as never);

    renderView();
    await screen.findByText("Centerpiece Vases × 10");

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("button", { name: "Reserve" }));

    expect(recordInventoryMovement).toHaveBeenCalledWith("inv_1", {
      movement_type: "reservation",
      quantity: 10,
      reason: "Reserved for event: Centerpiece Vases",
      reference_type: "event",
      reference_id: "event_1",
    });
    expect(getEventOperationsData).toHaveBeenCalledTimes(2);
  });

  it("renders the Budget Center with a link to the Purchase Center", async () => {
    vi.mocked(getEventOperationsData).mockResolvedValue(makeData());

    renderView();
    await screen.findByText("Event Command Center");

    expect(screen.getByText("On track with the projected margin.")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "View Purchase Center →" });
    expect(link).toHaveAttribute("href", "/purchases");
  });

  it("opens Live Event Mode from the toggle button", async () => {
    vi.mocked(getEventOperationsData).mockResolvedValue(makeData({ event: makeEvent({ id: "event_1", title: "Sunset Wedding", lifecycle_stage: "setup" }) }));
    vi.mocked(getChecklistByEventId).mockResolvedValue([]);
    vi.mocked(getLiveEventLog).mockResolvedValue([]);

    renderView();
    const openButton = await screen.findByRole("button", { name: "Open Live Event Mode" });

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(openButton);

    expect(await screen.findByRole("heading", { name: "Live Event Mode — Sunset Wedding" })).toBeInTheDocument();
  });

  it("shows the fallback copy when no weather plan is on file", async () => {
    vi.mocked(getEventOperationsData).mockResolvedValue(makeData({ event: makeEvent({ id: "event_1", title: "Sunset Wedding", weather_plan: null }) }));

    renderView();

    expect(await screen.findByText("No weather plan on file yet — this workspace doesn't have a connected weather source.")).toBeInTheDocument();
  });
});
