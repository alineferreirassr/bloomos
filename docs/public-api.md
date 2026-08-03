# BloomOS Public API

The Public API is a read-only, versioned REST API that lets a trusted third-party application read a Workspace's own BloomOS data — CRM, Finance, Documents, Workflow, Analytics, and Client Portal — outside the BloomOS product itself. It is not an internal service layer: every endpoint reuses the exact same repository functions, permission-shaped data, and business logic the internal app already runs, through one new seam (`createApiHandler`) rather than a parallel implementation.

```
Third-party application
       ↓  Authorization: Bearer <api key secret>
REST API (app/api/v1/*)
       ↓
API Router — createApiHandler() (core/api/handler.ts)
       ↓
Permission Layer — API Key auth + Scope check (core/api/auth.ts, core/api/errors.ts)
       ↓
Existing BloomOS Services — the same repositories/managers/engines the internal app calls
       ↓
CRM · Finance · Documents · Workflow · Analytics · Client Portal
```

## Authentication — API Keys

There is no OAuth this checkpoint (explicitly out of scope — see "Future OAuth support" below). Instead, every request authenticates with a **Workspace-scoped API Key**:

```
Authorization: Bearer bloom_sk_...
```

- **Issued** from the Developer Console (`/developer`, `workspace.manage` permission), which calls `createApiKeyAction()` (`src/modules/api/manageApiKeysActions.ts`).
- **Secret shown once** — at creation or rotation, never again. Only a SHA-256 hash (`key_hash`) and a 12-character display prefix (`key_prefix`, e.g. `bloom_sk_dem…`) are stored, mirroring `lib/team/invitationToken.ts`'s own "never store a plaintext secret" discipline (`src/lib/api/apiKeyToken.ts`).
- **Tracked**: `name`, `created_at`, `last_used_at` (updated on every successful authentication), `scopes`, `revoked_at`, `rotated_at`.
- **Rotated** — issues a brand-new secret for the same Key record (same id/name/scopes/history); the old secret stops authenticating immediately.
- **Revoked** — marks the Key `revoked_at`, never deletes it, so its usage history stays visible in the Developer Console.

A request with no `Authorization` header, a malformed header, an unknown secret, or a revoked Key's secret all receive the identical generic response — the API never reveals *which* of those was true, the same "no information leak on auth failure" discipline every internal Server Action in this codebase already follows:

```json
{ "error": { "code": "unauthorized", "message": "Missing or invalid API Key. Provide it as: Authorization: Bearer <api key secret>." } }
```

A demo Key (`Demo Integration`, all six `.read` scopes) is auto-seeded per Workspace the first time the Developer Console loads, with a fixed, publicly-documented secret — precisely because it's a demo credential, never a real one:

```
bloom_sk_demo_00000000000000000000000000000000
```

## Scopes

Every endpoint validates exactly one scope (`src/types/apiScope.ts`) — a vocabulary deliberately separate from the internal `Permission` enum, since a third-party integration's trust boundary is not the same thing as an internal member's role:

| Scope | Grants read access to |
|---|---|
| `crm.read` | Clients, Events, Proposals, Search |
| `crm.write` | *Reserved* — issuable, listed in the Developer Console, but no endpoint checks it yet (see Known limitations) |
| `finance.read` | Invoices, Receipts, Outstanding Balance, Transactions |
| `documents.read` | Templates, Documents, Versions, Downloads |
| `workflow.read` | Workflow list/details, Simulation history, Templates |
| `analytics.read` | Metrics, Dashboard summaries, KPI Cards, Executive Summary |
| `portal.read` | Portal Users, Timeline, Checklist, Messages metadata, Notifications |

A Key without the scope an endpoint requires gets:

```json
{ "error": { "code": "forbidden", "message": "This API Key does not have the required \"finance.read\" scope." } }
```

Scopes are checked in `createApiHandler` before the route handler ever runs — a route can never accidentally skip its own check.

## Versioning

Every endpoint lives under `/api/v1/*` — a `v1` namespace, not a header or query-param scheme. A future breaking change ships as `/api/v2/*` alongside `/api/v1/*`, never a silent behavior change to an existing path.

