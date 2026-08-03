import { beforeEach, describe, expect, it } from "vitest";
import {
  archiveContract,
  cancelContract,
  completeContract,
  createContract,
  createContractNote,
  duplicateContract,
  expireContract,
  getContract,
  getContractExhibitsByContractId,
  getContractNextAction,
  getContractTemplateById,
  getContractTemplates,
  getContracts,
  getDashboardMetrics,
  getNotesByContractId,
  getTimelineByContractId,
  markDeclined,
  markSigned,
  markViewed,
  resetAllMockData,
  restoreContract,
  sendContract,
  updateContract,
  updateContractStatus,
} from "@/lib/data";
import type { ContractInput } from "@/modules/contracts/schema";

const validContractInput: ContractInput = {
  client_id: "client_1",
  event_id: null,
  template_id: null,
  title: "Test Contract",
  description: null,
  effective_date: null,
  expiration_date: null,
  total_value: 1000,
  deposit_required: true,
  deposit_amount: 250,
  currency: "USD",
  notes: null,
};

beforeEach(() => {
  resetAllMockData();
});

describe("mock data", () => {
  it("seeds at least one Contract for every status value", async () => {
    const all = await getContracts({ includeArchived: true });
    const statuses = new Set(all.map((c) => c.status));
    for (const status of [
      "draft",
      "review",
      "ready",
      "sent",
      "viewed",
      "signed",
      "completed",
      "expired",
      "cancelled",
      "archived",
      "declined",
    ] as const) {
      expect(statuses.has(status)).toBe(true);
    }
  });

  it("seeds every contract_number uniquely", async () => {
    const all = await getContracts({ includeArchived: true });
    const numbers = all.map((c) => c.contract_number);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("seeds contracts covering the required categories (Proposal, Luxury Picnic, Hotel Decoration, Birthday, Engagement, Wedding)", async () => {
    const all = await getContracts({ includeArchived: true });
    const titles = all.map((c) => c.title.toLowerCase()).join(" | ");
    expect(titles).toContain("proposal");
    expect(titles).toContain("picnic");
    expect(titles).toContain("hotel");
    expect(titles).toContain("birthday");
    expect(titles).toContain("engagement");
    expect(titles).toContain("wedding");
  });

  it("seeds at least two active Contract Templates and one inactive one", async () => {
    const active = await getContractTemplates({ activeOnly: true });
    const all = await getContractTemplates();
    expect(active.length).toBeGreaterThanOrEqual(2);
    expect(all.length).toBeGreaterThan(active.length);
  });

  it("seeds exhibits attached to at least one contract", async () => {
    const exhibits = await getContractExhibitsByContractId("contract_1");
    expect(exhibits.length).toBeGreaterThan(0);
    expect(exhibits[0].display_order).toBe(0);
  });
});

describe("getContracts filtering", () => {
  it("excludes archived contracts by default", async () => {
    const results = await getContracts();
    expect(results.some((c) => c.status === "archived")).toBe(false);
  });

  it("includes archived contracts when requested", async () => {
    const results = await getContracts({ includeArchived: true });
    expect(results.some((c) => c.status === "archived")).toBe(true);
  });

  it("filters by status", async () => {
    const results = await getContracts({ status: "signed" });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((c) => c.status === "signed")).toBe(true);
  });

  it("filters by clientId", async () => {
    const results = await getContracts({ clientId: "client_1" });
    expect(results.every((c) => c.client_id === "client_1")).toBe(true);
  });

  it("filters by eventId", async () => {
    const results = await getContracts({ eventId: "event_1" });
    expect(results.every((c) => c.event_id === "event_1")).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it("searches by contract_number, title, and client name", async () => {
    const byNumber = await getContracts({ search: "CT-2026-0001" });
    expect(byNumber.map((c) => c.id)).toContain("contract_1");

    const byTitle = await getContracts({ search: "Malibu Sunset" });
    expect(byTitle.map((c) => c.id)).toContain("contract_1");

    const byClientName = await getContracts({ search: "Jordan Ellis" });
    expect(byClientName.map((c) => c.id)).toContain("contract_1");
  });
});

describe("getContract", () => {
  it("throws NotFoundError for a missing contract", async () => {
    await expect(getContract("does_not_exist")).rejects.toThrow();
  });

  it("returns the matching contract", async () => {
    const contract = await getContract("contract_1");
    expect(contract.contract_number).toBe("CT-2026-0001");
  });
});

describe("createContract", () => {
  it("creates a contract in draft/unsigned state with a derived workspace_id and a unique contract_number", async () => {
    const result = await createContract(validContractInput);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("draft");
    expect(result.data.signature_status).toBe("unsigned");
    expect(result.data.version).toBe(1);
    expect(result.data.version_history).toEqual([]);
    expect(result.data.workspace_id).toBe("ws_amore_bloom");
    expect(result.data.contract_number).toMatch(/^CT-\d{4}-\d{4}$/);
  });

  it("computes remaining_balance from total_value and deposit_amount", async () => {
    const result = await createContract(validContractInput);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.remaining_balance).toBe(1000 - 250);
  });

  it("fails validation for a missing title", async () => {
    const result = await createContract({ ...validContractInput, title: "" });
    expect(result.success).toBe(false);
  });

  it("fails for an unknown client_id", async () => {
    const result = await createContract({ ...validContractInput, client_id: "does_not_exist" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors?.client_id).toBeDefined();
  });

  it("fails for an unknown event_id", async () => {
    const result = await createContract({ ...validContractInput, event_id: "does_not_exist" });
    expect(result.success).toBe(false);
  });

  it("fails when the event belongs to a different client", async () => {
    // event_1 belongs to client_2, not client_1
    const result = await createContract({ ...validContractInput, client_id: "client_1", event_id: "event_1" });
    expect(result.success).toBe(false);
  });

  it("fails for an unknown template_id", async () => {
    const result = await createContract({ ...validContractInput, template_id: "does_not_exist" });
    expect(result.success).toBe(false);
  });

  it("succeeds when event_id belongs to the same client", async () => {
    const result = await createContract({ ...validContractInput, client_id: "client_2", event_id: "event_1" });
    expect(result.success).toBe(true);
  });

  it("records a contract_created timeline activity", async () => {
    const created = await createContract(validContractInput);
    expect(created.success).toBe(true);
    if (!created.success) return;
    const timeline = await getTimelineByContractId(created.data.id);
    expect(timeline.some((t) => t.type === "contract_created")).toBe(true);
  });

  it("never generates a colliding contract_number across many creations (duplicate prevention)", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => createContract(validContractInput)),
    );
    const numbers = results.map((r) => (r.success ? r.data.contract_number : null));
    expect(numbers.every((n) => n !== null)).toBe(true);
    expect(new Set(numbers).size).toBe(numbers.length);
  });
});

