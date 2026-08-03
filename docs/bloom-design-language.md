# Bloom Design Language — Checkpoint 19.3, Step 1

The written rulebook behind Amoré Bloom's visual identity: the values every screen already draws from, named and explained in one place so future changes have a single source of truth instead of re-deriving conventions from scattered components.

This is a documentation-and-refinement pass, not a redesign. Every token below already existed (from Checkpoint 19's Luxury palette and Checkpoint 19.1's Classical repoint) except the glass/gradient/elevation additions called out explicitly in Step 3.

## Two token namespaces, one palette

BloomOS has run two parallel design-token namespaces since Checkpoint 19.1:

- **`--luxury-*`** — consumed only by the three approved Dashboards (Owner/Team/Client) and their shared components in `src/modules/dashboard/luxury/`. Frozen since Checkpoint 19's own approval; this checkpoint does not touch it.
- **`--color-*` / `--radius-*` / `--shadow-*`** ("Classical") — consumed by every other page in the app (~100 pages, ~27 shared `src/components/ui/` primitives). Checkpoint 19.1 repointed these values to match the Luxury palette exactly, so the two namespaces now hold identical numbers under different names — a deliberate seam kept so the two surfaces can diverge again later without a flag day.

Both namespaces are declared once in `src/app/globals.css` and never duplicated inline — every component reaches for the token, never a literal hex value.

## Color

| Token | Value | Use |
|---|---|---|
| `--color-background` / `--color-sidebar` | `#fdf2ef` | Page and sidebar ground |
| `--color-surface` | `#ffffff` | Cards, panels, inputs |
| `--color-surface-tint` | `#fdf6f4` | Empty-state wells, subtle recessed panels |
| `--color-border` | `#7a4d43` at 14% | Hairlines |
| `--color-text` | `#2a1f1c` | Body text |
| `--color-text-muted` | `#2a1f1c` at 55% | Secondary text |
| `--color-accent` / `--color-accent-2` | `#d8695a` / `#e8a189` | The one brand rose, and its lighter companion for gradients |
| `--color-accent-100` / `--color-accent-800` | `#f6dcd6` / `#5c2c20` | Soft accent fills / accent-on-light text |
| `--color-success` | `#5f8d6b` | Genuinely positive states only |
| `--color-warning` | `#c98a3e` | Attention-needed states |
| `--color-danger` | `#c24f42` | Blocking/negative states |

Semantic color (success/warning/danger) is deliberately a *different* hue family from the brand accent — a status pill should never be confused with a branded action. Checkpoint 19.3 fixed the one place this rule was violated: `Badge.tsx`'s `success`/`warning`/`danger` tones previously all rendered as the same accent-rose tint, so a "Blocked" badge and a "New Lead" button were, chromatically, the same color. They now consume `--color-success`/`--color-warning`/`--color-danger` directly. See `docs/bloom-brand-guidelines.md` for the full badge-family rule.

## Typography

- **Display/heading face**: Cormorant Garamond (`--font-heading-family`) — every `<h1>`/`<h2>`/card title/PageHeader title.
- **Body face**: Lora (`--font-body-family`) — everything else.
- No third face was introduced. A "utility" monospace-style face for tabular data was considered and rejected — `tabular-nums` on the existing body face already aligns digit columns without the visual disruption of a typeface switch mid-page.

## Spacing, radius, elevation

- **Radius scale**: `--radius-sm-px: 8px`, `--radius-md-px: 14px`, `--radius-lg-px: 20px` — three steps, applied via Tailwind's `rounded-md`/`rounded-lg` utilities already mapped to these values. No component invents its own radius.
- **Shadow scale**: `--shadow-sm-val`, `--shadow-md-val`, `--shadow-lg-val` — soft, warm-tinted shadows (`color-mix` against `#7a4d43`, never pure black) at three intensities.
- **Elevation aliases** (new this checkpoint): `.bloom-elevation-card` (= shadow-sm), `.bloom-elevation-popover` (= shadow-md), `.bloom-elevation-modal` (= shadow-lg). These are *semantic renames*, not new values — every call site that adopted one already used the exact matching shadow before (see `docs/bloom-component-library.md` for the full list). The point is a component now says what tier of surface it is (a resting card vs. a floating popover vs. a modal) rather than which raw shadow number happened to look right, so a future adjustment to "how much a popover should float" changes one CSS rule instead of a grep-and-replace across a dozen files.

