# v2.0 Checkpoint 13 — Workflow Builder (Simulator, Templates, Dynamic Skill Discovery)

BloomOS already has a Workflow Builder — Checkpoint 10 shipped the Visual Editor, Node Registry, Compiler, Validation Engine, Storage/Versioning, Canvas, Dashboard, Command Palette, Permissions, and Observability, and it was APPROVED. This checkpoint's own spec substantially overlaps that architecture description, but genuinely adds five things Checkpoint 10 never had: an Execution Simulator, built-in Workflow Templates, a generalized (field-agnostic) Condition node family, generic Skill-Registry-driven Action node discovery (replacing 4 hardcoded skill nodes), and a widened Trigger/Action palette (Manual, Timer, Event Created, New Client, Custom Action). This report certifies that delta — it does not re-certify Checkpoint 10's own already-approved work, which is unchanged except where explicitly noted below.

**Non-goals, explicitly** (per this checkpoint's own spec): Real workflow execution, email sending, webhooks, API calls, Marketplace, external integrations, OCR, electronic signatures, Google Docs, Microsoft Word. None started.

## Architecture

`Workflow Editor → Workflow Graph → Workflow Compiler → Execution Plan → Automation Runtime → Actions`, exactly as specified — unchanged from Checkpoint 10. The Simulator and Templates both compose this same pipeline rather than adding a parallel one: the Simulator reuses the Compiler's own `analyzeWorkflowGraph()`/`enumeratePaths()`/`conditionFromNode()` directly; Templates are plain `WorkflowGraph` data built from the same node types every hand-built Workflow uses.

## Registry

Node Registry grew from Checkpoint 10's own 30 built-ins to include: 4 more Triggers (Event Created, New Client, Manual Trigger, Timer — the latter two registered with `compileTarget: null`, compiling successfully but producing zero real Automations, a deliberate reading of "do not build the execution engine"), 4 more Conditions (If, Compare, Exists, Switch — field-agnostic, resolving `data.field` at compile time via three reserved sentinels rather than a fixed `compileTarget`), 1 more Action (Custom Action, also `compileTarget: null`, a nameable manual step for Simulation preview only), and — the largest structural change — the 4 previously-hardcoded Skill-invoking Action nodes were removed and replaced by `skillActionNodes.ts`'s `buildSkillActionNodes()`, which discovers every real, runnable Skill from the Skill Registry and generates one node each. A new Template Registry (`core/workflow/templateRegistry.ts`) ships 3 built-in Templates, same open `Map`-based shape as every other registry in this codebase.

## Compiler

Unchanged in structure — `analyzeWorkflowGraph()` still runs the same 6 structural checks, `enumeratePaths()` still enumerates every simple Trigger-to-terminal path. `conditionFromNode()` gained one new branch: it now checks for the 3 dynamic-condition sentinels before falling back to its original "`compileTarget` names the field directly" path, so all 6 of Checkpoint 10's own fixed Condition nodes compile completely unchanged. Compile-time duration and node count are now logged on both success and structural-failure paths (Step 14's own "track compile time... node count").

## Simulator

`core/workflow/simulator.ts`'s `simulateWorkflow()` is new this checkpoint. It never re-implements graph traversal — it calls the Compiler's own exported `enumeratePaths()`/`conditionFromNode()` directly, so a Simulation can never show a path or a branch the real Compiler wouldn't also produce. Per path, it renders each step's `preview` in plain language (a trigger fires, a condition compares field/operator/value, an action runs, an approval requires sign-off, a Custom Action step is manual) and surfaces a coarse, read-only Memory summary (via the real `summarizeMemories()`) whenever a path touches a Memory-related node. No Action, Skill, or Automation is ever actually invoked — verified both by unit test and by live browser use.

## Browser verification

✓ Desktop verified. ✓ Mobile verified — a full, live pass against the real dev server, signed in as the seeded "Amoré Bloom" owner session:

