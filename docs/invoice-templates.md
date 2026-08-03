# Invoice Template Library

`lib/data/mock/invoiceTemplatesStore.ts`, `types/invoicePlatform.ts` (`InvoiceTemplate`).

## 10 named templates (Step 2)

`luxury_event`, `proposal_deposit`, `final_balance`, `photography`, `ugc_services`, `digital_products`, `vendor_invoice`, `refund`, `credit_memo`, `custom_template` — `INVOICE_TEMPLATE_KEYS` in `types/invoicePlatform.ts`, seeded system rows in `invoiceTemplatesStore.ts`.

Each template names its own structure surface:

| Surface | Where it lives |
|---|---|
| Header | `structure.header` |
| Default Sections | `structure.defaultSectionTitles` — the section titles a first draft populates |
| Default Payment Schedule | `structure.defaultPaymentScheduleKind` — one of the 6 [Installment Engine](installment-engine.md) kinds this template suggests |
| Footer | `structure.footer` |

Line items, adjustments, and the actual payment schedule amounts are never pre-configured on a template — those are always entered fresh in the [Builder](invoice-builder.md), the same "template shapes the document, never fabricates its figures" discipline every prior checkpoint's own Template Library holds to.

## Repository

`mockInvoiceTemplatesRepository` — `listTemplates(workspaceId, includeArchived?)`, `getTemplateById(id)`, `createCustomTemplate(workspaceId, actor, input)`, `archiveTemplate(id)`. Accessed via `getCoreInvoiceTemplatesService()` (`core/invoicePlatform/index.ts`).
