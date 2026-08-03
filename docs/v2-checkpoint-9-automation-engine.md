# v2.0 Checkpoint 9 — Automation Engine

Checkpoint 8 delivered Bloom AI's second full business assistant. This checkpoint delivers something categorically different: BloomOS's first **execution** layer. Every prior AI capability drafts a report, a brief, or a proposal — a human decides what happens next. The Automation Engine is the one place a deterministic business action actually runs, after an explicit trigger and, when a policy requires it, an explicit human approval. It is **not** the Workflow Builder, **not** background scheduling, and **not** autonomous AI — Bloom AI's Skills may suggest that an Automation exists; they may never call `executeAutomation()` or `dispatchAutomationTrigger()` themselves.

**Non-goals, explicitly** (per the checkpoint's own spec): no Workflow Builder, no Visual Editor, no scheduled jobs, no background workers, no email/SMS sending, no external integrations, no webhook execution, no multi-step workflows, no agent orchestration. `AutomationDefinition.workflow` is reserved as an extension point for all of this — never populated or read by anything this checkpoint builds. See `docs/automation-engine.md`'s §11 for exactly what's prepared.

## Architecture

`Trigger → dispatchAutomationTrigger() → Automation Registry → executeAutomation() → Condition Evaluator → Approval Engine → Action Runner → Action Registry → Automation History (Manager → Knowledge Store) → Observability`, exactly as specified. Every stage is a plain function or a `Map`-based registry, mirroring this codebase's own established patterns (`core/ai/skills/registry.ts`, `core/ai/memory/manager.ts`) rather than introducing a new architectural shape. No UI component executes an Action or an Automation directly — the Dashboard's Approve/Reject buttons, the only interactive execution surface this checkpoint ships, route through the same `executeAutomation()`/`getAutomationManager()` seams every other caller uses.

## Execution flow

`executeAutomation()` (`core/automation/resolver.ts`) is the single path every Automation runs through: permission validation → role validation → feature-flag validation → condition evaluation (a failure is `"skipped_conditions_not_met"`, not an error) → approval resolution (a required-but-ungranted approval is `"pending_approval"`, not an error) → sequential Action execution via `runAutomationAction` (permission/role/feature-flag gated per Action, then retried synchronously up to `maxRetries` on failure) → status aggregation (`success`/`partial_failure`/`failure`). Every branch persists a history record — including denied, skipped, and pending attempts — via one shared `persist()` helper, matching the Audit Log's own append-only, "record everything" precedent. `dispatchAutomationTrigger()` fans a real trigger event out to every active Automation registered against it, independently — one Automation's own failure never stops a sibling.

## Approval system

Two orthogonal questions, kept separate on purpose: `resolveApprovalRequirement()` answers "does this need approval at all" (four policies — `always_required`, `never_required`, `workspace_configurable` defaulting to required when unset, `role_restricted`); `canGrantApproval()` answers "may *this* member grant it" (only `role_restricted` narrows this). Approving a pending execution (`modules/automation/approveAutomationExecution.ts`) reconstructs the original trigger from the persisted record and re-runs the **entire** Automation through `executeAutomation()` with `approved: true` — producing a new, fully-executed history record, never a status flip pretending an Action ran when it didn't. Rejecting (`rejectAutomationExecution.ts`) never runs an Action; it marks the one pending record `rejected`, a terminal state, directly.

## Registry design

Two registries, deliberately asymmetric: the **Automation Registry** (`core/automation/registry.ts`) is Map-based over a **closed, 12-value Trigger enum** (`AUTOMATION_TRIGGER_TYPES`) — a curated list beats an open string for a small, rarely-changing set of system-defined operational events. The **Action Registry** (`core/automation/actionRegistry.ts`) is the open counterpart — a plain string id, "Future actions should register automatically" and "No hardcoded actions" are the spec's own words, said only of Actions. Both mirror the Skill Registry's own `register`/`unregister`/`get`/`list`/`listByCategory`/`reset` shape exactly — one more instance of this codebase's single registry pattern, not a new one. `core/automation/registry.test.ts` includes a dedicated proof (mirroring the Skill Registry's own equivalent test) that a brand-new Automation needs only a Trigger, Conditions, Actions, and one `registerAutomation()` call — no registry-side change required.

## Browser verification

✓ Desktop verified. ✓ Mobile verified — both against a real dev session with a real, previously-provisioned Workspace, exercising the **live, end-to-end trigger → dispatch → history → approve/reject** flow, not a static render:

- `/automation` renders all seven required Dashboard sections (Recent Executions, Pending Approvals, Automation Health, Execution Statistics, Registered Triggers, Registered Actions, Failure Summary) plus a Registered Automations section, with a working "Automation" sidebar entry and a new `AutomationIcon`.
- Generated a real Proposal draft on an existing Event, then clicked **Reject Draft** on the real `/events/[id]` page. Server logs confirm a real `proposal.rejected` trigger fired and fanned out to both registered listeners: `record-memory-on-proposal-rejection` ran to completion (`status: "success"`, created a real AI Memory entry) and `suggest-follow-up-proposal` correctly stopped at `status: "pending_approval"` (its `role_restricted` policy requires a Manager-or-above approver).
- Back on `/automation`, the pending execution appeared under **Pending Approvals** with working Approve/Reject buttons (enabled — the signed-in account is Owner-tier, satisfying `minimumApproverRole: "manager"`). Clicking **Approve** re-ran the Automation for real: a **second**, full-detail execution record appeared under Recent Executions (`status: "success"`, 1660ms, 1 action — a genuine `generateProposalDraft()` call, not a status flip), Pending Approvals emptied, and Execution Statistics/Automation Health updated live (100% success rate, 3 total executions).
- Mobile (375×812): single-column stacking, all badges and section text wrap correctly, no horizontal overflow.