- `/workflows`: **Suggested Workflows now lists "Respond to Event Created" and "Respond to New Client"** — live proof the two new Trigger nodes are correctly registered and discoverable by the pre-existing suggestion feed, with zero changes to that feed's own logic.
- Clicked **+ New Workflow**: the modal showed a **"Start from a Template"** section listing all 3 built-in Templates with their real names/descriptions; selecting "New Client → Welcome" pre-filled the Name field and category exactly as designed.
- Created the Workflow: landed in the real Editor with the Template's own graph already placed — Start → New Client → Run CRM Assistant → Generate Welcome Guide → Create Reminder → End, every node correctly labeled.
- **Node Library**, read in full: Triggers included Manual Trigger, Timer (placeholder), Event Created, and New Client alongside the original 9; Conditions included If, Compare, Exists, and Switch alongside the original 6; **Actions included Browse AI Memory, CRM Assistant, Daily Operations Brief, Event Operations Brief, Finance Assistant, and Proposal Generator — all dynamically generated from the Skill Registry, not one hardcoded** — plus the original 5 non-Skill actions, 5 Document actions, and the new Custom Action.
- **Simulation tab**: clicked **Run Simulation** — it returned "6 nodes / 1 trigger / 1 path," and Path 1 walked exactly `New Client (Fires on: New Client) → CRM Assistant (Runs Action: CRM Assistant) → Generate Welcome Guide (Runs Action: Generate Welcome Guide) → Create Task (Runs Action: Create Task) → End (Workflow ends)` — 3 actions counted, matching the template exactly.
- **Validation tab**: "Ready to publish — No validation issues."
- Clicked **Publish**, confirmed in the dialog: status flipped to **Published v1**, and the app reported **"Published as version 1 — 1 Automation(s) registered."**
- Back on `/workflows`: Workflow Statistics updated to **1 Total / 1 Published / 0 Drafts**; Automation Usage listed "New Client → Welcome v1 — 1 Automation"; and **"Respond to New Client" correctly disappeared from Suggested Workflows** now that an active Automation listens for it — the pre-existing suggestion-suppression logic working correctly against a brand-new Trigger type with zero changes.
- Mobile (375×812): the Dashboard, the New Workflow modal's Template picker, the Editor's mobile pane switcher (Nodes/Canvas/Panel), and the Simulation panel itself all rendered cleanly with no horizontal scroll and fully legible text; the 5-tab Panel row (Properties/Inspector/Validation/Simulation/Versions) is visibly tighter than Checkpoint 10's own 4-tab row and "Versions" clips slightly at 375px — noted below as a known limitation, not a functional break (still tappable).

## Tests

**~46 new/modified tests across 9 new files plus 4 extended existing files**, all passing: `compiler.test.ts` (+4, dynamic conditions and null-compileTarget triggers), `templates/templates.test.ts` (9, structural/validation/compile sanity for all 3 built-in Templates), `templateRegistry.test.ts` (6), `simulator.test.ts` (5), `simulateWorkflowAction.test.ts` (4), `nodes/skillActionNodes.test.ts` (4), `actions/runSkillActionFactory.test.ts` (4), `registerAutomationActions.test.ts` (4, the fallback-registration loop), `createWorkflow.test.ts` (+3, `templateId` behavior including deep-clone isolation), `getWorkflowTemplates.test.ts` (2), `WorkflowsListView.test.tsx` (+1, Template picker), `getWorkflowSuggestions.test.ts` (1 pre-existing test updated — `event.created` now has a real node, so the "no node exists for this trigger" example was swapped to `event.updated`, which still has none).

**Quality gates, all green:**

