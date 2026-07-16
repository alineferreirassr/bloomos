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
- [x] Build Events module, then wire its card into the Dashboard — foundation + generalized architecture done; full UI done on `feature/events`: Phase 1 list/creation (`/events`, `/events/new`), Phase 2 Event Detail (`/events/[id]`, `/events/[id]/edit` — health score, checklist/schedule summaries, notes, timeline), Phase 3 Checklist management (`/events/[id]/checklist`), Phase 4 Schedule management (`/events/[id]/schedule`); Dashboard reflects Events live throughout
- [x] Build Contracts module, then wire its card into the Dashboard — foundation + full UI done, merged to `feature/clients` via `feature/contracts`: canonical `Contract`/`ContractTemplate`/`ContractExhibit` types, independent `status`/`signature_status` state machines (`core/workflows/contractWorkflow.ts`), full CRUD + lifecycle actions in `lib/data/index.ts`, shared Notes/Timeline reuse, merge-field registry, versioning, 11 realistic seed Contracts across every status; list/detail/create/edit UI, quick actions, exhibit management, version history, Dashboard metrics wired. Still pending: contract template editor, PDF generation, e-signature provider integration
- [x] Build Finance module, then wire its card into the Dashboard — foundation and full UI done on `feature/finance`, merged to `feature/clients`: canonical `Invoice`/`Payment`/`Expense` types, integer minor-unit money model (`lib/money.ts`), three independent state machines (`core/workflows/invoiceWorkflow.ts`/`paymentWorkflow.ts`/`expenseWorkflow.ts`), full CRUD + lifecycle actions in `lib/data/index.ts` (including Payment-to-Invoice application and the refund model), event/workspace financial summaries, derived Event financial status, shared Notes/Timeline reuse, realistic seed data across every status; Invoice/Payment/Expense list/detail/create/edit UI, Finance Dashboard page, Event/Contract Detail financial summary sections, Dashboard metrics wired. Still pending: payment-provider integration
- [x] Build Documents module, then wire its card into the Dashboard — foundation and full UI done on `feature/documents`, merged to `feature/clients`: canonical `Document`/`DocumentFolder` types, polymorphic owner/typed-reference model, `parent_document_id`/`version`/`is_latest_version` version-chain model, storage-provider abstraction (metadata only — every mock Document uses `storage_provider: "mock"`), centralized file-metadata helpers (`lib/documentFile.ts`), two independent state machines, full CRUD + lifecycle actions, reusable default folder templates, owner/Workspace summary helpers, shared Notes/Timeline reuse, realistic seed data; dashboard/list, metadata-only Add/Edit Document forms, Document Detail with quick actions and version history, nested Folders UI, cross-module summary sections on Client/Event/Contract/Invoice/Payment/Expense. Still pending: Supabase Storage connection, real file upload, signed URLs, Client Portal/Team Portal access

## Phase 1.5 — Supabase Foundation (in progress, `feature/supabase-foundation`)

- [x] Environment configuration: `.env.example`, typed `lib/env.ts` (`NEXT_PUBLIC_DATA_MODE`/`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`), mock mode never throws, Supabase mode throws a clear error only when explicitly selected without credentials
- [x] Supabase client factories (`lib/supabase/client.ts` browser, `lib/supabase/server.ts` server, `lib/supabase/middleware.ts` session refresh) using `@supabase/ssr` — no deprecated auth-helpers, no service-role client, no module-scoped singleton
- [x] Auth foundation: sign in/out, session/current-user retrieval, password reset request/update, auth callback route (`src/app/auth/callback/route.ts`), minimal (not final) Sign In/Reset Password/Update Password pages under `src/app/(auth)/`
- [x] Workspace membership data model: `profiles`/`workspaces`/`workspace_members` (roles `owner`/`admin`/`manager`/`team`/`viewer`, statuses `active`/`invited`/`suspended`), 8 ordered SQL migrations under `supabase/migrations/` (extensions, profiles + auto-provisioning trigger, workspaces, workspace_members, shared `updated_at` trigger, `is_workspace_member`/`has_workspace_role`/`current_user_workspace_ids` helper functions, RLS enablement, private Storage buckets + policies for `documents`/`avatars`)
- [x] Data-provider boundary (`lib/data/provider.ts`) — centralized `NEXT_PUBLIC_DATA_MODE` selection point for future module migrations; `lib/data/index.ts` remains the sole implementation for every business module this phase, unconditionally
- [x] Route protection middleware (`src/middleware.ts` + pure `lib/middleware/routeProtection.ts`) — active only when `NEXT_PUBLIC_DATA_MODE=supabase`; mock mode requires no login
- [x] Typed database access: hand-authored placeholder `src/types/database.types.ts` (regenerate via `npm run supabase:types` once a project is linked) + `lib/supabase/mappers.ts` mapping boundary
- [x] Typed Supabase error normalization (`lib/supabase/errors.ts`) into `core/errors`' existing taxonomy, extended with `UnauthorizedError`/`ForbiddenError`/`NetworkError`/`UnknownError`
- [x] Documented local Supabase CLI workflow + `npm run supabase:*` scripts (all `npx`-based, nothing installed globally)
- [x] Provide real Supabase credentials, manually create the first owner/admin account and Workspace row, switch `NEXT_PUBLIC_DATA_MODE=supabase`, and verify the Auth foundation against a live project
- [x] Migrate Leads to a live Supabase repository (`lib/data/leads/`) through the `lib/data/provider.ts` boundary — first business module migrated; uses the browser Supabase client (`lib/supabase/client.ts`) since its UI fetches from Client Components, see `docs/integrations.md`
- [x] Migrate Clients to a live Supabase repository (`lib/data/clients/`) — second business module migrated, same pattern as Leads; includes atomic Lead → Client conversion in `supabase` mode (`convert_lead_to_client` Postgres function, `lib/data/conversion/`), which now also rejects archived Leads (the mock version never did)
- [x] Migrate Events to a live Supabase repository (`lib/data/events/`) — third business module migrated, same pattern as Leads/Clients; bundles Events, Checklist (`checklist_items`), Schedule (`event_schedule_items`), and Event Notes/Timeline into one repository pair; default checklist template application stays atomic via the `apply_default_event_checklist` Postgres function
- [x] Build the Shared Media Library foundation (`lib/data/media/`, `media_assets` table, dedicated `media-assets` Storage bucket) — the single reusable, polymorphic attachment system every current and future module attaches files through; infrastructure only, no UI, no module migrated onto it yet, and completely independent of the still-mock Documents module (Documents becomes a consumer of it in its own future migration, not the other way around)
- [ ] Migrate remaining business modules (Contracts/Finance/Documents) to live Supabase repositories, one module at a time — not started; Documents' own migration is expected to consume the Media Library for file storage rather than owning `storage_*`/`checksum`/version columns itself
- [ ] Use mock data exclusively for Contracts/Finance/Documents until each module's own migration phase is reached — they still read the mock Clients/Events stores directly for cross-references even in `supabase` mode, a known limitation until their own migrations land

