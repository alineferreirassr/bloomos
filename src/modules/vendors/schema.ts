import { z } from "zod";

/**
 * Shared editable fields — deliberately excludes `status` and `is_preferred`,
 * each of which has its own dedicated repository method (setVendorStatus /
 * setVendorPreferredStatus) with its own Timeline activity type, matching
 * Client's precedent of giving `internal_status`/`is_vip` their own
 * quick-action methods rather than burying them in the general update.
 *
 * No "" -> null transform here (unlike modules/clients/schema.ts) — there is
 * no UI/form this phase, so callers pass `null` directly for an absent
 * optional field, matching modules/inventory/schema.ts's precedent.
 */
const vendorFieldsSchema = z.object({
  company_name: z.string().trim().min(1, "Company name is required"),
  display_name: z.string().trim().nullable(),
  contact_person: z.string().trim().nullable(),
  email: z.string().trim().nullable(),
  phone: z.string().trim().nullable(),
  website: z.string().trim().nullable(),
  tax_id: z.string().trim().nullable(),
  address: z.string().trim().nullable(),
  city: z.string().trim().nullable(),
  state: z.string().trim().nullable(),
  zip_code: z.string().trim().nullable(),
  country: z.string().trim().nullable(),
  notes: z.string().trim().nullable(),
  tags: z.array(z.string()),
  default_currency: z
    .string()
    .trim()
    .length(3, "Use a 3-letter currency code")
    .transform((v) => v.toUpperCase()),
  payment_terms: z.string().trim().nullable(),
});

export const createVendorInputSchema = vendorFieldsSchema;
export type CreateVendorInput = z.infer<typeof createVendorInputSchema>;

export const updateVendorInputSchema = vendorFieldsSchema.partial();
export type UpdateVendorInput = z.infer<typeof updateVendorInputSchema>;
