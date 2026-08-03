import type { ServiceVersionStatus } from "@/core/enums/serviceVersionStatus";
import type { ServiceExperienceLevel } from "@/core/enums/serviceExperienceLevel";
import type { ServiceWeatherSensitivity } from "@/core/enums/serviceWeatherSensitivity";

/**
 * One immutable (once published) snapshot of a Service's full operational
 * blueprint. Every template table (ServiceChecklistTemplateItem,
 * ServiceTimelineTemplateItem, ServiceIncludedItem, ...) is scoped to
 * `service_version_id`, never to `service_id` directly — so "Luxury Picnic
 * v1" and "Luxury Picnic v2" each carry their own complete, independent set
 * of template rows, and an EventService pinned to v1 keeps reading v1's rows
 * forever, unaffected by anything done to v2.
 *
 * `status: "draft"` is the one mutable version every Service always has —
 * template rows may only be inserted/updated/deleted while their parent
 * version is in this state. `publishServiceVersion` (see
 * core/workflows/serviceWorkflow.ts) freezes it: stamps `version_number`/
 * `published_at`/`published_by`, flips status to "published" forever, then
 * deep-copies every template row into a brand new "draft" version so editing
 * can continue toward what will become the next release. `version_number`
 * is null on every "draft" row precisely because a draft has no release
 * identity yet.
 *
 * `name_snapshot`/`description_snapshot` are the ONLY place a version's
 * display text lives — and unlike every other field on this type, they are
 * never directly editable. `Service.name`/`Service.description` (types/service.ts)
 * are the single authoritative, always-current source; these two fields are
 * populated exactly once, by `publishServiceVersion`, by copying whatever
 * `Service.name`/`description` said at that exact moment — a write-once
 * historical stamp, not a second live copy. Both are null on every "draft"
 * version (a draft has no historical identity yet; anything displaying the
 * current draft should read `Service.name` directly). This resolves what
 * was originally a real bug in this Foundation phase: an earlier revision
 * let a version's name/description be edited independently of `Service`'s
 * own, so the two could silently diverge with no defined authority — see
 * docs/services.md's "Locked domain decisions" section.
 *
 * The operational-metadata fields below (setup/breakdown duration through
 * estimated profit) describe THIS version's character specifically, since
 * difficulty/duration/etc. can genuinely change between versions. They feed,
 * respectively: Team Operations staffing (setup/breakdown duration,
 * experience_level_required), the AI risk engine and future Weather
 * Intelligence module (weather_sensitivity), client-facing communication
 * guardrails (surprise_friendly — never mention in client-facing copy), and
 * Reporting (estimated_profit_minor, difficulty_score).
 */
export interface ServiceVersion {
  id: string;
  service_id: string;
  workspace_id: string;
  version_number: number | null;
  status: ServiceVersionStatus;
  /** Null on a draft; set exactly once, at publish time, from Service.name. Never independently editable. */
  name_snapshot: string | null;
  description_snapshot: string | null;
  base_price_minor: number;
  currency: string;
  setup_duration_minutes: number | null;
  breakdown_duration_minutes: number | null;
  /** 1 (easiest) through 5 (hardest) — null means not yet assessed. */
  difficulty_score: number | null;
  experience_level_required: ServiceExperienceLevel | null;
  weather_sensitivity: ServiceWeatherSensitivity;
  surprise_friendly: boolean;
  estimated_profit_minor: number | null;
  /** Human-entered "what changed since the last version" note — filled in at publish time, null on the current draft until it is published. */
  change_summary: string | null;
  published_at: string | null;
  published_by: string | null;
  created_at: string;
  updated_at: string;
}
