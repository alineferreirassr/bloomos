import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/ai/fetchEventContext.server", () => ({ fetchEventContextRecord: vi.fn() }));
vi.mock("@/lib/data/mock/clientsStore", () => ({ readClients: vi.fn() }));
vi.mock("@/lib/data/mock/eventServicesStore", () => ({ readEventServices: vi.fn() }));
vi.mock("@/lib/data/mock/contractsStore", () => ({ readContracts: vi.fn() }));
vi.mock("@/lib/data/mock/notesTimelineShared", () => ({ getNotesByOwner: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { registerWorkflowNodes } from "@/modules/workflow/registerWorkflowNodes";
import { analyzeWorkflowGraph } from "@/core/workflow/graphAnalysis";
import { validateWorkflow } from "@/core/workflow/validation";
import { compileWorkflow } from "@/core/workflow/compiler";
import { proposalAcceptedContractTemplate } from "@/modules/workflow/templates/proposalAcceptedContractTemplate";
import { invoicePaidFinanceTemplate } from "@/modules/workflow/templates/invoicePaidFinanceTemplate";
import { newClientWelcomeTemplate } from "@/modules/workflow/templates/newClientWelcomeTemplate";

// `registerWorkflowNodes()` is idempotent against the real, shared registry — called once here, never reset per test, matching `compiler.test.ts`'s own established precedent.
registerWorkflowNodes();

describe("built-in Workflow Templates sanity check", () => {
  for (const template of [proposalAcceptedContractTemplate, invoicePaidFinanceTemplate, newClientWelcomeTemplate]) {
    it(`${template.id} has zero structural issues`, () => {
      const analysis = analyzeWorkflowGraph(template.graph);
      expect(analysis.issues).toEqual([]);
    });

    it(`${template.id} validates cleanly`, () => {
      const result = validateWorkflow(template.graph);
      expect(result.valid).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it(`${template.id} compiles to at least one Automation`, () => {
      const result = compileWorkflow({ workflowId: "wf_test", version: 1, graph: template.graph, metadata: { name: template.name, description: template.description, category: template.category, tags: [] }, executionPolicy: { requiredPermissions: [], minimumRole: null, featureFlag: null, maxRetries: 0, scheduledExecution: null } });
      expect(result.success).toBe(true);
      if (result.success) expect(result.automations.length).toBeGreaterThan(0);
    });
  }
});
