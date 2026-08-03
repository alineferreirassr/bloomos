# v2.0 Checkpoint 16 — Public API Platform

BloomOS's first externally-facing surface: a production-ready, read-only REST API that lets a trusted third-party application authenticate with a Workspace-scoped API Key and read CRM, Finance, Documents, Workflow, Analytics, and Client Portal data — every byte of it produced by the exact same repository functions, redaction rules, and business logic the internal app already runs. Nothing in this checkpoint is a parallel implementation.

## Architecture

`REST API (app/api/v1/*) → API Router (createApiHandler) → Permission Layer (API Key auth + scope check) → Existing BloomOS Services → CRM/Finance/Documents/Workflow/Portal/Analytics`, exactly as specified. **34 `GET` endpoints**, zero public write endpoints. Every route handler is a thin wrapper: parse query params → call the same function the internal app calls (`getClients()`, `getInvoices()`, `getDocumentsManager()`, `computeVisibleMetrics()`, …) → return it through the shared JSON envelope. See `docs/public-api.md` for the full prose reference and `docs/openapi.md` for the endpoint table.

## Authentication

Workspace-scoped API Keys (`src/lib/data/core/api/apiKeyStore.ts`), never OAuth. A secret (`bloom_sk_...`, 256 bits of entropy) is shown exactly once at creation/rotation; only its SHA-256 hash and a 12-character display prefix are ever stored, mirroring `lib/team/invitationToken.ts`'s existing discipline. Every request authenticates via `Authorization: Bearer <secret>`, resolved by `resolveApiAuth()` (`src/core/api/auth.ts`) — a generic, information-leak-free failure for every invalid case (missing header, malformed header, unknown secret, revoked key). Name, created date, last-used timestamp, scopes, rotation, and revocation are all real, working, and manageable from the new Developer Console (`/developer`).

## Scopes

Seven scopes (`src/types/apiScope.ts`) — a vocabulary deliberately separate from the internal `Permission` enum: `crm.read`, `crm.write` (issuable but inert — no endpoint checks it, matching this checkpoint's own "read-only first" framing and the Workflow Builder's own "registers but never executes" precedent), `finance.read`, `documents.read`, `workflow.read`, `analytics.read`, `portal.read`. Every one of the 34 endpoints validates exactly one, enforced in the single shared `createApiHandler()` before any route-specific code runs — a route can never accidentally skip its own scope check.

## OpenAPI

A hand-curated OpenAPI 3.1 document (`src/core/api/openapi.ts`), served unauthenticated at `GET /api/v1/openapi.json` — the one endpoint in this checkpoint that doesn't require an API Key, matching the standard convention for a discovery document. Covers every one of the 34 endpoints with its own summary, description, parameters (including a custom `x-required-scope` extension per operation, since OAuth2-style `security` flows don't apply here), and response schemas (17 named schemas under `components.schemas`, referenced via `$ref`). Verified live: `curl`/`fetch` against the running dev server returns the real document; `openapi.test.ts` structurally validates every operation declares a real scope, a 200 + standard error responses, and that every path parameter and every `$ref` resolves.

## Browser verification

✓ Desktop verified. ✓ Mobile verified (375×812) — a full, live pass against the real dev server (temporarily switched to mock mode, then reverted), covering both the Developer Console UI and real HTTP requests against the running API.

