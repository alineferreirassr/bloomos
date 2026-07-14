import { z } from "zod";
import { NOTE_CATEGORIES } from "@/core/enums/noteCategory";
import { NOTE_PRIORITIES } from "@/core/enums/notePriority";

/** Shared by Lead notes and Client notes — one Note shape, one form schema. */
export const noteFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  content: z.string().trim().min(1, "Note content is required"),
  category: z.enum(NOTE_CATEGORIES),
  priority: z.enum(NOTE_PRIORITIES),
});

export type NoteFormInput = z.infer<typeof noteFormSchema>;
