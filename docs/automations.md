# Automations

**Status: post-MVP.** No automation is implemented in the MVP. This document exists so that when this module's phase begins (see `ROADMAP.md`, Phase 3), implementation starts from an agreed concept instead of an improvised one — and so that nothing in the MVP accidentally forecloses these use cases.

## Purpose

Automations exist to satisfy the same bar as every other BloomOS feature: save time, reduce mistakes, improve the client experience, or increase operational efficiency (`BLOOMOS_BIBLE.md` §2). They are triggers and actions layered on top of the lifecycle in `docs/workflows.md` — not a separate system.

## Anticipated triggers

- Lead created and not contacted within N hours
- Lead status unchanged for N days
- Proposal sent, no response within N days
- Contract signed → deposit reminder
- Deposit overdue
- Event date approaching (Planning checklist reminders)
- Event completed → trigger Gallery delivery task
- Gallery delivered → trigger Feedback request
- Feedback received (or window elapsed) → flag Client as candidate for a "keep in touch" nurture

## Anticipated actions

- Internal notification/task for the team
- Templated email to the client (ties into the future Email Center)
- Automatic status/stage transition (e.g., auto-flip a lead to `stale` after inactivity) — only when the rule is unambiguous; anything judgment-based stays a human action with a reminder, not an auto-transition

## Design constraints for when this is built

- Every automation must be traceable to a specific trigger → action pair, visible to the team (no invisible magic).
- Automations must be pausable/overridable per event — the system assists, it doesn't lock the team out of manual control.
- No automation sends anything client-facing without having gone through the same quality bar a human-sent message would.

## Explicitly out of scope for now

Building any of the above, a rules engine, a scheduler, or email-sending infrastructure. The MVP's `Finance`, `Contracts`, and `Events` modules must not be designed in a way that *requires* automation to function correctly — they work by direct human action first.
