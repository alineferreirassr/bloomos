---
name: merge-readiness
description: Generate a compact report on whether a BloomOS branch is ready to merge — base/merge-base, commits since base, verification results, ancestry, fast-forward possibility, HEAD/tree state. Use when the user asks to "prepare merge readiness," "is this branch ready to merge," or before any fast-forward-merge. Deliberately compact — not a full implementation history.
---

# Merge readiness

A short, factual report answering one question: can this branch merge cleanly right now, and what's actually in it. Used before `fast-forward-merge`, or standalone when the user just wants the current state.

## What to gather

- The base branch and the merge-base commit between the working branch and that base.
- The list of commits since that merge-base (one line each — hash + subject, not the full diff).
- Current verification status — re-run `verification` if it hasn't run since the last change, don't report a stale result.
- Known limitations — anything explicitly deferred or out of scope that a merge reviewer should know about (check `TODO.md`/`CHANGELOG.md` for what the branch itself already documented).
- Ancestry result — is the base still an ancestor of the working branch (i.e. would a fast-forward even be possible), via `git merge-base --is-ancestor`.
- Fast-forward possibility — explicit yes/no, not just the ancestry fact.
- Local vs. remote `HEAD` for both branches.
- Working tree cleanliness.

## Report format

Keep it to exactly these sections, nothing more:

```
Merge Readiness — <branch> → <target>

Base: <target>@<short-sha> (merge-base)
Commits since base: <n>
  <sha> <subject>
  ...

Verification: lint ✓ / typecheck ✓ / test <n>/<n> ✓ / build ✓
Known limitations: <bullet list, or "none noted">

Ancestry: <target> is / is not an ancestor of <branch>
Fast-forward possible: yes / no
Local HEAD: <sha> — matches remote: yes / no
Working tree: clean / dirty
```

Do not repeat the complete implementation history of every phase that went into this branch, and do not list every changed file unless the user specifically asks for that level of detail — this report is meant to answer "is it ready," not re-tell the story of how it got here.
