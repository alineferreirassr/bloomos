# v2.0 Checkpoint 6 — AI Memory & Knowledge Layer

Checkpoint 5 delivered the Daily Operations Brief, the third real Skill running through the Checkpoint 4 Skills Layer. This checkpoint gives every one of those Skills — Proposal Generator, Event Operations Brief, Daily Operations Brief — shared, structured operational memory: a typed, auditable, permission-aware record of what happened and what was decided, read and written through one Memory Manager rather than reimplemented per feature.

**Explicitly not built, per the spec's own non-goals**: CRM Assistant, Finance Assistant, Document Assistant, Workflow Builder, a vector database, embeddings, semantic search, agents, streaming. Every lookup in this layer is a plain typed filter (`workspaceId` + category/entity/skill/importance/tags/approval status) — there is no embedding computed or stored anywhere, and no similarity search of any kind.

## Architecture

`executeSkill() → Memory Manager → Knowledge Store → Context Orchestrator → AI Runtime`, exactly as specified. Two independent paths reach the Memory Manager, both used live in this checkpoint:

1. **Through the Context Orchestrator**, optionally — `SkillDefinition.optionalContext?: AIContextSectionKey[]` (new field) lets a Skill request the `"memory"` section alongside its `requiredContext` without ever hard-failing on its absence (`runSkillCompletion`'s hard-fail loop stays scoped to `requiredContext` only). Daily Brief uses this path.
2. **Direct Memory Manager calls from a feature's own wrapper**, entirely outside the Skill's own context/prompt pipeline. Proposal Generator uses this path, which is what makes "never modify proposal content automatically" a structural guarantee rather than a policy promise — there is no code path from a memory to that Skill's own prompt.

Full architecture, the Memory Model, Knowledge Store categories, Policies, and every integration point are documented in `docs/memory.md`.

## Memory lifecycle

`AIMemoryEntry` (`types/aiMemory.ts`) never stores a raw prompt or a raw provider response — every entry is a *derived* fact. Lifecycle:

- **Write** — `createMemory`/`proposeMemory` (Memory Manager) apply three policies (`core/ai/memory/policies.ts`) on every write: `shouldRemember` refuses anything from a failed Skill execution outright; `defaultApprovalStatusFor` starts a `"skill"`-sourced entry `"proposed"` (needs human review) and a `"system"`/`"human"`-sourced entry `"approved"` directly; `computeDefaultExpiresAt` sets a 30/90/never expiry window by importance, overridable with an explicit `expiresAt`.
- **Review** — `approveMemory`/`rejectMemory` (human-only, recorded via `reviewed_by`/`reviewed_at`) move a `"proposed"` entry to a terminal decision.
- **Read** — `filterMemories`/`lookupMemory`, always workspace-scoped, always excluding `"expired"`/`"archived"` entries unless explicitly requested.
- **Retire** — `archiveMemory`/`expireStaleMemories` move an entry to a terminal state; no hard delete exists anywhere in the Knowledge Store, matching the Audit Log's own immutable-record precedent.

## Integration evidence

- **Daily Brief (read + write loop)** — after every successful generation, `generateDailyOperationsBrief.ts` writes a `historical_knowledge`, `source: "system"` (auto-approved) memory whose `summary` is `JSON.stringify(computeIssueSnapshots(context))`, a stable `{key, label}[]` snapshot. The Skill declares `optionalContext: ["memory"]`; on the *next* run, `memoryContextBuilder.ts` returns the most recent approved snapshot, `registerDailyOperationsBriefUseCase.ts`'s `composeContext` extracts it into `context.previousSnapshot`, and `assembleBrief.ts`'s `computeBriefComparison` deterministically diffs this run's own issues against it — `briefComparison: {newIssues, resolvedIssues, persistentRisks} | null`, **never computed by the model**. Verified live (see below): generating a Brief wrote a real memory entry with the real snapshot content, immediately visible in the Dashboard's own Memory cards.
- **Proposal Generator (surface, never modify)** — `generateProposalDraft.ts`'s `fetchRelevantMemories` runs *concurrently with*, and entirely independent of, its `executeSkill()` call (`Promise.all`), querying approved memories for this Event and this Client, deduped and capped at 5, returned as `relevantMemories: AIMemoryEntry[]` and rendered as a "Relevant History" section. Two dedicated tests assert both that only approved memories surface (never a still-`"proposed"` one) and that regenerating a proposal after a memory exists produces byte-identical narrative content — proving the "never automatically modify" guarantee holds under an actual second generation, not just by code inspection.
- **Browse AI Memory (the one new Skill)** — `registerBrowseAIMemorySkill.ts` declares a Skill whose own `execute` never calls the AI Runtime at all: it's a direct, typed read against the Memory Manager (workspace-visible plus the caller's own user-visible memories, always `approvalStatus: "approved"`), returned through the same `executeSkill()` gates (permission/role/feature-flag) every other Skill uses. **A real bug was caught and fixed during this checkpoint's own review**: the first implementation queried `filterMemories` without an `approvalStatus` filter, which would have let a still-`"proposed"`, unreviewed suggestion leak through as though it were vetted fact — caught by a dedicated test (`"never surfaces a still-proposed memory awaiting human review"`) before it shipped, and fixed in both `registerBrowseAIMemorySkill.ts`'s `execute` and `getBloomAIOverview.ts`'s own "Recent Memories" read (which had the identical gap).
- **Bloom AI Dashboard** — `getBloomAIOverview.ts` adds `memorySummary` (from `summarizeMemories`) and `recentMemories`; `BloomAIOverviewView.tsx` renders four new cards (Memory Usage, Knowledge Statistics, Memory Health, Recent Memories), all Skill-Registry/Memory-Manager-driven, no hardcoded numbers.
- **Command Palette** — Browse AI Memory needs zero Skill Picker code changes to appear in "Ask Bloom" (the same zero-changes guarantee Checkpoint 4 established) — but reaching it live required mounting `BloomAISkillPicker` on the Bloom AI Dashboard page itself, which it wasn't previously (only `/dashboard` and Event pages had it). **A second real gap found via live browser verification, not by any test**: without this, selecting "Browse AI Memory" from any other page would always fall back to navigating to `/bloom-ai`, landing on a page with no way to actually *run* the Skill — the runner existed but nothing on that page could trigger the picker in the first place. Fixed by adding `<BloomAISkillPicker />` to `BloomAIOverviewView.tsx`'s own header.

