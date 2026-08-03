import type { EventType } from "@/core/enums/eventType";
import type { EventStatus } from "@/core/enums/eventStatus";
import type { EventLifecycleStage } from "@/core/enums/eventLifecycleStage";
import type { EventPriority } from "@/core/enums/eventPriority";

/**
 * The operational center of BloomOS. Field names mirror docs/database.md
 * conventions (snake_case) rather than being translated to camelCase, same
 * as Lead and Client — no Supabase mapping layer exists yet.
 *
 * `status` and `lifecycle_stage` are deliberately separate concepts (see
 * core/workflows/eventWorkflow.ts): status is the operational/booking state
 * (draft, awaiting_contract, confirmed...), lifecycle_stage is where the
 * event sits in the planning pipeline (intake, planning, execution...).
 * Neither is inferred from the other.
 *
 * Contracts, payments, deposits, and inventory reservations don't exist yet
 * — `status` includes `awaiting_contract`/`awaiting_deposit` as explicit
 * placeholder states so the workflow can react to them today, without this
 * type depending on any not-yet-built module.
 */
export interface Event {
  id: string;
  workspace_id: string;
  client_id: string;
  originating_lead_id: string | null;
  title: string;
  event_type: EventType;
  status: EventStatus;
  lifecycle_stage: EventLifecycleStage;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  timezone: string | null;
  location_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  latitude: number | null;
  longitude: number | null;
  guest_count: number | null;
  budget_min: number | null;
  budget_max: number | null;
  package_name: string | null;
  theme: string | null;
  color_palette: string | null;
  surprise_event: boolean;
  confidentiality_notes: string | null;
  accessibility_notes: string | null;
  dietary_notes: string | null;
  weather_plan: string | null;
  backup_location: string | null;
  internal_summary: string | null;
  assigned_owner: string | null;
  priority: EventPriority;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
}
