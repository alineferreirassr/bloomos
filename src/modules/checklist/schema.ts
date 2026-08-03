import { z } from "zod";
import { CHECKLIST_CATEGORIES } from "@/core/enums/checklistCategory";
import { NOTE_PRIORITIES } from "@/core/enums/notePriority";
import { ASSIGNED_TYPES } from "@/core/enums/assignedType";

/**
 * A reusable checklist item — owner-agnostic like modules/notes/schema.ts,
 * not Event-specific. This is the authoritative schema, used inside the
 * data layer (lib/data/index.ts createChecklistItem/updateChecklistItem) —
 * nullable fields are real `null`, not "".
 *
 * assigned_type/assigned_id/assigned_name generalize assignment the same
 * way owner_type/owner_id generalize ownership — see types/checklistItem.ts.
 */
export const checklistItemSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().nullable(),
  category: z.enum(CHECKLIST_CATEGORIES),
  priority: z.enum(NOTE_PRIORITIES),
  due_date: z.string().trim().nullable(),
  assigned_type: z.enum(ASSIGNED_TYPES),
  assigned_id: z.string().trim().nullable(),
  assigned_name: z.string().trim().nullable(),
  /** Checkpoint 36, Step 17 — whether this item appears in the client's own Task Center (`types/checklistItem.ts`). Gated by `client_portal.manage` in `ChecklistItemForm.tsx`; optional here since most callers never touch it. */
  client_visible: z.boolean().optional(),
});

export type ChecklistItemInput = z.infer<typeof checklistItemSchema>;

/**
 * Client-side (react-hook-form) schema for the Checklist Item create/edit
 * form — every field is a plain string, matching what HTML form inputs
 * actually produce, mirroring the eventFormSchema/eventDataSchema split in
 * modules/events/schema.ts. `status` is deliberately excluded: it's changed
 * only through the dedicated updateChecklistItemStatus/completeChecklistItem
 * functions (see ChecklistItemForm), so it carries its own centralized
 * timeline entry instead of being buried in a generic item update.
 */
export const checklistItemFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim(),
  category: z.enum(CHECKLIST_CATEGORIES),
  priority: z.enum(NOTE_PRIORITIES),
  due_date: z.string().trim(),
  assigned_type: z.enum(ASSIGNED_TYPES),
  assigned_name: z.string().trim(),
  client_visible: z.boolean(),
});

export type ChecklistItemFormInput = z.infer<typeof checklistItemFormSchema>;

/** Normalizes "" -> null into the shape checklistItemSchema/the data layer expects. assigned_id stays null — no Employee/Vendor module exists yet to supply a real id. */
export function checklistFormToInput(data: ChecklistItemFormInput): ChecklistItemInput {
  return {
    title: data.title,
    description: data.description === "" ? null : data.description,
    category: data.category,
    priority: data.priority,
    due_date: data.due_date === "" ? null : data.due_date,
    assigned_type: data.assigned_type,
    assigned_id: null,
    assigned_name: data.assigned_name === "" ? null : data.assigned_name,
    client_visible: data.client_visible,
  };
}
