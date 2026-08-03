# Package Versioning

`types/executionPackage.ts`'s `ExecutionVersion`, `lib/data/mock/executionPackagesStore.ts` — v2.0 Checkpoint 27.3, Step 9.

## What it answers

Version History, Version Compare, Version Restore Placeholder, Version Notes, Created By, Created At, Reason. An `ExecutionPackage` is a thin, mutable shell (`metadata`/`context`/`source`/`status`) around `versions: ExecutionVersion[]` — an append-only array. Every version is frozen the moment it's created and never mutated again, only ever added to — the same "immutable, append-only version" discipline `WorkflowVersion` (Checkpoint 12/13) established.

## `ExecutionVersion` shape

```ts
interface ExecutionVersion {
  id: string;
  package_id: string;
  workspace_id: string;
  version_number: number;
  snapshot: ExecutionSnapshot;      // frozen — see snapshot-engine.md
  instructions: ExecutionInstructions;
  attachments: ExecutionAttachment[];
  notes: string | null;             // "Version Notes"
  reason: string | null;            // why this version was created
  created_by: string;
  created_at: string;
}
```

## `createPackage` / `addVersion` — `executionPackagesStore.ts`

`createPackage` creates the package and its first version (`version_number: 1`) atomically. `addVersion` appends the next `version_number`, sets it as `current_version_id`, and resets the package's own `status` back to `"draft"` — a new version needs re-validation and re-approval, the same discipline a structural plan edit resets approval state elsewhere in this codebase. `addVersion` rejects an archived package outright.

## Package Attachments (Step 8) — references only, no uploads

Each `ExecutionAttachment` is one of 9 named types: `operational_plan`, `checklist_template`, `evidence_requirement`, `deliverable`, `customer_note`, and the 4 pure placeholders `maps_placeholder`/`file_placeholder`/`document_placeholder`/`media_placeholder`. The first 4 carry a real `reference_id` (an `OperationalPlan.id`, `ChecklistTemplate.id`, `EvidenceRequirement.id`, `Deliverable.id`); the 4 placeholders always carry `reference_id: null` — they name a future capability, never a real upload. Assembled in `executionPackageActions.ts`'s `buildAttachments`, not in a pure core engine, since it mints fresh `id`s per attachment (the same "id-minting logic lives in the actions layer" boundary `instantiatePlanStructureFromTemplate` established for Operational Planning).

## "Version Restore Placeholder" — a deliberate, disclosed gap

The spec's own Step 9 line names this a **Placeholder**, distinct from "Version History"/"Version Compare" (no such suffix) — an intentional signal that full restore functionality isn't expected. No restore action is wired: unlike a `Workflow`'s mutable draft `graph` (which a real Version Restore copies data back into), an `ExecutionPackage` has no mutable draft to restore *into* — every version is already immutable. Pointing `current_version_id` back at an older entry would be the honest equivalent, but no action does this yet; disclosed here, not silently omitted.

## Consumers

- `executionPackageActions.ts` — `buildExecutionPackageAction` creates the first version; `createExecutionPackageVersionAction` appends subsequent ones.
- `PackageComparisonEngine` — compares two `ExecutionVersion`s by `version_number`.
- `ExecutionPackageDetailView.tsx` — renders the full version history, marking the current version.
