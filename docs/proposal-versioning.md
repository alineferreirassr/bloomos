# Proposal Versioning

`types/proposalPlatform.ts` (`ProposalVersion`/`ProposalSnapshot`/`ProposalBuilderState`), `core/proposalPlatform/proposalBuilderEngine.ts`, `lib/data/mock/proposalBuilderStore.ts`.

## Never overwrite previous versions

The exact `ExecutionPackage`/`ExecutionVersion` discipline (Checkpoint 27.3): `ProposalBuilderState.versions` is append-only — `appendVersion` always adds, never mutates or removes, an existing entry. `current_version_id` simply points at whichever version is "live"; `restoreVersion` repoints it at an earlier entry without ever trimming or reordering the array.

## Draft / Revision / Published / Archived — `ProposalDocumentStatus`

| Status | Meaning |
|---|---|
| `draft` | The document's first version, not yet published. |
| `revision` | A new version was created on top of an already-published document — the previously-published version stays intact until the next Publish. |
| `published` | The current version is ready to send/has been sent. |
| `archived` | The document is retired. |

`nextStatusAfterVersion(currentStatus, isFirstVersion)` is the one rule: a first version always lands in `draft`; any later version created while `published` moves to `revision` — a real edit is happening on top of what the client may already have seen, so the document never silently stays `published` behind an unreviewed change.

## Restored — implemented, unlike Execution Package's own disclosed gap

Execution Package (Checkpoint 27.3) deliberately left "Restore" unwired, disclosing that packages have no mutable draft to restore into. Proposals are simpler — restoring here is exactly "point `current_version_id` back at an earlier entry" (`restoreVersion`), which this checkpoint does implement, moving the document to `revision` (a restored older version is itself a kind of edit relative to whatever was last published).

## Compared — the Comparison Engine

`core/proposalPlatform/proposalComparisonEngine.ts`'s `compareProposalVersions(versionA, versionB)` is a pure structural diff over two already-frozen `ProposalSnapshot`s — pricing, sections, packages, add-ons, variables, terms, policies, and images, the 8 named diff categories. It never recalculates anything; every value it compares was already computed at snapshot time.

## Version History — the Timeline

Every version creation records `proposal_version_created`; Publish/Archive/Restore/Compare each record their own named event (`proposal_document_published`/`archived`/`restored`/`compared`) via the existing Timeline (`recordTimelineActivity`, owner `"proposal"`). "Proposal Updated" (also named in the spec) is deliberately **not** a separate event — every edit becomes a new immutable version, so `proposal_version_created` already covers it; a second event for the same action would be a fabricated duplicate.
