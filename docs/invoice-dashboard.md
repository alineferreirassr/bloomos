# Invoice Dashboard

`modules/invoicePlatform/components/InvoiceDashboardView.tsx`, routed at `/invoices`. See [`invoice-detail.md`](invoice-detail.md) for `/invoices/[id]`.

## A genuinely new route, unlike Contract

Unlike Contract Platform (Checkpoint 34), which extended an already-existing `/contracts` dashboard, no `/invoices` route existed before this checkpoint — the real Finance module's own Invoice UI lives at `/finance/invoices`. This checkpoint builds `/invoices`/`/invoices/[id]` as genuinely new, Document-focused routes, the same precedent `/proposals` established in Checkpoint 33 — composing but never duplicating the real Finance module's own invoice list.

## What it shows

Reads `listInvoiceSummariesAction()` and `getInvoiceAnalyticsAction()` once and renders: 5 KPI cards (Drafts/In Review/Published/Archived/Outstanding Balance), 3 metric cards (Average Invoice/Deposit/Balance, Average Discount/Credit, Average Installments), 2 "Top" cards (Templates by usage count, Readiness distribution), a Status filter (Draft/In Review/Published/Archived), the filtered invoice list, and a Recent Activity list sorted by `updatedAt`.

"Top Templates" is grouped client-side from the summaries list — this checkpoint's own `InvoiceAnalyticsSnapshot` has no `templateUsage` field, since the spec's own 7 named Analytics metrics ([`invoice-analytics.md`](invoice-analytics.md)) don't include one, unlike Contract/Proposal's own analytics snapshots.

## Accessibility

Every list uses `role="list"`/`"listitem"`; every status/readiness value pairs a `Badge` with its own text label, never color alone.

## Verified live

Browser-verified end-to-end against `NEXT_PUBLIC_DATA_MODE=mock` on both desktop (1440×900) and mobile (375×812) — KPI cards, stat cards, Top Templates, Readiness distribution, the status filter, and the invoice list all confirmed rendering real, live-computed data.
