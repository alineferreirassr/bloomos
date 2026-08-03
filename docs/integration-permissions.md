# Integration Permissions — v2 Checkpoint 43

`core/enums/permission.ts` — 13 new `integrations.*` permissions, replacing the single coarse `workspace.manage` gate Checkpoint 22/23 used for everything with per-capability granularity appropriate to a platform that can now move money and send email/SMS on a client's behalf.

## The 13 permissions

| Permission | Gates |
|---|---|
| `integrations.view` | The Connection Center itself — `/integrations`, `/integrations/[provider]` |
| `integrations.manage` | Install/uninstall a provider, edit connection config |
| `integrations.connect` | OAuth/connect actions specifically |
| `integrations.disconnect` | Disconnect/revoke actions specifically — narrower than `.manage`, so an operator can disconnect a mis-signed-in staff connection without full manage rights |
| `integrations.logs` | Diagnostics/audit trail read access |
| `integrations.webhooks` | Webhook endpoint/delivery management |
| `integrations.payments` | Stripe payment actions |
| `integrations.calendar` | Google Calendar actions |
| `integrations.email` | Gmail send actions |
| `integrations.messaging` | Twilio SMS actions |
| `integrations.storage` | Google Drive / Dropbox actions |
| `integrations.signatures` | DocuSign actions |
| `integrations.sensitive` | The narrowest gate — viewing a connection's real external account identity/scopes |

## What's actually gated on them today

New Checkpoint 43 call sites use the granular permission directly: `getIntegrationConnectionDetail.ts` and `manageOAuthConnectionActions.ts` (`integrations.view`/`.connect`/`.disconnect`), `setDocuSignWebhookSecretAction.ts` (`integrations.signatures`), `connectTwilioActions.ts` (`integrations.messaging`), and each updated provider registration (`requiredPermission` on the `ProviderDefinition`).

**`workspace.manage` remains the gate on every unmigrated Checkpoint 22/23 call site** — `getIntegrationsDashboardData.ts`, `manageIntegrationConnectionsActions.ts`, and the Stripe connection flow all still check `workspace.manage`. This is a deliberate scope boundary, not an oversight: migrating every existing call site to the new granular permissions is a larger refactor than this checkpoint's own instructions call for ("extend, don't rebuild what already works"). `workspace.manage` is a strict superset of every `integrations.*` permission for `owner`/`admin` (both hold `PERMISSIONS`, the full list, in `lib/team/permissionMatrix.ts`), so no access-control gap exists today — only an inconsistency in *which* permission name a given call site checks.

## Role defaults

`DEFAULT_ROLE_PERMISSIONS` (`lib/team/permissionMatrix.ts`) was **not modified** this checkpoint. `owner`/`admin` hold the full `PERMISSIONS` list and so already have every `integrations.*` permission; `manager` does not have any of them (it never had `workspace.manage` either) — a workspace wanting a manager to see the new `/integrations/[provider]` detail page would need to grant `integrations.view` explicitly through the existing permission-override mechanism, the same as any other permission gap.
