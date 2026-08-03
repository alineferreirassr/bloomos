import { describe, expect, it } from "vitest";
import {
  eventFormSchema,
  eventDataSchema,
  scheduleItemSchema,
  scheduleItemFormSchema,
  scheduleFormToInput,
} from "@/modules/events/schema";

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

  it("rejects an end time before the start time", () => {
    const result = eventFormSchema.safeParse({
      ...validFormInput,
      start_time: "18:00",
      end_time: "17:00",
    });
    expect(result.success).toBe(false);
  });

  it("accepts an end time equal to the start time", () => {
    const result = eventFormSchema.safeParse({
      ...validFormInput,
      start_time: "18:00",
      end_time: "18:00",
    });
    expect(result.success).toBe(true);
  });

  it("does not require start/end time comparison when only one is set", () => {
    const result = eventFormSchema.safeParse({ ...validFormInput, start_time: "18:00", end_time: "" });
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

describe("scheduleItemFormSchema", () => {
  const validFormInput = {
    title: "Team arrival & setup",
    description: "",
    start_time: "17:00",
    end_time: "17:45",
    location: "El Matador State Beach",
    assigned_to: "",
    category: "arrival" as const,
  };

  it("accepts plain empty strings for nullable fields", () => {
    const result = scheduleItemFormSchema.safeParse(validFormInput);
    expect(result.success).toBe(true);
  });

  it("rejects a missing title", () => {
    const result = scheduleItemFormSchema.safeParse({ ...validFormInput, title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an end time before the start time", () => {
    const result = scheduleItemFormSchema.safeParse({ ...validFormInput, start_time: "18:00", end_time: "17:00" });
    expect(result.success).toBe(false);
  });

  it("accepts an end time equal to the start time", () => {
    const result = scheduleItemFormSchema.safeParse({ ...validFormInput, start_time: "18:00", end_time: "18:00" });
    expect(result.success).toBe(true);
  });

  it("allows either time to be blank without triggering the ordering check", () => {
    const result = scheduleItemFormSchema.safeParse({ ...validFormInput, start_time: "", end_time: "17:00" });
    expect(result.success).toBe(true);
  });
});

describe("scheduleFormToInput", () => {
  it("normalizes empty strings to null", () => {
    const input = scheduleFormToInput({
      title: "Team arrival & setup",
      description: "",
      start_time: "",
      end_time: "",
      location: "",
      assigned_to: "",
      category: "arrival",
    });
    expect(input).toEqual({
      title: "Team arrival & setup",
      description: null,
      start_time: null,
      end_time: null,
      location: null,
      assigned_to: null,
      category: "arrival",
    });
  });

  it("preserves non-empty values", () => {
    const input = scheduleFormToInput({
      title: "Photographer arrives",
      description: "Bring backup lenses",
      start_time: "18:00",
      end_time: "18:15",
      location: "El Matador State Beach",
      assigned_to: "Jamie Rivera",
      category: "photography",
    });
    expect(input.description).toBe("Bring backup lenses");
    expect(input.assigned_to).toBe("Jamie Rivera");
  });
});
