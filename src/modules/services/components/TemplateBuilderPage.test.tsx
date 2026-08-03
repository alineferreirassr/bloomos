import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

function fakeMutationBundle() {
  return {
    useCreate: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
    useUpdate: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
    useRemove: () => ({ mutateAsync: vi.fn().mockResolvedValue(null), isPending: false }),
    useReorder: () => ({ mutateAsync: vi.fn().mockResolvedValue([]), isPending: false }),
  };
}

vi.mock("@/modules/services/hooks/useTemplateItemMutations", () => ({
  includedItemMutations: fakeMutationBundle(),
  addOnMutations: fakeMutationBundle(),
  checklistTemplateItemMutations: fakeMutationBundle(),
  timelineTemplateItemMutations: fakeMutationBundle(),
  questionnaireQuestionMutations: fakeMutationBundle(),
  budgetTemplateLineMutations: fakeMutationBundle(),
  approvalTemplateItemMutations: fakeMutationBundle(),
  travelTemplateItemMutations: fakeMutationBundle(),
  aiKnowledgeItemMutations: fakeMutationBundle(),
  requiredDocumentMutations: fakeMutationBundle(),
  inventoryTemplateItemMutations: fakeMutationBundle(),
  purchaseTemplateItemMutations: fakeMutationBundle(),
  vendorSuggestionMutations: fakeMutationBundle(),
  teamRoleRequirementMutations: fakeMutationBundle(),
  capabilityRequirementMutations: fakeMutationBundle(),
  seasonalWindowMutations: fakeMutationBundle(),
}));

vi.mock("@/modules/services/hooks/useTemplateBuilder", () => ({ useTemplateBuilder: vi.fn() }));

import { TemplateBuilderPage } from "@/modules/services/components/TemplateBuilderPage";
import { useTemplateBuilder } from "@/modules/services/hooks/useTemplateBuilder";
import type { TemplateBuilderData } from "@/lib/queries/services/types";

function makeData(overrides: Partial<TemplateBuilderData> = {}): TemplateBuilderData {
  return {
    serviceVersionId: "draft_1",
    isEditable: true,
    groups: [
      {
        groupName: "What the client sees",
        categories: [
          { key: "includedItems", rows: [{ id: "i1", label: "Welcome drink", description: null, display_order: 0 }], count: 1, expectation: "optional" },
          { key: "addOns", rows: [], count: 0, expectation: "optional" },
        ],
      },
      {
        groupName: "Day-of operations",
        categories: [
          { key: "checklistItems", rows: [], count: 0, expectation: "expected" },
          { key: "timelineItems", rows: [], count: 0, expectation: "expected" },
          { key: "travelItems", rows: [], count: 0, expectation: "optional" },
        ],
      },
      { groupName: "Before the event — readiness", categories: [
        { key: "questionnaireQuestions", rows: [], count: 0, expectation: "expected" },
        { key: "requiredDocuments", rows: [], count: 0, expectation: "optional" },
        { key: "approvalItems", rows: [], count: 0, expectation: "optional" },
      ] },
      { groupName: "Resources & staffing", categories: [
        { key: "inventoryItems", rows: [], count: 0, expectation: "optional" },
        { key: "purchaseItems", rows: [], count: 0, expectation: "optional" },
        { key: "vendorSuggestions", rows: [], count: 0, expectation: "optional" },
        { key: "teamRoleRequirements", rows: [], count: 0, expectation: "expected" },
        { key: "capabilityRequirements", rows: [], count: 0, expectation: "optional" },
      ] },
      { groupName: "Financial planning", categories: [{ key: "budgetLines", rows: [], count: 0, expectation: "expected" }] },
      { groupName: "Planning intelligence", categories: [
        { key: "aiKnowledgeItems", rows: [], count: 0, expectation: "optional" },
        { key: "seasonalWindows", rows: [], count: 0, expectation: "optional" },
      ] },
    ],
    ...overrides,
  } as TemplateBuilderData;
}

beforeEach(() => {
  vi.mocked(useTemplateBuilder).mockReturnValue({ status: "success", data: makeData(), error: null, refetch: vi.fn() } as never);
});

