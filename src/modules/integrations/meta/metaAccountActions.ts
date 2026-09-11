"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getOwnProviderConnectionAction } from "@/modules/integrations/manageOAuthConnectionActions";
import { resolveAccessToken } from "@/core/integrations/credentialManager";
import { setConnectionConfig } from "@/core/integrations/integrationManager";
import { MetaProvider, isMetaAuthError, type MetaPageSummary } from "@/core/integrations/providers/meta/metaProvider";
import { sanitizeIntegrationError } from "@/core/integrations/errorSanitizer";
import { insertErrorRecord } from "@/lib/data/core/integrations/errorRecordStore";
import type { IntegrationConnection } from "@/core/integrations/types";

/**
 * SOCIAL-02 — Meta account/Page/Instagram discovery and selection. This
 * is deliberately its own file, not folded into the generic
 * `manageOAuthConnectionActions.ts` — connect/disconnect/refresh stay
 * fully generic there; everything Meta-specific (talking to the real
 * Graph API, choosing a publishing identity) lives here, gated on
 * `workspace.manage` per this checkpoint's own explicit instruction
 * (never a new `social.*` permission yet — that's SOCIAL-03's, once a
 * real Social domain exists to gate).
 */

const GENERIC_ACCESS_ERROR = "That integration connection isn't available. You may not have access to it.";
const RECONNECT_ERROR = "Meta rejected this connection — reconnect Meta to continue.";
const NOT_CONNECTED_ERROR = "Connect Meta first.";

type Result<T> = { success: true; data: T } | { success: false; error: string };

export interface MetaSelectedIdentity {
  pageId: string;
  pageName: string;
  instagramAccountId: string | null;
  instagramUsername: string | null;
}

function readConfigString(config: Record<string, string | number | boolean>, key: string): string | null {
  const value = config[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function requireMetaConnectionWithToken(): Promise<{ connection: IntegrationConnection; accessToken: string } | { error: string }> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { error: GENERIC_ACCESS_ERROR };

  const own = await getOwnProviderConnectionAction("meta");
  if (!own.success) return { error: own.error };
  if (!own.data || own.data.state !== "connected" || !own.data.credential_id) return { error: NOT_CONNECTED_ERROR };

  const accessToken = await resolveAccessToken(own.data.credential_id);
  if (!accessToken) return { error: RECONNECT_ERROR };

  return { connection: own.data, accessToken };
}

/**
 * Live Page + Instagram account discovery — always re-queries the real
 * Graph API, never reads a cached/stored list. Distinguishes an
 * auth-shaped failure (report "reconnect") from any other provider error
 * (sanitized and recorded, matching every other provider's own error
 * discipline — never a raw Graph API response reaches the caller).
 */
export async function discoverMetaAccountsAction(): Promise<Result<MetaPageSummary[]>> {
  const resolved = await requireMetaConnectionWithToken();
  if ("error" in resolved) return { success: false, error: resolved.error };

  try {
    const pages = await new MetaProvider(resolved.accessToken).listPages();
    return { success: true, data: pages };
  } catch (error) {
    if (isMetaAuthError(error)) return { success: false, error: RECONNECT_ERROR };
    const record = sanitizeIntegrationError({ connectionId: resolved.connection.id, providerId: "meta", rawMessage: error instanceof Error ? error.message : "Unknown Meta error" });
    insertErrorRecord(record);
    return { success: false, error: record.message };
  }
}

/** The durable, selected publishing identity — read from the connection's own generic `config` metadata (no new table; see SOCIAL-02's own architecture-gate report). `null` when nothing has been selected yet, distinct from a Meta connection that doesn't exist at all. */
export async function getSelectedMetaPublishingIdentityAction(): Promise<Result<MetaSelectedIdentity | null>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const own = await getOwnProviderConnectionAction("meta");
  if (!own.success) return { success: false, error: own.error };
  if (!own.data) return { success: true, data: null };

  const pageId = readConfigString(own.data.config, "meta_page_id");
  if (!pageId) return { success: true, data: null };

  return {
    success: true,
    data: {
      pageId,
      pageName: readConfigString(own.data.config, "meta_page_name") ?? pageId,
      instagramAccountId: readConfigString(own.data.config, "meta_instagram_account_id"),
      instagramUsername: readConfigString(own.data.config, "meta_instagram_username"),
    },
  };
}

/**
 * Persists the workspace's chosen publishing identity. Never trusts the
 * caller-supplied `page` blindly — re-derives the current, real list of
 * discoverable Pages from Meta's own API and only accepts a selection
 * that's actually present in it, so a caller can't select a foreign Page
 * id that was never discoverable on this connection.
 */
export async function selectMetaPublishingIdentityAction(page: { id: string }): Promise<Result<MetaSelectedIdentity>> {
  const resolved = await requireMetaConnectionWithToken();
  if ("error" in resolved) return { success: false, error: resolved.error };

  let pages: MetaPageSummary[];
  try {
    pages = await new MetaProvider(resolved.accessToken).listPages();
  } catch (error) {
    if (isMetaAuthError(error)) return { success: false, error: RECONNECT_ERROR };
    return { success: false, error: "Could not verify this Page with Meta — try again." };
  }

  const match = pages.find((candidate) => candidate.id === page.id);
  if (!match) return { success: false, error: "That Page is no longer available on this Meta connection." };

  const updated = await setConnectionConfig(resolved.connection.id, {
    meta_page_id: match.id,
    meta_page_name: match.name,
    meta_instagram_account_id: match.instagramAccountId ?? "",
    meta_instagram_username: match.instagramUsername ?? "",
  });
  if (!updated) return { success: false, error: "Could not save the selected Page." };

  return { success: true, data: { pageId: match.id, pageName: match.name, instagramAccountId: match.instagramAccountId, instagramUsername: match.instagramUsername } };
}
