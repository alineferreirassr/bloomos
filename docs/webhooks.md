# BloomOS Webhooks

The Webhooks Platform lets BloomOS notify an external system whenever an important business event occurs — a Client is created, an Invoice is paid, a Workflow is published. It is an **event delivery platform**, not an integration layer: BloomOS never knows or cares what a subscriber does with an event, only that it was delivered, signed, and — if delivery failed — retried.

```
BloomOS Modules (Server Actions)
       ↓  publishWebhookEvent(...) — fire-and-forget, never blocks the caller
Event Publisher (core/webhooks/publisher.ts)
       ↓  builds the envelope, looks up subscribed Endpoints
Webhook Dispatcher (core/webhooks/dispatcher.ts)
       ↓  one signed HTTP POST attempt
Delivery Queue + Retry Engine (core/webhooks/retryEngine.ts)
       ↓  exponential backoff, up to 5 attempts, in-process
External Endpoint (the Workspace's own URL)
```

No business logic runs inside delivery — the Dispatcher only ever serializes an already-built payload, signs it, and POSTs it. Nothing about *what* an event means is decided in `core/webhooks/`; every payload is assembled from data an existing module (CRM, Finance, Documents, Workflow, Portal, Analytics) already produced, often via the exact same redaction mappers the Public API's own endpoints use (`core/api/mappers.ts`).

## Architecture

- **Event Publisher** (`core/webhooks/publisher.ts`) — `publishWebhookEvent()` is the one function every Server Action calls. It builds the envelope, looks up every enabled Webhook Endpoint subscribed to that event type, and kicks off delivery for each **without awaiting it** — "Never block application requests" is enforced here, not by convention at each call site.
- **Webhook Dispatcher** (`core/webhooks/dispatcher.ts`) — one HTTP POST attempt: signs the body, sets headers, applies a 10-second timeout via `AbortController`, and returns a structured result (never throws).
- **Retry Engine** (`core/webhooks/retryEngine.ts`) — runs the Dispatcher up to 5 times with exponential backoff (1s, 2s, 4s, 8s, capped at 60s), persisting one `WebhookDelivery` record per (event, endpoint) pair, updated in place across attempts.
- **Delivery Queue** — there is no separate queue data structure; the "queue" is the in-process attempt loop inside `deliverWithRetry()`. See Known limitations for what this means in practice.

## Authentication and signing

There's no API Key on the *receiving* end — instead, every delivery is signed so the subscriber can verify it actually came from BloomOS:

```
x-bloomos-signature: t=1700000000,v1=5257a869e7bff...
```

- `t` — the Unix timestamp (seconds) the request was signed at.
- `v1` — `HMAC-SHA256(secret, "<t>.<raw JSON body>")`, hex-encoded.

The `secret` is the Webhook Endpoint's own signing secret (`whsec_...`, 256 bits of entropy), shown once in the Developer Console at creation or rotation.

### Verification example (Node.js)

```js
const crypto = require("crypto");

function verifyBloomOSSignature(rawBody, header, secret, toleranceSeconds = 300) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const { t: timestamp, v1: signature } = parts;
  if (!timestamp || !signature) throw new Error("Malformed signature header");

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > toleranceSeconds) throw new Error("Timestamp outside tolerance — possible replay");

  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const valid = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  if (!valid) throw new Error("Signature does not match");
}

// Express example — use the raw body, never a re-serialized JSON.parse(...).toString()
app.post("/webhooks/bloomos", express.raw({ type: "application/json" }), (req, res) => {
  verifyBloomOSSignature(req.body.toString("utf8"), req.header("x-bloomos-signature"), process.env.BLOOMOS_WEBHOOK_SECRET);
  res.sendStatus(200);
});
```

### Verification example (Python)

```python
import hashlib, hmac, time

def verify_bloomos_signature(raw_body: bytes, header: str, secret: str, tolerance_seconds: int = 300) -> None:
    parts = dict(p.split("=", 1) for p in header.split(","))
    timestamp, signature = parts["t"], parts["v1"]

    if abs(time.time() - int(timestamp)) > tolerance_seconds:
        raise ValueError("Timestamp outside tolerance — possible replay")

    expected = hmac.new(secret.encode(), f"{timestamp}.{raw_body.decode()}".encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise ValueError("Signature does not match")
```

