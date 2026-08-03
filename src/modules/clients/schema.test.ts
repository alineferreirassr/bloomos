import { describe, expect, it } from "vitest";
import { clientFormSchema, clientDataSchema } from "@/modules/clients/schema";

const validFormInput = {
  first_name: "Naomi",
  last_name: "Whitfield",
  email: "naomi@example.com",
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
  favorite_restaurants: "",
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

describe("clientFormSchema", () => {
  it("accepts a fully valid, mostly-empty-optional submission", () => {
    const result = clientFormSchema.safeParse(validFormInput);
    expect(result.success).toBe(true);
  });

  it("rejects a missing first name", () => {
    const result = clientFormSchema.safeParse({ ...validFormInput, first_name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing last name", () => {
    const result = clientFormSchema.safeParse({ ...validFormInput, last_name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email format", () => {
    const result = clientFormSchema.safeParse({ ...validFormInput, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("does not require a source, unlike a Lead", () => {
    const result = clientFormSchema.safeParse({ ...validFormInput, source: "" });
    expect(result.success).toBe(true);
  });

  it("rejects an important date missing a label", () => {
    const result = clientFormSchema.safeParse({
      ...validFormInput,
      important_dates: [{ id: "d1", label: "", date: "2026-01-01" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("clientDataSchema", () => {
  it("normalizes empty strings to null", () => {
    const result = clientDataSchema.safeParse(validFormInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBeNull();
      expect(result.data.partner_name).toBeNull();
      expect(result.data.allergies).toBeNull();
    }
  });

  it("preserves important_dates and boolean flags as-is", () => {
    const result = clientDataSchema.safeParse({
      ...validFormInput,
      important_dates: [{ id: "d1", label: "First date", date: "2026-01-01" }],
      do_not_call: true,
      surprise_event_confidentiality: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.important_dates).toEqual([
        { id: "d1", label: "First date", date: "2026-01-01" },
      ]);
      expect(result.data.do_not_call).toBe(true);
      expect(result.data.surprise_event_confidentiality).toBe(true);
    }
  });
});
