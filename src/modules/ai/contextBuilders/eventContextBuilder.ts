import { fetchEventContextRecord } from "@/modules/ai/fetchEventContext.server";
import { buildEventOperationsBriefContext } from "@/modules/ai/contextBuilder";
import type { AIContextBuilder } from "@/core/ai/context/types";

/**
 * Wraps the pre-platform Event Operations Brief context pipeline
 * (`fetchEventContextRecord` + `buildEventOperationsBriefContext`) as a
 * registered Context Orchestrator section, so any future use case can
 * request `event` context without duplicating that fetch-then-shape logic.
 * Lives in `modules/ai`, not `core/ai/context/builders`, because it depends
 * on Event-specific modules that `core/ai` must never import — `core`
 * stays the foundation modules build on, not the reverse.
 *
 * Requires `refs.eventId`; returns `null` (never partial data) when it's
 * missing or the Event doesn't exist. Workspace isolation is enforced the
 * same way `fetchEventContextRecord` itself already enforces it — RLS in
 * Supabase mode, single-tenant by construction in mock mode — rather than a
 * second `workspace_id` comparison here, since `workspaceId` isn't part of
 * `fetchEventContextRecord`'s own lookup key and re-deriving that check at
 * this layer would only be able to compare against whatever the record
 * itself reports, not an independent source of truth.
 */
export const eventContextBuilder: AIContextBuilder = {
  key: "event",
  priority: 5,
  async build({ refs }) {
    if (!refs.eventId) return null;
    const record = await fetchEventContextRecord(refs.eventId);
    if (!record) return null;
    const context = buildEventOperationsBriefContext(record.event, record.client, record.checklist, record.schedule);
    return { data: context, source: "fetchEventContextRecord+buildEventOperationsBriefContext" };
  },
};