## Tests

New test files, all passing (**121 tests across 11 files**): `core/automation/registry.test.ts` (12 — register/unregister/get/list/category filter/trigger filter/reset/developer-experience proof), `actionRegistry.test.ts` (9), `conditions.test.ts` (11 — every operator, `role`/`workspaceId` context resolution, the `featureFlag` special case, AND-combination), `approval.test.ts` (12 — all four policy kinds, workspace-scoped overrides, `canGrantApproval` role gating), `actionRunner.test.ts` (14 — permission/role/feature-flag gates, retry-on-failure, retry-on-throw, stop-on-first-success), `resolver.test.ts` (21 — every `executeAutomation` gate and status outcome, action-order sequencing, history persistence shape, a dedicated observability test proving no logged context ever contains the trigger's own sensitive facts, and `dispatchAutomationTrigger` fan-out), `discovery.test.ts` (7), `lib/data/core/automation/mockRepository.test.ts` (14 — every History method plus approval-override scoping), `modules/automation/getAutomationDashboardData.test.ts` (8 — workspace scoping, statistics computation, failure summary aggregation, the RSC-serialization-safety proof for `registeredActions`), `approveAutomationExecution.test.ts` (8), `rejectAutomationExecution.test.ts` (5).

**Quality gates, all green:**

| Gate | Result |
|---|---|
| Lint | 0 errors, pre-existing warnings only (unrelated to this checkpoint) |
| Typecheck (`tsc --noEmit`) | Clean |
| Test suite | **405 test files, 4482 tests, all passing** (project-wide, including this checkpoint's 121 new tests) |
| Coverage — `core/automation/` | 98.17% statements, 91.72% branches, 100% functions, 97.93% lines |
| Coverage — `lib/data/core/automation/` | 95.12% statements, 90% branches, 94.44% functions, 96.87% lines |
| Coverage — `modules/automation/` | 92.85% statements, 86% branches, 92.3% functions, 94.56% lines |
| Coverage — project-wide | 74.1% statements, 64.17% branches, 74.67% functions, 76.15% lines — all global thresholds met |
| Production build (`next build`) | Clean — `/automation` compiles as a dynamic route (`ƒ /automation`), no errors or warnings |

## Documentation

[docs/automation-engine.md](automation-engine.md) (architecture with a Mermaid diagram, the Automation Domain, Trigger System, Condition Engine, Approval Engine, Action System, Action Registry, Execution Engine, Automation History with the full approval-flow lifecycle, the Automation Dashboard, Permissions/Feature Flags/Observability, the reserved Workflow Builder extension points, and a Developer Guide) and this report.

## Known limitations

- **Only one real trigger integration point is live-wired end to end** (Proposal accept/reject → `proposal.accepted`/`proposal.rejected`), a deliberate scope boundary matching this session's own "prove it with 1-2 real integrations, not every possible one" precedent (Checkpoint 4's Skills migration, Checkpoints 7/8's cross-context reuse). The other 10 trigger types are registered, condition/approval/action-tested, and dispatchable, but nothing in Invoices/Contracts/other Event lifecycle code yet calls `dispatchAutomationTrigger()` for them.
- **`notifyOnOverdueInvoice` has no live emitter.** It is fully registered, its `daysOverdue >= 7` condition and `workspace_configurable` approval policy are both unit-tested, but no real "N days overdue" sweep exists yet to fire `invoice.overdue` — this checkpoint's own non-goals explicitly exclude scheduled/background jobs, which is the natural mechanism such a sweep would need.
- **`suggestFollowUpProposal`'s own pending approval has no live emitter to *complete* it yet** beyond the Dashboard's Approve/Reject buttons themselves — there is no separate approval-request notification (e.g. an email or in-app ping to a Manager) telling them one is waiting; a Manager currently discovers it only by visiting `/automation`.
- **No dedicated `automation.*` permission exists.** `/automation`'s own route requires only active Workspace membership, the same "no new permission introduced" precedent `/finance-assistant`/`/bloom-ai` already established — adding a granular permission would require a Supabase migration seeding it into the `permissions` table, out of scope here. Per-Automation enforcement (permission/role/feature-flag/approval) still happens on every real execution regardless.
- **The Command Palette commands registered this checkpoint** (`Automation Center`, `Pending Approvals`, `Recent Executions`) self-register only while `/automation` itself is mounted, the same limitation `BloomAISkillPicker`'s own `"ask-bloom"` command already has — the global `CommandPalette` shell isn't mounted anywhere in the app yet, so these are "found there for free" once it is, not reachable via `mod+k` from every page today.
- **No production AI provider is registered** — the four "Generate X" Actions, like every Skill they call, run against a deterministic development mock, clearly labelled throughout the UI they surface in.

## Recommendation

**APPROVED.** Every business action BloomOS can now take has exactly one execution path, proven live end-to-end: a real Proposal rejection fanned out to two independent Automations, one completing immediately and the other correctly stopping at a role-gated pending approval, which a Manager-tier account then approved from the Dashboard, producing a second, fully-executed history record while leaving the original request intact in an append-only audit trail. The Trigger/Action asymmetry (closed enum vs. open registry), the two-question Approval Engine, and the reserved `workflow` extension point are all justified directly by the spec's own wording, and the Workflow Builder can be layered on top of this Engine later without refactoring `executeAutomation()`'s own execution order, the Approval Engine, the Action Registry, or the History schema — the checkpoint's own success criterion. Per the stop condition, no Workflow Builder, scheduled execution, or external integration work has been started; no further feature work begins on any of them without further direction.
