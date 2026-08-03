---
name: git-checkpoint
description: Safely commit and push a completed BloomOS phase — pre-commit safety checks, exact commit message, push, and a confirmed clean working tree. Use whenever the user asks to commit/push, or as the closing step of module-foundation/module-ui/supabase-migration once verification has passed. Encodes this repo's git safety rules so they don't need repeating each time.
---

# Git checkpoint

The closing move of a BloomOS phase: get a clean, verified change into one commit and pushed, safely. This packages the git-safety rules from `project-rules` into the specific sequence used at the end of every phase in this repo's history.

## Before committing

- Confirm the current branch and `HEAD` — don't assume they're still what they were at the start of the session.
- Inspect `git diff` (and `git diff --staged` if anything's already staged) — know what's actually in this change before describing it.
- Inspect exactly which files are staged; stage specific paths rather than a blanket `git add -A`/`git add .`, so an unrelated stray file can't ride along.
- Scan for secrets where relevant — anything that looks like it could hold a credential gets its contents checked before staging, regardless of filename.
- Exclude `.env.local`, any `.claude` local session state, Supabase CLI caches, and other generated/local-only files — these were never meant to be committed.

## Commit

- Use exactly the commit message the user requested, when one was given; otherwise write one focused on *why*, matching this repo's existing commit style (check `git log` for tone).
- One phase of work is one commit, unless a separate, legitimate housekeeping commit was explicitly approved (e.g. a stale test-count fix bundled into the same phase's commit is fine; an unrelated refactor is not).
- Never amend a previous commit unless explicitly asked — a new commit is always the default, even to fix something from moments ago.

## After committing

- Push normally (no force) to the branch actually requested — confirm the target branch name against what was asked before pushing, especially if the working branch and the push target might differ.
- Confirm local and remote `HEAD` now match.
- Confirm the working tree is clean (`git status`).

Report concisely: commit hash, push result, clean-tree confirmation. Skip the file-by-file narration unless asked for it.