describe("TemplateBuilderPage", () => {
  it("shows a loading state while pending", () => {
    vi.mocked(useTemplateBuilder).mockReturnValue({ status: "pending", data: undefined, error: null, refetch: vi.fn() } as never);
    const { container } = render(<TemplateBuilderPage serviceId="s1" serviceVersionId="v1" isArchived={false} canEdit />);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it("shows an error state with retry wired to refetch", () => {
    const refetch = vi.fn();
    vi.mocked(useTemplateBuilder).mockReturnValue({ status: "error", data: undefined, error: new Error("boom"), refetch } as never);
    render(<TemplateBuilderPage serviceId="s1" serviceVersionId="v1" isArchived={false} canEdit />);
    expect(screen.getByText(/couldn't load the Template Builder/)).toBeInTheDocument();
  });

  it("renders every category from every group, plus the sidebar", () => {
    render(<TemplateBuilderPage serviceId="s1" serviceVersionId="v1" isArchived={false} canEdit />);
    expect(screen.getByText("Welcome drink")).toBeInTheDocument();
    expect(screen.getByText("Quick navigation")).toBeInTheDocument();
    expect(screen.getAllByText("Seasonal Windows").length).toBeGreaterThan(0);
  });

  it("disables Add/Edit across categories when the Service is archived, with the archived reason", async () => {
    render(<TemplateBuilderPage serviceId="s1" serviceVersionId="v1" isArchived={true} canEdit />);
    const addButtons = screen.getAllByRole("button", { name: /^Add /, hidden: true });
    expect(addButtons.length).toBeGreaterThan(0);
    expect(addButtons[0]).toHaveAttribute("aria-disabled", "true");
  });

  it("disables editing when the version is published (locked), independent of permission", () => {
    vi.mocked(useTemplateBuilder).mockReturnValue({ status: "success", data: makeData({ isEditable: false }), error: null, refetch: vi.fn() } as never);
    render(<TemplateBuilderPage serviceId="s1" serviceVersionId="v1" isArchived={false} canEdit />);
    const addButtons = screen.getAllByRole("button", { name: /^Add /, hidden: true });
    expect(addButtons[0]).toHaveAttribute("aria-disabled", "true");
  });

  it("disables editing when permission is denied", () => {
    render(<TemplateBuilderPage serviceId="s1" serviceVersionId="v1" isArchived={false} canEdit={false} permissionDeniedReason="You don't have access to manage Services." />);
    const addButtons = screen.getAllByRole("button", { name: /^Add /, hidden: true });
    expect(addButtons[0]).toHaveAttribute("aria-disabled", "true");
  });

  it("disables editing while a publish is in flight, with a distinct reason from the locked/archived/permission cases", () => {
    render(<TemplateBuilderPage serviceId="s1" serviceVersionId="v1" isArchived={false} canEdit isPublishing />);
    const addButtons = screen.getAllByRole("button", { name: /^Add /, hidden: true });
    expect(addButtons[0]).toHaveAttribute("aria-disabled", "true");
  });

  it("leaves editing enabled when isPublishing is false and every other gate is open", () => {
    render(<TemplateBuilderPage serviceId="s1" serviceVersionId="v1" isArchived={false} canEdit isPublishing={false} />);
    const addButtons = screen.getAllByRole("button", { name: /^Add /, hidden: true });
    expect(addButtons[0]).not.toHaveAttribute("aria-disabled");
  });

  it("scrolls the requested category into view once data is ready, then reports it handled exactly once", () => {
    const scrollIntoView = vi.fn();
    const originalGetElementById = document.getElementById.bind(document);
    vi.spyOn(document, "getElementById").mockImplementation((id: string) => {
      if (id === "template-category-budgetLines") return { scrollIntoView } as unknown as HTMLElement;
      return originalGetElementById(id);
    });
    const onScrollHandled = vi.fn();
    render(<TemplateBuilderPage serviceId="s1" serviceVersionId="v1" isArchived={false} canEdit scrollToCategoryOnMount="budgetLines" onScrollHandled={onScrollHandled} />);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(onScrollHandled).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });

  it("does nothing when scrollToCategoryOnMount is unset", () => {
    const scrollIntoView = vi.fn();
    vi.spyOn(document, "getElementById").mockReturnValue({ scrollIntoView } as unknown as HTMLElement);
    const onScrollHandled = vi.fn();
    render(<TemplateBuilderPage serviceId="s1" serviceVersionId="v1" isArchived={false} canEdit onScrollHandled={onScrollHandled} />);
    expect(onScrollHandled).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
