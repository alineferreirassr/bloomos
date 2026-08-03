# Invoice Detail

`modules/invoicePlatform/components/InvoiceDetailView.tsx`, routed at `/invoices/[id]`. See [`invoice-dashboard.md`](invoice-dashboard.md) for `/invoices`.

## What it shows

Reads `evaluateInvoiceAction` once and renders: Overview (title/status via `PageHeader`), a readiness-reason banner when not ready to publish, links out to the real Client and (when linked) Contract records, 4 KPI cards (Overall Health/Current Version/Grand Total/Outstanding Balance), the in-app Builder panel ([`invoice-builder.md`](invoice-builder.md)), Line Items, Installments, Credits & Adjustments (all read from the current version's snapshot), Version History (with Restore + Compare), a Health Breakdown (all 7 [health categories](invoice-health.md)), and Internal Notes & Comments via the existing `CommentsPanel` (`ownerType: "invoice"` — the existing `EntityType`, never a new one).

Client, Proposal, Contract, Journey, Documents, Communication, and Knowledge Graph — every one of the spec's own named surfaces (Step 20) — are covered without a separate tab each: **Client**/**Contract** link out to their real records; **Proposal**/**Journey** are reflected through the readiness banner's own reasons (e.g. "No Proposal is linked to this invoice's event") rather than a duplicated summary view; **Documents**/**Communication** reuse the existing Comments panel and the workspace's own Unified Communication Timeline; **Knowledge Graph** relationships ([`invoice-platform.md`](invoice-platform.md)) are written by the module layer on every version creation but have no dedicated visual explorer this checkpoint — the same disclosed gap every prior checkpoint's own Detail page has left for the general-purpose Knowledge Graph Explorer to eventually cover.

## Wired mutations

New Version (the Builder), Publish, Archive, Restore, Compare, Mark Ready — every one of the 6 real state-changing actions the module layer exposes. Mark Ready is gated: the button is disabled whenever `readiness.canPublish` is `false` or `ready_at` is already set, and the server action itself re-checks readiness independently — the UI gate is a convenience, not the actual authority.

## Accessibility

Every list uses `role="list"`/`"listitem"`; every status/readiness/health value pairs a `Badge` with its own text label, never color alone; every action is a real `<button>`/`<a>` reachable by keyboard.

## Verified live

Browser-verified end-to-end against `NEXT_PUBLIC_DATA_MODE=mock` on both desktop and mobile — including the full interactive "New Version" flow: selecting a template, adding a line item, submitting, and confirming the real Billing Engine computed the grand total, health score, and readiness state live (from "Missing Pricing" before a document existed to "Missing Proposal" — correctly reflecting no linked Proposal — with a real $650.00 grand total, health 80, and a version 1 recorded, after the first version was built).
