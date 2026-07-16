import type { Database } from "@/types/database.types";
import type { Profile } from "@/types/profile";
import type { Workspace } from "@/types/workspace";
import type { WorkspaceMember } from "@/types/workspaceMember";
import type { Lead } from "@/types/lead";
import type { Note, NoteAttachment } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { WorkspaceMemberStatus } from "@/core/enums/workspaceMemberStatus";
import type { LeadStatus } from "@/core/enums/leadStatus";
import type { EntityType } from "@/core/enums/entityType";
import type { NoteCategory } from "@/core/enums/noteCategory";
import type { NotePriority } from "@/core/enums/notePriority";
import type { TimelineActivityType } from "@/core/enums/timelineActivityType";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type WorkspaceRow = Database["public"]["Tables"]["workspaces"]["Row"];
type WorkspaceMemberRow = Database["public"]["Tables"]["workspace_members"]["Row"];
type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
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
