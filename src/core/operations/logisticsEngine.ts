import type { EventScheduleItem } from "@/types/eventScheduleItem";
import type { ScheduleCategory } from "@/core/enums/scheduleCategory";
import { LOGISTICS_PHASES, type LogisticsBuffer, type LogisticsPhase, type LogisticsPlan } from "@/core/operations/types";

/**
 * LogisticsEngine (v2 Checkpoint 21, Step 5) — the Logistics Center is
 * "nearly free": `EventScheduleItem.category` (`ScheduleCategory`) already
 * covers arrival/setup/ceremony/photography/cleanup/departure. This engine
 * is a grouped, ordered view over the Event's own real `getScheduleByEventId`
 * data — never a new schedule model. Loading/Unloading and Travel Buffer are
 * computed, not stored: buffers are the real time gap between consecutive
 * schedule items (by `start_time`), and Loading/Unloading are surfaced as
 * derived notes off the Arrival/Departure phases since no dedicated field
 * exists for them.
 */

const SCHEDULE_CATEGORY_TO_PHASE: Partial<Record<ScheduleCategory, LogisticsPhase>> = {
  arrival: "arrival",
  setup: "setup",
  ceremony: "ceremony",
  photography: "photography",
  cleanup: "cleanup",
  departure: "departure",
};

function toMinutes(time: string | null): number | null {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

/** Pure — groups an Event's real schedule items into the 6 logistics phases, computes real time buffers between consecutive items, and derives Loading/Unloading notes from the Arrival/Departure phases. */
export function buildLogisticsPlan(schedule: EventScheduleItem[]): LogisticsPlan {
  const sorted = [...schedule].sort((a, b) => (toMinutes(a.start_time) ?? Infinity) - (toMinutes(b.start_time) ?? Infinity));

  const phases = sorted
    .map((item) => {
      const phase = SCHEDULE_CATEGORY_TO_PHASE[item.category];
      return phase ? { phase, time: item.start_time, title: item.title, scheduleItemId: item.id } : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const travelBuffers: LogisticsBuffer[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    const currentEnd = toMinutes(current.end_time) ?? toMinutes(current.start_time);
    const nextStart = toMinutes(next.start_time);
    const minutes = currentEnd !== null && nextStart !== null ? Math.max(0, nextStart - currentEnd) : null;
    travelBuffers.push({ minutes, fromTitle: current.title, toTitle: next.title });
  }

  const arrivalItem = sorted.find((item) => item.category === "arrival" || item.category === "delivery");
  const departureItem = sorted.find((item) => item.category === "departure");

  const loadingNote = arrivalItem
    ? `Loading window begins around ${arrivalItem.start_time ?? "the scheduled arrival time"} (${arrivalItem.title}).`
    : "No arrival/delivery schedule item found — add one to plan a loading window.";
  const unloadingNote = departureItem
    ? `Unloading/breakdown begins around ${departureItem.start_time ?? "the scheduled departure time"} (${departureItem.title}).`
    : "No departure schedule item found — add one to plan an unloading window.";

  return { phases, travelBuffers, loadingNote, unloadingNote };
}

export const LOGISTICS_PHASE_ORDER = LOGISTICS_PHASES;
