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
 */
const ideaItemBaseSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().min(1, "Description is required"),
  source_inspiration_id: z.string().trim().nullable(),
  content_format: z.enum(INSPIRATION_CONTENT_FORMATS).nullable(),
  hook: z.string().trim().nullable(),
  cta: z.string().trim().nullable(),
  audience: z.string().trim().nullable(),
  notes: z.string().trim().nullable(),
  media_asset_id: z.string().trim().nullable(),
  priority: z.enum(IDEA_PRIORITIES).nullable(),
});

export const ideaItemInputSchema = ideaItemBaseSchema;
export const ideaItemUpdateSchema = ideaItemBaseSchema.partial();
