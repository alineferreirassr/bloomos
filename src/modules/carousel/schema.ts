import { z } from "zod";

/**
 * SOCIAL-10D — validates the shape of a Carousel create/update input.
 * Mirrors `ideaItemBaseSchema`'s own conventions exactly, including the
 * SOCIAL-07F hardening lesson applied from the start here (matching
 * `scriptItemInputSchema`'s own precedent): `source_idea_id` normalizes an
 * empty string to `null` so `carouselActions.ts`'s own truthy guard
 * (`if (parsed.data.source_idea_id)`) can't be bypassed by a falsy-but-not-
 * null value that would otherwise persist as an unvalidated reference.
 * Cross-workspace ownership validation is `carouselActions.ts`'s own job,
 * not this schema's. `status`/`archived_at` are deliberately absent —
 * never browser-writable fields, only changed via the dedicated
 * archive/unarchive actions.
 */
const emptyStringToNull = (value: string | null) => (value === "" ? null : value);

export const carouselItemInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  source_idea_id: z.string().trim().nullable().transform(emptyStringToNull),
});

export const carouselItemUpdateSchema = carouselItemInputSchema.partial();

/**
 * A Carousel slide's content is plain text only — no minimum length, since
 * an empty slide is a valid, common in-progress state (the migration's own
 * `content text not null default ''`), mirroring `scriptBlockInputSchema`
 * exactly. `sort_order` mirrors every other `sort_order`/`display_order`
 * column in this schema: a non-negative integer, never negative or
 * fractional. `media_asset_id` gets the same empty-string-to-null
 * normalization as `source_idea_id` above, for the identical reason.
 */
export const carouselSlideInputSchema = z.object({
  content: z.string(),
  sort_order: z.number().int().nonnegative(),
  media_asset_id: z.string().trim().nullable().transform(emptyStringToNull),
});

export const carouselSlideUpdateSchema = carouselSlideInputSchema.partial();
