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

/**
 * SOCIAL-04B — validates a `Date` is parseable and genuinely in the future
 * (a schedule for "now or the past" would be immediately due, which is
 * confusing UX rather than a real use case) without pinning an arbitrary
 * minimum lead time SOCIAL-04A's own audit never proved necessary.
 */
const futureInstant = z
  .string()
  .trim()
  .min(1, "Choose a date and time")
  .refine((value) => !Number.isNaN(Date.parse(value)), "That date and time isn't valid")
  .refine((value) => Date.parse(value) > Date.now(), "Choose a time in the future");

/**
 * IANA timezone identifiers have no practical schema to validate against
 * directly (SOCIAL-04A's own audit found no workspace-level timezone
 * convention to reuse) — `Intl.DateTimeFormat` throws a `RangeError` for
 * anything that isn't a real IANA zone, which is the standard, dependency-free
 * way to validate one in JS without hand-maintaining IANA's own zone list.
 */
function isValidIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const timezoneField = z
  .string()
  .trim()
  .min(1)
  .refine(isValidIanaTimezone, "That timezone isn't recognized")
  .nullable()
  .optional();

export const socialPostScheduleSchema = z.object({
  scheduled_at: futureInstant,
  scheduled_timezone: timezoneField,
});

export type SocialPostScheduleInput = z.infer<typeof socialPostScheduleSchema>;