## Browser verification

✓ Desktop verified. ✓ Mobile verified.

- Loaded `/bloom-ai` fresh: Skill Statistics correctly reports 7 installed / 4 active / 3 coming soon (Browse AI Memory now counted as the fourth Active Skill); Memory Usage/Knowledge Statistics/Memory Health/Recent Memories all render a correct, honest zero state ("No memory recorded yet — Bloom AI remembers as Skills run.").
- Opened "Ask Bloom" on `/bloom-ai`, selected "Browse AI Memory" — the modal closed, `executeSkill()` ran live (confirmed via network inspection: a real server-action call returning `{"success":true,"data":{"memories":[]}}`), and a "Full Memory Browser" panel appeared inline under Recent Memories reading "No memory matches this Workspace yet."
- Generated a Daily Brief from `/dashboard` — succeeded with Confidence 100%, a real at-risk Event and a real unsigned Contract surfaced. Returned to `/bloom-ai`: Memory Usage now reads 1 (Low importance), Knowledge Statistics shows Historical Knowledge: 1, Memory Health shows Approved: 1, and Recent Memories lists the real entry — title `"Daily Brief snapshot — 2026-07-26T19:34:56.229Z"`, `source: system`, `approved`, with its real JSON snapshot content (`risk:...:missing_owner`, `unsigned-contract:...`) visible, exactly matching what `generateDailyOperationsBrief.ts` wrote.
- Mobile (375×812): `/bloom-ai` renders single-column with no horizontal overflow; all four new memory cards, Skill Statistics, and Active/Coming-Soon Skills sections render correctly with the same live memory data.

## Tests

