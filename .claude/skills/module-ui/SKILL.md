---
name: module-ui
description: Build a BloomOS module's UI once its data-layer foundation already exists — list/detail/forms, responsive desktop+mobile, loading/error/empty states, live browser smoke test. Use when the user says "use module-ui for X", asks to build a module's screens/pages/views, or wants the frontend for a module whose repository/types already exist. Applies project-rules first.
---

# Module UI

Builds the UI half of a BloomOly module, assuming `module-foundation` (or equivalent) already shipped the data layer. This is the same procedure every BloomOS module's UI has followed — list view, detail view, forms, actions — packaged so a request only needs to name the module.

Apply `project-rules` first.

## Procedure

- **Preserve the approved BloomOS design system.** Don't redesign global layout, spacing scale, or component library choices to fit one module's screen — reuse `components/ui/*` as-is.
- **Reuse shared components** (`Button`, `Card`, `Modal`, `Badge`, `Input`, `Select`, `ActionMenu`, `EmptyState`/`ErrorState`/`Skeleton`) rather than rebuilding equivalents inline.
- **Do not change data architecture unless a real blocker exists.** If the UI seems to need a repository change, that's a signal to stop and say so, not to quietly widen a shared interface.
- **Responsive by construction, not as a follow-up.** Desktop and mobile both matter for every screen — check both before calling anything done, per the project's permanent QA policy.
- **Real loading/error/empty states.** Not a bare spinner and not a silent blank screen — match the pattern already used by sibling modules' list views (`LoadState` union, `Skeleton`/`ErrorState`/`EmptyState`).
- **Browser smoke test before reporting done.** Start the dev server, exercise the golden path and at least one edge case, and report only what was actually observed — see `live-smoke-test` for the reusable checklist, and the permanent QA policy's exact reporting format (desktop/mobile/Chrome verified explicitly, Safari reported as not verified since automation for it isn't available).
- **Fix only reproducible application bugs** found along the way — don't refactor unrelated code because it was nearby.
- **Run `verification`** (lint → typecheck → test → build) before considering the phase done.
- **One scoped commit** for the phase, unless the user has approved splitting it.

Don't restate this procedure in a user-facing update — report decisions and results, not the checklist itself.
