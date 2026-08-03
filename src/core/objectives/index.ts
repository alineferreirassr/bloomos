import { mockObjectivesRepository } from "@/lib/data/mock/objectivesStore";

export type { Objective, ObjectiveStatus, ObjectiveScope, ObjectiveRequirement, ObjectiveDependency } from "@/types/objectives";
export type { CreateObjectiveInput, ObjectivesRepository } from "@/lib/data/mock/objectivesStore";

/** Mock-only accessor — no Supabase table exists yet, same precedent as `core/comments`/`core/tags`/`core/knowledge`. */
export function getCoreObjectivesService() {
  return mockObjectivesRepository;
}
