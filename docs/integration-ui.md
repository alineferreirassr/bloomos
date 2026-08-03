# Integration UI — v2 Checkpoint 43

## Scope decision: 2 routes, not 6

The checkpoint's own original spec named a 6-route "Connection Center" (`/integrations`, `/integrations/[provider]`, `/integrations/connections`, `/integrations/webhooks`, `/integrations/health`, `/integrations/logs`). A dedicated scope-validation pass (see `docs/v2-checkpoint-43.md`'s classification table) found that Checkpoint 22 already built 4 of those 6 as tabs on the Developer Console (`/developer`'s Integrations + Diagnostics tabs cover connections, webhooks, health, and logs) — building 4 new routes that duplicate an already-working UI would violate this project's own "extend, don't duplicate" discipline. Only `/integrations` (already existed, extended) and `/integrations/[provider]` (genuinely new) were built.

## `/integrations` — extended

`modules/integrations/components/IntegrationsDashboardView.tsx`. Two new sections were added to the existing Checkpoint 22 dashboard, both self-fetching from the same `getIntegrationsDashboardData()` call the page already made (extended, not duplicated — see `docs/integration-health.md`/`docs/integration-analytics.md` for what each section reads):

- **Integration Health** — a `Card` showing `overallScore` and a small grid of the 6 category scores, plus any recommendations.
- **4 new `MetricCard`s** — total syncs, failed syncs, webhook events received, webhook events failed.

The existing Connections table gained one change: each provider name is now a link to `/integrations/{provider_id}`.

## `/integrations/[provider]` — new

`src/app/(app)/integrations/[provider]/page.tsx` + `modules/integrations/components/IntegrationConnectionDetailView.tsx`, backed by `modules/integrations/getIntegrationConnectionDetail.ts`. A read-only per-provider drill-down: provider metadata (category, capabilities, version), then one card per `IntegrationConnection` for that provider (a provider can have more than one connection — nothing enforces uniqueness) showing state, failure/retry counts, sync run count, entity mappings, recent errors, and recent state-transition history. Gated on `integrations.view` (falling back to `workspace.manage` for continuity with the existing dashboard's own gate).

No mutation lives on this page — matching the existing "dashboard = summary, console = action" split this checkpoint's own audit found already established across every other module (Operations, Analytics, Workflow). Connect/disconnect/reconnect stays on `/developer`.

## Not built (see classification table for why)

- `/integrations/connections`, `/integrations/webhooks`, `/integrations/health`, `/integrations/logs` — reclassified "Already covered" (Developer Console tabs) or "Out of scope" (duplicative).
- Any Client Portal-facing integrations surface — the checkpoint's own spec named "Client Portal Integration" but every named integration (payments, calendar, email, signature) already has its own client-facing surface in its owning platform (Invoice Platform's Billing Center for payments, Contract Platform's e-signature flow, etc.); a *generic* "Integrations" tab in the Client Portal would be an internal admin concept leaking into a client-facing surface, which this checkpoint's own Non-Goals list warns against.
