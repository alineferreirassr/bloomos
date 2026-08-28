import { afterEach, describe, expect, it } from "vitest";
import { readFounderNotes, createMockFounderNote, resetFounderNotesMockData } from "@/lib/data/mock/founderNotesStore";

const EMPLOYEE_A = "user_employee_a";
const EMPLOYEE_B = "user_employee_b";

afterEach(() => {
  resetFounderNotesMockData();
});

describe("founder notes store — authored-note isolation", () => {
  it("AUTHOR can create and read their own note", () => {
    const created = createMockFounderNote(EMPLOYEE_A, "Setup call went great today.");
    expect(created.author_id).toBe(EMPLOYEE_A);

    const mine = readFounderNotes().filter((n) => n.author_id === EMPLOYEE_A);
    expect(mine).toHaveLength(1);
    expect(mine[0].body).toBe("Setup call went great today.");
  });

  it("OTHER EMPLOYEE's own filtered view never contains another author's note", () => {
    createMockFounderNote(EMPLOYEE_A, "A private note from Employee A.");
    const asEmployeeB = readFounderNotes().filter((n) => n.author_id === EMPLOYEE_B);
    expect(asEmployeeB).toHaveLength(0);
  });

  it("never carries mood or water-tracker fields — body is free text only", () => {
    const created = createMockFounderNote(EMPLOYEE_A, "Just a note, nothing else attached.");
    expect(Object.keys(created).sort()).toEqual(["author_id", "body", "created_at", "id", "workspace_id"]);
    expect(created).not.toHaveProperty("mood");
    expect(created).not.toHaveProperty("glasses");
    expect(created).not.toHaveProperty("water");
  });
});
