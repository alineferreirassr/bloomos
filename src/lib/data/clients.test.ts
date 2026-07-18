import { beforeEach, describe, expect, it } from "vitest";
import {
  archiveClient,
  createClient,
  createClientNote,
  createLead,
  convertLeadToClient,
  getClientById,
  getClientNextAction,
  getClients,
  getClientsWithPendingRecovery,
  getNotesByClientId,
  getTimelineByClientId,
  markClientRecoveryPending,
  resetAllMockData,
  resolveClientRecoveryPending,
  restoreClient,
  setClientVipStatus,
  togglePinNote,
  updateClient,
  updateClientContactPreference,
  updateClientStatus,
  updateClientTags,
} from "@/lib/data";
import type { ClientFormInput } from "@/modules/clients/schema";
import type { LeadFormInput } from "@/modules/leads/schema";

const validClientInput: ClientFormInput = {
  first_name: "Priya",
  last_name: "Nair",
  email: "priya.client@example.com",
  phone: "",
  instagram: "",
  partner_name: "",
  relationship_status: "",
  address: "",
  city: "",
  state: "",
  zip_code: "",
  source: "",
  important_dates: [],
  how_they_met: "",
  first_date: "",
  relationship_anniversary: "",
  engagement_date: "",
  wedding_date: "",
  favorite_colors: "",
  favorite_flowers: "",
  favorite_music: "",
  favorite_food: "",
  favorite_drinks: "",
  preferred_style: "",
  disliked_elements: "",
  allergies: "",
  accessibility_needs: "",
  dietary_restrictions: "",
  preferred_communication_time: "",
  do_not_call: false,
  surprise_event_confidentiality: false,
  emergency_contact_name: "",
  emergency_contact_phone: "",
};

const validLeadInput: LeadFormInput = {
  first_name: "Jamie",
  last_name: "Rivera",
  email: "jamie.lead@example.com",
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

beforeEach(() => {
  resetAllMockData();
});

describe("createClient", () => {
  it("creates a Client with no originating Lead and records client_created", async () => {
    const result = await createClient(validClientInput);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.originating_lead_id).toBeNull();
    expect(result.data.internal_status).toBe("active");
    expect(result.data.is_vip).toBe(false);
    expect(result.data.tags).toEqual([]);

    const timeline = await getTimelineByClientId(result.data.id);
    expect(timeline.some((activity) => activity.type === "client_created")).toBe(true);
  });

  it("fails with field errors for invalid input", async () => {
    const result = await createClient({ ...validClientInput, email: "not-an-email" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors?.email).toBeTruthy();
  });
});

describe("Client creation from Lead conversion", () => {
  it("preserves the originating Lead reference on the new Client", async () => {
    const lead = await createLead(validLeadInput);
    if (!lead.success) throw new Error("setup failed");

    const converted = await convertLeadToClient(lead.data.id);
    expect(converted.success).toBe(true);
    if (!converted.success) return;

    expect(converted.data.client.originating_lead_id).toBe(lead.data.id);

    const stored = await getClientById(converted.data.client.id);
    expect(stored.originating_lead_id).toBe(lead.data.id);
  });
});

describe("updateClient", () => {
  it("edits profile fields and records client_updated", async () => {
    const created = await createClient(validClientInput);
    if (!created.success) throw new Error("setup failed");

    const result = await updateClient(created.data.id, {
      ...validClientInput,
      partner_name: "Sam",
      allergies: "Peanuts",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.partner_name).toBe("Sam");
    expect(result.data.allergies).toBe("Peanuts");

    const timeline = await getTimelineByClientId(created.data.id);
    expect(timeline.some((activity) => activity.type === "client_updated")).toBe(true);
  });

  it("fails for a client that doesn't exist", async () => {
    const result = await updateClient("client_does_not_exist", validClientInput);
    expect(result.success).toBe(false);
  });
});

describe("Client status behavior", () => {
  it("updateClientStatus changes internal_status and records status_changed", async () => {
    const created = await createClient(validClientInput);
    if (!created.success) throw new Error("setup failed");

    const result = await updateClientStatus(created.data.id, "planning");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.internal_status).toBe("planning");

    const timeline = await getTimelineByClientId(created.data.id);
    expect(timeline.some((activity) => activity.type === "status_changed")).toBe(true);
  });

  it("updateClientTags records tags_changed", async () => {
    const created = await createClient(validClientInput);
    if (!created.success) throw new Error("setup failed");

    const result = await updateClientTags(created.data.id, ["vip", "referral"]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.tags).toEqual(["vip", "referral"]);

    const timeline = await getTimelineByClientId(created.data.id);
    expect(timeline.some((activity) => activity.type === "tags_changed")).toBe(true);
  });

  it("setClientVipStatus records vip_status_changed", async () => {
    const created = await createClient(validClientInput);
    if (!created.success) throw new Error("setup failed");

    const result = await setClientVipStatus(created.data.id, true);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.is_vip).toBe(true);

    const timeline = await getTimelineByClientId(created.data.id);
    expect(timeline.some((activity) => activity.type === "vip_status_changed")).toBe(true);
  });

  it("updateClientContactPreference records communication_preference_changed", async () => {
    const created = await createClient(validClientInput);
    if (!created.success) throw new Error("setup failed");

    const result = await updateClientContactPreference(created.data.id, "whatsapp");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.preferred_contact_method).toBe("whatsapp");

    const timeline = await getTimelineByClientId(created.data.id);
    expect(
      timeline.some((activity) => activity.type === "communication_preference_changed"),
    ).toBe(true);
  });
});

