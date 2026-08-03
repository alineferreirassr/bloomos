import { mockJourneyTransitionsRepository } from "@/lib/data/mock/journeyTransitionsStore";
import { mockJourneyOwnersRepository } from "@/lib/data/mock/journeyOwnersStore";
import { mockClientInformationRequestsRepository } from "@/lib/data/mock/clientInformationRequestsStore";

export type { JourneyTransitionsRepository } from "@/lib/data/mock/journeyTransitionsStore";
export type { JourneyOwnersRepository } from "@/lib/data/mock/journeyOwnersStore";
export type { ClientInformationRequestsRepository } from "@/lib/data/mock/clientInformationRequestsStore";

/** v2.0 Checkpoint 32 — Mock-only accessors, same precedent as every prior checkpoint's own `core/<domain>/index.ts`. No Supabase table exists yet for any of the three persisted entities. */
export function getCoreJourneyTransitionsService() {
  return mockJourneyTransitionsRepository;
}

export function getCoreJourneyOwnersService() {
  return mockJourneyOwnersRepository;
}

export function getCoreClientInformationRequestsService() {
  return mockClientInformationRequestsRepository;
}
