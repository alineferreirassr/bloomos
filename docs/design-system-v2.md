# Design System v2 — Foundation

This document is additive to [`docs/design-system.md`](./design-system.md), which remains the authoritative source for every visual token (color, typography, radius, shadow) — nothing about BloomOS's approved visual language changes in v2. This file exists for what v1 never needed written down: standards for how a *component* is built, not how it *looks*.

## Why this file exists now

v1 built 13 checkpoints of UI without ever writing these conventions down — every engineer (human or AI) inferred them from reading existing components. That worked at v1's pace and team size; v2's stated goal of "developer productivity" means these conventions need to be legible without reading five existing files first.

## Component standards

- **Loading / error / empty, always three states, never two.** Every list or detail view that fetches data renders exactly three explicit states — a skeleton/spinner loading state, an `ErrorState` component on failure, and a written empty-state message when the fetch succeeds with nothing to show. A view that silently renders nothing on empty, or that lets a fetch error bubble to an unhandled exception, is incomplete, not "handled by the framework."
- **Overlay behavior comes from `useDialogBehavior`, never reimplemented.** Any modal-style overlay (`Modal`, `Drawer`, `CommandPalette`, and any future one) composes this one hook for focus-trap/Escape/focus-restore/scroll-lock — copying its logic into a new component instead of importing it is the exact drift this hook was extracted to prevent (see its own doc comment).
- **A registry, not a switch statement, for anything pluggable.** Search (`core/search/registry.ts`), Commands (`core/commandPalette/registry.ts`), Timeline activity types, and Calendar event sources (`core/calendar/registry.ts`) all share one shape: a `Map` keyed by a stable id, `register*`/`get*`/`is*Registered` functions, and a `reset*` test helper. A new pluggable concern should reach for this shape before inventing a new one.
- **A provider interface plus a null/mock default, never a direct vendor call.** AI (`core/ai`), Search (`core/search/service.ts`), Notifications (`core/notifications/registry.ts`), and now Observability (`core/observability`) all follow: define the interface, ship a safe default that satisfies it without doing anything real, let a real implementation register itself later. No module should import a third-party SDK directly at a call site.
- **Props stay data-only; behavior is a callback.** A component never reaches into global session/router state itself if a prop can carry it in — see `CommandPalette`'s optional `workspaceId` prop for the pattern: fully functional with the prop omitted, richer with it supplied, no hard dependency on any particular provider tree.

## Layout patterns

- **List pages**: Filters → Summary → Table/Cards (view-toggle) → pagination, in that vertical order, matching every existing list view (Leads, Clients, Events, Contracts, Services, Purchases, Inventory).
- **Detail pages**: a header (title, status badge, primary actions) → a two-column responsive grid of section Cards below `lg`, single column above it → a Notes/Timeline/Documents section trio at the bottom, in that order, on every entity detail page that has them.
- **Overlays own their own state.** A singleton overlay like `CommandPalette` manages its own open/closed state internally and is mounted once near the app root — a parent should never need to lift and pass down `open`/`setOpen` for something that's conceptually global.

## Responsive conventions

- Two Tailwind breakpoints matter in practice: below `md` (768px) is "mobile," `lg` (1024px) and above is "desktop" — the space between is a transitional tablet zone that should never look broken, but is not independently designed for.
- Fixed pixel dimensions are reserved for genuinely fixed-size elements (icons, avatars, badges) — anything that should fill or wrap its container uses a relative unit (`%`, `flex`, `grid`) plus `max-w-*`, never a bare `width: Npx` on a content container.
- JS code that needs a breakpoint's numeric value (a `matchMedia` check, not a className) reads it from `src/styles/designTokens.ts`'s `BREAKPOINTS_PX` — never a second hardcoded `768`/`1024` literal elsewhere.

## Documentation

- Every new shared primitive under `src/components/ui/` gets a doc comment on its exported component explaining *why* it exists and *when* to reach for it (not *what* its props do — TypeScript already says that) — matching the standard `Modal.tsx`/`Drawer.tsx`/`useDialogBehavior.ts` already set.
- A new registry-shaped module documents, in its own file header, what its "no default implementation" state means for a caller today (see `core/search/service.ts`'s `nullSearchProvider` comment as the reference example) — so a reader never has to guess whether an empty result means "broken" or "not built yet, by design."
