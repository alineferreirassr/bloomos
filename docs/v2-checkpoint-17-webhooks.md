# v2.0 Checkpoint 17 — Webhooks Platform

BloomOS's second externally-facing surface, and its first *outbound* one: a production-ready event delivery platform that lets BloomOS notify a Workspace's own external systems whenever a business event occurs — a Client is created, an Invoice is paid, a Workflow is published. Deliberately an event delivery platform, not an integration layer: BloomOS never knows or acts on what a subscriber does with an event, and no business logic runs inside delivery.

## Architecture

`BloomOS Modules → Event Publisher → Webhook Dispatcher → Delivery Queue + Retry Engine → External Endpoint`, exactly as specified. `publishWebhookEvent()` (`core/webhooks/publisher.ts`) is the one function every Server Action calls — it builds the envelope, resolves subscribed Endpoints, and fires delivery **without awaiting it**, so "Never block application requests" is a property of the function itself, not a convention each of the 11 call sites has to remember. The Dispatcher (`core/webhooks/dispatcher.ts`) performs exactly one signed HTTP POST attempt and never throws; the Retry Engine (`core/webhooks/retryEngine.ts`) loops it with real exponential backoff (1s/2s/4s/8s, capped at 60s) up to 5 attempts, persisting one `WebhookDelivery` record per (event, endpoint) pair.

## Registry

