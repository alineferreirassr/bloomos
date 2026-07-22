---
name: verification
description: Run BloomOS's sequential lint/typecheck/test/build verification with disciplined, minimal output. Use whenever the user asks to "run verification," "verify everything," or before any commit — and as the standard last step of module-foundation, module-ui, and supabase-migration. Never claims a check passed without observing its actual exit result.
---

# Verification

The standard four-step check that closes out any BloomOS phase before a commit. Runs sequentially — each step only starts after the previous one is confirmed clean — never in parallel, since a failing lint run makes a subsequent typecheck/test/build result meaningless to report anyway.

## Order

1. `npm run lint`
2. `npm run typecheck`
3. `npm run test`
4. `npm run build` — only after tests pass, never run speculatively before them

## Rules

- Don't start a duplicate background process for something already running — check first.
- Don't repeatedly poll a long-running command; wait for it to actually finish.
- Only kill a stale Node/npm process once it's clearly confirmed stale, not on suspicion.
- Only clear a generated cache (`.next`, `node_modules/.cache`) once corruption is actually proven, not as a first troubleshooting reflex.
- **Never describe a check as passing unless its exit result was actually observed.** This is the one rule this whole skill exists to enforce — a plausible guess is not a verification.
- Don't retry an environmental failure (a flaky port, a missing env var) repeatedly without first diagnosing what's actually wrong.

## Output

Report only:
- lint result (pass, or the actual warnings/errors)
- typecheck result
- test count (e.g. "1993/1993 passing")
- build result
- any real warning worth a human's attention

Don't narrate each command before running it, and don't paste raw tool output that a one-line summary already covers.
