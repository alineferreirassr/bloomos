# BloomOS Product Principles

`BLOOMOS_BIBLE.md` defines what BloomOS *is* — the domain, the lifecycle, the terminology. This document defines what BloomOS *believes* — the long-term philosophy that should shape every decision, from a single button's copy to a multi-year module roadmap. Where a feature decision is ambiguous and neither the Bible nor a spec in `docs/` settles it, these principles are the tiebreaker.

## 1. Every feature earns its place

A feature ships only if it does at least one of:

- **Saves time**
- **Reduces mistakes**
- **Improves the client experience**
- **Increases operational efficiency**

If a proposed feature does none of these, it does not belong in BloomOS — no matter how easy it is to build or how interesting it is technically.

## 2. Prefer workflows over isolated screens

A screen that just displays or edits one entity is a means, not an end. The point of BloomOS is that a Lead becoming a Client becoming an Event becoming a Contract is *one continuous story*, not four disconnected records a user has to manually stitch together. Whenever a design choice is between "a clean isolated screen" and "a screen that makes the next step in the lifecycle obvious," choose the latter.

## 3. Automation before manual work

Once a rule is unambiguous, BloomOS should do it, not remind a human to do it. Reminders and manual checklists are a stepping stone toward automation, not the destination. This principle governs the future Automations module (`docs/automations.md`) but also smaller moments today: if a status transition, calculation, or notification can be derived with certainty from existing data, it should be — the team's judgment is reserved for things that actually require judgment.

## 4. AI assists humans; it never replaces business approval

Bloom AI (`docs/ai.md`) drafts, summarizes, flags, and suggests. It does not send a client-facing message, sign a contract, move money, or make a commitment on the business's behalf without a human approving that specific action. This is a permanent constraint, not a Phase 1 limitation to be relaxed once the AI is "trusted enough" — the business owner is always the one who is accountable, so they are always the one who decides.

## 5. Build for long-term scalability

BloomOS is a SaaS product first, Amoré Bloom's tool second. Every architectural decision — data model, module boundaries, integration seams — should assume: more Workspaces will exist (`BLOOMOS_BIBLE.md` §7), more modules will be added, and other businesses in the same vertical will eventually run on this system. This doesn't mean building unused generality now; it means never writing something in a way that forecloses that future by accident.

## 6. Premium is a floor, not a ceiling

The bar is Apple, Linear, Notion, Stripe — not "good enough for an internal tool." Craft, restraint, and clarity are load-bearing product requirements, evaluated at the same priority as correctness, not as a polish pass that happens if time allows.

## 7. Trust is the product

BloomOS holds client relationships, signed contracts, and money. Every principle above is subordinate to this one: if a choice trades a shortcut for a risk to correctness, data integrity, or client trust, the shortcut loses — every time.