describe("updateContract", () => {
  it("fails for a missing contract", async () => {
    const result = await updateContract("does_not_exist", validContractInput);
    expect(result.success).toBe(false);
  });

  it("fails for an archived contract (read-only)", async () => {
    const result = await updateContract("contract_11", { ...validContractInput, client_id: "client_1" });
    expect(result.success).toBe(false);
  });

  it("fails if client_id is changed", async () => {
    const result = await updateContract("contract_2", { ...validContractInput, client_id: "client_1" });
    expect(result.success).toBe(false);
  });

  it("bumps version and appends a version_history snapshot of the prior state", async () => {
    const before = await getContract("contract_2");
    const result = await updateContract("contract_2", {
      ...validContractInput,
      client_id: before.client_id,
      title: "Updated Title",
      total_value: 2500,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.version).toBe(before.version + 1);
    expect(result.data.version_history.length).toBe(before.version_history.length + 1);
    const lastSnapshot = result.data.version_history[result.data.version_history.length - 1];
    expect(lastSnapshot.title).toBe(before.title);
    expect(lastSnapshot.total_value).toBe(before.total_value);
  });

  it("recomputes remaining_balance from the new total_value/deposit_amount", async () => {
    const before = await getContract("contract_2");
    const result = await updateContract("contract_2", {
      ...validContractInput,
      client_id: before.client_id,
      total_value: 4000,
      deposit_required: true,
      deposit_amount: 1000,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.remaining_balance).toBe(3000);
  });

  it("records a contract_updated timeline activity", async () => {
    const before = await getContract("contract_2");
    await updateContract("contract_2", { ...validContractInput, client_id: before.client_id, title: "New Title" });
    const timeline = await getTimelineByContractId("contract_2");
    expect(timeline.some((t) => t.type === "contract_updated")).toBe(true);
  });
});

describe("updateContractStatus", () => {
  it("allows draft -> review -> ready", async () => {
    const toReview = await updateContractStatus("contract_2", "review");
    expect(toReview.success).toBe(true);
    const toReady = await updateContractStatus("contract_2", "ready");
    expect(toReady.success).toBe(true);
    if (toReady.success) expect(toReady.data.status).toBe("ready");
  });

  it("rejects moving directly into a locked status", async () => {
    const result = await updateContractStatus("contract_2", "signed");
    expect(result.success).toBe(false);
  });

  it("rejects any transition once a contract is in a locked status", async () => {
    const result = await updateContractStatus("contract_1", "review"); // contract_1 is signed
    expect(result.success).toBe(false);
  });

  it("records a contract_updated timeline activity describing the status change", async () => {
    await updateContractStatus("contract_2", "review");
    const timeline = await getTimelineByContractId("contract_2");
    expect(timeline.some((t) => t.type === "contract_updated" && t.description.includes("Review"))).toBe(true);
  });
});

describe("signature workflow: sendContract / markViewed / markSigned / markDeclined / expireContract", () => {
  it("sendContract moves draft/review/ready to sent and stamps sent_at + signature_status", async () => {
    const result = await sendContract("contract_2");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("sent");
    expect(result.data.signature_status).toBe("sent");
    expect(result.data.sent_at).not.toBeNull();
  });

  it("sendContract rejects a contract that has already been sent", async () => {
    const result = await sendContract("contract_3"); // already viewed
    expect(result.success).toBe(false);
  });

  it("markViewed rejects a contract that hasn't been sent yet", async () => {
    const result = await markViewed("contract_2"); // still draft
    expect(result.success).toBe(false);
  });

  it("markViewed moves sent to viewed and stamps viewed_at", async () => {
    await sendContract("contract_2");
    const result = await markViewed("contract_2");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("viewed");
    expect(result.data.signature_status).toBe("viewed");
    expect(result.data.viewed_at).not.toBeNull();
  });

  it("markViewed is idempotent — re-marking an already-viewed contract keeps the original viewed_at", async () => {
    const first = await markViewed("contract_3"); // already viewed in seed data
    expect(first.success).toBe(true);
    if (!first.success) return;
    const original = first.data.viewed_at;
    const second = await markViewed("contract_3");
    expect(second.success).toBe(true);
    if (!second.success) return;
    expect(second.data.viewed_at).toBe(original);
  });

  it("markSigned rejects a contract that hasn't been sent", async () => {
    const result = await markSigned("contract_2"); // draft
    expect(result.success).toBe(false);
  });

  it("markSigned works from sent directly (no explicit view required)", async () => {
    await sendContract("contract_2");
    const result = await markSigned("contract_2");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("signed");
    expect(result.data.signature_status).toBe("signed");
    expect(result.data.signed_at).not.toBeNull();
  });

  it("markSigned works from viewed", async () => {
    const result = await markSigned("contract_3"); // already viewed
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("signed");
  });

  it("markDeclined rejects a contract that hasn't been sent", async () => {
    const result = await markDeclined("contract_2");
    expect(result.success).toBe(false);
  });

  it("markDeclined moves sent/viewed to declined and stamps declined_at", async () => {
    const result = await markDeclined("contract_3"); // viewed
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("declined");
    expect(result.data.signature_status).toBe("declined");
    expect(result.data.declined_at).not.toBeNull();
  });

  it("expireContract rejects a contract that hasn't been sent", async () => {
    const result = await expireContract("contract_2");
    expect(result.success).toBe(false);
  });

  it("expireContract moves sent/viewed to expired and records a contract_updated (not a dedicated) timeline entry", async () => {
    const result = await expireContract("contract_4"); // sent
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("expired");
    expect(result.data.signature_status).toBe("expired");
    const timeline = await getTimelineByContractId("contract_4");
    expect(timeline.some((t) => t.type === "contract_updated" && t.description.includes("expired"))).toBe(true);
  });

  it("records the correct dedicated timeline activity type for each transition", async () => {
    const sendResult = await sendContract("contract_2");
    expect(sendResult.success).toBe(true);
    const viewResult = await markViewed("contract_2");
    expect(viewResult.success).toBe(true);
    const signResult = await markSigned("contract_2");
    expect(signResult.success).toBe(true);

    const timeline = await getTimelineByContractId("contract_2");
    expect(timeline.some((t) => t.type === "contract_sent")).toBe(true);
    expect(timeline.some((t) => t.type === "contract_viewed")).toBe(true);
    expect(timeline.some((t) => t.type === "contract_signed")).toBe(true);
  });
});

describe("cancelContract", () => {
  it("allows cancelling from draft, review, ready, sent, viewed, or signed", async () => {
    for (const id of ["contract_2", "contract_3", "contract_5", "contract_6"]) {
      const before = await getContract(id);
      // reset store between checks isn't needed since each id is independent
      const result = await cancelContract(id);
      expect(result.success).toBe(true);
      if (!result.success) continue;
      expect(result.data.status).toBe("cancelled");
      expect(result.data.cancelled_at).not.toBeNull();
      expect(before.id).toBe(id);
    }
  });

  it("rejects cancelling an already-closed contract", async () => {
    const closedIds = ["contract_7", "contract_8", "contract_9", "contract_10", "contract_11"]; // completed, cancelled, declined, expired, archived
    for (const id of closedIds) {
      const result = await cancelContract(id);
      expect(result.success).toBe(false);
    }
  });

  it("records a contract_cancelled timeline activity", async () => {
    await cancelContract("contract_2");
    const timeline = await getTimelineByContractId("contract_2");
    expect(timeline.some((t) => t.type === "contract_cancelled")).toBe(true);
  });
});

describe("completeContract", () => {
  it("only allows completing a signed contract", async () => {
    const result = await completeContract("contract_2"); // draft
    expect(result.success).toBe(false);
  });

  it("moves signed to completed and records a contract_completed timeline activity", async () => {
    await sendContract("contract_2");
    await markSigned("contract_2");
    const result = await completeContract("contract_2");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("completed");
    const timeline = await getTimelineByContractId("contract_2");
    expect(timeline.some((t) => t.type === "contract_completed")).toBe(true);
  });

  it("rejects completing an already-completed contract", async () => {
    const result = await completeContract("contract_7"); // seeded as completed
    expect(result.success).toBe(false);
  });
});

describe("archiveContract / restoreContract", () => {
  it("archives a contract and stamps archived_at", async () => {
    const result = await archiveContract("contract_2");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("archived");
    expect(result.data.archived_at).not.toBeNull();
  });

  it("rejects archiving an already-archived contract", async () => {
    const result = await archiveContract("contract_11");
    expect(result.success).toBe(false);
  });

  it("rejects restoring a contract that isn't archived", async () => {
    const result = await restoreContract("contract_2");
    expect(result.success).toBe(false);
  });

  it("restores an archived contract to draft and clears archived_at", async () => {
    const result = await restoreContract("contract_11");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("draft");
    expect(result.data.archived_at).toBeNull();
  });

  it("records contract_archived and contract_restored timeline activities", async () => {
    await archiveContract("contract_2");
    await restoreContract("contract_2");
    const timeline = await getTimelineByContractId("contract_2");
    expect(timeline.some((t) => t.type === "contract_archived")).toBe(true);
    expect(timeline.some((t) => t.type === "contract_restored")).toBe(true);
  });
});

describe("duplicateContract", () => {
  it("fails for a missing contract", async () => {
    const result = await duplicateContract("does_not_exist");
    expect(result.success).toBe(false);
  });

  it("creates a new draft/unsigned contract copying content but not lifecycle state", async () => {
    const original = await getContract("contract_1"); // signed
    const result = await duplicateContract("contract_1");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.id).not.toBe(original.id);
    expect(result.data.title).toBe(original.title);
    expect(result.data.client_id).toBe(original.client_id);
    expect(result.data.total_value).toBe(original.total_value);
    expect(result.data.status).toBe("draft");
    expect(result.data.signature_status).toBe("unsigned");
    expect(result.data.version).toBe(1);
    expect(result.data.version_history).toEqual([]);
    expect(result.data.signed_at).toBeNull();
    expect(result.data.sent_at).toBeNull();
  });

  it("gives the duplicate a contract_number distinct from the original (duplicate prevention)", async () => {
    const original = await getContract("contract_1");
    const result = await duplicateContract("contract_1");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.contract_number).not.toBe(original.contract_number);
  });

  it("records a contract_created timeline activity noting the duplication source", async () => {
    const result = await duplicateContract("contract_1");
    expect(result.success).toBe(true);
    if (!result.success) return;
    const timeline = await getTimelineByContractId(result.data.id);
    const createdEntry = timeline.find((t) => t.type === "contract_created");
    expect(createdEntry?.description).toContain("CT-2026-0001");
  });
});

