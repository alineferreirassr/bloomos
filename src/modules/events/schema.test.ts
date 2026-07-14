import { describe, expect, it } from "vitest";
import { eventFormSchema, eventDataSchema, scheduleItemSchema } from "@/modules/events/schema";

const validFormInput = {
  client_id: "client_1",
  originating_lead_id: "",
  title: "Malibu Sunset Proposal",
  event_type: "proposal" as const,
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
  priority: "normal" as const,
};

describe("eventFormSchema", () => {
  it("accepts a fully valid, mostly-empty-optional submission", () => {
    const result = eventFormSchema.safeParse(validFormInput);
    expect(result.success).toBe(true);
  });

  it("rejects a missing client_id", () => {
    const result = eventFormSchema.safeParse({ ...validFormInput, client_id: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing title", () => {
    const result = eventFormSchema.safeParse({ ...validFormInput, title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid event_type", () => {
    const result = eventFormSchema.safeParse({ ...validFormInput, event_type: "not-a-type" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric budget", () => {
    const result = eventFormSchema.safeParse({ ...validFormInput, budget_min: "abc" });
    expect(result.success).toBe(false);
  });

  it("rejects budget_max below budget_min", () => {
    const result = eventFormSchema.safeParse({
      ...validFormInput,
      budget_min: "5000",
      budget_max: "1000",
    });
    expect(result.success).toBe(false);
  });

  it("accepts budget_max equal to budget_min", () => {
    const result = eventFormSchema.safeParse({
      ...validFormInput,
      budget_min: "5000",
      budget_max: "5000",
    });
    expect(result.success).toBe(true);
  });
});

describe("eventDataSchema", () => {
  it("normalizes empty strings to null", () => {
    const result = eventDataSchema.safeParse(validFormInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.event_date).toBeNull();
      expect(result.data.location_name).toBeNull();
      expect(result.data.originating_lead_id).toBeNull();
    }
  });

  it("normalizes numeric strings to numbers", () => {
    const result = eventDataSchema.safeParse({
      ...validFormInput,
      guest_count: "2",
      budget_min: "6000",
      budget_max: "9000",
      latitude: "34.0378",
      longitude: "-118.9257",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.guest_count).toBe(2);
      expect(result.data.budget_min).toBe(6000);
      expect(result.data.budget_max).toBe(9000);
      expect(result.data.latitude).toBeCloseTo(34.0378);
      expect(result.data.longitude).toBeCloseTo(-118.9257);
    }
  });

  it("preserves surprise_event as-is", () => {
    const result = eventDataSchema.safeParse({ ...validFormInput, surprise_event: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.surprise_event).toBe(true);
    }
  });
});

describe("scheduleItemSchema", () => {
  it("accepts a valid schedule item", () => {
    const result = scheduleItemSchema.safeParse({
      title: "Team arrival & setup",
      description: null,
      start_time: "17:00",
      end_time: "17:45",
      location: "El Matador State Beach",
      assigned_to: null,
      category: "arrival",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing title", () => {
    const result = scheduleItemSchema.safeParse({
      title: "",
      description: null,
      start_time: null,
      end_time: null,
      location: null,
      assigned_to: null,
      category: "arrival",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid category", () => {
    const result = scheduleItemSchema.safeParse({
      title: "Setup",
      description: null,
      start_time: null,
      end_time: null,
      location: null,
      assigned_to: null,
      category: "not-a-category",
    });
    expect(result.success).toBe(false);
  });
});
