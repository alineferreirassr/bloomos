import type { Database } from "@/types/database.types";
import type { Profile } from "@/types/profile";
import type { Workspace } from "@/types/workspace";
import type { WorkspaceMember } from "@/types/workspaceMember";
import type { Lead } from "@/types/lead";
import type { Client, ClientImportantDate } from "@/types/client";
import type { Event } from "@/types/event";
import type { ChecklistItem } from "@/types/checklistItem";
import type { EventScheduleItem } from "@/types/eventScheduleItem";
import type { Note, NoteAttachment } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { WorkspaceMemberStatus } from "@/core/enums/workspaceMemberStatus";
import type { LeadStatus } from "@/core/enums/leadStatus";
import type { ClientStatus } from "@/core/enums/clientStatus";
import type { ContactMethod } from "@/core/enums/contactMethod";
import type { EntityType } from "@/core/enums/entityType";
import type { EventType } from "@/core/enums/eventType";
import type { EventStatus } from "@/core/enums/eventStatus";
import type { EventLifecycleStage } from "@/core/enums/eventLifecycleStage";
import type { EventPriority } from "@/core/enums/eventPriority";
import type { ChecklistCategory } from "@/core/enums/checklistCategory";
import type { ChecklistStatus } from "@/core/enums/checklistStatus";
import type { AssignedType } from "@/core/enums/assignedType";
import type { ScheduleCategory } from "@/core/enums/scheduleCategory";
import type { ScheduleStatus } from "@/core/enums/scheduleStatus";
import type { NoteCategory } from "@/core/enums/noteCategory";
import type { NotePriority } from "@/core/enums/notePriority";
import type { TimelineActivityType } from "@/core/enums/timelineActivityType";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type WorkspaceRow = Database["public"]["Tables"]["workspaces"]["Row"];
type WorkspaceMemberRow = Database["public"]["Tables"]["workspace_members"]["Row"];
type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type EventRow = Database["public"]["Tables"]["events"]["Row"];
type ChecklistItemRow = Database["public"]["Tables"]["checklist_items"]["Row"];
type EventScheduleItemRow = Database["public"]["Tables"]["event_schedule_items"]["Row"];
type NoteRow = Database["public"]["Tables"]["notes"]["Row"];
type TimelineActivityRow = Database["public"]["Tables"]["timeline_activities"]["Row"];

/**
 * Deliberate seam between raw database rows and domain types, even though
 * the shapes are ~identical today — this is where future column renames or
 * derived fields get absorbed without leaking the DB shape into callers.
 * Never pass a raw *Row straight through application code; always go
 * through one of these.
 */
export function mapProfileRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    avatar_url: row.avatar_url,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapWorkspaceRow(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
  };
}

export function mapWorkspaceMemberRow(row: WorkspaceMemberRow): WorkspaceMember {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    user_id: row.user_id,
    role: row.role as WorkspaceMemberRole,
    status: row.status as WorkspaceMemberStatus,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapLeadRow(row: LeadRow): Lead {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone,
    instagram: row.instagram,
    source: row.source,
    event_type: row.event_type,
    event_date: row.event_date,
    location: row.location,
    budget_min: row.budget_min,
    budget_max: row.budget_max,
    message: row.message,
    status: row.status as LeadStatus,
    assigned_to: row.assigned_to,
    converted_client_id: row.converted_client_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
  };
}

