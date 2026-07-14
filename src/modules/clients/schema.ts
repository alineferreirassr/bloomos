import { z } from "zod";

const importantDateSchema = z.object({
  id: z.string(),
  label: z.string().trim().min(1, "Label is required"),
  date: z.string().trim().min(1, "Date is required"),
});

/**
 * Client-side (react-hook-form) schema for the general profile create/edit
 * form. Every text field is a plain string — matching what HTML form inputs
 * actually produce — mirroring the pattern in modules/leads/schema.ts.
 *
 * `internal_status`, `tags`, `is_vip`, and `preferred_contact_method` are
 * deliberately excluded: like a Lead's `status`, they're changed only
 * through their own dedicated quick-action (updateClientStatus,
 * updateClientTags, setClientVipStatus, updateClientContactPreference),
 * never through the general edit form, so each gets its own specific
 * timeline entry instead of being buried in a generic "Client updated".
 */
export const clientFormSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required"),
  last_name: z.string().trim().min(1, "Last name is required"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  phone: z.string().trim(),
  instagram: z.string().trim(),
  partner_name: z.string().trim(),
  relationship_status: z.string().trim(),
  address: z.string().trim(),
  city: z.string().trim(),
  state: z.string().trim(),
  zip_code: z.string().trim(),
  source: z.string().trim(),
  important_dates: z.array(importantDateSchema),

  how_they_met: z.string().trim(),
  first_date: z.string().trim(),
  relationship_anniversary: z.string().trim(),
  engagement_date: z.string().trim(),
  wedding_date: z.string().trim(),
  favorite_colors: z.string().trim(),
  favorite_flowers: z.string().trim(),
  favorite_music: z.string().trim(),
  favorite_food: z.string().trim(),
  favorite_drinks: z.string().trim(),
  preferred_style: z.string().trim(),
  disliked_elements: z.string().trim(),

  allergies: z.string().trim(),
  accessibility_needs: z.string().trim(),
  dietary_restrictions: z.string().trim(),
  preferred_communication_time: z.string().trim(),
  do_not_call: z.boolean(),
  surprise_event_confidentiality: z.boolean(),
  emergency_contact_name: z.string().trim(),
  emergency_contact_phone: z.string().trim(),
});

export type ClientFormInput = z.infer<typeof clientFormSchema>;

/**
 * Authoritative schema, used only inside the data layer (lib/data/index.ts).
 * Re-validates independently of whatever the form already checked, and
 * normalizes "" -> null into the shape stored on a Client.
 */
export const clientDataSchema = clientFormSchema.transform((data) => ({
  first_name: data.first_name,
  last_name: data.last_name,
  email: data.email,
  phone: data.phone === "" ? null : data.phone,
  instagram: data.instagram === "" ? null : data.instagram,
  partner_name: data.partner_name === "" ? null : data.partner_name,
  relationship_status: data.relationship_status === "" ? null : data.relationship_status,
  address: data.address === "" ? null : data.address,
  city: data.city === "" ? null : data.city,
  state: data.state === "" ? null : data.state,
  zip_code: data.zip_code === "" ? null : data.zip_code,
  source: data.source === "" ? null : data.source,
  important_dates: data.important_dates,

  how_they_met: data.how_they_met === "" ? null : data.how_they_met,
  first_date: data.first_date === "" ? null : data.first_date,
  relationship_anniversary: data.relationship_anniversary === "" ? null : data.relationship_anniversary,
  engagement_date: data.engagement_date === "" ? null : data.engagement_date,
  wedding_date: data.wedding_date === "" ? null : data.wedding_date,
  favorite_colors: data.favorite_colors === "" ? null : data.favorite_colors,
  favorite_flowers: data.favorite_flowers === "" ? null : data.favorite_flowers,
  favorite_music: data.favorite_music === "" ? null : data.favorite_music,
  favorite_food: data.favorite_food === "" ? null : data.favorite_food,
  favorite_drinks: data.favorite_drinks === "" ? null : data.favorite_drinks,
  preferred_style: data.preferred_style === "" ? null : data.preferred_style,
  disliked_elements: data.disliked_elements === "" ? null : data.disliked_elements,

  allergies: data.allergies === "" ? null : data.allergies,
  accessibility_needs: data.accessibility_needs === "" ? null : data.accessibility_needs,
  dietary_restrictions: data.dietary_restrictions === "" ? null : data.dietary_restrictions,
  preferred_communication_time:
    data.preferred_communication_time === "" ? null : data.preferred_communication_time,
  do_not_call: data.do_not_call,
  surprise_event_confidentiality: data.surprise_event_confidentiality,
  emergency_contact_name: data.emergency_contact_name === "" ? null : data.emergency_contact_name,
  emergency_contact_phone: data.emergency_contact_phone === "" ? null : data.emergency_contact_phone,
}));

export type ClientDataInput = z.infer<typeof clientDataSchema>;
