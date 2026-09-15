import { beforeEach, describe, expect, it, vi } from "vitest";

// SOCIAL-13E — findOrCreateInstagramLead (instagramLeadCapture.ts) has a
// real `import "server-only"` at module scope, mirroring every other narrow
// service-role boundary in this codebase (see e.g. SOCIAL-12C/13C's own
// established mock for this exact reason).
vi.mock("server-only", () => ({}));

import {
  archiveLead,
  convertLeadToClient,
  createLead,
  createNote,
  getLeadById,
  getLeads,
  getNotesByLeadId,
  getTimelineByLeadId,
  markWelcomeGuideSent,
  resetAllMockData,
  togglePinNote,
  updateLead,
  updateLeadAssignment,
  updateLeadStatus,
} from "@/lib/data";
import { findOrCreateInstagramLead } from "@/core/automation/instagramLeadCapture";
import type { LeadFormInput } from "@/modules/leads/schema";

const validInput: LeadFormInput = {
  first_name: "Jamie",
  last_name: "Rivera",
  email: "jamie@example.com",
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

describe("createLead", () => {
  it("creates a lead with status new and records a lead_created timeline entry", async () => {
    const result = await createLead(validInput);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.status).toBe("new");
    expect(result.data.first_name).toBe("Jamie");

    const timeline = await getTimelineByLeadId(result.data.id);
    expect(timeline.some((activity) => activity.type === "lead_created")).toBe(true);
  });

  it("fails with field errors for invalid input", async () => {
    const result = await createLead({ ...validInput, email: "not-an-email" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors?.email).toBeTruthy();
  });
});

describe("updateLead", () => {
  it("edits a lead's fields and records a lead_updated timeline entry", async () => {
    const created = await createLead(validInput);
    if (!created.success) throw new Error("setup failed");

    const result = await updateLead(created.data.id, { ...validInput, first_name: "Jamie-Updated" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.first_name).toBe("Jamie-Updated");

    const timeline = await getTimelineByLeadId(created.data.id);
    expect(timeline.some((activity) => activity.type === "lead_updated")).toBe(true);
  });

  it("fails for a lead that doesn't exist", async () => {
    const result = await updateLead("lead_does_not_exist", validInput);
    expect(result.success).toBe(false);
  });

  it("refuses to edit a lead that has been converted to a Client", async () => {
    const created = await createLead(validInput);
    if (!created.success) throw new Error("setup failed");
    const converted = await convertLeadToClient(created.data.id);
    expect(converted.success).toBe(true);

    const result = await updateLead(created.data.id, { ...validInput, first_name: "Should Not Apply" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/read-only/i);
  });
});

describe("updateLeadAssignment — SOCIAL-13E", () => {
  it("assigns a normal, manually-created lead and preserves every other field", async () => {
    const created = await createLead(validInput);
    if (!created.success) throw new Error("setup failed");

    const result = await updateLeadAssignment(created.data.workspace_id, created.data.id, "Aline Ferreira");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.assigned_to).toBe("Aline Ferreira");
    expect(result.data).toMatchObject({ ...created.data, assigned_to: "Aline Ferreira", updated_at: result.data.updated_at });

    const timeline = await getTimelineByLeadId(created.data.id);
    expect(timeline.some((activity) => activity.type === "lead_updated" && activity.description.includes("Assigned to Aline Ferreira"))).toBe(true);
  });

  it("assigns an Instagram-originated Lead with null first_name/last_name/email — the full-form updateLead() path would reject this", async () => {
    const captured = await findOrCreateInstagramLead({
      workspaceId: "ws_instagram_1",
      source: "Instagram",
      instagramExternalId: "17841400000000001",
      instagram: "@curious_bride",
      message: "Do you have June availability?",
      firstName: null,
      lastName: null,
      email: null,
    });
    if (!captured.success) throw new Error("setup failed");
    expect(captured.data.lead.first_name).toBeNull();

    const result = await updateLeadAssignment("ws_instagram_1", captured.data.lead.id, "Aline Ferreira");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.assigned_to).toBe("Aline Ferreira");
    // Every other field — including the still-null identity fields — is untouched.
    expect(result.data.first_name).toBeNull();
    expect(result.data.last_name).toBeNull();
    expect(result.data.email).toBeNull();
    expect(result.data.instagram).toBe("@curious_bride");
    expect(result.data.instagram_external_id).toBe("17841400000000001");
    expect(result.data.message).toBe("Do you have June availability?");
  });

  it("unassigns a Lead — an empty string is normalized to null, mirroring the existing free-text semantics", async () => {
    const created = await createLead({ ...validInput, assigned_to: "Aline Ferreira" });
    if (!created.success) throw new Error("setup failed");
    expect(created.data.assigned_to).toBe("Aline Ferreira");

    const result = await updateLeadAssignment(created.data.workspace_id, created.data.id, "");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.assigned_to).toBeNull();
  });

  it("fails for a lead that doesn't exist", async () => {
    const result = await updateLeadAssignment("ws_1", "lead_does_not_exist", "Aline Ferreira");
    expect(result.success).toBe(false);
  });

  it("workspace-scoped — a lead resolved with the wrong workspace id is treated as not found, never assigned", async () => {
    const created = await createLead(validInput);
    if (!created.success) throw new Error("setup failed");

    const result = await updateLeadAssignment("ws_completely_different", created.data.id, "Aline Ferreira");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/not found/i);

    // Confirm it was genuinely never touched.
    const stillUnassigned = await getLeadById(created.data.id);
    expect(stillUnassigned.assigned_to).toBeNull();
  });

  it("refuses to assign a lead that has already been converted to a Client, same read-only rule as updateLead", async () => {
    const created = await createLead(validInput);
    if (!created.success) throw new Error("setup failed");
    const converted = await convertLeadToClient(created.data.id);
    expect(converted.success).toBe(true);

    const result = await updateLeadAssignment(created.data.workspace_id, created.data.id, "Aline Ferreira");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/read-only/i);
  });
});

