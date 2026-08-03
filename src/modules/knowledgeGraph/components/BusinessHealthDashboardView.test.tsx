import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BusinessHealthDashboardView } from "@/modules/knowledgeGraph/components/BusinessHealthDashboardView";
import type { BusinessHealthEvaluation } from "@/modules/knowledgeGraph/businessHealthActions";

vi.mock("@/modules/knowledgeGraph/businessHealthActions", () => ({
  evaluateBusinessHealthAction: vi.fn(),
}));

// `BusinessHealthDashboardView` renders `ObjectivesSection` (Step 15.6), which calls this real "use server" action — mocked here purely to keep this test isolated to Business Health's own rendering; `ObjectivesSection`'s own behavior has its own dedicated test file.
vi.mock("@/modules/objectives/objectivesActions", () => ({
  evaluateObjectivesAction: vi.fn(),
}));

import { evaluateBusinessHealthAction } from "@/modules/knowledgeGraph/businessHealthActions";
import { evaluateObjectivesAction } from "@/modules/objectives/objectivesActions";

function makeEvaluation(overrides: Partial<BusinessHealthEvaluation> = {}): BusinessHealthEvaluation {
  return {
    businessHealth: {
      categories: [
        { category: "relationship_health", score: 90, issues: [], notApplicableReason: null },
        { category: "asset_health", score: 80, issues: ["Orphaned asset found"], notApplicableReason: null },
        { category: "documentation_health", score: null, issues: [], notApplicableReason: "No documents recorded yet." },
        { category: "proposal_completeness", score: null, issues: [], notApplicableReason: "No proposals to evaluate yet." },
        { category: "client_completeness", score: null, issues: [], notApplicableReason: "No clients to evaluate yet." },
        { category: "event_readiness", score: null, issues: [], notApplicableReason: "No events to evaluate yet." },
        { category: "vendor_readiness", score: null, issues: [], notApplicableReason: "No vendors to evaluate yet." },
        { category: "workflow_readiness", score: null, issues: [], notApplicableReason: "No constraint rules or completeness evaluator are defined yet for the \"workflow\" node type." },
        { category: "communication_health", score: null, issues: [], notApplicableReason: "Communication Platform (Checkpoint 24) data is not wired into the Knowledge Graph this checkpoint." },
        { category: "knowledge_health", score: null, issues: [], notApplicableReason: "No nodes evaluated for constraint compliance yet." },
        { category: "dependency_health", score: 100, issues: [], notApplicableReason: null },
      ],
      overallScore: 90,
      evaluatedAt: "2026-07-30T00:00:00.000Z",
    },
    proposalReadiness: [],
    eventReadiness: [],
    clientReadiness: [],
    vendorReadiness: [
      {
        node: { nodeType: "vendor", nodeId: "vendor_1" },
        overallScore: 50,
        missingRequirements: ["Missing Contact Information"],
        warnings: [],
        blockingIssues: ["Vendor Is Inactive"],
        suggestedNextSteps: [{ ruleId: "vendor_completeness.status", message: "Reactivate or archive this Vendor.", severity: "warning", node: { nodeType: "vendor", nodeId: "vendor_1" } }],
        lastEvaluatedAt: "2026-07-30T00:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

describe("BusinessHealthDashboardView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(evaluateObjectivesAction).mockResolvedValue({
      success: true,
      data: { evaluations: [], scorecard: { objectivesCompleted: 0, objectivesBlocked: 0, objectivesOverdue: 0, averageCompletion: 100, operationalProgress: 100, businessReadiness: 0, overallOperationalScore: 100, evaluatedAt: "2026-07-30T00:00:00.000Z" } },
    });
  });

  it("renders the overall score and every health category once evaluation succeeds", async () => {
    vi.mocked(evaluateBusinessHealthAction).mockResolvedValue({ success: true, data: makeEvaluation() });

    render(<BusinessHealthDashboardView />);

    expect((await screen.findAllByText("90")).length).toBeGreaterThan(0);
    expect(screen.getByText("Relationship Health")).toBeInTheDocument();
    expect(screen.getByText("No documents recorded yet.")).toBeInTheDocument();
    expect(screen.getByText("Orphaned asset found")).toBeInTheDocument();
  });

  it("renders the vendor readiness table with its blocking issue and suggested next step", async () => {
    vi.mocked(evaluateBusinessHealthAction).mockResolvedValue({ success: true, data: makeEvaluation() });

    render(<BusinessHealthDashboardView />);

    expect((await screen.findAllByText(/Vendor Readiness/)).length).toBeGreaterThan(0);
    expect(screen.getByText("(1)")).toBeInTheDocument();
    expect(screen.getByText("Vendor Is Inactive")).toBeInTheDocument();
    expect(screen.getByText("Reactivate or archive this Vendor.")).toBeInTheDocument();
  });

  it("shows an error state when the evaluation fails", async () => {
    vi.mocked(evaluateBusinessHealthAction).mockResolvedValue({ success: false, error: "Business Health isn't available. You may not have access to it." });

    render(<BusinessHealthDashboardView />);

    expect(await screen.findByText("Business Health isn't available. You may not have access to it.")).toBeInTheDocument();
  });

  it("re-runs the evaluation when Re-evaluate is clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(evaluateBusinessHealthAction).mockResolvedValue({ success: true, data: makeEvaluation() });

    render(<BusinessHealthDashboardView />);
    await screen.findAllByText("90");
    expect(evaluateBusinessHealthAction).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /re-evaluate/i }));
    expect(evaluateBusinessHealthAction).toHaveBeenCalledTimes(2);
  });
});
