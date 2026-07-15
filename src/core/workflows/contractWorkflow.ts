import {
  CONTRACT_STATUSES,
  LOCKED_CONTRACT_STATUSES,
  WORKING_CONTRACT_STATUSES,
  CONTRACT_STATUS_LABELS,
  type ContractStatus,
} from "@/core/enums/contractStatus";

/**
 * The canonical Contract lifecycle. Single source of truth for which
 * statuses exist and which transitions are legal — the data layer
 * (lib/data/index.ts) is the only consumer today; a future Contracts UI
 * will consume it the same way LeadStatusSelect/EventStatusSelect consume
 * leadWorkflow/eventWorkflow, instead of encoding its own copy of the rule.
 *
 * Main flow: draft -> review -> ready -> sent -> viewed -> signed -> completed.
 * Terminal (locked): sent, viewed, signed, completed, expired, cancelled,
 * archived, declined — each reachable only through its own dedicated data-
 * layer action (sendContract, markViewed, markSigned, completeContract,
 * expireContract, cancelContract, archiveContract, markDeclined), never the
 * plain status setter. `draft`/`review`/`ready` remain freely
 * inter-transitionable through the plain status setter (updateContractStatus)
 * since they're just stages of internal preparation before anything is
 * sent to a client.
 *
 * `signature_status` (core/enums/signatureStatus.ts) is a second, independent
 * state machine tracked directly on the Contract type — see its doc comment
 * for why it isn't merged into this one.
 */
export { CONTRACT_STATUSES, LOCKED_CONTRACT_STATUSES, WORKING_CONTRACT_STATUSES, CONTRACT_STATUS_LABELS };
export type { ContractStatus };

/**
 * True for a status reachable only through its own dedicated action — never
 * the plain status selector, and never left once entered.
 */
export function isContractStatusTerminal(status: ContractStatus): boolean {
  return LOCKED_CONTRACT_STATUSES.includes(status);
}

/**
 * The authoritative status transition rule for the plain status setter,
 * mirroring leadWorkflow's canTransition: a locked status is terminal; any
 * other status can move freely to any other non-locked status.
 */
export function canTransitionContractStatus(from: ContractStatus, to: ContractStatus): boolean {
  if (isContractStatusTerminal(from)) return false;
  if (from === to) return false;
  return WORKING_CONTRACT_STATUSES.includes(to);
}

/** Every status `from` can legally move to right now via the plain setter (empty once terminal). */
export function getNextContractStatuses(from: ContractStatus): ContractStatus[] {
  if (isContractStatusTerminal(from)) return [];
  return WORKING_CONTRACT_STATUSES.filter((status) => canTransitionContractStatus(from, status));
}

/**
 * Statuses with genuinely nothing left to do — a narrower set than
 * LOCKED_CONTRACT_STATUSES, which also includes sent/viewed/signed:
 * entry-restricted to their own dedicated action, but still mid-flow (a sent
 * contract can still be viewed, signed, declined, expired, or cancelled).
 * Used both by getContractNextRecommendedAction below and by the data
 * layer's cancelContract/archiveContract preconditions — one definition of
 * "closed", not re-decided at each call site.
 */
export const CLOSED_CONTRACT_STATUSES: ContractStatus[] = [
  "completed",
  "expired",
  "cancelled",
  "archived",
  "declined",
];

/** True once a Contract has genuinely nothing left to do — no further action can move it anywhere. */
export function isContractClosed(status: ContractStatus): boolean {
  return CLOSED_CONTRACT_STATUSES.includes(status);
}

interface ContractForNextAction {
  status: ContractStatus;
  total_value: number | null;
  expiration_date: string | null;
}

/**
 * Short, human-readable, deterministic suggestion for what to do next with
 * this Contract — mirrors getEventNextRecommendedAction/
 * getNextRecommendedAction (Lead). Checked in a fixed priority order so the
 * same Contract state always produces the same suggestion. Every closed
 * status gets no suggestion.
 */
export function getContractNextRecommendedAction(contract: ContractForNextAction): string | null {
  if (isContractClosed(contract.status)) {
    return null;
  }

  switch (contract.status) {
    case "draft":
      if (contract.total_value === null) {
        return "Set the contract value";
      }
      return "Complete the contract details and move it to review";
    case "review":
      return "Review the contract and mark it ready to send";
    case "ready":
      return "Send the contract to the client";
    case "sent": {
      if (contract.expiration_date !== null && new Date(contract.expiration_date).getTime() < Date.now()) {
        return "This contract has passed its expiration date — mark it expired";
      }
      return "Follow up — the contract hasn't been viewed yet";
    }
    case "viewed":
      return "Follow up for signature";
    case "signed":
      return "Mark the contract as completed";
    default:
      return null;
  }
}
