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

/**
 * Client-side (react-hook-form) schema for the Contract create/edit form —
 * every field is a plain string or boolean, matching what HTML form inputs
 * actually produce, mirroring the eventFormSchema/eventDataSchema and
 * scheduleItemFormSchema/scheduleItemSchema splits. Mutually exclusive with
 * `contractSchema` above: this validates what the browser gives us,
 * `contractFormToInput` normalizes it into the typed `ContractInput`
 * `contractSchema` expects, and the data layer re-validates independently.
 */
export const contractFormSchema = z
  .object({
    client_id: z.string().trim().min(1, "Client is required"),
    event_id: z.string().trim(),
    template_id: z.string().trim(),
    title: z.string().trim().min(1, "Title is required"),
    description: z.string().trim(),
    effective_date: z.string().trim(),
    expiration_date: z.string().trim(),
    total_value: z
      .string()
      .trim()
      .refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0), {
        message: "Enter a valid amount",
      }),
    deposit_required: z.boolean(),
    deposit_amount: z
      .string()
      .trim()
      .refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0), {
        message: "Enter a valid amount",
      }),
    currency: z.string().trim().length(3, "Use a 3-letter currency code"),
    notes: z.string().trim(),
  })
  .refine((data) => !data.deposit_required || data.deposit_amount !== "", {
    message: "Enter a deposit amount",
    path: ["deposit_amount"],
  })
  .refine((data) => data.deposit_required || data.deposit_amount === "", {
    message: "Clear the deposit amount, or mark a deposit as required",
    path: ["deposit_amount"],
  })
  .refine(
    (data) =>
      data.total_value === "" ||
      data.deposit_amount === "" ||
      Number(data.deposit_amount) <= Number(data.total_value),
    { message: "Deposit amount cannot exceed the total contract value", path: ["deposit_amount"] },
  )
  .refine(
    (data) =>
      data.effective_date === "" || data.expiration_date === "" || data.expiration_date >= data.effective_date,
    { message: "Expiration date cannot be before the effective date", path: ["expiration_date"] },
  );

export type ContractFormInput = z.infer<typeof contractFormSchema>;

/** Normalizes "" -> null / numeric strings -> numbers into the shape contractSchema/the data layer expects. */
export function contractFormToInput(data: ContractFormInput): ContractInput {
  return {
    client_id: data.client_id,
    event_id: data.event_id === "" ? null : data.event_id,
    template_id: data.template_id === "" ? null : data.template_id,
    title: data.title,
    description: data.description === "" ? null : data.description,
    effective_date: data.effective_date === "" ? null : data.effective_date,
    expiration_date: data.expiration_date === "" ? null : data.expiration_date,
    total_value: data.total_value === "" ? null : Number(data.total_value),
    deposit_required: data.deposit_required,
    deposit_amount: data.deposit_amount === "" ? null : Number(data.deposit_amount),
    currency: data.currency.toUpperCase(),
    notes: data.notes === "" ? null : data.notes,
  };
}

/**
 * Authoritative schema for a Contract Exhibit's editable content, used
 * directly by the data layer (createContractExhibit/updateContractExhibit).
 * display_order/document_id are assigned by the data layer, never by a
 * caller — display_order via createContractExhibit/reorderContractExhibits,
 * document_id always null until a Documents module exists.
 */
export const contractExhibitSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().nullable(),
});

export type ContractExhibitInput = z.infer<typeof contractExhibitSchema>;

/** Client-side form schema for the Exhibit add/edit modal — mirrors the contractFormSchema/contractSchema split. */
export const contractExhibitFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim(),
});

export type ContractExhibitFormInput = z.infer<typeof contractExhibitFormSchema>;

export function exhibitFormToInput(data: ContractExhibitFormInput): ContractExhibitInput {
  return {
    title: data.title,
    description: data.description === "" ? null : data.description,
  };
}
