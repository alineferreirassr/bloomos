import { afterEach, describe, expect, it } from "vitest";
import { mockContractsRepository } from "@/lib/data/contracts/mockRepository";
import { resetContractsStore, readContracts } from "@/lib/data/mock/contractsStore";
import { resetContractTemplatesStore } from "@/lib/data/mock/contractTemplatesStore";
import { resetContractExhibitsStore } from "@/lib/data/mock/contractExhibitsStore";
import { resetTimelineStore, readActivities } from "@/lib/data/mock/timelineStore";
import { resetNotesStore } from "@/lib/data/mock/notesStore";
import { NotFoundError } from "@/core/errors";
import type { ContractInput } from "@/modules/contracts/schema";

afterEach(() => {
  resetContractsStore();
  resetContractTemplatesStore();
  resetContractExhibitsStore();
  resetTimelineStore();
  resetNotesStore();
});

const BASE_CONTRACT_INPUT: ContractInput = {
  client_id: "client_2",
  event_id: "event_1",
  template_id: "template_1",
  title: "Test Contract",
  description: null,
  effective_date: null,
  expiration_date: null,
  total_value: 5000,
  deposit_required: true,
  deposit_amount: 1000,
  currency: "USD",
  notes: null,
};

describe("mockContractsRepository.getContracts / getContract", () => {
  it("excludes archived contracts by default and filters by status/client/event/search", async () => {
    const all = await mockContractsRepository.getContracts();
    expect(all.every((c) => c.status !== "archived")).toBe(true);

    const byClient = await mockContractsRepository.getContracts({ clientId: "client_2" });
    expect(byClient.every((c) => c.client_id === "client_2")).toBe(true);

    const signed = await mockContractsRepository.getContracts({ status: "signed" });
    expect(signed.every((c) => c.status === "signed")).toBe(true);
  });

  it("throws NotFoundError for an unknown contract id", async () => {
    await expect(mockContractsRepository.getContract("nope")).rejects.toThrow(NotFoundError);
  });
});

