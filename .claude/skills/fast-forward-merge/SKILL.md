---
name: fast-forward-merge
description: Safely fast-forward-merge one BloomOS branch into another (--ff-only), with ancestry and clean-tree checks first. Use when the user says "fast-forward X into Y," asks to merge without creating a merge commit, or after merge-readiness confirms a fast-forward is possible. Never squashes, rebases, amends, force-pushes, or deletes a branch unless explicitly requested.
---

# Fast-forward merge

A safe, narrow procedure for merging one branch into another with `--ff-only` — the merge only happens if it can happen cleanly and losslessly; anything else stops and reports back instead of improvising a different kind of merge.

## Procedure

1. Confirm the source branch and its `HEAD` — this is what's being merged in.
2. Confirm the target branch, check out its latest state, and confirm its working tree is clean before touching anything.
3. Confirm ancestry: the target's current `HEAD` must be an ancestor of the source branch's `HEAD` (`git merge-base --is-ancestor <target> <source>`). If it isn't, a fast-forward isn't possible — stop and report that instead of falling back to a merge commit or a rebase on your own initiative.
4. `git merge --ff-only <source>` on the target branch.
5. Push the target branch normally (no force).
6. Run `verification` (lint → typecheck → test → build) on the merged result.
7. Confirm no protected branch was affected beyond the intended target — check which branch is actually checked out and pushed before and after.
8. Stop. Don't chain into deleting the source branch, opening a PR, or starting the next phase unless separately asked.

## Never do without explicit, in-the-moment request

- Squash the commits
- Rebase either branch
- Amend anything
- Force-push
- Delete the source branch after merging

If the ancestry check fails, that's the answer — report it plainly (what diverged, since which commit) rather than choosing a different merge strategy to route around it.
