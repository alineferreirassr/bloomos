import { z } from "zod";

/**
 * The authoritative schema for Contract content fields, used directly by
 * the data layer (lib/data/index.ts createContract/updateContract). Unlike
 * modules/events/schema.ts's eventFormSchema/eventDataSchema split, there is
 * no form-schema half here — no UI exists yet in this phase, so there's no
 * HTML form producing string-only values to normalize. Fields are typed the
 * way they're actually stored (nullable numbers as numbers, not strings); a
 * future Contracts UI phase can add a form-schema layer on top of this one
 * the same way modules/checklist/schema.ts and modules/events/schema.ts's
 * scheduleItemFormSchema do, without changing this schema's shape.
 *
 * Deliberately excluded (assigned by the data layer, never by a caller):
 * id, workspace_id, contract_number, status, signature_status, version,
 * version_history, every *_at timestamp, remaining_balance (derived from
 * total_value/deposit_amount), created_at/updated_at. client_id/event_id/
 * template_id existence is checked by the data layer (a zod schema can't
 * look up another store).
 */
export const contractSchema = z
  .object({
    client_id: z.string().trim().min(1, "Client is required"),
    event_id: z.string().trim().nullable(),
    template_id: z.string().trim().nullable(),
    title: z.string().trim().min(1, "Title is required"),
    description: z.string().trim().nullable(),
    effective_date: z.string().trim().nullable(),
    expiration_date: z.string().trim().nullable(),
    total_value: z.number().nonnegative("Enter a valid amount").nullable(),
    deposit_required: z.boolean(),
    deposit_amount: z.number().nonnegative("Enter a valid amount").nullable(),
    currency: z
      .string()
      .trim()
      .length(3, "Use a 3-letter currency code")
      .transform((v) => v.toUpperCase()),
    notes: z.string().trim().nullable(),
  })
  .refine((data) => !data.deposit_required || data.deposit_amount !== null, {
    message: "Enter a deposit amount",
    path: ["deposit_amount"],
  })
  .refine((data) => data.deposit_required || data.deposit_amount === null, {
    message: "Clear the deposit amount, or mark a deposit as required",
    path: ["deposit_amount"],
  })
  .refine(
    (data) =>
      data.total_value === null || data.deposit_amount === null || data.deposit_amount <= data.total_value,
    {
      message: "Deposit amount cannot exceed the total contract value",
      path: ["deposit_amount"],
    },
  )
  .refine(
    (data) =>
      data.effective_date === null || data.expiration_date === null || data.expiration_date >= data.effective_date,
    {
      message: "Expiration date cannot be before the effective date",
      path: ["expiration_date"],
    },
  );

export type ContractInput = z.infer<typeof contractSchema>;
