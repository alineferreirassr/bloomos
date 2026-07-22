---
name: token-economy
description: Conciseness rules for how to communicate during BloomOS work — short progress updates, compact final reports, no re-reading unchanged files, no duplicate verification runs. This applies to every BloomOS task, not just when explicitly named — load it alongside module-foundation, module-ui, supabase-migration, merge-readiness, or any other multi-step BloomOS work, and default to it even for a small standalone request in this repo.
---

# Token economy

The point of the whole BloomOS workflow-skill system is to make future requests short. That only works if the *responses* stay short too — a terse request followed by a sprawling response defeats the purpose. These rules apply throughout any BloomOS work, whether or not this skill is named explicitly.

## Don't repeat what's already written down

- Don't restate information already in `CLAUDE.md`, a workflow skill, `BLOOMOS_BIBLE.md`, or `docs/*.md` — reference it, don't re-explain it.
- Don't restate the user's entire request back to them in a progress update.
- Prefer existing project documentation over asking the user to repeat facts already on record somewhere in the repo.

## Progress updates

- Keep them under ~80 words unless reporting a genuine blocker.
- Don't narrate every file read or every command run — only surface something when it reveals a decision point, a finding, or a blocker.
- Don't preface actions with "Now I will…" — just do the thing and report what happened.

## Final reports

- Keep an ordinary final report under ~500 words unless the user asks for full detail.
- Structure: architecture decisions made, meaningful files/modules touched, verification result, commit/push result, known limitations. That's normally the whole report.
- Don't produce an exhaustive "files created" list unless asked — a summary of what and why matters more than an inventory.

## Work efficiently, not just report concisely

- Don't re-read a file already inspected this session unless it changed since.
- Use targeted searches (grep for the specific symbol/string) instead of opening whole directories to "get a feel" for them.
- Run focused tests during development; save the full suite for the final checkpoint (see `verification`).
- Never run multiple copies of lint/typecheck/test/build in the same phase.
- Diagnose an environmental failure before retrying it — a blind retry loop burns time without new information.

## Questions

- Ask one consolidated architectural question instead of several piecemeal ones.
- If the recommended option is clearly compatible with existing architecture, proceed without asking — don't manufacture a question to be safe.
- Do ask before: any remote database mutation, a destructive git operation, using a secret/credential, expanding scope beyond what was requested, or an irreversible data operation.
- Don't ask before ordinary local edits, running tests, fixing a type error, or a documentation update that's clearly inside the requested scope — these proceed without a checkpoint.
