import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { VersionHistorySection } from "@/modules/contracts/components/VersionHistorySection";
import { makeContract } from "@/modules/contracts/testUtils";

describe("VersionHistorySection", () => {
  it("shows a single 'Created' entry for a contract with no prior edits", () => {
    const contract = makeContract({ version: 1, version_history: [], title: "Test Contract" });
    render(<VersionHistorySection contract={contract} />);

    const list = screen.getByTestId("version-history-list");
    expect(within(list).getByText(/v1 — created/i)).toBeInTheDocument();
  });

  it("shows the current version and every historical snapshot, newest first", () => {
    const contract = makeContract({
      version: 3,
      title: "Updated Title",
      total_value: 5000,
      version_history: [
        {
          version: 1,
          title: "Original Title",
          description: null,
          total_value: 1000,
          deposit_amount: null,
          recorded_at: "2026-01-01T00:00:00.000Z",
        },
        {
          version: 2,
          title: "Original Title",
          description: null,
          total_value: 3000,
          deposit_amount: null,
          recorded_at: "2026-02-01T00:00:00.000Z",
        },
      ],
    });
    render(<VersionHistorySection contract={contract} />);

    const list = screen.getByTestId("version-history-list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    // Newest (current) first.
    expect(within(items[0]).getByText(/v3 — current/i)).toBeInTheDocument();
    expect(within(items[1]).getByText(/v2 — updated/i)).toBeInTheDocument();
    expect(within(items[2]).getByText(/v1 — created/i)).toBeInTheDocument();
  });

  it("summarizes which fields changed between consecutive versions", () => {
    const contract = makeContract({
      version: 2,
      title: "New Title",
      total_value: 2000,
      version_history: [
        {
          version: 1,
          title: "Old Title",
          description: null,
          total_value: 1000,
          deposit_amount: null,
          recorded_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    render(<VersionHistorySection contract={contract} />);

    const list = screen.getByTestId("version-history-list");
    expect(within(list).getByText(/changed: title, total value/i)).toBeInTheDocument();
  });

  it("shows no changed-fields line for the first (created) entry", () => {
    const contract = makeContract({
      version: 2,
      version_history: [
        {
          version: 1,
          title: "Test Contract",
          description: null,
          total_value: null,
          deposit_amount: null,
          recorded_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    render(<VersionHistorySection contract={contract} />);

    const list = screen.getByTestId("version-history-list");
    const items = within(list).getAllByRole("listitem");
    const createdEntry = items[items.length - 1];
    expect(within(createdEntry).queryByText(/^changed:/i)).not.toBeInTheDocument();
  });
});
