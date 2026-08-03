# Luxury Components — Checkpoint 19.2 Additions

Reference for every shared primitive this checkpoint added or extended. All extensions are additive/optional — every existing call site from Checkpoint 19.1 keeps compiling and rendering identically unless it opts into the new props.

## `ModuleInsightCard` (new) — Step 6

`src/components/ui/ModuleInsightCard.tsx`. A small sparkle-icon card for a single, real, data-derived observation.

```tsx
<ModuleInsightCard insight="1 qualified lead hasn't been touched in over a week." tone="warning" />
```

- `insight: string` — a plain sentence the **caller** computes from data it already fetched. This component never calls any AI/LLM, ever — it's styled with the "AI insight" sparkle language purely because that's this app's established visual idiom for "a considered observation," not because anything intelligent generates the text at render time.
- `tone?: "info" | "success" | "warning"` — controls the icon-chip color only.

Distinct from `src/modules/dashboard/luxury/components/AIInsightCard.tsx`, which is a completely different, pre-existing (Checkpoint 19) component: the Owner Dashboard's own real Analytics Executive Summary surface, which genuinely does read from an AI-generated brief. The two are intentionally not unified — one is deterministic arithmetic on already-loaded rows, the other surfaces a real generated summary; conflating them would misrepresent what each actually does.

Applied to: Leads, Clients, Contracts, Events, Invoices, Payments, Vendors, Purchases — each computing a genuinely real number (overdue counts, stale-signature counts, missing-contact-info counts, etc.) from data already in memory, and rendering nothing at all when there's nothing worth surfacing (never a forced/fabricated banner).

## `KpiCard` — Step 7 additions

`src/components/ui/KpiCard.tsx` gained two new optional props:

```tsx
<KpiCard
  icon={FinanceIcon}
  label="Total Collected"
  value="$18,450"
  trend={{ direction: "up", label: "12%" }}
  sparkline={[4200, 5100, 4800, 6300, 7100, 6900]}
/>
```

- `trend?: { direction: "up" | "down" | "flat"; label: string }` — renders a small arrow + colored label below the value. The caller supplies a pre-formatted string; this component never computes a percentage itself.
- `sparkline?: number[]` — a short numeric series (oldest first), rendered as a tiny dependency-free inline SVG polyline (same technique as the Owner Dashboard's own `RevenueTrendChart` from Checkpoint 19 — no charting library exists in this codebase, and adding one for a sparkline would be out of proportion).

Neither prop was force-added to existing call sites — they're used only where a caller has a genuine prior-period comparison or short time series already computed, to avoid fabricating a trend where none is actually known.

## `PageHeader` — Step 5 additions

`src/components/ui/PageHeader.tsx` gained four optional slots: `icon`, `breadcrumb`, `aiInsight`, `date`. See `docs/luxury-motion-system.md` for the animation treatment applied to the header itself.

## `EmptyState` — Step 4 additions

See `docs/luxury-empty-states.md` for the full rationale and usage.

## Tables — Step 10

Every table wrapper touched in this checkpoint (Leads, Clients, Contracts, Events, Invoices, Payments, Vendors, Purchases, Documents) received the same three changes:

1. **Sticky header** — `<thead className="sticky top-0 z-[var(--z-index-dropdown)] bg-surface">`. This works correctly because `AppShell`'s own `<main>` element (not the whole page) is the scrollable container, so the header sticks to the top of the content area, not the browser viewport.
2. **Row hover** — `hover:bg-accent-100/40` (already present from Checkpoint 19.1's own table polish, confirmed consistent).
3. **Entrance animation** — the table wrapper gets `animate-fade-up` with the next stagger step after its KPI grid.

No pagination component was added — every one of these tables already renders its full filtered result set without pagination (a pre-existing architectural choice, not something this checkpoint's own "Luxury pagination" line item could introduce without a real backend page-size/cursor mechanism, which is out of scope for a UX-polish checkpoint).

## Toast — Step 12

`src/components/ui/Toast.tsx`'s `ToastTone` grew from `"success" | "danger"` to `"success" | "warning" | "danger" | "info"` — four real visual tones. The spec's own longer example list (Task Completed, Payment Received, Proposal Approved, AI Suggestion, Reminder, ...) are all message **content** using one of these four tones, not nine distinct visual treatments — seeing "Payment Received" rendered in the same `success` green as "Task Completed" is correct, not a missing feature. Entrance now uses `animate-toast-in`.

## Timeline — Step 8

`src/modules/timeline/components/Timeline.tsx` (the generic activity-log timeline used across Leads/Clients detail pages) and `src/modules/dashboard/luxury/components/ScheduleTimeline.tsx` (the Team/Client Dashboard's own richer timeline, which already had icon/status/color from Checkpoint 19) both gained `animate-timeline-reveal` + per-row stagger. `Timeline.tsx`'s underlying `TimelineActivity` type has no status/assignee field to render — adding one would mean inventing data the type doesn't carry, so this component's enhancement is animation-only; `ScheduleTimeline.tsx` already had the richer icon/status/color treatment from Checkpoint 19 and only needed the entrance motion added.

## Forms — Step 11 (scoped down; see Known Limitations in the final report)

Floating labels, multi-step progress, and a real autosave indicator would each require restructuring markup or adding new state to every individual form in the app — a genuine redesign risk, not a polish-only change. This checkpoint's real, safe contribution to forms is the Checkpoint 19.1 `Input`/`Select` polish (soft shadow, blush focus ring, smooth color transition on the `invalid` state) plus the shared motion system's smooth transitions — already shipping everywhere these primitives are used.

## Calendar — Step 13 (not applicable)

There is no calendar-grid component in this codebase to polish. The one calendar-adjacent component, `src/modules/calendar/components/CalendarNavigationBar.tsx`, documents in its own code comment that it's scaffolding for "a later checkpoint compos[ing] an actual date grid underneath this" — and it has zero current call sites anywhere in the app (confirmed via a full-repo search). The Owner Dashboard's own "Calendar — This Week" is a deliberate compact agenda list, not a grid (a decision already made and documented in Checkpoint 19). Building a real calendar grid engine from scratch would be a substantial new feature, not a polish pass on an existing one, and is out of this checkpoint's scope.

## Quick Actions — Step 9

The existing "New Lead" / "New Client" / "New Event" / "New Invoice" / etc. buttons in each `PageHeader`'s `actions` slot already constitute the real, working quick-action affordance for each module's primary create flow. Additional contextual actions named in the spec (Proposal, Meeting, Reserve, Adjust, Assign Team) either already exist as real actions elsewhere in each module (e.g. `Commercial Pipeline`'s own per-lead action menu, already built in an earlier checkpoint) or would require new Server Actions/routes that don't currently exist — out of scope for a change that must not add business logic.
