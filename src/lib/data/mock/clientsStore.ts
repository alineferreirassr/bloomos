import type { Client } from "@/types/client";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

const SEED_CLIENTS: Client[] = [
  {
    id: "client_1",
    workspace_id: CURRENT_WORKSPACE_ID,
    originating_lead_id: null,
    first_name: "Naomi",
    last_name: "Whitfield",
    email: "naomi.whitfield@example.com",
    phone: "+1 212 555 0134",
    instagram: "@naomi.whitfield",
    preferred_contact_method: "whatsapp",
    partner_name: "James Whitfield",
    relationship_status: "Married",
    important_dates: [{ id: "date_1", label: "First anniversary dinner", date: "2026-09-14" }],
    address: "24 Riverside Drive",
    city: "New York",
    state: "NY",
    zip_code: "10023",
    source: "Referral",
    tags: ["repeat-client", "high-touch"],
    internal_status: "active",
    is_returning: true,

    how_they_met: "College sweethearts, met at a mutual friend's birthday party.",
    first_date: "2015-03-02",
    relationship_anniversary: "2022-06-18",
    engagement_date: "2021-12-24",
    wedding_date: "2022-06-18",
    favorite_colors: "Ivory, sage green",
    favorite_flowers: "Peonies, garden roses",
    favorite_music: "Live jazz trio",
    favorite_food: "Modern Italian",
    favorite_drinks: "Champagne, Aperol spritz",
    preferred_style: "Timeless, garden-inspired",
    disliked_elements: "No confetti cannons, no loud DJ sets",

    allergies: "Tree nuts",
    accessibility_needs: null,
    dietary_restrictions: "Pescatarian",
    preferred_communication_time: "Weekday evenings after 6pm",
    do_not_call: false,
    surprise_event_confidentiality: true,
    emergency_contact_name: "Priya Sharma",
    emergency_contact_phone: "+1 212 555 0199",
    is_vip: true,

    created_at: "2022-01-10T09:00:00.000Z",
    updated_at: "2026-06-01T10:00:00.000Z",
    archived_at: null,
  },
];

let clients: Client[] = SEED_CLIENTS.map((client) => ({ ...client }));

export function readClients(): Client[] {
  return clients;
}

export function writeClients(next: Client[]): void {
  clients = next;
}

/** Test-only: restore the store to its seeded state between test cases. */
export function resetClientsStore(): void {
  clients = SEED_CLIENTS.map((client) => ({ ...client }));
}
