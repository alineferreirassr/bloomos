export const CONTRACT_STATUSES = [
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
] as const;

export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  draft: "Draft",
  review: "Review",
  ready: "Ready",
  sent: "Sent",
  viewed: "Viewed",
  signed: "Signed",
  completed: "Completed",
  expired: "Expired",
  cancelled: "Cancelled",
  archived: "Archived",
  declined: "Declined",
};

/**
 * Statuses reachable only through their own dedicated action (sendContract,
 * markViewed, markSigned, markDeclined, expireContract, cancelContract,
 * completeContract, archiveContract), never the plain status selector. Once
 * entered, none of these can be left — same "terminal" meaning as
 * LOCKED_EVENT_STATUSES/LOCKED_LEAD_STATUSES.
 */
export const LOCKED_CONTRACT_STATUSES: ContractStatus[] = [
  "sent",
  "viewed",
  "signed",
  "completed",
  "expired",
  "cancelled",
  "archived",
  "declined",
];

/** Statuses selectable from the ordinary status setter (updateContractStatus). */
export const WORKING_CONTRACT_STATUSES: ContractStatus[] = CONTRACT_STATUSES.filter(
  (status) => !LOCKED_CONTRACT_STATUSES.includes(status),
);
