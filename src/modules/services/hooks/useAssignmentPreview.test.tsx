import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("@/lib/queries/services", () => ({
  getAssignmentPreview: vi.fn(),
}));

import { useAssignmentPreview } from "@/modules/services/hooks/useAssignmentPreview";
import { getAssignmentPreview } from "@/lib/queries/services";
import { serviceKeys } from "@/modules/services/hooks/serviceKeys";
import { createWrapper } from "@/modules/services/hooks/testUtils";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAssignmentPreview (a genuinely dependent query)", () => {
  it("never fires until a Service has actually been selected", () => {
    renderHook(() => useAssignmentPreview(undefined, []), { wrapper: createWrapper() });
    expect(getAssignmentPreview).not.toHaveBeenCalled();
  });

  it("fires once a serviceId is provided, keyed by the sorted add-on selection", async () => {
    vi.mocked(getAssignmentPreview).mockResolvedValue({ computedPriceMinor: 105000 } as never);

    const { result } = renderHook(() => useAssignmentPreview("service_1", ["addon_2", "addon_1"]), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getAssignmentPreview).toHaveBeenCalledWith("service_1", ["addon_2", "addon_1"]);
  });

  it("refetches under a different key when the add-on selection changes, but the same key regardless of selection order", () => {
    expect(serviceKeys.assignmentPreview("service_1", ["a", "b"])).toEqual(serviceKeys.assignmentPreview("service_1", ["b", "a"]));
    expect(serviceKeys.assignmentPreview("service_1", ["a"])).not.toEqual(serviceKeys.assignmentPreview("service_1", ["a", "b"]));
  });
});