| Gate | Result |
|---|---|
| Lint | 0 errors (14 pre-existing warnings, all in files this checkpoint never touched) |
| Typecheck (`tsc --noEmit`) | Clean |
| Test suite | **456 test files, 4893 tests, all passing** (project-wide, including this checkpoint's own new/modified tests) |
| Coverage — project-wide | 71.87% statements, 62.03% branches, 71.63% functions, 73.83% lines — all global thresholds met (70/58/68/72) |
| Production build (`next build`) | Clean — `/workflows` and `/workflows/[id]` both compile as dynamic routes, no errors or warnings |

No test flakes observed on this run.

## Documentation

[docs/workflow-builder.md](workflow-builder.md) — extended in place with new numbered sections (6a Execution Simulator, 6b Workflow Templates, 8a Memory Integration, 12 Accessibility), an updated built-in node type table, and two new subsections under Node Registry (Simulation-only Triggers, Generalized Condition nodes, Dynamic Skill node discovery) — plus this report. `docs/v2-checkpoint-10-workflow-builder.md` is left untouched as the historical Checkpoint 10 sign-off.

## Known limitations

- **Switch compiles to set-membership (`in`/`notIn`), not true N-way branching.** A genuine multi-branch Switch would require `WorkflowEdge.branch` to carry an arbitrary case label instead of the closed `"true"|"false"|null` every Condition node relies on — a materially larger change to the Graph model and the Compiler's path enumeration. Set-membership delivers Switch's real value (branch on one of several configured values) without touching either, and is documented as a deliberate scope call in `conditionNodes.ts`'s own comments.
- **Manual Trigger and Timer compile to zero real Automations.** Both exist so a Workflow can be designed and simulated today; real on-demand or scheduled dispatch is explicitly out of scope per this checkpoint's own stop condition ("do not build the execution engine," "do not implement background jobs").
- **Custom Action is simulation/design-only** (`compileTarget: null`) — a nameable manual step shown in Simulation order, never compiled into a real Automation Action, since there is no generic channel for a node's own free-text label to reach an Action at runtime.
- **"Update Finance" and "Notify CRM" in the Invoice Paid Template are honest stand-ins, not literal matches.** BloomOS has no ledger-mutating Finance Action yet (only Finance *reporting*, via the Finance Assistant Skill) and no CRM-specific notification channel (only the one generic in-app Notification mechanism) — both are documented in `invoicePaidFinanceTemplate.ts`'s own comments rather than silently relabeled.
- **The generic Skill-node fallback Action (`runSkillActionFactory.ts`) calls `executeSkill()` directly**, not a bespoke wrapper — this is necessarily generic for any future Skill, so it can't offer the same custom result-shaping the 4 bespoke, hand-written Actions (e.g. `generateProposalAction.ts` calling `generateProposalDraft()`) already do. Those 4 keep their existing, richer behavior; only a genuinely new Skill uses the generic path.
- **No dedicated `workflow.*` permission exists** (a known limitation already carried forward from Checkpoint 10) — Simulation reuses the same lighter, active-membership-only gate Validation already uses; Publish/Create/Archive/Clone/Restore all still require `workspace.manage`.
- **The 5-tab Panel row is visibly tighter on a 375px mobile viewport** than Checkpoint 10's own 4-tab row — "Versions" clips slightly but remains tappable; not a functional break, noted for a future pass if a 6th tab is ever added.
- **No dedicated component tests for `WorkflowEditorView.tsx`, `SimulationPanel.tsx`, or `PropertiesPanel.tsx`'s new dynamic-condition fields** — consistent with Checkpoint 10's own already-documented "no canvas component tests" limitation, given how deeply these are tied to the Canvas/React Flow rendering layer; covered instead by the Simulator's own unit tests plus this checkpoint's live browser verification.

## Recommendation

**APPROVED.** The genuinely new capabilities this checkpoint's spec called for — an Execution Simulator that never executes anything, built-in Workflow Templates composed entirely from real node types, a generalized Condition node family, and fully automatic Skill-Registry-driven Action discovery — are all real, working, and proven end to end in a live browser session: a Workflow created from a built-in Template, its dynamically-discovered Skill nodes and generic Condition nodes visible in the Node Library, a Simulation that correctly previewed every step without side effects, and a real Publish that registered a live Automation and updated every dependent dashboard and suggestion feed correctly. No orchestration logic was duplicated — every new node type compiles through the same Compiler, and every "Generate X" or "Run Skill" action still calls the same underlying Document Compiler or Skill resolver Checkpoints 9–12 already built. Per the stop condition, no real execution engine, background jobs, or webhooks have been implemented; no further feature work begins on any of them without further direction.
