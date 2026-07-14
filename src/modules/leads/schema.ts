import { z } from "zod";
import { NOTE_CATEGORIES } from "@/core/enums/noteCategory";
import { NOTE_PRIORITIES } from "@/core/enums/notePriority";

/**
 * Client-side (react-hook-form) schema. Every field is a plain string —
 * matching what HTML form inputs actually produce — so the zodResolver's
 * input/output types line up exactly with useForm's TFieldValues. Turning
 * "" into null and numeric strings into numbers happens once, authoritatively,
 * in leadDataSchema below (used only by the data layer, not the form).
 */
export const leadFormSchema = z
  .object({
    first_name: z.string().trim().min(1, "First name is required"),
    last_name: z.string().trim().min(1, "Last name is required"),
    email: z
      .string()
      .trim()
      .min(1, "Email is required")
      .email("Enter a valid email address"),
    phone: z.string().trim(),
    instagram: z.string().trim(),
    source: z.string().trim().min(1, "Source is required"),
    event_type: z.string().trim(),
    event_date: z.string().trim(),
    location: z.string().trim(),
    budget_min: z
      .string()
      .trim()
      .refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0), {
        message: "Enter a valid number",
      }),
    budget_max: z
      .string()
      .trim()
      .refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0), {
        message: "Enter a valid number",
      }),
    message: z.string().trim(),
    assigned_to: z.string().trim(),
  })
  .refine(
    (data) =>
      data.budget_min === "" ||
      data.budget_max === "" ||
      Number(data.budget_max) >= Number(data.budget_min),
    {
      message: "Maximum budget must be greater than or equal to minimum budget",
      path: ["budget_max"],
    },
  );

export type LeadFormInput = z.infer<typeof leadFormSchema>;

/**
 * Authoritative schema, used only inside the data layer (lib/data/index.ts).
 * Re-validates independently of whatever the form already checked, and
 * normalizes "" -> null / numeric strings -> numbers into the shape stored
 * on a Lead.
 */
export const leadDataSchema = leadFormSchema.transform((data) => ({
  first_name: data.first_name,
  last_name: data.last_name,
  email: data.email,
  phone: data.phone === "" ? null : data.phone,
  instagram: data.instagram === "" ? null : data.instagram,
  source: data.source,
  event_type: data.event_type === "" ? null : data.event_type,
  event_date: data.event_date === "" ? null : data.event_date,
  location: data.location === "" ? null : data.location,
  budget_min: data.budget_min === "" ? null : Number(data.budget_min),
  budget_max: data.budget_max === "" ? null : Number(data.budget_max),
  message: data.message === "" ? null : data.message,
  assigned_to: data.assigned_to === "" ? null : data.assigned_to,
}));

export type LeadDataInput = z.infer<typeof leadDataSchema>;

export const noteFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  content: z.string().trim().min(1, "Note content is required"),
  category: z.enum(NOTE_CATEGORIES),
  priority: z.enum(NOTE_PRIORITIES),
});

export type NoteFormInput = z.infer<typeof noteFormSchema>;