export function mapClientRow(row: ClientRow): Client {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    originating_lead_id: row.originating_lead_id,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone,
    instagram: row.instagram,
    preferred_contact_method: row.preferred_contact_method as ContactMethod | null,
    partner_name: row.partner_name,
    relationship_status: row.relationship_status,
    important_dates: (row.important_dates as unknown as ClientImportantDate[] | null) ?? [],
    address: row.address,
    city: row.city,
    state: row.state,
    zip_code: row.zip_code,
    source: row.source,
    tags: row.tags,
    internal_status: row.internal_status as ClientStatus,
    is_returning: row.is_returning,
    how_they_met: row.how_they_met,
    first_date: row.first_date,
    relationship_anniversary: row.relationship_anniversary,
    engagement_date: row.engagement_date,
    wedding_date: row.wedding_date,
    favorite_colors: row.favorite_colors,
    favorite_flowers: row.favorite_flowers,
    favorite_music: row.favorite_music,
    favorite_food: row.favorite_food,
    favorite_drinks: row.favorite_drinks,
    preferred_style: row.preferred_style,
    disliked_elements: row.disliked_elements,
    allergies: row.allergies,
    accessibility_needs: row.accessibility_needs,
    dietary_restrictions: row.dietary_restrictions,
    preferred_communication_time: row.preferred_communication_time,
    do_not_call: row.do_not_call,
    surprise_event_confidentiality: row.surprise_event_confidentiality,
    emergency_contact_name: row.emergency_contact_name,
    emergency_contact_phone: row.emergency_contact_phone,
    is_vip: row.is_vip,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
  };
}

export function mapEventRow(row: EventRow): Event {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    client_id: row.client_id,
    originating_lead_id: row.originating_lead_id,
    title: row.title,
    event_type: row.event_type as EventType,
    status: row.status as EventStatus,
    lifecycle_stage: row.lifecycle_stage as EventLifecycleStage,
    event_date: row.event_date,
    start_time: row.start_time,
    end_time: row.end_time,
    timezone: row.timezone,
    location_name: row.location_name,
    address: row.address,
    city: row.city,
    state: row.state,
    zip_code: row.zip_code,
    latitude: row.latitude,
    longitude: row.longitude,
    guest_count: row.guest_count,
    budget_min: row.budget_min,
    budget_max: row.budget_max,
    package_name: row.package_name,
    theme: row.theme,
    color_palette: row.color_palette,
    surprise_event: row.surprise_event,
    confidentiality_notes: row.confidentiality_notes,
    accessibility_notes: row.accessibility_notes,
    dietary_notes: row.dietary_notes,
    weather_plan: row.weather_plan,
    backup_location: row.backup_location,
    internal_summary: row.internal_summary,
    assigned_owner: row.assigned_owner,
    priority: row.priority as EventPriority,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
    completed_at: row.completed_at,
    cancelled_at: row.cancelled_at,
  };
}

export function mapChecklistItemRow(row: ChecklistItemRow): ChecklistItem {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    owner_type: row.owner_type as EntityType,
    owner_id: row.owner_id,
    title: row.title,
    description: row.description,
    category: row.category as ChecklistCategory,
    priority: row.priority as NotePriority,
    status: row.status as ChecklistStatus,
    due_date: row.due_date,
    completed_at: row.completed_at,
    assigned_type: row.assigned_type as AssignedType,
    assigned_id: row.assigned_id,
    assigned_name: row.assigned_name,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapEventScheduleItemRow(row: EventScheduleItemRow): EventScheduleItem {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    owner_type: row.owner_type as EntityType,
    owner_id: row.owner_id,
    title: row.title,
    description: row.description,
    start_time: row.start_time,
    end_time: row.end_time,
    location: row.location,
    assigned_to: row.assigned_to,
    category: row.category as ScheduleCategory,
    status: row.status as ScheduleStatus,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapNoteRow(row: NoteRow): Note {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    owner_type: row.owner_type as EntityType,
    owner_id: row.owner_id,
    title: row.title,
    content: row.content,
    category: row.category as NoteCategory,
    priority: row.priority as NotePriority,
    is_pinned: row.is_pinned,
    attachments: (row.attachments as unknown as NoteAttachment[] | null) ?? [],
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapTimelineActivityRow(row: TimelineActivityRow): TimelineActivity {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    owner_type: row.owner_type as EntityType,
    owner_id: row.owner_id,
    type: row.type as TimelineActivityType,
    description: row.description,
    actor: row.actor,
    timestamp: row.timestamp,
    ...(row.metadata
      ? { metadata: row.metadata as unknown as Record<string, string | number | boolean | null> }
      : {}),
  };
}
