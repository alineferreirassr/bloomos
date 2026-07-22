---
name: project-rules
description: The permanent, non-negotiable BloomOS rules — project root, git safety, security boundaries, scope discipline. Load this whenever starting substantial work in the BloomOS repo (a new module, a migration, a merge, anything beyond a single small edit), and always as the first thing any other bloomos-* skill does. Also use when the user asks "what are the project rules" or seems about to do something these rules would block (rebase, force-push, committing a secret, skipping RLS).
---

# BloomOS project rules

These are the standing rules for `/Users/alineferreira/Developer/bloomos` — the permanent project root. If a path or branch doesn't resolve under this root, stop and ask which copy is current rather than guessing; stale copies under Documents/Downloads are not the project.

Every other `bloomos-*` skill assumes these rules are already in effect — they don't repeat them, they just follow them.

## Before touching anything

Inspect the current branch, `HEAD`, and `git status` first. Never assume what state a previous session left the repo in — a stale assumption here is the single most common source of wasted work or an accidental cross-branch edit.

## Git safety

- Never delete, squash, rebase, amend, or force-push unless explicitly requested in the current conversation.
- Never skip hooks (`--no-verify`) or bypass signing.
- Never commit credentials. When staging broadly, check `git status` for anything that looks like a secret file even under an innocuous name, and check the contents of anything suspicious before it's staged.
- `.env.local` stays untracked — always.

## Security boundaries

- RLS (Row-Level Security) is the real security boundary for anything touching Supabase — a schema change isn't complete until its RLS policies are confirmed, not just its columns.
- Never expose `service_role`, database passwords, access tokens, or user passwords — not in code, not in logs, not in chat, not in a committed file.
- Never ask for a password in chat for a live check. Use the session already available, or ask the user to perform that one step themselves.
- The mock/Supabase split stays behind each module's repository interface (`lib/data/<module>/repository.ts`, one mock implementation, one Supabase implementation, selected through `lib/data/provider.ts`). UI code never imports a mock store directly and never branches on data mode.

## Scope discipline

- Only one business module gets migrated to Supabase per phase, unless explicitly told otherwise.
- Do not silently broaden scope — if a task turns out to need something bigger than what was asked, say so and propose it rather than just doing it.
- Stop and ask only when an architectural decision genuinely can't be inferred safely from existing patterns, `BLOOMOS_BIBLE.md`, or `docs/*.md`. Ordinary implementation choices that match existing conventions don't need a question.

## Why this exists

BloomOS has been built module-by-module over a long engagement, with the same review-and-approval pattern repeating each time: an architecture audit, a plan, approval, implementation, migration approval, live verification, docs, one commit. These rules are the parts of that pattern that are always true regardless of which module is next — encoding them here means future requests can say "use module-foundation for Clients" instead of re-explaining all of this every time.
