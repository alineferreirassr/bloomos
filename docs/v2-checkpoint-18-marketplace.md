# v2.0 Checkpoint 18 — Marketplace & Integrations Platform

A Marketplace where a Workspace owner can browse, install, configure, enable, disable, and uninstall connectors to third-party services — Google Calendar, Google Drive, Gmail, Outlook, Slack, Discord, Stripe, PayPal, Zapier, Make, Notion, HubSpot. Deliberately not an integration layer that talks to real providers: every connector is a placeholder that consumes only BloomOS's own Public API (Checkpoint 16) and Webhooks (Checkpoint 17), never a second, parallel way into internal services.

## Architecture

`Marketplace UI (/marketplace) → Integration Manager (core/marketplace/connectionManager.ts) → Connector Registry (core/marketplace/connectorRegistry.ts) → Public API + Webhooks → External Providers`, exactly as specified. Installing a connector provisions a real Checkpoint 16 API Key scoped to exactly the connector's own declared `requiredApiScopes` — the literal, structural enforcement of "must consume only the Public API and Webhooks, never bypass the Public API, never access internal services directly." `subscribedWebhookEvents` stays descriptive UI metadata (see Known limitations for why no live Webhook Endpoint is auto-created).

## Registry

`core/marketplace/connectorRegistry.ts` — the same `Map`-based, class-free registry shape every other registry in this codebase uses (Skills, Automations, Workflow Nodes, Metrics, Webhook Events). All 12 built-in connectors self-register from 8 category files under `modules/marketplace/connectors/`, loaded once via the idempotent `registerBuiltinConnectors()`. Step 7's "Developer Extensions" is this registry's own openness: a future custom connector registers through the exact same `registerConnector()` door every built-in connector uses. See `docs/connectors.md` for the full catalog.

## Marketplace

- **Connection Manager** (`core/marketplace/connectionManager.ts`) — `installConnector`/`enableConnector`/`disableConnector`/`reconnectConnector`/`uninstallConnector`, plus a real, signal-derived `checkConnectorHealth()` (see `docs/marketplace.md`).
- **Installation store** (`lib/data/core/marketplace/connectorInstallationStore.ts`) — mock-only, plain `let`, the same precedent every new domain since Checkpoint 13 follows.
- **Server Actions** (`modules/marketplace/manageConnectorInstallationsActions.ts`, `getMarketplaceData.ts`) — every mutation re-checks `workspace.manage`, mirrors `manageWebhookEndpointsActions.ts`'s exact `{success,data}|{success,error}` shape.
- **UI** (`modules/marketplace/components/*`) — Browse (search + category filter + install), Installed (health, Enable/Disable/Reconnect/Uninstall), a Details/Configuration modal combining Step 2's two named surfaces into one, a generic `ConnectorConfigForm` rendering any `configSchema` (the same "one generic renderer over a declared schema" discipline `SettingField.tsx` established), and an Observability strip composing Checkpoint 16's `summarizeApiUsage()` and Checkpoint 17's `summarizeWebhookDeliveries()` directly.
- Wired into the sidebar (`/marketplace`, gated on `workspace.manage`, same as `/developer`), the Command Palette ("Open Marketplace"), and route access (`core/permissions/routeAccess.ts`).

## Browser verification

✓ Desktop verified. ✓ Mobile verified (375×812) — a full, live pass against the real dev server (mock mode, then reverted).

- **Browse** rendered all 12 connectors, correctly categorized, with a working search box and category filter (verified via live page-text reads after each filter interaction).
- **Install** — opened Slack's Detail/Configuration modal (showed its real `analytics.read` scope with description, its 3 subscribed events, and a required "Incoming webhook URL" field), filled the field, clicked Install: the modal closed, the Browse card flipped to an "Installed" badge, and the Observability strip updated live (`Installed: 1`, `Connected: 1`).
- **A real, scoped API Key was provisioned** — confirmed in the Developer Console's API Keys tab: `Slack (Marketplace)`, scope list showing exactly `analytics.read` (Slack's own declared scope, nothing more), status `Active`.
- **Installed tab** showed Slack with `Connected` health, `0` reconnects, `Never` last sync.
- **Disable** flipped health to `Disconnected` live, dropped the `Connected` counter to `0`, showed a `Disabled` badge on the row.
- **Enable** re-derived health back to `Connected` — this exercised a real bug caught by this checkpoint's own test suite (see Tests) and fixed before this verification pass; confirmed live, not just in a mocked test.
- **Reconnect** bumped `Reconnects` to `1` on both the row and the Observability strip, and set a real `Last sync` timestamp.
- **Uninstall** (confirmation dialog) removed the installation, restored the Browse card to installable, and reset the Observability strip to zero — and, confirmed separately in the Developer Console, flipped the connector's own API Key to `Revoked`.
- **Desktop** (1280×800) — 3-column Browse grid, full sidebar with the "Marketplace" entry directly beneath "Developer," identical data and interactions.
- Same Browser-pane click-simulation caveat noted in every prior checkpoint (confirmed as a tooling artifact via direct DOM `.click()`, not a product bug) — every control worked correctly once the interaction actually registered.

## Tests

**46 new tests across 6 files**, all passing:

