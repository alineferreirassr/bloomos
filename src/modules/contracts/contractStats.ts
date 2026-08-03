import type { Contract } from "@/types/contract";

export interface ContractStats {
  total: number;
  draft: number;
  sent: number;
  viewed: number;
  signed: number;
  /** sent or viewed and not yet signed/declined/expired/cancelled — still awaiting a signature. */
  pendingSignature: number;
  expired: number;
  cancelled: number;
  /** Sum of total_value across every contract that hasn't fallen out of the active pipeline (cancelled/declined/expired/archived). */
  contractValue: number;
  /** Sum of deposit_amount across active-pipeline contracts with a deposit required — no Payments module exists yet to know how much has actually been collected. */
  depositPending: number;
  /** Sum of total_value across completed contracts. */
  completedValue: number;
}

const INACTIVE_STATUSES: Contract["status"][] = ["cancelled", "declined", "expired", "archived"];

/**
 * Pure — no I/O, no CRUD. Single source of truth for Contract counts and
 * value totals, consumed by getDashboardMetrics() so the Dashboard and any
 * future Contracts UI never compute these numbers independently and risk
 * disagreeing.
 */
export function computeContractStats(contracts: Contract[]): ContractStats {
  const total = contracts.length;
  const draft = contracts.filter((c) => c.status === "draft").length;
  const sent = contracts.filter((c) => c.status === "sent").length;
  const viewed = contracts.filter((c) => c.status === "viewed").length;
  const signed = contracts.filter((c) => c.status === "signed").length;
  const pendingSignature = contracts.filter(
    (c) => c.status === "sent" || c.status === "viewed" || c.signature_status === "partially_signed",
  ).length;
  const expired = contracts.filter((c) => c.status === "expired").length;
  const cancelled = contracts.filter((c) => c.status === "cancelled").length;

  const activeContracts = contracts.filter((c) => !INACTIVE_STATUSES.includes(c.status));
  const contractValue = activeContracts.reduce((sum, c) => sum + (c.total_value ?? 0), 0);
  const depositPending = activeContracts
    .filter((c) => c.deposit_required)
    .reduce((sum, c) => sum + (c.deposit_amount ?? 0), 0);
  const completedValue = contracts
    .filter((c) => c.status === "completed")
    .reduce((sum, c) => sum + (c.total_value ?? 0), 0);

  return {
    total,
    draft,
    sent,
    viewed,
    signed,
    pendingSignature,
    expired,
    cancelled,
    contractValue,
    depositPending,
    completedValue,
  };
}
