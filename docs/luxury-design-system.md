# Amoré Bloom Luxury Design System

The Luxury Design System is the visual language behind the Owner Dashboard, Team Dashboard, and Client Dashboard — the three experiences the approved reference images specify. It is **additive**, not a re-skin: every existing screen (CRM, Finance, Documents, Developer, Marketplace, and everything else) keeps the existing Classical gold/ink design system (`docs/design-system.md`) completely unchanged. "Complete application redesign" is this checkpoint's own explicit Non-Goal, and no step in its spec ever asks for a non-Dashboard page to change.

## Scope

The Luxury shell renders only at:

- `/dashboard` (Owner and Team experiences, resolved server-side — see `docs/dashboard-experience-resolver.md`)
- `/client-access` (the Client Dashboard)

`AppShell.tsx` and `ClientPortalShell.tsx` each check the current pathname and render bare for exactly these routes, letting `LuxuryDashboardShell`/`LuxuryClientDashboardShell` own the entire page — no second navigation rail, no Classical breadcrumb bar layered underneath. Every other route (including every other page inside `(client-portal)`, like `/client-access/events`) renders through the existing Classical shells unchanged.

## Design tokens

All new tokens live in `src/app/globals.css`, prefixed `--luxury-*`, defined additively alongside (never replacing) the existing Classical `--color-*`/`--radius-*`/`--shadow-*` tokens. Tailwind v4's CSS-first `@theme inline` block maps each one to a real utility class:

| Token | Utility | Purpose |
|---|---|---|
| `--luxury-background` | `bg-luxury-background` | Page background (soft blush-ivory) |
| `--luxury-surface` | `bg-luxury-surface` | Card surface (near-white) |
| `--luxury-surface-tint` | `bg-luxury-surface-tint` | Soft blush card variant (notes/reminders) |
| `--luxury-border` | `border-luxury-border` | Warm, low-contrast border |
| `--luxury-text` / `--luxury-text-muted` | `text-luxury-text(-muted)` | Ink / muted ink |
| `--luxury-blush` | `bg-luxury-blush` / `text-luxury-blush-foreground` | Icon circles, subtle fills |
| `--luxury-rose` | `bg-luxury-rose` / `text-luxury-rose(-foreground)` | Primary accent — active nav, buttons, progress fill, hearts |
| `--luxury-coral` | `bg-luxury-coral` / `text-luxury-coral-foreground` | Secondary highlight (reserved) |
| `--luxury-ivory`, `--luxury-warm-white`, `--luxury-beige` | matching utilities | Supporting neutrals |
| `--luxury-success` / `-warning` / `-critical` / `-pending` | `StatusBadge`'s own tones | Distinct status hues — unlike the Classical system's single-accent-family status language, Step 1 explicitly asked for separate Success/Warning/Critical/Pending colors |
| `--luxury-radius-sm/md/lg/full` | `rounded-luxury-*` | Large, soft radii matching the reference images |
| `--luxury-shadow-sm/md/lg` | `shadow-luxury-*` | Barely-visible, warm-tinted shadows |
| `--luxury-duration-gentle-ms` | used inline | A touch slower than the Classical system's 200ms base — calmer entrance/hover motion |
| `--luxury-focus-ring` | `focus-visible:[box-shadow:var(--luxury-focus-ring)]` | Rose-tinted focus ring |

### Typography

Reuses the Classical system's own font stacks (Cormorant Garamond display, Lora body) — the reference images' headline serif matches what's already loaded, so no new webfont was added. New named type-scale steps live in Tailwind's `--text-*` namespace (`text-luxury-display`, `-page`, `-section`, `-card-heading`, `-body`, `-small`, `-metadata`, `-status`, `-numeric`), each a plain font-size (+ line-height for `display`) — components combine these with `font-luxury-display`/`font-luxury-body` and a weight.

## Shared components (Step 3)

All live under `src/modules/dashboard/luxury/components/`:

