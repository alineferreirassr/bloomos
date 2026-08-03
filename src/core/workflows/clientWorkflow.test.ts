import { describe, expect, it } from "vitest";
import { getClientNextRecommendedAction } from "@/core/workflows/clientWorkflow";

const baseClient = {
  phone: "+1 555 0100",
  preferred_contact_method: "email" as const,
  partner_name: "Alex",
  favorite_colors: null,
  favorite_flowers: null,
  favorite_music: null,
  favorite_food: null,
  favorite_drinks: null,
  preferred_style: null,
  archived_at: null,
};

describe("getClientNextRecommendedAction", () => {
  it("returns null for an archived client regardless of anything else missing", () => {
    const action = getClientNextRecommendedAction(
      { ...baseClient, phone: null, archived_at: "2026-01-01T00:00:00.000Z" },
      { hasNotes: false, hasRelatedEvent: false },
    );
    expect(action).toBeNull();
  });

  it("recommends adding a phone number when missing", () => {
    const action = getClientNextRecommendedAction(
      { ...baseClient, phone: null },
      { hasNotes: true, hasRelatedEvent: true },
    );
    expect(action).toMatch(/phone number/i);
  });

  it("recommends recording preferences when none are set", () => {
    const action = getClientNextRecommendedAction(
      { ...baseClient, preferred_contact_method: null, partner_name: null },
      { hasNotes: true, hasRelatedEvent: true },
    );
    expect(action).toMatch(/preferences/i);
  });

  it("recommends adding a note when no notes exist but preferences are recorded", () => {
    const action = getClientNextRecommendedAction(baseClient, {
      hasNotes: false,
      hasRelatedEvent: true,
    });
    expect(action).toMatch(/note/i);
  });

  it("recommends creating a related event as the last fallback", () => {
    const action = getClientNextRecommendedAction(baseClient, {
      hasNotes: true,
      hasRelatedEvent: false,
    });
    expect(action).toMatch(/related event/i);
  });

  it("returns null once contact info, preferences, notes, and a related event all exist", () => {
    const action = getClientNextRecommendedAction(baseClient, {
      hasNotes: true,
      hasRelatedEvent: true,
    });
    expect(action).toBeNull();
  });
});
