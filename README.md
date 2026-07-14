# BloomOS

BloomOS is a vertical operating system for luxury event businesses. It manages the complete lifecycle of an event — from first contact to returning client — in one system, purpose-built for the way high-end event studios actually work.

BloomOS is not a generic CRM, not a generic project manager, and not a spreadsheet replacement. It is opinionated software for a specific kind of business, built with the discipline of a real SaaS product from day one.

## The lifecycle

```
Lead → Client → Consultation → Proposal → Contract → Deposit
     → Planning → Inventory → Team → Event Execution
     → Gallery → Feedback → Returning Client
```

Every module in BloomOS exists to serve one or more stages of this lifecycle. See [`BLOOMOS_BIBLE.md`](./BLOOMOS_BIBLE.md) for the full domain model.

## First customer

The first company operating on BloomOS is **Amoré Bloom**, a luxury proposal and event planning company based in California. Amoré Bloom's real operating needs drive the MVP, but BloomOS is architected as a standalone, multi-tenant-ready SaaS product — not a custom internal tool for a single client.

## Project status

**Pre-implementation.** The repository currently contains project documentation and architecture only. No application code has been written yet. See [`ROADMAP.md`](./ROADMAP.md) for the phased plan and [`TODO.md`](./TODO.md) for the current checklist.

## Stack

- **Next.js** (App Router) + **TypeScript** (strict)
- **Tailwind CSS**
- **Supabase** (Postgres, Auth, Storage) — connected only once real credentials exist
- **GitHub** for source control and CI

No unnecessary dependencies. Every library added must earn its place.

## Documentation map

| File | Purpose |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | Permanent operating instructions for AI agents and engineers working in this repo |
| [`BLOOMOS_BIBLE.md`](./BLOOMOS_BIBLE.md) | Source of truth for the domain model, lifecycle, and Workspace concept |
| [`PRODUCT_PRINCIPLES.md`](./PRODUCT_PRINCIPLES.md) | Long-term product philosophy — the tiebreaker when a decision isn't settled elsewhere |
| [`ROADMAP.md`](./ROADMAP.md) | Phased delivery plan, MVP scope, future modules |
| [`CHANGELOG.md`](./CHANGELOG.md) | Notable changes, by version |
| [`TODO.md`](./TODO.md) | Current, actionable task list |
| [`docs/database.md`](./docs/database.md) | Data model and schema design |
| [`docs/workflows.md`](./docs/workflows.md) | Lifecycle stages, transitions, business rules |
| [`docs/ui.md`](./docs/ui.md) | Screen inventory and UI states |
| [`docs/automations.md`](./docs/automations.md) | Automation rules (future module) |
| [`docs/integrations.md`](./docs/integrations.md) | External services and integration boundaries |
| [`docs/permissions.md`](./docs/permissions.md) | Roles, access control, RLS strategy |
| [`docs/ai.md`](./docs/ai.md) | Bloom AI vision and guardrails (future module) |
| [`docs/design-system.md`](./docs/design-system.md) | Visual and interaction principles |

## Philosophy

Every feature must either save time, reduce mistakes, improve the client experience, or increase operational efficiency. The product should feel premium, elegant, and extremely intuitive — inspired by Apple, Linear, Notion, and Stripe. We build BloomOS like a SaaS company, not like a custom internal tool.

## License

Proprietary. All rights reserved.
