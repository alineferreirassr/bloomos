import { z } from "zod";
import { INSPIRATION_SOURCE_TYPES, INSPIRATION_CONTENT_FORMATS } from "@/types/inspirationItem";

/**
 * SOCIAL-06C — validates the shape of an Inspiration create/update input.
 * `source_url` itself is only shape-checked here (a trimmed string or
 * null) — its actual scheme/format validation is `validateInspirationSourceUrl`'s
 * job (`src/lib/inspiration/normalizeUrl.ts`, built in SOCIAL-06B), called
 * separately by the action so a malformed-but-non-empty URL gets a
 * URL-specific message rather than a generic Zod one. `normalized_source_url`
 * is deliberately absent from this schema entirely — it is never a
 * browser-writable field (see the action file's own comment).
 */
const inspirationItemBaseSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  source_type: z.enum(INSPIRATION_SOURCE_TYPES),
  source_url: z.string().trim().nullable(),
  creator_name: z.string().trim().nullable(),
  creator_handle: z.string().trim().nullable(),
  platform_content_id: z.string().trim().nullable(),
  content_format: z.enum(INSPIRATION_CONTENT_FORMATS).nullable(),
  hook: z.string().trim().nullable(),
  cta: z.string().trim().nullable(),
  why_it_works: z.string().trim().nullable(),
  notes: z.string().trim().nullable(),
  duration_seconds: z.number().int("Duration must be a whole number").nonnegative("Duration cannot be negative").nullable(),
  /** Mirrors `socialPosts/schema.ts`'s own `futureInstant` Date.parse idiom, minus the "must be in the future" refinement — a published_at is normally in the past. */
  published_at: z
    .string()
    .trim()
    .min(1, "Choose a date and time")
    .refine((value) => !Number.isNaN(Date.parse(value)), "That date and time isn't valid")
    .nullable(),
  media_asset_id: z.string().trim().nullable(),
});

export const inspirationItemInputSchema = inspirationItemBaseSchema;
export type InspirationItemInput = z.infer<typeof inspirationItemInputSchema>;

export const inspirationItemUpdateSchema = inspirationItemBaseSchema.partial();
export type InspirationItemUpdateInput = z.infer<typeof inspirationItemUpdateSchema>;