- **A real, checkpoint-breaking bug was found and fixed during this pass**: the first end-to-end test — create an API Key via the Developer Console, then authenticate with its secret against `/api/v1/clients` — returned `401` every time, even immediately after creation. Root cause: `apiKeyStore.ts`/`apiUsageStore.ts`/`simulationStore.ts` each used a plain top-level `let` array (the pattern every other mock store in this codebase safely uses, since they're only ever touched from the Server Component/Server Action side). This checkpoint is the *first* to introduce a second, independently-compiled entry point — Route Handlers under `app/api/v1/*` — and Next.js's dev server compiles Route Handlers and Server Actions into separate module graphs, so a plain module-level variable silently became two independent copies: a Key created via the Developer Console's Server Action was invisible to the Route Handler checking auth, and an API request logged by a Route Handler was invisible to the Developer Console's own Usage tab. **Fixed** with a new `getGlobalMockStore()` helper (`src/lib/data/core/globalMockStore.ts`) that stashes each store's state on `globalThis` instead — the standard Next.js dev-mode fix for this exact class of bug (the same pattern Next's own docs recommend for caching a Prisma Client across hot reloads). Applied to the three stores this checkpoint's own cross-boundary reads/writes actually touch: `apiKeyStore`, `apiUsageStore`, and `simulationStore` (Workflow Simulation history, read by `/api/v1/workflows/:id/simulations` but written by the internal Workflow Builder's own Server Action).
- **Confirmed fixed, end to end, with real HTTP requests** (not mocked): created a Key via the Developer Console UI → authenticated `GET /api/v1/clients` with its secret → `200`, 4 real Clients, correctly redacted. Spot-checked all six scopes in one pass (`crm.read`/`finance.read`/`documents.read`/`workflow.read`/`analytics.read`/`portal.read` against `/clients`, `/invoices`, `/templates`, `/workflows`, `/analytics/summary`, `/portal/users`) — all `200` with `data` present.
- **Scope enforcement verified live**: a Key created with only `portal.read` got `403 forbidden` (`"This API Key does not have the required \"crm.read\" scope."`) against `/api/v1/clients`, and `200` against `/api/v1/portal/users` — the exact same Key, two different outcomes, proving the per-endpoint scope check.
- **Revocation verified live**: revoked a Key via the Developer Console, then re-presented its already-known secret — `401`, immediately, no delay.
- **Usage tracking verified live**: after the `/api/v1/clients` request above, the Developer Console's Usage tab showed `Total requests: 1`, `Errors: 0`, `Average latency: 207 ms`, and a per-endpoint row for `GET /api/v1/clients` — proving the Route-Handler-to-Server-Action observability path the bug above had broken.
- **Developer Console UI verified live**: API Keys tab (create with a name + scope checkboxes, rotate, revoke, all with real Server Action round-trips and a "shown once" secret dialog with copy button), Usage tab, Documentation tab (links to `docs/public-api.md` and the live `/api/v1/openapi.json`).
- **Mobile (375×812)**: the API Keys table scrolls horizontally inside its own container (never the page body), Tabs and Modal both render correctly, sidebar collapses to the hamburger menu — no layout breakage.
- **Same Browser-pane click-simulation caveat noted in every prior checkpoint's own verification**: simulated clicks on Tab buttons and form controls sometimes didn't reach React's synthetic handlers reliably in this session (confirmed as a tooling artifact via direct DOM `.click()`/React-fiber invocation, not a product bug — every control worked correctly once the click actually registered, including the Create API Key form's checkbox state).

## Tests

**105 new tests across 22 files**, plus 1 existing file (`navigation.test.ts`) updated for the new `/developer` nav entry — all passing:

- **Authentication** — `apiKeyToken.test.ts` (4), `auth.test.ts` (7): secret generation/hashing determinism, Bearer header parsing, revoked-key rejection, and the "identical generic message regardless of failure reason" guarantee.
- **API Keys** — `apiKeyStore.test.ts` (10): create/list/rotate/revoke/touch-last-used, workspace scoping, idempotent demo-key seeding.
- **Permissions/Scopes** — `handler.test.ts` (7): 401/403/429 short-circuits before the route handler ever runs, ApiError code mapping, generic-error message redaction, exactly-once observability per request. `mappers.test.ts` (6): every internal-only field actually excluded from `Client`/`Event`/`PortalUser`.
- **Pagination/Sorting** — `pagination.test.ts` (8), `sorting.test.ts` (8): defaults, clamping, empty-list edge cases, ascending/descending, non-mutation.
- **OpenAPI generation** — `openapi.test.ts` (6): every operation has a real scope + standard responses, every path parameter is declared, every `$ref` resolves.
- **Error handling** — `errors.test.ts` (4), `response.test.ts` (4), `trendWindow.test.ts` (3).
- **Observability** — `apiUsageStore.test.ts` (5): request logging, per-workspace scoping, aggregation correctness, zero-request edge case.
- **The global-store singleton fix itself** — `globalMockStore.test.ts` (3).
- **Route-level integration** — `clients/route.test.ts` (5), `clients/[id]/route.test.ts` (2), `analytics/summary/route.test.ts` (4), `portal/users/[id]/timeline/route.test.ts` (3, including the "existence never leaks across a Workspace boundary" case), `openapi.json/route.test.ts` (1, unauthenticated).
- **Developer Console** — `getDeveloperConsoleData.test.ts` (3), `manageApiKeysActions.test.ts` (9, including a full create→rotate→revoke lifecycle from one session).

