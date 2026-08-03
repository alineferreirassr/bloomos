# BloomOS v2.0 — Checkpoint 19.3: Luxury Brand Identity System

**Status: APPROVED**

## Purpose and scope

Checkpoint 19.3 is explicitly *not* a feature checkpoint. Per the governing spec: "This checkpoint is NOT about adding new features. This checkpoint is NOT about redesigning layouts. Its purpose is to replace generic UI elements with a cohesive, exclusive and recognizable Amoré Bloom visual identity." Checkpoint 19.2 (Luxury Motion & Premium UX) was approved immediately prior to this one; this checkpoint builds on it without touching its animation system.

**Non-goals, honored throughout:** no redesign of the three approved Dashboards (Owner/Team/Client), no business-logic changes, no route changes, no API changes, no permission changes, no database schema changes, no AI Copilot, no Marketplace integrations.

## What shipped

### Step 1 — Bloom Design Language
Documented in `docs/bloom-design-language.md`: the full token system (color, type, spacing, radius, elevation), plus three new CSS surface treatments — `.bloom-glass`, `.bloom-gradient-surface`, `.bloom-gradient-accent` — and three named elevation aliases (`.bloom-elevation-card/popover/modal`) that map 1:1 onto the existing shadow scale.

### Step 2 — Bloom Component Library
Documented in `docs/bloom-component-library.md`. Rather than renaming ~100+ existing call sites of proven primitives (`KpiCard`, `Timeline`, `EmptyState`, etc.) for no visual gain, the existing primitives are catalogued under their real names as the de facto Bloom Component Library, and five genuinely new components were built where the Step-1 audit found a real gap:

- `BloomAvatar` — unifies two previously-inconsistent Classical avatar recipes; applied to 5 detail/account views.
- `BloomGlassPanel` — the `.bloom-glass` treatment as a component; applied to the Command Palette.
- `BloomSectionDivider` — a labeled or plain section break; applied to `AccountView`.
- `BloomWelcomeBanner` — a gradient "welcome" panel; applied to `AccountView`.
- Bloom Illustration System (`BloomIllustration`, 8 variants) — see Step 3.

### Step 3 — Luxury Illustration System
`BloomIllustration.tsx`: eight dependency-free inline-SVG variants reusing the official mark's own visual vocabulary (heart, camera-frame, sparkles). `EmptyState` gained an `illustration` prop that supersedes `icon` when both are present. Applied to the genuine first-run empty state on Leads, Events, Vendors, and Inventory, paired with warmer, story-driven copy (Step 10).

### Step 4 — Bloom Iconography
Audited; already consistent from prior checkpoints (line-style, `stroke`-based, `h-5 w-5`/`h-6 w-6`, soft `bg-accent-100` badge idiom). No changes needed — documented as the standing rule in `docs/bloom-design-language.md`.

### Steps 5, 6, 11 — Luxury Charts / Dashboard Widgets / Data Visualization
`KpiCard`'s inline sparkline gained a soft area fill beneath the polyline (matching `RevenueTrendChart`'s existing treatment). `ProgressBar`'s fill switched from a flat accent color to the new `.bloom-gradient-accent` two-stop gradient — one class change that cascades to `HealthGauge` and 10 other call sites with zero code change at each site. The three approved Dashboards' own `RevenueTrendChart` and Luxury widgets were left untouched (Luxury namespace, out of scope).

### Step 7 — Luxury Cards
Audited; `Card` already draws from the token system. Elevation-alias adoption (below) is the one real change.

### Step 8 — Luxury Badges
`Badge.tsx`'s `success`/`warning`/`danger` tones previously all rendered the same accent-rose tint — fixed to consume the real `--color-success`/`--color-warning`/`--color-danger` tokens. The minority "cancelled → danger" convention in 2 files was aligned to the majority "cancelled → neutral" convention (7 files). A raw badge reimplementation in `OperationalPipelineCard.tsx` was replaced with real `Badge` components. Full rationale in `docs/bloom-brand-guidelines.md`.

### Step 9 — Luxury Avatars
See `BloomAvatar` under Step 2.

### Step 10 — Luxury Empty States
Story-driven copy applied alongside the new illustrations (Leads, Events, Vendors, Inventory) — e.g. "Your trusted partners will appear here" instead of "No vendors." Filtered/no-results empty states deliberately keep plainer, functional copy — see the voice rule in `docs/bloom-brand-guidelines.md`.

### Step 12 — Luxury Color Refinement
The Badge tone fix (Step 8) was the one real color-accuracy issue found. The rest of the palette was already correctly repointed in Checkpoint 19.1.

