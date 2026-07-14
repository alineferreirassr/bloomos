import { beforeEach, describe, expect, it } from "vitest";
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
  updateLeadStatus,
} from "@/lib/data";
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
});

describe("getLeadById", () => {
  it("throws NotFoundError for a missing lead", async () => {
    await expect(getLeadById("does_not_exist")).rejects.toThrow();
  });
});
