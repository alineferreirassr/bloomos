# Bloom Component Library — Checkpoint 19.3, Step 2

The spec asks for a named catalog of proprietary components (Bloom KPI Card, Bloom Timeline, Bloom Status Badge, and so on). This checkpoint took a pragmatic reading of that request: **renaming ~100+ existing, battle-tested call sites of `KpiCard`, `Timeline`, `EmptyState`, etc. to a `Bloom`-prefixed name would be pure churn** — it changes zero pixels, carries real regression risk (every rename is a chance to fumble an import), and violates this checkpoint's own "do not redesign, do not break existing functionality" mandate for no visual gain.

Instead: the already-shipping primitives **are** the Bloom Component Library — documented here under their real names — and five genuinely new components were built to fill the actual gaps the Step 1 audit found (no shared avatar, no glass surface, no section divider, no dedicated welcome banner, no illustration system).

## New components this checkpoint

### `BloomAvatar` — `src/components/ui/BloomAvatar.tsx`

The first shared avatar in the Classical namespace. Before this checkpoint, three non-interoperable inline recipes existed: a 1-letter serif treatment in Account views, a 2-letter non-serif treatment in Client/Vendor/Inventory detail views, and the Luxury Dashboards' own blush-toned family (left untouched — see Non-Goals).

```tsx
<BloomAvatar name="Sofia Marchetti" size="md" />
<BloomAvatar name={vendor.company_name} photoUrl={vendor.logo_url} size="lg" />
```

- `name: string` — required; used both for initials (first letter of up to two space-separated words) and as the single accessible name.
- `photoUrl?: string | null` — when present, renders the photo via `next/image`; the initials fall back otherwise.
- `size?: "sm" | "md" | "lg"` — `h-8`/`h-12`/`h-16`.
- Accessibility: the accessible name lives on **one** outer `role="img" aria-label={name}` span; the inner image/initials are decorative (`alt=""` / `aria-hidden`). An earlier draft put the name on an inner `sr-only` span *and* relied on a nearby visible heading rendering the same text — that duplicated the accessible text in the DOM and broke three `getByText()` test assertions across `AccountView.test.tsx` and `ClientPortalAccountView.test.tsx`. Fixed by moving to the single-outer-label pattern above.

Applied to: `AccountView`, `ClientPortalAccountView`, `ClientDetailView`, `VendorDetailView`, `InventoryItemDetailView` — the five places a person/entity identity needed a visual anchor. Deliberately Classical-token only; the three approved Luxury Dashboards keep their own existing blush-toned avatar treatment from Checkpoint 19, completely untouched.

### `BloomGlassPanel` — `src/components/ui/BloomGlassPanel.tsx`

A thin wrapper applying `.bloom-glass` (see `docs/bloom-design-language.md`) plus `rounded-lg`, forwarding a ref and all standard `div` props.

```tsx
<BloomGlassPanel className="p-4">…</BloomGlassPanel>
```

Applied to: the Command Palette's dialog surface (`CommandPalette.tsx`) — the one place in the app where content genuinely floats over other content in a way a translucent, blurred surface suits. Not applied broadly; see the glass-surface usage rule in `docs/bloom-design-language.md`.

### `BloomSectionDivider` — `src/components/ui/BloomSectionDivider.tsx`

```tsx
<BloomSectionDivider />                      {/* a plain hairline */}
<BloomSectionDivider label="Danger zone" />   {/* a labeled break with an aria "separator" role */}
```

Applied to `AccountView` between the profile-detail list and the sign-out/password actions — two logically distinct groups that previously had only an implicit spacing gap between them.

### `BloomWelcomeBanner` — `src/components/ui/BloomWelcomeBanner.tsx`

```tsx
<BloomWelcomeBanner
  title="Welcome back, Amoré"
  subtitle="Your profile and Workspace membership."
/>
```

A `.bloom-gradient-surface` panel with a serif title, optional subtitle, and optional `actions` slot, entering via `animate-fade-down`. Applied to `AccountView` in place of a plain `<h2>` header — the one non-Dashboard page in this checkpoint's scope with a genuine "welcome" framing (a personal account page, not a data list).

### Bloom Illustration System — `src/components/ui/BloomIllustration.tsx`

```tsx
<BloomIllustration variant="leads" />
```

