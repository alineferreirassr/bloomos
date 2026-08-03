# Contract Builder

`core/contractPlatform/contractBuilderEngine.ts`, `types/contractPlatform.ts` (`ContractBlock`, `ContractSection`, `CreateContractVersionInput`).

## 14 named block types (Step 3)

`heading`, `paragraph`, `rich_text`, `variable`, `clause_block`, `pricing_reference`, `proposal_reference`, `image`, `table`, `attachment_placeholder`, `signature_placeholder`, `initial_placeholder`, `divider`, `custom` — `CONTRACT_BLOCK_TYPES` in `types/contractPlatform.ts`.

A block carries no independent content for the reference types:

- **`clause_block`** carries no text of its own — it marks "render this Clause Library entry here" via `clauseId`, pulling the clause's own `bodyText` rather than storing a second copy.
- **`pricing_reference`** / **`proposal_reference`** mark "render the linked Proposal's own pricing/summary here," pulling from the snapshot's own `pricingReference` rather than duplicating a Proposal's figures.
- **`attachment_placeholder`** marks "list these real Contract Exhibits here" via `attachmentIds` — never a second attachment record.

## 8 section containers

`parties`, `recitals`, `scope_of_services`, `payment_terms`, `term_and_termination`, `clauses`, `signatures`, `custom_section` — `CONTRACT_SECTION_KEYS`. Unlike the Proposal Platform's own named Section Library, Contract sections are plain structural containers a template's `sectionKeys` populates by default; the Clause Library ([`clause-library.md`](clause-library.md)) is this checkpoint's own named library concept.

## Assembling a snapshot

`assembleSnapshot(input: AssembleContractSnapshotInput): ContractSnapshot` — pure, no I/O. Takes an already-resolved `CreateContractVersionInput` (header, sections, clause ids, terms, policies, footer, notes, reason) plus already-resolved `variables: ContractVariable[]` and `pricingReference: ContractPricingReference | null` and `attachmentIds: string[]`, and freezes them into one `ContractSnapshot` by value. The module layer (`contractPlatformActions.ts`) resolves all three real-I/O inputs — the Variable Engine ([`variable-engine.md`](variable-engine.md)), the linked Proposal's pricing, and the real Contract's own Exhibits — and passes them in already-computed; this file only assembles.

## The in-app Builder UI

`ContractDocumentSection.tsx` ([`contract-detail.md`](contract-detail.md)) is a purposefully compact "Start Contract Document" + "New Version" form over the Builder Template Library and the Variable Engine, not a full drag-and-drop block editor. Starting a first draft populates one empty `paragraph` block per section named by the selected template's `sectionKeys`; every field the form submits flows through the same tested `CreateContractVersionInput` a richer editor would use.

Clause selection through the UI is a disclosed, honest gap this checkpoint's first-cut Builder does not cover — a contract's `clauseIds` start empty on a generated first draft, and the Health Engine's own "Missing Clauses" category correctly reports that gap rather than fabricating a resolved clause list. See [`v2-checkpoint-34.md`](v2-checkpoint-34.md).
