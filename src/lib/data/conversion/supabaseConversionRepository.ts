import type { Lead } from "@/types/lead";
import type { Client } from "@/types/client";
import { UnauthorizedError, ForbiddenError } from "@/core/errors";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { createClient } from "@/lib/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { mapLeadRow, mapClientRow } from "@/lib/supabase/mappers";
import { getClientWorkspaceSession, type WorkspaceSession } from "@/lib/auth/workspaceSessionClient";
import type { ConversionRepository } from "@/lib/data/conversion/repository";
import type { Database } from "@/types/database.types";

type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type ClientRow = Database["public"]["Tables"]["clients"]["Row"];

/** Same rationale as leads/supabaseRepository.ts's requireWorkspaceSession. */
async function requireWorkspaceSession(): Promise<WorkspaceSession> {
  const result = await getClientWorkspaceSession();
  if (result.status === "unauthenticated") {
    throw new UnauthorizedError("Authentication is required.");
  }
  if (result.status === "no-workspace") {
    throw new ForbiddenError("You don't have permission to do that.");
  }
  return result.session;
}

function resolveActorName(session: WorkspaceSession): string {
  return session.profile.full_name ?? session.profile.email;
}

/**
 * Calls the convert_lead_to_client(uuid, text) Postgres function (see
 * supabase/migrations/20260717100500_lead_to_client_conversion.sql) — all
 * validation, the Client insert, the Lead update, and both timeline entries
 * happen inside that single atomic function call. `security invoker` means
 * RLS still governs every statement inside it, scoped to the caller's own
 * Workspace, exactly like every other Supabase write in this codebase.
 *
 * The function raises with SQLSTATE 'P0001' for every business-rule
 * rejection (not found, archived, already converted) with a user-facing
 * message as the exception text — those are surfaced as DataResult failures
 * here, not thrown, matching LeadConversionService's (the mock) contract.
 * Any other error (network, RLS silently hiding a cross-workspace id as "not
 * found" via the function's own `if not found`, etc.) is normalized and
 * thrown, same as the rest of this repository's error handling.
 */
async function convertLeadToClient(leadId: string): Promise<DataResult<{ lead: Lead; client: Client }>> {
  const session = await requireWorkspaceSession();
  const supabase = createClient();
  const actor = resolveActorName(session);

  const { data, error } = await supabase.rpc("convert_lead_to_client", {
    p_lead_id: leadId,
    p_actor: actor,
  });

  if (error) {
    if (error.code === "P0001") {
      return fail(error.message);
    }
    throw normalizeSupabaseError(error);
  }

  const result = data as unknown as { lead: LeadRow; client: ClientRow };
  return ok({ lead: mapLeadRow(result.lead), client: mapClientRow(result.client) });
}

export const supabaseConversionRepository: ConversionRepository = {
  convertLeadToClient,
};
