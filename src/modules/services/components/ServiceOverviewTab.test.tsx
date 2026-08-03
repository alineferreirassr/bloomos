import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ServiceOverviewTab } from "@/modules/services/components/ServiceOverviewTab";
import { makeService, makeServiceVersion, makeServiceCategory, makeServiceHealthSummary } from "@/modules/services/testUtils";
import type { ServiceEditorData } from "@/lib/queries/services/types";

function makeEditorData(overrides: Partial<ServiceEditorData> = {}): ServiceEditorData {
  return {
    service: makeService(),
    draftVersion: makeServiceVersion({ id: "draft_1", status: "draft", version_number: null, published_at: null, published_by: null }),
    publishedVersion: makeServiceVersion(),
    health: makeServiceHealthSummary({ percent: 62 }),
    recentTimeline: [],
    usageCount: 4,
    ...overrides,
  };
}

function renderTab(overrides: Partial<ServiceEditorData> = {}) {
  return render(
    <ServiceOverviewTab
      editor={makeEditorData(overrides)}
      categories={[makeServiceCategory()]}
      onSaveIdentity={vi.fn().mockResolvedValue(makeService())}
      onSaveDraftVersion={vi.fn().mockResolvedValue(makeServiceVersion())}
      identityReadOnly={false}
      draftReadOnly={false}
      onNavigateToTab={vi.fn()}
    />,
  );
}

describe("ServiceOverviewTab", () => {
  it("shows the health summary card with the editor's health percent", () => {
    renderTab({ health: makeServiceHealthSummary({ percent: 62 }) });
    expect(screen.getAllByText("62%")).toHaveLength(2);
  });

  it("shows the usage count", () => {
    renderTab({ usageCount: 4 });
    expect(screen.getByText("4 Events")).toBeInTheDocument();
  });

  it("shows the published version summary when a published version exists", () => {
    renderTab({ publishedVersion: makeServiceVersion({ version_number: 3 }) });
    expect(screen.getByText(/Published v3/)).toBeInTheDocument();
  });

  it("shows the never-published state when there is no published version yet", () => {
    renderTab({ publishedVersion: null });
    expect(screen.getByText(/never been published/)).toBeInTheDocument();
  });

  it("renders recent activity from the bounded recentTimeline slice", () => {
    renderTab({
      recentTimeline: [
        {
          id: "t1",
          workspace_id: "ws_1",
          owner_type: "service",
          owner_id: "service_1",
          actor: "Owner",
          type: "status_changed",
          description: "Service created",
          timestamp: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    expect(screen.getByText("Service created")).toBeInTheDocument();
  });

  it("shows an empty state for recent activity when there's none yet", () => {
    renderTab({ recentTimeline: [] });
    expect(screen.getByText("No activity yet")).toBeInTheDocument();
  });
});
