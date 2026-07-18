import { getDataMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";
import { getCurrentClientAccountContext } from "@/lib/data";
import type { ClientAccountStatus } from "@/core/enums/clientAccountStatus";

/**
 * Resolved by the Client Portal's own root layout (`(client-portal)/layout.tsx`)
 * — a wholly separate route group and session resolver from the internal
 * Team Portal's `resolveMemberSessionSnapshot()`. A client account is never
 * a `workspace_members` row, so it's resolved through an entirely
 * different repository (`ClientAccessRepository`), never through
 * `getWorkspaceSession()`.
 *
 * The `active` variant carries the raw `clientId`/`workspaceId`/
 * `authUserId` (not just display strings) — every Client Portal MVP page
 * (Events/Contracts/Invoices/Documents) scopes its own client-safe query
 * by these ids, resolved once here and threaded through
 * `ClientAccountSessionProvider`, never independently re-fetched per page.
 */
export type ClientAccountSessionSnapshot =
  | { kind: "unauthenticated" }
  | { kind: "no-account" }
  | { kind: "blocked"; status: Exclude<ClientAccountStatus, "active"> }
  | {
      kind: "active";
      authUserId: string;
      accountId: string;
      clientId: string;
      workspaceId: string;
      email: string;
      clientName: string;
      workspaceName: string;
      acceptedAt: string | null;
      lastAccessAt: string | null;
    };

/**
 * Deliberately a plain client-callable function, not a `cache()`-wrapped
 * Server Component resolver like `resolveMemberSessionSnapshot()` — the
 * Supabase-backed `ClientAccessRepository` uses the **browser** Supabase
 * client throughout (the same convention `TeamRepository`'s Supabase
 * implementation already uses, since that UI fetches from Client
 * Components), so resolving a Client Portal session must also happen
 * client-side. This mirrors `InvitationAcceptanceView.tsx`'s own
 * established precedent of checking `supabase.auth.getUser()` directly
 * in a Client Component rather than in a Server Component.
 *
 * Mock mode has no real authentication (the same precedent as
 * `getCurrentWorkspaceMember()`), so it skips the auth check entirely and
 * always resolves through the seeded current client account.
 */
export async function resolveClientAccountSessionSnapshot(): Promise<ClientAccountSessionSnapshot> {
  if (getDataMode() === "supabase") {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return { kind: "unauthenticated" };
  }

  const context = await getCurrentClientAccountContext();
  if (!context) return { kind: "no-account" };
  if (context.account.status !== "active") {
    return { kind: "blocked", status: context.account.status as Exclude<ClientAccountStatus, "active"> };
  }
  return {
    kind: "active",
    authUserId: context.account.auth_user_id,
    accountId: context.account.id,
    clientId: context.account.client_id,
    workspaceId: context.account.workspace_id,
    email: context.account.email,
    clientName: context.clientName,
    workspaceName: context.workspaceName,
    acceptedAt: context.account.accepted_at,
    lastAccessAt: context.account.last_access_at,
  };
}
