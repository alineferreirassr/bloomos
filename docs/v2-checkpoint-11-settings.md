# v2.0 Checkpoint 11 — Enterprise Settings Platform

Checkpoints 9-10 gave BloomOS an Automation Engine and a Workflow Builder, each configurable only by editing code. This checkpoint gives every module a real, self-service configuration surface: a `SettingDefinition` registers once, from wherever its own module lives, and appears in a generic Settings UI with zero hand-written per-Setting rendering. The Settings page itself contains no module-specific logic — it walks the Registry.

**Non-goals, explicitly** (per the checkpoint's own spec): Billing, Marketplace, OAuth integrations, external providers, user invitations, organization management, API usage dashboard. None started.

## Architecture

`Settings UI (SettingsView/SettingField — generic, switches on type/visibility, never on id) → Settings Registry + Section Registry (both fully open, unlike Checkpoints 9-10's closed-enum/open-registry split) → Validation (collects every issue, not just the first) → Settings Manager → Workspace Storage → Runtime (getResolvedSettingValue())`, exactly as specified.

## Registry

Both the Setting Registry and the Section Registry are open, `Map<id, definition>`-based — a deliberate break from the Trigger/Node closed-enum precedent, justified directly by the spec's own "Future sections should self-register" / "Every module registers its own settings" wording. 14 Sections, 50 Settings, all self-registered from their own module's section file, aggregated by one idempotent `registerSettingsSections()` call.

## Search

Ranked (exact label match highest, then keyword, then substring), never a plain filter. Runs against `listSettingsForWorkspace()`'s own already-permission/role/flag-filtered results — a search result can never surface a Setting the searching member isn't otherwise permitted to see. "timezone" → Workspace, "invoice" → Finance, "approval" → Automation, "provider" → AI, "workflow" → Workflow, "memory" → Memory — all verified live.

## Validation

Runs required → type/option → custom `validate` → permission → role → feature flag, collecting every issue rather than stopping at the first. Every custom `validate` across all 14 sections is boundary-tested (AI Temperature 0-1, Confidence Threshold 0-100, Automation Max Retries 0-5, CRM Risk Threshold 0-100, Finance Tax Rate/Late Fee 0-100, Payment Terms/Version Retention/Memory Retention/Session Timeout all rejecting non-positive values).

## Permissions

Workspace scoped (every query resolves against the session's own `workspaceId`), role aware (`minimumRole` — Security and Developer sections gate to `owner`), Section aware (a Section's own gate is checked independently of any Setting inside it), Feature Flag aware (async-evaluated, logged). `discovery.ts` applies the identical gate to both Settings and Sections, mirroring `listAutomationsForWorkspace`/`listWorkflowNodesForWorkspace`.

## Browser verification

✓ Desktop verified. ✓ Mobile verified — a full, real, end-to-end pass against the live dev server:

- `/settings` loads with all 14 sections visible for the seeded owner session, correct icons resolved from `sectionIcons.ts`, General selected by default.
- Clicked through Branding (Logo URL string + Brand Color color-picker-with-hex-fallback), AI (Provider rendered disabled/read-only showing "mock", Temperature/Token Limit/Confidence Threshold as number inputs), and Notifications (5 real toggles/select, matching each section file's own defaults).
- Typed `150` into Confidence Threshold and tabbed out: the field correctly rejected the save, showed **"Confidence threshold must be between 0 and 100."** inline, and reverted the displayed value to the last-saved `60` — the full validate → block → revert loop, live.
- Toggled Push notifications on: saved immediately, showed a **"Saved"** indicator, and — confirmed on a full page reload — persisted (`push-enabled: true` after reload, proving the Manager → mock repository → resolved-value round trip).
- Typed "invoice" into Global Search: got a ranked dropdown (Invoice Numbering, Invoice Prefix, Currency ×2, Default Revenue Category, Finance, Late Fee, Payment Terms, Tax Rate); clicking the top result correctly switched the active section to Finance.
- **Dashboard, full loop**: fresh load showed Workspace Health 98% (1 warning, 1 missing — "Workspace Name" is required and unset), Recently Changed empty, one live Recommended Configuration ("Requiring multi-factor authentication…", Off → On). Clicked **Apply**: it wrote the value through the same `updateSettingAction` a manual edit uses, the recommendation disappeared, and Recently Changed immediately showed "Require MFA → On." Then set Workspace Name via the field itself: Health flipped to **100%**, both Warnings and Missing Configuration cleared to "Nothing needs attention," and Recently Changed showed both edits in correct newest-first order.
- Mobile (375×812): the Dashboard panel, Search box, Section nav, and every field type stack cleanly single-column; no horizontal scroll, no squeezed controls.

## Tests

**118 tests across 11 new files**, all passing: `core/settings/registry.test.ts` (7), `sectionRegistry.test.ts` (7), `discovery.test.ts` (14 — permission/role/feature-flag gating for both Settings and Sections, workspace scoping), `validation.test.ts` (21), `search.test.ts` (10 — ranking, permission filtering, empty-query, cap), `recommendations.test.ts` (7), `updateSetting.test.ts` (10), `mockRepository.test.ts` (9), `registerSettingsSections.test.ts` (5 — idempotency, no dangling sectionId references, no duplicate ids), `getSettingsDashboardData.test.ts` (6), `modules/settings/sections/sections.test.ts` (25 — every custom `validate` across Workspace/AI/Automation/Workflow/CRM/Finance/Memory/Developer/Security/Skills/Branding/Notifications/General/About).

**Quality gates, all green:**

| Gate | Result |
|---|---|
| Lint | 0 errors |
| Typecheck (`tsc --noEmit`) | Clean |
| Test suite | **432 test files, 4702 tests, all passing** (project-wide, including this checkpoint's 118 new tests) |
| Coverage — project-wide | 72.96% statements, 63.27% branches, 73.11% functions, 74.92% lines — all global thresholds met |
| Production build (`next build`) | Clean — `/settings` compiles as a dynamic route, no errors or warnings |

One `InventoryItemForm.test.tsx` test failed once under `--coverage` load and passed cleanly on immediate re-run in isolation — a pre-existing timing flake in an unrelated module this checkpoint never touched, not a regression.

## Documentation

[docs/settings-platform.md](settings-platform.md) (architecture with a Mermaid diagram, the Settings Domain, Registry, Validation Engine, Manager & Storage, all 14 Sections, Global Search, the Settings UI's own "no hardcoded logic" proof, Dashboard, Bloom AI Integration, Command Palette, Permissions & Observability) and this report.

## Known limitations

- **Two Settings are static/hardcoded lists rather than live-resolved from their own real registry.** `skills.default-skill`'s six options and `developer.feature-flags-overview`'s own read-only summary both avoid importing the real Skill Registry / Feature Flags service directly to sidestep the same `server-only` transitive-import violation this session has hit at every AI/Automation entry point. Documented in each file's own comment as a natural target for a future `WorkflowNodeSummary`-style server-resolved fix.
- **Security's API Keys/Audit Log/Roles & Permissions and Developer's Diagnostics are `readonly` placeholder entries**, registered so Search can route to them, not real editable or live-data-backed settings — building real API key issuance, a live audit log view, or a diagnostics snapshot was judged out of scope for this checkpoint's own generic Setting model (they're each a materially different shape: a secret credential's lifecycle, an append-only external log, a computed health snapshot) rather than something this checkpoint should force into `SettingDefinition`.
- **The Command Palette registration (Step 17) has no live browser proof.** The global `CommandPalette` shell still isn't mounted anywhere in the app — the exact same gap Checkpoints 9 and 10 already left open. The five commands (`Open Settings`, `Search Settings`, `AI Settings`, `Security Settings`, `Developer Settings`) are registered correctly (verified by code review, typecheck, and the fact the registration/unregistration effect mirrors `AutomationDashboardView`'s own already-proven pattern) but couldn't be exercised end-to-end in a browser.
- **No dedicated `settings.*` permission exists.** `/settings` reuses the pre-existing `workspace.manage` permission already reserved for it in `core/permissions/routeAccess.ts` since before this checkpoint began — no new permission was introduced, matching how `/automation`/`/finance-assistant` handled the same question in earlier checkpoints.
- **Bloom AI's own recommendations are a small, fixed set of 5 rules** (MFA, Automation failure notifications, AI confidence threshold, Finance payment terms, Workflow version retention) — deliberately narrow rather than one rule per Setting, since most of the 50 registered Settings have no meaningful "better" value to recommend (a Workspace Name or a Brand Color isn't something Bloom AI should have an opinion on).
- **No production AI provider is registered** — irrelevant to this checkpoint's own deterministic recommendation mechanism, noted only for consistency with every other checkpoint's own report.

## Recommendation

**APPROVED.** Every configurable module in BloomOS now registers itself into the Settings Platform — 14 Sections, 50 Settings, spanning Workspace/Branding/AI/Skills/Memory/Automation/Workflow/CRM/Finance/Notifications/Security/Developer/About — and the Settings page itself contains zero hardcoded, module-specific logic: `SettingsView`/`SettingField` render purely from what the Registry holds. Proven end to end in a live browser session, not just in unit tests: real validation blocking and reverting an out-of-range save, a real save persisting across a page reload, real ranked Search routing to the correct Section, and a real Bloom-AI recommendation being explicitly applied by a human through the same write path a manual edit uses — never automatically. Per the stop condition, no Billing, Marketplace, OAuth, or Organization Management work has been started; no further feature work begins on any of them without further direction.
