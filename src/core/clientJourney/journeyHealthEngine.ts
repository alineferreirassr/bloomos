import type { JourneyBlocker, JourneyBlockerType, JourneyHealth, JourneySeverity } from "@/types/clientJourney";

/**
 * v2.0 Checkpoint 32 — Journey Health Engine (Step 8). 9 of the 10 named
 * components are a documented penalty over the Blocker Engine's own
 * already-detected blockers (each blocker type maps to exactly one
 * component, so nothing is double-counted); `operationalReadiness` is the
 * one component reused verbatim from Operational Planning/Execution
 * Package's own readiness score, since Journey Health must never
 * recalculate a formula another platform already owns.
 */

const SEVERITY_PENALTY: Record<JourneySeverity, number> = { critical: 30, high: 20, medium: 10, low: 5, informational: 0 };

type HealthComponentKey = "leadHealth" | "proposalHealth" | "contractHealth" | "invoiceHealth" | "paymentHealth" | "communicationHealth" | "portalHealth" | "planningHealth" | "clientResponseHealth";

const BLOCKER_TYPE_TO_COMPONENT: Record<JourneyBlockerType, HealthComponentKey> = {
  missing_contact_information: "leadHealth",
  lead_not_qualified: "leadHealth",
  proposal_incomplete: "proposalHealth",
  proposal_not_accepted: "proposalHealth",
  contract_missing: "contractHealth",
  contract_unsigned: "contractHealth",
  invoice_missing: "invoiceHealth",
  deposit_unpaid: "paymentHealth",
  final_balance_unpaid: "paymentHealth",
  missing_portal_access: "portalHealth",
  missing_client_documents: "planningHealth",
  missing_approval: "planningHealth",
  missing_event_information: "planningHealth",
  missing_operational_plan: "planningHealth",
  missing_execution_package: "planningHealth",
  client_response_pending: "clientResponseHealth",
  internal_follow_up_overdue: "communicationHealth",
};

export interface HealthSourceData {
  blockers: JourneyBlocker[];
  /** Reused verbatim from Operational Planning/Execution Package readiness — `null` when no plan exists yet, which reads as vacuous-good (nothing to be unready about). */
  operationalReadinessScore: number | null;
}

function componentScore(component: HealthComponentKey, blockers: JourneyBlocker[]): number {
  const penalty = blockers.filter((b) => BLOCKER_TYPE_TO_COMPONENT[b.type] === component).reduce((sum, b) => sum + SEVERITY_PENALTY[b.severity], 0);
  return Math.max(0, 100 - penalty);
}

export function computeJourneyHealth(data: HealthSourceData): JourneyHealth {
  const leadHealth = componentScore("leadHealth", data.blockers);
  const proposalHealth = componentScore("proposalHealth", data.blockers);
  const contractHealth = componentScore("contractHealth", data.blockers);
  const invoiceHealth = componentScore("invoiceHealth", data.blockers);
  const paymentHealth = componentScore("paymentHealth", data.blockers);
  const communicationHealth = componentScore("communicationHealth", data.blockers);
  const portalHealth = componentScore("portalHealth", data.blockers);
  const planningHealth = componentScore("planningHealth", data.blockers);
  const clientResponseHealth = componentScore("clientResponseHealth", data.blockers);
  const operationalReadiness = data.operationalReadinessScore ?? 100;

  const components = [leadHealth, proposalHealth, contractHealth, invoiceHealth, paymentHealth, communicationHealth, portalHealth, planningHealth, operationalReadiness, clientResponseHealth];
  const overallJourneyHealth = Math.round(components.reduce((sum, v) => sum + v, 0) / components.length);

  return {
    leadHealth,
    proposalHealth,
    contractHealth,
    invoiceHealth,
    paymentHealth,
    communicationHealth,
    portalHealth,
    planningHealth,
    operationalReadiness,
    clientResponseHealth,
    overallJourneyHealth,
  };
}