`LuxuryDashboardShell`, `LuxurySidebar`, `LuxuryMobileNavigation`, `LuxuryNavRows` (the row-renderer both the internal and Client Portal sidebars share), `LuxuryClientDashboardShell`/`LuxuryClientSidebar`/`LuxuryClientMobileNavigation`, `PersonalizedWelcomeHeader`, `DashboardDateSelector`, `NotificationButton`/`MessageButton` (thin wrappers over the shared `IconBadgeButton`), `ProfileMenu`, `LuxuryMetricCard`, `EventPreviewCard`, `EventHeroCard` (shared by Team's "Current Event" and Client's "Your Proposal"), `ScheduleTimeline` (shared by Team's "Today's Schedule" and Client's "Event Timeline"), `TaskChecklist` (shared by Team's "My Tasks" and Client's "Planning Checklist"), `PriorityList`, `ProgressCard`, `PaymentSummaryCard`, `TeamActivityCard`/`RecentMessagesCard` (thin wrappers over the shared `ActivityFeedList`), `AIInsightCard` + `OwnerAIBriefCard`, `PlannerContactCard`, `IncludedServicesGrid`, `ImportantNotesCard` + `WeatherNoticeCard` (thin wrapper), `SectionHeader`, `StatusBadge`, `RevenueTrendChart`, `LuxuryCard`.

Every icon on a dashboard DTO is a **plain string name**, never a component reference or rendered element — resolved client-side via `resolveLuxuryIcon()` (`src/modules/dashboard/luxury/resolveLuxuryIcon.ts`), the same pattern `resolveMetricIcon`/`resolveConnectorIcon` already established. This is the direct, deliberate fix for the Analytics checkpoint's own serialization bug (a Server Action once returned a live `compute` function reference across the server/client boundary and crashed); every `get*DashboardData()` aggregator in this checkpoint was verified (in its own test) to return a value that survives `JSON.parse(JSON.stringify(...))` unchanged.

`EmptyState`/`ErrorState`/`Skeleton` are reused directly from the existing Classical `components/ui/*` kit — they're already spec-compliant three-state primitives; rebuilding them for the Luxury system would have been pure duplication.

## Accessibility & motion (Steps 14-15)

- Landmarks: `<aside>`/`<nav>`/`<main>` throughout; every section uses a real `<h2>` (`SectionHeader`) under the page's own `<h1>` (`PersonalizedWelcomeHeader`).
- Every icon-only button carries a real `aria-label`; the mobile nav drawer reuses `useDialogBehavior` — the same focus-trap/Escape-to-close/scroll-lock hook `Modal`/`Drawer` already share.
- `StatusBadge` always renders a text label, never color alone.
- `ProgressCard`'s bar is a real `role="progressbar"` with `aria-valuenow`/-min/-max; each stage icon carries a `sr-only` complete/incomplete label.
- `TaskChecklist`'s toggle buttons use `aria-pressed`; nav links use `aria-current="page"`.
- A new sitewide rule in `globals.css` collapses all animations/transitions to near-zero under `prefers-reduced-motion: reduce` — this benefits the whole app, not just the new Luxury components, since no such rule existed before this checkpoint.

## Known limitations

- **`branding.brand-color` doesn't yet drive the Luxury palette.** The Settings Registry still stores it (existing since Checkpoint 11), but the rose/blush hex values here are fixed, matching the three approved reference images pixel-for-pixel. Making the whole palette dynamically recolor from one setting value would need a runtime CSS-custom-property override system beyond this checkpoint's scope.
- **A few reference-image nav destinations have no real route yet** — Calendar, Tasks, Gallery, Reports (Owner/Team), and Design & Inspiration/Gallery/Settings (Client) are never invented; the Luxury sidebars render this app's own real, existing routes only (see `docs/dashboard-experience-resolver.md` and `docs/client-dashboard-experience.md` for the exact mapping).
- **"Calendar — This Week"** renders as a compact 7-day agenda list, not an hour-by-hour grid — this codebase has no calendar-grid rendering engine, and building one was judged out of proportion to this checkpoint's remaining scope; the information (a week's events organized by day) is preserved.
- **No chart library** — `RevenueTrendChart` is a small, dependency-free inline SVG polyline over a real computed monthly series, not a fabricated shape.
