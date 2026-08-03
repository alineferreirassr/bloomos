import { mockOperationalPlansRepository } from "@/lib/data/mock/operationalPlansStore";
import { mockPlanTemplatesRepository } from "@/lib/data/mock/planTemplatesStore";
import { mockChecklistTemplatesRepository } from "@/lib/data/mock/checklistTemplatesStore";

export type { OperationalPlan, PlanStatus, PlanContextType } from "@/types/operationalPlanning";
export type { PlanTemplate, TemplateCategory, TemplateStatus } from "@/types/operationalPlanning";
export type { ChecklistTemplate, ChecklistKind } from "@/types/operationalPlanning";
export type { ExecutionPhase, ExecutionPhaseKind, ExecutionStep, ExecutionStepStatus, StepDependency, DependencyType, DependencyClass } from "@/types/operationalPlanning";
export type { Milestone, MilestoneStatus } from "@/types/operationalPlanning";
export type { Deliverable, DeliverableType, DeliverableStatus } from "@/types/operationalPlanning";
export type { EvidenceRequirement, EvidenceType } from "@/types/operationalPlanning";
export type { PlanChecklist, ChecklistItemDefinition } from "@/types/operationalPlanning";
export type { ApprovalRequirement, ApprovalType, ApprovalStatus } from "@/types/operationalPlanning";

export type { CreateOperationalPlanInput, UpdateOperationalPlanInput, OperationalPlansRepository } from "@/lib/data/mock/operationalPlansStore";
export type { CreatePlanTemplateInput, UpdatePlanTemplateInput, PlanTemplatesRepository } from "@/lib/data/mock/planTemplatesStore";
export type { CreateChecklistTemplateInput, ChecklistTemplatesRepository } from "@/lib/data/mock/checklistTemplatesStore";

/** v2.0 Checkpoint 27.2 — Mock-only accessors, one per store, same precedent as `core/allocation`/`core/scheduling`. No Supabase table exists yet for any Operational Planning concept. */
export function getCoreOperationalPlansService() {
  return mockOperationalPlansRepository;
}

export function getCorePlanTemplatesService() {
  return mockPlanTemplatesRepository;
}

export function getCoreChecklistTemplatesService() {
  return mockChecklistTemplatesRepository;
}
