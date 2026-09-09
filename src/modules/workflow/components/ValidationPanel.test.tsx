import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ValidationPanel } from "@/modules/workflow/components/ValidationPanel";
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

describe("ValidationPanel", () => {
  it("shows the valid/empty state when there are no issues", () => {
    render(<ValidationPanel issues={[]} onSelectNode={vi.fn()} />);

    expect(screen.getByText("Ready to publish")).toBeInTheDocument();
    expect(screen.getByText("No validation issues")).toBeInTheDocument();
    expect(screen.getByText("This Workflow is ready to publish.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders a single issue with the singular count and calls onSelectNode with its nodeId on click", async () => {
    const onSelectNode = vi.fn();
    render(
      <ValidationPanel
        issues={[makeIssue({ code: "missing_trigger", message: "This path has no Trigger.", nodeId: "node_1" })]}
        onSelectNode={onSelectNode}
      />,
    );

    expect(screen.getByText("1 issue")).toBeInTheDocument();
    expect(screen.getByText("missing trigger")).toBeInTheDocument();
    expect(screen.getByText("This path has no Trigger.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button"));
    expect(onSelectNode).toHaveBeenCalledWith("node_1");
  });

  it("renders multiple issues with the plural count, mapping over every issue", () => {
    render(
      <ValidationPanel
        issues={[
          makeIssue({ code: "missing_trigger", message: "This path has no Trigger.", nodeId: "node_1" }),
          makeIssue({ code: "orphan_node", message: "This node isn't connected to anything.", nodeId: "node_2" }),
        ]}
        onSelectNode={vi.fn()}
      />,
    );

    expect(screen.getByText("2 issues")).toBeInTheDocument();
    expect(screen.getByText("missing trigger")).toBeInTheDocument();
    expect(screen.getByText("This path has no Trigger.")).toBeInTheDocument();
    expect(screen.getByText("orphan node")).toBeInTheDocument();
    expect(screen.getByText("This node isn't connected to anything.")).toBeInTheDocument();
  });

  it("disables the button for a nodeless issue and never calls onSelectNode", async () => {
    const onSelectNode = vi.fn();
    render(
      <ValidationPanel
        issues={[makeIssue({ code: "orphan_node", message: "This edge has no valid target.", nodeId: null, edgeId: "edge_1" })]}
        onSelectNode={onSelectNode}
      />,
    );

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();

    await userEvent.click(button);
    expect(onSelectNode).not.toHaveBeenCalled();
  });
});
