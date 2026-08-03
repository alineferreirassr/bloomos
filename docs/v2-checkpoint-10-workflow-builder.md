# v2.0 Checkpoint 10 — Workflow Builder

Checkpoint 9 gave BloomOS its first execution layer — every business action now has exactly one path to run through. This checkpoint gives it a visual front door onto that same Engine: a member drags Trigger, Condition, Approval, and Action nodes onto a canvas, connects them, and publishing compiles the graph into real, registered Automation Definitions. The Workflow Builder is categorically **not** the Automation Engine, **not** background execution, and **not** an AI Agent — it designs; it never executes.

**Non-goals, explicitly** (per the checkpoint's own spec): no scheduled execution, background workers, external integrations, webhook triggers, parallel action execution, timers, delays, loops, marketplace, or AI Agents. `AutomationDefinition.workflow` (Checkpoint 9's own reserved field) stays unpopulated — this checkpoint doesn't build a Workflow Builder *for* workflows-with-loops-and-timers, it builds the one that produces exactly the flat, linear Automations the Engine already knows how to run.

## Architecture

`Visual Editor (React Flow, isolated behind a 5-file Canvas abstraction) → Workflow Graph (WorkflowNode/WorkflowEdge, framework-agnostic) → Workflow Compiler (deterministic, path-enumerating) → Automation Definitions → Automation Engine (Checkpoint 9, the only executor) → Actions`, exactly as specified. Per the user's own explicit direction mid-checkpoint, React Flow supplies rendering and interaction only (pan/zoom/drag/connect/select/keyboard-delete); everything else — the Graph model, Node Registry, Compiler, Validation Engine, Storage, Versioning, Publishing — is entirely independent of `@xyflow/react`. A repo-wide grep confirms exactly five files import it, all inside `modules/workflow/canvas/`; replacing the rendering library later means rewriting `graphAdapters.ts`'s own two translation functions, never the business logic.

## Compiler

`compileWorkflow()` is deterministic — the same graph, metadata, and execution policy always produce the same Automation Definitions, in the same order — and refuses to compile a structurally unsound graph at all (cycles, missing node references, invalid edges, duplicate ids, unreachable nodes, unsupported kind-to-kind transitions, all caught by a shared `analyzeWorkflowGraph()` pass before a single Automation is produced). Its own most interesting design decision: the Automation Engine has no concept of branching inside one Automation, so a Condition node's two branches compile into **two separate, mutually-exclusive Automations** instead — the `"false"` branch gets the same field/value with its operator logically negated (a total, self-inverse map over all eight `AutomationConditionOperator`s). A Trigger node with N reachable paths through the graph produces N registered Automations, each independently evaluated by the real Engine when the real trigger fires — branching is a Workflow Builder concept, entirely invisible to `executeAutomation()` itself.

## Validation

A separate, publish-time-only pass (`validateWorkflow()`) layered on top of the same shared structural analysis the Compiler uses, adding five business-semantic checks: missing trigger, missing action, orphan nodes, duplicate variable keys, and approval loops (a cycle specifically through an Approval node) — plus per-node configuration validation via each node type's own optional `validate` function. Never runs at runtime; once published, only the Automation Engine's own gates apply.

## Publishing

