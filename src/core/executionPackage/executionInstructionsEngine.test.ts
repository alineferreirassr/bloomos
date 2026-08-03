import { describe, expect, it } from "vitest";
import { buildExecutionInstructions, type InstructionsInput } from "@/core/executionPackage/executionInstructionsEngine";
import type { ExecutionPhase } from "@/types/operationalPlanning";

function baseInput(overrides: Partial<InstructionsInput> = {}): InstructionsInput {
  return { phases: [], checklists: [], specialInstructions: [], customerNotes: [], ...overrides };
}

describe("buildExecutionInstructions", () => {
  it("maps each named phase kind into its instruction section", () => {
    const phases: ExecutionPhase[] = [
      { id: "phase_1", kind: "preparation", name: "Preparation", order: 1, steps: [{ id: "step_1", title: "Load van", description: null, instructions: "Load all equipment into the van.", estimated_duration_minutes: 30, dependencies: [], assigned_resource_type: null, required_capability_requirement_id: null, priority: "medium", status: "pending", notes: null }] },
      { id: "phase_2", kind: "cleanup", name: "Cleanup", order: 2, steps: [{ id: "step_2", title: "Pack up", description: null, instructions: "Break down and pack the setup.", estimated_duration_minutes: 20, dependencies: [], assigned_resource_type: null, required_capability_requirement_id: null, priority: "medium", status: "pending", notes: null }] },
    ];
    const instructions = buildExecutionInstructions(baseInput({ phases }));
    expect(instructions.sections).toEqual([
      { section: "preparation", text: "Load all equipment into the van." },
      { section: "cleanup", text: "Break down and pack the setup." },
    ]);
  });

  it("skips a step with no instructions text", () => {
    const phases: ExecutionPhase[] = [{ id: "phase_1", kind: "execution", name: "Execution", order: 1, steps: [{ id: "step_1", title: "Setup", description: null, instructions: null, estimated_duration_minutes: 10, dependencies: [], assigned_resource_type: null, required_capability_requirement_id: null, priority: "medium", status: "pending", notes: null }] }];
    const instructions = buildExecutionInstructions(baseInput({ phases }));
    expect(instructions.sections).toHaveLength(0);
  });

  it("derives safety_notes from safety-kind checklist item labels", () => {
    const instructions = buildExecutionInstructions(baseInput({ checklists: [{ id: "checklist_1", template_id: null, name: "Safety", kind: "safety", items: [{ id: "item_1", label: "Wear a hard hat", completed: false }] }, { id: "checklist_2", template_id: null, name: "Task", kind: "task", items: [{ id: "item_2", label: "Confirm delivery", completed: false }] }] }));
    expect(instructions.safety_notes).toEqual(["Wear a hard hat"]);
  });

  it("derives equipment_notes/vehicle_notes from step notes by assigned resource type", () => {
    const phases: ExecutionPhase[] = [
      {
        id: "phase_1",
        kind: "setup",
        name: "Setup",
        order: 1,
        steps: [
          { id: "step_1", title: "Position drone", description: null, instructions: null, estimated_duration_minutes: 10, dependencies: [], assigned_resource_type: "equipment", required_capability_requirement_id: null, priority: "medium", status: "pending", notes: "Check battery charge." },
          { id: "step_2", title: "Park van", description: null, instructions: null, estimated_duration_minutes: 5, dependencies: [], assigned_resource_type: "vehicle", required_capability_requirement_id: null, priority: "medium", status: "pending", notes: "Reverse into the loading bay." },
        ],
      },
    ];
    const instructions = buildExecutionInstructions(baseInput({ phases }));
    expect(instructions.equipment_notes).toEqual(["Check battery charge."]);
    expect(instructions.vehicle_notes).toEqual(["Reverse into the loading bay."]);
  });

  it("carries customerNotes/specialInstructions through unchanged, never fabricating them", () => {
    const instructions = buildExecutionInstructions(baseInput({ customerNotes: ["Client prefers a side entrance."], specialInstructions: ["Gate code is 4471."] }));
    expect(instructions.customer_notes).toEqual(["Client prefers a side entrance."]);
    expect(instructions.special_instructions).toEqual(["Gate code is 4471."]);
  });
});
