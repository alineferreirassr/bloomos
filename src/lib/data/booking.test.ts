import { beforeEach, describe, expect, it } from "vitest";
import {
  bookLead,
  createEvent,
  createLead,
  getClientById,
  getClientsWithPendingRecovery,
  getEventById,
  getEvents,
  getLeadById,
  getTimelineByClientId,
  markClientRecoveryPending,
  resetAllMockData,
  resumeBooking,
  updateLeadStatus,
  type BookLeadInput,
} from "@/lib/data";
import type { LeadFormInput } from "@/modules/leads/schema";

const validLead: LeadFormInput = {
  first_name: "Jamie",
  last_name: "Rivera",
  email: "jamie.rivera@example.com",
  phone: "",
  instagram: "",
  source: "Website",
  event_type: "",
  event_date: "",
  location: "",
  budget_min: "",
  budget_max: "",
  message: "",
  assigned_to: "",
};

const minimalEventSeed: BookLeadInput = {
  title: "Jamie & Partner's Proposal",
  event_type: "proposal",
  event_date: "",
  start_time: "",
  end_time: "",
  timezone: "",
  location_name: "",
  address: "",
  city: "",
  state: "",
  zip_code: "",
  latitude: "",
  longitude: "",
  guest_count: "",
  budget_min: "",
  budget_max: "",
  package_name: "",
  theme: "",
  color_palette: "",
  surprise_event: false,
  confidentiality_notes: "",
  accessibility_notes: "",
  dietary_notes: "",
  weather_plan: "",
  backup_location: "",
  internal_summary: "",
  assigned_owner: "",
  priority: "normal",
};

beforeEach(() => {
  resetAllMockData();
});

