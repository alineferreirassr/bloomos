import type { CapabilityRequirement, CapabilityContextType, CapabilityCustomRule, CapabilityLocationRequirement } from "@/types/capability";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { AvailabilityStatus, EmploymentType, ExperienceLevel } from "@/types/workforce";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 26.1, Step 15 — Capability Requirement Registry
 * persistence. Same `let` array + `resetXStore()` convention every mock
 * store in this codebase uses. Mock-only — no Supabase table exists yet,
 * same precedent as `core/objectives`/`core/executiveDecisions`/`core/workforce`.
 */
let requirements: CapabilityRequirement[] = [];

export function resetCapabilityRequirementsStore(): void {
  requirements = [];
}

export interface CreateCapabilityRequirementInput {
  title: string;
  description: string | null;
  context_type: CapabilityContextType;
  context: KnowledgeNodeRef | null;
  required_skills: string[];
  preferred_skills: string[];
  required_certifications: string[];
  preferred_certifications: string[];
  required_languages: string[];
  preferred_languages: string[];
  minimum_experience_level: ExperienceLevel | null;
  required_equipment_types: string[];
  preferred_equipment_types: string[];
  required_vehicle_types: string[];
  preferred_vehicle_types: string[];
  required_availability_statuses: AvailabilityStatus[];
  required_employment_types: EmploymentType[];
  required_team_id: string | null;
  preferred_team_id: string | null;
  preferred_experience_level: ExperienceLevel | null;
  excluded_worker_ids: string[];
  excluded_team_ids: string[];
  required_time_zone: string | null;
  maximum_distance_km: number | null;
  location_requirement: CapabilityLocationRequirement | null;
  capacity_requirement: number | null;
  physical_requirements: string[];
  custom_rules: CapabilityCustomRule[];
  required_valid_through_date: string | null;
}

export type UpdateCapabilityRequirementInput = Partial<Omit<CreateCapabilityRequirementInput, "context_type">>;

export interface CapabilityRequirementFilters {
  includeArchived?: boolean;
  contextType?: CapabilityContextType;
  requiredSkill?: string;
  requiredCertification?: string;
  teamId?: string;
}

async function listRequirementsForWorkspace(workspaceId: string, filters: CapabilityRequirementFilters = {}): Promise<CapabilityRequirement[]> {
  return requirements.filter((r) => {
    if (r.workspace_id !== workspaceId) return false;
    if (!filters.includeArchived && r.archived_at !== null) return false;
    if (filters.contextType && r.context_type !== filters.contextType) return false;
    if (filters.requiredSkill && !r.required_skills.includes(filters.requiredSkill)) return false;
    if (filters.requiredCertification && !r.required_certifications.includes(filters.requiredCertification)) return false;
    if (filters.teamId && r.required_team_id !== filters.teamId) return false;
    return true;
  });
}

async function getRequirementById(id: string): Promise<CapabilityRequirement | null> {
  return requirements.find((r) => r.id === id) ?? null;
}

async function createRequirement(workspaceId: string, createdBy: string, input: CreateCapabilityRequirementInput): Promise<DataResult<CapabilityRequirement>> {
  if (!input.title.trim()) return fail("Please fix the highlighted fields.", { title: "Title is required." });

  const timestamp = nowIso();
  const requirement: CapabilityRequirement = {
    id: generateId("capability_requirement"),
    workspace_id: workspaceId,
    title: input.title.trim(),
    description: input.description,
    context_type: input.context_type,
    context: input.context,
    required_skills: input.required_skills,
    preferred_skills: input.preferred_skills,
    required_certifications: input.required_certifications,
    preferred_certifications: input.preferred_certifications,
    required_languages: input.required_languages,
    preferred_languages: input.preferred_languages,
    minimum_experience_level: input.minimum_experience_level,
    required_equipment_types: input.required_equipment_types,
    preferred_equipment_types: input.preferred_equipment_types,
    required_vehicle_types: input.required_vehicle_types,
    preferred_vehicle_types: input.preferred_vehicle_types,
    required_availability_statuses: input.required_availability_statuses,
    required_employment_types: input.required_employment_types,
    required_team_id: input.required_team_id,
    preferred_team_id: input.preferred_team_id,
    preferred_experience_level: input.preferred_experience_level,
    excluded_worker_ids: input.excluded_worker_ids,
    excluded_team_ids: input.excluded_team_ids,
    required_time_zone: input.required_time_zone,
    maximum_distance_km: input.maximum_distance_km,
    location_requirement: input.location_requirement,
    capacity_requirement: input.capacity_requirement,
    physical_requirements: input.physical_requirements,
    custom_rules: input.custom_rules,
    required_valid_through_date: input.required_valid_through_date,
    created_by: createdBy,
    created_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
  };
  requirements = [...requirements, requirement];
  return ok(requirement);
}

async function updateRequirement(id: string, workspaceId: string, input: UpdateCapabilityRequirementInput): Promise<DataResult<CapabilityRequirement>> {
  const existing = requirements.find((r) => r.id === id && r.workspace_id === workspaceId);
  if (!existing) return fail("This capability requirement could not be found.");
  if (input.title !== undefined && !input.title.trim()) return fail("Please fix the highlighted fields.", { title: "Title is required." });

  const updated: CapabilityRequirement = { ...existing, ...input, title: input.title?.trim() ?? existing.title, updated_at: nowIso() };
  requirements = requirements.map((r) => (r.id === id ? updated : r));
  return ok(updated);
}

async function archiveRequirement(id: string, workspaceId: string): Promise<DataResult<CapabilityRequirement>> {
  const existing = requirements.find((r) => r.id === id && r.workspace_id === workspaceId);
  if (!existing) return fail("This capability requirement could not be found.");

  const timestamp = nowIso();
  const updated: CapabilityRequirement = { ...existing, archived_at: timestamp, updated_at: timestamp };
  requirements = requirements.map((r) => (r.id === id ? updated : r));
  return ok(updated);
}

async function duplicateRequirement(id: string, workspaceId: string, createdBy: string): Promise<DataResult<CapabilityRequirement>> {
  const existing = requirements.find((r) => r.id === id && r.workspace_id === workspaceId);
  if (!existing) return fail("This capability requirement could not be found.");

  const timestamp = nowIso();
  const duplicate: CapabilityRequirement = {
    ...existing,
    id: generateId("capability_requirement"),
    title: `${existing.title} (Copy)`,
    created_by: createdBy,
    created_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
  };
  requirements = [...requirements, duplicate];
  return ok(duplicate);
}

export interface CapabilityRequirementsRepository {
  listRequirementsForWorkspace: typeof listRequirementsForWorkspace;
  getRequirementById: typeof getRequirementById;
  createRequirement: typeof createRequirement;
  updateRequirement: typeof updateRequirement;
  archiveRequirement: typeof archiveRequirement;
  duplicateRequirement: typeof duplicateRequirement;
}

export const mockCapabilityRequirementsRepository: CapabilityRequirementsRepository = {
  listRequirementsForWorkspace,
  getRequirementById,
  createRequirement,
  updateRequirement,
  archiveRequirement,
  duplicateRequirement,
};