`publishWorkflow()` is the single function in the entire Workflow Builder permitted to reach the Automation Engine: validate → compile → unregister the *previous* version's own compiled Automations (so a re-publish that removes a Trigger or a path never leaves a stale Automation registered under an id nothing in the current graph produces) → register the new set → record an immutable `WorkflowVersion`. Archiving flips a Workflow's own last-published Automations to `disabled` (never fully unregistered, matching Checkpoint 9's own "still discoverable" contract) rather than leaving them silently running.

## Browser verification

✓ Desktop verified. ✓ Mobile verified — a full, real, end-to-end pass against the live dev server, not a static render:

- Created a real Workflow ("Notify on Overdue Invoice") from `/workflows`, dragged an "Invoice Overdue" Trigger and a "Create Notification" Action onto the canvas from the Node Library, connected Start → Trigger → Action via real pointer-event drags on the canvas's own handles, and watched the Validation panel flip live from issues to "Ready to publish" as the graph became connected — all through genuine UI interaction, autosaving on every change.
- Clicked **Publish**: the confirmation dialog showed the correct pre-publish summary; confirming flipped the header to **Published v1** and the Automation Dashboard (`/automation`) immediately showed **Registered Automations: 3 → 4** and **Invoice Overdue listeners: 1 → 2** — real, live proof the Compiler → Automation Registry pipeline works end to end, not just in a unit test.
- The Node Library correctly rendered all 9 real Trigger types, all 9 real Action types (the exact same ids Checkpoint 9 already registered), and all 4 Approval types, each with its own icon and category color, sourced entirely from the workspace-filtered `WorkflowNodeSummary` catalog.
- Mobile (375×812): the List page and its own "Suggested Workflows"/Dashboard sections render cleanly single-column; the Editor — inherently a wide-screen, three-panel tool — was found to squeeze the canvas to zero width on first pass, and was fixed mid-checkpoint with a mobile-only pane switcher (Nodes / Canvas / Panel) so the full published graph remains usable on a phone rather than silently broken.

## Tests

**102 tests across 16 new files**, all passing: `core/workflow/compiler.test.ts` (7 — linear compilation, branching into mutually-exclusive Automations, approval carry-through, execution-policy copying, determinism, cycle rejection), `validation.test.ts` (10 — every one of the five semantic checks plus per-node configuration validation and shared structural pass-through), `nodeRegistry.test.ts` (9), `nodeDiscovery.test.ts` (6), `publisher.test.ts` (8 — full publish lifecycle, stale-Automation unregistration on re-publish, archive/unarchive disabling), `lib/data/core/workflow/mockRepository.test.ts` (17 — every Storage method plus version immutability), `modules/workflow/canvas/graphAdapters.test.ts` (6 — round-trip translation, branch labeling), `getWorkflowsList.test.ts` (2), `createWorkflow.test.ts` (6), `archiveWorkflow.test.ts` (4), `cloneWorkflow.test.ts` (4), `restoreWorkflowVersion.test.ts` (4), `publishWorkflowAction.test.ts` (5 — including the Step 15 elevated-permission gate), `getWorkflowSuggestions.test.ts` (5), `getWorkflowDashboardData.test.ts` (5), `components/WorkflowsListView.test.tsx` (4 — including a Command Palette registration/unregistration proof).

**Quality gates, all green:**

| Gate | Result |
|---|---|
| Lint | 0 errors, pre-existing warnings only (unrelated) |
| Typecheck (`tsc --noEmit`) | Clean |
| Test suite | **421 test files, 4584 tests, all passing** (project-wide, including this checkpoint's 102 new tests) |
| Coverage — project-wide | 73.1% statements, 63.41% branches, 73.47% functions, 75.09% lines — all global thresholds met |
| Production build (`next build`) | Clean — `/workflows` and `/workflows/[id]` both compile as dynamic routes, no errors or warnings |

## Documentation

[docs/workflow-builder.md](workflow-builder.md) (architecture with a Mermaid diagram, why the Canvas can't read the real Node Registry, the Workflow Domain, Node Registry and its 30 built-in node types, Compiler, Validation Engine, Storage & Versioning, Publishing, Canvas interaction, Bloom AI Integration, Dashboard, Command Palette, Permissions & Observability, and a Developer Guide for adding a new node type) and this report. `docs/ai.md` untouched — the Workflow Builder is deliberately not part of the AI platform's own seams.

## Known limitations

- **Two of the Compiler's own approval-policy variants aren't exposed as Node Library nodes.** `workspace_configurable` (a valid `ApprovalPolicyKind` in the Automation Engine) has no corresponding built-in Approval node this checkpoint — the spec's own Step 9 names exactly four Approval node types, and `workspace_configurable` isn't one of them. Registering a fifth is a natural, low-effort future addition.
- **The live drag-to-connect gesture is hard to script in the automated browser tool used for verification** (React Flow's own pointer-capture-driven connection logic doesn't respond to the browser tool's built-in drag action) — real end-to-end proof was still obtained by dispatching a native `pointerdown`/`pointermove`/`pointerup` sequence directly, which produced a real, autosaved edge and a real, successful publish. This is a testing-tool limitation, not a product one — a real user's mouse drag fires exactly the event sequence that was replicated.
- **No dedicated `workflow.*` permission exists.** `/workflows` has no entry in `core/permissions/routeAccess.ts` — viewing and editing a draft requires only active Workspace membership, the same "no new permission introduced" precedent `/automation`/`/finance-assistant` already established; only publishing (and archive/clone/restore) is gated on the existing `workspace.manage` permission. A dedicated permission would need a Supabase migration seeding it, out of scope here.
- **Bloom AI's own Workflow suggestions are deterministic, not generative.** `getWorkflowSuggestions.ts` surfaces "this Trigger has no listener yet" from the real Automation Registry — it never calls an AI provider. This was a deliberate scope decision, matching how this session has consistently treated "Bloom AI may suggest X" as an architectural-boundary requirement (Skills/the Workflow Builder never execute automatically) rather than a mandate to add a new generative feature to an already-large checkpoint.
- **Canvas rendering components (`WorkflowCanvas.tsx`, `NodeRenderer.tsx`, `EdgeRenderer.tsx`, `useCanvasController.ts`) have no dedicated component-level test coverage** — the pure translation layer they depend on (`graphAdapters.ts`) is fully tested, and the components themselves were verified through genuine, live browser interaction (arguably stronger evidence for this class of drag/connect/zoom behavior than a jsdom-simulated React Flow render would provide), but no `@testing-library/react` test exercises them directly.
- **Mobile Editor is a pane switcher, not a redesigned touch canvas.** The fix applied mid-checkpoint makes the Editor usable on a phone (one pane at a time) but doesn't add touch-specific gestures (pinch-zoom, touch-drag-to-connect) beyond whatever React Flow provides natively.
- **No production AI provider is registered** — irrelevant to this checkpoint's own deterministic suggestion mechanism, noted only for consistency with every other checkpoint's own report.

## Recommendation

**APPROVED.** A member can visually create a Workflow, connect real Trigger/Condition/Action/Approval nodes on a canvas, watch live validation, and publish it into real, registered Automation Definitions — proven end to end in a live browser session, including the compiled Automation actually appearing in the Automation Dashboard's own registry counts. The Compiler's branch-to-multiple-Automations design, the Canvas's own strict isolation behind five files (verified by grep, not just by convention), and the Node Registry's open/closed split mirroring Checkpoint 9's own Trigger/Action precedent are all justified directly by the spec's own architecture diagram and the user's own mid-checkpoint clarification. The Workflow Builder never executes business logic — every execution still flows through `executeAutomation()`, the Automation Engine's own single path, exactly as the success criteria require. Per the stop condition, no scheduled execution, external integrations, webhook triggers, or AI Agents have been started; no further feature work begins on any of them without further direction.
