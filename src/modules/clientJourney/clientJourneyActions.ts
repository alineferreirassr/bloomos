"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { nowIso } from "@/lib/data/utils";

import { getLeadById, getLeads, getClientById, getClients, getEvents, getContracts, getInvoices, getPayments, getClientAccountsByClientId, getClientFinancialSummary } from "@/lib/data";
import { getProposalsRepository } from "@/lib/data/proposals";
import { getEntityTimelineData } from "@/modules/communication/timeline/getEntityTimelineData";
import { listOperationalPlansAction, evaluateOperationalPlanAction } from "@/modules/operationalPlanning/operationalPlanningActions";
import { listExecutionPackagesAction } from "@/modules/executionPackage/executionPackageActions";

import { getCoreJourneyTransitionsService, getCoreJourneyOwnersService, getCoreClientInformationRequestsService } from "@/core/clientJourney";
import { resolveClientJourneyState, mostRecentEvent, latestProposal, acceptedProposal, primaryContract, primaryInvoice, hasSucceededDepositPayment, activePortalAccount, type JourneyStateSourceData } from "@/core/clientJourney/journeyStateResolver";
import { evaluateTransitionRequest, type TransitionRequestKind } from "@/core/clientJourney/journeyTransitionEngine";
import { evaluateStageRequirements, type RequirementsSourceData } from "@/core/clientJourney/journeyRequirementsEngine";
import { detectJourneyBlockers, type BlockerSourceData } from "@/core/clientJourney/journeyBlockerEngine";
import { computeJourneyProgress, computeJourneyMilestones, withBlockedStages } from "@/core/clientJourney/journeyProgressEngine";
import { computeJourneyHealth } from "@/core/clientJourney/journeyHealthEngine";
import { generateNextBestActions } from "@/core/clientJourney/nextBestActionEngine";
import { detectJourneyRisks, type RiskSourceData } from "@/core/clientJourney/journeyRiskEngine";
import { computeJourneyAnalytics, type JourneyAnalyticsInput } from "@/core/clientJourney/journeyAnalyticsEngine";
import { mergeJourneyTimeline } from "@/core/clientJourney/journeyTimelineAdapter";
import { computeJourneyContext } from "@/core/clientJourney/journeyContextEngine";
import { journeyBlockersToRecommendations, journeyRisksToRecommendations } from "@/core/clientJourney/journeyExecutiveIntegration";
import { isRequestOverdue, summarizeRequests } from "@/core/clientJourney/informationRequestEngine";
import { getCached, setCached, invalidateJourneyCache } from "@/core/clientJourney/journeyCache";

import type {
  ClientJourney,
  ClientInformationRequest,
  CreateInformationRequestInput,
  InformationRequestStatus,
  JourneyOwnerAssignment,
  JourneyOwnerRole,
  JourneyStage,
  JourneySubjectType,
  JourneyTransitionRecord,
} from "@/types/clientJourney";
import { JOURNEY_OWNER_ROLES } from "@/types/clientJourney";
import type { OperationalRecommendation } from "@/types/businessHealth";
import type { Lead } from "@/types/lead";
import type { Client } from "@/types/client";
import type { ActivityEntry } from "@/types/communication";

const GENERIC_ACCESS_ERROR = "The Client Journey Platform isn't available. You may not have access to it.";
const NOT_FOUND_ERROR = "This client or lead could not be found.";
const RECENT_TIMELINE_LIMIT = 20;

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

// ---------------------------------------------------------------------------
// Source data gathering — the one place every engine's input is assembled.
// ---------------------------------------------------------------------------