describe("archiveClient / restoreClient", () => {
  it("archives a client, stamping archived_at and recording client_archived", async () => {
    const created = await createClient(validClientInput);
    if (!created.success) throw new Error("setup failed");

    const result = await archiveClient(created.data.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.internal_status).toBe("archived");
    expect(result.data.archived_at).not.toBeNull();

    const timeline = await getTimelineByClientId(created.data.id);
    expect(timeline.some((activity) => activity.type === "client_archived")).toBe(true);
  });

  it("refuses to archive an already-archived client", async () => {
    const created = await createClient(validClientInput);
    if (!created.success) throw new Error("setup failed");
    await archiveClient(created.data.id);

    const second = await archiveClient(created.data.id);
    expect(second.success).toBe(false);
  });

  it("restores an archived client and records client_restored", async () => {
    const created = await createClient(validClientInput);
    if (!created.success) throw new Error("setup failed");
    await archiveClient(created.data.id);

    const result = await restoreClient(created.data.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.archived_at).toBeNull();
    expect(result.data.internal_status).toBe("active");

    const timeline = await getTimelineByClientId(created.data.id);
    expect(timeline.some((activity) => activity.type === "client_restored")).toBe(true);
  });

  it("refuses to restore a client that isn't archived", async () => {
    const created = await createClient(validClientInput);
    if (!created.success) throw new Error("setup failed");

    const result = await restoreClient(created.data.id);
    expect(result.success).toBe(false);
  });
});

describe("getClients filtering", () => {
  it("excludes archived clients by default", async () => {
    const before = await getClients();
    const created = await createClient(validClientInput);
    if (!created.success) throw new Error("setup failed");
    await archiveClient(created.data.id);

    const after = await getClients();
    expect(after.length).toBe(before.length);
    expect(after.some((client) => client.id === created.data.id)).toBe(false);
  });

  it("includes archived clients when includeArchived is true", async () => {
    const created = await createClient(validClientInput);
    if (!created.success) throw new Error("setup failed");
    await archiveClient(created.data.id);

    const results = await getClients({ includeArchived: true });
    expect(results.some((client) => client.id === created.data.id)).toBe(true);
  });

  it("filters by VIP status", async () => {
    const created = await createClient(validClientInput);
    if (!created.success) throw new Error("setup failed");
    await setClientVipStatus(created.data.id, true);

    const results = await getClients({ vipOnly: true });
    expect(results.every((client) => client.is_vip)).toBe(true);
    expect(results.some((client) => client.id === created.data.id)).toBe(true);
  });

  it("filters by search text across name, email, and partner name", async () => {
    const created = await createClient({ ...validClientInput, partner_name: "Morgan Lee" });
    if (!created.success) throw new Error("setup failed");

    const results = await getClients({ search: "morgan lee" });
    expect(results.some((client) => client.id === created.data.id)).toBe(true);

    const noMatch = await getClients({ search: "no-such-client-xyz" });
    expect(noMatch.length).toBe(0);
  });
});

describe("Client notes", () => {
  it("adds a note and records note_added on the client's own timeline", async () => {
    const created = await createClient(validClientInput);
    if (!created.success) throw new Error("setup failed");

    const note = await createClientNote(created.data.id, {
      title: "Allergy",
      content: "Peanut allergy",
      category: "allergy",
      priority: "critical",
    });
    expect(note.success).toBe(true);

    const timeline = await getTimelineByClientId(created.data.id);
    expect(timeline.some((activity) => activity.type === "note_added")).toBe(true);
  });

  it("pins a note and surfaces it first in getNotesByClientId", async () => {
    const created = await createClient(validClientInput);
    if (!created.success) throw new Error("setup failed");

    await createClientNote(created.data.id, {
      title: "First",
      content: "First note",
      category: "general",
      priority: "normal",
    });
    const second = await createClientNote(created.data.id, {
      title: "Second",
      content: "Second note",
      category: "preference",
      priority: "low",
    });
    if (!second.success) throw new Error("setup failed");

    const pin = await togglePinNote(second.data.id);
    expect(pin.success).toBe(true);
    if (!pin.success) return;
    expect(pin.data.is_pinned).toBe(true);

    const notes = await getNotesByClientId(created.data.id);
    expect(notes[0].id).toBe(second.data.id);

    const timeline = await getTimelineByClientId(created.data.id);
    expect(timeline.some((activity) => activity.type === "note_pinned")).toBe(true);
  });
});