describe("archiveLead", () => {
  it("sets status to archived and stamps archived_at", async () => {
    const created = await createLead(validInput);
    if (!created.success) throw new Error("setup failed");

    const result = await archiveLead(created.data.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("archived");
    expect(result.data.archived_at).not.toBeNull();
  });

  it("refuses to archive an already-archived lead", async () => {
    const created = await createLead(validInput);
    if (!created.success) throw new Error("setup failed");
    await archiveLead(created.data.id);

    const second = await archiveLead(created.data.id);
    expect(second.success).toBe(false);
  });
});

describe("updateLeadStatus", () => {
  it("allows a legal transition and records status_changed", async () => {
    const created = await createLead(validInput);
    if (!created.success) throw new Error("setup failed");

    const result = await updateLeadStatus(created.data.id, "qualified");
    expect(result.success).toBe(true);

    const timeline = await getTimelineByLeadId(created.data.id);
    expect(timeline.some((activity) => activity.type === "status_changed")).toBe(true);
  });

  it("refuses to move directly into converted via the status endpoint", async () => {
    const created = await createLead(validInput);
    if (!created.success) throw new Error("setup failed");

    const result = await updateLeadStatus(created.data.id, "converted");
    expect(result.success).toBe(false);
  });

  it("refuses any status change once a lead is archived", async () => {
    const created = await createLead(validInput);
    if (!created.success) throw new Error("setup failed");
    await archiveLead(created.data.id);

    const result = await updateLeadStatus(created.data.id, "contacted");
    expect(result.success).toBe(false);
  });
});

describe("markWelcomeGuideSent", () => {
  it("advances a new lead to welcome_guide_sent and records the activity", async () => {
    const created = await createLead(validInput);
    if (!created.success) throw new Error("setup failed");

    const result = await markWelcomeGuideSent(created.data.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("welcome_guide_sent");

    const timeline = await getTimelineByLeadId(created.data.id);
    expect(timeline.some((activity) => activity.type === "welcome_guide_sent")).toBe(true);
  });

  it("does not move a lead backward if it's already further along", async () => {
    const created = await createLead(validInput);
    if (!created.success) throw new Error("setup failed");
    await updateLeadStatus(created.data.id, "qualified");

    const result = await markWelcomeGuideSent(created.data.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("qualified");
  });
});

describe("notes", () => {
  it("adds a note and records note_added", async () => {
    const created = await createLead(validInput);
    if (!created.success) throw new Error("setup failed");

    const note = await createNote(created.data.id, {
      title: "Allergy",
      content: "Shellfish allergy",
      category: "allergy",
      priority: "critical",
    });
    expect(note.success).toBe(true);

    const timeline = await getTimelineByLeadId(created.data.id);
    expect(timeline.some((activity) => activity.type === "note_added")).toBe(true);
  });

  it("pins a note and surfaces it first in getNotesByLeadId", async () => {
    const created = await createLead(validInput);
    if (!created.success) throw new Error("setup failed");

    await createNote(created.data.id, {
      title: "First",
      content: "First note",
      category: "general",
      priority: "normal",
    });
    const second = await createNote(created.data.id, {
      title: "Second",
      content: "Second note",
      category: "idea",
      priority: "low",
    });
    if (!second.success) throw new Error("setup failed");

    const pin = await togglePinNote(second.data.id);
    expect(pin.success).toBe(true);
    if (!pin.success) return;
    expect(pin.data.is_pinned).toBe(true);

    const notes = await getNotesByLeadId(created.data.id);
    expect(notes[0].id).toBe(second.data.id);

    const timeline = await getTimelineByLeadId(created.data.id);
    expect(timeline.some((activity) => activity.type === "note_pinned")).toBe(true);
  });

  it("unpins a previously pinned note", async () => {
    const created = await createLead(validInput);
    if (!created.success) throw new Error("setup failed");
    const note = await createNote(created.data.id, {
      title: "Note",
      content: "Content",
      category: "general",
      priority: "normal",
    });
    if (!note.success) throw new Error("setup failed");

    await togglePinNote(note.data.id);
    const unpinned = await togglePinNote(note.data.id);
    expect(unpinned.success).toBe(true);
    if (!unpinned.success) return;
    expect(unpinned.data.is_pinned).toBe(false);
  });
});

describe("getLeads filtering", () => {
  it("excludes archived leads by default", async () => {
    const before = await getLeads();
    const created = await createLead(validInput);
    if (!created.success) throw new Error("setup failed");
    await archiveLead(created.data.id);

    const after = await getLeads();
    expect(after.length).toBe(before.length);
    expect(after.some((lead) => lead.id === created.data.id)).toBe(false);
  });

  it("includes archived leads when includeArchived is true", async () => {
    const created = await createLead(validInput);
    if (!created.success) throw new Error("setup failed");
    await archiveLead(created.data.id);

    const results = await getLeads({ includeArchived: true });
    expect(results.some((lead) => lead.id === created.data.id)).toBe(true);
  });

  it("filters by status", async () => {
    const created = await createLead(validInput);
    if (!created.success) throw new Error("setup failed");
    await updateLeadStatus(created.data.id, "qualified");

    const results = await getLeads({ status: "qualified" });
    expect(results.every((lead) => lead.status === "qualified")).toBe(true);
    expect(results.some((lead) => lead.id === created.data.id)).toBe(true);
  });

  it("filters by search text across name and email", async () => {
    const created = await createLead(validInput);
    if (!created.success) throw new Error("setup failed");

    const results = await getLeads({ search: "jamie" });
    expect(results.some((lead) => lead.id === created.data.id)).toBe(true);

    const noMatch = await getLeads({ search: "no-such-lead-xyz" });
    expect(noMatch.length).toBe(0);
  });

  it("SOCIAL-13F — unassignedOnly returns only leads with no assigned_to, including an Instagram-originated Lead", async () => {
    const unassigned = await createLead(validInput);
    if (!unassigned.success) throw new Error("setup failed");
    expect(unassigned.data.assigned_to).toBeNull();

    const assigned = await createLead({ ...validInput, assigned_to: "Aline Ferreira" });
    if (!assigned.success) throw new Error("setup failed");

    const instagramLead = await findOrCreateInstagramLead({
      workspaceId: unassigned.data.workspace_id,
      source: "Instagram",
      instagramExternalId: "17841400000000001",
      instagram: "@curious_bride",
      message: "Do you have June availability?",
      firstName: null,
      lastName: null,
      email: null,
    });
    if (!instagramLead.success) throw new Error("setup failed");
    expect(instagramLead.data.lead.assigned_to).toBeNull();

    const results = await getLeads({ unassignedOnly: true });

    expect(results.some((lead) => lead.id === unassigned.data.id)).toBe(true);
    expect(results.some((lead) => lead.id === instagramLead.data.lead.id)).toBe(true);
    expect(results.some((lead) => lead.id === assigned.data.id)).toBe(false);
  });

  it("SOCIAL-13F — a Lead assigned via updateLeadAssignment stops appearing in the unassignedOnly filter; unassigning it returns it", async () => {
    const created = await createLead(validInput);
    if (!created.success) throw new Error("setup failed");

    await updateLeadAssignment(created.data.workspace_id, created.data.id, "Aline Ferreira");
    const afterAssign = await getLeads({ unassignedOnly: true });
    expect(afterAssign.some((lead) => lead.id === created.data.id)).toBe(false);

    await updateLeadAssignment(created.data.workspace_id, created.data.id, "");
    const afterUnassign = await getLeads({ unassignedOnly: true });
    expect(afterUnassign.some((lead) => lead.id === created.data.id)).toBe(true);
  });
});

describe("getLeadById", () => {
  it("throws NotFoundError for a missing lead", async () => {
    await expect(getLeadById("does_not_exist")).rejects.toThrow();
  });
});
