import { z } from "zod";

/**
 * SOCIAL-08C — validates the shape of a Script create/update input. Mirrors
 * `ideaItemBaseSchema`'s own conventions exactly, including the SOCIAL-07F
 * hardening lesson applied from the start here: `source_idea_id` normalizes
 * an empty string to `null` so `scriptActions.ts`'s own truthy guard
 * (`if (parsed.data.source_idea_id)`) can't be bypassed by a falsy-but-not-
 * null value. Cross-workspace ownership validation is `scriptActions.ts`'s
 * own job, not this schema's. `status`/`archived_at` are deliberately
 * absent — never browser-writable fields, only changed via the dedicated
 * archive/unarchive actions.
 */
const emptyStringToNull = (value: string | null) => (value === "" ? null : value);

export const scriptItemInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  source_idea_id: z.string().trim().nullable().transform(emptyStringToNull),
});

export const scriptItemUpdateSchema = scriptItemInputSchema.partial();

/**
 * A Script block's content is plain text only — no minimum length, since an
 * empty block is a valid, common in-progress state (the migration's own
 * `content text not null default ''`). `sort_order` mirrors every other
 * `sort_order`/`display_order` column in this schema: a non-negative
 * integer, never negative or fractional.
 */
export const scriptBlockInputSchema = z.object({
  content: z.string(),
  sort_order: z.number().int().nonnegative(),
});

export const scriptBlockUpdateSchema = scriptBlockInputSchema.partial();
