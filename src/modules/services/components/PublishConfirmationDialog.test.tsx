import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/modules/services/hooks/usePublishPreview", () => ({ usePublishPreview: vi.fn() }));

import { PublishConfirmationDialog } from "@/modules/services/components/PublishConfirmationDialog";
import { usePublishPreview } from "@/modules/services/hooks/usePublishPreview";
import { ServiceMutationError } from "@/modules/services/hooks/errorContract";
import { ConflictError, ForbiddenError } from "@/core/errors";

function previewData(overrides: Record<string, unknown> = {}) {
  return {
    serviceId: "service_1",
    draftVersionId: "draft_1",
    draftVersionUpdatedAt: "2026-01-01T00:00:00.000Z",
    nextVersionNumber: 1,
    currentPublishedVersionNumber: null,
    health: { percent: 100, missing: [] },
    templateCompletion: { percent: 100, requiredComplete: 5, requiredTotal: 5, optionalUsed: 0, optionalTotal: 11, missingRequiredCategories: [] },
    affectedCategories: [],
    blockingErrors: [],
    warnings: [],
    canPublish: true,
    ...overrides,
  };
}

function renderDialog(overrides: { data?: Record<string, unknown>; onConfirm?: (input: unknown) => Promise<unknown>; refetch?: () => void } = {}) {
  const refetch = overrides.refetch ?? vi.fn();
  vi.mocked(usePublishPreview).mockReturnValue({ status: "success", data: previewData(overrides.data), refetch } as never);
  const onConfirm = overrides.onConfirm ?? vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  const onPublished = vi.fn();
  const utils = render(
    <PublishConfirmationDialog
      serviceId="service_1"
      serviceName="Photography"
      liveDraftVersionUpdatedAt="2026-01-01T00:00:00.000Z"
      open={true}
      onClose={onClose}
      onConfirm={onConfirm}
      onPublished={onPublished}
    />,
  );
  return { ...utils, refetch, onConfirm, onClose, onPublished };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PublishConfirmationDialog", () => {
  it("shows a loading skeleton while the preview is pending", () => {
    vi.mocked(usePublishPreview).mockReturnValue({ status: "pending", data: undefined, refetch: vi.fn() } as never);
    const { container } = render(
      <PublishConfirmationDialog serviceId="s1" serviceName="Photography" liveDraftVersionUpdatedAt="t" open onClose={vi.fn()} onConfirm={vi.fn()} onPublished={vi.fn()} />,
    );
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it("shows a retry option when the preview fails to load", async () => {
    const refetch = vi.fn();
    vi.mocked(usePublishPreview).mockReturnValue({ status: "error", data: undefined, refetch } as never);
    const user = userEvent.setup();
    render(<PublishConfirmationDialog serviceId="s1" serviceName="Photography" liveDraftVersionUpdatedAt="t" open onClose={vi.fn()} onConfirm={vi.fn()} onPublished={vi.fn()} />);
    expect(screen.getByText(/couldn't load the publish preview/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows the next version number and 'first published version' when there is no current published version", () => {
    renderDialog({ data: { nextVersionNumber: 1, currentPublishedVersionNumber: null } });
    expect(screen.getByText("Published v1")).toBeInTheDocument();
    expect(screen.getByText(/first published version/)).toBeInTheDocument();
  });

  it("names the version it replaces when a published version already exists", () => {
    renderDialog({ data: { nextVersionNumber: 4, currentPublishedVersionNumber: 3 } });
    expect(screen.getByText(/Replaces the current Published v3/)).toBeInTheDocument();
  });

  it("disables Publish and shows every blocking error when canPublish is false", () => {
    renderDialog({ data: { canPublish: false, blockingErrors: ["Only a draft version can be published."] } });
    expect(screen.getByText("Only a draft version can be published.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
  });

  it("shows warnings but leaves Publish enabled — warnings never block", () => {
    renderDialog({ data: { warnings: ["Budget is missing or incomplete."] } });
    expect(screen.getByText("Budget is missing or incomplete.")).toBeInTheDocument();
    expect(screen.getByText("Warnings — publishing is still allowed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).not.toBeDisabled();
  });

  it("lists the affected (non-empty) template categories by their human label", () => {
    renderDialog({ data: { affectedCategories: ["includedItems", "budgetLines"] } });
    expect(screen.getByText(/Includes: Included Items, Budget Lines\./)).toBeInTheDocument();
  });

  it("detects a stale preview (draft changed since fetch) and blocks Publish until refreshed", async () => {
    const refetch = vi.fn();
    vi.mocked(usePublishPreview).mockReturnValue({ status: "success", data: previewData({ draftVersionUpdatedAt: "2026-01-01T00:00:00.000Z" }), refetch } as never);
    const user = userEvent.setup();
    render(
      <PublishConfirmationDialog
        serviceId="s1"
        serviceName="Photography"
        liveDraftVersionUpdatedAt="2026-01-02T00:00:00.000Z"
        open
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        onPublished={vi.fn()}
      />,
    );
    expect(screen.getByText(/This draft changed since you opened this preview/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Refresh preview" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("submits the trimmed change summary (or null when blank) and reports the published version number", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const { onPublished, onClose } = renderDialog({ data: { nextVersionNumber: 2 }, onConfirm });
    await user.type(screen.getByLabelText("What changed", { exact: false }), "  Added new add-on  ");
    await user.click(screen.getByRole("button", { name: "Publish" }));
    expect(onConfirm).toHaveBeenCalledWith({ change_summary: "Added new add-on" });
    expect(onClose).toHaveBeenCalled();
    expect(onPublished).toHaveBeenCalledWith(2);
  });

  it("shows a field-appropriate error and keeps the dialog open when the mutation fails validation", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockRejectedValue(new ServiceMutationError("Please fix the highlighted fields."));
    const { onClose } = renderDialog({ onConfirm });
    await user.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByText("Please fix the highlighted fields.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows a distinguishable conflict message with a Refresh action when the RPC reports someone else already published", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    const onConfirm = vi.fn().mockRejectedValue(new ConflictError("This version is not currently a draft."));
    renderDialog({ onConfirm, refetch });
    await user.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByText(/This version is not currently a draft\. Refresh the preview to see what changed\./)).toBeInTheDocument();
    const refreshButtons = screen.getAllByRole("button", { name: "Refresh preview" });
    await user.click(refreshButtons[refreshButtons.length - 1]);
    expect(refetch).toHaveBeenCalled();
  });

  it("shows a permission-denial message distinctly from a validation error", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockRejectedValue(new ForbiddenError("You don't have permission to publish this Service."));
    renderDialog({ onConfirm });
    await user.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByText("You don't have permission to publish this Service.")).toBeInTheDocument();
  });

  it("does not lose the change summary or dialog state after a failed publish attempt", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockRejectedValue(new Error("Network blip"));
    renderDialog({ onConfirm });
    await user.type(screen.getByLabelText("What changed", { exact: false }), "Kept this note");
    await user.click(screen.getByRole("button", { name: "Publish" }));
    await screen.findByText("Network blip");
    expect(screen.getByLabelText("What changed", { exact: false })).toHaveValue("Kept this note");
  });

  it("closes on Cancel without calling onConfirm", async () => {
    const user = userEvent.setup();
    const { onConfirm, onClose } = renderDialog();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("disables Publish and Cancel while a submission is in flight", async () => {
    const user = userEvent.setup();
    let resolveConfirm: () => void = () => {};
    const confirmPromise = new Promise<void>((resolve) => {
      resolveConfirm = resolve;
    });
    const onConfirm = vi.fn(() => confirmPromise);
    renderDialog({ onConfirm });
    await user.click(screen.getByRole("button", { name: "Publish" }));
    expect(screen.getByRole("button", { name: "Publishing…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    resolveConfirm();
    await confirmPromise;
  });
});
