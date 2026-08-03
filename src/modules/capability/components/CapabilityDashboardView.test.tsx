import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CapabilityDashboardView } from "@/modules/capability/components/CapabilityDashboardView";
import type { EvaluateWorkforceCapabilityCoverageResult } from "@/modules/capability/capabilityActions";
import type { CapabilityRequirement } from "@/types/capability";

vi.mock("@/modules/capability/capabilityActions", () => ({
  listCapabilityRequirementsAction: vi.fn(),
  evaluateWorkforceCapabilityCoverageAction: vi.fn(),
}));

import { listCapabilityRequirementsAction, evaluateWorkforceCapabilityCoverageAction } from "@/modules/capability/capabilityActions";

const NOW = "2026-07-30T00:00:00.000Z";

function makeRequirement(overrides: Partial<CapabilityRequirement> = {}): CapabilityRequirement {
  return {
    id: "req_1",
    workspace_id: "ws_1",
    title: "Lead Rigger",
    description: null,
    context_type: "event",
    context: { nodeType: "event", nodeId: "event_1" },
    required_skills: [],
    preferred_skills: [],
    required_certifications: [],
    preferred_certifications: [],
    required_languages: [],
    preferred_languages: [],
    minimum_experience_level: null,
    required_equipment_types: [],
    preferred_equipment_types: [],
    required_vehicle_types: [],
    preferred_vehicle_types: [],
    required_availability_statuses: [],
    required_employment_types: [],
    required_team_id: null,
    preferred_team_id: null,
    preferred_experience_level: null,
    excluded_worker_ids: [],
    excluded_team_ids: [],
    required_time_zone: null,
    maximum_distance_km: null,
    location_requirement: null,
    capacity_requirement: null,
    physical_requirements: [],
    custom_rules: [],
    required_valid_through_date: null,
    created_by: "member_1",
    created_at: NOW,
    updated_at: NOW,
    archived_at: null,
    ...overrides,
  };
}

function makeCoverageResult(overrides: Partial<EvaluateWorkforceCapabilityCoverageResult> = {}): EvaluateWorkforceCapabilityCoverageResult {
  return {
    coverage: {
      workspace_id: "ws_1",
      skillsCoverage: {},
      certificationCoverage: {},
      languageCoverage: {},
      equipmentCoverage: {},
      vehicleCoverage: {},
      availableWorkersCount: 3,
      activeTeamsCount: 1,
      requirementCoverage: [],
      uncoveredRequirementIds: [],
      singleWorkerDependencies: [],
      singleEquipmentDependencies: [],
      singleVehicleDependencies: [],
      highRiskGapsCount: 0,
      evaluatedAt: NOW,
    },
    risks: [],
    evaluationResults: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(listCapabilityRequirementsAction).mockReset();
  vi.mocked(evaluateWorkforceCapabilityCoverageAction).mockReset();
});

describe("CapabilityDashboardView", () => {
  it("renders KPI cards and the requirement list once data resolves", async () => {
    vi.mocked(listCapabilityRequirementsAction).mockResolvedValue({ success: true, data: [makeRequirement()] });
    vi.mocked(evaluateWorkforceCapabilityCoverageAction).mockResolvedValue({ success: true, data: makeCoverageResult() });

    render(<CapabilityDashboardView />);

    expect(await screen.findByText("Lead Rigger")).toBeInTheDocument();
    expect(screen.getByText("Available Workers")).toBeInTheDocument();
    expect(screen.getByText("No high-severity workforce risks detected.")).toBeInTheDocument();
  });

  it("renders an error state when the coverage action fails", async () => {
    vi.mocked(listCapabilityRequirementsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(evaluateWorkforceCapabilityCoverageAction).mockResolvedValue({ success: false, error: "Access denied." });

    render(<CapabilityDashboardView />);
    expect(await screen.findByText("Access denied.")).toBeInTheDocument();
  });

  it("surfaces a high-severity risk in its own section", async () => {
    vi.mocked(listCapabilityRequirementsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(evaluateWorkforceCapabilityCoverageAction).mockResolvedValue({
      success: true,
      data: makeCoverageResult({ risks: [{ id: "risk_1", type: "no_eligible_worker", severity: "high", description: "No eligible worker for Lead Rigger.", relatedRequirementId: "req_1", relatedWorkerId: null, relatedEquipmentId: null, relatedVehicleId: null }] }),
    });

    render(<CapabilityDashboardView />);
    expect(await screen.findByText("No eligible worker for Lead Rigger.")).toBeInTheDocument();
  });
});