## Phase 2 — Post-MVP modules (not started, reserved in the architecture only)

- [ ] **Team Knowledge Base** — private, internal-only knowledge center for team documentation (Company Rules, Employee Handbook, SOPs, Decoration/Proposal/Photography/Emergency/Cleaning/Inventory procedures, Internal Announcements, Training, FAQ for Employees). Independent module, never merged with Documents/Clients/Team Management/Contracts. Placed after Documents in the roadmap. Architecture reserved in `docs/database.md` (`team_kb_articles` sketch), `docs/workflows.md`, `docs/permissions.md` — no table, migration, UI, route, or CMS exists
- [ ] **Client Knowledge Base** — self-service client-facing knowledge base (FAQs, Payment/Cancellation/Rescheduling/Refund Policies, Event Preparation/Welcome Guide, Process/Timeline Explanation, Contract Explanation, Delivery Information, Contact Information). Independent module, never merged with Documents/Clients/Team Knowledge Base — gated by the future Client Portal. Placed after Team Knowledge Base in the roadmap. Architecture reserved in `docs/database.md` (`client_kb_articles` sketch), `docs/workflows.md`, `docs/permissions.md` — no table, migration, UI, route, or CMS exists
- [ ] **Notification Center** — centralized, single-source-of-truth notification system every future module publishes events into instead of implementing its own notification logic (internal events: New Lead Created, Client Converted, Contract Signed, Payment Received/Failed, Event Reminder, Team Member Invited, etc.; client events: Welcome Email, Payment Reminder, Contract Ready/Signed, Invoice Available, etc.; channels: In-App/Email/SMS/Push/Slack/Discord/WhatsApp, not all immediate). Placed after Client Knowledge Base, before a future Settings module. Architecture reserved in `docs/database.md` (`notifications`/`notification_templates`/`notification_preferences`/`notification_deliveries` sketches), `docs/workflows.md`, `docs/permissions.md` — no table, migration, UI, route, component, or delivery channel integration exists
- [ ] **Automation Center** — the orchestration engine every business module emits events into instead of containing automation logic directly (event sources: Lead/Client/Contract/Invoice/Payment/Event/Document/Team/Inventory/Notification lifecycle events; actions: Create Notification, Send Email/SMS/WhatsApp, Create Timeline Entry, Assign User, Update Record, Generate Document/Invoice/Contract, Webhook, Slack/Discord/Google Calendar/Google Drive/Stripe integrations; workflow model: trigger/conditions/filters/variables/delays/branching/loops/approval/retries, none designed yet). Publishes to Notification Center/Timeline/Documents/future Integrations/business modules, but never duplicates Notification Center's delivery logic. Placed after Notification Center. Architecture reserved in `docs/database.md` (`automation_workflows`/`automation_steps`/`automation_runs`/`automation_run_logs`/`automation_variables`/`automation_templates` sketches), `docs/workflows.md`, `docs/permissions.md` — no table, migration, UI, route, or workflow engine exists