### Step 13 — Luxury Photography Rules
Documented in `docs/bloom-design-language.md` and `docs/bloom-brand-guidelines.md`. No photography currently ships in the product; the rule is written for if/when it's introduced.

### Step 14 — Bloom Brand Voice
Documented in `docs/bloom-brand-guidelines.md` with worked before/after examples from this checkpoint's own copy changes.

### Step 15 — Micro Branding
Audited tooltips, the command palette, dropdown/action menus, checkboxes, and tabs — all already token-consistent from the 19.1 repoint. Real change: `Card`, `ActionMenu`, `Toast`, `Tooltip`, and `Drawer` now reference the named `.bloom-elevation-*` classes instead of a raw shadow utility (a verified zero-visual-difference rename — see `docs/bloom-component-library.md`).

### Steps 16–18 — Design Audit, Accessibility, Performance
The Step-1 research pass (badge tones, avatar patterns, hardcoded styles) *was* the design audit; its findings are what drove Steps 8, 9, and 15 above. Accessibility: `BloomAvatar`'s single-outer-`aria-label` pattern avoids duplicate accessible names (see Errors below); every new component (`BloomIllustration`, `BloomGlassPanel`, etc.) uses semantic roles/`aria-hidden` correctly. Performance: no new dependency was added; every new visual (glass, gradient, illustration) is a plain CSS class or inline SVG, reusing components already in the bundle.

## Official Brand Identity Update

A mid-checkpoint addendum from the user (three consecutive messages, two with a newly-attached official Amoré Bloom logo) superseded the working logo from Checkpoint 19.1 with the definitive, final artwork and corrected a lingering transparency/fallback issue in the sidebar's workspace avatar. This section documents exactly what changed, per the user's explicit request.

**Files replaced:**
- `public/brand/amore-bloom-app-logo.png` — file **content** replaced with the new official mark: a fully-transparent 1238×1238 PNG, color-keyed from the user's supplied white-background source (`29 de jul. de 2026, 00_32_11.png`) via a soft alpha falloff against the sampled background color, verified pixel-by-pixel (corner fully transparent, center fully opaque art). The filename was unchanged, so all 8 existing code references (below) required no code edits.
- `src/app/icon.png` — regenerated: the new transparent mark composited onto a solid warm-white backing (browsers render favicon transparency inconsistently), resized to 256×256.

**Files deleted:**
- `public/brand/amore-bloom-logo.png` — the prior gold-wordmark asset, orphaned since Checkpoint 19.1 with zero code references at time of deletion (confirmed via a full-repo grep before removal). "The old logo should no longer exist anywhere in the system" — confirmed: this was the only remaining non-canonical logo file, and it is now gone.

**Code changed:**
- `src/components/layout/WorkspaceAvatar.tsx` — the sidebar/mobile-nav 30px circular identity badge. Two fixes: (1) removed the unconditional `bg-accent/10` tint from behind the real logo image — it now only appears behind the text-fallback state, so the transparent artwork shows directly against the sidebar's own background rather than inside a tinted box; (2) added a small inset (`p-[2.5px]`) so the mark fills roughly 80–83% of the circular frame rather than touching the clip edge, per the user's 75–85% fill request. Fallback to "AB" initials remains wired to the real `<img onError>` event only — never a stylistic default while the logo file is present.

