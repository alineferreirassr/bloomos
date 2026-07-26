# Testing

**Status: baseline established (Stabilization Checkpoint 1).** Coverage reporting, coverage thresholds, critical-commercial-flow protection, and a documented flaky-test investigation all exist as of this checkpoint. The project already had a large Vitest + Testing Library suite before this — this checkpoint didn't replace it, it measured it and put a floor under it.

## How to run tests

```bash
npm run test                    # full suite, no coverage instrumentation (fastest)
npm run test:coverage           # full suite with coverage — text summary + HTML + JSON reports
npm run test:coverage:services  # coverage scoped to the Services module's own test files
npm run test:coverage:critical  # coverage scoped to the critical commercial-flow test files
npm run test:ci                 # lint → typecheck → test:coverage, in one deterministic command
```

`test:coverage:services` and `test:coverage:critical` restrict **which test files run** (a path filter passed to Vitest), not which source files coverage is measured against — `coverage.include` stays the project-wide glob in every command. When reading their output, look at the per-directory rows for the module you're scoping to (e.g. `src/modules/services`) and ignore the 0%-covered rows for everything else — those files simply had no tests execute in that run, not zero real coverage.

The HTML report opens at `coverage/index.html` after any `test:coverage*` command. `coverage/coverage-final.json` and `coverage/coverage-summary.json` are the machine-readable outputs (per-file and aggregate respectively) — `/coverage` was already gitignored before this checkpoint; nothing generated here should ever be committed.

## Current test infrastructure (as found, before this checkpoint)

- **Runner**: Vitest 4.1.10, `jsdom` environment, single `vitest.setup.ts` running `@testing-library/jest-dom`'s matchers and a global `afterEach(() => cleanup())`. No coverage provider was installed.
- **Scripts**: `test` (`vitest run`, already non-watch/deterministic) was the only test script. No `test:coverage`, no `test:ci`, no CI provider config anywhere in the repo.
- **Mocking**: two consistent, hand-written patterns, no third-party mocking library:
  - **Repository-level tests** (`mockRepository.test.ts` per domain) call the real mock repository functions directly against the real in-memory mock stores (`src/lib/data/mock/*Store.ts`), reset between tests via each domain's own reset helper or the umbrella `resetAllMockData()`. These are the closest thing this codebase has to integration tests — real business-rule enforcement (validation, relationship checks, status-transition legality), not stubbed.
  - **Supabase-repository tests** (`supabaseRepository.test.ts` per domain) mock `@/lib/supabase/client`'s `createClient` and hand-roll a fluent query-builder recorder (`.select()/.eq()/.insert()/...` each pushed onto a `calls` array, responses drained from a queued array) — there is no external Supabase-testing library in use.
  - **Component tests** `vi.mock("@/lib/data", ...)` (or the relevant feature hook) and assert on rendered output / `userEvent` interactions via Testing Library.
- **No browser or E2E infrastructure exists.** No Playwright/Cypress config, no `e2e/` directory. Every one of the ~3650 tests in this suite is a unit or component test running in `jsdom`.

This checkpoint did not replace any of this — it instrumented the existing suite with `@vitest/coverage-v8` (matching the installed Vitest version exactly, the provider Vitest itself recommends and the only one that needed no extra Babel/instrumentation setup for this Vite-based project).

## Coverage baseline

Measured 24 Jul 2026, full suite, `@vitest/coverage-v8`:

| Scope | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| **Repo-wide** | 72.45% | 62.85% | 72.77% | 74.64% |
| **`src/modules/services/**`** | 80.92% | 78.14% | 69.17% | 81.78% |

Branches is the weakest dimension everywhere — expected, given how much of this codebase is conditional rendering (loading/error/empty states) and validation branches that only some tests exercise. Services' own weak spot is Functions (69.17%), concentrated in `src/modules/services/hooks` (50.64% functions) — most hooks are thin `useQuery`/`useMutation` wrappers exercised indirectly through their consuming component's tests rather than called directly, so a hook's own file often shows lower function coverage than the feature actually has.

## Configured thresholds

```ts
// vitest.config.ts
thresholds: {
  statements: 70, branches: 58, functions: 68, lines: 72,
  "src/modules/services/**": { statements: 76, branches: 72, functions: 64, lines: 76 },
}
```

**Reasoning**: every threshold sits 3–6 points under its measured baseline — enough margin to absorb normal variance between runs (which files a given change happens to touch) without the build flapping on noise, tight enough that a real regression (a change that stops exercising a meaningful slice of code, not just shifts a percentage point) still fails `test:coverage`/`test:ci`. Branches got the widest margin (5–6 points) since it's both the lowest baseline and the most sensitive to test order. These are a **floor for today**, not a target — see "Raising thresholds over time" below.

