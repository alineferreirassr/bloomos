import { describe, expect, it } from "vitest";
import { buildOperationsTimeline, type TimelineEngineInput } from "@/core/operations/timelineEngine";
import type { Event } from "@/types/event";
import type { Payment } from "@/types/payment";
import type { ProposalDraft } from "@/types/proposal";
import type { EventServiceVendorAssignment } from "@/types/eventServiceVendorAssignment";
import type { EventServiceTeamRequirement } from "@/types/eventServiceTeamRequirement";
import type { MediaAsset } from "@/types/mediaAsset";

const BASE_EVENT: Event = {
  id: "event_1",
  workspace_id: "ws_1",
  client_id: "client_1",
  originating_lead_id: null,
  title: "Whitfield Anniversary",
  event_type: "anniversary",
  status: "confirmed",
  lifecycle_stage: "planning",
  event_date: "2026-08-01",
  start_time: "18:00",
  end_time: "22:00",
  timezone: null,
  location_name: "The Grand Hall",
  address: null,
  city: null,
  state: null,
  zip_code: null,
  latitude: null,
  longitude: null,
  guest_count: 80,
  budget_min: 10000,
  budget_max: 20000,
  package_name: null,
  theme: null,
  color_palette: null,
  surprise_event: false,
  confidentiality_notes: null,
  accessibility_notes: null,
  dietary_notes: null,
  weather_plan: null,
  backup_location: null,
  internal_summary: null,
  assigned_owner: null,
  priority: "normal",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  archived_at: null,
  completed_at: null,
  cancelled_at: null,
};

function baseInput(overrides: Partial<TimelineEngineInput> = {}): TimelineEngineInput {
  return {
    event: BASE_EVENT,
    payments: [],
    expenses: [],
    proposals: [],
    vendorAssignments: [],
    teamRequirements: [],
    schedule: [],
    inventoryMovements: [],
    galleryAssets: [],
    liveEventLog: [],
    ...overrides,
  };
}

describe("buildOperationsTimeline", () => {
  it("returns an empty timeline when nothing has happened yet", () => {
    expect(buildOperationsTimeline(baseInput())).toEqual([]);
  });

  it("includes a proposal_created entry for every real Proposal", () => {
    const proposal = { id: "prop_1", created_at: "2026-01-05T00:00:00Z" } as ProposalDraft;
    const timeline = buildOperationsTimeline(baseInput({ proposals: [proposal] }));
    expect(timeline).toHaveLength(1);
    expect(timeline[0].kind).toBe("proposal_created");
  });

  it("includes deposit_paid only for succeeded deposit payments, not other payment types/statuses", () => {
    const deposit = { id: "pay_1", payment_type: "deposit", status: "succeeded", amount_minor: 200000, transaction_date: "2026-01-10T00:00:00Z" } as Payment;
    const pendingDeposit = { id: "pay_2", payment_type: "deposit", status: "pending", amount_minor: 100000, transaction_date: "2026-01-11T00:00:00Z" } as Payment;
    const finalPayment = { id: "pay_3", payment_type: "final_payment", status: "succeeded", amount_minor: 300000, transaction_date: "2026-01-12T00:00:00Z" } as Payment;
    const timeline = buildOperationsTimeline(baseInput({ payments: [deposit, pendingDeposit, finalPayment] }));
    expect(timeline).toHaveLength(1);
    expect(timeline[0].kind).toBe("deposit_paid");
  });

  it("includes vendor_assigned only for confirmed assignments", () => {
    const confirmed = { id: "va_1", status: "confirmed", note: null, updated_at: "2026-01-15T00:00:00Z" } as EventServiceVendorAssignment;
    const suggested = { id: "va_2", status: "suggested", note: null, updated_at: "2026-01-16T00:00:00Z" } as EventServiceVendorAssignment;
    const timeline = buildOperationsTimeline(baseInput({ vendorAssignments: [confirmed, suggested] }));
    expect(timeline).toHaveLength(1);
    expect(timeline[0].kind).toBe("vendor_assigned");
  });

  it("includes team_assigned only when assigned_member_id is set", () => {
    const assigned = { id: "tr_1", role_label: "Coordinator", note: null, assigned_member_id: "member_1", updated_at: "2026-01-17T00:00:00Z" } as EventServiceTeamRequirement;
    const unassigned = { id: "tr_2", role_label: "Photographer", note: null, assigned_member_id: null, updated_at: "2026-01-18T00:00:00Z" } as EventServiceTeamRequirement;
    const timeline = buildOperationsTimeline(baseInput({ teamRequirements: [assigned, unassigned] }));
    expect(timeline).toHaveLength(1);
    expect(timeline[0].title).toContain("Coordinator");
  });

  it("includes event_completed only when the real Event.completed_at is set", () => {
    const timeline = buildOperationsTimeline(baseInput({ event: { ...BASE_EVENT, completed_at: "2026-08-01T23:00:00Z" } }));
    expect(timeline.some((e) => e.kind === "event_completed")).toBe(true);
  });

  it("derives gallery_delivered from the earliest real gallery MediaAsset upload", () => {
    const asset = { id: "media_1", original_filename: "reception.jpg", created_at: "2026-08-02T00:00:00Z" } as MediaAsset;
    const timeline = buildOperationsTimeline(baseInput({ galleryAssets: [asset] }));
    expect(timeline.some((e) => e.kind === "gallery_delivered")).toBe(true);
  });

  it("sorts every entry chronologically regardless of source order", () => {
    const proposal = { id: "prop_1", created_at: "2026-03-01T00:00:00Z" } as ProposalDraft;
    const deposit = { id: "pay_1", payment_type: "deposit", status: "succeeded", amount_minor: 100000, transaction_date: "2026-01-01T00:00:00Z" } as Payment;
    const timeline = buildOperationsTimeline(baseInput({ proposals: [proposal], payments: [deposit] }));
    expect(timeline[0].kind).toBe("deposit_paid");
    expect(timeline[1].kind).toBe("proposal_created");
  });
});