## Glass and gradient surfaces (new)

Two additive treatments, both built as plain CSS classes in `globals.css` — no new dependency:

```css
.bloom-glass {
  background: color-mix(in srgb, var(--color-surface) 72%, transparent);
  backdrop-filter: blur(16px) saturate(140%);
  border: 1px solid color-mix(in srgb, var(--color-surface) 40%, var(--color-border));
}
.bloom-gradient-surface {
  background: linear-gradient(165deg, var(--color-surface) 0%, var(--color-surface-tint) 100%);
}
.bloom-gradient-accent {
  background: linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-2) 100%);
}
```

- **`.bloom-glass`** — a translucent, blurred surface for content that floats *over* other content: the Command Palette overlay is the one real application this checkpoint made. Reserve it for transient overlays, not persistent page furniture — a glass sidebar or glass table would hurt legibility for no benefit.
- **`.bloom-gradient-surface`** — a barely-there diagonal warm gradient for a "welcome" or hero-style panel that should read as slightly more special than a flat card, without becoming a loud banner. Used by `BloomWelcomeBanner`.
- **`.bloom-gradient-accent`** — the two-stop rose gradient for a filled progress/accent bar (`ProgressBar`) instead of a flat accent fill. A small, tasteful upgrade over a solid color for anything communicating "how much" rather than "which category."

## Icon usage

Icons are line-style, `stroke`-based (never filled/solid glyphs), consistently sized at `h-5 w-5`/`h-6 w-6` inside a soft `bg-accent-100` circular or rounded-square badge — this pairing (icon + soft badge) is the one recurring "icon chip" idiom used across KpiCard, EmptyState, and ModuleInsightCard. A bare icon with no badge reads as a smaller, secondary affordance (table-row action icons, nav icons).

## Illustration

See the **Bloom Illustration System** section of `docs/bloom-component-library.md` for the full component reference. The governing rule: illustrations reuse the *same visual vocabulary as the official mark itself* (a heart, a camera-frame, sparkles) rather than a generic clip-art set, rendered as thin rose line art over a soft blush circle — legible at empty-state scale (96×96), never busier than a handful of shapes. This is a deliberately small system (8 variants), not an attempt to hand-illustrate bespoke art for every empty state in the app; see the Known Limitations section of `docs/v2-checkpoint-19-3-brand-identity.md` for what's out of scope.

## Photography

No photography currently ships in the product (avatars use initials or a user-provided `photoUrl`, nothing else renders a photograph). The rule for *if* photography is ever introduced: soft, natural light, warm color grading consistent with the blush/rose palette above, never a stock-photo corporate look — and any photographic surface must still sit inside the existing card/radius/shadow system rather than bleeding edge-to-edge, to avoid breaking the app's otherwise consistent "everything lives in a soft card" rhythm.

## Animation

Unchanged from Checkpoint 19.2's Luxury Motion System (`docs/luxury-motion-system.md`): 180–350ms durations, a standard easing curve, and full compliance with `prefers-reduced-motion` site-wide. This checkpoint added no new keyframes — the glass/gradient surfaces above are static treatments.

## Empty states

Governing rule (Steps 3 and 10): an empty state is a moment to reassure, not an error. Copy should describe what *will* appear, in the product's own voice, not what's currently missing — "Your trusted partners will appear here" rather than "No vendors." See `docs/bloom-brand-guidelines.md` for the full voice rule and worked examples across every module this checkpoint touched.

## Cards, buttons, charts, widgets, dashboards

None of these got new *rules* this checkpoint — they already draw from the tokens above via `Card`, `Button`, `KpiCard`, `ProgressBar`, and the three Luxury Dashboards. What changed is real-hue badge tones (above), a gradient sparkline/progress fill (`docs/bloom-component-library.md`), and the elevation aliases. The three approved Dashboards remain visually untouched — see the Non-Goals section of `docs/v2-checkpoint-19-3-brand-identity.md`.