describe("getClientNextAction", () => {
  it("recommends adding a phone number for a freshly created client", async () => {
    const created = await createClient(validClientInput);
    if (!created.success) throw new Error("setup failed");

    const action = await getClientNextAction(created.data.id);
    expect(action).toMatch(/phone number/i);
  });

  it("returns null for an archived client", async () => {
    const created = await createClient(validClientInput);
    if (!created.success) throw new Error("setup failed");
    await archiveClient(created.data.id);

    const action = await getClientNextAction(created.data.id);
    expect(action).toBeNull();
  });
});

describe("getClientById", () => {
  it("throws NotFoundError for a missing client", async () => {
    await expect(getClientById("does_not_exist")).rejects.toThrow();
  });
});

describe("Client recovery-pending (Booking Workflow, Phase 2 — generic infra)", () => {
  it("marks a pending recovery with attempts=1 and a first Timeline entry", async () => {
    const created = await createClient(validClientInput);
    if (!created.success) throw new Error("setup failed");

    const result = await markClientRecoveryPending(created.data.id, {
      workflow: "booking",
      reason: "Something failed",
      payload: { title: "Draft Event" },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.pending_recovery).toMatchObject({
      workflow: "booking",
      status: "pending",
      reason: "Something failed",
      payload: { title: "Draft Event" },
      attempts: 1,
    });

    const timeline = await getTimelineByClientId(created.data.id);
    expect(timeline.some((t) => t.type === "client_recovery_pending")).toBe(true);
  });

  it("increments attempts and preserves first_attempt_at when marked again for the same workflow", async () => {
    const created = await createClient(validClientInput);
    if (!created.success) throw new Error("setup failed");

    const first = await markClientRecoveryPending(created.data.id, {
      workflow: "booking",
      reason: "First failure",
      payload: {},
    });
    expect(first.success).toBe(true);
    if (!first.success) return;
    const firstAttemptAt = first.data.pending_recovery?.first_attempt_at;

    const second = await markClientRecoveryPending(created.data.id, {
      workflow: "booking",
      reason: "Second failure",
      payload: {},
    });
    expect(second.success).toBe(true);
    if (!second.success) return;

    expect(second.data.pending_recovery?.attempts).toBe(2);
    expect(second.data.pending_recovery?.first_attempt_at).toBe(firstAttemptAt);
    expect(second.data.pending_recovery?.reason).toBe("Second failure");
  });

  it("resolveClientRecoveryPending clears the state and records a resolved Timeline entry", async () => {
    const created = await createClient(validClientInput);
    if (!created.success) throw new Error("setup failed");
    await markClientRecoveryPending(created.data.id, { workflow: "booking", reason: "x", payload: {} });

    const resolved = await resolveClientRecoveryPending(created.data.id);
    expect(resolved.success).toBe(true);
    if (!resolved.success) return;
    expect(resolved.data.pending_recovery).toBeNull();

    const timeline = await getTimelineByClientId(created.data.id);
    expect(timeline.some((t) => t.type === "client_recovery_resolved")).toBe(true);
  });

  it("resolveClientRecoveryPending fails for a Client with no pending recovery", async () => {
    const created = await createClient(validClientInput);
    if (!created.success) throw new Error("setup failed");

    const resolved = await resolveClientRecoveryPending(created.data.id);
    expect(resolved.success).toBe(false);
  });

  it("getClientsWithPendingRecovery filters by workflow and excludes resolved clients", async () => {
    const clientA = await createClient(validClientInput);
    if (!clientA.success) throw new Error("setup failed");
    const clientB = await createClient({ ...validClientInput, email: "second.client@example.com" });
    if (!clientB.success) throw new Error("setup failed");

    await markClientRecoveryPending(clientA.data.id, { workflow: "booking", reason: "x", payload: {} });
    await markClientRecoveryPending(clientB.data.id, { workflow: "some_other_workflow", reason: "y", payload: {} });

    const bookingOnly = await getClientsWithPendingRecovery("booking");
    expect(bookingOnly.map((c) => c.id)).toEqual([clientA.data.id]);

    const everything = await getClientsWithPendingRecovery();
    expect(everything.map((c) => c.id).sort()).toEqual([clientA.data.id, clientB.data.id].sort());

    await resolveClientRecoveryPending(clientA.data.id);
    const afterResolve = await getClientsWithPendingRecovery("booking");
    expect(afterResolve.some((c) => c.id === clientA.data.id)).toBe(false);
  });
});