Eight variants (`leads`, `events`, `inventory`, `documents`, `vendors`, `payments`, `messages`, `generic`), each a small, dependency-free inline SVG: a shared blush-circle backdrop and sparkle accents (matching the visual vocabulary of the official mark), with a per-variant line-art motif built from a handful of shapes — a heart for Leads, a calendar card for Events, a stacked-box for Inventory, and so on. This mirrors the exact precedent `RevenueTrendChart` set in Checkpoint 19: no charting or illustration library exists in this codebase, and introducing one for a handful of empty-state graphics would be out of proportion.

`EmptyState` (`src/components/ui/EmptyState.tsx`) gained a new optional `illustration?: BloomIllustrationVariant` prop, which supersedes the existing `icon` prop when both are supplied:

```tsx
<EmptyState
  illustration={hasActiveFilters ? undefined : "leads"}
  icon={hasActiveFilters ? LeadsIcon : undefined}
  title={hasActiveFilters ? "No leads match these filters" : "No leads yet"}
  description={hasActiveFilters ? "Try adjusting or clearing your filters." : "Your next unforgettable event starts here — create your first Lead."}
/>
```

The pattern used everywhere this checkpoint touched: the richer illustration + warm, story-driven copy for the genuine "nothing here yet" state; the plain icon badge (Checkpoint 19.2's treatment) for a filtered "no results" state, which doesn't call for the same emotional weight. Applied to Leads, Events, Vendors, Inventory — the four representative modules this whole session has consistently used for breadth rollouts. See Known Limitations in `docs/v2-checkpoint-19-3-brand-identity.md` for the modules not yet covered.

## Existing primitives, now documented as the Bloom Component Library

| Primitive | File | Real name in code | "Bloom" role |
|---|---|---|---|
| KPI metric card | `src/components/ui/KpiCard.tsx` | `KpiCard` | Bloom KPI Card |
| Activity timeline | `src/modules/timeline/components/Timeline.tsx` | `Timeline` | Bloom Timeline |
| Data-derived observation card | `src/components/ui/ModuleInsightCard.tsx` | `ModuleInsightCard` | Bloom Insight Card |
| Status pill | `src/components/ui/Badge.tsx` | `Badge` | Bloom Status Badge |
| Empty state | `src/components/ui/EmptyState.tsx` | `EmptyState` | Bloom Empty State |
| Section header | `src/components/ui/PageHeader.tsx` | `PageHeader` | Bloom Hero Section |
| Progress indicator | `src/components/ui/ProgressBar.tsx` | `ProgressBar` | Bloom Metric Widget |
| Owner/Team/Client dashboard KPI | `src/modules/dashboard/luxury/components/` | `LuxuryMetricCard` and friends | Bloom Statistic Card (Luxury namespace, untouched) |

Event/Proposal/Client/Finance/Inventory "cards" named in the spec are not a separate component family — each module's list/detail view already composes `Card` + `Badge` + module-specific fields directly (e.g. `OperationalPipelineCard`, `ChartOfAccountsTable`'s row cards). Introducing a wrapper component per module purely to rename the composition would add an abstraction layer with no behavioral difference — three or four similar `Card` compositions is a better outcome here than a premature shared component whose props end up as a grab-bag of every module's fields.

## Sparkline and progress-fill polish (Steps 5/6/11)

Two small, additive visual upgrades, both zero-risk because they change fill *style* only, never layout or values:

- **`KpiCard`'s inline sparkline** (`Sparkline` sub-component) gained a soft area fill beneath the line (`opacity="0.12"`, same accent color) — matching the visual weight of the Owner Dashboard's own `RevenueTrendChart` treatment, previously a bare polyline.
- **`ProgressBar`'s fill** switched from a flat `bg-accent` to `.bloom-gradient-accent` — a two-stop rose gradient. This one CSS class change cascades to every consumer (`HealthGauge` and 10 other call sites across the Services module) with no code change required at any call site.

## Elevation-alias adoption (micro-branding, Step 15)

`Card`, `ActionMenu`, `Toast`, `Tooltip`, and `Drawer` were switched from a raw `shadow-sm`/`shadow-md`/`shadow-[var(--shadow-lg-val)]` utility to the matching named `.bloom-elevation-card`/`.bloom-elevation-popover`/`.bloom-elevation-modal` class — a pure rename, verified to produce the exact same computed shadow value in every case before applying it, so there is zero visual difference. `Modal.tsx` was deliberately left alone: it currently uses `shadow-md` where a modal-tier surface would semantically call for `.bloom-elevation-modal` (shadow-lg), but changing that would be a real visual change (a heavier shadow), not a rename — out of scope for a polish-only pass. Noted here rather than silently "fixed," since bumping shadow weight on every Modal in the app deserves its own deliberate decision, not a side effect of a token-naming pass.
