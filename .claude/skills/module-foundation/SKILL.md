---
name: module-foundation
description: Scaffold a BloomOS business module's data-layer foundation — types, enums, schemas, workflow helpers, repository, migrations, RLS, tests — with no UI. Use this whenever the user says "use module-foundation for X", asks to start/migrate a module's backend or Supabase persistence, or describes building out a new business module's data model without mentioning UI. Applies project-rules first.
---

# Module foundation

Scaffolds the data-layer half of a BloomOS business module — everything below the UI. This is the same procedure that shipped Leads, Clients, Events, Contracts, Finance, and Documents; it exists as a skill so a request only needs to name the module and any deviation from the default, not re-explain the whole procedure.

Apply `project-rules` first — branch/HEAD check, git safety, security boundaries all still apply here.

## Inputs to confirm before starting

- **Module name** — which business entity this is.
- **Source branch** — where the work happens; confirm it matches what the user named, the same way `project-rules` requires checking branch/HEAD before starting.
- **Target data mode** — mock only, Supabase only, or both (both is the default for a real migration; mock-only is for a brand-new module with no Supabase phase yet).
- **Related entities** — what this module is allowed to reference/read (e.g. Contracts reads Clients and Events).
- **Explicitly excluded modules** — anything the user named as out of scope this phase, so it doesn't get pulled in "while we're at it."

If any of these is genuinely ambiguous after checking `BLOOMOS_BIBLE.md`, `docs/*.md`, and existing sibling-module patterns, ask one consolidated question rather than several small ones. If the answer is inferable from how the last migrated module did it, proceed without asking.

## Procedure

1. **Inspect existing patterns before writing code.** Read the most recently migrated sibling module's types/enums/schema/repository/migrations end to end — BloomOS's module structure is deliberately uniform, and copying an established shape correctly is more valuable than a novel one.
2. **Preserve existing public interfaces where possible.** If this module already has a mock implementation, its exported function signatures usually shouldn't change just because Supabase is being added.
3. Create/extend enums, domain types, and zod schemas for the module.
4. Create core workflow helpers (status transitions, terminal-state rules, a `getNextRecommendedAction`-style function) if the module has any lifecycle.
5. Write ordered SQL migrations if this phase includes Supabase persistence — table(s), indexes, constraints, triggers, RLS. Do not apply them yet; that's `supabase-migration`'s job, which always waits for explicit approval before touching the linked project.
6. Define the repository interface (`lib/data/<module>/repository.ts`).
7. Implement the mock repository and/or the Supabase repository per the target data mode, selected through `lib/data/provider.ts`.
8. Add RLS scoped by active Workspace membership (`is_workspace_member()` or equivalent) — this is the real security boundary, not an afterthought.
9. Reuse the existing polymorphic Notes/Timeline architecture (`owner_type`/`owner_id`) rather than inventing a module-specific notes table.
10. Write tests — repository CRUD, every lifecycle transition, Workspace isolation, and the migration file structure itself if new migrations were added.
11. Update documentation (`docs/database.md`, `docs/workflows.md`, `docs/permissions.md`, `CHANGELOG.md`, `TODO.md`) as part of the same phase, not deferred.
12. Run `verification` (lint → typecheck → test → build, in order).
13. **Stop before UI unless the user explicitly included it.** Foundation and UI are separate skills/phases by default — don't keep going into `module-ui` without being asked, even if it seems like the obvious next step.

Don't repeat this entire procedure back to the user in a status update — reference it by name ("running module-foundation for Clients") and report only real findings, decisions, and results as they happen.
