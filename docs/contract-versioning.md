# Contract Versioning & Comparison

`core/contractPlatform/contractBuilderEngine.ts` (versioning), `core/contractPlatform/contractComparisonEngine.ts`.

## Never overwrite

`ContractBuilderState.versions` is append-only — `appendVersion` (`contractBuilderStore.ts`) always adds a new `ContractVersion` and repoints `current_version_id`, never mutates or removes an existing one. `restoreVersion` only repoints `current_version_id` back at an earlier version; the version list itself is never trimmed or reordered.

## Draft → Review → Published → Archived → Restored → Compared

`CONTRACT_DOCUMENT_STATUSES = ["draft", "review", "published", "archived"]`.

- **First version** always leaves the document in `"draft"` (`nextStatusAfterVersion`).
- **A later version created while already `"published"`** moves the document to `"review"` — a real edit is happening on top of what may already be under review or signature, so it never silently stays `"published"`. The same "never silently overwrite what was already sent" precedent `nextStatusAfterVersion` established for the Proposal Platform (Checkpoint 33).
- **Publish** (`publishContractVersionAction`) sets status to `"published"`.
- **Archive** (`archiveContractDocumentAction`) sets status to `"archived"` and records `archived_at`.
- **Restore** (`restoreContractVersionAction`) repoints to an earlier version and moves status back to `"review"`.
- **Compare** (`compareContractVersionsAction`) is read-only — no status change.

## `ready_at`

Set the first time [Readiness](contract-health.md) reaches `"ready"` (`markContractReadyAction` → `mockContractBuilderRepository.markReady`) — idempotent, never cleared or overwritten once set, even if a later edit regresses readiness. Powers the "Ready" Timeline event and the Analytics "Time To Ready" metric.

## 10 named Timeline events (Step 10)

`contract_created`/`contract_updated`/`contract_archived`/`contract_restored` **already exist** — real, wired events fired by the pre-existing `createContract`/`updateContract`/`archiveContract`/`restoreContract` (Contracts Foundation phase). Adding a second pair for this checkpoint's own Document layer would be a fabricated duplicate, not a reused fact, so the spec's own "Contract Created"/"Contract Updated" names are disclosed as already-covered rather than duplicated.

The 8 genuinely new events, deliberately disambiguated with a `contract_document_*` prefix (or otherwise distinct names) so they never collide with the 4 real events above:

| Event | Fires when |
|---|---|
| `contract_document_version_created` | Every `createContractVersionAction` call |
| `contract_document_published` | `publishContractVersionAction` |
| `contract_document_archived` | `archiveContractDocumentAction` |
| `contract_document_restored` | `restoreContractVersionAction` |
| `contract_document_compared` | `compareContractVersionsAction` |
| `contract_document_ready` | `markContractReadyAction`, only the first time `ready_at` is set |
| `contract_linked_to_proposal` | The first version, if a Proposal is resolvable for the event |
| `contract_linked_to_journey` | The first version, if a Client Journey is resolvable for the client |

## 7 named diff categories (Step 7)

`clauses`, `variables`, `pricing_references`, `sections`, `attachments`, `terms`, `policies` — `CONTRACT_DIFF_CATEGORIES`. `compareContractVersions(versionA, versionB)` diffs clause/attachment id sets, variable values, the 4 named pricing fields (Grand Total, Deposit Due, Remaining Balance, Linked Proposal), section presence, and plain text (terms/policies), returning a flat `ContractDiffEntry[]` plus a `hasChanges` boolean.
