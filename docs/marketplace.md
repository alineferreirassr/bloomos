# BloomOS Marketplace

The Marketplace lets a Workspace owner connect BloomOS to third-party services — Google Calendar, Slack, Stripe, and nine others — through the same two surfaces every other external integration in BloomOS already uses: the **Public API** (Checkpoint 16) and **Webhooks** (Checkpoint 17). It is not a second, parallel way into BloomOS's internal services; it is a UI and a lifecycle wrapped around those two existing doors.

```
Marketplace UI (/marketplace)
       ↓  browse, install, configure
Integration Manager (core/marketplace/connectionManager.ts)
       ↓  provisions a real, scoped credential
Connector Registry (core/marketplace/connectorRegistry.ts)
       ↓  every connector self-registers here
Public API (Checkpoint 16)  +  Webhooks (Checkpoint 17)
       ↓
External Providers (Google, Slack, Stripe, ...)
```

## Connector Registry

`core/marketplace/connectorRegistry.ts` — the same `Map`-based, class-free registry shape every other registry in this codebase uses (Skills, Automations, Workflow Nodes, Metrics, Webhook Events). All 12 built-in connectors self-register from 8 category files under `modules/marketplace/connectors/`, loaded once via the idempotent `registerBuiltinConnectors()`.

A `ConnectorDefinition` never reaches into an internal BloomOS service itself. It only *declares* what it would need:

- `requiredApiScopes` — Checkpoint 16's own `ApiScope` union (e.g. `crm.read`, `finance.read`).
- `subscribedWebhookEvents` — Checkpoint 17's own `WebhookEventType` union (e.g. `invoice.paid`, `document.published`).
- `configSchema` — a small, typed set of fields (`text`/`url`/`select`/`boolean`) the Marketplace UI renders generically, the same "one generic renderer over a declared schema" discipline `SettingField.tsx` (Checkpoint 11) established for Workspace Settings.

**Developer Extensions** (Step 7): a future custom connector registers through the exact same `registerConnector()` door every built-in connector uses — there is no separate, privileged registration path for BloomOS's own connectors.

## Connection lifecycle

Every lifecycle transition is the literal enforcement of this checkpoint's own rule — *"must consume only the Public API and Webhooks, never bypass the Public API, never access internal services directly"*:

1. **Install** (`installConnector`) — validates the connector's `configSchema` (every `required` field present), then provisions a **real Checkpoint 16 API Key**, scoped to exactly the connector's own `requiredApiScopes`, via the same `createApiKey()` the Developer Console itself uses. That key is the connector's only credential and its only door into BloomOS data. Health resolves to `connected` immediately — there is no real OAuth handshake to wait on (explicit Non-Goal).
2. **Enable / Disable** — Disable never uninstalls; it flips `enabled: false` and health to `disconnected`, the same "distinct, non-destructive states" precedent Checkpoint 16's `ApiKey.revoked_at` and Checkpoint 17's `WebhookEndpoint.status` already established for their own on/off switches. Enable re-derives health from real signals rather than blindly restoring `connected`.
3. **Reconnect** — a manual, explicit action that resolves health back to `connected` and increments `reconnect_count` — the same shape a real OAuth re-auth flow would have, without performing one.
4. **Uninstall** — revokes the connector's own provisioned API Key (`revokeApiKey`) and deletes the installation record. A connector is never left with a still-valid credential after uninstall.

## Connection Health

Health is **derived from real signals**, not an arbitrary simulated flag — the same "structurally real, policy deferred" precedent this session has followed throughout:

| Status | Reachable via |
|---|---|
| `connected` | Enabled, credential valid, low traffic. |
| `disconnected` | Member disabled the connector. |
| `error` | The connector's own API Key has been revoked out from under it (e.g. from the Developer Console's API Keys tab) — a genuine, checkable loss of credential. |
| `rate_limited` | The connector's API Key's own request volume (Checkpoint 16's `apiUsageStore`) exceeds 50 requests within the last 60 seconds — real traffic, real math. |
| `pending` | Reserved for a future real handshake; no built-in connector reaches it today (no real OAuth — Non-Goal). |

`rate_limited` is real math over real data, but practically unreachable in this checkpoint's demo, since nothing yet drives automated traffic through a connector's own key (no background workers — Non-Goal). See Known limitations.

## Security model

- **Scoped credentials, not blanket access** — a connector's API Key carries only the scopes it declared, nothing more. Installing "Stripe" (which only declares `finance.read`) never grants it `crm.read`.
- **The provisioned secret is never surfaced to the member.** Unlike a Developer Console API Key (which a human copies into their own tooling), a connector's key is used entirely server-side, by BloomOS itself, on the connector's behalf — there is no external system yet to hand the secret to for a mock connector. It is provisioned, stored, and revoked, but never displayed.
- **Uninstall is destructive by design** — revoking the credential immediately, rather than leaving a dangling, still-valid key for a connector nobody manages anymore.
- **Webhook subscriptions stay descriptive metadata** — installing a connector does **not** auto-create a live Webhook Endpoint (see Known limitations).

## Future OAuth architecture

No connector in this checkpoint performs real authentication (explicit Non-Goal). The `ConnectorConfigField` schema already has the shape a future OAuth flow would need to extend: a `configSchema` entry could become a "Connect with Google" button instead of a text input, and `installConnector()` would exchange an OAuth code for a provider token instead of just provisioning a BloomOS API Key — the Connector Registry, the Connection Manager's lifecycle functions, and the Installed tab's UI would not need to change shape to support that; only the install step's own internals would.

## Known limitations

See `docs/v2-checkpoint-18-marketplace.md`'s own Known limitations section for the full list.
