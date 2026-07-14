import { z } from "zod";
import { EVENT_TYPES } from "@/core/enums/eventType";
import { EVENT_PRIORITIES } from "@/core/enums/eventPriority";
import { SCHEDULE_CATEGORIES } from "@/core/enums/scheduleCategory";

/**
 * Client-side (react-hook-form) schema for the general Event create/edit
 * form. Every field is a plain string or boolean — matching what HTML form
 * inputs actually produce — mirroring modules/leads/schema.ts and
 * modules/clients/schema.ts. `status`, `lifecycle_stage`, and `priority`'s
 * *change* are deliberately excluded from the general edit form (priority's
 * initial value is set on create): like a Lead's status, they're changed
 * only through their own dedicated action (updateEventStatus,
 * updateEventLifecycleStage, updateEventPriority) so each gets its own
 * specific timeline entry instead of being buried in a generic "Event
 * updated".
 */
export const eventFormSchema = z
  .object({
    client_id: z.string().trim().min(1, "Client is required"),
    originating_lead_id: z.string().trim(),
    title: z.string().trim().min(1, "Title is required"),
    event_type: z.enum(EVENT_TYPES),
    event_date: z.string().trim(),
    start_time: z.string().trim(),
    end_time: z.string().trim(),
    timezone: z.string().trim(),
    location_name: z.string().trim(),
    address: z.string().trim(),
    city: z.string().trim(),
    state: z.string().trim(),
    zip_code: z.string().trim(),
    latitude: z
      .string()
      .trim()
      .refine((v) => v === "" || !Number.isNaN(Number(v)), { message: "Enter a valid number" }),
    longitude: z
      .string()
      .trim()
      .refine((v) => v === "" || !Number.isNaN(Number(v)), { message: "Enter a valid number" }),
    guest_count: z
      .string()
      .trim()
      .refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0), {
        message: "Enter a valid number",
      }),
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
    package_name: z.string().trim(),
    theme: z.string().trim(),
    color_palette: z.string().trim(),
    surprise_event: z.boolean(),
    confidentiality_notes: z.string().trim(),
    accessibility_notes: z.string().trim(),
    dietary_notes: z.string().trim(),
    weather_plan: z.string().trim(),
    backup_location: z.string().trim(),
    internal_summary: z.string().trim(),
    assigned_owner: z.string().trim(),
    priority: z.enum(EVENT_PRIORITIES),
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

export type EventFormInput = z.infer<typeof eventFormSchema>;

/**
 * Authoritative schema, used only inside the data layer (lib/data/index.ts).
 * Re-validates independently of whatever the form already checked, and
 * normalizes "" -> null / numeric strings -> numbers into the shape stored
 * on an Event. client_id existence is checked separately by the data layer
 * (a zod schema can't look up another store), not here.
 */
export const eventDataSchema = eventFormSchema.transform((data) => ({
  client_id: data.client_id,
  originating_lead_id: data.originating_lead_id === "" ? null : data.originating_lead_id,
  title: data.title,
  event_type: data.event_type,
  event_date: data.event_date === "" ? null : data.event_date,
  start_time: data.start_time === "" ? null : data.start_time,
  end_time: data.end_time === "" ? null : data.end_time,
  timezone: data.timezone === "" ? null : data.timezone,
  location_name: data.location_name === "" ? null : data.location_name,
  address: data.address === "" ? null : data.address,
  city: data.city === "" ? null : data.city,
  state: data.state === "" ? null : data.state,
  zip_code: data.zip_code === "" ? null : data.zip_code,
  latitude: data.latitude === "" ? null : Number(data.latitude),
  longitude: data.longitude === "" ? null : Number(data.longitude),
  guest_count: data.guest_count === "" ? null : Number(data.guest_count),
  budget_min: data.budget_min === "" ? null : Number(data.budget_min),
  budget_max: data.budget_max === "" ? null : Number(data.budget_max),
  package_name: data.package_name === "" ? null : data.package_name,
  theme: data.theme === "" ? null : data.theme,
  color_palette: data.color_palette === "" ? null : data.color_palette,
  surprise_event: data.surprise_event,
  confidentiality_notes: data.confidentiality_notes === "" ? null : data.confidentiality_notes,
  accessibility_notes: data.accessibility_notes === "" ? null : data.accessibility_notes,
  dietary_notes: data.dietary_notes === "" ? null : data.dietary_notes,
  weather_plan: data.weather_plan === "" ? null : data.weather_plan,
  backup_location: data.backup_location === "" ? null : data.backup_location,
  internal_summary: data.internal_summary === "" ? null : data.internal_summary,
  assigned_owner: data.assigned_owner === "" ? null : data.assigned_owner,
  priority: data.priority,
}));

export type EventDataInput = z.infer<typeof eventDataSchema>;

/**
 * A day-of schedule row for one Event. No separate form/data split — unlike
 * Event/Client, this isn't fed by raw HTML form strings yet (no Event UI
 * exists at this checkpoint), so fields are typed directly rather than as
 * form-input strings requiring "" -> null normalization.
 */
export const scheduleItemSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().nullable(),
  start_time: z.string().trim().nullable(),
  end_time: z.string().trim().nullable(),
  location: z.string().trim().nullable(),
  assigned_to: z.string().trim().nullable(),
  category: z.enum(SCHEDULE_CATEGORIES),
});

export type ScheduleItemInput = z.infer<typeof scheduleItemSchema>;
