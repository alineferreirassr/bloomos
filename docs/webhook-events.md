# BloomOS Webhook Event Catalog

17 built-in events across 6 categories, all self-registered from `src/modules/webhooks/events/*.ts` via `registerBuiltinWebhookEvents()` (`src/modules/webhooks/registerBuiltinWebhookEvents.ts`) — the same idempotent-loader shape `registerBuiltinMetrics()` (Checkpoint 15) already established. Every event's full schema is also published live in the OpenAPI document's native `webhooks` section at `GET /api/v1/openapi.json`.

**"Wired" means a real Server Action calls `publishWebhookEvent()` for that type today.** "Registered only" means the event exists in the catalog — schema, category, version, all real — but no call site fires it yet in this checkpoint. See `docs/v2-checkpoint-17-webhooks.md`'s Known limitations for exactly why the 6 registered-only events aren't wired yet.

## CRM

| Event | Wired? | Payload |
|---|---|---|
| `client.created` | Registered only | `{ id, first_name, last_name, email, status, is_returning, is_vip, wedding_date, created_at, updated_at }` |
| `client.updated` | Registered only | Same shape as `client.created` |
| `event.created` | Registered only | `{ id, client_id, title, event_type, status, event_date, guest_count, created_at }` |
| `proposal.accepted` | **Wired** — `acceptProposalDraft.ts` | `{ id, event_id, status, accepted_at }` |

## Finance

| Event | Wired? | Payload |
|---|---|---|
| `invoice.created` | Registered only | `{ id, client_id, status, total_minor, balance_minor, currency, issue_date, due_date }` |
| `invoice.paid` | Registered only | Same shape as `invoice.created` |
| `receipt.created` | Registered only | `{ id, invoice_id, client_id, title, generated_at }` |

## Documents

| Event | Wired? | Payload |
|---|---|---|
| `document.generated` | **Wired** — `DocumentsManager.compileAndCreateDocument()` | `{ id, templateId, documentTypeId, status, currentVersion, createdAt }` |
| `document.published` | **Wired** — `publishDocumentVersionAction()` | `{ id, version, compiledAt, label }` |
| `template.published` | **Wired** — `DocumentsManager.publishTemplate()` | `{ id, name, documentTypeId, updatedAt }` |

## Workflow

| Event | Wired? | Payload |
|---|---|---|
| `workflow.published` | **Wired** — `publishWorkflowAction()` | `{ id, name, status, updatedAt }` |
| `workflow.simulated` | **Wired** — `simulateWorkflowAction()` | `{ workflow_id, path_count, issue_count, occurred_at }` |

Never an execution event — this checkpoint's own stop condition ("Never execute business logic inside webhook delivery") and the Public API's own precedent (Checkpoint 16: "Do not execute Workflows") both hold here. There is no `workflow.executed` event, and none is planned.

## Portal

| Event | Wired? | Payload |
|---|---|---|
| `portal.login` | **Wired** — `publishPortalLoginWebhookEvent()`, called from the Client Portal's own login flow | `{ client_account_id, client_id, occurred_at }` |
| `checklist.completed` | **Wired** — `dispatchChecklistItemCompletedTrigger()` | `{ id, title, completed_at }` |
| `document.downloaded` | **Wired** — `dispatchDocumentDownloadedTrigger()` | `{ document_id, client_account_id, occurred_at }` |
| `proposal.viewed` | **Wired** — `dispatchProposalViewedTrigger()` | `{ proposal_id, client_account_id, occurred_at }` |

## Analytics

| Event | Wired? | Payload |
|---|---|---|
| `executive.summary.generated` | **Wired** — `generateAnalyticsExecutiveSummary()` / `...ForApiKey()` | `{ windowKey, executiveSummary, performanceHighlights, generated_at }` |

## Envelope shape

Every event, regardless of type, is delivered wrapped in the same envelope (`WebhookEventEnvelope`, `src/types/webhookEvent.ts`):

```json
{
  "id": "whevt_...",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "workspace": "ws_...",
  "version": 1,
  "event": "client.created",
  "resource": { "type": "client", "id": "client_..." },
  "metadata": {},
  "payload": { "...": "the event-specific fields listed above" }
}
```

`payload` never carries a field the corresponding module's own type doesn't already expose safely — the CRM events reuse the exact same `toApiClient()`/`toApiEvent()` redaction mappers the Public API's own `/api/v1/clients`/`/api/v1/events` endpoints use (Checkpoint 16, `core/api/mappers.ts`), so a field excluded there (allergies, do-not-call, `internal_summary`, …) is excluded here too — one redaction policy, never a second one invented for webhooks.

## At a glance

11 of 17 events are wired to a real, live call site today; 6 are registered-only. See `docs/v2-checkpoint-17-webhooks.md` for the full reasoning behind the split.
