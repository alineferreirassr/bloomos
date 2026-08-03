import { describe, expect, it } from "vitest";
import { toFieldFormValue, fromFieldFormValue, buildFormValues, buildInput } from "@/modules/services/templateFieldValues";
import type { TemplateFieldDescriptor } from "@/modules/services/templateCategoryAdapters";

const textField: TemplateFieldDescriptor = { name: "label", label: "Label", kind: "text", required: true };
const nullableTextField: TemplateFieldDescriptor = { name: "description", label: "Description", kind: "textarea", nullable: true };
const numberField: TemplateFieldDescriptor = { name: "quantity", label: "Quantity", kind: "number" };
const nullableNumberField: TemplateFieldDescriptor = { name: "due_offset_days", label: "Due", kind: "number", nullable: true };
const moneyField: TemplateFieldDescriptor = { name: "price_delta_minor", label: "Price", kind: "money" };
const booleanField: TemplateFieldDescriptor = { name: "is_required", label: "Required", kind: "boolean" };
const selectField: TemplateFieldDescriptor = { name: "category", label: "Category", kind: "select", options: [{ value: "a", label: "A" }] };
const listField: TemplateFieldDescriptor = { name: "options", label: "Options", kind: "list", nullable: true };

describe("toFieldFormValue", () => {
  it("converts a money minor-unit value to a major-unit string", () => {
    expect(toFieldFormValue(moneyField, { price_delta_minor: 12550 })).toBe("125.5");
  });

  it("converts null to an empty string for nullable text fields", () => {
    expect(toFieldFormValue(nullableTextField, { description: null })).toBe("");
  });

  it("converts a list field to a comma-separated string", () => {
    expect(toFieldFormValue(listField, { options: ["Red", "Blue"] })).toBe("Red, Blue");
  });

  it("converts a null list field to an empty string", () => {
    expect(toFieldFormValue(listField, { options: null })).toBe("");
  });

  it("reads booleans directly, defaulting to false for a null row (new item)", () => {
    expect(toFieldFormValue(booleanField, null)).toBe(false);
    expect(toFieldFormValue(booleanField, { is_required: true })).toBe(true);
  });

  it("defaults every non-boolean field to an empty string for a null row", () => {
    expect(toFieldFormValue(textField, null)).toBe("");
    expect(toFieldFormValue(numberField, null)).toBe("");
    expect(toFieldFormValue(moneyField, null)).toBe("");
  });
});

describe("fromFieldFormValue", () => {
  it("converts a major-unit money string back to an integer minor-unit value", () => {
    expect(fromFieldFormValue(moneyField, "125.50")).toBe(12550);
  });

  it("converts an empty number field to null when nullable, 0 when not", () => {
    expect(fromFieldFormValue(nullableNumberField, "")).toBeNull();
    expect(fromFieldFormValue(numberField, "")).toBe(0);
  });

  it("converts an empty text field to null when nullable, empty string when not", () => {
    expect(fromFieldFormValue(nullableTextField, "")).toBeNull();
    expect(fromFieldFormValue(textField, "")).toBe("");
  });

  it("splits a comma-separated list field into a trimmed, non-empty array", () => {
    expect(fromFieldFormValue(listField, "Red,  Blue ,")).toEqual(["Red", "Blue"]);
  });

  it("converts an empty list field to null when nullable", () => {
    expect(fromFieldFormValue(listField, "")).toBeNull();
  });

  it("passes select values straight through", () => {
    expect(fromFieldFormValue(selectField, "a")).toBe("a");
  });

  it("coerces booleans", () => {
    expect(fromFieldFormValue(booleanField, true)).toBe(true);
    expect(fromFieldFormValue(booleanField, false)).toBe(false);
  });
});

describe("buildFormValues / buildInput round-trip", () => {
  const fields = [textField, nullableTextField, moneyField];

  it("round-trips a row through form values and back to an equivalent input", () => {
    const row = { label: "Add-on", description: null, price_delta_minor: 5000 };
    const values = buildFormValues(fields, row);
    const input = buildInput<typeof row>(fields, values);
    expect(input).toEqual({ label: "Add-on", description: null, price_delta_minor: 5000 });
  });
});