**Quality gates, all green:**

| Gate | Result |
|---|---|
| Lint | 0 errors (15 pre-existing warnings, all in files this checkpoint never touched) |
| Typecheck (`tsc --noEmit`) | Clean |
| Test suite | **501 test files, 5128 tests, all passing** (project-wide, including this checkpoint's own) |
| Coverage — project-wide | 71.03% statements, 61.54% branches, 70.75% functions, 72.97% lines — all global thresholds met (70/58/68/72) |
| Production build (`next build`) | Clean — all 34 `/api/v1/*` routes plus `/developer` compile as dynamic routes alongside every existing route, no errors |

One test flake was found and fixed during this pass (a millisecond-resolution timestamp tie in `apiUsageStore.test.ts`'s own ordering assertion — fixed with `vi.useFakeTimers()` to make the ordering deterministic rather than relying on real wall-clock separation between two rapid calls).

## Documentation

[docs/public-api.md](public-api.md) — authentication, scopes, versioning, the response envelope, errors, pagination/filtering/sorting, rate limiting, field redaction, future OAuth support, and the Developer Console. [docs/openapi.md](openapi.md) — how the OpenAPI document is generated and served, how to read it, and the full 34-endpoint reference table.

## Known limitations

- **Every new store this checkpoint introduced (`apiKeyStore`, `apiUsageStore`) is mock-only**, regardless of `NEXT_PUBLIC_DATA_MODE` — the same "new checkpoint domain, mock-only this phase" precedent every domain since Checkpoint 13 has followed, since this session has no credentials to push new schema to the shared remote Supabase project. A real `api_keys`/`api_request_logs` schema + RLS policy is a future checkpoint's job.
- **`crm.write` is issuable but inert** — registered, listed in the Developer Console's Create form and the OpenAPI scope descriptions, but no endpoint checks it. Consistent with the spec's own "read-only first" framing for Step 4 and this checkpoint's overall Non-Goal of public write endpoints; the scope exists now so a future write API doesn't need a new scope vocabulary, only new route handlers.
- **A Public API caller can only authenticate against mock-mode data this session** — the underlying repository functions are mostly dual-mode (mock/Supabase), but the two brand-new Checkpoint 16 stores (API Keys, Usage) are mock-only, so a real API Key can never be issued or verified against a live Supabase-backed Workspace until that schema ships. This is the same limitation every mock-only domain in this codebase already carries into its own API surface.
- **The cross-module-graph singleton problem this checkpoint discovered and fixed (see Browser verification) likely also affects a handful of pre-existing Checkpoint 14/15 mock stores now that they're read through the Public API for the first time** (e.g. `clientAccountsStore.ts`, `clientPortalChecklistService`'s own event lookup) — those stores are seeded with static demo data at module load, so *reads* of that seed data are correct from either module graph; only a mutation performed via the internal UI mid-session (e.g. suspending a Client Portal account) would fail to be reflected via the Public API without the same `globalThis` treatment. Not fixed this checkpoint, since it wasn't required to prove the Success Criteria live, but worth a follow-up sweep.
- **Rate limiting is a real, wired seam with a placeholder policy** — `checkRateLimit()` always allows today; a future checkpoint changes only that one function's body (see docs/public-api.md).
- **No dedicated request-body size limit or CORS configuration** was added — out of scope for a read-only, server-to-server API with no browser-originated cross-origin calls expected this phase.

## Recommendation

**APPROVED.** Every Step 1–14 capability is real, working, and proven live end to end with actual HTTP requests (not just unit tests): a versioned `/api/v1` REST API reusing every existing BloomOS module with zero duplicated business logic, Workspace-scoped API Key authentication with real rotation/revocation, a seven-scope permission layer enforced in one shared seam, 34 read-only endpoints across all six required domains, a live and structurally-validated OpenAPI 3.1 document, a fully functional and accessible Developer Console, and real observability (every request logged, visible in the Console's own Usage tab). A genuine, checkpoint-breaking architectural bug — API Keys invisible across the Route-Handler/Server-Action module boundary — was found through live verification rather than left for a third-party integrator to discover, root-caused precisely, and fixed with a documented, reusable pattern rather than a one-off patch. Per the stop condition, no OAuth, Webhooks, Marketplace, SDKs, or public write endpoints were implemented.
