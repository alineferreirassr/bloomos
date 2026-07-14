# AI — "Bloom AI"

**Status: post-MVP (Phase 3).** No AI feature is implemented in the MVP. This document captures the vision and guardrails now so that when Bloom AI is built, it starts from an agreed design instead of an improvised one — and so nothing in the MVP data model or UI accidentally forecloses it.

## Vision

Bloom AI is an assistant embedded in BloomOS that helps the team run the business faster and with fewer mistakes — grounded in the same lifecycle and data every other module uses (`BLOOMOS_BIBLE.md`, `docs/workflows.md`). It is not a chatbot bolted on for novelty; it must clear the same bar as any other feature: save time, reduce mistakes, improve the client experience, or increase operational efficiency.

## Anticipated capabilities (not yet designed in detail)

- Drafting proposals and follow-up communications from consultation notes
- Summarizing a client's or event's history and current status
- Flagging risk (e.g., a stalled lead, an overdue deposit, an approaching event with an incomplete Planning checklist)
- Answering team questions against the business's own data (leads, clients, events, contracts, finance)

## Guardrails

- **Data-grounded, not speculative.** Bloom AI answers from BloomOS's actual data; it does not fabricate client, contract, or financial information.
- **Assist, not replace.** It drafts and suggests; a human approves anything client-facing or financially consequential before it goes out.
- **Scoped to Workspace data.** Same tenant-isolation rule as everything else in `docs/permissions.md` — no cross-tenant leakage, ever.
- **Transparent.** Where Bloom AI takes or suggests an action, it's visible and attributable, not a silent background process.

## Explicitly out of scope for now

Any AI-generated content, chat interface, model integration, or prompt infrastructure in the MVP. The MVP's six modules must be fully usable through direct human action with no AI dependency.
