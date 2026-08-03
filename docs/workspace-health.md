# Workspace Health

`core/workspace/workspaceHealthEngine.ts` — a composite over seven platform-level scores, every one either a direct reuse of another platform's own already-computed health output or a plain average of a per-record array of those same reused scores. This engine never recalculates any platform's own internal health formula, matching the exact discipline `operationsCenterHealthEngine.ts` (Checkpoint 31) already established for its own 10-component composite.

## The seven components

| Key | Label | Source | Native or proxy |
|---|---|---|---|
| `operational` | Operational Health | `evaluateOperationsCenterAction()`'s `overallOperationsCenterHealth` | Native — itself already composes Dispatch, Field Operations, Route Optimization, Scheduling, Resource Allocation, Execution Packages, Workforce, Business Health, Knowledge, and Objectives |
| `assets` | Digital Asset Health | `evaluatePlatformAction()`'s `PlatformHealthSummary.averageScore`/`.band` | Native — direct passthrough |
| `proposals` | Proposal Health | `listProposalSummariesAction()`, averaging every `overallHealthScore` | Native per-entity, averaged here |
| `contracts` | Contract Health | `listContractSummariesAction()`, averaging every `overallHealthScore` | Native per-entity, averaged here |
| `invoices` | Invoice Health | `listInvoiceSummariesAction()`, averaging every `overallHealthScore` | Native per-entity, averaged here |
| `journeys` | Client Journey Health | `listClientJourneysAction()`, averaging every `overallHealth` | Native per-entity, averaged here |
| `capability` | Workforce Capability Health | `evaluateWorkforceCapabilityCoverageAction()`'s `uncoveredRequirementIds.length`/`highRiskGapsCount` | **Proxy** — disclosed via `isProxy: true` |

A component is omitted from the platform list entirely (not shown as zero) when its input array is empty — e.g. a workspace with zero proposals shows no Proposal Health entry rather than a misleading 0.

## Why Capability is a disclosed proxy

`CapabilityCoverageReport` exposes no single 0–100 score — only per-category coverage ratios and `highRiskGapsCount`/`uncoveredRequirementIds`. The proxy formula — `100 - uncoveredCount * 5 - highRiskGaps * 10`, floored at 0 — mirrors the exact normalization `operationsCenterHealthEngine.ts` already applies to Resource Allocation's own finding counts (`100 - highCount*10 - mediumCount*5`). Same precedent, same discipline, applied to a different platform's own gap.

## Bands

90+ excellent, 70+ good, 40+ attention, below critical — the same threshold convention `healthEngine.ts` (Checkpoint 37, Digital Assets) already established, so a "good" score means the same thing everywhere in BloomOS.

## Named functions

| Function | Purpose |
|---|---|
| `aggregateWorkspaceHealth(workspaceId, input, evaluatedAt)` | Builds the full `WorkspaceHealthSummary` from seven pre-fetched score inputs |
| `bandForScore(score)` | Score → band, using the shared 90/70/40 thresholds |
