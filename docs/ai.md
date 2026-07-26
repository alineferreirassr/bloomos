# AI — "Bloom AI"

**Status: operational intelligence layer, v2.** The Event Operations Brief (below) is Bloom AI's first production feature, now expanded from a single summary into a full operational briefing — explanations, risk detection, and a confidence score — plus the architecture for a future workspace-wide Daily Operations Brief. Everything else in this document's "Anticipated capabilities" list remains undesigned and unbuilt — this is still a narrow, Events-scoped step, not a general assistant.

## Vision

Bloom AI is an assistant embedded in BloomOS that helps the team run the business faster and with fewer mistakes — grounded in the same lifecycle and data every other module uses (`BLOOMOS_BIBLE.md`, `docs/workflows.md`). It is not a chatbot bolted on for novelty; it must clear the same bar as any other feature: save time, reduce mistakes, improve the client experience, or increase operational efficiency.

## Shipped: Event Operations Brief

An on-demand, internal-only operational briefing for one Event, generated from `src/modules/ai/`:

- **Where**: an "AI Operations Brief" section embedded in Event Detail (`/events/[id]`) — not a standalone chat page. Reuses the page's existing `events.view` RouteGuard; no new permission was introduced.
- **Architecture**: `EventOperationsBriefSection` (Client Component) → `generateEventOperationsBrief` (a `"use server"` Server Action — the only place a provider is ever called) → `core/ai`'s pre-existing `AIProvider` interface/registry. The Server Action re-resolves the caller's session and `events.view` permission itself and re-fetches the Event server-side (`fetchEventContext.server.ts`) — it never trusts a client-supplied Workspace, permission, or Event payload.
- **Facts vs. narrative**: every fact (status, lifecycle stage, Health Score + its top contributing factors, checklist/schedule summary, missing information, detected operational risks, confidence score) is computed deterministically by existing Events/`core/workflows` code plus `riskEngine.ts`/`confidence.ts`, never by the model. The model (or the deterministic mock provider) only supplies an `executiveSummary`, a `healthExplanation` of the *existing* score, an explanation for each already-detected risk, and `recommendedActions` — each with a mandatory `reason` and an optional `actionTargetType` — validated against a Zod schema, then semantically cross-checked in `assembleBrief.ts` (an invented risk `kind` or a real risk the model skipped are both handled safely — see "Risk engine" and "Explain why" below) before ever reaching the UI.
- **Health Score explanation, never a second score**: `riskEngine.ts`/the context builder never recompute Health — they read `core/workflows/eventHealth.ts`'s existing `score`/`status`/factors and hand them to the model purely to narrate ("why is this score what it is"), with an explicit system-prompt instruction not to calculate, restate, or imply a different one.
- **Risk engine** (`riskEngine.ts`): a small, explicitly extensible list of pure detector functions (overdue checklist, delayed schedule, missing owner, incomplete information, approaching date without readiness) — each reusing a signal Events already computes, never a new fact. Inventory/Purchases/Finance detectors have an obvious extension point (append to `RISK_DETECTORS`) once Events gains a real relationship to those modules; none does today, so none are implemented.
- **Confidence score** (`confidence.ts`): derived purely from which of 7 context fields are present (client, date, location, budget, owner, checklist, schedule) — never from the model's own self-reported confidence.
- **Actionable output** (`actionTargets.ts`): a recommendation's `actionTargetType` is a closed enum (`"checklist" | "schedule" | "event" | null`) the model chooses from; the actual `href` is resolved deterministically in code to one of three fixed, real BloomOS routes — the model can never supply or influence a URL directly.
- **Mock mode**: no AI provider is registered yet (`isAIConfigured()` is `false`), so `generateEventOperationsBrief` falls back to a deterministic mock provider (`src/modules/ai/mockProvider.ts`) that reflects the real Event's current data. The UI clearly labels mock output as "Development mock — not a real AI call." To go live, register a real `AIProvider` (Anthropic/Claude per `docs/integrations.md`) via `registerAIProvider()`; no other code changes.
- **Versioning metadata, not persistence**: every generated brief carries `promptVersion`, `contextVersion`, `provider`, `model`, and `sourceEventUpdatedAt` (the Event's `updated_at` at generation time) — output itself stays ephemeral (nothing is written to the database), but a future persistence phase could add a `brief_generations` table with exactly these columns to compare versions over time, without reshaping this result.
- **Feedback-ready, not yet wired**: every recommendation carries a stable, code-assigned `id` (`RecommendedAction.id`), and `AIRecommendationFeedback`/`AIRecommendationFeedbackRating` types exist in `modules/ai/types.ts` purely as the future interface a 👍/👎 UI and its storage would implement — no repository, no migration, no UI control exists yet.

## Architecture for a future Daily Operations Brief

`src/modules/ai/dailyBrief/` — a parallel, equally server-only pipeline (context builder → prompt builder → mock provider → `"use server"` generate action) for a workspace-wide daily briefing, **not wired to any route or UI yet**. It aggregates already-built per-Event `EventOperationsBriefContext` objects (via `fetchDailyOperationsBriefContext.server.ts`, which loops `fetchEventContext.server.ts` per active Event) into upcoming/at-risk Event lists and workspace-wide overdue counts — reusing every per-Event computation rather than recalculating anything. `financeWarnings` is intentionally always empty today: no safe, already-existing cross-Event finance aggregate exists in BloomOS (only a per-Event `getEventFinancialSummary`), so the field is reserved rather than fabricated.

## Anticipated capabilities (not yet designed in detail)

- Drafting proposals and follow-up communications from consultation notes
- Summarizing a client's or event's history and current status
- Flagging risk (e.g., a stalled lead, an overdue deposit, an approaching event with an incomplete Planning checklist)
- Answering team questions against the business's own data (leads, clients, events, contracts, finance)

## Guardrails

- **Data-grounded, not speculative.** Bloom AI answers from BloomOS's actual data; it does not fabricate client, contract, or financial information.
- **Assist, not replace.** It drafts and suggests; a human approves anything client-facing or financially consequential before it goes out.
- **Scoped to Workspace data.** Same tenant-isolation rule as everything else in `docs/permissions.md` — no cross-tenant leakage, ever.
- **Transparent.** Where Bloom AI takes or suggests an action, it's visible and attributable, not a silent background process.

## Explicitly out of scope for now

Everything in "Anticipated capabilities" above beyond the Event Operations Brief: no general chat interface, no direct mutation of Events/Pipeline/Finance/Clients, no client-facing communication sent without human review, no live provider credentials committed anywhere. The MVP's six modules remain fully usable through direct human action with no AI dependency.

Also explicitly deferred, confirmed during the v1.0 architecture audit: Client/Finance/Service/Blueprint context builders (only Event context exists); the "Operational Graph" named in `docs/services.md`/`eventServicePurchaseRequirement.ts` (a documented future concept, no graph data structure exists yet); retry-with-backoff around a provider call (today: a single 20s timeout, surfaced to the user with a manual retry button); a true provider-fallback chain (today: `getAIProvider() ?? createMockAIProvider()` covers "no provider registered," not "primary provider failed"); and an AI tool/function-calling registry (today: strictly JSON-in/JSON-out against a fixed schema). None of these require any change to ship v1 — `core/ai`'s `AIProvider` interface is already decoupled enough that each is additive, not a rearchitecture.