async function gatherJourneyRecords(workspaceId: string, subjectType: JourneySubjectType, subjectId: string) {
  const lead = subjectType === "lead" ? await getLeadById(subjectId).catch(() => null) : null;
  const client = subjectType === "client" ? await getClientById(subjectId).catch(() => null) : null;
  const clientId = subjectType === "client" ? subjectId : null;

  const events = clientId ? await getEvents({ clientId }) : [];
  const focusEvent = mostRecentEvent(events);

  const proposalArrays = await Promise.all(events.map((e) => getProposalsRepository().getProposalsByEvent(e.id)));
  const proposals = proposalArrays.flat();
  const proposal = latestProposal(proposals);
  const accepted = acceptedProposal(proposals);

  const contracts = clientId ? await getContracts({ clientId }) : [];
  const contract = primaryContract(contracts);
  const invoices = clientId ? await getInvoices({ clientId }) : [];
  const invoice = primaryInvoice(invoices);
  const payments = clientId ? await getPayments({ clientId }) : [];
  const clientAccounts = clientId ? await getClientAccountsByClientId(clientId) : [];
  const financialSummary = clientId ? await getClientFinancialSummary(clientId).catch(() => null) : null;

  const depositRequired = (financialSummary?.deposit_required_minor ?? 0) > 0;
  const depositSatisfied = !depositRequired || (financialSummary?.deposit_balance_minor ?? 0) <= 0 || hasSucceededDepositPayment(payments);
  const portalAccount = activePortalAccount(clientAccounts);

  let operationalPlanExists: boolean | null = null;
  let operationalReadinessScore: number | null = null;
  let executionPackageExists: boolean | null = null;
  if (focusEvent) {
    const plansResult = await listOperationalPlansAction();
    if (plansResult.success) {
      const matching = plansResult.data.find((p) => p.context?.nodeType === "event" && p.context?.nodeId === focusEvent.id);
      operationalPlanExists = !!matching;
      if (matching) {
        const evaluated = await evaluateOperationalPlanAction(matching.id);
        operationalReadinessScore = evaluated.success ? evaluated.data.health.overallOperationalHealth : null;
      }
    }
    const packagesResult = await listExecutionPackagesAction();
    if (packagesResult.success) {
      executionPackageExists = packagesResult.data.some((pkg) => pkg.context.context?.nodeType === "event" && pkg.context.context?.nodeId === focusEvent.id);
    }
  }

  const transitions = await getCoreJourneyTransitionsService().listTransitionsFor(workspaceId, subjectType, subjectId);
  const latestManualTransition = transitions.length > 0 ? transitions[transitions.length - 1] : null;
  const owners = await getCoreJourneyOwnersService().listOwnersFor(workspaceId, subjectType, subjectId);
  const informationRequests = clientId ? await getCoreClientInformationRequestsService().listRequestsForClient(workspaceId, clientId) : [];

  return {
    lead,
    client,
    events,
    focusEvent,
    proposals,
    proposal,
    acceptedProposal: accepted,
    contracts,
    contract,
    invoices,
    invoice,
    payments,
    clientAccounts,
    portalActive: !!portalAccount,
    financialSummary,
    depositRequired,
    depositSatisfied,
    operationalPlanExists,
    operationalReadinessScore,
    executionPackageExists,
    transitions,
    latestManualTransition,
    owners,
    informationRequests,
  };
}

type JourneyRecords = Awaited<ReturnType<typeof gatherJourneyRecords>>;

function toOwnerAssignments(role: readonly JourneyOwnerRole[], records: Pick<JourneyRecords, "owners">): JourneyOwnerAssignment[] {
  return role.map((r) => {
    const found = records.owners.find((o) => o.role === r);
    return found
      ? { role: r, memberId: found.memberId, assignedAt: found.assignedAt, assignedByMemberId: found.assignedByMemberId }
      : { role: r, memberId: null, assignedAt: null, assignedByMemberId: null };
  });
}

