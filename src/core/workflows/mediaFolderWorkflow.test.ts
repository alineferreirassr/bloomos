import { describe, expect, it } from "vitest";
import { wouldCreateFolderCycle, canMoveFolder, getFolderPath, getFolderChildren, getFolderDescendants, sortFolders } from "@/core/workflows/mediaFolderWorkflow";
import type { MediaFolder } from "@/types/mediaFolder";

function makeFolder(overrides: Partial<MediaFolder> & Pick<MediaFolder, "id">): MediaFolder {
  return {
    workspace_id: "ws_1",
    owner_type: null,
    owner_id: null,
    parent_folder_id: null,
    name: overrides.id,
    sort_order: 0,
    created_by: "member_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}

describe("wouldCreateFolderCycle", () => {
  it("allows moving to root", () => {
    expect(wouldCreateFolderCycle("f1", null, [])).toBe(false);
  });

  it("rejects a folder becoming its own parent", () => {
    expect(wouldCreateFolderCycle("f1", "f1", [])).toBe(true);
  });

  it("rejects a transitive cycle (moving a folder under its own descendant)", () => {
    const folders = [makeFolder({ id: "f1", parent_folder_id: null }), makeFolder({ id: "f2", parent_folder_id: "f1" }), makeFolder({ id: "f3", parent_folder_id: "f2" })];
    expect(wouldCreateFolderCycle("f1", "f3", folders)).toBe(true);
  });

  it("allows moving to an unrelated folder", () => {
    const folders = [makeFolder({ id: "f1" }), makeFolder({ id: "f2" })];
    expect(wouldCreateFolderCycle("f1", "f2", folders)).toBe(false);
  });
});

describe("canMoveFolder", () => {
  it("refuses a target that doesn't exist", () => {
    const folder = makeFolder({ id: "f1" });
    const check = canMoveFolder(folder, "missing", [folder]);
    expect(check.allowed).toBe(false);
  });

  it("refuses moving across owners", () => {
    const folder = makeFolder({ id: "f1", owner_type: "event", owner_id: "event_1" });
    const target = makeFolder({ id: "f2", owner_type: "event", owner_id: "event_2" });
    const check = canMoveFolder(folder, "f2", [folder, target]);
    expect(check.allowed).toBe(false);
  });

  it("allows moving within the same owner", () => {
    const folder = makeFolder({ id: "f1", owner_type: "event", owner_id: "event_1" });
    const target = makeFolder({ id: "f2", owner_type: "event", owner_id: "event_1" });
    const check = canMoveFolder(folder, "f2", [folder, target]);
    expect(check.allowed).toBe(true);
  });

  it("refuses a move that would create a cycle", () => {
    const folders = [makeFolder({ id: "f1" }), makeFolder({ id: "f2", parent_folder_id: "f1" })];
    const check = canMoveFolder(folders[0], "f2", folders);
    expect(check.allowed).toBe(false);
  });
});

describe("getFolderPath / getFolderChildren / getFolderDescendants", () => {
  const folders = [
    makeFolder({ id: "root", parent_folder_id: null }),
    makeFolder({ id: "child", parent_folder_id: "root" }),
    makeFolder({ id: "grandchild", parent_folder_id: "child" }),
  ];

  it("builds the root-to-leaf path", () => {
    const path = getFolderPath("grandchild", folders);
    expect(path.map((f) => f.id)).toEqual(["root", "child", "grandchild"]);
  });

  it("returns direct children only", () => {
    expect(getFolderChildren("root", folders).map((f) => f.id)).toEqual(["child"]);
  });

  it("returns every descendant at any depth", () => {
    expect(getFolderDescendants("root", folders).map((f) => f.id)).toEqual(["child", "grandchild"]);
  });
});

describe("sortFolders", () => {
  it("sorts by sort_order then name, without mutating the input", () => {
    const folders = [makeFolder({ id: "b", name: "B", sort_order: 1 }), makeFolder({ id: "a", name: "A", sort_order: 0 }), makeFolder({ id: "c", name: "C", sort_order: 1 })];
    const sorted = sortFolders(folders);
    expect(sorted.map((f) => f.id)).toEqual(["a", "b", "c"]);
    expect(folders.map((f) => f.id)).toEqual(["b", "a", "c"]);
  });
});
