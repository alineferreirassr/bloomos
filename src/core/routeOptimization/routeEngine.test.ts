import { describe, expect, it } from "vitest";
import { evaluateRouteEligibility, buildRouteStructure } from "@/core/routeOptimization/routeEngine";
import type { ExecutionPhase, ExecutionStep } from "@/types/operationalPlanning";

function makeStep(overrides: Partial<ExecutionStep> = {}): ExecutionStep {
  return { id: "step_1", title: "Step", description: null, instructions: null, estimated_duration_minutes: 30, dependencies: [], assigned_resource_type: null, required_capability_requirement_id: null, priority: "medium", status: "pending", notes: null, ...overrides };
}

function makePhase(overrides: Partial<ExecutionPhase> = {}): ExecutionPhase {
  return { id: "phase_1", kind: "setup", name: "Setup", order: 0, steps: [makeStep()], ...overrides };
}

describe("routeEngine", () => {
  describe("evaluateRouteEligibility", () => {
    it("allows building when the assignment is accepted and the package is approved", () => {
      expect(evaluateRouteEligibility({ assignmentQueueState: "accepted", packageStatus: "approved" })).toEqual({ canBuild: true, reason: null });
    });

    it("rejects when the assignment has not been accepted", () => {
      const result = evaluateRouteEligibility({ assignmentQueueState: "pending", packageStatus: "approved" });
      expect(result.canBuild).toBe(false);
      expect(result.reason).toContain("not been accepted");
    });

    it("rejects when the package is not approved", () => {
      const result = evaluateRouteEligibility({ assignmentQueueState: "accepted", packageStatus: "draft" });
      expect(result.canBuild).toBe(false);
      expect(result.reason).toContain("not been approved");
    });
  });

  describe("buildRouteStructure", () => {
    it("builds an origin + one phase_stop per phase + destination, ordered by phase.order", () => {
      const phases = [makePhase({ id: "phase_2", name: "Cleanup", order: 1 }), makePhase({ id: "phase_1", name: "Setup", order: 0 })];
      const structure = buildRouteStructure("route_plan_1", phases);

      expect(structure.waypoints).toHaveLength(4);
      expect(structure.waypoints[0].kind).toBe("origin");
      expect(structure.waypoints[1].kind).toBe("phase_stop");
      expect(structure.waypoints[1].label).toBe("Setup");
      expect(structure.waypoints[2].label).toBe("Cleanup");
      expect(structure.waypoints[3].kind).toBe("destination");
    });

    it("builds one travel leg and one segment per consecutive waypoint pair, with declared travel figures defaulting to 0", () => {
      const structure = buildRouteStructure("route_plan_1", [makePhase()]);
      expect(structure.travelLegs).toHaveLength(2);
      expect(structure.segments).toHaveLength(2);
      expect(structure.travelLegs[0].declared_distance_km).toBe(0);
      expect(structure.travelLegs[0].declared_travel_minutes).toBe(0);
    });

    it("sums the destination waypoint's own phase steps into the segment's work_duration_minutes", () => {
      const phase = makePhase({ steps: [makeStep({ id: "s1", estimated_duration_minutes: 20 }), makeStep({ id: "s2", estimated_duration_minutes: 25 })] });
      const structure = buildRouteStructure("route_plan_1", [phase]);
      const phaseSegment = structure.segments.find((s) => s.to_waypoint_id === structure.waypoints[1].id);
      expect(phaseSegment?.work_duration_minutes).toBe(45);
    });

    it("gives the synthetic origin/destination bookends zero work duration", () => {
      const structure = buildRouteStructure("route_plan_1", [makePhase()]);
      const toDestination = structure.segments.find((s) => s.to_waypoint_id === structure.waypoints[2].id);
      expect(toDestination?.work_duration_minutes).toBe(0);
    });

    it("handles zero phases — just an origin and destination, one leg between them", () => {
      const structure = buildRouteStructure("route_plan_1", []);
      expect(structure.waypoints).toHaveLength(2);
      expect(structure.waypoints[0].kind).toBe("origin");
      expect(structure.waypoints[1].kind).toBe("destination");
      expect(structure.travelLegs).toHaveLength(1);
      expect(structure.segments).toHaveLength(1);
    });
  });
});
