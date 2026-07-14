import { describe, expect, it } from "vitest";
import { leadFormSchema, leadDataSchema, noteFormSchema } from "@/modules/leads/schema";

const validFormInput = {
  first_name: "Sofia",
  last_name: "Marchetti",
  email: "sofia@example.com",
  phone: "",
  instagram: "",
  source: "Instagram",
  event_type: "",
  event_date: "",
  location: "",
  budget_min: "",
  budget_max: "",
  message: "",
  assigned_to: "",
};

describe("leadFormSchema", () => {
  it("accepts a fully valid, mostly-empty-optional submission", () => {
    const result = leadFormSchema.safeParse(validFormInput);
    expect(result.success).toBe(true);
  });

  it("rejects a missing first name", () => {
    const result = leadFormSchema.safeParse({ ...validFormInput, first_name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing source", () => {
    const result = leadFormSchema.safeParse({ ...validFormInput, source: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email format", () => {
    const result = leadFormSchema.safeParse({ ...validFormInput, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric budget", () => {
    const result = leadFormSchema.safeParse({ ...validFormInput, budget_min: "abc" });
    expect(result.success).toBe(false);
  });

  it("rejects budget_max lower than budget_min", () => {
    const result = leadFormSchema.safeParse({
      ...validFormInput,
      budget_min: "20000",
      budget_max: "10000",
    });
    expect(result.success).toBe(false);
  });

  it("accepts budget_max equal to budget_min", () => {
    const result = leadFormSchema.safeParse({
      ...validFormInput,
      budget_min: "10000",
      budget_max: "10000",
    });
    expect(result.success).toBe(true);
  });
});

describe("leadDataSchema", () => {
  it("normalizes empty strings to null", () => {
    const result = leadDataSchema.safeParse(validFormInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBeNull();
      expect(result.data.event_date).toBeNull();
      expect(result.data.budget_min).toBeNull();
    }
  });

  it("converts numeric strings to numbers", () => {
    const result = leadDataSchema.safeParse({
      ...validFormInput,
      budget_min: "15000",
      budget_max: "25000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.budget_min).toBe(15000);
      expect(result.data.budget_max).toBe(25000);
    }
  });
});

describe("noteFormSchema", () => {
  it("accepts a valid note", () => {
    const result = noteFormSchema.safeParse({
      title: "Allergy",
      content: "Severe shellfish allergy",
      category: "allergy",
      priority: "critical",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing title", () => {
    const result = noteFormSchema.safeParse({
      title: "",
      content: "Some content",
      category: "general",
      priority: "normal",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid category", () => {
    const result = noteFormSchema.safeParse({
      title: "Title",
      content: "Content",
      category: "not-a-real-category",
      priority: "normal",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid priority", () => {
    const result = noteFormSchema.safeParse({
      title: "Title",
      content: "Content",
      category: "general",
      priority: "urgent",
    });
    expect(result.success).toBe(false);
  });
});
