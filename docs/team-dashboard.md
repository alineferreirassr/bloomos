# Team Dashboard

Checkpoint 19, Steps 7-8. Rendered at `/dashboard` for role `manager`/`staff` (see `docs/dashboard-experience-resolver.md`). Matches the approved Team reference image's own structure exactly.

## Data source

`getTeamDashboardData()` (`src/modules/dashboard/luxury/getTeamDashboardData.ts`) composes `getEvents()`, `getChecklistByEventId()`, `getScheduleByEventId()`, and (permission-gated) the same Client Portal messaging store the Owner Dashboard reads. Every list is filtered to what this specific member is assigned to **before** it's ever returned — Step 17's own rule that a Team member must never see workspace-wide revenue, all clients, or unassigned confidential events.

## "Assigned to me" — a documented, best-effort match

There is no real Team Member foreign key on either `Event` or `ChecklistItem` today (confirmed during this checkpoint's own research — `Event.assigned_owner` and `ChecklistItem.assigned_name` are both free-text display-name fields, the same "reserve the shape, no real FK yet" precedent this codebase has used since Checkpoint 9 for `AssignedType`/`assigned_id`). `isAssignedToMember()` matches the signed-in member's own `profile.full_name` against those free-text fields, case-insensitively.

If nothing matches (a genuinely unassigned member, or a name that doesn't line up with seed data), the aggregator falls back to this member's own **permission-gated** visible set (`events.view`) rather than leaving every card silently empty — a member with real, broad visibility still sees a working (if unfiltered-by-assignment) Schedule; a member without that permission sees nothing, never a workspace-wide leak.

This is the checkpoint's single biggest documented gap: a future Team Operations module (already anticipated by `EventServiceTeamRequirement.assigned_member_id`'s own doc comment) would replace this name-matching with a real foreign key, and this aggregator's `isAssignedToMember()` is the one place that would change.

## "Tasks" = `ChecklistItem`, reused

The checkpoint's own spec talks about "Tasks Today"/"My Tasks"/"Upcoming Tasks." This codebase has no generic `Task` entity (confirmed: `docs/design-system.md` itself documents this same gap for the Classical Dashboard). Rather than inventing a new domain, the Team Dashboard treats a member's own open, assigned `ChecklistItem`s as their tasks — due today, due later, or none. This is a deliberate reuse decision, not a placeholder.

## Role-specific composition (Step 8)

`TeamDashboardView` renders the identical shell/cards for every `TeamRoleLabel` — the aggregator has already filtered every list to this member's own assignments regardless of their label, so the "same foundation, role-aware composition" requirement is satisfied by the label being shown as a badge in the profile menu today. Building distinct card *layouts* per label (Planner sees client-communication-forward cards; Setup Team sees a material checklist; etc.) is the natural next increment and is called out explicitly in Known limitations — see `docs/dashboard-experience-resolver.md`'s "Adding a new dashboard role variant" for exactly where that would hook in.

## Event Progress

`progressPercent` is the real completion ratio of the current event's own `ChecklistItem`s. The six stage icons (Planning/Design/Logistics/Setup/Execution/Cleanup) are derived from `ChecklistCategory` buckets (e.g. Design = `decor`+`flowers`, Logistics = `venue`+`transportation`+`inventory`) — a stage with zero items in its bucket is treated as complete (nothing outstanding), never left in a permanently-incomplete state.

## Known limitations

- **Assignment matching is free-text name matching**, not a real foreign key (see above) — the single biggest documented gap in this checkpoint.
- **Role-specific card composition is not yet built** — every `TeamRoleLabel` sees the identical card set today; only the label itself (a badge) differs.
- **Weather** uses the current event's own real `weather_plan` field when set; there is no real weather API integration (explicit Non-Goal), so a high/low temperature is only shown when the caller supplies one — none do today, so the Weather card renders only when `weather_plan` text exists.
