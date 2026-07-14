# Integrations

This document lists every external system BloomOS touches or will touch, and draws a clear line between what's active now and what's planned. Per `CLAUDE.md`, no integration is connected with fabricated or placeholder credentials — it stays undone until real credentials exist.

## Active

### GitHub
Source control and CI for the BloomOS codebase. Active now.

## Planned, not yet connected

### Supabase
- **Role:** Postgres database, Auth, Storage.
- **Status:** Not connected. The app is built against a centralized mock data layer (mirroring `docs/database.md`) until real Supabase credentials are provided, at which point the data layer is swapped for live queries — application code should not need to change, only the data-access implementation.
- **Scope at connection time:** Auth (team login), Postgres (MVP schema), Storage (contracts/gallery media, once those modules need it).

## Anticipated for future modules (not designed in detail yet)

- **Payment processing** (e.g., Stripe) — for the Finance module to move beyond recording payments manually to actually collecting them. Not in MVP scope; MVP Finance is a ledger, not a payment processor integration.
- **Email delivery** (e.g., Resend, Postmark, or similar) — for the future Email Center and Automations.
- **Calendar sync** (e.g., Google Calendar) — for the future Calendar module.
- **AI provider** (Anthropic/Claude) — for the future Bloom AI assistant; see `docs/ai.md`.

## Principles

- Integrations are added when their owning module's phase begins, not speculatively.
- Every integration boundary is isolated behind an interface in code (e.g., a data-access layer, a mailer interface) so swapping providers later doesn't ripple through business logic.
- Credentials and secrets are never hardcoded or committed; they're environment configuration, supplied by the user when the integration is actually turned on.
