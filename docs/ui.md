# UI

Screen inventory and interaction requirements for the MVP. No prototypes exist yet — this document is the spec that screens are built against, not a description of something already designed. Visual language is governed by `docs/design-system.md`; this file is about structure and states, not aesthetics.

## Navigation

Primary navigation surfaces the MVP modules only:

- Dashboard
- Leads
- Clients
- Events
- Contracts
- Finance

Future modules (Inventory, Suppliers, Team, Client Portal, Bloom AI, Calendar, Automations, Email Center, Analytics, Knowledge Base) are **not** placeholders in the nav during the MVP — they get added when their phase begins, not stubbed out early.

## Required states per screen

Every list and detail screen must account for:

- **Loading** state
- **Empty** state (zero leads, zero clients, etc. — meaningful, not just a blank page)
- **Error** state (data fetch failure)
- **Populated** state

## Screen inventory (MVP)

### Dashboard
Operational overview: counts/status across Leads, Clients, Events, Contracts, Finance. No module-specific detail — links out to each module.

### Leads
- **List:** all leads, filterable by status (`new`, `contacted`, `qualified`, `disqualified`, `converted`)
- **Detail:** lead info, notes, status control, "Convert to Client" action
- **Create/Edit:** form for lead fields

### Clients
- **List:** all clients, indicator for returning clients
- **Detail:** client info, linked Events (past and current), origin lead reference
- **Create/Edit:** form for client fields

### Events
- **List:** all events, filterable/sortable by `lifecycle_stage` and `event_date`
- **Detail:** event info, current lifecycle stage, linked Client, linked Contract, linked Payments
- **Create/Edit:** form for event fields, stage control

### Contracts
- **List:** all contracts, filterable by status
- **Detail:** contract info, linked Event, status control, linked Payments
- **Create/Edit:** form for contract fields

### Finance
- **List:** all payments across contracts, filterable by status/type
- **Detail:** payment info, linked Contract/Event
- **Create/Edit:** form for recording a payment

## Responsive requirements

Every screen above must work on both desktop and mobile viewports. This is not a follow-up pass — it ships with the screen. Layout may adapt (e.g., list/detail split-view on desktop collapsing to stacked navigation on mobile), but no functionality is desktop-only.

## Component reuse

Expect shared components across modules rather than one-off implementations per screen:

- List view (table on desktop, card list on mobile) with sort/filter
- Detail panel/page layout
- Status badge (driven by each module's enum, not hardcoded per screen)
- Form field set (text, select, date, currency)
- Empty/loading/error state components

These live in a shared component layer once implementation begins (see the architecture proposal for exact structure) — not duplicated per module.
