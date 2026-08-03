# Contract Management Platform

`types/contractPlatform.ts`, `core/contractPlatform/`, `modules/contractPlatform/contractPlatformActions.ts`.

## The core discipline: reuse the real `Contract`, never replace it

`Contract` (`types/contract.ts`) and `ContractExhibit` (`types/contractExhibit.ts`) are already real, Supabase-backed entities with their own migrations, repositories, and UI — the whole commercial/e-signature lifecycle (`status`/`signature_status`, `sendContract`/`markViewed`/`markSigned`/etc. in `modules/contracts/`) stays exactly as it was. Nothing in this checkpoint duplicates it.

Every new type this checkpoint introduces attaches to an existing `Contract.id` as an **additive layer**: the human-curated document (builder template, sections, clauses, variables, pricing reference, terms, policies) that gets built, versioned, compared, and prepared — never the real contract record, and never electronic signing. `ContractExhibit` is reused directly wherever the spec says "Attachments" — a `ContractSnapshot` only ever freezes a `ContractExhibit.id[]` reference list, never a second attachment record.

## Core principle, honored literally

This is **not** an electronic signature platform, not an email platform, not a PDF generator. It prepares and manages contracts only. E-signing, PDF export, and automatic email are all deferred to a future External Integrations phase — see [Known limitations](v2-checkpoint-34.md).

## Storage split — only 3 new persisted entities

Mirroring the "persist only what cannot be re-derived" discipline every prior checkpoint has followed:

| Entity | Store | Why persisted |
|---|---|---|
| `ContractBuilderTemplate` | `contractBuilderTemplatesStore.ts` | A reusable library — 11 system templates ship pre-seeded, workspaces may add custom ones. |
| `ContractClause` | `contractClausesStore.ts` | A reusable library — 14 system clauses ship pre-seeded. |
| `ContractBuilderState` | `contractBuilderStore.ts` | The mutable shell around append-only `ContractVersion` history — the one genuinely new per-contract record. |

Everything else — `ContractSnapshot`, `ContractHealth`, `ContractReadinessResult`, `ContractAnalyticsSnapshot`, `ContractComparisonResult`, `ContractSummary`, `ContractDetail` — is computed fresh on every read by a pure engine, never stored redundantly.

## Why `ContractTemplate` is not reused

`ContractTemplate` (`types/contractTemplate.ts`) already exists — a real, workspace-scoped, but deliberately minimal entity: a flat `body` string with literal `{{merge_field}}` placeholders, read-only (its own migration seeds zero rows and grants no insert/update/delete), with no renderer anywhere. It is not reused as this checkpoint's own Template Library because the spec wants a genuinely richer, structured concept (sections/clauses/variables/attachments/optional-clauses/signature-placeholders) that flat text can't represent, and because writing to the real `contract_templates` table would mean a new Supabase migration — a materially bigger, riskier change than anything else this checkpoint needs. `ContractBuilderTemplate` is therefore a new, additive, mock-only type, deliberately named to never collide with the real `ContractTemplate` — the real one keeps its own job (category tagging, already wired into `ContractForm.tsx`/`ContractDetailView.tsx`); the new one is the Builder's own library.

## The `ContractBuilderState`/`ContractVersion`/`ContractSnapshot` shape

Mirrors `ExecutionPackage`/`ExecutionVersion`/`ExecutionSnapshot` (Checkpoint 27.3) and `ProposalBuilderState`/`ProposalVersion`/`ProposalSnapshot` (Checkpoint 33) exactly: a mutable shell (`ContractBuilderState`) holds `current_version_id` and an append-only `versions: ContractVersion[]` array; each `ContractVersion` freezes a `ContractSnapshot` by value (header, sections, clause ids, resolved variables, pricing reference, attachment ids, terms, policies, footer) — never a live reference. See [`contract-versioning.md`](contract-versioning.md).

