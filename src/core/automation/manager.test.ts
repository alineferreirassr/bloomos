import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data/core/automation/mockRepository", () => ({
  mockAutomationRepository: { recordExecution: vi.fn().mockResolvedValue({ success: true, data: { id: "mock_exec", actionResults: [] } }) },
}));
vi.mock("@/lib/data/core/automation/supabaseRepository", () => ({
  supabaseAutomationRepository: { recordExecution: vi.fn().mockResolvedValue({ success: true, data: { id: "supabase_exec", actionResults: [] } }) },
}));

import { getAutomationManager } from "@/core/automation/manager";
import { mockAutomationRepository } from "@/lib/data/core/automation/mockRepository";
import { supabaseAutomationRepository } from "@/lib/data/core/automation/supabaseRepository";

const ORIGINAL_DATA_MODE = process.env.NEXT_PUBLIC_DATA_MODE;

afterEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_DATA_MODE = ORIGINAL_DATA_MODE;
});

describe("getAutomationManager — knowledge store selection", () => {
  it("routes to the mock repository when NEXT_PUBLIC_DATA_MODE is mock (the default)", async () => {
    process.env.NEXT_PUBLIC_DATA_MODE = "mock";
    const result = await getAutomationManager().recordExecution("ws_1", {} as never);
    expect(result.success && result.data.id).toBe("mock_exec");
    expect(mockAutomationRepository.recordExecution).toHaveBeenCalled();
    expect(supabaseAutomationRepository.recordExecution).not.toHaveBeenCalled();
  });

  it("routes to the Supabase repository when NEXT_PUBLIC_DATA_MODE is supabase — SOCIAL-11B's own new wiring", async () => {
    process.env.NEXT_PUBLIC_DATA_MODE = "supabase";
    const result = await getAutomationManager().recordExecution("ws_1", {} as never);
    expect(result.success && result.data.id).toBe("supabase_exec");
    expect(supabaseAutomationRepository.recordExecution).toHaveBeenCalled();
    expect(mockAutomationRepository.recordExecution).not.toHaveBeenCalled();
  });
});
