# The BloomOS Bible

This document is the single source of truth for what BloomOS *is*: its domain, its terminology, its lifecycle, and the philosophy behind every product decision. When code, UI, or any other document conflicts with this file, this file wins until the user explicitly changes it.

## 1. What BloomOS is

BloomOS is a **vertical operating system for luxury event businesses**. It is not a CRM, not an ERP, and not a generic project management tool — those are commodity categories. BloomOS exists to run the entire life of a luxury event, end to end, in one system built specifically for how these businesses operate.

The first company operating on BloomOS is **Amoré Bloom**, a luxury proposal and event planning company based in California. Amoré Bloom is the design partner and first real-world validation of the product — but BloomOS must be architected, from day one, as a **standalone SaaS product**: modular, scalable, and multi-tenant-ready, even though multi-tenancy itself is not implemented in the MVP.

**Always think like a SaaS company, not like a custom internal tool.**

## 2. Core philosophy

Every feature that goes into BloomOS must do at least one of the following:

- **Save time** for the team running the event business
- **Reduce mistakes** (missed follow-ups, wrong dates, lost details)
- **Improve the client experience**
- **Increase operational efficiency**

If a proposed feature does none of these, it does not belong in BloomOS.

The product should feel **premium, elegant, and extremely intuitive** — with Apple, Linear, Notion, and Stripe as the reference bar for craft, clarity, and restraint.

## 3. The event lifecycle

BloomOS is organized around one central lifecycle. Every module either advances an event through this lifecycle or supports something that does:

```
Lead
 → Client
 → Consultation
 → Proposal
 → Contract
 → Deposit
 → Planning
 → Inventory
 → Team
 → Event Execution
 → Gallery
 → Feedback
 → Returning Client
```

See [`docs/workflows.md`](./docs/workflows.md) for the detailed definition, entry/exit criteria, and transition rules of each stage.

### Glossary

| Term | Definition |
|---|---|
| **Lead** | A prospective client who has expressed interest but has not yet been qualified or engaged in a paid consultation. |
| **Client** | A lead that has been qualified/converted; has an active or past relationship with the business. |
| **Consultation** | The discovery conversation/meeting where the client's vision, budget, and requirements are captured. |
| **Proposal** | A formal offer (scope, concept, pricing) presented to the client for approval. |
| **Contract** | The signed agreement that turns a proposal into a committed engagement. |
| **Deposit** | The initial payment that secures the booking, tied to the contract. |
| **Planning** | The operational phase where the event's details, timeline, and logistics are built out. |
| **Inventory** | Physical/rental assets (decor, props, equipment) allocated to an event. *(Post-MVP module.)* |
| **Team** | The staff/vendors assigned to execute the event. *(Post-MVP module.)* |
| **Event Execution** | The live delivery of the event on the day(s) it happens. |
| **Gallery** | Photos/media delivered to the client after the event. |
| **Feedback** | The client's post-event review/testimonial. |
| **Returning Client** | A client who re-enters the lifecycle for a new event, carrying their history forward. |

## 4. MVP scope

The MVP is deliberately narrow. It includes only:

- **Dashboard** — operational overview
- **Leads** — capture and qualify prospects
- **Clients** — the converted, ongoing relationship record
- **Events** — the record tying a client to a specific engagement and its lifecycle stage
- **Contracts** — agreements and their status
- **Finance** — deposits, payments, and balances tied to events/contracts

Nothing outside this list is implemented in the MVP, regardless of how small it seems.

## 5. Future modules (post-MVP)

These are acknowledged, planned, and architecturally anticipated, but **not built** until their turn in the roadmap:

- Inventory
- Suppliers
- Team Management
- Client Portal
- AI Assistant ("Bloom AI")
- Calendar
- Automations
- Email Center
- Analytics
- Knowledge Base

See [`ROADMAP.md`](./ROADMAP.md) for sequencing.

## 6. Product principles

- **Vertical, not horizontal.** BloomOS is deep for one kind of business, not shallow for many.
- **SaaS-grade from day one.** Multi-tenant-ready data model and clean module boundaries, even while serving a single tenant.
- **Modular.** Each module (Leads, Clients, Events, Contracts, Finance, and future modules) is a bounded, composable unit — not a tangle of cross-cutting logic.
- **Premium by default.** Visual and interaction quality is a product requirement, not a polish pass.
- **Trustworthy with client data.** This system holds real client relationships, contracts, and money. Correctness and clarity outrank cleverness.

## 7. Change control

This document changes only when the business model or lifecycle genuinely changes — not to accommodate a shortcut in implementation. Any change here must be reflected in the relevant `docs/*.md` files in the same change.