describe("getContractNextAction", () => {
  it("mirrors getContractNextRecommendedAction for a draft contract", async () => {
    const action = await getContractNextAction("contract_2");
    expect(action).toBe("Complete the contract details and move it to review");
  });

  it("returns null for a closed contract", async () => {
    const action = await getContractNextAction("contract_7"); // completed
    expect(action).toBeNull();
  });
});

describe("Contract notes", () => {
  it("returns an empty list for a contract with no notes", async () => {
    const notes = await getNotesByContractId("contract_2");
    expect(notes).toEqual([]);
  });

  it("creates a note scoped to the contract's owner_type/owner_id and workspace", async () => {
    const result = await createContractNote("contract_2", {
      title: "Follow-up",
      content: "Called the client to confirm details.",
      category: "general",
      priority: "normal",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.owner_type).toBe("contract");
    expect(result.data.owner_id).toBe("contract_2");

    const notes = await getNotesByContractId("contract_2");
    expect(notes.map((n) => n.id)).toContain(result.data.id);
  });

  it("fails to create a note for a missing contract", async () => {
    const result = await createContractNote("does_not_exist", {
      title: "x",
      content: "y",
      category: "general",
      priority: "normal",
    });
    expect(result.success).toBe(false);
  });

  it("records a note_added timeline activity on the contract's own timeline", async () => {
    await createContractNote("contract_2", {
      title: "Follow-up",
      content: "Called the client.",
      category: "general",
      priority: "normal",
    });
    const timeline = await getTimelineByContractId("contract_2");
    expect(timeline.some((t) => t.type === "note_added")).toBe(true);
  });
});

describe("Contract timeline", () => {
  it("returns an empty list for a missing contract", async () => {
    const timeline = await getTimelineByContractId("does_not_exist");
    expect(timeline).toEqual([]);
  });

  it("is scoped per-contract and never leaks another contract's activity", async () => {
    await updateContractStatus("contract_2", "review");
    const timelineForContract2 = await getTimelineByContractId("contract_2");
    const timelineForContract3 = await getTimelineByContractId("contract_3");
    expect(timelineForContract2.some((t) => t.description.includes("Review"))).toBe(true);
    expect(timelineForContract3.some((t) => t.description.includes("Review"))).toBe(false);
  });
});

describe("Contract templates", () => {
  it("lists only active templates when activeOnly is set", async () => {
    const active = await getContractTemplates({ activeOnly: true });
    expect(active.every((t) => t.active)).toBe(true);
  });

  it("filters by category", async () => {
    const rentalTemplates = await getContractTemplates({ category: "rental_agreement" });
    expect(rentalTemplates.every((t) => t.category === "rental_agreement")).toBe(true);
    expect(rentalTemplates.length).toBeGreaterThan(0);
  });

  it("throws NotFoundError for a missing template", async () => {
    await expect(getContractTemplateById("does_not_exist")).rejects.toThrow();
  });

  it("returns the matching template", async () => {
    const template = await getContractTemplateById("template_1");
    expect(template.name).toBe("Standard Event Services Agreement");
  });
});

describe("Contract exhibits", () => {
  it("returns exhibits sorted by display_order", async () => {
    const exhibits = await getContractExhibitsByContractId("contract_1");
    const orders = exhibits.map((e) => e.display_order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it("returns an empty list for a contract with no exhibits", async () => {
    const exhibits = await getContractExhibitsByContractId("contract_2");
    expect(exhibits).toEqual([]);
  });
});

describe("Dashboard Contract metrics", () => {
  it("exposes every required Contract metric label", async () => {
    const metrics = await getDashboardMetrics();
    const requiredLabels = [
      "Total Contracts",
      "Draft Contracts",
      "Sent Contracts",
      "Viewed Contracts",
      "Signed Contracts",
      "Pending Signature",
      "Expired Contracts",
      "Cancelled Contracts",
      "Contract Value",
      "Deposit Pending",
      "Completed Value",
    ];
    for (const label of requiredLabels) {
      expect(metrics.some((m) => m.label === label)).toBe(true);
    }
  });

  it("Total Contracts reflects the full seeded set, including archived", async () => {
    const metrics = await getDashboardMetrics();
    const all = await getContracts({ includeArchived: true });
    const totalMetric = metrics.find((m) => m.label === "Total Contracts");
    expect(totalMetric?.value).toBe(String(all.length));
  });

  it("updates Signed Contracts and Draft Contracts after a status change", async () => {
    const before = await getDashboardMetrics();
    const draftBefore = Number(before.find((m) => m.label === "Draft Contracts")?.value);
    const signedBefore = Number(before.find((m) => m.label === "Signed Contracts")?.value);

    await sendContract("contract_2");
    await markSigned("contract_2");

    const after = await getDashboardMetrics();
    const draftAfter = Number(after.find((m) => m.label === "Draft Contracts")?.value);
    const signedAfter = Number(after.find((m) => m.label === "Signed Contracts")?.value);

    expect(draftAfter).toBe(draftBefore - 1);
    expect(signedAfter).toBe(signedBefore + 1);
  });
});

describe("full signature workflow, start to finish", () => {
  it("draft -> review -> ready -> sent -> viewed -> signed -> completed", async () => {
    const created = await createContract(validContractInput);
    expect(created.success).toBe(true);
    if (!created.success) return;
    const id = created.data.id;

    expect((await updateContractStatus(id, "review")).success).toBe(true);
    expect((await updateContractStatus(id, "ready")).success).toBe(true);
    expect((await sendContract(id)).success).toBe(true);
    expect((await markViewed(id)).success).toBe(true);
    expect((await markSigned(id)).success).toBe(true);
    const completed = await completeContract(id);
    expect(completed.success).toBe(true);
    if (!completed.success) return;

    expect(completed.data.status).toBe("completed");
    expect(completed.data.signature_status).toBe("signed");
    expect(completed.data.sent_at).not.toBeNull();
    expect(completed.data.viewed_at).not.toBeNull();
    expect(completed.data.signed_at).not.toBeNull();

    const timeline = await getTimelineByContractId(id);
    const types = timeline.map((t) => t.type);
    expect(types).toContain("contract_created");
    expect(types).toContain("contract_sent");
    expect(types).toContain("contract_viewed");
    expect(types).toContain("contract_signed");
    expect(types).toContain("contract_completed");
  });
});
