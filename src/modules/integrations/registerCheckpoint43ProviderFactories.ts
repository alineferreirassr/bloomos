import { registerProviderFactory } from "@/core/integrations/providerFactory";
import { GoogleCalendarProvider } from "@/core/integrations/providers/googleCalendar/googleCalendarProvider";
import { GmailProvider } from "@/core/integrations/providers/gmail/gmailProvider";
import { TwilioProvider } from "@/core/integrations/providers/twilio/twilioProvider";
import { DocuSignProvider } from "@/core/integrations/providers/docusign/docusignProvider";
import { GoogleDriveProvider } from "@/core/integrations/providers/googleDrive/googleDriveProvider";

let registered = false;

/**
 * v2 Checkpoint 43 — registers the 5 real adapter factories this
 * checkpoint adds, against the provider ids already declared in the
 * Provider Registry (Checkpoint 22), mirroring
 * `registerStripeProviderFactory()`'s own pattern exactly. Each factory
 * throws if constructed without the credential material it needs — a
 * caller must resolve the connection's own credential first
 * (`resolveAccessToken`/`resolveProviderSecret`), never construct an
 * adapter from nothing.
 *
 * OAuth-based adapters (Calendar/Gmail/Drive/DocuSign) take `accessToken`;
 * Twilio (Account SID + Auth Token, not OAuth) packs both into `secret`
 * as `"<accountSid>:<authToken>"`, the same single-string convention
 * Stripe's `provider_secret` credential already established. DocuSign
 * additionally needs an `accountId`/`accountBaseUri` the caller resolves
 * from the connection's own `config` (set at connect time from
 * DocuSign's `/oauth/userinfo` response) — packed into `secret` as
 * `"<accountId>|<accountBaseUri>"` since the factory signature has no
 * third credential slot.
 */
export function registerCheckpoint43ProviderFactories(): void {
  if (registered) return;

  registerProviderFactory("google-calendar", (params) => {
    if (!params?.accessToken) throw new Error("A Google OAuth access token is required to construct a GoogleCalendarProvider instance.");
    return new GoogleCalendarProvider(params.accessToken);
  });

  registerProviderFactory("gmail", (params) => {
    if (!params?.accessToken || !params.secret) throw new Error("A Google OAuth access token and the connected from-address are required to construct a GmailProvider instance.");
    return new GmailProvider(params.accessToken, params.secret);
  });

  registerProviderFactory("twilio", (params) => {
    if (!params?.secret) throw new Error("A Twilio Account SID + Auth Token secret is required to construct a TwilioProvider instance.");
    const [accountSid, authToken, fromNumber] = params.secret.split(":");
    if (!accountSid || !authToken || !fromNumber) throw new Error('Twilio secret must be formatted "<accountSid>:<authToken>:<fromNumber>".');
    return new TwilioProvider(accountSid, authToken, fromNumber);
  });

  registerProviderFactory("docusign", (params) => {
    if (!params?.accessToken || !params.secret) throw new Error("A DocuSign OAuth access token and account context are required to construct a DocuSignProvider instance.");
    const [accountId, accountBaseUri] = params.secret.split("|");
    if (!accountId || !accountBaseUri) throw new Error('DocuSign secret must be formatted "<accountId>|<accountBaseUri>".');
    return new DocuSignProvider(params.accessToken, accountId, accountBaseUri);
  });

  registerProviderFactory("google-drive", (params) => {
    if (!params?.accessToken) throw new Error("A Google OAuth access token is required to construct a GoogleDriveProvider instance.");
    return new GoogleDriveProvider(params.accessToken, params.secret ?? null);
  });

  registered = true;
}
