import { z } from "zod";
import { CHECKLIST_CATEGORIES } from "@/core/enums/checklistCategory";
import { NOTE_PRIORITIES } from "@/core/enums/notePriority";
import { ASSIGNED_TYPES } from "@/core/enums/assignedType";

/**
 * A reusable checklist item — owner-agnostic like modules/notes/schema.ts,
 * not Event-specific. No separate form/data split yet: no checklist UI
 * exists at this checkpoint, so fields are typed directly rather than as
 * raw HTML form-input strings.
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
});

export type ChecklistItemInput = z.infer<typeof checklistItemSchema>;
