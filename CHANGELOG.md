# Changelog

All notable changes to BloomOS are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Initial repository documentation: `README.md`, `CLAUDE.md`, `BLOOMOS_BIBLE.md`, `ROADMAP.md`, `TODO.md`, `CHANGELOG.md`
- `docs/` specs: `database.md`, `workflows.md`, `ui.md`, `automations.md`, `integrations.md`, `permissions.md`, `ai.md`, `design-system.md`
- Project initialized as a standalone repository (no external handoff package; BloomOS is being built from scratch)
- Full technical architecture proposed and approved: folder structure, module boundaries, data layer, auth/authorization strategy, Supabase integration plan, routing, shared components, state management, validation, error handling, file/document storage, testing strategy, security considerations, and Sprint 1 implementation order
- `PRODUCT_PRINCIPLES.md` — long-term product philosophy (workflows over screens, automation before manual work, AI assists but never replaces business approval, build for long-term scalability)
- Workspace concept documented (`BLOOMOS_BIBLE.md` §7) as the future multi-tenant boundary; not implemented in the MVP
- Next.js 16 (App Router) + TypeScript (strict) + Tailwind CSS v4 + ESLint project scaffolded
- Design tokens defined in `src/app/globals.css` (provisional neutral palette + accent — recorded in `docs/design-system.md`)
- Approved folder structure created: `app/`, `modules/`, `components/`, `lib/`, `config/`, plus reserved placeholders `core/`, `services/`, `features/`, `automation/`, `audit/`, `email/` (each with a README noting it's a placeholder, per the approved architecture)
- Shared UI primitives: `Button`, `Card`, hand-rolled nav icon set (no icon library dependency)
- `AppShell`, `Sidebar`, `TopBar`, and responsive `MobileNav` (drawer on mobile, breakpoint at `md`)
- Minimal Dashboard shell (`/dashboard`) with placeholder metric cards (Leads, Clients, Events, Contracts, Finance) over mock data, ready to go live as each module ships
- `docs/database.md` gains a provisional `file_path` note on `contracts` for future document storage
- **Leads module, end to end (mock data):** list (search, status/source/event-type filters, archive visibility, responsive table + cards, empty/loading/error states), detail (contact/event info, pinned + all notes, timeline, status selector, next-recommended-action), create/edit forms (zod + react-hook-form, client-side and authoritative data-layer validation), Notes (categories/priorities, pinning), Welcome Guide mock action, Archive, and Convert-to-Client (confirmation modal, duplicate-conversion prevention, history preservation)
- `LeadConversionService` (`modules/leads/services/`) — owns the Lead → Client conversion business rule; UI only ever calls it via `lib/data`
- `core/workflows/leadWorkflow.ts` — the canonical Lead lifecycle (`canTransition`, `getNextStatuses`, `isTerminalStatus`, `getNextRecommendedAction`), the single source of truth consumed by both the data layer and the UI
- Centralized timeline recording (`recordTimelineActivity` in `lib/data/mock/timelineStore.ts`) — no module constructs a timeline entry by hand
- `lib/data/index.ts` — the swappable mock data-access layer (Leads, Notes, Timeline, minimal Clients, Dashboard metrics), with typed `DataResult` success/failure handling
- Minimal Client proof page (`/clients/[id]`) — just enough to demonstrate the conversion workflow; the full Clients module is still future work
- Vitest + React Testing Library test suite: zod schemas, lifecycle transitions, CRUD operations, conversion (including duplicate-prevention and history-preservation), notes/pinning, list filtering, and responsive list rendering
- Dashboard's Leads/Clients metrics now read live counts from the data layer instead of static placeholders

### Fixed

- Navigation no longer leads to 404s: `/leads`, `/clients`, `/events`, `/contracts`, `/finance` each render a shared `ComingSoon` placeholder until their module is built, so every nav link and Dashboard metric card resolves to a real page
- `LeadDetailView`'s refetch-after-mutation no longer flashes a full loading skeleton, which was unmounting `LeadActions` before its success/error feedback (e.g. "Welcome Guide marked as sent.") ever became visible — found via browser smoke testing

### Changed

- Renamed the tenancy concept from "organization" to **Workspace** throughout `docs/database.md`, `docs/permissions.md`, and `docs/ai.md` (`organization_id` → `workspace_id`, `organizations` table → `workspaces` table)
- `ROADMAP.md`: Dashboard moved earlier in the Phase 1 sequence (built as a shell alongside the app frame, then wired up incrementally as each module ships, instead of being built last); added Notifications (Phase 3) and Global Search (Phase 4) to future modules; Phase 0 now includes scaffolding reserved structural folders (`core/`, `services/`, `features/`, `automation/`, `audit/`, `email/`) as placeholders ahead of their implementation phase
