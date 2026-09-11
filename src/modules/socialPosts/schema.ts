import { z } from "zod";

/**
 * SOCIAL-03 — caption max length (2,200 characters) is Instagram's own
 * long-established, stable product limit — unlike an OAuth endpoint or API
 * version, this is not the kind of detail that rotates, so it is not
 * treated as requiring the same live-documentation re-verification this
 * checkpoint's own architecture gate applied to the publish API contract.
 */
export const socialPostDraftSchema = z.object({
  caption: z.string().trim().max(2200, "Caption must be 2,200 characters or fewer"),
  asset_id: z.string().trim().min(1, "Select an image to publish"),
});

export type SocialPostDraftInput = z.infer<typeof socialPostDraftSchema>;
