# Calendar Dashboard & Detail View

`src/modules/scheduling/components/{CalendarDashboardView,CalendarDetailView}.tsx` — v2.0 Checkpoint 27, Steps 17-18. Routes: `/calendar`, `/calendar/[id]`.

## Calendar Dashboard (`/calendar`)

Every figure is read straight from `evaluateWorkspaceSchedulingAction()`'s already-computed result — no scheduling, no dispatch, no AI. Sections, in order:

- **KPI row** — calendar count, today's appointment count, total finding count, average calendar health across all calendars.
- **High-Severity Findings** / **Other Findings** — every `SchedulingFinding` the 7-detector risk engine produced, grouped by severity.
- **Calendars** — one row per calendar, linking to its Detail View, showing its own `calendarHealthScore` and upcoming-appointment count.
- **Upcoming Reservations** — held/confirmed reservations, soonest first.
- **Blocked Periods** — upcoming non-`"available"` `CalendarWindow`s.
- **Holiday Calendar** — the workspace's configured holidays.

## Calendar Detail View (`/calendar/[id]`)

- **KPI row** — upcoming appointment count (via `getCalendarViewAction`, a 14-day lookahead including expanded recurring instances), reservation count, live conflict count, this calendar's own health score.
- **Schedule Quality** — all six `SchedulingScores` for this calendar.
- **Findings** — the subset of workspace findings whose `relatedCalendarId` matches.
- **Appointments** — every entry in the 14-day `CalendarView`, each showing any real-time `ConflictEngine` conflicts detected against it (recomputed client-side from the same view data, never a second detection pass).
- **Reservations**, **Working Hours**, **Blocked Periods**.

## Accessibility (Step 21)

Real `<button>`/`<a>` elements throughout; `role="list"`/`listitem` for every list; an `aria-live="polite"` region on the Dashboard announces refresh completion; severity is always conveyed with a text label alongside the badge color (`Badge` never relies on color alone).

## Performance (Step 22)

Groupings (`todaysAppointments`, `upcomingReservations`, `highFindings`, etc.) are `useMemo`-derived. Evaluation only runs on mount and on an explicit Refresh click, never on every render.

## Known limitation

No creation UI for Calendars/Appointments/Reservations/config rows — the same precedent Capability Requirements and Executive Decisions established (no creation form; entities are created via the module action layer, exercised directly in tests). The dashboards cover every read/evaluate surface the spec asked for.