/** Exported (not just used internally) so the Client Portal's own session-gated action can build a client-safe journey view without going through the team-member `resolveMemberSessionSnapshot()` gate every other export in this file uses — see `modules/clientPortal/getClientPortalJourneySummary.ts`. */
export async function buildClientJourney(workspaceId: string, subjectType: JourneySubjectType, subjectId: string): Promise<ClientJourney | null> {
  const records = await gatherJourneyRecords(workspaceId, subjectType, subjectId);
  if (subjectType === "lead" && !records.lead) return null;
  if (subjectType === "client" && !records.client) return null;

  const now = nowIso();

  const stateSource: JourneyStateSourceData = {
    subjectType,
    lead: records.lead,
    client: records.client,
    proposals: records.proposals,
    contracts: records.contracts,
    invoices: records.invoices,
    payments: records.payments,
    events: records.events,
    clientAccounts: records.clientAccounts,
    financialSummary: records.financialSummary,
    latestManualTransition: records.latestManualTransition,
  };
  const resolution = resolveClientJourneyState(stateSource);
  const currentStage = resolution.stage;

  const requirementsSource: RequirementsSourceData = {
    lead: records.lead,
    client: records.client,
    proposal: records.proposal,
    acceptedProposal: records.acceptedProposal,
    contract: records.contract,
    invoice: records.invoice,
    focusEvent: records.focusEvent,
    clientAccounts: records.clientAccounts,
    depositRequired: records.depositRequired,
    depositSatisfied: records.depositSatisfied,
    operationalReadinessScore: records.operationalReadinessScore,
    requiredDocumentsComplete: null,
  };
  const requirementsForCurrentStage = evaluateStageRequirements(currentStage, requirementsSource);

  const blockerSource: BlockerSourceData = {
    subjectType,
    lead: records.lead,
    client: records.client,
    proposal: records.proposal,
    acceptedProposal: records.acceptedProposal,
    contract: records.contract,
    invoice: records.invoice,
    focusEvent: records.focusEvent,
    clientAccounts: records.clientAccounts,
    depositRequired: records.depositRequired,
    depositSatisfied: records.depositSatisfied,
    outstandingBalanceMinor: records.financialSummary?.outstanding_minor ?? 0,
    requiredDocumentsComplete: null,
    operationalPlanExists: records.operationalPlanExists,
    executionPackageExists: records.executionPackageExists,
    pendingApprovalsCount: 0,
    clientResponsePendingCount: records.informationRequests.filter((r) => isRequestOverdue(r, now) || r.status === "pending").length,
    overdueInternalFollowUpsCount: 0,
    now,
  };
  const blockers = detectJourneyBlockers(currentStage, blockerSource);

  const progressBase = computeJourneyProgress({ currentStage, requirementsForCurrentStage });
  const progress = withBlockedStages(progressBase, blockers.map((b) => b.stage));
  const milestones = computeJourneyMilestones({ currentStage, requirementsForCurrentStage });

  const health = computeJourneyHealth({ blockers, operationalReadinessScore: records.operationalReadinessScore });

  const nextBestActions = generateNextBestActions({
    subjectType,
    subjectId,
    currentStage,
    blockers,
    lead: records.lead,
    proposal: records.proposal,
    contract: records.contract,
    invoice: records.invoice,
    reviewRequestedAt: null,
    rebookingOfferedAt: null,
  });

  const oldestPending = records.informationRequests.filter((r) => r.status === "pending" && r.dueDate).sort((a, b) => (a.dueDate as string).localeCompare(b.dueDate as string))[0];
  const riskSource: RiskSourceData = {
    now,
    currentStage,
    lead: records.lead,
    proposal: records.proposal,
    contract: records.contract,
    invoice: records.invoice,
    focusEvent: records.focusEvent,
    portalActive: records.portalActive,
    depositRequired: records.depositRequired,
    depositSatisfied: records.depositSatisfied,
    requiredDocumentsComplete: null,
    operationalPlanExists: records.operationalPlanExists,
    oldestPendingRequestDueDate: oldestPending?.dueDate ?? null,
    closedAt: null,
    reviewRequestedAt: null,
    rebookingOfferedAt: null,
  };
  const risks = detectJourneyRisks(riskSource);

  const owners = toOwnerAssignments(JOURNEY_OWNER_ROLES, records);

  const timelineGroups: ActivityEntry[][] = [];
  const ownerType = subjectType;
  const timelineResult = await getEntityTimelineData(ownerType, subjectId);
  if (timelineResult.success) timelineGroups.push(timelineResult.data);
  for (const p of records.proposals) {
    const r = await getEntityTimelineData("proposal", p.id);
    if (r.success) timelineGroups.push(r.data);
  }
  for (const c of records.contracts) {
    const r = await getEntityTimelineData("contract", c.id);
    if (r.success) timelineGroups.push(r.data);
  }
  for (const inv of records.invoices) {
    const r = await getEntityTimelineData("invoice", inv.id);
    if (r.success) timelineGroups.push(r.data);
  }
  for (const e of records.events) {
    const r = await getEntityTimelineData("event", e.id);
    if (r.success) timelineGroups.push(r.data);
  }
  const mergedTimeline = mergeJourneyTimeline(timelineGroups);

  const displayName =
    subjectType === "lead" ? `${records.lead?.first_name ?? ""} ${records.lead?.last_name ?? ""}`.trim() : `${records.client?.first_name ?? ""} ${records.client?.last_name ?? ""}`.trim();

  const context = computeJourneyContext({
    currentStage,
    progressPercentage: progress.overallPercentage,
    blockers,
    nextBestActions,
    recentTimeline: mergedTimeline.slice(0, RECENT_TIMELINE_LIMIT),
    relatedCommercialRecords: [
      ...records.proposals.map((p) => ({ type: "proposal", id: p.id })),
      ...records.contracts.map((c) => ({ type: "contract", id: c.id })),
      ...records.invoices.map((i) => ({ type: "invoice", id: i.id })),
    ],
    relatedOperationalRecords: records.events.map((e) => ({ type: "event", id: e.id })),
  });

  return {
    subjectType,
    subjectId,
    workspaceId,
    displayName: displayName || (subjectType === "lead" ? "Untitled Lead" : "Untitled Client"),
    currentStage,
    status: currentStage === "lost" ? "lost" : currentStage === "cancelled" ? "cancelled" : blockers.some((b) => b.severity === "critical") ? "blocked" : risks.length > 0 ? "at_risk" : currentStage === "closed" ? "completed" : "active",
    progress,
    health,
    milestones,
    requirements: requirementsForCurrentStage,
    blockers,
    risks,
    nextBestActions,
    owners,
    context,
    evaluatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Public actions
// ---------------------------------------------------------------------------

export async function evaluateClientJourneyAction(subjectType: JourneySubjectType, subjectId: string): Promise<ActionResult<ClientJourney>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const journey = await buildClientJourney(session.workspace.id, subjectType, subjectId);
  if (!journey) return { success: false, error: NOT_FOUND_ERROR };
  return { success: true, data: journey };
}

export interface ClientJourneySummary {
  subjectType: JourneySubjectType;
  subjectId: string;
  displayName: string;
  currentStage: JourneyStage;
  status: ClientJourney["status"];
  overallHealth: number;
  overallProgress: number;
  blockerCount: number;
  criticalBlockerCount: number;
}

function toSummary(journey: ClientJourney): ClientJourneySummary {
  return {
    subjectType: journey.subjectType,
    subjectId: journey.subjectId,
    displayName: journey.displayName,
    currentStage: journey.currentStage,
    status: journey.status,
    overallHealth: journey.health.overallJourneyHealth,
    overallProgress: journey.progress.overallPercentage,
    blockerCount: journey.blockers.length,
    criticalBlockerCount: journey.blockers.filter((b) => b.severity === "critical").length,
  };
}

export async function listClientJourneysAction(): Promise<ActionResult<ClientJourneySummary[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const cacheKey = `${session.workspace.id}:journeySummaries`;
  const cached = getCached<ClientJourneySummary[]>(cacheKey);
  if (cached) return { success: true, data: cached };

  const [leads, clients] = await Promise.all([getLeads(), getClients()]);
  const activeLeads = leads.filter((l: Lead) => l.status !== "converted" && l.status !== "archived");
  const activeClients = clients.filter((c: Client) => c.archived_at === null);

  const leadJourneys = await Promise.all(activeLeads.map((l) => buildClientJourney(session.workspace.id, "lead", l.id)));
  const clientJourneys = await Promise.all(activeClients.map((c) => buildClientJourney(session.workspace.id, "client", c.id)));

  const all = [...leadJourneys, ...clientJourneys].filter((j): j is ClientJourney => j !== null);
  const summaries = all.map(toSummary);
  setCached(cacheKey, summaries);
  return { success: true, data: summaries };
}

// ---- Transitions ----

export async function transitionClientJourneyAction(
  subjectType: JourneySubjectType,
  subjectId: string,
  kind: TransitionRequestKind,
  targetStage: JourneyStage,
  trigger: string,
): Promise<ActionResult<JourneyTransitionRecord>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const journey = await buildClientJourney(session.workspace.id, subjectType, subjectId);
  if (!journey) return { success: false, error: NOT_FOUND_ERROR };

  const evaluation = evaluateTransitionRequest(journey.currentStage, { kind, targetStage }, journey.requirements);
  const record = await getCoreJourneyTransitionsService().recordTransition({
    workspaceId: session.workspace.id,
    subjectType,
    subjectId,
    type: evaluation.type,
    previousStage: journey.currentStage,
    newStage: evaluation.allowed ? targetStage : journey.currentStage,
    trigger,
    actingMemberId: session.membership.id,
    blockingRules: evaluation.blockingRules,
  });

  if (evaluation.allowed) {
    const ownerType = subjectType;
    if (evaluation.type === "cancelled") recordTimelineActivity(session.workspace.id, ownerType, subjectId, "journey_cancelled", "Journey cancelled", { trigger });
    if (evaluation.type === "reopened") recordTimelineActivity(session.workspace.id, ownerType, subjectId, "journey_reopened", "Journey reopened", { trigger, targetStage });
  }

  invalidateJourneyCache(session.workspace.id);
  return { success: true, data: record };
}

