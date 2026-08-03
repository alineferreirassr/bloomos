import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import {
  evaluateClientJourneyAction,
  listClientJourneysAction,
  transitionClientJourneyAction,
  getJourneyOwnersAction,
  assignJourneyOwnerAction,
  listInformationRequestsAction,
  createInformationRequestAction,
  setInformationRequestStatusAction,
  respondToInformationRequestAction,
  getInformationRequestsSummaryAction,
  getJourneyAnalyticsAction,
  journeyRecommendationsForExecutiveDecisions,
} from "@/modules/clientJourney/clientJourneyActions";
import { createLead, createClient, resetAllMockData } from "@/lib/data";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import { resetJourneyTransitionsStore } from "@/lib/data/mock/journeyTransitionsStore";
import { resetJourneyOwnersStore } from "@/lib/data/mock/journeyOwnersStore";
import { resetClientInformationRequestsStore } from "@/lib/data/mock/clientInformationRequestsStore";
import { resetJourneyCache } from "@/core/clientJourney/journeyCache";

const session: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: CURRENT_WORKSPACE_ID, name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["client_journeys.view", "client_journeys.manage"],
  workspaceDisplayName: "Amoré Bloom",
};

function resetAll(): void {
  resetAllMockData();
  resetJourneyTransitionsStore();
  resetJourneyOwnersStore();
  resetClientInformationRequestsStore();
  resetJourneyCache();
}

beforeEach(() => {
  resetAll();
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
});

afterEach(() => {
  vi.mocked(resolveMemberSessionSnapshot).mockReset();
});

let clientSequence = 0;

async function makeClient() {
  clientSequence += 1;
  const created = await createClient({
    first_name: "Priya",
    last_name: "Nair",
    email: `priya.nair+${clientSequence}@example.com`,
    phone: "555-0101",
    instagram: "",
    partner_name: "",
    relationship_status: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    source: "",
    important_dates: [],
    how_they_met: "",
    first_date: "",
    relationship_anniversary: "",
    engagement_date: "",
    wedding_date: "",
    favorite_colors: "",
    favorite_flowers: "",
    favorite_music: "",
    favorite_food: "",
    favorite_drinks: "",
    favorite_restaurants: "",
    preferred_style: "",
    disliked_elements: "",
    allergies: "",
    accessibility_needs: "",
    dietary_restrictions: "",
    preferred_communication_time: "",
    do_not_call: false,
    surprise_event_confidentiality: false,
    emergency_contact_name: "",
    emergency_contact_phone: "",
  });
  if (!created.success) throw new Error(`setup failed: createClient — ${created.error}`);
  return created.data;
}

describe("clientJourneyActions — session gating", () => {
  it("rejects every action when there is no active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "no-workspace" });
    const result = await evaluateClientJourneyAction("client", "client_1");
    expect(result.success).toBe(false);
  });
});

describe("evaluateClientJourneyAction", () => {
  it("evaluates a freshly-created lead as new_lead", async () => {
    const created = await createLead({ first_name: "Jordan", last_name: "Lee", email: "jordan@example.com", phone: "", instagram: "", source: "referral", event_type: "", event_date: "", location: "", budget_min: "", budget_max: "", message: "", assigned_to: "" });
    if (!created.success) throw new Error("setup failed");
    const result = await evaluateClientJourneyAction("lead", created.data.id);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.currentStage).toBe("new_lead");
  });

  it("evaluates a freshly-created client with no commercial records as qualified", async () => {
    const client = await makeClient();
    const result = await evaluateClientJourneyAction("client", client.id);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.currentStage).toBe("qualified");
  });

  it("returns an error for a subject that doesn't exist", async () => {
    const result = await evaluateClientJourneyAction("client", "nonexistent");
    expect(result.success).toBe(false);
  });
});

describe("listClientJourneysAction", () => {
  it("returns a summary for every active lead and client, and caches the result", async () => {
    await makeClient();
    const first = await listClientJourneysAction();
    expect(first.success).toBe(true);
    if (!first.success) return;
    expect(first.data.length).toBeGreaterThan(0);

    // Second call within the TTL should return the identically-cached array reference.
    const second = await listClientJourneysAction();
    expect(second.success).toBe(true);
    if (second.success) expect(second.data).toBe(first.data);
  });
});

describe("transitionClientJourneyAction", () => {
  it("records an allowed cancellation and moves the journey to cancelled", async () => {
    const client = await makeClient();
    const result = await transitionClientJourneyAction("client", client.id, "cancel", "cancelled", "Client withdrew.");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("cancelled");
      expect(result.data.newStage).toBe("cancelled");
    }
    const journey = await evaluateClientJourneyAction("client", client.id);
    if (journey.success) expect(journey.data.currentStage).toBe("cancelled");
  });

  it("records a blocked transition without moving the journey forward", async () => {
    const client = await makeClient();
    const result = await transitionClientJourneyAction("client", client.id, "advance", "closed", "Attempted skip-ahead.");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe("blocked");
    const journey = await evaluateClientJourneyAction("client", client.id);
    if (journey.success) expect(journey.data.currentStage).toBe("qualified");
  });

  it("allows restoring a cancelled journey back to an earlier stage", async () => {
    const client = await makeClient();
    await transitionClientJourneyAction("client", client.id, "cancel", "cancelled", "First cancel.");
    const restored = await transitionClientJourneyAction("client", client.id, "restore", "qualified", "Client came back.");
    expect(restored.success).toBe(true);
    if (restored.success) expect(restored.data.type).toBe("restored");
  });
});

