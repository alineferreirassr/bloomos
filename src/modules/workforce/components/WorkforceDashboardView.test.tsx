import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkforceDashboardView } from "@/modules/workforce/components/WorkforceDashboardView";
import type { EvaluateWorkforceResult } from "@/modules/workforce/workforceActions";
import type { Worker } from "@/types/workforce";

vi.mock("@/modules/workforce/workforceActions", () => ({
  evaluateWorkforceAction: vi.fn(),
  setWorkerStatusAction: vi.fn(),
}));

import { evaluateWorkforceAction } from "@/modules/workforce/workforceActions";

function makeWorker(overrides: Partial<Worker> = {}): Worker {
  return {
    id: "worker_1",
    workspace_id: "ws_1",
    first_name: "Ana",
    last_name: "Ferreira",
    email: "ana@example.com",
    phone: null,
    role: "technician",
    employment_type: "full_time",
    status: "active",
    current_activity: "idle",
    team_id: null,
    supervisor_worker_id: null,
    linked_member_id: null,
    time_zone: "America/Sao_Paulo",
    language: "en",
    languages: ["en"],
    experience_level: "entry",
    profile_photo_url: null,
    emergency_contact: null,
    skills: [],
    certifications: [],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}

function makeResult(overrides: Partial<EvaluateWorkforceResult> = {}): EvaluateWorkforceResult {
  const worker = makeWorker();
  return {
    workers: [worker],
    teams: [],
    assignments: [],
    equipment: [],
    vehicles: [],
    expiringCertifications: [],
    equipmentUtilization: { totalCount: 0, inUseCount: 0, availableCount: 0, maintenanceCount: 0, retiredCount: 0 },
    vehicleUtilization: { totalCount: 0, inUseCount: 0, availableCount: 0, maintenanceCount: 0, retiredCount: 0 },
    scorecard: { totalWorkers: 1, activeWorkers: 1, availableNow: 1, onAssignmentNow: 0, teamsCount: 0, activeAssignments: 0, expiringCertificationsCount: 0, equipmentInUse: 0, vehiclesInUse: 0, activeMobileSessions: 0, evaluatedAt: "2026-07-30T00:00:00.000Z" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(evaluateWorkforceAction).mockReset();
});

describe("WorkforceDashboardView", () => {
  it("renders the loading state before data resolves", () => {
    vi.mocked(evaluateWorkforceAction).mockReturnValue(new Promise(() => {}));
    render(<WorkforceDashboardView />);
    expect(screen.getByText(/Evaluating the workforce platform/i)).toBeInTheDocument();
  });

  it("renders an error state when the action fails", async () => {
    vi.mocked(evaluateWorkforceAction).mockResolvedValue({ success: false, error: "Access denied." });
    render(<WorkforceDashboardView />);
    expect(await screen.findByText("Access denied.")).toBeInTheDocument();
  });

  it("renders KPI cards and the active worker once data resolves", async () => {
    vi.mocked(evaluateWorkforceAction).mockResolvedValue({ success: true, data: makeResult() });
    render(<WorkforceDashboardView />);

    expect(await screen.findByText("Ana Ferreira")).toBeInTheDocument();
    expect(screen.getByText("Total Workers")).toBeInTheDocument();
    expect(screen.getByText("Available Now")).toBeInTheDocument();
  });

  it("shows a healthy empty state when no one is on leave", async () => {
    vi.mocked(evaluateWorkforceAction).mockResolvedValue({ success: true, data: makeResult() });
    render(<WorkforceDashboardView />);
    expect(await screen.findByText(/No one is currently on leave/i)).toBeInTheDocument();
  });
});
