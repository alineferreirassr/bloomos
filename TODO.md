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
- [x] Fix navigation: Leads/Clients/Events/Contracts/Finance show a "Coming Soon" placeholder instead of 404
- [x] `core/` real scaffolding: `enums/` (LeadStatus, NoteCategory, NotePriority, TimelineActivityType), `errors/`, `constants/` (Workspace, actor) — `permissions/`, `roles/`, `guards/`, `logger/` remain placeholders until auth exists
- [x] `core/workflows/leadWorkflow.ts` — canonical Lead lifecycle (`canTransition`, `getNextStatuses`, `isTerminalStatus`, `getNextRecommendedAction`), consumed by both the data layer and the UI
- [x] `lib/data/index.ts` swappable data-access abstraction — introduced with the Leads module (mock-backed for now)
- [x] Define mock data + centralized types for Leads (Clients only as much as the conversion proof needs; Events/Contracts/Finance still pending)
- [x] Build Leads module end to end: list (search/filter/archive-visibility, responsive table+cards, empty/loading/error states), detail (contact/event info, pinned+all notes, timeline, status selector, actions), create/edit forms, Welcome Guide mock action, Archive, Convert-to-Client (via `LeadConversionService`) — then wire its card into the Dashboard
- [x] Build Clients module foundation: canonical types/enums/schemas, generalized Notes/Timeline architecture (shared with Leads, workspace-scoped), data layer, workflow helper
- [x] Build Clients module UI: list (search/filters/VIP/tags/source/archived, responsive table+cards, empty/loading/error states), full profile (header/contact/relationship/address/preferences/internal, shared Notes+Timeline), create/edit forms, quick actions (Edit/Archive/Restore/VIP/Status/Contact method/Tags) — then wire its card into the Dashboard
- [x] Full Clients browser smoke test (notes, preferences, important dates, status, contact method, VIP, tags, archive/restore, mobile list+profile+form, Lead→Client conversion) — passed; one gap found and fixed (Tags had no UI despite the data layer already supporting it)
- [x] Implement the approved design (`bloomos-handoff/` Classical design system) exactly, on `feature/design-system` — tokens, fonts (Lora + Cormorant Garamond), outline buttons, borderless cards, 3-tone tags, corrected icons, matching Sidebar/Header spacing; presentation-layer only, no routing/data-layer/component-hierarchy changes; 5 disclosed gaps recorded in `docs/design-system.md`
- [ ] Build Events module, then wire its card into the Dashboard — foundation + generalized architecture done; Phase 1 UI done on `feature/events` (`/events` list with filters/sort/responsive table+cards, `/events/new` creation form, temporary `/events/[id]` placeholder; Dashboard already reflects new Events live). Still pending: Event Detail (Phase 2), Checklist UI, Schedule UI, Notes/Timeline UI for Events
- [ ] Build Contracts module, then wire its card into the Dashboard
- [ ] Build Finance module, then wire its card into the Dashboard
- [ ] Connect Supabase (only once real credentials are provided) — no authentication and no live connection before this
- [ ] Use mock data exclusively until the above is reached
