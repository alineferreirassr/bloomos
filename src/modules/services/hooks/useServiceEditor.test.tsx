import { describe, expect, it, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";
import { renderHook } from "@testing-library/react";

vi.mock("@/lib/queries/services", () => ({
  getServiceEditor: vi.fn(),
}));

import { useServiceEditor } from "@/modules/services/hooks/useServiceEditor";
import { getServiceEditor } from "@/lib/queries/services";
import { serviceKeys } from "@/modules/services/hooks/serviceKeys";
import { createTestQueryClient, createWrapper } from "@/modules/services/hooks/testUtils";
import { NotFoundError } from "@/core/errors";

describe("useServiceEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is disabled (never calls the query function) when serviceId is undefined", () => {
    renderHook(() => useServiceEditor(undefined), { wrapper: createWrapper() });
    expect(getServiceEditor).not.toHaveBeenCalled();
  });

  it("fetches under exactly serviceKeys.editor(serviceId) and returns the successful result", async () => {
    vi.mocked(getServiceEditor).mockResolvedValue({ service: { id: "service_1" } } as never);
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useServiceEditor("service_1"), { wrapper: createWrapper(queryClient) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getServiceEditor).toHaveBeenCalledWith("service_1");
    expect(queryClient.getQueryData(serviceKeys.editor("service_1"))).toEqual({ service: { id: "service_1" } });
  });

  it("surfaces a thrown error through the query's error state without retrying — a NotFoundError classifies as non-retryable under the shared retry contract", async () => {
    vi.mocked(getServiceEditor).mockRejectedValue(new NotFoundError("Service not found"));

    const { result } = renderHook(() => useServiceEditor("service_1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(NotFoundError);
    expect(getServiceEditor).toHaveBeenCalledTimes(1);
  });
});
