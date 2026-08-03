import type { ProviderCapability } from "@/core/integrations/types";

/**
 * The Integration SDK (v2 Checkpoint 22, Step 3) — abstract interfaces
 * only. No implementation exists in this checkpoint for any real provider
 * (that's the explicit stop condition); these are the contracts a future
 * checkpoint implements once, per provider, to plug into the Integration
 * Manager with "minimal implementation effort" (the spec's own success
 * criterion). Every method signature here is deliberately generic — no
 * Stripe-shaped, Google-shaped, or Twilio-shaped parameter appears
 * anywhere, so no interface here favors one real provider's API shape
 * over another's.
 */

/** Every provider implements this — the one interface `ProviderFactory` (`providerFactory.ts`) requires to construct a provider instance at all. */
export interface BaseProvider {
  readonly providerId: string;
  readonly capabilities: ProviderCapability[];
  /** A cheap, real connectivity check a health monitor could call — returns quickly, never throws. */
  ping(): Promise<{ ok: boolean; latencyMs: number; error?: string }>;
}

export interface OAuthProvider extends BaseProvider {
  buildAuthorizationUrl(params: { redirectUri: string; scopes: string[]; state: string; codeChallenge?: string }): string;
  exchangeCodeForToken(params: { code: string; redirectUri: string; codeVerifier?: string }): Promise<OAuthTokenResult>;
  refreshAccessToken(refreshToken: string): Promise<OAuthTokenResult>;
  revokeToken(token: string): Promise<{ revoked: boolean }>;
}

export interface OAuthTokenResult {
  accessToken: string;
  refreshToken: string | null;
  expiresInSeconds: number | null;
  scopes: string[];
}

export interface WebhookProvider extends BaseProvider {
  /** Verifies an inbound webhook's signature against this provider's own scheme — the mirror image of `lib/webhooks/signature.ts`'s outbound signing, for a future checkpoint that *receives* webhooks from a real provider rather than only sending BloomOS's own. */
  verifyInboundSignature(params: { rawBody: string; signatureHeader: string; secret: string }): boolean;
  /** Maps a provider-specific inbound event name to one of BloomOS's own internal event types — e.g. a future Stripe implementation maps `"payment_intent.succeeded"` to `"invoice.paid"`. */
  mapInboundEvent(providerEventName: string): string | null;
}

export interface StorageProvider extends BaseProvider {
  uploadFile(params: { fileName: string; mimeType: string; content: Blob }): Promise<{ externalId: string; url: string }>;
  downloadFile(externalId: string): Promise<{ content: Blob; mimeType: string }>;
  deleteFile(externalId: string): Promise<{ deleted: boolean }>;
  listFiles(params: { folderId?: string; cursor?: string }): Promise<{ items: Array<{ externalId: string; name: string }>; nextCursor: string | null }>;
}

export interface MessagingProvider extends BaseProvider {
  sendMessage(params: { channel: string; text: string }): Promise<{ externalMessageId: string }>;
  listChannels(): Promise<Array<{ externalId: string; name: string }>>;
}

export interface CalendarProvider extends BaseProvider {
  createEvent(params: { title: string; startsAt: string; endsAt: string; attendees: string[] }): Promise<{ externalId: string }>;
  updateEvent(externalId: string, params: Partial<{ title: string; startsAt: string; endsAt: string }>): Promise<{ updated: boolean }>;
  deleteEvent(externalId: string): Promise<{ deleted: boolean }>;
  listEvents(params: { from: string; to: string }): Promise<Array<{ externalId: string; title: string; startsAt: string; endsAt: string }>>;
}

export interface PaymentProvider extends BaseProvider {
  createCharge(params: { amountMinor: number; currency: string; description: string }): Promise<{ externalChargeId: string; status: string }>;
  refundCharge(externalChargeId: string, amountMinor?: number): Promise<{ externalRefundId: string; status: string }>;
  getChargeStatus(externalChargeId: string): Promise<{ status: string }>;
}

export interface AIServicesProvider extends BaseProvider {
  complete(params: { prompt: string; maxTokens?: number }): Promise<{ text: string; tokensUsed: number }>;
}

export interface AccountingProvider extends BaseProvider {
  createInvoice(params: { customerRef: string; lineItems: Array<{ description: string; amountMinor: number }> }): Promise<{ externalInvoiceId: string }>;
  recordPayment(externalInvoiceId: string, amountMinor: number): Promise<{ recorded: boolean }>;
  listAccounts(): Promise<Array<{ externalId: string; name: string; type: string }>>;
}

export interface CommunicationProvider extends BaseProvider {
  sendSms(params: { to: string; body: string }): Promise<{ externalMessageId: string; status: string }>;
  sendEmail(params: { to: string; subject: string; body: string }): Promise<{ externalMessageId: string; status: string }>;
}

/**
 * v2 Checkpoint 43 — electronic signature. `docusign` was registered as an
 * `esignature`-category provider back in Checkpoint 22, but no SDK
 * interface existed for it yet — this is that interface. BloomOS's own
 * Contract remains the source of truth; a signature request always
 * references a frozen, already-generated document, never contract logic
 * itself.
 */
export interface SignatureProvider extends BaseProvider {
  createSignatureRequest(params: { documentName: string; documentContent: Blob; signers: Array<{ name: string; email: string }> }): Promise<{ externalRequestId: string }>;
  getSignatureStatus(externalRequestId: string): Promise<{ status: "sent" | "viewed" | "partially_signed" | "signed" | "declined" | "expired" | "cancelled"; completedDocumentUrl: string | null }>;
  cancelSignatureRequest(externalRequestId: string): Promise<{ cancelled: boolean }>;
}

/**
 * Everything else in this file is a capability an individual provider
 * *may* implement, and `ProviderCapability` (`types.ts`) is how the
 * Integration Manager knows which ones a given `ProviderDefinition`
 * declares — without ever importing a provider-specific class into
 * shared code. See `docs/provider-registry.md` for the mapping table.
 */
export type AnyCapabilityProvider =
  | OAuthProvider
  | WebhookProvider
  | StorageProvider
  | MessagingProvider
  | CalendarProvider
  | PaymentProvider
  | AIServicesProvider
  | AccountingProvider
  | CommunicationProvider
  | SignatureProvider;
