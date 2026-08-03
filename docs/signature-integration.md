# Electronic Signature Integration (DocuSign) — v2 Checkpoint 43

`core/integrations/providers/docusign/docusignProvider.ts` — `DocuSignProvider implements SignatureProvider, WebhookProvider`. A plain `fetch` client against DocuSign's real eSignature REST API (`{accountBaseUri}/restapi/v2.1/accounts/{accountId}/envelopes`) — no `docusign-esign` npm SDK, for the same reason given in `docs/calendar-integration.md`.

## A genuinely new SDK interface

No prior checkpoint had an e-signature capability shape, so `SignatureProvider` is new in `core/integrations/sdk.ts`:

```ts
interface SignatureProvider extends BaseProvider {
  createSignatureRequest(params: {documentName, documentContent, signers}): Promise<{externalRequestId}>;
  getSignatureStatus(externalRequestId): Promise<{status, completedDocumentUrl}>;
  cancelSignatureRequest(externalRequestId): Promise<{cancelled}>;
}
```

`PROVIDER_CAPABILITIES` gained `"signature"` to match; `AnyCapabilityProvider` includes `SignatureProvider`.

## Methods

- `ping()` — `{ok, latencyMs, error?}`.
- `createSignatureRequest({documentName, documentContent, signers})` → `{externalRequestId}` — creates a DocuSign envelope with one signer tab per signer.
- `getSignatureStatus(externalRequestId)` → `{status, completedDocumentUrl}` — status is one of `sent`/`viewed`/`partially_signed`/`signed`/`declined`/`expired`/`cancelled`, mapped from DocuSign's own envelope status vocabulary.
- `cancelSignatureRequest(externalRequestId)` → `{cancelled}` — voids the envelope.
- `verifyInboundSignature({rawBody, signatureHeader, secret})` (via `WebhookProvider`) — real DocuSign Connect HMAC-SHA256 signature verification against `X-DocuSign-Signature-1`.

## Credential shape

The OAuth access token credential authenticates API calls. A **separate** `provider_secret` credential holds the DocuSign Connect HMAC secret, stored via `setDocuSignWebhookSecretAction` (`modules/integrations/docusign/setDocuSignWebhookSecretAction.ts`, mirroring `setStripeWebhookSecretAction` exactly) into `connection.config.webhook_secret_credential_id` — never the raw secret in the connection record itself. A workspace pastes this in after creating the real Connect configuration in their own DocuSign account, pointed at `/api/webhooks/docusign/{connectionId}`.

## Inbound webhook

`/api/webhooks/docusign/[connectionId]` — see `docs/webhook-engine.md`'s Checkpoint 43 addendum for the full route contract.

## Registration

`modules/integrations/providers/emergingCategoryProviders.ts`'s `docusign` entry was updated in place: capabilities `["signature", "webhook", "oauth"]`, `requiredPermission: "integrations.signatures"`.

## Honest disclosure

No DocuSign OAuth client is configured in this environment. The adapter and its Connect signature verification are both real and tested (real HMAC computation, mocked `fetch`), but unverified against a live DocuSign account.

## Contract Platform wiring (v2 Checkpoint 44, Step 9)

`sendContractForSignatureAction()` (`modules/contractPlatform/contractPlatformActions.ts`) connects this real `DocuSignProvider` to the Contract Platform's own `signature_status` state machine — the first actual caller of `createSignatureRequest()` outside its own tests.

1. Resolves the workspace's connected DocuSign account (`listConnections()` filtered to `provider_id: "docusign"`, `state: "connected"`) — the identical resolution pattern `modules/integrations/notificationDeliveryProviders.ts`'s own Gmail lookup already uses, not a new connection-lookup mechanism.
2. Builds the document actually sent to DocuSign from the Contract's own plain fields (title/description/notes) through the Shared PDF Renderer (`renderDocumentToPdf`, Checkpoint 44 Step 3) and `WorkspaceBranding` (Step 1) — a real branded PDF, not a placeholder.
3. Calls `provider.createSignatureRequest({documentName, documentContent, signers: [{name, email}]})` with the Client resolved from the Contract's own `client_id`.
4. On success, reuses `sendContract()` — the existing `lib/data/contracts` transition — for the actual `signature_status: "sent"` write and its own Timeline event. **Never a second status-flip path**: a contract sent for signature through DocuSign and one marked sent any other way go through the identical transition.
5. On failure, records a sanitized error via `sanitizeIntegrationError()`/`insertErrorRecord()` — the same redaction discipline `docs/integration-security.md` documents for every other provider.

The old Contract Variable Engine's own `ContractSnapshot.sections` content is deliberately untouched — this checkpoint's own instruction was explicit ("Não migre nem substitua o Contract Variable Engine antigo"). The signing document is built from the Contract's plain fields specifically so this new capability never has to touch that older engine.
