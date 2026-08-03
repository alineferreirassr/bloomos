# BloomOS Public API — OpenAPI Reference

The Public API publishes a complete [OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.0) document, live, at:

```
GET /api/v1/openapi.json
```

This endpoint is deliberately **unauthenticated** — the one exception to every other `/api/v1/*` route — since an OpenAPI document is meant to be fetchable by tooling (Swagger UI, Postman, codegen) before a caller has ever obtained an API Key, the same convention every public REST API's own `/openapi.json`/`/swagger.json` already follows.

## How it's generated

`src/core/api/openapi.ts` exports one hand-curated `OPENAPI_DOCUMENT` object — not an auto-discovery registry that walks the `app/api/v1` route tree at build time. Every endpoint this checkpoint built is listed explicitly, with its own summary, description, parameters, and response schemas. This is a deliberate tradeoff: an auto-generated spec would silently drift the moment a route's own query-param parsing changed without a matching edit to the generator, which is worse than a spec that requires a deliberate, reviewable edit to stay accurate. `src/app/api/v1/openapi.json/route.ts` serves the object as-is via `NextResponse.json()`.

## Reading the document

- **`info`** — title, version (`1.0.0`), and a plain-language description.
- **`servers`** — `/api/v1`.
- **`tags`** — one per domain (CRM, Finance, Documents, Workflow, Analytics, Portal), each with a one-line description.
- **`security`** / **`components.securitySchemes.ApiKeyAuth`** — declares the Bearer API Key scheme (`type: http`, `scheme: bearer`) every endpoint requires.
- **`paths`** — one entry per endpoint. Every operation carries a custom `x-required-scope` extension naming the exact `ApiScope` it checks (OpenAPI's own `security`/OAuth2 flows aren't used to express this, since this checkpoint's own Non-Goal excludes OAuth) — the same scope is also spelled out in the operation's own `description`.
- **`components.schemas`** — the response body shape for every resource (`Client`, `Event`, `Invoice`, `PortalUser`, …), each referenced via `$ref` from its operation's `200` response.

Every operation also declares its `401`/`403`/`500` responses (referencing the shared `Error` schema) alongside its own success response and any endpoint-specific error (`404` for a by-id lookup, `400` for a bad query param).

## Endpoint reference

All 34 endpoints are `GET`-only (no public write endpoints, per this checkpoint's own Non-Goals).

| Path | Scope | Notes |
|---|---|---|
| `/clients` | `crm.read` | `?search=` `?status=` `?include_archived=` `?sort=name\|created_at` + pagination |
| `/clients/{id}` | `crm.read` | |
| `/events` | `crm.read` | `?search=` `?status=` `?client_id=` `?date_from=` `?date_to=` `?include_archived=` `?sort=title\|event_date\|created_at` + pagination |
| `/events/{id}` | `crm.read` | |
| `/proposals` | `crm.read` | `?event_id=` narrows; otherwise recent Proposals for the Workspace |
| `/proposals/{id}` | `crm.read` | |
| `/search` | `crm.read` | `?q=` (required) — Clients + Events, 20 results each |
| `/invoices` | `finance.read` | `?status=` `?client_id=` `?event_id=` `?overdue_only=` `?include_archived=` `?sort=issue_date\|due_date\|total_minor\|created_at` + pagination |
| `/invoices/{id}` | `finance.read` | |
| `/receipts` | `finance.read` | `?invoice_id=` `?client_id=` |
| `/finance/outstanding-balance` | `finance.read` | Workspace-wide summary, no params |
| `/transactions` | `finance.read` | `?status=` `?client_id=` `?invoice_id=` `?refunds_only=` `?sort=transaction_date\|amount_minor` |
| `/templates` | `documents.read` | |
| `/templates/{id}` | `documents.read` | |
| `/documents` | `documents.read` | Summary shape — no `content` block |
| `/documents/{id}` | `documents.read` | Full record, including `content` |
| `/documents/{id}/versions` | `documents.read` | |
| `/documents/{id}/versions/{version}` | `documents.read` | |
| `/documents/{id}/download` | `documents.read` | Plain-text export, JSON envelope |
| `/workflows` | `workflow.read` | Never a way to execute a Workflow |
| `/workflows/{id}` | `workflow.read` | |
| `/workflows/{id}/simulations` | `workflow.read` | Simulation run history only |
| `/workflow-templates` | `workflow.read` | Global, not Workspace-scoped |
| `/workflow-templates/{id}` | `workflow.read` | |
| `/analytics/metrics` | `analytics.read` | `?window=` (`today\|7d\|30d\|90d\|year`, default `30d`) |
| `/analytics/summary` | `analytics.read` | `?window=` — grouped-by-category + Overview (also serves as "KPI Cards") |
| `/analytics/executive-summary` | `analytics.read` | `?window=` — AI-generated narrative |
| `/portal/users` | `portal.read` | |
| `/portal/users/{id}/timeline` | `portal.read` | |
| `/portal/users/{id}/checklist` | `portal.read` | |
| `/portal/messages` | `portal.read` | Thread metadata only — never message bodies |
| `/portal/notifications` | `portal.read` | `?unread_only=` |

## Using the document

Paste the live `/api/v1/openapi.json` response into [Swagger UI](https://swagger.io/tools/swagger-ui/), Postman's "Import → Link," or any OpenAPI 3.1-compatible code generator to produce a typed client. No further transformation is needed — the document is self-contained (no external `$ref`s).

See `docs/public-api.md` for authentication, scopes, versioning, errors, and pagination in prose, and `docs/v2-checkpoint-16-public-api.md` for the certification report.
