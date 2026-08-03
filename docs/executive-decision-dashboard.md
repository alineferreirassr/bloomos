# Executive Decision Dashboard

v2.0 Checkpoint 25.7, Step 8. `modules/executiveDecisions/components/ExecutiveDashboardView.tsx` at [/assets/executive-decisions](../src/app/(app)/assets/executive-decisions/page.tsx), linked from the Business Health Dashboard's own header. Every figure is read straight from `evaluateExecutiveDecisionsAction`'s already-computed result — no client-side scoring, no new detection.

**Naming note**: the spec calls this file `docs/executive-dashboard.md`, but that name is already taken by Checkpoint 23's "Executive Dashboard 2.0" (the BI Platform's `/analytics` Executive tab — revenue/pipeline/forecast KPIs, unrelated to this checkpoint). Rather than overwrite an unrelated prior checkpoint's documentation, this file is named `executive-decision-dashboard.md` instead — disclosed here and in the master checkpoint report.

## Sections (Step 8's own list)

| Named section | Implementation |
|---|---|
| Executive Queue | Top 10 of `data.queue` (Step 4), with a "Showing the top 10 of N" note |
| Critical Decisions | `data.queue` filtered to `priority === "critical"` |
| High Priority Decisions | `data.queue` filtered to `priority === "high"` |
| Business Health | Folded into the KPI row (`scorecard.businessScore` via `overallExecutiveScore`'s helper text) — the full Business Health Dashboard already exists at `/assets/business-health`; this page links to it rather than duplicating it |
| Objective Progress | `scorecard.objectiveScore` in the KPI row — the full Objectives section already exists on the Business Health Dashboard (Step 15.6) |
| Decision Trends | Present, honestly disclosed as unavailable — see Known Limitations |
| Resolved Decisions | `data.resolvedDecisions.length`, shown in the "Pending Decisions" KPI helper text |
| Pending Decisions | `data.allDecisions` filtered to not resolved/archived |
| Workspace Readiness | `scorecard.readinessScore` KPI card |
| Top Risks | `insights.mostViolatedBusinessRules` + `insights.mostBlockedObjectives`, top 3 each |
| Top Opportunities | `report.topImprovements` |

## Step 15 — Accessibility

- **Keyboard navigation**: every interactive row is a real `<button>` (the "Resolve" action, the "Show/Hide" toggle), never a clickable `<div>` — native focus and Enter/Space activation come for free.
- **ARIA**: the queue and decision lists carry `role="list"` with `role="listitem"` entries, so screen readers announce an accurate count; the "Resolve" button carries `aria-label={'Mark "{title}" resolved'}` since its visible text alone ("Resolve") doesn't say which decision; the "Show/Hide All Decisions" toggle carries `aria-expanded`.
- **Screen readers**: an `aria-live="polite"` region (visually hidden via `sr-only`) announces the result of resolving a decision or an error, so a screen-reader user gets the same confirmation a sighted user sees.
- **Reduced motion**: no bespoke CSS animation is introduced anywhere in this component — every transition (button hover, card elevation) reuses the app's existing Luxury Motion System tokens, which already respect `prefers-reduced-motion` (Checkpoint 19.2).
- **Focus management**: resolving a decision doesn't move focus away from the button that triggered it (no focus trap, no unexpected jump) — the row simply re-renders as "resolved" in place.

## Step 16 — Performance

- **Memoization**: the Critical/High/Pending decision groupings are `useMemo`-derived from `data`, so they aren't recomputed on every unrelated re-render (e.g., the `busyId` state changing while a Resolve request is in flight).
- **Lazy Dashboard Loading**: the "All Decisions" section only renders its list once expanded (`showAllDecisions` state) — a workspace with hundreds of Decisions doesn't pay for rendering all of them on first paint.
- **Decision/Priority/Queue Cache**: the honest claim this checkpoint can make in a mock-data app — `evaluateExecutiveDecisionsAction()` runs once on mount and once per explicit "Re-evaluate" click, never on every render, so the (already inexpensive) scoring pass isn't repeated needlessly. There is no cross-request server-side cache this checkpoint, since the underlying mock stores hold the full state in memory already.

## Known limitations (disclosed, not hidden)

- **Decision Trends has no real data to show.** This checkpoint stores only the latest evaluation (`decisionsStore.ts` keeps live Decision records, but nothing snapshots a Decision's score/priority history over time) — the card says so directly rather than fabricating a chart, the same pattern `ObjectivesSection.tsx`'s "Objective Completion Trend" card already established (Step 15.6).
- **No live browser verification** — `NEXT_PUBLIC_DATA_MODE=supabase` is configured with real credentials this session has no access to; per policy, a password is never requested in chat. Verified instead via `tsc --noEmit`, `eslint` (0 errors), the full `vitest` suite, and a successful production build including the new `/assets/executive-decisions` route.
