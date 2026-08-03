import type { KnowledgeNodeRef, KnowledgeNodeType } from "@/types/knowledgeGraph";

/**
 * v2.0 Checkpoint 27 — Enterprise Scheduling Platform. Determines WHEN
 * work can happen — never WHO should perform it (Checkpoint 26.1's
 * Capability Platform already answers that) and never WHO is actually
 * sent (a future Dispatch Platform's job). Every engine in this domain
 * is a pure, deterministic function; no AI, no randomness. See
 * `docs/calendar.md` for the full "why" behind every decision below.
 *
 * Naming note: `EventScheduleItem` (`types/eventScheduleItem.ts`) is a
 * per-Event day-of itinerary entry — a completely different, pre-existing
 * concept from this checkpoint's `Appointment`/`Calendar` (workspace-wide,
 * cross-worker/resource scheduling with recurrence, capacity, and
 * conflict detection). Neither duplicates the other.
 */

export const CALENDAR_CONTEXT_TYPES = ["worker", "team", "equipment", "vehicle", "workspace", "custom"] as const;
export type CalendarContextType = (typeof CALENDAR_CONTEXT_TYPES)[number];

/** `custom` has no real `KnowledgeNodeType` — same "don't fabricate a node type" discipline `types/capability.ts`'s `CAPABILITY_CONTEXTS_WITH_NO_NODE` established. */
export const CALENDAR_CONTEXTS_WITH_NO_NODE: readonly CalendarContextType[] = ["custom"];

export const CALENDAR_CONTEXT_TYPE_TO_NODE_TYPE: Partial<Record<CalendarContextType, KnowledgeNodeType>> = {
  worker: "worker",
  team: "team",
  equipment: "equipment",
  vehicle: "vehicle",
  workspace: "workspace",
};

export const CALENDAR_STATUSES = ["active", "archived"] as const;
export type CalendarStatus = (typeof CALENDAR_STATUSES)[number];

