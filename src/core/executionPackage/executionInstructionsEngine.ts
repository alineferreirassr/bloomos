import type { ExecutionPhase, ExecutionPhaseKind, PlanChecklist } from "@/types/operationalPlanning";
import type { ExecutionInstructions, ExecutionInstructionLine, ExecutionInstructionSection } from "@/types/executionPackage";
import { resolvePhaseOrder } from "@/core/operationalPlanning/phaseEngine";
import { flattenSteps } from "@/core/operationalPlanning/executionStepEngine";

/**
 * v2.0 Checkpoint 27.3, Step 7 — Execution Instructions Engine.
 * Deterministic: every line traces back to a real, already-declared
 * field — a step's own `instructions`, a safety checklist's own item
 * labels, a step's own `notes` when it's assigned an equipment/vehicle
 * resource type. Nothing here is generated or inferred; `customerNotes`/
 * `specialInstructions` are supplied by the caller from real sources
 * (e.g. `AllocationRequest.special_instructions`) rather than fabricated
 * inside this pure engine.
 *
 * The spec's 9 named phases fold into the 5 named instruction sections:
 * `preparation`/`travel` → `preparation`; `arrival`/`setup` → `arrival`;
 * `execution`/`custom` → `execution`; `cleanup` → `cleanup`;
 * `quality_review`/`completion` → `completion`. A disclosed, deterministic
 * simplification — see `docs/package-builder.md`.
 */
const SECTION_BY_PHASE_KIND: Record<ExecutionPhaseKind, ExecutionInstructionSection> = {
  preparation: "preparation",
  travel: "preparation",
  arrival: "arrival",
  setup: "arrival",
  execution: "execution",
  quality_review: "completion",
  cleanup: "cleanup",
  completion: "completion",
  custom: "execution",
};

export interface InstructionsInput {
  phases: ExecutionPhase[];
  checklists: PlanChecklist[];
  specialInstructions: string[];
  customerNotes: string[];
}

export function buildExecutionInstructions(input: InstructionsInput): ExecutionInstructions {
  const sections: ExecutionInstructionLine[] = [];
  for (const phase of resolvePhaseOrder(input.phases)) {
    const section = SECTION_BY_PHASE_KIND[phase.kind];
    for (const step of phase.steps) {
      if (step.instructions) sections.push({ section, text: step.instructions });
    }
  }

  const safety_notes = input.checklists.filter((c) => c.kind === "safety").flatMap((c) => c.items.map((i) => i.label));
  const steps = flattenSteps(input.phases);
  const equipment_notes = steps.filter((s) => s.assigned_resource_type === "equipment" && s.notes !== null).map((s) => s.notes as string);
  const vehicle_notes = steps.filter((s) => s.assigned_resource_type === "vehicle" && s.notes !== null).map((s) => s.notes as string);

  return { sections, safety_notes, customer_notes: input.customerNotes, equipment_notes, vehicle_notes, special_instructions: input.specialInstructions };
}
