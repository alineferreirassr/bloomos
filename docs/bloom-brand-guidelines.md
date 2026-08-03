# Bloom Brand Guidelines — Checkpoint 19.3

Voice, badge-family, avatar, and logo rules for Amoré Bloom — the parts of the brand identity that are about *what the product says and shows*, as distinct from `docs/bloom-design-language.md` (tokens/spacing/color) and `docs/bloom-component-library.md` (components).

## Official logo

The single source of truth for the Amoré Bloom mark is `public/brand/amore-bloom-app-logo.png` — a circular mark (heart + camera-frame + sparkles motif) on a fully transparent background. There is no second logo file anywhere in the app; the prior gold-wordmark asset (`amore-bloom-logo.png`) was deleted this checkpoint (see "Official Brand Identity Update" in `docs/v2-checkpoint-19-3-brand-identity.md` for the full list of files touched).

Rules for any future placement of the mark:

- **Never recolor, redraw, or simplify it.** Every call site references the one file directly; nothing derives a "simplified" or monochrome variant.
- **Respect its transparency.** The mark has no background of its own by design — a container may add its *own* background (the sidebar's dark ground, a white favicon backing) but must never bake a background into the asset itself.
- **Circular contexts get a small inset, not a tight crop.** `WorkspaceAvatar` (the 30px sidebar/mobile-nav badge) insets the image by `p-[2.5px]` inside its circular frame — roughly an 80–83% fill ratio — so the mark doesn't touch the clip edge. This was tuned specifically because a full-bleed crop reads as cramped at that size.
- **Text fallback is a true last resort.** `WorkspaceAvatar` only falls back to "AB" initials on a real `<img>` `onError` (the file failing to load), never as a stylistic choice — the mark is always preferred when it's available.
- **Favicon gets a solid backing.** `src/app/icon.png` composites the transparent mark onto a solid warm-white ground (`#fdf2ef`-adjacent), because browsers render favicon transparency inconsistently across platforms — this is the one place a background is deliberately baked into a generated asset, and it's derived at build time from the same source mark, never a separately-drawn logo.

## Brand voice (Step 14)

Amoré Bloom's product copy speaks as a trusted planning partner, not a database. Three rules, each with a real before/after from this checkpoint:

1. **Describe what will appear, not what's missing.** An empty state is a moment of anticipation, not an error.
   - Before: *"No vendors"* → After: *"Your trusted partners will appear here"*
   - Before: *"New events you create will show up here"* → After: *"Every unforgettable celebration begins with a plan"*
   - Before: *"Items you add will show up here"* → After: *"Every beautiful detail starts with what's on hand"*
2. **Never invent urgency or drama the data doesn't support.** A `ModuleInsightCard` sentence states a real, computed fact plainly ("1 qualified lead hasn't been touched in over a week") — it never dramatizes ("Your leads are going cold!") or apologizes ("Sorry, we noticed...").
3. **A filtered "no results" state stays plainly functional, not romantic.** "No leads match these filters" + "Try adjusting or clearing your filters" is the right register for a search miss — the warmer story-driven copy above is reserved for the genuine first-run empty state. Conflating the two would make a routine filter miss feel falsely momentous.

## Badge family (Step 8)

Every status pill in the app is a `Badge` with one of six tones — no module invents its own badge styling:

| Tone | Real hue | Meaning |
|---|---|---|
| `neutral` | warm off-white / dark text | The default — most lifecycle/status labels (Draft, Planning, Booking, In 4d) |
| `accent` | brand rose | A highlighted/active state, deliberately reads as "this is the accent color," not semantic |
| `success` | `--color-success` (green) | Genuinely positive terminal states — Paid, Confirmed, Active |
| `warning` | `--color-warning` (amber) | Attention-needed, non-blocking |
| `danger` | `--color-danger` (red) | Blocking or negative — Overdue, Blocked, Cancelled-as-a-real-problem |
| `info` | accent-adjacent | Informational, non-actionable |

Checkpoint 19.3 fixed the one real inconsistency the Step 1 audit found: `Badge.tsx`'s `success`/`warning`/`danger` tone classes previously all rendered the *same* accent-rose tint regardless of which tone was requested — meaning a component could ask for `tone="danger"` and get the brand color, not red. They now consume the real `--color-success`/`--color-warning`/`--color-danger` tokens directly.

**"Cancelled" convention**: a majority of status-mapping files (7) already treated a cancelled event/service as `neutral` (a closed, non-urgent state — nothing left to act on), while two files (`statusTones.ts`'s `EVENT_SERVICE_STATUS_TONES`, `PurchaseStatusBadge.tsx`) used `danger`. This checkpoint aligned the two minority files to the majority `neutral` convention, since a completed-and-closed cancellation is not an ongoing problem to flag red — `danger` is reserved for a state that still needs attention (Overdue, Blocked), which a cancelled/closed record no longer is.

**Every badge belongs to one family** — a raw `<span className="rounded-[3px] border...">` badge reimplementation was found and replaced in `OperationalPipelineCard.tsx` (an "Overdue"/"In Nd" pair) with real `<Badge tone="danger">`/`<Badge tone="neutral">` components, so it now participates in the same six-tone system as every other status pill in the app rather than a one-off style.

## Avatars

See `BloomAvatar` in `docs/bloom-component-library.md` for the component itself. The brand rule: an avatar is initials-on-blush by default, a real photo only when the underlying record actually has one, and never a colored-per-person "identicon" hash — Amoré Bloom's visual identity stays in the blush/rose family regardless of whose name is shown.

## Photography

No photography ships in the product today (see `docs/bloom-design-language.md`'s Photography section for the rule that would govern it if introduced).

## Micro-branding (Step 15)

Tooltips, the command-menu popover, dropdown/action menus, dialogs, checkboxes, tabs, and toasts were audited for token consistency. All were already fully aligned with the Classical token set from Checkpoint 19.1's repoint (native `<input type="checkbox">` with `accent-accent`, serif-titled `Tabs`, token-driven `Select`/`Tooltip`/`ActionMenu`). The one real change was semantic, not visual: five of these components (`Card`, `ActionMenu`, `Toast`, `Tooltip`, `Drawer`) now reference the named `.bloom-elevation-*` classes instead of a raw shadow utility — see `docs/bloom-component-library.md` for the full list and the zero-visual-difference verification.
