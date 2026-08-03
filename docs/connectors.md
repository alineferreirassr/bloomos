# Built-in Connectors

All 12 built-in connectors are **placeholders** — none of them perform real authentication or contact a real third-party service (explicit Non-Goals: real OAuth, real Stripe, real Google, real Slack, real Gmail, real syncing). Each one declares a real, closed set of `requiredApiScopes` (Checkpoint 16) and `subscribedWebhookEvents` (Checkpoint 17), enforced structurally at install time — see `docs/marketplace.md` for the lifecycle.

Every connector requires the `workspace.manage` permission (Step 9's "Developer/Admin only") and defines its own `configSchema` (rendered generically by the Marketplace UI's install form).

## Calendar

| Connector | API scopes | Subscribes to |
|---|---|---|
| Google Calendar | `crm.read` | `event.created` |

## Storage

| Connector | API scopes | Subscribes to |
|---|---|---|
| Google Drive | `documents.read` | `document.generated`, `document.published` |

## Email

| Connector | API scopes | Subscribes to |
|---|---|---|
| Gmail | `crm.read` | `proposal.accepted`, `invoice.created` |
| Outlook | `crm.read`, `portal.read` | `event.created`, `invoice.paid` |

## Communication

| Connector | API scopes | Subscribes to |
|---|---|---|
| Slack | `analytics.read` | `proposal.accepted`, `invoice.paid`, `workflow.published` |
| Discord | `workflow.read` | `workflow.published`, `workflow.simulated` |

## Payments

| Connector | API scopes | Subscribes to |
|---|---|---|
| Stripe | `finance.read` | `invoice.paid`, `receipt.created` |
| PayPal | `finance.read` | `invoice.created`, `invoice.paid` |

## Automation

| Connector | API scopes | Subscribes to |
|---|---|---|
| Zapier | `crm.read`, `finance.read`, `documents.read` | `client.created`, `invoice.paid`, `document.generated` |
| Make | `workflow.read`, `analytics.read` | `workflow.published`, `executive.summary.generated` |

## Productivity

| Connector | API scopes | Subscribes to |
|---|---|---|
| Notion | `documents.read` | `document.published`, `template.published` |

## CRM

| Connector | API scopes | Subscribes to |
|---|---|---|
| HubSpot | `crm.read`, `finance.read` | `client.created`, `client.updated`, `proposal.accepted` |

## Adding a connector

A connector is a plain `ConnectorDefinition` object passed to `registerConnector()` (`core/marketplace/connectorRegistry.ts`) — the same self-registration pattern every built-in connector uses (see `modules/marketplace/connectors/*.ts`). No change to the Registry, the Connection Manager, or the Marketplace UI is needed for a 13th connector to appear correctly in Browse, install correctly, and render its own `configSchema` — the entire UI is generic over the Registry's own contents.
