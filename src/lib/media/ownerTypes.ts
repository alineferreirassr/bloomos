import type { EntityType } from "@/core/enums/entityType";

/**
 * The full set of owner types the Media Library is designed to eventually
 * serve — Lead/Client/Event/Document today, plus every module planned to
 * migrate or be built later. This list is intentionally broader than what
 * the database currently enforces; see LIVE_MEDIA_ASSET_OWNER_TYPES below.
 */
export const MEDIA_ASSET_OWNER_TYPES: EntityType[] = [
  "lead",
  "client",
  "event",
  "document",
  "contract",
  "invoice",
  "payment",
  "expense",
  "team_kb_article",
  "client_kb_article",
  "notification",
  "automation",
  "inventory_item",
];

/**
 * The owner types the `media_assets` table's `owner_type` CHECK constraint
 * currently accepts — must be kept in sync with the CHECK constraint in
 * `supabase/migrations/*_media_assets.sql`. Only owner types with a live
 * Supabase parent table are listed here, mirroring the exact widening
 * discipline already established for notes/timeline_activities: a new
 * owner type is added here (and to the CHECK constraint, in its own
 * migration) only once that module itself has a live Supabase table —
 * never pre-populated speculatively. Widening this is a one-line change;
 * it never requires touching repository or service code.
 *
 * Declared as a `const` tuple (not `EntityType[]`) so it can be passed
 * directly to `z.enum()` in `src/lib/media/schema.ts`.
 */
export const LIVE_MEDIA_ASSET_OWNER_TYPES = ["lead", "client", "event", "document"] as const satisfies readonly EntityType[];
