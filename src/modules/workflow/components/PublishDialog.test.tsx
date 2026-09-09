import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PublishDialog } from "@/modules/workflow/components/PublishDialog";
import type { WorkflowIssue } from "@/types/workflow";

function makeIssue(overrides: Partial<WorkflowIssue> = {}): WorkflowIssue {
  return {
    code: "missing_trigger",
    message: "This path has no Trigger.",
    nodeId: null,
    edgeId: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("PublishDialog", () => {
  it("renders the publishable state: no issue badge, enabled Publish, next-version copy", () => {
    render(
      <PublishDialog
        open
        onClose={vi.fn()}
        issues={[]}
        publishing={false}
        onConfirm={vi.fn()}
        currentVersion={3}
      />,
    );

    expect(screen.queryByText(/issue/i)).not.toBeInTheDocument();
    expect(screen.getByText(/version 4/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).not.toBeDisabled();
  });

  it("shows the plural issue-count badge and blocks Publish with multiple issues", () => {
    render(
      <PublishDialog
        open
        onClose={vi.fn()}
        issues={[
          makeIssue({ code: "missing_trigger", message: "This path has no Trigger." }),
          makeIssue({ code: "orphan_node", message: "This node isn't connected to anything." }),
        ]}
        publishing={false}
        onConfirm={vi.fn()}
        currentVersion={3}
      />,
    );

    expect(screen.getByText("2 issues")).toBeInTheDocument();
    expect(screen.getByText("This path has no Trigger.")).toBeInTheDocument();
    expect(screen.getByText("This node isn't connected to anything.")).toBeInTheDocument();
    expect(screen.getByText("This Workflow has validation errors and can't be published yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
  });

  it("shows the singular issue-count badge with exactly one issue", () => {
    render(
      <PublishDialog
        open
        onClose={vi.fn()}
        issues={[makeIssue()]}
        publishing={false}
        onConfirm={vi.fn()}
        currentVersion={3}
      />,
    );

    expect(screen.getByText("1 issue")).toBeInTheDocument();
  });

  it("disables Publish and shows 'Publishing…' while a publish is in flight, even with zero issues", () => {
    render(
      <PublishDialog
        open
        onClose={vi.fn()}
        issues={[]}
        publishing={true}
        onConfirm={vi.fn()}
        currentVersion={3}
      />,
    );

    const publishButton = screen.getByRole("button", { name: "Publishing…" });
    expect(publishButton).toBeDisabled();
  });

  it("calls onConfirm on Publish click and onClose on Cancel click", async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <PublishDialog
        open
        onClose={onClose}
        issues={[]}
        publishing={false}
        onConfirm={onConfirm}
        currentVersion={3}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Publish" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
