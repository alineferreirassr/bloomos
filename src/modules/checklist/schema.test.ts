import { describe, expect, it } from "vitest";
import { checklistItemSchema } from "@/modules/checklist/schema";

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
