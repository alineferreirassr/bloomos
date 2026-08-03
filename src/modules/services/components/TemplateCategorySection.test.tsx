import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TemplateCategorySection } from "@/modules/services/components/TemplateCategorySection";
import type { TemplateCategoryAdapter } from "@/modules/services/templateCategoryAdapters";
import type { TemplateCategoryData } from "@/lib/queries/services/types";

interface FakeRow {
  id: string;
  label: string;
  description: string | null;
  display_order: number;
}

/**
 * A hand-written fake adapter whose `mutations` are plain functions (not
 * real `useMutation` calls) — avoids needing a QueryClientProvider entirely,
 * matching "Do not test React Query": this suite verifies
 * TemplateCategorySection's own orchestration logic, never the query layer.
 */
function makeFakeAdapter(overrides: Partial<TemplateCategoryAdapter<FakeRow, Record<string, unknown>>> = {}) {
  const createMutateAsync = vi.fn().mockResolvedValue({ id: "new_1", label: "New", description: null, display_order: 1 });
  const updateMutateAsync = vi.fn().mockResolvedValue({});
  const removeMutateAsync = vi.fn().mockResolvedValue(null);
  const reorderMutateAsync = vi.fn().mockResolvedValue([]);

  const adapter: TemplateCategoryAdapter<FakeRow, Record<string, unknown>> = {
    key: "includedItems",
    label: "Included Items",
    itemNoun: "included item",
    supportsReorder: true,
    fields: [
      { name: "label", label: "Label", kind: "text", required: true },
      { name: "description", label: "Description", kind: "textarea", nullable: true },
    ],
    toRowLabel: (row) => row.label,
    toRowDescription: (row) => row.description,
    mutations: {
      useCreate: () => ({ mutateAsync: createMutateAsync, isPending: false }),
      useUpdate: () => ({ mutateAsync: updateMutateAsync, isPending: false }),
      useRemove: () => ({ mutateAsync: removeMutateAsync, isPending: false }),
      useReorder: () => ({ mutateAsync: reorderMutateAsync, isPending: false }),
    },
    ...overrides,
  };

  return { adapter, createMutateAsync, updateMutateAsync, removeMutateAsync, reorderMutateAsync };
}

function makeCategory(overrides: Partial<TemplateCategoryData<FakeRow>> = {}): TemplateCategoryData<FakeRow> {
  return {
    key: "includedItems",
    rows: [{ id: "item_1", label: "Welcome drink", description: null, display_order: 0 }],
    count: 1,
    expectation: "optional",
    ...overrides,
  };
}

describe("TemplateCategorySection", () => {
  it("starts collapsed for an optional, empty category", () => {
    const { adapter } = makeFakeAdapter();
    render(<TemplateCategorySection adapter={adapter} category={makeCategory({ rows: [], count: 0, expectation: "optional" })} serviceId="s1" serviceVersionId="v1" disabled={false} locked={false} />);
    expect(screen.queryByText(/No included items yet/)).not.toBeInTheDocument();
  });

  it("starts expanded for an expected, empty category", () => {
    const { adapter } = makeFakeAdapter();
    render(<TemplateCategorySection adapter={adapter} category={makeCategory({ rows: [], count: 0, expectation: "expected" })} serviceId="s1" serviceVersionId="v1" disabled={false} locked={false} />);
    expect(screen.getByText(/No included items yet/)).toBeInTheDocument();
  });

  it("toggles expand/collapse and the state persists across re-renders of the same instance", async () => {
    const user = userEvent.setup();
    const { adapter } = makeFakeAdapter();
    const category = makeCategory({ rows: [], count: 0, expectation: "optional" });
    const { rerender } = render(<TemplateCategorySection adapter={adapter} category={category} serviceId="s1" serviceVersionId="v1" disabled={false} locked={false} />);

    await user.click(screen.getByRole("button", { name: /Included Items/ }));
    expect(screen.getByText(/No included items yet/)).toBeInTheDocument();

    rerender(<TemplateCategorySection adapter={adapter} category={category} serviceId="s1" serviceVersionId="v1" disabled={false} locked={false} />);
    expect(screen.getByText(/No included items yet/)).toBeInTheDocument();
  });

  it("opens the Inspector with an empty form when Add is clicked", async () => {
    const user = userEvent.setup();
    const { adapter } = makeFakeAdapter();
    render(<TemplateCategorySection adapter={adapter} category={makeCategory({ expectation: "expected" })} serviceId="s1" serviceVersionId="v1" disabled={false} locked={false} />);
    await user.click(screen.getByRole("button", { name: "Add included item" }));
    expect(screen.getByRole("dialog", { name: "Add included item" })).toBeInTheDocument();
    expect(screen.getByLabelText("Label", { exact: false })).toHaveValue("");
  });

  it("opens the Inspector prefilled when a row's Edit is clicked", async () => {
    const user = userEvent.setup();
    const { adapter } = makeFakeAdapter();
    render(<TemplateCategorySection adapter={adapter} category={makeCategory({ expectation: "expected" })} serviceId="s1" serviceVersionId="v1" disabled={false} locked={false} />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("dialog", { name: "Edit included item" })).toBeInTheDocument();
    expect(screen.getByLabelText("Label", { exact: false })).toHaveValue("Welcome drink");
  });

  it("creating a new item appends it at the end (display_order = current row count)", async () => {
    const user = userEvent.setup();
    const { adapter, createMutateAsync } = makeFakeAdapter();
    render(<TemplateCategorySection adapter={adapter} category={makeCategory({ expectation: "expected" })} serviceId="s1" serviceVersionId="v1" disabled={false} locked={false} />);
    await user.click(screen.getByRole("button", { name: "Add included item" }));
    await user.type(screen.getByLabelText("Label", { exact: false }), "Second item");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(createMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ label: "Second item", display_order: 1 }));
  });

  it("updating an existing item preserves its own display_order", async () => {
    const user = userEvent.setup();
    const { adapter, updateMutateAsync } = makeFakeAdapter();
    render(<TemplateCategorySection adapter={adapter} category={makeCategory({ expectation: "expected" })} serviceId="s1" serviceVersionId="v1" disabled={false} locked={false} />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(updateMutateAsync).toHaveBeenCalledWith({ id: "item_1", input: expect.objectContaining({ display_order: 0 }) });
  });

  it("deleting a row calls remove with its id", async () => {
    const user = userEvent.setup();
    const { adapter, removeMutateAsync } = makeFakeAdapter();
    render(<TemplateCategorySection adapter={adapter} category={makeCategory({ expectation: "expected" })} serviceId="s1" serviceVersionId="v1" disabled={false} locked={false} />);
    await user.click(screen.getByRole("button", { name: "Item actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(removeMutateAsync).toHaveBeenCalledWith("item_1");
  });

  it("shows the Toolbar's Add button disabled with a Tooltip reason when read-only", () => {
    const { adapter } = makeFakeAdapter();
    render(
      <TemplateCategorySection
        adapter={adapter}
        category={makeCategory({ expectation: "expected" })}
        serviceId="s1"
        serviceVersionId="v1"
        disabled={true}
        locked={false}
        disabledReason="Archived Services are read-only. Restore it first."
      />,
    );
    expect(screen.getByRole("button", { name: /Add included item/ })).toHaveAttribute("aria-disabled", "true");
  });
});
