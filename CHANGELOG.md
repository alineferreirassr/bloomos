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

### Changed

- Renamed the tenancy concept from "organization" to **Workspace** throughout `docs/database.md`, `docs/permissions.md`, and `docs/ai.md` (`organization_id` → `workspace_id`, `organizations` table → `workspaces` table)
- `ROADMAP.md`: Dashboard moved earlier in the Phase 1 sequence (built as a shell alongside the app frame, then wired up incrementally as each module ships, instead of being built last); added Notifications (Phase 3) and Global Search (Phase 4) to future modules; Phase 0 now includes scaffolding reserved structural folders (`core/`, `services/`, `features/`, `automation/`, `audit/`, `email/`) as placeholders ahead of their implementation phase
