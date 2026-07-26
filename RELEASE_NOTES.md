# BloomOS v1.0.0 Release Notes

Released 2026-07-26. This is BloomOS's first tagged release — see `CHANGELOG.md` for the full history and `docs/*.md` for module-level detail.

## What's in v1.0.0

The complete operational lifecycle for a luxury proposal/event studio, live end-to-end on a connected Supabase project:

- **Core CRM**: Leads, Clients, Events, Contracts, Finance (invoices/payments/expenses/journal/reports), Documents.
- **Team & access**: internal Team membership with role-based permissions, a separate external Client Portal (accounts, invitations, Overview/Events/Contracts/Invoices/Documents) with its own client-safe data projections and RLS policies.
- **Operational depth**: Inventory, Vendors, Purchases (with an atomic receiving RPC), Finance Reports (General Ledger, Trial Balance, Profit & Loss, Balance Sheet), a Commercial Pipeline (Kanban over Lead status).
- **Services**: a full reusable Service/ServiceVersion catalog, 16 normalized Template categories, per-Event Service Assignment with a dedicated Workspace (checklist execution, team/inventory fulfillment, notes/timeline/attachments).
- **Bloom AI**: the Event Operations Brief — an on-demand, deterministic-facts-plus-model-narrative operational summary for one Event, provider-agnostic by design (ships with a mock provider; registering a real `AIProvider` is the only step needed to go live).
- **Cross-module polish**: Client↔Event/Finance summaries, Event↔Contract/Services summaries, a shared checkbox/dialog/table component library, and a Release Candidate hardening pass (Checkpoint 12) covering security, performance, accessibility, and error recovery.

Full production readiness evidence — automated test coverage per critical business-flow transition, security/permission audit, quality-gate results — is in the Checkpoint 12 and Checkpoint 13 certification reports (this conversation's history; not duplicated here).

## Upgrade Notes

There is no prior tagged release to upgrade from — this is the baseline. For any future v1.x release, upgrade notes will describe schema migrations to apply (`npx supabase db push`) and any breaking API/type changes; none apply here.

## Deployment Notes

- **Environment variables** (see `.env.example`): `NEXT_PUBLIC_DATA_MODE` (`mock` or `supabase`), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. No service-role key, database password, or other secret is used anywhere in the application — RLS is the actual security boundary.
- **Database**: all 154+ migrations are live on the connected Supabase project (`npx supabase migration list` shows zero mismatches as of this release). RLS is enabled on every table; every policy is scoped `to authenticated` and workspace-isolated.
- **Build**: standard Next.js build (`npm run build`) / start (`npm run start`). No custom server, no Dockerfile, no `vercel.json` required — this is a zero-config Next.js App Router deployment.
- **Not included** (see Known Limitations): no CI pipeline config, no error-reporting/monitoring SDK, no `/api/health` endpoint. Quality gates (`npm run test:ci`) must currently be run manually before any deploy.
- **Storage**: the `media-assets` Supabase Storage bucket (private, path-scoped policies) backs every file upload across Documents/Events/Services/etc. The legacy `documents` bucket was retired during the Documents migration and is not in use.

## Known Limitations

None of the following block this release; each is classified per the Checkpoint 12 certification report and re-confirmed in Checkpoint 13's final audit.

**Accepted v1.0 risk** (real, tracked, not blocking a first trusted-team deploy):
- Inventory, Vendors, Purchases, and Services have no granular permission of their own — any active Workspace member can edit them regardless of role.
- No error-reporting/monitoring SDK, no `/api/health` endpoint, no CI pipeline config committed.
- Service Version immutability and the `accounting_periods` closed-period lock are enforced in application code, not a database trigger; a handful of secondary indexes flagged by the Checkpoint 12 database review are not yet added.
- Event/Contract status are not automatically linked, and nothing enforces cross-entity consistency when an Event is marked complete (e.g. its Contract/Services/Checklist could theoretically still be in progress) — today this relies on staff judgment, not a system rule.
- Bloom AI ships with only an Event-scoped context builder; Client/Finance/Service/Blueprint contexts, the "Operational Graph," retry-with-backoff, multi-provider fallback, and an AI tool registry are all real architectural gaps relative to a fully mature AI layer, but each is additive to the existing `AIProvider` interface, not a rearchitecture, and each is explicitly named in `docs/ai.md` as deferred.

**Post-v1.0 improvement** (non-blocking, lower priority):
- Several large list views load their full result set client-side rather than paging server-side; a few list/summary loaders fetch related records per-row instead of in one batched query.
- Most forms don't wire `aria-describedby` from field to error/help text; most authenticated pages don't render a real `<h1>`; a couple of touch targets fall under the 24px minimum.
- No automated email/SMS delivery for Workspace/Client invitations (the provider registry is real and ready; no adapter is registered, so invitations are shared as a direct link today).

## Post-v1.0 Roadmap

See `ROADMAP.md`'s Phase 3 (Client Portal payment/e-signature/document-upload, Bloom AI expansion, Automations, Email Center, Notifications) and Phase 4 (Analytics, Knowledge Base, Global Search, Multi-Workspace activation) for the full forward roadmap. No roadmap item is implemented as part of this release — per this checkpoint's explicit scope, v1.0.0 finalizes what already exists rather than adding to it.
