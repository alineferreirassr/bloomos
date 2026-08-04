import type { Event } from "@/types/event";
import type { ChecklistItem } from "@/types/checklistItem";
import type { EventScheduleItem } from "@/types/eventScheduleItem";
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { EventStatus } from "@/core/enums/eventStatus";
import type { EventType } from "@/core/enums/eventType";
import type { EventLifecycleStage } from "@/core/enums/eventLifecycleStage";
import type { EventPriority } from "@/core/enums/eventPriority";
import type { ChecklistStatus } from "@/core/enums/checklistStatus";
import type { ScheduleStatus } from "@/core/enums/scheduleStatus";
import type { EventFormInput } from "@/modules/events/schema";
import type { ScheduleItemInput } from "@/modules/events/schema";
import type { ChecklistItemInput } from "@/modules/checklist/schema";
import type { NoteFormInput } from "@/modules/notes/schema";
import type { DataResult } from "@/lib/data/result";
import type { ServerRepositoryContext } from "@/lib/auth/workspaceSession";

export interface EventFilters {
  search?: string;
  status?: EventStatus | "all";
  lifecycleStage?: EventLifecycleStage | "all";
  eventType?: EventType | "all";
  priority?: EventPriority | "all";
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
  includeArchived?: boolean;
}

/**
 * The single Events persistence contract — implemented once by the mock
 * repository (lib/data/events/mockRepository.ts) and once by the Supabase
 * repository (lib/data/events/supabaseRepository.ts), exactly mirroring the
 * Leads/Clients repository pattern. lib/data/index.ts picks between them via
 * lib/data/provider.ts's selectRepository().
 *
 * Bundles Events, Checklist, Schedule, and Event Notes/Timeline together —
 * unlike Leads/Clients, these four concerns share one Supabase repository
 * file because every Checklist/Schedule/Note/Timeline read or write for an
 * Event needs that Event's workspace_id first, and splitting them into
 * separate repository files would mean re-deriving the same session/actor
 * resolution logic four times over.
 */
export interface EventsRepository {
  /**
   * `context` lets a Server Component/Server Action pass an
   * already-authenticated server Supabase client + Workspace session,
   * instead of this repository resolving its own via the Client
   * Component-only `getClientWorkspaceSession()` (which always resolves as
   * unauthenticated during SSR). Optional and ignored by the mock
   * implementation.
   */
  getEvents(filters?: EventFilters, context?: ServerRepositoryContext): Promise<Event[]>;
  getEventById(id: string): Promise<Event>;
  createEvent(input: EventFormInput): Promise<DataResult<Event>>;
  updateEvent(id: string, input: EventFormInput): Promise<DataResult<Event>>;
  updateEventStatus(id: string, status: EventStatus): Promise<DataResult<Event>>;
  updateEventLifecycleStage(id: string, stage: EventLifecycleStage): Promise<DataResult<Event>>;
  updateEventPriority(id: string, priority: EventPriority): Promise<DataResult<Event>>;
  archiveEvent(id: string): Promise<DataResult<Event>>;
  restoreEvent(id: string): Promise<DataResult<Event>>;
  cancelEvent(id: string): Promise<DataResult<Event>>;
  completeEvent(id: string): Promise<DataResult<Event>>;
  getEventNextAction(eventId: string): Promise<string | null>;

  getChecklistByEventId(eventId: string, context?: ServerRepositoryContext): Promise<ChecklistItem[]>;
  createChecklistItem(eventId: string, input: ChecklistItemInput): Promise<DataResult<ChecklistItem>>;
  updateChecklistItem(id: string, input: ChecklistItemInput): Promise<DataResult<ChecklistItem>>;
  updateChecklistItemStatus(id: string, status: ChecklistStatus): Promise<DataResult<ChecklistItem>>;
  completeChecklistItem(id: string): Promise<DataResult<ChecklistItem>>;
  deleteChecklistItem(id: string): Promise<DataResult<null>>;
  reorderChecklistItems(eventId: string, orderedIds: string[]): Promise<DataResult<ChecklistItem[]>>;

  getScheduleByEventId(eventId: string, context?: ServerRepositoryContext): Promise<EventScheduleItem[]>;
  createScheduleItem(eventId: string, input: ScheduleItemInput): Promise<DataResult<EventScheduleItem>>;
  updateScheduleItem(id: string, input: ScheduleItemInput): Promise<DataResult<EventScheduleItem>>;
  updateScheduleItemStatus(id: string, status: ScheduleStatus): Promise<DataResult<EventScheduleItem>>;
  deleteScheduleItem(id: string): Promise<DataResult<null>>;
  reorderScheduleItems(eventId: string, orderedIds: string[]): Promise<DataResult<EventScheduleItem[]>>;

  getNotesByEventId(eventId: string): Promise<Note[]>;
  createEventNote(eventId: string, input: NoteFormInput): Promise<DataResult<Note>>;
  /**
   * Same null-fallthrough contract as LeadsRepository/ClientsRepository's
   * togglePinNote/togglePinClientNote — null means "not an Event-owned
   * note," letting the shared lib/data/index.ts togglePinNote() try Leads,
   * then Clients, then Events, before falling through to the generic
   * mock-only path for every other not-yet-migrated owner type.
   */
  togglePinEventNote(noteId: string): Promise<DataResult<Note> | null>;
  getTimelineByEventId(eventId: string): Promise<TimelineActivity[]>;
}