New test files (all passing): `types/aiMemory.ts`-backed `lib/data/core/aiMemory/mockRepository.test.ts` (32), `core/ai/memory/policies.test.ts` (9), `core/ai/memory/manager.test.ts` (10), `core/ai/context/builders/memoryContextBuilder.test.ts` (4), `modules/ai/memory/browseAIMemory.test.ts` (6). Updated: `generateDailyOperationsBrief.test.ts` (+5: writes a memory snapshot on success, never on failure, no `briefComparison` on the first run, correctly diffs new/resolved/persistent issues on a second run), `generateProposalDraft.test.ts` (+2: surfaces only approved memories scoped to this Event/Client, never modifies proposal content), `getBloomAIOverview.test.ts` (+2: zeroed Memory summary for a fresh Workspace, correct workspace/user visibility scoping across members), `BloomAIOverviewView.test.tsx` (+6: renders the three new stat cards, the empty state, Recent Memories content, and the full "Browse AI Memory" runner → Full Memory Browser flow for both success and failure), `BloomAISkillPicker.test.tsx` and `DailyBriefCard.test.tsx` (fixture updates for the new `memorySummary`/`recentMemories`/`briefComparison` fields).

**Quality gates, all green:**

| Gate | Result |
|---|---|
| Lint | 0 errors, 3 pre-existing warnings (unrelated) |
| Typecheck (`tsc --noEmit`) | Clean |
| Test suite | **375 test files, 4214 tests, all passing** |
| Coverage — `core/ai/memory/` | 81.01% statements, 64.28% branches, 83.33% functions, 85.29% lines |
| Coverage — `lib/data/core/aiMemory/` | 96.55% statements, 90.81% branches, 97.36% functions, 97.05% lines |
| Coverage — `modules/ai/memory/` | 90% statements, 66.66% branches, 75% functions, 93.1% lines |
| Coverage — project-wide | 74.2% statements, 64.37% branches, 75.06% functions, 76.33% lines |
| Production build (`next build`) | Clean |

## Documentation

[docs/memory.md](docs/memory.md) (architecture, Memory Model, Knowledge Store categories, Policies, Memory Manager, Context Integration, Daily Brief/Proposal integration, Dashboard, Command Palette, Permissions, Observability, future vector search) and this report. `docs/ai.md`'s status line and deferred-capabilities list updated to reflect Checkpoint 6.

## Known limitations

- **No dedicated `memory.*` permission** — the Step 1 audit found none in `core/enums/permission.ts`; Browse AI Memory reuses the Bloom AI Dashboard's own "any active Workspace member may view read-only AI activity" precedent (`requiredPermissions: []`, `minimumRole: null`). A future write path (approve/reject via a review UI, or a member deleting their own memory) is where a real permission would earn its keep — not this read-only browse.
- **Browse AI Memory's own Skill Metadata shows a "Live"/"Mock" provider badge inherited from `getSkillMetadata`'s generic computation**, even though this Skill's own `execute` never calls an AI provider at all. A cosmetic quirk of reusing the same metadata function every other Skill uses, not a functional issue — nothing about this Skill's actual behavior depends on provider configuration.
- **The in-memory Knowledge Store, like every other mock repository in this codebase, resets on a dev-server restart or a full recompilation** — expected and consistent with every other mock-mode repository (Proposals, Daily Brief Executions), not specific to memory.
- **No production AI provider is registered** — Daily Brief and Proposal Generator's own memory reads still run through their existing mock providers; Browse AI Memory itself never needed one to begin with.

## Recommendation

**APPROVED.** Every Skill can now optionally consume shared, structured operational memory with no duplicated memory implementation (the pre-existing Proposal-only memory concept was evolved in place into the same `types/aiMemory.ts`/`lib/data/core/aiMemory/`/`core/ai/memory/` locations, not rebuilt alongside it). Memory is structured (one typed entity, five closed categories), auditable (every write logs safe structural fields, nothing content-bearing), and permission-aware (workspace-scoped by construction, visibility-aware per member). Two real bugs were caught and fixed via this checkpoint's own test-writing and live browser verification before either could reach a real Workspace: an unreviewed-proposal leak in Browse AI Memory's own filter, and a genuinely unreachable Skill (no picker mounted on its own home page). Per the stop condition, CRM Assistant, Finance Assistant, and Workflow Builder have not been started; no further feature work begins on any of them without further direction.