// ---- Ownership ----

export async function getJourneyOwnersAction(subjectType: JourneySubjectType, subjectId: string): Promise<ActionResult<JourneyOwnerAssignment[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const owners = await getCoreJourneyOwnersService().listOwnersFor(session.workspace.id, subjectType, subjectId);
  return { success: true, data: toOwnerAssignments(JOURNEY_OWNER_ROLES, { owners }) };
}

export async function assignJourneyOwnerAction(subjectType: JourneySubjectType, subjectId: string, role: JourneyOwnerRole, memberId: string): Promise<ActionResult<JourneyOwnerAssignment>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const result = await getCoreJourneyOwnersService().assignOwner(session.workspace.id, subjectType, subjectId, role, memberId, session.membership.id);
  if (!result.success) return { success: false, error: result.error };

  recordTimelineActivity(session.workspace.id, subjectType, subjectId, "status_changed", `${role} owner assigned`, { role, memberId });
  invalidateJourneyCache(session.workspace.id);
  return { success: true, data: { role, memberId: result.data.memberId, assignedAt: result.data.assignedAt, assignedByMemberId: result.data.assignedByMemberId } };
}

// ---- Information Requests ----

export async function listInformationRequestsAction(clientId: string): Promise<ActionResult<ClientInformationRequest[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const requests = await getCoreClientInformationRequestsService().listRequestsForClient(session.workspace.id, clientId);
  return { success: true, data: requests };
}