export interface Calendar {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  context_type: CalendarContextType;
  /** `null` exactly for `CALENDAR_CONTEXTS_WITH_NO_NODE` context types. */
  context: KnowledgeNodeRef | null;
  time_zone: string;
  status: CalendarStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export const APPOINTMENT_STATUSES = ["tentative", "confirmed", "cancelled", "completed"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type AppointmentPriority = (typeof APPOINTMENT_PRIORITIES)[number];

export const APPOINTMENT_CONTEXT_TYPES = ["event", "client", "project_placeholder", "vendor", "custom"] as const;
export type AppointmentContextType = (typeof APPOINTMENT_CONTEXT_TYPES)[number];
export const APPOINTMENT_CONTEXTS_WITH_NO_NODE: readonly AppointmentContextType[] = ["project_placeholder", "custom"];
export const APPOINTMENT_CONTEXT_TYPE_TO_NODE_TYPE: Partial<Record<AppointmentContextType, KnowledgeNodeType>> = {
  event: "event",
  client: "client",
  vendor: "vendor",
};

export interface Appointment {
  id: string;
  workspace_id: string;
  calendar_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  priority: AppointmentPriority;
  context_type: AppointmentContextType;
  context: KnowledgeNodeRef | null;
  client_id: string | null;
  /**
   * Never selected or assigned by this platform — per the stop condition,
   * Scheduling only solves TIME. `worker_id` is set only when a caller
   * has already decided WHO via Checkpoint 26.1's Capability Platform (or
   * a future Dispatch Platform); when set, it participates in worker
   * conflict detection (`docs/conflict-engine.md`), nothing more.
   */
  worker_id: string | null;
  /** Freeform display text, deliberately not a real location/geocoding concept — a future Dispatch/Field Operations checkpoint owns real location logic; this checkpoint never estimates travel time or distance from it. */
  location_placeholder: string | null;
  preparation_minutes: number;
  cleanup_minutes: number;
  notes: string | null;
  recurrence_rule_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const RESERVATION_RESOURCE_TYPES = ["worker", "equipment", "vehicle", "asset"] as const;
export type ReservationResourceType = (typeof RESERVATION_RESOURCE_TYPES)[number];

export const RESERVATION_STATUSES = ["held", "confirmed", "expired", "cancelled"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const RESERVATION_SOURCES = ["manual", "appointment", "system"] as const;
export type ReservationSource = (typeof RESERVATION_SOURCES)[number];

export interface Reservation {
  id: string;
  workspace_id: string;
  calendar_id: string;
  resource_type: ReservationResourceType;
  resource_id: string;
  starts_at: string;
  ends_at: string;
  status: ReservationStatus;
  source: ReservationSource;
  priority: AppointmentPriority;
  /** A `held` reservation expires at this timestamp unless confirmed first — computed fresh from `now`, never a stored timer (see `docs/reservation-engine.md`). `null` once confirmed/cancelled, or for a reservation that was never a temporary hold. */
  hold_expires_at: string | null;
  appointment_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * Covers both Step 1's "Availability Windows" and "Blackout Periods" —
 * the same representation, since a blackout is simply a `"blocked"`
 * window, optionally scoped beyond a single calendar. `calendar_id: null`
 * means workspace-wide, exactly how a true blackout period behaves.
 */
export const CALENDAR_WINDOW_TYPES = ["available", "blocked", "reserved", "maintenance", "holiday", "emergency_closure"] as const;
export type CalendarWindowType = (typeof CALENDAR_WINDOW_TYPES)[number];

export interface CalendarWindow {
  id: string;
  workspace_id: string;
  calendar_id: string | null;
  type: CalendarWindowType;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const WORKING_HOURS_KINDS = ["regular", "custom", "holiday", "weekend", "temporary_override", "seasonal"] as const;
export type WorkingHoursKind = (typeof WORKING_HOURS_KINDS)[number];

export interface WorkingHoursRule {
  id: string;
  workspace_id: string;
  calendar_id: string;
  kind: WorkingHoursKind;
  /** 0 (Sunday) – 6 (Saturday); `null` for a date-specific rule (`temporary_override`/`seasonal`/a one-off `holiday` rule). */
  day_of_week: number | null;
  /** ISO date; set only for date-specific rules. */
  specific_date: string | null;
  /** `"HH:mm"`, interpreted in `time_zone`. */
  starts_time: string;
  ends_time: string;
  time_zone: string;
  /** `true` for a rule that means "closed all day" (e.g. a weekend rule with no hours) — `starts_time`/`ends_time` are ignored when this is set. */
  is_closed: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const RECURRENCE_FREQUENCIES = ["daily", "weekly", "monthly", "yearly"] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export interface NthWeekday {
  /** 1-4 for the 1st through 4th occurrence in the month, or `-1` for "last." */
  week: number;
  /** 0 (Sunday) – 6 (Saturday). */
  weekday: number;
}

export interface RecurrenceRule {
  id: string;
  workspace_id: string;
  frequency: RecurrenceFrequency;
  /** Every N units — e.g. `interval: 2` with `frequency: "weekly"` means every other week. Always ≥ 1. */
  interval: number;
  /** For `weekly` — which weekdays (0-6) the rule fires on. `null` for other frequencies. */
  days_of_week: number[] | null;
  /** For `monthly` — a fixed day-of-month (1-31). Mutually exclusive with `nth_weekday`. */
  day_of_month: number | null;
  /** For `monthly` — "2nd Tuesday" style. Mutually exclusive with `day_of_month`. */
  nth_weekday: NthWeekday | null;
  end_date: string | null;
  occurrence_count: number | null;
  /** ISO dates explicitly excluded from the generated occurrence set. */
  exception_dates: string[];
  created_at: string;
  updated_at: string;
}

export const CAPACITY_SCOPES = ["worker", "team", "resource", "workspace"] as const;
export type CapacityScope = (typeof CAPACITY_SCOPES)[number];

export const CAPACITY_WINDOWS = ["day", "time_window"] as const;
export type CapacityWindowKind = (typeof CAPACITY_WINDOWS)[number];

export interface CapacityRule {
  id: string;
  workspace_id: string;
  scope: CapacityScope;
  /** `null` for `workspace` scope; a worker/team/resource id otherwise. */
  scope_id: string | null;
  window: CapacityWindowKind;
  max_concurrent: number;
  created_at: string;
  updated_at: string;
}

export const HOLIDAY_SCOPES = ["workspace", "regional", "custom"] as const;
export type HolidayScope = (typeof HOLIDAY_SCOPES)[number];

export interface Holiday {
  id: string;
  workspace_id: string;
  name: string;
  scope: HolidayScope;
  /** ISO date. When `recurring` is `true`, only the month/day is matched — the year is ignored. */
  date: string;
  recurring: boolean;
  emergency: boolean;
  time_zone: string;
  created_at: string;
  updated_at: string;
}

// ---- Computed results (never stored) ----

export const CONFLICT_TYPES = ["time_overlap", "resource_overlap", "worker_conflict", "equipment_conflict", "vehicle_conflict", "capacity_conflict", "holiday_conflict", "blackout_conflict", "buffer_conflict", "timezone_conflict"] as const;
export type ConflictType = (typeof CONFLICT_TYPES)[number];

export const CONFLICT_SEVERITIES = ["low", "medium", "high"] as const;
export type ConflictSeverity = (typeof CONFLICT_SEVERITIES)[number];

export interface SchedulingConflict {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  /** Names the exact rule that produced this conflict — never a bare message, same discipline `CapabilityBlockingReason` established. */
  blockingRule: string;
  description: string;
  affectedAppointmentIds: string[];
  affectedReservationIds: string[];
}

export interface ScheduleValidationIssue {
  rule: string;
  detail: string;
}

export interface ScheduleValidationResult {
  valid: boolean;
  errors: ScheduleValidationIssue[];
  warnings: ScheduleValidationIssue[];
  conflicts: SchedulingConflict[];
}

/** Step 13 — schedule quality only. No worker selection ever factors into these scores. */
export interface SchedulingScores {
  windowQualityScore: number;
  bufferQualityScore: number;
  capacityUtilizationScore: number;
  conflictSeverityScore: number;
  scheduleDensityScore: number;
  calendarHealthScore: number;
}

export interface ResolvedAvailabilityWindow {
  starts_at: string;
  ends_at: string;
  available: boolean;
  /** Populated only when `available: false` — which rule/window caused it. */
  reason: string | null;
}

export const CALENDAR_VIEW_GRANULARITIES = ["daily", "weekly", "monthly"] as const;
export type CalendarViewGranularity = (typeof CALENDAR_VIEW_GRANULARITIES)[number];

export interface CalendarViewEntry {
  appointment: Appointment;
  isRecurringInstance: boolean;
  recurrenceRuleId: string | null;
}

export interface CalendarView {
  calendarId: string;
  granularity: CalendarViewGranularity;
  rangeStart: string;
  rangeEnd: string;
  entries: CalendarViewEntry[];
}

export const SCHEDULING_FINDING_TYPES = ["overbooked_schedule", "unavailable_time_window", "capacity_exhausted", "recurring_conflict", "holiday_conflict", "reservation_expiration", "calendar_health"] as const;
export type SchedulingFindingType = (typeof SCHEDULING_FINDING_TYPES)[number];

export const SCHEDULING_FINDING_SEVERITIES = ["low", "medium", "high"] as const;
export type SchedulingFindingSeverity = (typeof SCHEDULING_FINDING_SEVERITIES)[number];

export interface SchedulingFinding {
  id: string;
  type: SchedulingFindingType;
  severity: SchedulingFindingSeverity;
  description: string;
  relatedCalendarId: string | null;
  relatedAppointmentId: string | null;
  relatedReservationId: string | null;
}
