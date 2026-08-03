import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { getDataMode } from "@/lib/env";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { mapContractRow } from "@/lib/supabase/mappers";
import { readContracts } from "@/lib/data/mock/contractsStore";
import { getNotesByOwner } from "@/lib/data/mock/notesTimelineShared";
import { fetchNotesForOwnerSupabase } from "@/lib/data/core/notesTimelineSupabaseShared";
import { EVENT_TYPE_LABELS } from "@/core/enums/eventType";
import { computeScheduleStats } from "@/modules/events/scheduleStats";
import { fetchEventContextRecord } from "@/modules/ai/fetchEventContext.server";
import type { Contract } from "@/types/contract";
import type { AIContextBuilder } from "@/core/ai/context/types";

const CONSULTATION_NOTES_LIMIT = 8;

export interface ProposalDetailsContextData {
  event: {
    id: string;
    title: string;
    eventType: string;
    eventDate: string | null;
    locationName: string | null;
    guestCount: number | null;
    budgetMin: number | null;
    budgetMax: number | null;
    theme: string | null;
    colorPalette: string | null;
    packageName: string | null;
  };
  venue: {
    locationName: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    backupLocation: string | null;
    weatherPlan: string | null;
  };
  timelineSummary: {
    totalScheduleItems: number;
    spanStart: string | null;
    spanEnd: string | null;
    firstItemTitle: string | null;
    lastItemTitle: string | null;
  };
  consultationNotes: string[];
  importantConstraints: string[];
  /** `null` when no Contract exists yet for this Event — Contract's own `deposit_amount`/`remaining_balance` are plain major-unit numbers, not minor-unit like `EventService.price_minor` (see `proposal/types.ts`'s doc comment). */
  contractPaymentTerms: { depositAmount: number | null; remainingBalance: number | null; currency: string } | null;
  eventMissingInformation: string[];
}

/** `@/lib/supabase/server` is imported dynamically — see `clientContextBuilder.ts`'s identical doc comment for why. */
async function fetchContract(workspaceId: string, eventId: string): Promise<Contract | null> {
  if (getDataMode() !== "supabase") {
    return readContracts().find((candidate) => candidate.event_id === eventId) ?? null;
  }
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase.from("contracts").select("*").eq("workspace_id", workspaceId).eq("event_id", eventId);
  if (error) throw normalizeSupabaseError(error);
  return data && data.length > 0 ? mapContractRow(data[0]) : null;
}

async function fetchNotes(supabase: SupabaseClient<Database> | null, workspaceId: string, eventId: string) {
  if (!supabase) return getNotesByOwner(workspaceId, "event", eventId);
  return fetchNotesForOwnerSupabase(supabase, workspaceId, "event", eventId);
}

/**
 * The Proposal Generator's own composite section — Event/Venue fields,
 * Timeline Summary, Consultation Notes, and existing Contract payment
 * terms don't decompose cleanly into the generic `event`/`client`/
 * `eventServiceAssignment` sections (the registered `event` builder
 * already holds a different feature's specific shape,
 * `EventOperationsBriefContext`) — see `core/ai/context/types.ts`'s doc
 * comment on `proposalContext` for why a dedicated key is the right call
 * here rather than forcing this into an existing one.
 *
 * Reuses `fetchEventContextRecord` for the raw Event + Schedule fetch
 * (ignoring its `client`/`checklist` — those aren't needed here) rather
 * than re-deriving that Supabase/mock branching a second time.
 */
export const proposalDetailsContextBuilder: AIContextBuilder = {
  key: "proposalContext",
  priority: 7,
  async build({ workspaceId, refs }) {
    if (!refs.eventId) return null;
    const record = await fetchEventContextRecord(refs.eventId);
    if (!record) return null;

    const isSupabase = getDataMode() === "supabase";
    const supabase = isSupabase ? await (await import("@/lib/supabase/server")).createClient() : null;

    const [contract, notes] = await Promise.all([
      fetchContract(workspaceId, refs.eventId),
      fetchNotes(supabase, workspaceId, refs.eventId),
    ]);

    const { event, schedule } = record;
    const scheduleStats = computeScheduleStats(schedule);

    const importantConstraints: string[] = [];
    if (event.surprise_event) {
      importantConstraints.push("This is a surprise event — keep all details confidential from anyone other than the person requesting it.");
    }
    if (event.confidentiality_notes) {
      importantConstraints.push(event.confidentiality_notes);
    }

    const eventMissingInformation: string[] = [];
    if (!event.event_date) eventMissingInformation.push("Event date");
    if (!event.location_name) eventMissingInformation.push("Location");
    if (event.budget_min === null && event.budget_max === null) eventMissingInformation.push("Budget range");

    const data: ProposalDetailsContextData = {
      event: {
        id: event.id,
        title: event.title,
        eventType: EVENT_TYPE_LABELS[event.event_type],
        eventDate: event.event_date,
        locationName: event.location_name,
        guestCount: event.guest_count,
        budgetMin: event.budget_min,
        budgetMax: event.budget_max,
        theme: event.theme,
        colorPalette: event.color_palette,
        packageName: event.package_name,
      },
      venue: {
        locationName: event.location_name,
        address: event.address,
        city: event.city,
        state: event.state,
        backupLocation: event.backup_location,
        weatherPlan: event.weather_plan,
      },
      timelineSummary: {
        totalScheduleItems: scheduleStats.total,
        spanStart: scheduleStats.spanStart,
        spanEnd: scheduleStats.spanEnd,
        firstItemTitle: scheduleStats.first?.title ?? null,
        lastItemTitle: scheduleStats.last?.title ?? null,
      },
      consultationNotes: notes.slice(0, CONSULTATION_NOTES_LIMIT).map((note) => note.content),
      importantConstraints,
      contractPaymentTerms:
        contract && (contract.deposit_amount !== null || contract.remaining_balance !== null)
          ? { depositAmount: contract.deposit_amount, remainingBalance: contract.remaining_balance, currency: contract.currency }
          : null,
      eventMissingInformation,
    };

    return { data, source: "fetchEventContextRecord+fetchContract+fetchNotes+computeScheduleStats" };
  },
};