**Files already correct, no change needed** (all 8 real code references to the logo already pointed at the (unchanged) filename `amore-bloom-app-logo.png`, so replacing the file's *content* alone propagated the new artwork everywhere without further edits): `src/components/layout/Sidebar.tsx`, `src/components/layout/MobileNav.tsx`, `src/app/(auth)/layout.tsx`, `src/components/layout/AccessBlockedPage.tsx`, `src/components/layout/ClientPortalShell.tsx`, `src/modules/settings/sections/brandingSection.ts` (its `defaultValue`), `src/components/layout/WorkspaceAvatar.tsx` and its test file.

**On the repeated "still seeing a white/beige box" report — root cause found and fixed:** after the first fix, the user reported three times (twice in follow-up messages) still seeing a white/beige background around the logo. Raw file inspection (PIL), a plain `fetch()` of the image URL, and a full `getComputedStyle()` ancestor walk had all confirmed the *served bytes* and *DOM* were correct — but this repeatedly missed one thing: those checks never inspected what the browser's real `<img>` tag actually decoded and painted. The real repro step was drawing the **live, on-page `<img>` element itself** into a canvas (`ctx.drawImage(liveImgElement, 0, 0)`) and reading its pixels — this uses the exact bitmap Chrome paints with, as opposed to a separate `fetch()` which can silently hit a different cache bucket or content-negotiated variant.

That test exposed the real bug: a plain `fetch()` (generic `Accept` header) was being served the correct, fully-transparent PNG, while the real `<img>` tag — which sends an image-specific `Accept: image/avif,image/webp,...` header — was served a **stale, pre-fix WebP-encoded variant** (670×670, opaque near-white corner `[253,253,253,255]`) via Next.js's built-in image-optimization content negotiation (`Vary: Accept`), left over from an earlier crop generated before the final transparent logo was in place. `x-nextjs-cache: HIT` confirmed it was a cached response, not freshly derived from the current source file. Deleting the `.next` build directory entirely and restarting the dev server forced every optimized image variant (PNG/WebP/AVIF, every requested width) to regenerate from the current, correct source file — re-verified afterward by drawing the live `<img>` into a canvas again: corner alpha now reads `0` (fully transparent) on every page checked (Owner Dashboard sidebar, Classical Sidebar, mobile drawer, sign-in page), confirmed visually via screenshots showing the mark blending directly into the pink sidebar background with no white/beige square anywhere.

A secondary, related bug was also found and fixed while investigating: `LuxurySidebar.tsx` and `LuxuryClientSidebar.tsx` both hardcoded `width={640} height={426}` on the logo `<Image>` — a non-square aspect ratio left over from the old rectangular wordmark logo. The new mark is square (1238×1238); the mismatched props didn't cause the white-box bug (the browser recomputes layout from the real decoded image once loaded), but they were real stale leftovers, corrected to `width={640} height={640}`.

**Production is unaffected by the stale-cache mechanism itself** — this class of bug is specific to `next dev`'s image-optimization cache surviving a source-file replacement; a real production deploy builds fresh and would not carry this staleness forward. It is called out here because it was the actual, confirmed cause of what the user saw in this session's live preview, not a residual risk in the shipped app.

**Next.js Dev Tools indicator vs. the real Workspace Avatar — a visual coincidence, not a bug:** the black circular badge with a single letter that appears fixed to the bottom-left of every screenshot in this session is the `<nextjs-portal>` custom element — verified via DOM inspection to have zero size in the page's own light DOM and to render its actual indicator content inside an encapsulated shadow root, entirely outside BloomOS's React tree. This is Next.js's own development-mode Dev Tools indicator; it is injected by the `next dev` runtime itself, cannot be restyled, repositioned, or removed by editing application code, and does not exist in a production build. It happens to sit at almost the same screen position as the Classical `WorkspaceAvatar` (also bottom-left of its own sidebar), which is why the two were easy to conflate — but they are two unrelated elements from two different render trees. The real `WorkspaceAvatar` element, confirmed separately via `getBoundingClientRect()` and `querySelector`, correctly renders the official logo image (`hasImg: true`, `imgSrc` pointing at `amore-bloom-app-logo.png`, empty fallback text) with no initials shown, confirming it is not the source of the "N" the user was seeing.

**On "every initials placeholder should become the logo":** most single-letter avatars found in this codebase (`BloomAvatar` on Client/Vendor/Team detail pages, message-sender avatars in "Recent Messages"/"Team Activity", the Luxury `ProfileMenu`'s own avatar showing the signed-in user's initial) represent a specific **person**, not the workspace — showing the company logo in place of a person's identity there would make it impossible to tell who sent a message or which client a record belongs to, and would be a regression, not a fix, matching the same convention every mainstream SaaS product uses (a profile avatar shows the person, not the company). Only one component in this codebase represents *workspace/company* identity rather than a person's: `WorkspaceAvatar.tsx` (Classical Sidebar/MobileNav footer badge) — and it already correctly shows the official logo image, falling back to "AB" initials only on a genuine image-load failure, confirmed above.

## Errors found and fixed

- **`Badge.tsx` tone-color bug** (Step 8) — `success`/`warning`/`danger` all silently shared the accent-rose color; fixed to use real distinct hues. See Step 8 above.
- **"Cancelled" tone inconsistency** — 2 of 9 status-mapping files diverged from the majority convention; aligned to the majority (lower blast radius than the reverse).
- **`BloomAvatar` duplicate accessible-name bug** — an early draft put the avatar's name on both a `sr-only` inner span and relied on a nearby visible heading rendering the same text, producing two DOM nodes with identical text and breaking `getByText()` in 3 tests across `AccountView.test.tsx` and `ClientPortalAccountView.test.tsx`. Fixed by moving to a single outer `role="img" aria-label={name}`.
- **`HealthGauge.test.tsx` class-name coupling** — asserted on `.bg-accent`, which broke when `ProgressBar`'s fill switched to `.bloom-gradient-accent`. Updated the assertion to match the new (equally deliberate, "never percent-tiered") implementation — a test-implementation-detail fix, not a behavior change.
- **`CommandPalette.tsx` JSX tag mismatch** — caught proactively (via Read, before typecheck) after introducing `BloomGlassPanel`: the closing tag still read `</div>` after the opening tag was changed. Fixed before it ever reached `tsc`.

## Quality gates

- **TypeScript** (`tsc --noEmit`): 0 errors.
- **ESLint** (`eslint .`): 0 errors, 16 pre-existing warnings (unused-var placeholders and React Hook Form's `watch()` compiler-skip notices — same baseline as every prior checkpoint, none introduced by this one).
- **Tests** (`vitest run`): **5,261 / 5,261 passing** across 523 files (one pre-existing test updated for the `ProgressBar` gradient rename, one for `HealthGauge`'s new fill class — both confirmed as implementation-detail updates, not behavior regressions).
- **Build** (`next build`): succeeds cleanly, full route manifest generated with no new warnings.

## Browser verification

Verified against the mock data provider (`NEXT_PUBLIC_DATA_MODE` temporarily flipped to `mock`, then reverted — confirmed zero net diff via `git diff --stat -- .env.local`) across Leads, Events, Vendors, Inventory, Operational Pipeline, Team, and Account pages.

✓ **Desktop verified** (1440×900) — badge real-hue tones confirmed via computed-style inspection (`Blocked`/`Overdue` render `text-danger`/`bg-danger/10`; `In 4d`/`Normal` render `neutral`), KPI sparkline area fill, gradient `ProgressBar` fill, `BloomGlassPanel` command palette, filtered-empty-state icon fallback (search with no matches correctly shows the plain icon, not the illustration), zero console errors across every page visited.

✓ **Mobile verified** (375×812) — sidebar drawer opens/closes correctly with the new logo and workspace avatar, Leads page KPI grid/filters/insight card all stack correctly with no overflow, Account page's `BloomWelcomeBanner` + `BloomAvatar` + `BloomSectionDivider` all render correctly, zero console errors.

Chrome/Safari/Firefox/Edge cross-browser matrix was not separately re-run this checkpoint (no browser-specific CSS features were introduced beyond `backdrop-filter`, which is broadly supported and already used elsewhere in the app); the in-app browser verification above covers the rendering engine actually available in this environment.

## Known Limitations

- **Illustration coverage is representative, not exhaustive.** The Bloom Illustration System's 8 variants were applied to Leads, Events, Vendors, and Inventory — the four modules this whole session has consistently used for breadth rollouts — not to every list view in the app (Clients, Contracts, Documents, Purchases, Payments, Invoices still use the Checkpoint 19.2 icon-badge empty state). Extending coverage is straightforward (the `illustration` prop already exists) but was left for a future pass to keep this checkpoint's diff proportionate to "polish," not "redo every empty state."
- **`BloomSectionDivider` has one real application** (`AccountView`), not several. It was built to fill a genuine component-library gap but wasn't force-applied elsewhere without a real section break to justify it.
- **Modal's shadow tier was deliberately left as-is.** `Modal.tsx` uses `shadow-md` where a modal-tier surface would semantically call for `.bloom-elevation-modal` (shadow-lg) — noted honestly rather than silently bumped, since that would be a real visual change bundled into what should be a pure rename pass.
- **Cross-browser matrix not independently re-verified** this checkpoint (see Browser verification above) — no new browser-specific risk was introduced, but a dedicated Safari/Firefox/Edge pass was not repeated from Checkpoint 19.1's original matrix.
- **`next dev`'s image-optimization cache can go stale across a source-file replacement.** This checkpoint's investigation found and fixed one live instance of it (see "Official Brand Identity Update" above), but the general behavior — a locally running dev server not always detecting a `public/` asset change for already-cached optimized variants — is a `next dev` characteristic, not something this codebase controls. If a future asset swap ever looks stale in a local dev preview, deleting `.next` and restarting resolves it; production builds are unaffected.

## Recommendation

**APPROVED.** All quality gates pass, the three approved Dashboards remain untouched, no business logic/routes/APIs/permissions/schema changed, and the checkpoint's own stated purpose — replacing generic UI with a documented, cohesive Amoré Bloom identity — was met through real token fixes (Badge hues), a small set of genuinely new components filling real gaps (BloomAvatar/GlassPanel/SectionDivider/WelcomeBanner/Illustration), and three comprehensive reference documents. The official logo replacement is complete: the root cause of the reported white/beige box (a stale `next dev` image-optimization cache, not a code defect) was found and fixed, and verified visually via live-rendered screenshots and live-DOM pixel sampling — not asset bytes alone — on the Owner Dashboard, Classical Sidebar, mobile drawer, and sign-in page, all now blending cleanly with no white/beige square.
