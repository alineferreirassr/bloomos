import { getApiKeyByHash, touchApiKeyLastUsed } from "@/lib/data/core/api/apiKeyStore";
import { hashApiKeySecret } from "@/lib/api/apiKeyToken";
import type { ApiAuthContext } from "@/types/api";

export type ApiAuthResult = { kind: "ok"; auth: ApiAuthContext } | { kind: "error"; message: string };

const GENERIC_AUTH_ERROR = "Missing or invalid API Key. Provide it as: Authorization: Bearer <api key secret>.";

/**
 * Checkpoint 16, Step 2 — the one function every route handler resolves
 * auth through (via `createApiHandler`, never called ad hoc per-route).
 * Never distinguishes "no such key" from "revoked key" from "malformed
 * header" in its own response message — same "generic access error, no
 * information leak" discipline every internal Server Action in this
 * codebase already follows for its own auth failures (e.g.
 * `acceptProposalDraft.ts`'s own `GENERIC_ACCESS_ERROR`), just applied to
 * an external caller instead of an internal one.
 */
export async function resolveApiAuth(request: Request): Promise<ApiAuthResult> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return { kind: "error", message: GENERIC_AUTH_ERROR };

  const secret = header.slice("Bearer ".length).trim();
  if (!secret) return { kind: "error", message: GENERIC_AUTH_ERROR };

  const key_hash = await hashApiKeySecret(secret);
  const key = getApiKeyByHash(key_hash);
  if (!key || key.revoked_at !== null) return { kind: "error", message: GENERIC_AUTH_ERROR };

  touchApiKeyLastUsed(key.id);
  return { kind: "ok", auth: { apiKeyId: key.id, workspaceId: key.workspace_id, scopes: key.scopes } };
}
