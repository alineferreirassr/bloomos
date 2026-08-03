import { getDataMode } from "@/lib/env";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { mapClientRow } from "@/lib/supabase/mappers";
import { readClients } from "@/lib/data/mock/clientsStore";
import { getFullName } from "@/lib/personName";
import type { Client } from "@/types/client";
import type { AIContextBuilder } from "@/core/ai/context/types";

export interface ClientContextData {
  name: string;
  relationshipStatus: string | null;
  favoriteColors: string | null;
  favoriteFlowers: string | null;
  favoriteMusic: string | null;
  favoriteFood: string | null;
  favoriteDrinks: string | null;
  favoriteRestaurants: string | null;
  preferredStyle: string | null;
  importantDates: { label: string; date: string }[];
}

/**
 * `@/lib/supabase/server` is imported dynamically, only inside this
 * `"supabase"`-mode branch — that file is marked `import "server-only"`,
 * which throws the instant it loads in a jsdom test environment (jsdom
 * defines `window`, the exact condition `server-only` checks for). A static
 * top-level import would break every test that transitively registers this
 * builder (via `registerDefaultAIContextBuilders`) without itself mocking
 * `@/lib/supabase/server` — a dynamic import here is never evaluated in
 * mock-mode tests (the default), so it never trips that guard.
 */
async function fetchClient(clientId: string): Promise<Client | null> {
  if (getDataMode() !== "supabase") {
    return readClients().find((candidate) => candidate.id === clientId) ?? null;
  }
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapClientRow(data) : null;
}

/**
 * The first real builder for the `client` section Checkpoint 2 reserved —
 * lives in `modules/ai` (not `core/ai/context/builders/`) because it
 * depends on `lib/data`/`lib/supabase`, the same "core never imports from
 * modules" rule `eventContextBuilder.ts` already follows. Deliberately
 * excludes every internal-only Client field (allergies, accessibility
 * needs, dietary restrictions, do-not-call, emergency contact, VIP flag —
 * see `Client`'s own "never expose to a future Client Portal" comment) —
 * a Proposal draft is headed toward eventually being client-facing, so
 * these stay out of the model's context entirely, not just out of the
 * rendered output.
 */
export const clientContextBuilder: AIContextBuilder = {
  key: "client",
  priority: 4,
  async build({ refs }) {
    if (!refs.clientId) return null;
    const client = await fetchClient(refs.clientId);
    if (!client) return null;

    const data: ClientContextData = {
      name: getFullName(client),
      relationshipStatus: client.relationship_status,
      favoriteColors: client.favorite_colors,
      favoriteFlowers: client.favorite_flowers,
      favoriteMusic: client.favorite_music,
      favoriteFood: client.favorite_food,
      favoriteDrinks: client.favorite_drinks,
      favoriteRestaurants: client.favorite_restaurants,
      preferredStyle: client.preferred_style,
      importantDates: client.important_dates.map((entry) => ({ label: entry.label, date: entry.date })),
    };
    return { data, source: "fetchClientById (safe fields only — excludes internal-only fields)" };
  },
};
