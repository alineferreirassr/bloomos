import type { Client } from "@/types/client";
import type { ClientFormInput } from "@/modules/clients/schema";

/** Converts a Client record's null fields into the plain-string shape the form works with. */
export function clientToFormInput(client: Client): ClientFormInput {
  return {
    first_name: client.first_name,
    last_name: client.last_name,
    email: client.email,
    phone: client.phone ?? "",
    instagram: client.instagram ?? "",
    partner_name: client.partner_name ?? "",
    relationship_status: client.relationship_status ?? "",
    address: client.address ?? "",
    city: client.city ?? "",
    state: client.state ?? "",
    zip_code: client.zip_code ?? "",
    source: client.source ?? "",
    important_dates: client.important_dates,

    how_they_met: client.how_they_met ?? "",
    first_date: client.first_date ?? "",
    relationship_anniversary: client.relationship_anniversary ?? "",
    engagement_date: client.engagement_date ?? "",
    wedding_date: client.wedding_date ?? "",
    favorite_colors: client.favorite_colors ?? "",
    favorite_flowers: client.favorite_flowers ?? "",
    favorite_music: client.favorite_music ?? "",
    favorite_food: client.favorite_food ?? "",
    favorite_drinks: client.favorite_drinks ?? "",
    preferred_style: client.preferred_style ?? "",
    disliked_elements: client.disliked_elements ?? "",

    allergies: client.allergies ?? "",
    accessibility_needs: client.accessibility_needs ?? "",
    dietary_restrictions: client.dietary_restrictions ?? "",
    preferred_communication_time: client.preferred_communication_time ?? "",
    do_not_call: client.do_not_call,
    surprise_event_confidentiality: client.surprise_event_confidentiality,
    emergency_contact_name: client.emergency_contact_name ?? "",
    emergency_contact_phone: client.emergency_contact_phone ?? "",
  };
}