`core/webhooks/eventRegistry.ts` — the same `Map`-based, class-free registry shape every other registry in this codebase uses (Skills, Automations, Workflow Nodes, Metrics). All 17 built-in events self-register from 6 category files under `modules/webhooks/events/`, loaded once via the idempotent `registerBuiltinWebhookEvents()`. Every event carries its own `version` (payload schema versioning, Step 1's "future deprecation" support via an optional `deprecated` field — declared, none in use yet).

11 of 17 events are wired to a real, live call site; 6 are registered-only (see Known limitations for the exact, principled reason why). See `docs/webhook-events.md` for the full per-event breakdown.

## Dispatcher

The first genuine outbound-HTTP-call code in this codebase (every prior checkpoint's `fetch()` was inbound). Signs the body with `HMAC-SHA256(secret, "<timestamp>.<body>")`, sets a `10s` timeout via `AbortController`, and returns a structured result — success flag, status code, duration, error, request/response headers — never an unhandled rejection regardless of network error, timeout, or non-2xx response.

## Security

- **HMAC-SHA256 signing**, Stripe-shaped header (`t=<seconds>,v1=<hex>`) — a well-known convention reused deliberately, not invented.
- **Constant-time signature comparison** — closes the timing side-channel a naive `===` would leave open.
- **Real replay mitigation** — a signature more than 5 minutes old (configurable) is rejected outright; the *placeholder* the spec calls for is a nonce/seen-signature cache for full replay prevention within that window, not the timestamp check itself.
- **A deliberate, documented asymmetry from Checkpoint 16's API Keys**: an API Key is hashed (BloomOS only ever compares, never needs the original); a Webhook Secret must be stored as-is, since BloomOS itself signs every outgoing delivery with it — a one-way hash can never support that. The Developer Console still only ever *displays* it once, minimizing exposure even though the value is necessarily retrievable server-side.
- **URL validation** — must parse as a real URL with an `http:`/`https:` scheme; rejected otherwise.
- **No SSRF protection** — a known, explicitly documented gap (see below), not a silent omission.

## Browser verification

✓ Desktop verified. ✓ Mobile verified (375×812) — a full, live pass against the real dev server (mock mode, then reverted), including a self-hosted local HTTP receiver (`localhost:8891`, cleaned up after) standing in for a real third-party subscriber, so every claim below is proven with actual bytes over the wire, not just mocked unit tests.

- **Created a Webhook Endpoint** through the Developer Console's new Webhooks tab, subscribing to all 17 catalog events (rendered correctly, grouped by category) — the secret was shown exactly once (`whsec_...`) in a dedicated dialog.
- **Test delivery** sent a real signed HTTP POST that reached the local receiver. Captured the exact request: `x-bloomos-event: webhook.test`, `x-bloomos-delivery: whevt_...`, `x-bloomos-signature: t=...,v1=...`, `user-agent: BloomOS-Webhooks/1.0`, and a correctly-shaped JSON envelope body.
- **Independently re-verified the signature** with a standalone Node.js script (`crypto.createHmac("sha256", secret).update(...)`) using only the captured secret, timestamp, and body — the computed digest matched the one BloomOS sent, byte for byte.
- **Deliveries tab** showed the real delivery: `Success`, `1/5` attempts, `200`, real measured duration — the observability summary strip (Deliveries/Success/Failures/Dead letter/Retries/Avg. latency) updated correctly.
- **Replay** on that delivery created a second `WebhookDelivery` record with the identical request body (confirmed byte-for-byte in the receiver's log) but a freshly computed signature/timestamp — proving "resend the exact original bytes, re-signed at send time" works as designed.
- **Enable/Disable** toggled a real endpoint's status, reflected immediately in the table.
- **A second Endpoint, pointed at an always-500 path**, proved the full Retry Engine live: 5 real HTTP attempts were observed at the receiver with real backoff — deltas of ~1s, ~2s, ~4s, ~8s between consecutive attempts, an exact match for the documented exponential schedule — ending in a genuine `dead_letter` status (`5/5` attempts, `500`), with the summary strip's `Retries` counter correctly showing `4` (`attempts − 1`).
- **The live OpenAPI document** (`/api/v1/openapi.json`) was fetched from the running server and confirmed to contain all 17 `webhooks` entries plus the `WebhookSignature` security scheme.
- Same Browser-pane click-simulation caveat noted in every prior checkpoint (confirmed as a tooling artifact via direct DOM `.click()`, not a product bug) — every control worked correctly once the interaction actually registered, including the 17-checkbox event picker.

## Tests

**85 new tests across 15 files** (14 new + `openapi.test.ts` extended), all passing:

- **Registry** — `eventRegistry.test.ts` (7), `registerBuiltinWebhookEvents.test.ts` (1, asserting all 17 events + idempotency).
- **Signing** — `webhookSecret.test.ts` (2), `signature.test.ts` (10): determinism, tamper/wrong-secret/malformed-header rejection, the real timestamp-tolerance replay check, a custom tolerance.
- **Payload Builder** — `payloadBuilder.test.ts` (5): unknown-event error, full envelope assembly, the synthetic test envelope.
- **Dispatcher** — `dispatcher.test.ts` (4, mocked `fetch`): a verifiable real signature on the outgoing request, 2xx/non-2xx/network-error/timeout handling, never throwing.
- **Retries** — `retryEngine.test.ts` (7, mocked Dispatcher): backoff math, first-attempt success, exhaustion to `dead_letter`, success-after-failure, one-record-per-pair persistence, exact `request_body` storage, replay/test flags.
- **Delivery History** — `webhookDeliveryStore.test.ts` (7): CRUD, workspace/endpoint scoping, aggregation math (including the "only `attempts − 1`" retry-count formula).
- **Endpoint store** — `webhookEndpointStore.test.ts` (8): creation, secret redaction on every public read, rotation, status toggle, last-delivery tracking.
- **Event Publisher** — `publisher.test.ts` (5, mocked endpoint store + Retry Engine): unknown-event safety, per-endpoint fan-out, status/subscription filtering, and an explicit non-blocking assertion (the function returns before a slow mocked delivery resolves).
- **Permissions** — `manageWebhookEndpointsActions.test.ts` (11), `manageWebhookDeliveriesActions.test.ts` (5), `getWebhooksConsoleData.test.ts` (3): every action re-checks `workspace.manage`, URL/event validation, cross-workspace rejection.
- **Replay** — covered in both `retryEngine.test.ts` and `manageWebhookDeliveriesActions.test.ts` (exact-body resend, new record linked via `replayed_from_delivery_id`, original never mutated).
- **Developer Console / OpenAPI** — `openapi.test.ts` extended with 3 new assertions: the `WebhookSignature` scheme, one `webhooks` entry per catalog event with a real requestBody/example/200 response, and — critically — that every payload schema in the OpenAPI doc is the exact same object the Registry itself declares (`toBe`, not `toEqual`), structurally proving "never a hand-duplicated copy."

**Quality gates, all green:**

| Gate | Result |
|---|---|
| Lint | 0 errors (16 pre-existing warnings, +1 new intentional underscore-prefixed unused-destructure warning matching the codebase's own established convention — no new issues) |
| Typecheck (`tsc --noEmit`) | Clean |
| Test suite | **514 test files, 5207 tests, all passing** (project-wide, including this checkpoint's own 85 new tests) |
| Coverage — project-wide | 71.34% statements, 61.73% branches, 71% functions, 73.27% lines — all global thresholds met (70/58/68/72) |
| Production build (`next build`) | Clean — compiles with no new routes required (Webhooks live entirely inside the existing `/developer` page and the existing `/api/v1/openapi.json` route) |

## Documentation

[docs/webhooks.md](webhooks.md) — architecture, signing (with runnable Node.js and Python verification examples), security, retry policy, replay, payload versioning. [docs/webhook-events.md](webhook-events.md) — the full 17-event catalog, per-category, each with its exact payload shape and wired/registered-only status.

## Known limitations

- **6 of 17 catalog events have no live call site yet**: `client.created`, `client.updated`, `event.created`, `invoice.created`, `invoice.paid`, `receipt.created`. Root cause: unlike Documents/Workflow/Portal/Analytics, basic CRM/Finance mutations (`createClient`, `updateClient`, `createEvent`, `createInvoice`, `applyPaymentToInvoice`) have no Server Action boundary in this codebase — they're called directly from Client Components against the universal, dual-mode `@/lib/data` repository layer (verified: `NewClientView.tsx` imports and calls `createClient` straight from the browser). `publishWebhookEvent()` reads a server-side store and performs real outbound HTTP with a live signing secret — wiring it into a function that can execute in the browser would either run signing/delivery code client-side (broken and unsafe) or silently no-op depending on call context. All 6 are fully registered, schema'd, and documented; only the live trigger is deferred, the same honest "registered but not yet wired" precedent Checkpoint 16 set for the inert `crm.write` scope.
- **No SSRF protection.** A Webhook URL is free-form input from a `workspace.manage` member (an already-trusted Developer/Admin role); this checkpoint doesn't block private IP ranges, cloud metadata endpoints, or redirects. Acceptable at this trust level, called out explicitly rather than silently ignored.
- **Webhook Secrets are stored in plaintext** in the mock store (necessarily — see Security above). A production deployment needs an encrypted-at-rest column or a secrets manager.
- **The Retry Engine's backoff runs in-process, not in a durable queue** (explicit Non-Goal: "Real background workers"). If the Node process restarts mid-backoff, an in-flight retry sequence is lost. `dead_letter` is a real, queryable terminal status, but there's no separate dead-letter queue with its own re-processing flow — Replay from the Developer Console is the only way to retry a dead-lettered delivery today.
- **Every store this checkpoint introduced is mock-only**, regardless of `NEXT_PUBLIC_DATA_MODE` — the same precedent every new domain since Checkpoint 13 has followed.
- **No nonce/seen-signature cache** — see Security above; the timestamp-tolerance check is real, full within-window replay prevention is the deferred piece.

## Recommendation

**APPROVED.** Every Step 1–14 capability is real, working, and proven live with actual signed HTTP traffic over the wire — not just mocked unit tests: a self-registering 17-event catalog, a genuine outbound Dispatcher (this codebase's first), HMAC-SHA256 signing independently re-verified byte-for-byte outside the app, a real exponential-backoff Retry Engine observed reaching a genuine `dead_letter` state with correctly-timed attempts, exact-byte Replay, and a fully functional, accessible Developer Console extension. Eleven of seventeen events are wired to real business actions end to end; the remaining six are honestly documented as blocked on an architectural gap (no Server Action layer for basic CRM/Finance CRUD) that predates this checkpoint and is out of its own scope to fix. Per the stop condition, no Marketplace, external integrations, SDKs, background workers, or Realtime were implemented.
