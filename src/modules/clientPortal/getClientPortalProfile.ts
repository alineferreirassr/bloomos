"use server";

import { getCurrentClientAccountContext, getClientById } from "@/lib/data";
import { getClientPortalPreferences, updateClientPortalPreferences, type ClientPortalPreferences, type UpdateClientPortalPreferencesInput } from "@/lib/data/mock/clientPortalPreferencesStore";
import type { ContactMethod } from "@/core/enums/contactMethod";
import { type DataResult, ok, fail } from "@/lib/data/result";

const GENERIC_ACCESS_ERROR = "Your profile isn't available. Please sign in again.";

export interface ClientPortalProfile {
  personal: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    instagram: string | null;
    partnerName: string | null;
  };
  address: {
    address: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
  };
  preferences: {
    favoriteColors: string | null;
    favoriteFlowers: string | null;
    favoriteMusic: string | null;
    favoriteFood: string | null;
    favoriteDrinks: string | null;
    favoriteRestaurants: string | null;
    preferredStyle: string | null;
    dislikedElements: string | null;
  };
  communicationPreference: ContactMethod | null;
  portalPreferences: ClientPortalPreferences;
}

export type GetClientPortalProfileResult = { success: true; data: ClientPortalProfile } | { success: false; error: string };

/**
 * Checkpoint 36, Step 11 — the Profile Center's own read model. Composes
 * the real, existing `Client` CRM record (`getClientById`) for Personal
 * Information/Addresses/Preferences — every field returned here is a
 * field the client themselves already knows about themselves, so reading
 * their own record back to them introduces no new exposure.
 *
 * "Emergency Contacts" is intentionally NOT included: `types/client.ts`'s
 * own field comment marks `emergency_contact_name`/`emergency_contact_phone`
 * (along with `allergies`/`accessibility_needs`/`dietary_restrictions`/
 * `do_not_call`/`surprise_event_confidentiality`/`is_vip`) "internal-only;
 * never expose to a future Client Portal" — a deliberate boundary drawn by
 * an earlier checkpoint. This checkpoint respects that line rather than
 * silently reversing it; see docs/client-portal-profile.md for the
 * disclosed gap this leaves against the spec's own Step 11 wording.
 *
 * "Communication Preferences"/"Notification Preferences" are the one
 * genuinely new piece: `client_portal_preferences`, a small
 * `ClientAccount`-keyed store (never the internal, member-keyed
 * `notificationPreferencesStore.ts`) that Step 12's Portal Settings reuses
 * for the same fields rather than building a second preferences model.
 */
export async function getClientPortalProfileAction(): Promise<GetClientPortalProfileResult> {
  const context = await getCurrentClientAccountContext();
  if (!context) return { success: false, error: GENERIC_ACCESS_ERROR };

  const client = await getClientById(context.account.client_id).catch(() => null);
  if (!client) return { success: false, error: GENERIC_ACCESS_ERROR };

  const portalPreferences = await getClientPortalPreferences(context.account.workspace_id, context.account.id);

  return {
    success: true,
    data: {
      personal: {
        firstName: client.first_name,
        lastName: client.last_name,
        email: client.email,
        phone: client.phone,
        instagram: client.instagram,
        partnerName: client.partner_name,
      },
      address: {
        address: client.address,
        city: client.city,
        state: client.state,
        zipCode: client.zip_code,
      },
      preferences: {
        favoriteColors: client.favorite_colors,
        favoriteFlowers: client.favorite_flowers,
        favoriteMusic: client.favorite_music,
        favoriteFood: client.favorite_food,
        favoriteDrinks: client.favorite_drinks,
        favoriteRestaurants: client.favorite_restaurants,
        preferredStyle: client.preferred_style,
        dislikedElements: client.disliked_elements,
      },
      communicationPreference: portalPreferences.communication_preference ?? client.preferred_contact_method,
      portalPreferences,
    },
  };
}

/**
 * Checkpoint 36, Step 11/12 — the one write path this profile needs:
 * updating the client's own portal-side preferences (communication
 * method override, notification toggles, theme, timezone). Never writes
 * to the real `Client` CRM record — that stays staff-owned, edited only
 * through the internal CRM UI.
 */
export async function updateClientPortalPreferencesAction(input: UpdateClientPortalPreferencesInput): Promise<DataResult<ClientPortalPreferences>> {
  const context = await getCurrentClientAccountContext();
  if (!context) return fail(GENERIC_ACCESS_ERROR);

  const updated = await updateClientPortalPreferences(context.account.workspace_id, context.account.id, input);
  return ok(updated);
}
