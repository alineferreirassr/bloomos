import { minorToMajor, majorToMinor } from "@/lib/money";
import type { TemplateFieldDescriptor } from "@/modules/services/templateCategoryAdapters";

/** The Inspector form's local, uncontrolled-input-friendly representation — every field kind collapses to a string except `boolean`, which stays a real boolean for the Checkbox primitive. */
export type TemplateFieldFormValue = string | boolean;
export type TemplateFieldFormValues = Record<string, TemplateFieldFormValue>;

/** `row` is `null` when building the "Add new" form's defaults. Reads `field.name` off `row` via bracket access — every field name is chosen to match the domain row's own property name exactly (see templateCategoryAdapters.ts), so this one function works for all 16 categories without per-category conversion code. */
export function toFieldFormValue(field: TemplateFieldDescriptor, row: Record<string, unknown> | null): TemplateFieldFormValue {
  if (field.kind === "boolean") return row ? Boolean(row[field.name]) : false;
  const raw = row ? row[field.name] : null;
  if (raw === null || raw === undefined) return "";
  if (field.kind === "money") return String(minorToMajor(raw as number));
  if (field.kind === "list") return Array.isArray(raw) ? raw.join(", ") : "";
  return String(raw);
}

export function buildFormValues(fields: TemplateFieldDescriptor[], row: Record<string, unknown> | null): TemplateFieldFormValues {
  const values: TemplateFieldFormValues = {};
  for (const field of fields) values[field.name] = toFieldFormValue(field, row);
  return values;
}

/** The inverse of `toFieldFormValue` — converts one field's form value back to the shape its Input type expects. Locale-safe: form values always come from `type="number"`/plain text inputs, whose `.value` is always period-decimal regardless of display locale, so `Number()` never needs its own parsing. */
export function fromFieldFormValue(field: TemplateFieldDescriptor, value: TemplateFieldFormValue): unknown {
  if (field.kind === "boolean") return Boolean(value);
  const str = typeof value === "string" ? value.trim() : "";
  if (field.kind === "number") {
    if (str === "") return field.nullable ? null : 0;
    return Number(str);
  }
  if (field.kind === "money") {
    if (str === "") return field.nullable ? null : 0;
    return majorToMinor(Number(str));
  }
  if (field.kind === "list") {
    const items = str
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (items.length === 0) return field.nullable ? null : [];
    return items;
  }
  // text, textarea, select
  if (str === "") return field.nullable ? null : "";
  return str;
}

export function buildInput<TInput extends Record<string, unknown>>(fields: TemplateFieldDescriptor[], values: TemplateFieldFormValues): TInput {
  const input: Record<string, unknown> = {};
  for (const field of fields) input[field.name] = fromFieldFormValue(field, values[field.name]);
  return input as TInput;
}