Both examples mirror `src/lib/webhooks/signature.ts`'s own `verifyWebhookSignature()` — that function exists specifically so this documentation points at real, tested code rather than prose alone.

## Security

- **HTTPS or HTTP only** — a Webhook URL must parse as a valid URL with an `http:`/`https:` scheme; anything else is rejected at creation.
- **Secret never re-displayed** — like an API Key, a Webhook Secret is only ever shown in the Developer Console once, at creation or rotation. Unlike an API Key, it's necessarily stored as plaintext server-side (not hashed) — HMAC signing requires the original value at delivery time, which a one-way hash can never recover. A production deployment would store this in an encrypted-at-rest column or a secrets manager, never plaintext in a database; this mock-only phase stores it in-memory, unencrypted, the same way every other mock-only credential in this codebase does. See Known limitations.
- **Constant-time comparison** — signature verification never short-circuits on the first mismatched byte, closing the timing-attack side channel a naive `===` comparison would open.
- **Generic delivery failures** — a subscriber's own endpoint errors (500s, timeouts, DNS failures) are captured into Delivery History, never leaked back into the business action that triggered the event.
- **No SSRF protection yet** — a Webhook URL is free-form input from a `workspace.manage`-permission member (Developer/Admin only, an already-trusted role), and this checkpoint does not block private IP ranges, cloud metadata endpoints, or redirects. Acceptable for this trust level but flagged explicitly as a known limitation, not silently ignored.

## Retry policy

| Attempt | Delay before this attempt |
|---|---|
| 1 | none (immediate) |
| 2 | 1s |
| 3 | 2s |
| 4 | 4s |
| 5 | 8s |

A response is treated as successful only on a 2xx status. Anything else — a non-2xx status, a network error, or a 10-second timeout — triggers the next attempt. After the 5th failed attempt, the delivery moves to a terminal `dead_letter` status; no further automatic retries happen (the spec's own "dead-letter placeholder" — the state exists and is queryable via the Developer Console's Deliveries tab, but there's no separate dead-letter queue with its own re-processing flow yet).

Every attempt — success or failure — is recorded in Delivery History (`WebhookDelivery.attempts`, `.last_status_code`, `.last_duration_ms`, `.last_error`, `.request_headers`, `.response_headers`).

## Replay

Any delivery — successful, failed, or dead-lettered — can be replayed from the Developer Console's Deliveries tab. Replay resends the **exact original request body** (`WebhookDelivery.request_body`, stored verbatim at the time of the original attempt), never a freshly rebuilt envelope — the same "replay resends what actually happened" semantics Stripe's and GitHub's own webhook replay already use. A replay creates a brand-new `WebhookDelivery` record linked back to the original via `replayed_from_delivery_id`; the original record is never mutated, so history stays append-only.

## Payload versioning

Every `WebhookEventDefinition` (see `docs/webhook-events.md` for the full catalog) carries its own `version`, starting at 1. Every envelope this event produces carries that same version in its own `version` field:

```json
{ "id": "whevt_...", "timestamp": "...", "workspace": "ws_...", "version": 1, "event": "client.created", "resource": { "type": "client", "id": "..." }, "metadata": {}, "payload": { ... } }
```

A version is bumped only on a breaking payload shape change (a field removed or its meaning changed) — additive changes (a new optional field) never bump it. A subscriber should branch on `version` if it needs to support multiple payload shapes during a migration window; today every event is at version 1.

## Test delivery

The Developer Console's "Test delivery" button sends a synthetic `webhook.test` event (never a real catalog event, never counted against a real business trigger) through the exact same Dispatcher/Retry Engine every real event uses — the same signing, the same timeout, the same Delivery History record (flagged `is_test: true` so it's distinguishable from real traffic).

## Known limitations

See `docs/v2-checkpoint-17-webhooks.md`'s own Known limitations section for the full list, including which of the 17 catalog events have a live, wired call site today versus which are registered-but-not-yet-fired.