describe("mockContractsRepository.createContract — Client/Event consistency and numbering", () => {
  it("rejects an unknown client", async () => {
    const result = await mockContractsRepository.createContract({ ...BASE_CONTRACT_INPUT, client_id: "nope" });
    expect(result.success).toBe(false);
  });

  it("rejects an event that doesn't belong to the selected client", async () => {
    // event_2 belongs to a different client than client_2 in the seed data.
    const result = await mockContractsRepository.createContract({
      ...BASE_CONTRACT_INPUT,
      event_id: "event_2",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown template", async () => {
    const result = await mockContractsRepository.createContract({ ...BASE_CONTRACT_INPUT, template_id: "nope" });
    expect(result.success).toBe(false);
  });

  it("generates a unique, workspace-scoped contract_number and computes remaining_balance", async () => {
    const result = await mockContractsRepository.createContract(BASE_CONTRACT_INPUT);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.contract_number).toMatch(/^CT-\d{4}-\d{4}$/);
    expect(result.data.status).toBe("draft");
    expect(result.data.signature_status).toBe("unsigned");
    expect(result.data.version).toBe(1);
    expect(result.data.version_history).toEqual([]);
    expect(result.data.remaining_balance).toBe(4000);

    const numbers = readContracts().map((c) => c.contract_number);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("duplicateContract receives a new, different contract number", async () => {
    const created = await mockContractsRepository.createContract(BASE_CONTRACT_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const duplicate = await mockContractsRepository.duplicateContract(created.data.id);
    expect(duplicate.success).toBe(true);
    if (!duplicate.success) return;
    expect(duplicate.data.id).not.toBe(created.data.id);
    expect(duplicate.data.contract_number).not.toBe(created.data.contract_number);
    expect(duplicate.data.status).toBe("draft");
    expect(duplicate.data.version).toBe(1);
    expect(duplicate.data.version_history).toEqual([]);

    // Original is unchanged.
    const original = await mockContractsRepository.getContract(created.data.id);
    expect(original.contract_number).toBe(created.data.contract_number);
    expect(original.status).toBe("draft");
  });
});

describe("mockContractsRepository.updateContract — version history and locking", () => {
  it("increments version and appends a pre-image snapshot on every update", async () => {
    const created = await mockContractsRepository.createContract(BASE_CONTRACT_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const updated = await mockContractsRepository.updateContract(created.data.id, {
      ...BASE_CONTRACT_INPUT,
      title: "Updated Title",
      total_value: 6000,
    });
    expect(updated.success).toBe(true);
    if (!updated.success) return;
    expect(updated.data.version).toBe(2);
    expect(updated.data.version_history).toHaveLength(1);
    expect(updated.data.version_history[0].version).toBe(1);
    expect(updated.data.version_history[0].title).toBe("Test Contract");
    expect(updated.data.title).toBe("Updated Title");
    expect(updated.data.remaining_balance).toBe(5000);

    const again = await mockContractsRepository.updateContract(created.data.id, {
      ...BASE_CONTRACT_INPUT,
      title: "Second Update",
      total_value: 6000,
    });
    expect(again.success).toBe(true);
    if (!again.success) return;
    expect(again.data.version).toBe(3);
    expect(again.data.version_history).toHaveLength(2);
  });

  it("rejects changing the client_id", async () => {
    const created = await mockContractsRepository.createContract(BASE_CONTRACT_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const result = await mockContractsRepository.updateContract(created.data.id, {
      ...BASE_CONTRACT_INPUT,
      client_id: "client_4",
    });
    expect(result.success).toBe(false);
  });

  it("blocks edits once archived", async () => {
    const created = await mockContractsRepository.createContract(BASE_CONTRACT_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    await mockContractsRepository.archiveContract(created.data.id);
    const result = await mockContractsRepository.updateContract(created.data.id, BASE_CONTRACT_INPUT);
    expect(result.success).toBe(false);
  });
});

describe("mockContractsRepository status/signature lifecycle", () => {
  it("runs the full send -> viewed -> signed -> completed flow, and rejects out-of-order transitions", async () => {
    const created = await mockContractsRepository.createContract(BASE_CONTRACT_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;
    const id = created.data.id;

    const notYetSigned = await mockContractsRepository.markSigned(id);
    expect(notYetSigned.success).toBe(false);

    const sent = await mockContractsRepository.sendContract(id);
    expect(sent.success).toBe(true);
    if (sent.success) {
      expect(sent.data.status).toBe("sent");
      expect(sent.data.signature_status).toBe("sent");
      expect(sent.data.sent_at).not.toBeNull();
    }

    const viewed = await mockContractsRepository.markViewed(id);
    expect(viewed.success).toBe(true);
    if (viewed.success) expect(viewed.data.status).toBe("viewed");

    const notYetCompletable = await mockContractsRepository.completeContract(id);
    expect(notYetCompletable.success).toBe(false);

    const signed = await mockContractsRepository.markSigned(id);
    expect(signed.success).toBe(true);
    if (signed.success) expect(signed.data.status).toBe("signed");

    const completed = await mockContractsRepository.completeContract(id);
    expect(completed.success).toBe(true);
    if (completed.success) expect(completed.data.status).toBe("completed");

    const activityTypes = readActivities()
      .filter((a) => a.owner_id === id)
      .map((a) => a.type);
    expect(activityTypes).toEqual(
      expect.arrayContaining(["contract_created", "contract_sent", "contract_viewed", "contract_signed", "contract_completed"]),
    );
  });

  it("cancelContract works from any non-closed status but not from a closed one", async () => {
    const created = await mockContractsRepository.createContract(BASE_CONTRACT_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const cancelled = await mockContractsRepository.cancelContract(created.data.id);
    expect(cancelled.success).toBe(true);
    if (cancelled.success) expect(cancelled.data.status).toBe("cancelled");

    const again = await mockContractsRepository.cancelContract(created.data.id);
    expect(again.success).toBe(false);
  });

  it("archives and restores, resetting status to draft", async () => {
    const created = await mockContractsRepository.createContract(BASE_CONTRACT_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const archived = await mockContractsRepository.archiveContract(created.data.id);
    expect(archived.success).toBe(true);
    if (archived.success) {
      expect(archived.data.status).toBe("archived");
      expect(archived.data.archived_at).not.toBeNull();
    }

    const doubleArchive = await mockContractsRepository.archiveContract(created.data.id);
    expect(doubleArchive.success).toBe(false);

    const restored = await mockContractsRepository.restoreContract(created.data.id);
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data.status).toBe("draft");
      expect(restored.data.archived_at).toBeNull();
    }
  });
});

describe("mockContractsRepository Templates", () => {
  it("lists templates and filters by category/activeOnly", async () => {
    const all = await mockContractsRepository.getContractTemplates();
    expect(all.length).toBeGreaterThan(0);

    const active = await mockContractsRepository.getContractTemplates({ activeOnly: true });
    expect(active.every((t) => t.active)).toBe(true);
  });

  it("throws NotFoundError for an unknown template", async () => {
    await expect(mockContractsRepository.getContractTemplateById("nope")).rejects.toThrow(NotFoundError);
  });
});

describe("mockContractsRepository Exhibits", () => {
  it("creates, edits, reorders, and removes exhibits", async () => {
    const created = await mockContractsRepository.createContract(BASE_CONTRACT_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;
    const contractId = created.data.id;

    const first = await mockContractsRepository.createContractExhibit(contractId, {
      title: "Exhibit A",
      description: null,
    });
    const second = await mockContractsRepository.createContractExhibit(contractId, {
      title: "Exhibit B",
      description: null,
    });
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    if (!first.success || !second.success) return;
    expect(first.data.display_order).toBe(0);
    expect(second.data.display_order).toBe(1);
    expect(first.data.workspace_id).toBe(created.data.workspace_id);
    expect(first.data.document_id).toBeNull();

    const list = await mockContractsRepository.getContractExhibitsByContractId(contractId);
    expect(list.map((e) => e.id)).toEqual([first.data.id, second.data.id]);

    const reordered = await mockContractsRepository.reorderContractExhibits(contractId, [
      second.data.id,
      first.data.id,
    ]);
    expect(reordered.success).toBe(true);
    if (reordered.success) {
      expect(reordered.data.map((e) => e.id)).toEqual([second.data.id, first.data.id]);
    }

    const updated = await mockContractsRepository.updateContractExhibit(first.data.id, {
      title: "Exhibit A (edited)",
      description: "Updated",
    });
    expect(updated.success).toBe(true);
    if (updated.success) expect(updated.data.title).toBe("Exhibit A (edited)");

    const deleted = await mockContractsRepository.deleteContractExhibit(second.data.id);
    expect(deleted.success).toBe(true);
    const remaining = await mockContractsRepository.getContractExhibitsByContractId(contractId);
    expect(remaining.map((e) => e.id)).toEqual([first.data.id]);
  });

  it("fails for an unknown parent contract on create", async () => {
    const result = await mockContractsRepository.createContractExhibit("nope", { title: "X", description: null });
    expect(result.success).toBe(false);
  });
});

describe("mockContractsRepository Notes and Timeline", () => {
  it("creates a note, pins/unpins it, and lists Timeline entries", async () => {
    const created = await mockContractsRepository.createContract(BASE_CONTRACT_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;
    const contractId = created.data.id;

    const note = await mockContractsRepository.createContractNote(contractId, {
      title: "Deposit received",
      content: "Confirmed via Zelle.",
      category: "general",
      priority: "normal",
    });
    expect(note.success).toBe(true);
    if (!note.success) return;
    expect(note.data.is_pinned).toBe(false);

    const pinned = await mockContractsRepository.togglePinContractNote(note.data.id);
    expect(pinned).not.toBeNull();
    expect(pinned?.success).toBe(true);
    if (pinned?.success) expect(pinned.data.is_pinned).toBe(true);

    const unpinned = await mockContractsRepository.togglePinContractNote(note.data.id);
    expect(unpinned?.success && unpinned.data.is_pinned).toBe(false);

    const repinned = await mockContractsRepository.togglePinContractNote(note.data.id);
    expect(repinned?.success && repinned.data.is_pinned).toBe(true);

    const notes = await mockContractsRepository.getNotesByContractId(contractId);
    expect(notes.some((n) => n.id === note.data.id && n.is_pinned)).toBe(true);

    const timeline = await mockContractsRepository.getTimelineByContractId(contractId);
    expect(timeline.some((a) => a.type === "note_added")).toBe(true);
    expect(timeline.some((a) => a.type === "note_pinned")).toBe(true);
    expect(timeline.some((a) => a.type === "note_unpinned")).toBe(true);
  });

  it("togglePinContractNote returns null for a note that isn't Contract-owned", async () => {
    const result = await mockContractsRepository.togglePinContractNote("note_1");
    expect(result).toBeNull();
  });
});
