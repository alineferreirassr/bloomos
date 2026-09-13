import { z } from "zod";
import { INSPIRATION_CONTENT_FORMATS } from "@/types/inspirationItem";
import { IDEA_PRIORITIES } from "@/types/ideaItem";

/**
 * SOCIAL-07C — validates the shape of an Idea create/update input. Mirrors
 * `inspirationItemBaseSchema`'s own conventions exactly. `source_inspiration_id`
 * and `media_asset_id` are only shape-checked here (a trimmed string or
 * null) — cross-workspace ownership validation is `ideaActions.ts`'s own
 * job, not this schema's. `status`/`archived_at` are deliberately absent
 * from this schema entirely — they are never browser-writable fields, only
 * changed via the dedicated archive/unarchive actions.
 *
 * SOCIAL-07F hardening — `source_inspiration_id`/`media_asset_id` normalize
 * an empty string to `null`. Without this, `ideaActions.ts`'s own
 * `if (parsed.data.source_inspiration_id)` truthy guard treats `""` as
 * "nothing to validate" (correctly skipping ownership validation for a
 * genuinely absent reference), but `""` is not `null` — it would then be
 * persisted verbatim as an unvalidated, non-null value in a `uuid` column,
 * bypassing `validateOwnedInspirationReference`/`validateOwnedMediaAssetReference`
 * entirely. Normalizing here keeps that guard's existing truthy check
 * correct for every falsy-but-string input, not just `null`.
 */
const emptyStringToNull = (value: string | null) => (value === "" ? null : value);

const ideaItemBaseSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().min(1, "Description is required"),
  source_inspiration_id: z.string().trim().nullable().transform(emptyStringToNull),
  content_format: z.enum(INSPIRATION_CONTENT_FORMATS).nullable(),
  hook: z.string().trim().nullable(),
  cta: z.string().trim().nullable(),
  audience: z.string().trim().nullable(),
  notes: z.string().trim().nullable(),
  media_asset_id: z.string().trim().nullable().transform(emptyStringToNull),
  priority: z.enum(IDEA_PRIORITIES).nullable(),
});

export const ideaItemInputSchema = ideaItemBaseSchema;
export const ideaItemUpdateSchema = ideaItemBaseSchema.partial();