`ContractBuilderState` is deliberately labeled "Document" everywhere in the UI ("Publish Document", "Archive Document") to avoid colliding with the real Contract's own status machine and its existing Archive/Restore actions in `ContractActions.tsx`.

## Module map

| Module | Responsibility |
|---|---|
| `core/contractPlatform/variableEngine.ts` | Step 5 — [`variable-engine.md`](variable-engine.md) |
| `core/contractPlatform/contractBuilderEngine.ts` | Steps 3, 6 — snapshot assembly + versioning — [`contract-builder.md`](contract-builder.md), [`contract-versioning.md`](contract-versioning.md) |
| `core/contractPlatform/contractComparisonEngine.ts` | Step 7 — 7-category structural diff |
| `core/contractPlatform/contractHealthEngine.ts` | Step 8 — [`contract-health.md`](contract-health.md) |
| `core/contractPlatform/contractReadinessEngine.ts` | Step 9 — Can Publish / Cannot Publish |
| `core/contractPlatform/contractAnalyticsEngine.ts` | Step 11 — [`contract-analytics.md`](contract-analytics.md) |
| `core/contractPlatform/contractKnowledgeGraphEngine.ts` | Step 14 — Knowledge Graph edge builders |
| `core/contractPlatform/contractExecutiveIntegration.ts` | Step 15 — translation to `OperationalRecommendation[]` |
| `core/contractPlatform/contractCache.ts` | Performance — 30s TTL cache |
| `modules/contractPlatform/contractPlatformActions.ts` | The module layer — every server action, session-gated |
| `modules/clientPortal/getClientPortalContract.ts` | Step 12 — Client Portal integration |
| `modules/contracts/components/ContractDocumentSection.tsx` | Steps 17-18 — additive Detail-view section |

## Reuse, honored exactly as the stop condition requires

- **The Contract entity itself** — `Contract`/`ContractExhibit` are untouched as types and as tables; every real action (`createContract`, `sendContract`, `markSigned`, etc.) keeps working exactly as before.
- **CRM/Client/Event** — read straight from the existing `Contract.client_id`/`event_id`; `getClientById`/`getEventById` resolve the real records for variable resolution and readiness/health checks.
- **Proposal** — no direct FK exists between `Contract` and the Proposal Platform (Checkpoint 33), so the link is resolved indirectly via the shared `event_id` (`getLatestProposalForEvent`). The Proposal Platform's own already-computed pricing (`ProposalBuilderState.currentVersion.snapshot.pricing`) is reused as-is for `ContractPricingReference`, never re-derived.
- **Client Journey** — `hasLinkedJourney` calls the existing `evaluateClientJourneyAction`, degrading to "not applicable" on any failure rather than failing Contract evaluation itself; `contract_related_journey` is disclosed reserved Knowledge Graph vocabulary (the Journey has no node identity of its own).
- **Knowledge Graph** — 5 of 8 named relationship types are live edges (`contract_uses_template`, `contract_contains_clause`, `contract_related_proposal`, `contract_related_client`, `contract_related_document`); `contract_version_of`/`contract_supersedes`/`contract_related_journey` are disclosed reserved vocabulary since `Contract` has no second-row version chain the way `ProposalDraft` does.
- **Executive Decisions** — `contractRecommendationsForExecutiveDecisions()` is one more `recommendationSources` entry, the exact seam Checkpoint 33 established — 6 named recommendation rules, including the cross-workspace "Proposal Missing Contract" check.
- **Timeline** — reused directly via `recordTimelineActivity`; see [`contract-versioning.md`](contract-versioning.md)'s Timeline section for the exact new/reused event split.
- **Comments/Notes/Search** — the existing `"contract"` `EntityType` is reused directly; no new EntityType was needed since `Contract` is already a real persisted row.
- **No AI, no PDF, no e-signature, no real payment provider anywhere.** The Variable Engine is deterministic `{{key}}` substitution over real records only, never invented text.

## Known limitations

See [`v2-checkpoint-34.md`](v2-checkpoint-34.md).
