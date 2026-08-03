# Document Center

`ClientPortalDocumentsListView.tsx`, at `/client-access/documents`. Reads `getClientPortalDocuments()` (Checkpoint 14) — no new document store.

## Two honest views of the same set, not a duplicate render

The page composes two sections over the identical document list:

- **Recent Documents** — the 5 most-recently-uploaded documents, the same "soonest/latest first, distinct from the full list" pattern `ClientPortalInvoicesListView.tsx`'s own Upcoming Payments section established.
- **Folders** — every document already carries a real `category` (the Document Platform's own domain field, Checkpoint 25); grouping by it is the honest reuse seam rather than inventing a new folder hierarchy or storage concept. A document that's both recent and in a category appears in both sections — two different lenses on one list, not two copies of the data.

## Named component

`DocumentRow` is the one shared row renderer both sections use — title, size (`formatBytes`), version suffix, expiry date, and a `DocumentCategoryBadge` — so a future third view (e.g., a search result) reuses the same row rather than a new one.

## What's out of scope

No upload, no delete, no version history browsing beyond what the existing Document detail page already offers, and no approve/reject UI beyond the Checkpoint 14 placeholder already in `ClientPortalDocumentDetailView.tsx`.
