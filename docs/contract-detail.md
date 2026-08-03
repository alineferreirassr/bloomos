# Contract Detail (`/contracts/[id]`)

`modules/contracts/components/ContractDetailView.tsx` (additive), `modules/contracts/components/ContractDocumentSection.tsx` (new).

## Additive, never a replacement

`ContractDetailView.tsx`'s existing cards (Commercial Summary, Client, Event, Dates, Financial Terms, Template, the real `VersionHistorySection`, Exhibits, Notes, Finance, Documents, Timeline, and the pre-existing "Future Integrations" disclosure card) are all untouched. One new card, `ContractDocumentSection`, was inserted between the real "Template" card and the real `VersionHistorySection` — clearly scoped to this checkpoint's own Document layer, never confused with the real Contract's own shallow `version`/`version_history` fields shown just above it.

## What the card shows

Fetches `evaluateContractAction(contractId)` client-side on mount:

- **No document yet** — a template picker (`listContractBuilderTemplatesAction`) plus "Generate First Draft," gated behind `contract_builder.manage`. Generating a first draft populates one section per the selected template's `sectionKeys` (each with a single empty `paragraph` block) and no clauses — the Health Engine's own "Missing Clauses" category correctly reports that gap rather than fabricating a resolved clause list.
- **A document exists**:
  - Document status badge (draft/review/published/archived)
  - Health: overall score progress bar + the 7 named categories ([`contract-health.md`](contract-health.md))
  - Readiness: state badge + reasons, with Publish/Mark Ready/Archive buttons gated by `canPublish`/`readiness.state`/`canManage`
  - Version History: version list with per-version Restore, plus a two-select Compare tool showing the diff inline
  - A "New Version" form — Terms/Policies/Notes text areas that reuse the current version's sections/clauses/header/footer, submitted through the same `createContractVersionAction` the first-draft flow uses

## Permission gating

`contract_builder.manage` gates every write action (Generate First Draft, Publish, Mark Ready, Archive, Restore, Save New Version); Compare is read-only and available to anyone who can view the page. Matches the [permissions](#) split `permission.ts`/`permissionMatrix.ts` define for this checkpoint.

## Browser-verified

Desktop and mobile viewports both confirmed live: selecting a template and generating a first draft correctly produces a `draft`-status document with an accurate Health breakdown (Missing Proposal correctly gates Publish since no Proposal Platform draft exists yet for the demo event), and the mobile layout stacks cleanly with no overflow.
