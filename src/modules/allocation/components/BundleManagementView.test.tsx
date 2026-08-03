import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BundleManagementView } from "@/modules/allocation/components/BundleManagementView";
import type { ResourceBundle } from "@/types/allocation";

vi.mock("@/modules/allocation/allocationActions", () => ({
  listResourceBundlesAction: vi.fn(),
}));

import { listResourceBundlesAction } from "@/modules/allocation/allocationActions";

const NOW = "2026-01-01T00:00:00.000Z";

function makeBundle(overrides: Partial<ResourceBundle> = {}): ResourceBundle {
  return {
    id: "bundle_1",
    workspace_id: "ws_1",
    name: "Photography Crew",
    description: "Lead photographer + assistant",
    required_resources: [{ resource_type: "worker", quantity: 2, capability_requirement_id: null, notes: null }],
    optional_resources: [],
    min_quantity: 1,
    max_quantity: null,
    status: "active",
    created_by: "member_1",
    created_at: NOW,
    updated_at: NOW,
    archived_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(listResourceBundlesAction).mockReset();
});

describe("BundleManagementView", () => {
  it("renders the bundle list with its required/optional line counts", async () => {
    vi.mocked(listResourceBundlesAction).mockResolvedValue({ success: true, data: [makeBundle()] });
    render(<BundleManagementView />);

    expect(await screen.findByText("Photography Crew")).toBeInTheDocument();
    expect(screen.getByText("Lead photographer + assistant")).toBeInTheDocument();
    expect(screen.getByText("2× worker")).toBeInTheDocument();
  });

  it("renders an error state when the list action fails", async () => {
    vi.mocked(listResourceBundlesAction).mockResolvedValue({ success: false, error: "Access denied." });
    render(<BundleManagementView />);
    expect(await screen.findByText("Access denied.")).toBeInTheDocument();
  });

  it("shows an empty state when there are no bundles", async () => {
    vi.mocked(listResourceBundlesAction).mockResolvedValue({ success: true, data: [] });
    render(<BundleManagementView />);
    expect(await screen.findByText("No resource bundles yet")).toBeInTheDocument();
  });
});
