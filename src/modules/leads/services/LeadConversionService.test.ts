import { beforeEach, describe, expect, it } from "vitest";
import { convertLeadToClient } from "@/modules/leads/services/LeadConversionService";
import {
  createLead,
  createNote,
  getClientById,
  getNotesByLeadId,
  getTimelineByLeadId,
  resetAllMockData,
} from "@/lib/data";
import type { LeadFormInput } from "@/modules/leads/schema";

const validInput: LeadFormInput = {
  first_name: "Priya",
  last_name: "Nair",
  email: "priya@example.com",
  phone: "+1 555 0100",
  instagram: "",
  source: "Website",
  event_type: "Proposal",
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

describe("convertLeadToClient", () => {
  it("creates a Client carrying the Lead's info, links converted_client_id, and marks the Lead converted", async () => {
    const created = await createLead(validInput);
    if (!created.success) throw new Error("setup failed");

    const result = await convertLeadToClient(created.data.id);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.lead.status).toBe("converted");
    expect(result.data.lead.converted_client_id).toBe(result.data.client.id);
    expect(result.data.client.first_name).toBe("Priya");
    expect(result.data.client.email).toBe("priya@example.com");
    expect(result.data.client.origin_lead_id).toBe(created.data.id);

    const storedClient = await getClientById(result.data.client.id);
    expect(storedClient.id).toBe(result.data.client.id);
  });

  it("prevents converting the same lead twice", async () => {
    const created = await createLead(validInput);
    if (!created.success) throw new Error("setup failed");

    const first = await convertLeadToClient(created.data.id);
    expect(first.success).toBe(true);

    const second = await convertLeadToClient(created.data.id);
    expect(second.success).toBe(false);
    if (second.success) return;
    expect(second.error).toMatch(/already been converted/i);
  });

  it("fails for a lead that doesn't exist", async () => {
    const result = await convertLeadToClient("lead_does_not_exist");
    expect(result.success).toBe(false);
  });

  it("preserves existing notes and timeline history, appending exactly one new activity", async () => {
    const created = await createLead(validInput);
    if (!created.success) throw new Error("setup failed");

    await createNote(created.data.id, {
      title: "Preference",
      content: "Prefers sunset timing",
      category: "preference",
      priority: "normal",
    });

    const notesBefore = await getNotesByLeadId(created.data.id);
    const timelineBefore = await getTimelineByLeadId(created.data.id);

    const result = await convertLeadToClient(created.data.id);
    expect(result.success).toBe(true);

    const notesAfter = await getNotesByLeadId(created.data.id);
    const timelineAfter = await getTimelineByLeadId(created.data.id);

    expect(notesAfter).toEqual(notesBefore);
    expect(timelineAfter.length).toBe(timelineBefore.length + 1);
    expect(timelineAfter.some((activity) => activity.type === "lead_converted")).toBe(true);
    for (const activity of timelineBefore) {
      expect(timelineAfter).toContainEqual(activity);
    }
  });
});
