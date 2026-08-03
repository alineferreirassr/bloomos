# Contract Dashboard (`/contracts`)

`modules/contracts/components/ContractsListView.tsx` (unmodified this checkpoint).

## Scope decision, disclosed

The existing `/contracts` dashboard (Contracts Foundation phase) already has its own KPI cards (Total Contracts, Signed, Signed Value), filters (status, signature status, template category, date ranges), and a sortable table. This checkpoint's own new "Document" concept ([`contract-platform.md`](contract-platform.md)) is opt-in per contract — many contracts may never have a document started, and the list view's existing filters/KPIs are all about the real Contract's own commercial pipeline, not the new Document layer.

Rather than bolt a Document-status column or KPI onto a page that already carries 13 table columns and 6 filters, this checkpoint left `ContractsListView.tsx` untouched and put every new Document-facing surface on the Detail page instead — see [`contract-detail.md`](contract-detail.md). A future checkpoint that wants Document-readiness visible at the list level (e.g. a "Missing Document" filter, or a KPI card for "Contracts Ready to Publish") can add it additively without this checkpoint pretending to have built it.

`listContractSummariesAction` (`contractPlatformActions.ts`) already computes everything such a future list-level surface would need — `documentStatus`, `readinessState`, `overallHealthScore` — per contract, cached with the same 30s TTL the rest of this checkpoint uses. Wiring it into the Dashboard is a presentation-only change, not a new data path.