export async function createInformationRequestAction(input: Omit<CreateInformationRequestInput, "workspaceId">): Promise<ActionResult<ClientInformationRequest>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCoreClientInformationRequestsService().createRequest({ ...input, workspaceId: session.workspace.id });
  if (!result.success) return { success: false, error: result.error };
  recordTimelineActivity(session.workspace.id, "client", input.clientId, "note_added", `Information request created: ${input.title}`, { requestId: result.data.id });
  invalidateJourneyCache(session.workspace.id);
  return { success: true, data: result.data };
}

// v2 Checkpoint 45 security fix — `setStatus()`/`recordClientResponse()` on the underlying
// store look a request up by bare `id`, with no workspace filter of their own (unlike
// `listRequestsForClient()`, which already scopes by `workspaceId`). Every other mutation in
// this file first loads the record and checks its own `workspace_id`/`workspaceId` before
// acting; these two skipped that check, letting any active member of any workspace tamper
// with another workspace's Information Request purely by knowing/guessing its id. Both now
// load the record via the store's own `getRequestById()` and verify ownership first, the same
// "load → check → mutate" shape `documentBundleActions.ts`'s own `loadOwnedBundle()` already
// established.
async function loadOwnedInformationRequest(id: string, workspaceId: string): Promise<ClientInformationRequest | null> {
  const request = await getCoreClientInformationRequestsService().getRequestById(id);
  if (!request || request.workspaceId !== workspaceId) return null;
  return request;
}

export async function setInformationRequestStatusAction(id: string, status: InformationRequestStatus): Promise<ActionResult<ClientInformationRequest>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!(await loadOwnedInformationRequest(id, session.workspace.id))) return { success: false, error: NOT_FOUND_ERROR };
  const result = await getCoreClientInformationRequestsService().setStatus(id, status);
  if (!result.success) return { success: false, error: result.error };
  invalidateJourneyCache(session.workspace.id);
  return { success: true, data: result.data };
}

export async function respondToInformationRequestAction(id: string, response: string): Promise<ActionResult<ClientInformationRequest>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!(await loadOwnedInformationRequest(id, session.workspace.id))) return { success: false, error: NOT_FOUND_ERROR };
  const result = await getCoreClientInformationRequestsService().recordClientResponse(id, response);
  if (!result.success) return { success: false, error: result.error };
  invalidateJourneyCache(session.workspace.id);
  return { success: true, data: result.data };
}

