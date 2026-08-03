import { describe, expect, it } from "vitest";
import { checklistFormToInput, checklistItemFormSchema, checklistItemSchema } from "@/modules/checklist/schema";

const validInput = {
  title: "Book photographer",
  description: null,
  category: "photography" as const,
  priority: "high" as const,
  due_date: "2026-08-10",
  assigned_type: "unknown" as const,
  assigned_id: null,
  assigned_name: null,
};

describe("checklistItemSchema", () => {
  it("accepts a valid checklist item", () => {
    const result = checklistItemSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("rejects a missing title", () => {
    const result = checklistItemSchema.safeParse({ ...validInput, title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid category", () => {
    const result = checklistItemSchema.safeParse({ ...validInput, category: "not-a-category" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid priority", () => {
    const result = checklistItemSchema.safeParse({ ...validInput, priority: "urgent" });
    expect(result.success).toBe(false);
  });

  it("accepts null description, due_date, assigned_id, and assigned_name", () => {
    const result = checklistItemSchema.safeParse({
      ...validInput,
      description: null,
      due_date: null,
      assigned_id: null,
      assigned_name: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid assigned_type", () => {
    const result = checklistItemSchema.safeParse({ ...validInput, assigned_type: "robot" });
    expect(result.success).toBe(false);
  });
});

describe("checklistItemFormSchema", () => {
  const validFormInput = {
    title: "Book photographer",
    description: "",
    category: "photography" as const,
    priority: "high" as const,
    due_date: "",
    assigned_type: "unknown" as const,
    assigned_name: "",
    client_visible: false,
  };

  it("accepts plain empty strings for nullable fields", () => {
    const result = checklistItemFormSchema.safeParse(validFormInput);
    expect(result.success).toBe(true);
  });

  it("rejects a missing title", () => {
    const result = checklistItemFormSchema.safeParse({ ...validFormInput, title: "" });
    expect(result.success).toBe(false);
  });
});

describe("checklistFormToInput", () => {
  it("normalizes empty strings to null and forces assigned_id to null", () => {
    const input = checklistFormToInput({
      title: "Book photographer",
      description: "",
      category: "photography",
      priority: "high",
      due_date: "",
      assigned_type: "employee",
      assigned_name: "",
      client_visible: false,
    });
    expect(input).toEqual({
      title: "Book photographer",
      description: null,
      category: "photography",
      priority: "high",
      due_date: null,
      assigned_type: "employee",
      assigned_id: null,
      assigned_name: null,
      client_visible: false,
    });
  });

  it("preserves non-empty values", () => {
    const input = checklistFormToInput({
      title: "Confirm florist",
      description: "Call before Friday",
      category: "flowers",
      priority: "normal",
      due_date: "2026-08-10",
      assigned_type: "vendor",
      assigned_name: "Bloom & Co",
      client_visible: true,
    });
    expect(input.description).toBe("Call before Friday");
    expect(input.due_date).toBe("2026-08-10");
    expect(input.assigned_name).toBe("Bloom & Co");
  });
});
