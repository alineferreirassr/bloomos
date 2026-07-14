# TODO

Current, actionable tasks. Keep this in sync with reality — check items off as done, add items as scope is confirmed. This is not a roadmap (see `ROADMAP.md`) and not a backlog of ideas (those go to the relevant `docs/*.md` under a future-module section).

## Phase 0 — Foundation

- [x] Initialize repository
- [x] Write `README.md`
- [x] Write `CLAUDE.md`
- [x] Write `BLOOMOS_BIBLE.md`
- [x] Write `ROADMAP.md`
- [x] Write `CHANGELOG.md`
- [x] Write `TODO.md` (this file)
- [x] Write `docs/database.md`
- [x] Write `docs/workflows.md`
- [x] Write `docs/ui.md`
- [x] Write `docs/automations.md`
- [x] Write `docs/integrations.md`
- [x] Write `docs/permissions.md`
- [x] Write `docs/ai.md`
- [x] Write `docs/design-system.md`
- [x] Present technical architecture proposal to the user
- [x] Write `PRODUCT_PRINCIPLES.md`
- [x] Document the Workspace concept (`BLOOMOS_BIBLE.md` §7) — not implemented
- [x] Get explicit approval on the architecture (approved, with adjustments incorporated)
- [x] Scaffold Next.js (App Router) + TypeScript strict + Tailwind CSS v4 + ESLint project
- [x] Scaffold reserved structural folders (`core/`, `services/`, `features/`, `automation/`, `audit/`, `email/`) as placeholders — no business logic yet
- [x] Verify empty shell builds, lints, typechecks, and runs locally (desktop + mobile viewport)

## Phase 1 — MVP (in progress)

- [x] Build app shell (AppShell, Sidebar, TopBar, responsive Mobile Navigation)
- [x] Build minimal Dashboard shell early (placeholder cards over mock data) — not deferred to the end
- [ ] `core/` real scaffolding (shared enums, constants, errors, permissions, roles, guards, logger) — populate when the Leads module starts
- [ ] `lib/data/index.ts` swappable data-access abstraction — introduce when a second data source (a real module) exists
- [ ] Define mock data + centralized types for Leads, Clients, Events, Contracts, Finance
- [ ] Build Leads module, then wire its card into the Dashboard
- [ ] Build Clients module, then wire its card into the Dashboard
- [ ] Build Events module, then wire its card into the Dashboard
- [ ] Build Contracts module, then wire its card into the Dashboard
- [ ] Build Finance module, then wire its card into the Dashboard
- [ ] Connect Supabase (only once real credentials are provided) — no authentication and no live connection before this
- [ ] Use mock data exclusively until the above is reached
