import type { ScheduleValidationResult, ScheduleValidationIssue } from "@/types/scheduling";
import { detectAppointmentConflicts, type AppointmentConflictInput } from "@/core/scheduling/conflictEngine";

/**
 * v2.0 Checkpoint 27, Step 12 — Schedule Validation Engine. The single
 * "can this appointment actually be saved" gate: structural field checks
 * plus every `ConflictEngine` finding, reduced to `valid`/`errors`/
 * `warnings`. A `"high"`-severity conflict always blocks (`errors`); a
 * `"medium"`-severity one (buffer/timezone) is surfaced but never blocks
 * (`warnings`) — the caller can still save, just sees the heads-up.
 */

export function validateAppointmentSchedule(title: string, conflictInput: AppointmentConflictInput): ScheduleValidationResult {
  const errors: ScheduleValidationIssue[] = [];
  const warnings: ScheduleValidationIssue[] = [];
  const { candidate } = conflictInput;

  if (!title.trim()) errors.push({ rule: "title_required", detail: "An appointment needs a title." });
  if (candidate.ends_at <= candidate.starts_at) errors.push({ rule: "invalid_interval", detail: "End time must be after the start time." });
  if (candidate.preparation_minutes < 0 || candidate.cleanup_minutes < 0) errors.push({ rule: "invalid_buffer", detail: "Preparation and cleanup minutes cannot be negative." });

  const conflicts = candidate.ends_at > candidate.starts_at ? detectAppointmentConflicts(conflictInput) : [];
  for (const conflict of conflicts) {
    const issue: ScheduleValidationIssue = { rule: conflict.type, detail: conflict.description };
    if (conflict.severity === "high") errors.push(issue);
    else warnings.push(issue);
  }

  return { valid: errors.length === 0, errors, warnings, conflicts };
}
