# Workforce

v2.0 Checkpoint 26 — Mobile Workforce Platform Foundation. `types/workforce.ts` defines the field-workforce domain: Workers, Teams, Skills, Certifications, and everything the rest of Checkpoint 26 (Availability, Assignment, Mobile Session, Offline, Location, Equipment, Vehicles) builds on top of.

## Worker vs. Team Member — a deliberate split

A `Worker` (`core/enums/entityType.ts`'s `"worker"`) is a field-workforce record — a technician, photographer, installer, driver, or contractor. A `team_member` (already reserved by `docs/database.md`, used by the Team Management surface) is a platform login/permission holder.

These are genuinely different concepts:

- Not every Worker has platform access (a subcontractor showing up for a single install doesn't need a login).
- Not every `team_member` is field workforce (an office-based accountant is a `team_member` but never a `Worker`).

When a Worker *does* also hold a login, `Worker.linked_member_id` points at their `team_member` row — this is a link, never a duplicated identity or permission record. Permissions themselves are never re-implemented here; a Worker with `linked_member_id` set is governed by the existing Team Management permission matrix (`lib/team/permissionMatrix.ts`), extended this checkpoint with `"workforce.view"`/`"workforce.manage"`.

## Worker

```ts
interface Worker {
  id: string;
  workspace_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role: WorkerRole;                 // technician | photographer | videographer | installer | inspector | driver | crew_member | supervisor | contractor | vendor_rep | other
  employment_type: EmploymentType;  // full_time | part_time | contractor | seasonal | volunteer
  status: WorkerStatus;              // active | inactive | on_leave | terminated
  current_activity: CurrentActivityState; // idle | traveling | on_site | in_meeting | on_break | off_duty
  team_id: string | null;
  supervisor_worker_id: string | null;
  linked_member_id: string | null;
  time_zone: string;
  language: string;
  profile_photo_url: string | null;
  emergency_contact: EmergencyContact | null;
  skills: WorkerSkill[];
  certifications: WorkerCertification[];
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}
```

`status` (stored) and `current_activity` (worker-reported, moment-to-moment) are deliberately separate fields — a worker can be `active` (employment status) while `on_site` (current activity) while `available` for their *next* assignment (a third, independent concept — see [`availability.md`](availability.md)). Conflating these into one field would make "is this person employed," "what are they doing right now," and "can they take more work" impossible to answer independently, which real dispatch questions need.

## Team

A field-workforce crew (`Team`), distinct from Team Management's organization-wide Team surface (`docs/team-dashboard.md`). `member_worker_ids` is the source of truth for membership; `leader_worker_id` must be one of them. See [`core/workforce/teamEngine.ts`](../src/core/workforce/teamEngine.ts) for capacity/availability aggregation.

## Skills & Certifications

Embedded directly on `Worker`, not a second registry — see [`core/workforce/skillsEngine.ts`](../src/core/workforce/skillsEngine.ts) and this checkpoint's dedicated section in that file's own comments. `SkillLevel` is `primary | secondary | learning`. A `WorkerCertification.expiration_date: null` means "never expires" and is never surfaced as "expiring."

## What this checkpoint does NOT include

Per the spec's own stop condition: no scheduling, no dispatch, no route optimization, no maps, no GPS history, no workforce automation. This is the reusable operational foundation; those are explicitly future-checkpoint work.

## Architecture

| Module | File |
|---|---|
| Domain types | `types/workforce.ts` |
| Worker Registry | `lib/data/mock/workersStore.ts` |
| Team Registry | `lib/data/mock/teamsStore.ts` |
| Team Engine | `core/workforce/teamEngine.ts` |
| Skills Engine | `core/workforce/skillsEngine.ts` |
| Timeline Engine | `core/workforce/workforceTimelineEngine.ts` |
| Scorecard Engine | `core/workforce/workforceScorecardEngine.ts` |
| Module layer | `modules/workforce/workforceActions.ts` |
| Dashboard | `modules/workforce/components/WorkforceDashboardView.tsx` at `/assets/workforce` |

See [`availability.md`](availability.md), [`assignment-engine.md`](assignment-engine.md), [`mobile-foundation.md`](mobile-foundation.md), [`offline-foundation.md`](offline-foundation.md), [`location-foundation.md`](location-foundation.md), [`equipment.md`](equipment.md), [`vehicles.md`](vehicles.md), and [`v2-checkpoint-26.md`](v2-checkpoint-26.md) for the rest of this checkpoint.