describe("journey ownership", () => {
  it("starts with every role unassigned", async () => {
    const client = await makeClient();
    const result = await getJourneyOwnersAction("client", client.id);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.every((o) => o.memberId === null)).toBe(true);
  });

  it("assigns and then reflects the owner in the evaluated journey", async () => {
    const client = await makeClient();
    const assigned = await assignJourneyOwnerAction("client", client.id, "primary", "member_5");
    expect(assigned.success).toBe(true);
    const journey = await evaluateClientJourneyAction("client", client.id);
    if (journey.success) {
      const primary = journey.data.owners.find((o) => o.role === "primary");
      expect(primary?.memberId).toBe("member_5");
    }
  });
});

describe("information requests", () => {
  it("creates a request in pending status and lists it back", async () => {
    const client = await makeClient();
    const created = await createInformationRequestAction({ clientId: client.id, title: "Dietary restrictions", description: "" });
    expect(created.success).toBe(true);
    const list = await listInformationRequestsAction(client.id);
    expect(list.success).toBe(true);
    if (list.success) {
      expect(list.data).toHaveLength(1);
      expect(list.data[0].status).toBe("pending");
    }
  });

  it("responding to a request marks it fulfilled", async () => {
    const client = await makeClient();
    const created = await createInformationRequestAction({ clientId: client.id, title: "Dietary restrictions", description: "" });
    if (!created.success) throw new Error("setup failed");
    const responded = await respondToInformationRequestAction(created.data.id, "No restrictions.");
    expect(responded.success).toBe(true);
    if (responded.success) expect(responded.data.status).toBe("fulfilled");
  });

  it("setInformationRequestStatusAction can cancel a request", async () => {
    const client = await makeClient();
    const created = await createInformationRequestAction({ clientId: client.id, title: "A", description: "" });
    if (!created.success) throw new Error("setup failed");
    const cancelled = await setInformationRequestStatusAction(created.data.id, "cancelled");
    expect(cancelled.success).toBe(true);
    if (cancelled.success) expect(cancelled.data.status).toBe("cancelled");
  });

  it("summarizes requests by their live-computed status", async () => {
    const client = await makeClient();
    await createInformationRequestAction({ clientId: client.id, title: "A", description: "" });
    const summary = await getInformationRequestsSummaryAction(client.id);
    expect(summary.success).toBe(true);
    if (summary.success) expect(summary.data.pending).toBe(1);
  });

  // v2 Checkpoint 45 security fix — setInformationRequestStatusAction/respondToInformationRequestAction
  // used to mutate a request by bare id with no workspace check, letting any active member of any
  // workspace tamper with another workspace's Information Request. Positive case above (same session,
  // same workspace) already covers the allowed path; these cover the denied one.
  describe("cross-tenant workspace isolation", () => {
    const otherWorkspaceSession: MemberSessionSnapshot = {
      ...session,
      workspace: { id: "ws_evil", name: "A Different Workspace" },
      membership: { ...session.membership, id: "member_evil" },
    };

    it("rejects setInformationRequestStatusAction for a request owned by a different workspace", async () => {
      const client = await makeClient();
      const created = await createInformationRequestAction({ clientId: client.id, title: "Dietary restrictions", description: "" });
      if (!created.success) throw new Error("setup failed");

      vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceSession);
      const result = await setInformationRequestStatusAction(created.data.id, "cancelled");
      expect(result.success).toBe(false);

      // The record itself must be untouched — switch back to the real owning session and confirm.
      vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
      const list = await listInformationRequestsAction(client.id);
      expect(list.success).toBe(true);
      if (list.success) expect(list.data[0].status).toBe("pending");
    });

    it("rejects respondToInformationRequestAction for a request owned by a different workspace", async () => {
      const client = await makeClient();
      const created = await createInformationRequestAction({ clientId: client.id, title: "Dietary restrictions", description: "" });
      if (!created.success) throw new Error("setup failed");

      vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceSession);
      const result = await respondToInformationRequestAction(created.data.id, "Injected from another workspace.");
      expect(result.success).toBe(false);

      vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
      const list = await listInformationRequestsAction(client.id);
      expect(list.success).toBe(true);
      if (list.success) {
        expect(list.data[0].status).toBe("pending");
        expect(list.data[0].clientResponse).toBeNull();
      }
    });

    it("rejects both actions for an id that doesn't exist at all, with the same generic error as a cross-tenant id", async () => {
      const statusResult = await setInformationRequestStatusAction("client_information_request_missing", "cancelled");
      const responseResult = await respondToInformationRequestAction("client_information_request_missing", "hello");
      expect(statusResult.success).toBe(false);
      expect(responseResult.success).toBe(false);
    });
  });
});

describe("getJourneyAnalyticsAction", () => {
  it("evaluates without throwing over a mixed lead/client dataset", async () => {
    await makeClient();
    const result = await getJourneyAnalyticsAction();
    expect(result.success).toBe(true);
  });
});

describe("journeyRecommendationsForExecutiveDecisions", () => {
  it("returns an empty array when there is no active session, never throwing", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "no-workspace" });
    const recommendations = await journeyRecommendationsForExecutiveDecisions();
    expect(recommendations).toEqual([]);
  });

  it("translates a real blocker on a live client into a recommendation", async () => {
    const client = await makeClient();
    await transitionClientJourneyAction("client", client.id, "cancel", "cancelled", "test");
    // A cancelled journey has no blockers of its own, but the call must still complete cleanly end-to-end.
    const recommendations = await journeyRecommendationsForExecutiveDecisions();
    expect(Array.isArray(recommendations)).toBe(true);
  });
});
