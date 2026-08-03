import { describe, expect, it } from "vitest";
import {
  wouldCreateFolderCycle,
  canMoveFolder,
  getFolderPath,
  getFolderChildren,
  getFolderDescendants,
  sortFolders,
} from "@/core/workflows/documentFolderWorkflow";
import type { DocumentFolder } from "@/types/documentFolder";

function folder(overrides: Partial<DocumentFolder> & { id: string }): DocumentFolder {
  return {
    workspace_id: "ws_1",
    owner_type: "client",
    owner_id: "client_1",
    parent_folder_id: null,
    name: "Folder",
    description: null,
    sort_order: 0,
    visibility: "internal",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}

const root = folder({ id: "f_root", name: "Root" });
const child = folder({ id: "f_child", parent_folder_id: "f_root", name: "Child" });
const grandchild = folder({ id: "f_grandchild", parent_folder_id: "f_child", name: "Grandchild" });
const sibling = folder({ id: "f_sibling", parent_folder_id: "f_root", name: "Sibling", sort_order: 1 });
const allFolders = [root, child, grandchild, sibling];

describe("wouldCreateFolderCycle", () => {
  it("is false when moving to root (null)", () => {
    expect(wouldCreateFolderCycle("f_child", null, allFolders)).toBe(false);
  });

  it("is true when a folder is set as its own parent", () => {
    expect(wouldCreateFolderCycle("f_root", "f_root", allFolders)).toBe(true);
  });

  it("is true when moving a folder under its own descendant", () => {
    expect(wouldCreateFolderCycle("f_root", "f_grandchild", allFolders)).toBe(true);
  });

  it("is false for a legitimate reparent to an unrelated folder", () => {
    expect(wouldCreateFolderCycle("f_grandchild", "f_sibling", allFolders)).toBe(false);
  });
});

describe("canMoveFolder", () => {
  it("allows moving to a sibling within the same owner", () => {
    expect(canMoveFolder(grandchild, "f_sibling", allFolders).allowed).toBe(true);
  });

  it("rejects a nonexistent target folder", () => {
    const result = canMoveFolder(child, "f_missing", allFolders);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/does not exist/i);
  });

  it("rejects moving across Workspaces", () => {
    const otherWorkspaceTarget = folder({ id: "f_other_ws", workspace_id: "ws_2" });
    const result = canMoveFolder(child, "f_other_ws", [...allFolders, otherWorkspaceTarget]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/workspace/i);
  });

  it("rejects moving to a different owner", () => {
    const otherOwnerTarget = folder({ id: "f_other_owner", owner_type: "event", owner_id: "event_1" });
    const result = canMoveFolder(child, "f_other_owner", [...allFolders, otherOwnerTarget]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/owner/i);
  });

  it("rejects a move that would create a cycle", () => {
    const result = canMoveFolder(root, "f_grandchild", allFolders);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/circular/i);
  });
});

describe("getFolderPath", () => {
  it("returns the root-to-leaf path inclusive of the target", () => {
    expect(getFolderPath("f_grandchild", allFolders).map((f) => f.id)).toEqual(["f_root", "f_child", "f_grandchild"]);
  });

  it("returns a single-item path for a root folder", () => {
    expect(getFolderPath("f_root", allFolders).map((f) => f.id)).toEqual(["f_root"]);
  });

  it("returns an empty array for an unknown id", () => {
    expect(getFolderPath("f_missing", allFolders)).toEqual([]);
  });
});

describe("getFolderChildren", () => {
  it("returns direct children only, sorted", () => {
    expect(getFolderChildren("f_root", allFolders).map((f) => f.id)).toEqual(["f_child", "f_sibling"]);
  });

  it("returns root-level folders for null", () => {
    expect(getFolderChildren(null, allFolders).map((f) => f.id)).toEqual(["f_root"]);
  });
});

describe("getFolderDescendants", () => {
  it("returns every descendant at any depth, not including the folder itself", () => {
    const ids = getFolderDescendants("f_root", allFolders).map((f) => f.id);
    expect(ids).toContain("f_child");
    expect(ids).toContain("f_grandchild");
    expect(ids).toContain("f_sibling");
    expect(ids).not.toContain("f_root");
  });

  it("returns an empty array for a leaf folder", () => {
    expect(getFolderDescendants("f_grandchild", allFolders)).toEqual([]);
  });
});

describe("sortFolders", () => {
  it("sorts by sort_order ascending", () => {
    const unsorted = [sibling, root];
    expect(sortFolders(unsorted).map((f) => f.id)).toEqual(["f_root", "f_sibling"]);
  });

  it("breaks ties alphabetically by name", () => {
    const a = folder({ id: "f_a", name: "Beta", sort_order: 0 });
    const b = folder({ id: "f_b", name: "Alpha", sort_order: 0 });
    expect(sortFolders([a, b]).map((f) => f.id)).toEqual(["f_b", "f_a"]);
  });

  it("does not mutate the input array", () => {
    const input = [sibling, root];
    const copy = [...input];
    sortFolders(input);
    expect(input).toEqual(copy);
  });
});