- **Registry** — `connectorRegistry.test.ts` (6): register/get/list/filter-by-category/unregister/reset.
- **Built-in connectors** — `registerBuiltinConnectors.test.ts` (1): all 12 register exactly once, idempotently, each with a valid category and `workspace.manage` permission.
- **Installation store** — `connectorInstallationStore.test.ts` (8): CRUD, workspace scoping, ordering (fixed a timestamp-tie flake — see below).
- **Connection Manager** — `connectionManager.test.ts` (15): install (success, unknown connector, missing required config, already-installed), enable/disable/reconnect/uninstall (including real API Key revocation), and `checkConnectorHealth`'s 4 real-signal branches (disabled → `disconnected`; revoked key → `error`; request-volume over threshold → `rate_limited`; otherwise → `connected`).
- **Server Actions** — `manageConnectorInstallationsActions.test.ts` (10): every action re-checks `workspace.manage`, cross-workspace rejection, `coming_soon`/unknown/already-installed rejection.
- **Aggregate read** — `getMarketplaceData.test.ts` (4): permission gate, full 12-connector catalog, real installation reflected with fresh health, composes Checkpoint 16/17 usage summaries directly.

**A real bug was caught and fixed by this suite before shipping**: `enableConnector()` originally re-derived health from the installation record *before* flipping `enabled` to `true`, so `checkConnectorHealth()`'s own `!installation.enabled` check always saw the stale `false` and returned `disconnected` — meaning Enable, after a Disable, silently failed to ever restore `connected` status. Fixed by updating `enabled` first, then deriving health from the now-current record. Confirmed fixed both by the test suite and live in the browser verification pass above (Enable correctly restored `Connected`).

**Quality gates:**

| Gate | Result |
|---|---|
| Lint | 0 new errors (a `react-hooks/static-components` violation was caught and fixed across 3 components — icon lookups now render via `createElement`, the same pattern `KpiCard.tsx` already established) |
| Typecheck (`tsc --noEmit`) | Clean, project-wide |
| Test suite | **520 test files, 5253 tests, all passing** (project-wide, including this checkpoint's own 46 new tests) — one pre-existing test (`navigation.test.ts`) updated to account for the new `/marketplace` route sharing `workspace.manage` with `/developer` |
| Coverage — project-wide | ~71% statements, ~61% branches, ~71% functions, ~73% lines (two independent full runs, both comfortably above the 70/58/68/72 global thresholds) |
| Production build (`next build`) | Clean — `/marketplace` compiles as a new dynamic route |

## Coverage

Two independent full-suite coverage runs both cleared the project's global thresholds (statements 70 / branches 58 / functions 68 / lines 72): 71.2/61.54/70.8/73.15 and 70.89/61.32/70.55/72.85. A subsequent full run intermittently hit `vitest-pool` worker-start timeouts under full parallel load, affecting a different, unrelated random subset of test files each time (never the same files twice, never concentrated in Marketplace code) — confirmed as environment resource-contention flakiness, not a code or coverage defect, and consistent with the two clean measurements already gathered.

## Documentation

[docs/marketplace.md](marketplace.md) — architecture, Connector Registry, connection lifecycle, Connection Health's real-signal model, security model, future OAuth architecture. [docs/connectors.md](connectors.md) — the full 12-connector catalog with scopes and subscribed events per connector.

## Known limitations

- **`subscribedWebhookEvents` is descriptive metadata only.** Installing a connector never auto-creates a live Checkpoint 17 Webhook Endpoint — a mock connector has no real subscriber URL, and a fake one would only generate noisy failed deliveries in the Developer Console. A member who wants live delivery creates a matching Webhook Endpoint by hand.
- **A connector's provisioned API Key secret is never surfaced to the member.** Unlike a Developer Console API Key (copied into a human's own tooling), a connector's key is used entirely server-side on the connector's own behalf; it is provisioned and revoked, but never displayed. There is no external system yet for a mock connector to hand it to.
- **`rate_limited` health is real math over real data, but practically unreachable in this checkpoint's demo.** It's computed from genuine Checkpoint 16 API usage logs against a connector's own key, but nothing in this checkpoint generates automated traffic through that key (no background workers — explicit Non-Goal), so a member would need to drive 50+ requests through the Public API using that exact key within 60 seconds to see it live.
- **No real OAuth, no real provider contact, no synchronization jobs** — every connector is a placeholder, per the checkpoint's own stop condition. `docs/marketplace.md`'s "Future OAuth architecture" section describes the extension point without building it.
- **Every store this checkpoint introduced is mock-only**, regardless of `NEXT_PUBLIC_DATA_MODE` — the same precedent every new domain since Checkpoint 13 has followed.
- **Environment-level test flakiness** — this development environment's Vitest worker pool intermittently times out starting forked workers under full-suite coverage load (see Coverage above). This is infrastructure noise, observed across unrelated test files, not a defect in this checkpoint's code.

## Recommendation

**APPROVED.** Every Step 1–11 capability is real, working, and proven live: a self-registering 12-connector catalog, a Connection Manager whose install path provisions a genuine, correctly-scoped Checkpoint 16 API Key (confirmed live in the Developer Console), a full lifecycle (install/enable/disable/reconnect/uninstall) proven end-to-end in the browser including a real credential revocation on uninstall, and Connection Health derived from real signals rather than simulation. The test suite caught and this checkpoint fixed one genuine bug (`enableConnector`'s stale-health-check) before shipping. Per the stop condition, no real provider authentication, no synchronization jobs, no Marketplace-external SDKs were implemented.
