# CLAUDE.md — Permanent Project Instructions

This file governs how any AI agent (or engineer) works in this repository. It does not expire between sessions and takes precedence over ad-hoc convenience unless the user explicitly overrides it in a given conversation.

## What BloomOS is

BloomOS is a vertical SaaS operating system for luxury event businesses, managing the full lifecycle: Lead → Client → Consultation → Proposal → Contract → Deposit → Planning → Inventory → Team → Event Execution → Gallery → Feedback → Returning Client. Full domain detail lives in `BLOOMOS_BIBLE.md` — treat it as the source of truth for business rules and terminology. If code and `BLOOMOS_BIBLE.md` ever disagree, the Bible wins until the user says otherwise.

The first customer is Amoré Bloom, but **BloomOS is built as a standalone, multi-tenant-ready SaaS product**, not a bespoke tool for one company. Every architectural decision should assume other tenants will exist later, even though multi-tenancy is not implemented in the MVP.

## Source of truth hierarchy

1. Direct instructions from the user in the current conversation
2. `BLOOMOS_BIBLE.md` — domain model, terminology, lifecycle, philosophy
3. `ROADMAP.md` — what phase/sprint we are in, what is in scope
4. `TODO.md` — the current actionable checklist
5. `docs/*.md` — detail specs for their respective areas
6. Existing code patterns already in the repo

## Hard rules

- **Scope discipline.** Only implement what the current roadmap phase / sprint calls for. Do not build modules ahead of schedule (e.g., no Inventory, AI Assistant, or Automations code during the MVP phase) without explicit approval.
- **No fictional data in components.** Mock data, fixtures, and types are centralized (see `docs/database.md` and the planned `src/lib` / `src/types` structure once the app exists). Never hardcode business data inside UI components.
- **No fake or complex auth.** Authentication integrates with Supabase Auth when credentials exist. Do not build parallel/fictional auth systems. The Auth foundation (`lib/auth/`, `lib/supabase/`, `src/middleware.ts`) is built and tested against a mocked Supabase client — this is expected infrastructure, not a violation of this rule.
- **Supabase stays disconnected until real credentials exist.** Client factories, migrations, and the Auth foundation may be built and committed ahead of time (see `docs/integrations.md`) — that is expected groundwork, not a live connection. What stays gated on explicit approval and real credentials: actually linking a Supabase project, running any migration (local or remote) against it, or fabricating a project URL/anon key anywhere, ever. `NEXT_PUBLIC_DATA_MODE` defaults to `mock` and must keep defaulting to `mock` until the user says otherwise.
- **TypeScript strict, always.** No `any` without a documented reason. No implicit fallbacks papering over missing types.
- **Small, reusable components.** Prefer composition over large monolithic screens. A component that only one screen will ever use still belongs in a clear, named location — not inline duplication.
- **No unnecessary dependencies.** Every new package must justify itself over what Next.js, TypeScript, Tailwind, and Supabase's own SDKs already provide.
- **Preserve business rules and naming.** Do not rename entities, statuses, or lifecycle stages defined in `BLOOMOS_BIBLE.md` without explicit user approval.
- **Desktop and mobile both matter.** Every screen must work on both; this is not a "responsive later" item.
- **Design restraint.** The product should feel premium, calm, and intuitive (Apple / Linear / Notion / Stripe as reference points). Do not introduce visual flourish that these references wouldn't ship.
- **No comments explaining what code does.** Comment only non-obvious *why* (a workaround, a constraint from `BLOOMOS_BIBLE.md`, a subtlety). Well-named code speaks for itself.
- **Present before you build.** For any new architectural direction (new module, schema change, integration), propose the plan and wait for approval before writing implementation code. Documentation, structure, and planning don't require the same gate.

## Working agreements

- Update `CHANGELOG.md` for any change worth noting to a future reader.
- Keep `TODO.md` current — check items off as they're done, add new ones as scope is confirmed, don't let it drift from reality.
- When a decision changes the domain model (a new lifecycle stage, a new status, a redefined entity), update `BLOOMOS_BIBLE.md` and the relevant `docs/*.md` in the same change — don't let docs and code diverge.
- When in doubt about a business rule that isn't documented, ask rather than assume.