export async function getInformationRequestsSummaryAction(clientId: string) {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false as const, error: GENERIC_ACCESS_ERROR };
  const requests = await getCoreClientInformationRequestsService().listRequestsForClient(session.workspace.id, clientId);
  return { success: true as const, data: summarizeRequests(requests, nowIso()) };
}

// ---- Analytics ----

export async function getJourneyAnalyticsAction(): Promise<ActionResult<ReturnType<typeof computeJourneyAnalytics>>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const cacheKey = `${session.workspace.id}:journeyAnalytics`;
  const cached = getCached<ReturnType<typeof computeJourneyAnalytics>>(cacheKey);
  if (cached) return { success: true, data: cached };

  const [leads, clients] = await Promise.all([getLeads(), getClients()]);
  const leadInputs = await Promise.all(leads.map((l) => buildAnalyticsInput(session.workspace.id, "lead", l.id)));
  const clientInputs = await Promise.all(clients.map((c) => buildAnalyticsInput(session.workspace.id, "client", c.id)));
  const inputs = [...leadInputs, ...clientInputs].filter((i): i is JourneyAnalyticsInput => i !== null);

  const analytics = computeJourneyAnalytics(inputs, nowIso());
  setCached(cacheKey, analytics);
  return { success: true, data: analytics };
}

async function buildAnalyticsInput(workspaceId: string, subjectType: JourneySubjectType, subjectId: string): Promise<JourneyAnalyticsInput | null> {
  const journey = await buildClientJourney(workspaceId, subjectType, subjectId);
  if (!journey) return null;
  const closed = journey.currentStage === "closed" || journey.currentStage === "follow_up" || journey.currentStage === "review_requested" || journey.currentStage === "review_received" || journey.currentStage === "rebooking_opportunity";
  return {
    subjectType,
    currentStage: journey.currentStage,
    createdAt: journey.evaluatedAt,
    closedAt: closed ? journey.evaluatedAt : null,
    isLead: subjectType === "lead",
    convertedToClient: subjectType === "lead" && journey.currentStage !== "new_lead" && journey.currentStage !== "contacted" && journey.currentStage !== "qualified" && journey.currentStage !== "lost",
    proposalSent: journey.milestones.some((m) => m.stage === "proposal_sent" && m.completed),
    proposalAccepted: journey.milestones.some((m) => m.stage === "proposal_accepted" && m.completed),
    contractSent: journey.milestones.some((m) => m.stage === "contract_sent" && m.completed),
    contractSigned: journey.milestones.some((m) => m.stage === "contract_signed" && m.completed),
    depositRequired: journey.blockers.some((b) => b.type === "deposit_unpaid") || journey.milestones.some((m) => m.stage === "deposit_paid" && m.completed),
    depositPaid: journey.milestones.some((m) => m.stage === "deposit_paid" && m.completed),
    isBlocked: journey.blockers.length > 0,
    lostOrCancelledAtStage: journey.currentStage === "lost" || journey.currentStage === "cancelled" ? journey.currentStage : null,
    followUpCompleted: null,
    reviewCompleted: journey.currentStage === "review_received" ? true : null,
    rebookingCreated: journey.currentStage === "rebooking_opportunity" ? true : null,
    stageEnteredAt: {},
  };
}

// ---- Executive Decisions integration (Step 23) ----

export async function journeyRecommendationsForExecutiveDecisions(): Promise<OperationalRecommendation[]> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return [];

  const [leads, clients] = await Promise.all([getLeads(), getClients()]);
  const activeLeads = leads.filter((l: Lead) => l.status !== "converted" && l.status !== "archived");
  const activeClients = clients.filter((c: Client) => c.archived_at === null);

  const leadJourneys = await Promise.all(activeLeads.map((l) => buildClientJourney(session.workspace.id, "lead", l.id)));
  const clientJourneys = await Promise.all(activeClients.map((c) => buildClientJourney(session.workspace.id, "client", c.id)));
  const journeys = [...leadJourneys, ...clientJourneys].filter((j): j is ClientJourney => j !== null);

  const recommendations: OperationalRecommendation[] = [];
  for (const j of journeys) {
    recommendations.push(...journeyBlockersToRecommendations(j.blockers, j.subjectType, j.subjectId));
    recommendations.push(...journeyRisksToRecommendations(j.risks, j.subjectType, j.subjectId));
  }
  return recommendations;
}