## Response envelope

Every response is JSON, with exactly one of two shapes:

```json
{ "data": { ... }, "meta": { "page": 1, "perPage": 25, "total": 42, "totalPages": 2 } }
```
```json
{ "error": { "code": "not_found", "message": "No client with id \"...\" was found." } }
```

`meta` is present only on paginated list endpoints.

## Errors

| Code | Status | When |
|---|---|---|
| `unauthorized` | 401 | Missing/invalid/revoked API Key |
| `forbidden` | 403 | Valid Key, missing scope |
| `not_found` | 404 | The resource (or a cross-Workspace id) doesn't exist |
| `invalid_request` | 400 | A bad query param (e.g. `?window=decade`) or a declined AI generation |
| `rate_limited` | 429 | The rate-limit hook declined (placeholder — always allows today) |
| `internal_error` | 500 | Anything unexpected — the original message is logged server-side, never returned to the caller |

Every route handler is built through the one shared `createApiHandler()` (`src/core/api/handler.ts`), so this mapping is enforced in exactly one place, not per-route.

## Pagination, filtering, sorting

List endpoints accept `?page=` (default 1) and `?per_page=` (default 25, max 100) — see `src/core/api/pagination.ts`. Most also accept endpoint-specific filters (`?search=`, `?status=`, `?client_id=`, `?include_archived=`, etc. — see `docs/openapi.md` for the exact param list per endpoint) and `?sort=field` / `?sort=-field` for descending (`src/core/api/sorting.ts`).

## Rate limiting

`checkRateLimit()` (`src/core/api/rateLimit.ts`) is called on every request and already returns a real `429 rate_limited` response with a real observability log line when it declines — but its *policy* is a placeholder: it always returns `{allowed: true}` today. A future checkpoint only changes that one function's body; every call site, response shape, and log line is already correct. This mirrors the same "structurally real, policy deferred" seam Checkpoint 15's own `MetricRefreshPolicy` ("future caching") already established.

## Field redaction

A handful of endpoints map an internal record to a public-safe shape rather than returning it raw (`src/core/api/mappers.ts`):

- **Clients** (`toApiClient`) — excludes every field `types/client.ts` itself already marks "internal-only; never expose" (allergies, accessibility needs, dietary restrictions, do-not-call, surprise-event confidentiality, emergency contacts).
- **Events** (`toApiEvent`) — excludes `internal_summary` (its own name says internal), `confidentiality_notes`, and `surprise_event` (a surprise defeats its own point if a third-party integration can read it).
- **Portal Users** (`toApiPortalUser`) — excludes `auth_user_id`, a raw Supabase Auth identifier with no operational meaning to an integration.

Every other domain (Invoices, Payments, Proposals, Documents, Workflows) has no such marker in its own type and is returned as internally read, unchanged — the redaction policy is "strip what the type itself already flags," never an invented, unreviewed rule per field.

## Future OAuth support

OAuth is explicitly out of scope this checkpoint (see Non-Goals). The API Key model was chosen so that adding OAuth later is additive: `ApiAuthContext` (`{apiKeyId, workspaceId, scopes}`) is already the one shape `createApiHandler` passes to every route — an OAuth-issued access token would resolve to the exact same shape (workspace + scopes) through a new `resolveApiAuth` implementation, with zero changes to any of the 34 route handlers themselves. `crm.write` is already registered as an issuable scope for the same reason: the scope vocabulary a future write API and a future OAuth consent screen would both need already exists, even though nothing acts on it yet.

## Developer Console

`/developer` (`workspace.manage` permission) is the one place a Workspace member manages this API:

- **API Keys** — list, create (name + scope checkboxes), rotate, revoke. A created/rotated secret is shown exactly once in a dedicated dialog with a copy button.
- **Usage** — total requests, error count, average latency, and a per-endpoint breakdown, all read from the same request log every route handler writes to (`src/lib/data/core/api/apiUsageStore.ts`).
- **Documentation** — links to this file and to the live OpenAPI document at `/api/v1/openapi.json`.

See `docs/openapi.md` for the full endpoint reference and `docs/v2-checkpoint-16-public-api.md` for the certification report.
