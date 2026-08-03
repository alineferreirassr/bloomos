import type { KnowledgeNodeType } from "@/types/knowledgeGraph";

/**
 * v2.0 Checkpoint 26 — Mobile Workforce Platform Foundation. Models the
 * field workforce (technicians, photographers, installers, drivers,
 * contractors, event crews) as its own domain, distinct from Team
 * Management's `team_member` (a platform login/permission holder — see
 * `core/enums/entityType.ts`'s comment on `worker` for the full split).
 * This checkpoint is infrastructure only: no scheduling, no dispatch, no
 * route optimization, no maps, no GPS history, no workforce automation —
 * see `docs/workforce.md` for the full "why" behind every decision below.
 */

export const WORKER_ROLES = [
  "technician",
  "photographer",
  "videographer",
  "installer",
  "inspector",
  "driver",
  "crew_member",
  "supervisor",
  "contractor",
  "vendor_rep",
  "other",
] as const;
export type WorkerRole = (typeof WORKER_ROLES)[number];

export const EMPLOYMENT_TYPES = ["full_time", "part_time", "contractor", "seasonal", "volunteer"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

/** Stored employment lifecycle status — deliberately distinct from `CurrentActivityState` (moment-to-moment, not persisted lifecycle) and from `AvailabilityStatus` (schedule-facing, its own store). */
export const WORKER_STATUSES = ["active", "inactive", "on_leave", "terminated"] as const;
export type WorkerStatus = (typeof WORKER_STATUSES)[number];

/**
 * A lightweight, worker-reported "what are you doing right now" flag —
 * not a location, not a schedule, not dispatch. Kept separate from
 * `AvailabilityStatus` (which answers "can this worker take on more
 * work") because the two questions are genuinely different: a worker can
 * be `on_site` (current activity) while also `available` (availability)
 * for the next assignment.
 */
export const CURRENT_ACTIVITY_STATES = ["idle", "traveling", "on_site", "in_meeting", "on_break", "off_duty"] as const;
export type CurrentActivityState = (typeof CURRENT_ACTIVITY_STATES)[number];

export const SKILL_LEVELS = ["primary", "secondary", "learning"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export interface WorkerSkill {
  id: string;
  name: string;
  category: string;
  level: SkillLevel;
}

/** `expiration_date: null` means the certification never expires; `verified` is set by whoever recorded it — this checkpoint has no verification workflow of its own, it reuses the same "operator-attested until proven otherwise" honesty precedent as `ApprovalRequirement.approvalKey` in `types/objectives.ts`. */
export interface WorkerCertification {
  id: string;
  name: string;
  issuer: string;
  issued_date: string;
  expiration_date: string | null;
  verified: boolean;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

/**
 * v2.0 Checkpoint 26.1 — Workforce Capability & Eligibility Platform.
 * Needed as a real, stored "minimum experience level" gate
 * (`CapabilityRequirement.minimum_experience_level`) and score input
 * (`CapabilityScoreEngine`'s experience score) — Checkpoint 26 had no
 * experience concept at all, and fabricating one from an unrelated proxy
 * (e.g. record age) would violate this platform's own "never invent a
 * signal" discipline. A worker's level is set explicitly, defaults to
 * `"entry"` at creation, and is editable like any other profile field.
 */
export const EXPERIENCE_LEVELS = ["entry", "intermediate", "senior", "expert"] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export interface Worker {
  id: string;
  workspace_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role: WorkerRole;
  employment_type: EmploymentType;
  status: WorkerStatus;
  current_activity: CurrentActivityState;
  team_id: string | null;
  supervisor_worker_id: string | null;
  /** Set only when this Worker also holds a platform login/permission-holding account — points at the existing Team Member (`core/enums/entityType.ts`'s `team_member`), never a duplicated identity/permission record. */
  linked_member_id: string | null;
  time_zone: string;
  /** Primary/display language — unchanged from Checkpoint 26. */
  language: string;
  /** v2.0 Checkpoint 26.1 addition — every language this worker speaks, always including `language`. `Worker.language` alone can't answer a multi-language `CapabilityRequirement.required_languages` check honestly, so this is a real, separate, explicit list rather than inferring one from a single string. */
  languages: string[];
  /** v2.0 Checkpoint 26.1 addition — see `ExperienceLevel` above. */
  experience_level: ExperienceLevel;
  profile_photo_url: string | null;
  emergency_contact: EmergencyContact | null;
  skills: WorkerSkill[];
  certifications: WorkerCertification[];
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export const TEAM_STATUSES = ["active", "inactive", "archived"] as const;
export type TeamStatus = (typeof TEAM_STATUSES)[number];

/** A field-workforce crew — distinct from Team Management's organization-wide Team surface (`docs/team-dashboard.md`). `member_worker_ids` is the source of truth for membership; `leader_worker_id` must be a member. */
export interface Team {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  leader_worker_id: string | null;
  member_worker_ids: string[];
  status: TeamStatus;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

/**
 * Nine named statuses, per the spec. `on_assignment` is set by the
 * Assignment Engine's own effect on availability display (a worker with
 * an active Assignment reads as `on_assignment` even if their last
 * explicit window said `available`) — see `availabilityEngine.resolveCurrentAvailability`.
 */
export const AVAILABILITY_STATUSES = ["available", "on_assignment", "busy", "on_break", "off_duty", "vacation", "sick_leave", "training", "unavailable"] as const;
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

/**
 * `time_zone` is the worker's own zone *at the time this window was
 * recorded* — every timestamp in this codebase is stored as UTC ISO
 * (`nowIso()`), this field exists purely so a caller can render "9am
 * Pacific" instead of forcing every UI to convert; no timezone math
 * happens inside this domain's engines.
 */
export interface AvailabilityWindow {
  id: string;
  worker_id: string;
  workspace_id: string;
  status: AvailabilityStatus;
  starts_at: string;
  /** `null` means open-ended — still the worker's current status until a newer window is recorded. */
  ends_at: string | null;
  note: string | null;
  time_zone: string;
  created_at: string;
}

/**
 * What a Worker can be assigned to. `project` and `task_placeholder` are
 * named by the spec but have no corresponding `KnowledgeNodeType`
 * anywhere in this codebase — same "don't fabricate a node type"
 * discipline `types/objectives.ts`'s `OBJECTIVE_SCOPES_WITH_NO_NODE`
 * already established. Assignments of those two kinds are recorded in
 * the registry and get real Timeline events, but deliberately skip
 * Knowledge Graph relationship creation — disclosed in
 * `docs/assignment-engine.md`, not silently faked.
 */
export const ASSIGNABLE_TYPES = ["client", "event", "project", "asset", "vehicle", "equipment", "vendor", "task_placeholder"] as const;
export type AssignableType = (typeof ASSIGNABLE_TYPES)[number];

/** The subset of `AssignableType` with a real `KnowledgeNodeType` counterpart — `assignmentEngine.ts` uses this to decide whether to create a Knowledge Graph relationship. `asset` maps to `media_asset`. */
export const ASSIGNABLE_TYPE_TO_NODE_TYPE: Partial<Record<AssignableType, KnowledgeNodeType>> = {
  client: "client",
  event: "event",
  asset: "media_asset",
  vehicle: "vehicle",
  equipment: "equipment",
  vendor: "vendor",
};

export const ASSIGNMENT_STATUSES = ["active", "completed", "cancelled"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export interface Assignment {
  id: string;
  workspace_id: string;
  worker_id: string;
  assignable_type: AssignableType;
  assignable_id: string;
  role_note: string | null;
  status: AssignmentStatus;
  starts_at: string;
  ends_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const MOBILE_SESSION_STATUSES = ["active", "expired", "revoked"] as const;
export type MobileSessionStatus = (typeof MOBILE_SESSION_STATUSES)[number];

export const MOBILE_PLATFORMS = ["ios", "android", "web"] as const;
export type MobilePlatform = (typeof MOBILE_PLATFORMS)[number];

/** A device session for the (future) mobile workforce app — session lifecycle only, no push infra, no offline sync logic. `deriveSessionStatus` (mobileSessionEngine.ts) computes `expired` from `last_seen_at` + a TTL, never stored directly. */
export interface MobileSession {
  id: string;
  workspace_id: string;
  worker_id: string;
  device_label: string;
  platform: MobilePlatform;
  status: MobileSessionStatus;
  started_at: string;
  last_seen_at: string;
  ended_at: string | null;
}

export const OFFLINE_QUEUE_ENTRY_STATUSES = ["pending", "synced", "failed"] as const;
export type OfflineQueueEntryStatus = (typeof OFFLINE_QUEUE_ENTRY_STATUSES)[number];

/**
 * Infrastructure only, per this checkpoint's stop condition — records
 * that a mobile client queued a change while offline. There is no sync
 * engine, no conflict resolution, and no background processor this
 * checkpoint; `status`/`synced_at` exist purely so a future checkpoint
 * has a real place to write real sync results instead of inventing one.
 * `queueOfflineEntryAction` in `workforceActions.ts` only ever writes
 * `status: "pending"`.
 */
export interface OfflineQueueEntry {
  id: string;
  workspace_id: string;
  worker_id: string;
  mobile_session_id: string;
  entity_type: string;
  entity_id: string | null;
  payload_summary: string;
  status: OfflineQueueEntryStatus;
  queued_at: string;
  synced_at: string | null;
}

/**
 * Infrastructure only, per this checkpoint's stop condition — the store
 * keeps the single latest snapshot per worker (overwritten on every new
 * report), never a history. No routing, no maps, no GPS trail, no
 * geofencing. `locationEngine.isSnapshotStale` is the only real logic
 * this domain has: "is this the worker's real current position, or
 * should the UI say 'last seen a while ago'?"
 */
export interface LocationSnapshot {
  worker_id: string;
  workspace_id: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  recorded_at: string;
  source: "mobile_app" | "manual";
}

export const EQUIPMENT_STATUSES = ["available", "in_use", "maintenance", "retired"] as const;
export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number];

export interface Equipment {
  id: string;
  workspace_id: string;
  name: string;
  category: string;
  status: EquipmentStatus;
  assigned_worker_id: string | null;
  serial_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export const VEHICLE_STATUSES = ["available", "in_use", "maintenance", "retired"] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export interface Vehicle {
  id: string;
  workspace_id: string;
  label: string;
  /** v2.0 Checkpoint 26.1 addition — a freeform category (e.g. "van", "truck", "sedan") mirroring `Equipment.category` exactly, needed so `CapabilityRequirement.required_vehicle_types`/`preferred_vehicle_types` has something real to match against. `make`/`model` alone don't group into a "type" a requirement author would actually write. */
  vehicle_type: string;
  make: string | null;
  model: string | null;
  year: number | null;
  license_plate: string | null;
  status: VehicleStatus;
  assigned_worker_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface AvailabilitySummary {
  available: number;
  onAssignment: number;
  busy: number;
  onBreak: number;
  offDuty: number;
  vacation: number;
  sickLeave: number;
  training: number;
  unavailable: number;
}

export interface ExpiringCertification {
  workerId: string;
  workerName: string;
  certification: WorkerCertification;
  daysUntilExpiration: number;
}

export interface WorkforceScorecard {
  totalWorkers: number;
  activeWorkers: number;
  availableNow: number;
  onAssignmentNow: number;
  teamsCount: number;
  activeAssignments: number;
  expiringCertificationsCount: number;
  equipmentInUse: number;
  vehiclesInUse: number;
  activeMobileSessions: number;
  evaluatedAt: string;
}
