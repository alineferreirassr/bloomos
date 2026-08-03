# Proposal & Quote Platform

`types/proposalPlatform.ts`, `core/proposalPlatform/`, `modules/proposalPlatform/proposalPlatformActions.ts`.

## The core discipline: reuse `ProposalDraft`, never replace it

`ProposalDraft` (`types/proposal.ts`, Checkpoint 3) stays the single source of truth for AI-generated proposal content and its own `draft`/`accepted`/`rejected`/`superseded` lifecycle — nothing in this checkpoint duplicates it. Every new type this checkpoint introduces attaches to an existing `ProposalDraft.id` as an **additive layer**: the human-curated document (template, sections, blocks, packages, add-ons, pricing, versions, distribution state) that gets built, versioned, compared, and sent — the presentation and commercial-preparation layer around the AI's own content, never a second proposal.

`Proposal` in this checkpoint's own domain vocabulary is simply `ProposalDraft`, re-exported (`export type { ProposalDraft as Proposal }`).

## Storage split — only 4 new persisted entities

Mirroring the "persist only what cannot be re-derived" discipline every prior checkpoint has followed:

| Entity | Store | Why persisted |
|---|---|---|
| `ProposalTemplate` | `proposalTemplatesStore.ts` | A reusable library — 8 system templates ship pre-seeded, workspaces may add custom ones. |
| `ProposalPackage` | `proposalPackagesStore.ts` | A reusable library — 7 system packages ship pre-seeded. |
| `ProposalAddon` | `proposalAddonsStore.ts` | A reusable library — 10 system add-ons ship pre-seeded. |
| `ProposalBuilderState` | `proposalBuilderStore.ts` | The mutable shell around append-only `ProposalVersion` history — the one genuinely new per-proposal record. |

Everything else — `ProposalSnapshot`, `ProposalPricing`, `ProposalHealth`, `ProposalReadiness`, `ProposalAnalyticsSnapshot`, `ProposalComparisonResult`, `ProposalSummary`, `ProposalDetail` — is computed fresh on every read by a pure engine, never stored redundantly.

## The `ProposalBuilderState`/`ProposalVersion`/`ProposalSnapshot` shape

Mirrors `ExecutionPackage`/`ExecutionVersion`/`ExecutionSnapshot` (Checkpoint 27.3) exactly: a mutable shell (`ProposalBuilderState`) holds `current_version_id` and an append-only `versions: ProposalVersion[]` array; each `ProposalVersion` freezes a `ProposalSnapshot` by value (header, hero, sections, packages, add-ons, variables, computed pricing, terms, policies, footer) — never a live reference. See [`journey-versioning.md`](journey-transitions.md) precedent and [`proposal-versioning.md`](proposal-versioning.md) for the full detail.

`ProposalBuilderState` is a **new, additive shell distinct from `ProposalDraft`** — keyed by `proposal_id`, it never mutates the existing AI-generation entity or its ~15 existing call sites.

## Module map

| Module | Responsibility |
|---|---|
| `core/proposalPlatform/pricingEngine.ts` | Step 5 — [`pricing-engine.md`](pricing-engine.md) |
| `core/proposalPlatform/proposalBuilderEngine.ts` | Steps 3, 8 — snapshot assembly + versioning — [`proposal-builder.md`](proposal-builder.md), [`proposal-versioning.md`](proposal-versioning.md) |
| `core/proposalPlatform/proposalComparisonEngine.ts` | Step 9 — version diffing |
| `core/proposalPlatform/proposalHealthEngine.ts` | Step 10 — [`proposal-health.md`](proposal-health.md) |
| `core/proposalPlatform/proposalReadinessEngine.ts` | Step 11 — Can Send / Cannot Send |
| `core/proposalPlatform/proposalAnalyticsEngine.ts` | Step 13 — [`proposal-analytics.md`](proposal-analytics.md) |
| `core/proposalPlatform/proposalKnowledgeGraphEngine.ts` | Step 15 — Knowledge Graph edge builders |
| `core/proposalPlatform/proposalExecutiveIntegration.ts` | Step 16 — translation to `OperationalRecommendation[]` |
| `core/proposalPlatform/proposalCache.ts` | Step 28-equivalent performance — 30s TTL cache |
| `modules/proposalPlatform/proposalPlatformActions.ts` | The module layer — every server action, session-gated |
| `modules/clientPortal/getClientPortalProposal.ts` | Step 14 — Client Portal integration |
| `modules/proposalPlatform/components/` | Steps 18-19 — Dashboard, Detail, Client Portal card |

## Reuse, honored exactly as the stop condition requires

- **CRM/Client/Event/Journey** — a proposal's `client_id`/`event_id` are read straight from the existing `ProposalDraft`; `journey_readiness_score` (an optional Health input) is accepted from a caller-supplied Client Journey score, never recalculated here.
- **Knowledge Graph** — reused directly (`proposal_uses_template`/`proposal_contains_package`/`proposal_contains_addon`/`proposal_related_document`/`proposal_related_client`/`proposal_version_of`/`proposal_supersedes` are the 7 live edges; `proposal_related_journey` is disclosed reserved vocabulary, since the Journey has no node identity of its own).
- **Executive Decisions** — `proposalRecommendationsForExecutiveDecisions()` is registered as one more `recommendationSources` entry, the exact `client_journey_engine` seam Checkpoint 32 established.
- **Timeline** — reused directly via `recordTimelineActivity`; see [`proposal-versioning.md`](proposal-versioning.md)'s Timeline section for the exact new/reused event split.
- **Comments/Notes** — the existing `"proposal"` `EntityType` (Checkpoint 3) is reused as-is; no new EntityType was needed since `ProposalDraft` is already a real, persisted row.
- **No AI, no PDF, no e-signature, no real payment provider anywhere.** The Pricing Engine is plain arithmetic; "Send" only flips a status and records a Timeline event; the Client Portal's Accept/Decline are disclosed, non-binding intent only (see [`proposal-client-portal.md`](proposal-client-portal.md)).

## Known limitations

1. No live authenticated browser verification this checkpoint either — `NEXT_PUBLIC_DATA_MODE=mock` still gates behind a real sign-in this session has no credentials for. Verified via 8 component tests plus a successful `next build`.
2. "Top Packages"/"Top Add-ons" on the Dashboard display raw ids rather than resolved names — the Dashboard doesn't currently fetch the full package/add-on library just to label a usage count; a small, disclosed gap rather than a fabricated label.
3. The in-app Builder (Step 3/19) is a purposefully compact form over the Template/Package/Add-on libraries and Pricing Engine, not a full drag-and-drop canvas — every field it submits flows through the same `CreateProposalVersionInput` the engines were built and tested against.
