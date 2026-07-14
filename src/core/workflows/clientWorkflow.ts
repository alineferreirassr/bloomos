import type { ContactMethod } from "@/core/enums/contactMethod";

interface ClientForNextAction {
  phone: string | null;
  preferred_contact_method: ContactMethod | null;
  partner_name: string | null;
  favorite_colors: string | null;
  favorite_flowers: string | null;
  favorite_music: string | null;
  favorite_food: string | null;
  favorite_drinks: string | null;
  preferred_style: string | null;
  archived_at: string | null;
}

interface ClientNextActionContext {
  hasNotes: boolean;
  /** Events doesn't exist yet — callers pass false until that module is built. */
  hasRelatedEvent: boolean;
}

/**
 * Short, human-readable, deterministic suggestion for what to do next with
 * this Client — mirrors getNextRecommendedAction in leadWorkflow.ts. Checked
 * in priority order: missing contact info, then no preferences recorded,
 * then no notes, then no related event. Archived clients get no suggestion.
 */
export function getClientNextRecommendedAction(
  client: ClientForNextAction,
  context: ClientNextActionContext,
): string | null {
  if (client.archived_at) return null;

  if (!client.phone) {
    return "Add a phone number for this client";
  }

  const hasAnyPreference =
    client.preferred_contact_method !== null ||
    !!client.partner_name ||
    !!client.favorite_colors ||
    !!client.favorite_flowers ||
    !!client.favorite_music ||
    !!client.favorite_food ||
    !!client.favorite_drinks ||
    !!client.preferred_style;
  if (!hasAnyPreference) {
    return "Record this client's preferences";
  }

  if (!context.hasNotes) {
    return "Add a note for this client";
  }

  if (!context.hasRelatedEvent) {
    return "Create a related event for this client";
  }

  return null;
}
