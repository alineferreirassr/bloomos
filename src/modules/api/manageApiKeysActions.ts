"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { createApiKey, listApiKeysForWorkspace, rotateApiKey, revokeApiKey, seedDemoApiKey } from "@/lib/data/core/api/apiKeyStore";
import { getLogger } from "@/core/observability/logger";
import type { ApiKey, ApiKeyWithSecret, CreateApiKeyInput } from "@/types/apiKey";

const GENERIC_ACCESS_ERROR = "The Developer Console isn't available. You may not have access to it.";

export type ManageApiKeysResult<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Checkpoint 16, Step 11 — every Developer Console mutation funnels
 * through this one file, each independently re-checking `workspace.manage`
 * (the same elevated permission `/settings` itself requires — issuing or
 * revoking a credential that reads live business data is at least as
 * sensitive as changing a Workspace setting). Never the API Key's own
 * scopes — those govern what the *issued key* can read through the Public
 * API, a completely different axis from what the *member managing keys*
 * is allowed to do inside BloomOS.
 */

export async function listApiKeysAction(): Promise<ManageApiKeysResult<ApiKey[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  await seedDemoApiKey(session.workspace.id, session.membership.id);
  return { success: true, data: listApiKeysForWorkspace(session.workspace.id) };
}

export async function createApiKeyAction(input: CreateApiKeyInput): Promise<ManageApiKeysResult<ApiKeyWithSecret>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const trimmedName = input.name.trim();
  if (!trimmedName) return { success: false, error: "Give this API Key a name." };
  if (input.scopes.length === 0) return { success: false, error: "Select at least one scope." };

  const result = await createApiKey(session.workspace.id, session.membership.id, { name: trimmedName, scopes: input.scopes });
  getLogger().info("API Key created", { workspaceId: session.workspace.id, apiKeyId: result.key.id, scopes: result.key.scopes.join(",") });
  return { success: true, data: result };
}

export async function rotateApiKeyAction(id: string): Promise<ManageApiKeysResult<ApiKeyWithSecret>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const existing = listApiKeysForWorkspace(session.workspace.id).find((key) => key.id === id);
  if (!existing) return { success: false, error: GENERIC_ACCESS_ERROR };

  const result = await rotateApiKey(id);
  if (!result) return { success: false, error: "This API Key has already been revoked and can't be rotated." };
  getLogger().info("API Key rotated", { workspaceId: session.workspace.id, apiKeyId: id });
  return { success: true, data: result };
}

export async function revokeApiKeyAction(id: string): Promise<ManageApiKeysResult<ApiKey>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const existing = listApiKeysForWorkspace(session.workspace.id).find((key) => key.id === id);
  if (!existing) return { success: false, error: GENERIC_ACCESS_ERROR };

  const revoked = revokeApiKey(id);
  if (!revoked) return { success: false, error: GENERIC_ACCESS_ERROR };
  getLogger().info("API Key revoked", { workspaceId: session.workspace.id, apiKeyId: id });
  return { success: true, data: revoked };
}