**Exclusions and reasoning** — kept deliberately short, per the checkpoint's own instruction not to hide low coverage behind broad exclusions:

- `**/*.test.{ts,tsx}` — the tests themselves.
- `**/testUtils.{ts,tsx}` — test-only fixture factories (e.g. `makeClient`, `makeService`), never imported by production code.
- `src/types/**` and `**/*.d.ts` — pure type declarations with no runtime code to cover; excluding them is cosmetic (v8 measures executed bytecode, so a file with only `interface`/`type` declarations has nothing to instrument either way) rather than a coverage-hiding move.

Nothing else is excluded. `src/app/**` route files (many of them thin `export default function Page() { return <SomeView />; }` wrappers) are **included** — they pull the aggregate number down slightly, and that's the honest number, not something to exclude away.

### Raising thresholds over time

Ratchet, don't leap: after a module gets meaningfully more test coverage (e.g. Part of a future stabilization checkpoint adds tests to `notes`, currently 0%, or to Purchases/Inventory's untested `mappers.ts`/`stats.ts` files), re-run `npm run test:coverage`, read the new real numbers from the summary table, and move each threshold up to a few points under the *new* baseline — the same margin logic as above, never a round number picked in advance. Add a new per-module override (matching the `"src/modules/services/**"` pattern) once that module's own coverage is high enough to be worth protecting specifically, rather than raising the global floor to match it (which would make every *other* module's honest low coverage suddenly fail the build).

## Known gaps (coverage-adjacent, not fixed in this checkpoint)

