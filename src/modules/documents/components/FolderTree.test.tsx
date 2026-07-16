import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FolderTree } from "@/modules/documents/components/FolderTree";
import { makeDocumentFolder } from "@/modules/documents/testUtils";
import type { DocumentFolderTreeNode } from "@/lib/data";

const nodes: DocumentFolderTreeNode[] = [
  {
    folder: makeDocumentFolder({ id: "f_root", name: "Root" }),
    children: [
      {
        folder: makeDocumentFolder({ id: "f_child", name: "Child", parent_folder_id: "f_root" }),
        children: [],
      },
    ],
  },
];

describe("FolderTree", () => {
  it("renders nested folders with links to their detail pages", () => {
    render(<FolderTree nodes={nodes} />);
    expect(screen.getByRole("link", { name: "Root" })).toHaveAttribute("href", "/documents/folders/f_root");
    expect(screen.getByRole("link", { name: "Child" })).toHaveAttribute("href", "/documents/folders/f_child");
  });

  it("collapses and re-expands children on toggle", async () => {
    const user = userEvent.setup();
    render(<FolderTree nodes={nodes} />);

    expect(screen.getByRole("link", { name: "Child" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /collapse folder/i }));
    expect(screen.queryByRole("link", { name: "Child" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /expand folder/i }));
    expect(screen.getByRole("link", { name: "Child" })).toBeInTheDocument();
  });

  it("marks the active folder", () => {
    render(<FolderTree nodes={nodes} activeFolderId="f_child" />);
    expect(screen.getByRole("link", { name: "Child" })).toHaveClass("text-accent");
  });

  it("shows an archived indicator", () => {
    const archivedNodes: DocumentFolderTreeNode[] = [
      { folder: makeDocumentFolder({ id: "f_arch", name: "Old", archived_at: "2026-01-01T00:00:00.000Z" }), children: [] },
    ];
    render(<FolderTree nodes={archivedNodes} />);
    expect(screen.getByText(/\(archived\)/i)).toBeInTheDocument();
  });
});
