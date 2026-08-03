# Luxury Motion System

Checkpoint 19.2, Step 1. A centralized, named vocabulary of entrance/feedback animations in `src/app/globals.css`, so every module reaches for the same handful of elegant, restrained motions instead of inventing its own. Building on the design-token/spacing system Checkpoint 19.1 already unified, this is the motion layer on top.

## Why CSS classes, not a JS animation library

This codebase has no animation library (no Framer Motion, no react-spring). Adding one for a polish-only checkpoint would be a real new dependency and a real new failure surface for a purely visual change. Plain CSS `@keyframes` + utility classes get the same elegant result with zero new runtime code, zero new bundle weight, and — critically — for free compatibility with the one non-negotiable requirement (`prefers-reduced-motion`) via a single sitewide rule that already existed before this checkpoint (Checkpoint 19, Step 15):

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Because this rule targets the universal selector, every animation class documented below — present now or added later — is automatically neutralized for a user with reduced-motion enabled, with no per-component opt-out logic required.

## Timing and easing

Durations sit inside the checkpoint's own 180–350ms band, reusing the existing `--duration-base-ms` (200ms) / `--duration-slow-ms` (320ms) tokens and `--easing-standard` / `--easing-decelerate` curves — no new timing vocabulary was introduced.

## The classes

| Class | Motion | Use for |
|---|---|---|
| `.animate-fade-in` | Opacity 0→1 | Modal/Drawer backdrops |
| `.animate-fade-up` | Opacity + translateY(10px)→0 | Page sections, KPI grids, cards, insight banners — the default "this just arrived" motion |
| `.animate-fade-down` | Opacity + translateY(-10px)→0 | Page headers, the shared dashboard greeting |
| `.animate-scale-in` | Opacity + scale(0.96)→1 | Modal panels |
| `.animate-widget-reveal` / `.animate-timeline-reveal` | Same as fade-up, named separately | Dashboard widgets / Timeline rows, for semantic clarity at the call site |
| `.animate-success-pop` | A small overshoot-then-settle scale | A genuine success confirmation moment (reserved for real success feedback, not decoration) |
| `.animate-modal-in` / `.animate-drawer-in` / `.animate-toast-in` | Scale-in / edge-slide-in / gentle rise | `Modal`, `Drawer`, `Toast` respectively — distinct per surface so each still reads as the same elegant family without being identical |
| `.hover-lift` | translateY(-2px) + shadow-md on hover, slight scale-down on press | Opt-in for cards/links that should feel liftable (e.g. `KpiCard` when it's a link) |
| `.stagger-0` … `.stagger-6` | `animation-delay` in 40ms steps | Combine with `animate-fade-up` on siblings that should cascade in sequence (a KPI row, a Dashboard's stacked sections) |
| `.luxury-shimmer` | A moving gradient sweep | The `Skeleton` primitive's own loading treatment (replaces the old flat `animate-pulse`) |

## Where it's wired in

- **`Modal.tsx`, `Drawer.tsx`, `Toast.tsx`** — backdrop fade + panel entrance, each using its own named animation.
- **`Skeleton.tsx`** — `luxury-shimmer` instead of `animate-pulse`.
- **`PageHeader.tsx`** — `animate-fade-down` on the whole header, `animate-fade-up stagger-1` on the optional `aiInsight` slot.
- **`EmptyState.tsx`, `ErrorState.tsx`** — `animate-fade-up`.
- **The Owner/Team/Client Dashboards** (`OwnerDashboardView.tsx`, `TeamDashboardView.tsx`, `ClientDashboardView.tsx`) — each top-level section (metrics → widgets → secondary widgets → closing section) gets `animate-fade-up` + an incrementing `stagger-N`, so the page visibly cascades in on load: Greeting (via the shared `PersonalizedWelcomeHeader`, `animate-fade-down`, no delay) → Metrics (`stagger-1`) → Main widgets (`stagger-2`) → Secondary widgets (`stagger-3`) → Closing section (`stagger-4`). This is an **animation-only** change — no structure, copy, or data changed on any of the three approved dashboards.
- **Every module list view migrated in this checkpoint** (Leads, Clients, Contracts, Events, Invoices, Payments, Vendors, Purchases) — the insight card, KPI grid, and table each get `animate-fade-up` with an incrementing stagger, mirroring the same cascade pattern used on the Dashboards.
- **`Timeline.tsx`, `ScheduleTimeline.tsx`** — each row gets `animate-timeline-reveal` + `stagger-{min(index, 6)}`.

## Known limitations

- No page-transition (route-to-route) animation exists — Next.js App Router doesn't have a built-in transition hook this codebase already uses, and adding one (e.g. via `useTransition`+ view transitions API) would be new client-routing behavior, not a pure visual add-on. Left as a future increment.
- Stagger delays cap at `stagger-6` (240ms) — a list with more than 7 siblings reuses the last step rather than growing unboundedly, so a long list doesn't take seconds to finish cascading in.