- `src/modules/notes` (used by nine other modules' detail pages) has 0% coverage on both its UI and the shared data layer beneath it — flagged by the architecture audit as the single highest-blast-radius testing gap in the repo. Out of scope here; this checkpoint measures and protects, it doesn't backfill module-by-module coverage.
- `src/modules/purchases` and `src/modules/inventory` sit well below the rest of the app (their own `mappers.ts`/`*Stats.ts` files are untested, and neither has a `mockRepository.test.ts`).
- `src/modules/team`'s two UI files (`TeamView.tsx`, `NewInvitationModal.tsx`) are untested (0%), though the permission/invitation logic beneath them is well covered.

## Flaky-test status

Three tests were observed timing out under a full-suite parallel run, in earlier checkpoints, despite passing reliably when run in isolation:

- `src/components/ui/Tabs.test.tsx` — "renders tablist/tab/tabpanel roles..."
- `src/modules/services/components/TemplateBuilderSidebar.test.tsx` — "lists missing required categories with working navigation"
- `src/modules/services/hooks/useEventServiceOverrideMutations.test.tsx` — "preserves the shared error contract on validation failure..."

**Investigation** (this checkpoint): read all three files in full, plus every file in the repo using `vi.useFakeTimers()` (only two: `Toast.test.tsx`, `Tooltip.test.tsx`, both of which correctly pair every `useFakeTimers()` with a matching `useRealTimers()`), and checked for shared module-level mutable state (none found — every mock in all three files is scoped per-file via `vi.mock`).

Ruled out, with evidence:
- **Fake timer leakage** — none of the three flaky files use fake timers themselves, and the only two files in the repo that do clean up correctly.
- **Missing cleanup** — the global `afterEach(() => cleanup())` in `vitest.setup.ts` runs for every file; no test-specific cleanup is missing.
- **Shared global state** — each file's mocks are function/module-scoped, not shared singletons.
- **Insufficient timeout as a root cause in itself** — the `Tabs.test.tsx` failure was on a fully **synchronous** test (no `await` anywhere in its body). A synchronous test cannot itself "run slowly" — if it misses a timeout, the JS thread was never scheduled to run it in time, not that the test did too much work.

**Most defensible remaining explanation**: Vitest's default parallel worker execution creates real CPU/scheduling contention on this environment when running the full ~3650-test suite at once. All three failures are consistent with that: a synchronous test starved of a scheduling turn, a single-click `userEvent` interaction whose internal `setTimeout` got delayed, and a React Query error-state flush that didn't complete inside one `act()` await under heavy concurrent load. None of the three reproduce in isolation (re-confirmed this checkpoint: all three pass individually and as a group of three).

**Containment applied**: raised `testTimeout` from Vitest's default (5000ms) to 10000ms globally, in `vitest.config.ts`. This is a modest, evidence-based safety margin — not a blanket "increase every timeout" fix, and specifically not the larger lever of bounding worker-thread concurrency (`coverage`/`pool` options), which would slow down every future full-suite run unconditionally and deserves its own deliberate decision rather than being bundled into a coverage-baseline checkpoint. Two full-suite runs after this change (one with coverage instrumentation, one without) both passed cleanly (309/309 files, 3655/3655 tests).

**If this recurs**: the next escalation, in order of invasiveness, is (1) confirm it's still all-three-together and still only under full parallel load, (2) bound `test.poolOptions.threads.maxThreads` to a fraction of the machine's CPU count to trade suite duration for reliability, (3) as a last resort, mark the specific assertion in `useEventServiceOverrideMutations.test.tsx` with an explicit `await waitFor(...)` around `result.current.error` instead of asserting immediately after `act()`, which would make that one assertion robust to scheduling delays without touching the other two files.

## Critical-flow coverage

The commercial path — Lead → Client → Event → Contract → Finance → Service Assignment — was already partially protected before this checkpoint. This checkpoint added only the missing connections, not a re-test of any single module's own rules.

| Connection | Covered by | Added this checkpoint? |
|---|---|---|
| Lead → Client (conversion, dedup-by-email, notes/timeline handoff) | `src/modules/leads/services/LeadConversionService.test.ts` | No — already thorough |
| Client → Event (booking, pending-recovery on partial failure, resume) | `src/lib/data/booking.test.ts` | No — already thorough |
| Event → Contract (relationship enforced, not assumed) | `src/lib/data/criticalCommercialFlow.test.ts` | **Yes** |
| Contract → Finance (Invoice references a Contract/Event/Client consistently; `getEventFinancialSummary` reflects it and never leaks across Events) | `src/lib/data/criticalCommercialFlow.test.ts` | **Yes** |
| Event → Service Assignment (assignment succeeds independently of Contract/Finance state; the two real read-composition points — `getServiceAssignments`, `getAssignmentWorkspace` — both reflect it) | `src/lib/data/criticalCommercialFlow.test.ts` | **Yes** |
| Workspace-id propagation across the whole chain | `src/lib/data/criticalCommercialFlow.test.ts` | **Yes**, with a caveat below |

**On "permissions and organization isolation"**: the mock data layer models exactly one workspace (`CURRENT_WORKSPACE_ID`), so there is no second tenant to test cross-workspace isolation against at the mock level — building one would mean inventing a multi-tenant mock fixture that doesn't reflect how the rest of the mock suite is structured, which the checkpoint's own instructions rule out ("do not invent domain behavior that does not exist"). What the new test **does** verify is that `workspace_id` propagates correctly, unmutated, through every hop of the chain — Lead → Client → Event → Contract → Invoice → EventService all resolve to the same id. The actual cross-tenant boundary is enforced by Postgres RLS and is already covered, per-domain, by each `supabaseRepository.test.ts`'s assertions on the recorded `.eq("workspace_id", ...)` calls — confirmed by the architecture audit as present and consistent (`is_workspace_member()`) across all 61 tables.

Run `npm run test:coverage:critical` to execute exactly these three files together.

## Services regression check

Every Services Detail tab was checked against its actual rendered component (`src/modules/services/components/ServiceDetailPage.tsx`):

| Tab | Renders | Status |
|---|---|---|
| Overview | `ServiceOverviewTab` | Real |
| Templates | `TemplateBuilderPage` | Real |
| Health | `HealthDashboardPage` | Real |
| Versions | `VersionHistoryPage` | Real |
| Assignments | `ServiceAssignmentsPage` | Real |
| Notes | `ServiceComingSoonPanel` | **Placeholder** |
| Timeline | `ServiceComingSoonPanel` | **Placeholder** |

Notes and Timeline are confirmed product gaps, not a regression introduced by this checkpoint — this matches the architecture audit's own finding exactly (Services is the only major detail page in the app still showing "coming soon" for a system, `core/notes`/the Timeline activity feed, that's fully live everywhere else — Clients, Vendors, Purchases, Leads, Inventory, Contracts, Finance, Documents, and Events all render the real thing). `ServiceDetailPage.test.tsx` already has a passing test asserting this exact placeholder copy; no new test was needed to confirm it. **Not implemented in this checkpoint**, per its own scope — carried forward on the roadmap as Phase 2 ("Close the Services ↔ Events Loop") from the architecture audit.

## Architectural verification

This checkpoint touched only test infrastructure and test files — `vitest.config.ts`, `package.json` scripts, one new test file, and this document. No production source file changed. The Component → Feature Hook → React Query → Query Layer → Repository → Supabase layering audited in the architecture-audit checkpoint is unaffected; this checkpoint neither improved nor worsened it.