describe("bookLead (Booking Workflow, Phase 2 — Commercial → Operational Pipeline hinge)", () => {
  it("converts the Lead, creates a linked Event, and starts it at lifecycle_stage 'planning'", async () => {
    const lead = await createLead(validLead);
    if (!lead.success) throw new Error("setup failed");

    const result = await bookLead(lead.data.id, minimalEventSeed);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.lead.status).toBe("converted");
    expect(result.data.event.client_id).toBe(result.data.client.id);
    expect(result.data.event.lifecycle_stage).toBe("planning");
    expect(result.data.event.originating_lead_id).toBe(lead.data.id);
    expect(result.data.event.title).toBe("Jamie & Partner's Proposal");

    const storedEvent = await getEventById(result.data.event.id);
    expect(storedEvent.lifecycle_stage).toBe("planning");
  });

  it("fails cleanly when the Lead is already converted, without creating an Event", async () => {
    const lead = await createLead(validLead);
    if (!lead.success) throw new Error("setup failed");

    const first = await bookLead(lead.data.id, minimalEventSeed);
    expect(first.success).toBe(true);

    const second = await bookLead(lead.data.id, minimalEventSeed);
    expect(second.success).toBe(false);
  });

  it("fails cleanly for an archived Lead", async () => {
    const lead = await createLead(validLead);
    if (!lead.success) throw new Error("setup failed");
    // waiting_decision is a legal, non-terminal status a Lead can be archived from directly.
    await updateLeadStatus(lead.data.id, "waiting_decision");

    const archived = await import("@/lib/data").then((m) => m.archiveLead(lead.data.id));
    expect(archived.success).toBe(true);

    const result = await bookLead(lead.data.id, minimalEventSeed);
    expect(result.success).toBe(false);
  });

  it("marks a durable, auditable pending recovery on the Client when Event creation fails, without rolling back the conversion", async () => {
    const lead = await createLead(validLead);
    if (!lead.success) throw new Error("setup failed");

    const result = await bookLead(lead.data.id, { ...minimalEventSeed, title: "" });
    expect(result.success).toBe(false);
    if (result.success) return;

    // The failure is visible and actionable, not silent: the error names the
    // Client and points at the durable recovery record instead of asking the
    // caller to redo everything from scratch.
    expect(result.error).toMatch(/converted to Client/i);
    expect(result.error).toMatch(/creating the Event failed/i);
    expect(result.error).toMatch(/pending recovery/i);

    // The Lead IS left converted and the Client IS left linked — this is the
    // deliberate, non-atomic design (bookLead composes independently valid
    // operations rather than one transaction), not an oversight.
    const storedLead = await getLeadById(lead.data.id);
    expect(storedLead.status).toBe("converted");
    expect(storedLead.converted_client_id).not.toBeNull();

    const clientId = storedLead.converted_client_id as string;
    const storedClient = await getClientById(clientId);
    expect(storedClient.originating_lead_id).toBe(lead.data.id);
    expect(storedClient.pending_recovery).not.toBeNull();
    expect(storedClient.pending_recovery?.workflow).toBe("booking");
    expect(storedClient.pending_recovery?.status).toBe("pending");
    expect(storedClient.pending_recovery?.attempts).toBe(1);
    expect(storedClient.pending_recovery?.payload).toMatchObject({ title: "" });
    expect(storedClient.pending_recovery?.first_attempt_at).toBe(storedClient.pending_recovery?.last_attempt_at);

    // Durable + queryable: shows up in the generic pending-recovery listing
    // the Booking Dashboard's Needs Attention section will consume.
    const needingAttention = await getClientsWithPendingRecovery("booking");
    expect(needingAttention.some((c) => c.id === clientId)).toBe(true);

    // Auditable: a high-priority internal_alert Note and a Timeline entry exist.
    const timeline = await getTimelineByClientId(clientId);
    expect(timeline.some((t) => t.type === "client_recovery_pending")).toBe(true);

    // No Event was created — the failure is real, not partially masked.
    const events = await getEvents();
    expect(events.some((e) => e.client_id === storedClient.id)).toBe(false);
  });

  it("resumeBooking clears the pending recovery and finishes the booking on success", async () => {
    const lead = await createLead(validLead);
    if (!lead.success) throw new Error("setup failed");

    const failed = await bookLead(lead.data.id, { ...minimalEventSeed, title: "" });
    expect(failed.success).toBe(false);

    const storedLead = await getLeadById(lead.data.id);
    const clientId = storedLead.converted_client_id as string;

    const resumed = await resumeBooking(clientId, minimalEventSeed);
    expect(resumed.success).toBe(true);
    if (!resumed.success) return;

    expect(resumed.data.event.lifecycle_stage).toBe("planning");
    expect(resumed.data.event.client_id).toBe(clientId);

    const storedClient = await getClientById(clientId);
    expect(storedClient.pending_recovery).toBeNull();

    const timeline = await getTimelineByClientId(clientId);
    expect(timeline.some((t) => t.type === "client_recovery_resolved")).toBe(true);

    const needingAttention = await getClientsWithPendingRecovery("booking");
    expect(needingAttention.some((c) => c.id === clientId)).toBe(false);
  });

  it("resumeBooking re-marks pending recovery with an incremented attempt count on repeated failure", async () => {
    const lead = await createLead(validLead);
    if (!lead.success) throw new Error("setup failed");

    const failed = await bookLead(lead.data.id, { ...minimalEventSeed, title: "" });
    expect(failed.success).toBe(false);

    const storedLead = await getLeadById(lead.data.id);
    const clientId = storedLead.converted_client_id as string;
    const firstAttemptAt = (await getClientById(clientId)).pending_recovery?.first_attempt_at;

    const resumedAgain = await resumeBooking(clientId, { ...minimalEventSeed, title: "" });
    expect(resumedAgain.success).toBe(false);

    const storedClient = await getClientById(clientId);
    expect(storedClient.pending_recovery).not.toBeNull();
    expect(storedClient.pending_recovery?.attempts).toBe(2);
    expect(storedClient.pending_recovery?.first_attempt_at).toBe(firstAttemptAt);

    const timeline = await getTimelineByClientId(clientId);
    expect(timeline.filter((t) => t.type === "client_recovery_pending")).toHaveLength(2);
  });

  it("resumeBooking retries the existing Event's lifecycle-stage advance instead of creating a duplicate Event when payload.event_id is already known", async () => {
    // Reaches Lead-converted-but-no-Event state via a rejected create, exactly
    // like the earlier tests, then manufactures the "Event was already
    // created, only the Planning step failed" state directly — the payload
    // audit's scenario, since the mock's lax transition rule makes that
    // failure mode unreachable through bookLead() itself in-process.
    const lead = await createLead(validLead);
    if (!lead.success) throw new Error("setup failed");
    const failedConversion = await bookLead(lead.data.id, { ...minimalEventSeed, title: "" });
    expect(failedConversion.success).toBe(false);

    const storedLead = await getLeadById(lead.data.id);
    const clientId = storedLead.converted_client_id as string;

    const createdEvent = await createEvent({
      ...minimalEventSeed,
      client_id: clientId,
      originating_lead_id: lead.data.id,
    });
    expect(createdEvent.success).toBe(true);
    if (!createdEvent.success) return;
    expect(createdEvent.data.lifecycle_stage).toBe("intake");

    await markClientRecoveryPending(clientId, {
      workflow: "booking",
      reason: "Simulated: Event created, Planning advance failed",
      payload: { ...minimalEventSeed, event_id: createdEvent.data.id },
    });

    const resumed = await resumeBooking(clientId, minimalEventSeed);
    expect(resumed.success).toBe(true);
    if (!resumed.success) return;

    // Same Event, now advanced — not a second one.
    expect(resumed.data.event.id).toBe(createdEvent.data.id);
    expect(resumed.data.event.lifecycle_stage).toBe("planning");

    const clientEvents = (await getEvents()).filter((e) => e.client_id === clientId);
    expect(clientEvents).toHaveLength(1);

    const storedClient = await getClientById(clientId);
    expect(storedClient.pending_recovery).toBeNull();
  });

  it("resumeBooking rejects a Client with no pending Booking recovery", async () => {
    const lead = await createLead(validLead);
    if (!lead.success) throw new Error("setup failed");
    const booked = await bookLead(lead.data.id, minimalEventSeed);
    expect(booked.success).toBe(true);
    if (!booked.success) return;

    const result = await resumeBooking(booked.data.client.id, minimalEventSeed);
    expect(result.success).toBe(false);
  });

  it("reuses an existing Client by email instead of creating a duplicate when booking a second Lead", async () => {
    const firstLead = await createLead(validLead);
    if (!firstLead.success) throw new Error("setup failed");
    const firstBooking = await bookLead(firstLead.data.id, minimalEventSeed);
    expect(firstBooking.success).toBe(true);
    if (!firstBooking.success) return;

    const secondLead = await createLead(validLead);
    if (!secondLead.success) throw new Error("setup failed");
    const secondBooking = await bookLead(secondLead.data.id, { ...minimalEventSeed, title: "Return visit" });
    expect(secondBooking.success).toBe(true);
    if (!secondBooking.success) return;

    expect(secondBooking.data.client.id).toBe(firstBooking.data.client.id);
    expect(secondBooking.data.event.id).not.toBe(firstBooking.data.event.id);
  });
});
