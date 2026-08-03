/**
 * The e-signature-specific progress of a Contract — deliberately independent
 * of `status` (see core/workflows/contractWorkflow.ts), the same way an
 * Event's `status` and `lifecycle_stage` are independent state machines.
 * `status` tracks the contract's overall commercial lifecycle;
 * `signature_status` tracks only where the document is in the signing
 * process, and can be more granular (e.g. `partially_signed`, for a future
 * multi-signer scenario `status` has no equivalent for).
 */
export const SIGNATURE_STATUSES = [
  "unsigned",
  "sent",
  "viewed",
  "partially_signed",
  "signed",
  "declined",
  "expired",
  "cancelled",
] as const;

export type SignatureStatus = (typeof SIGNATURE_STATUSES)[number];

export const SIGNATURE_STATUS_LABELS: Record<SignatureStatus, string> = {
  unsigned: "Unsigned",
  sent: "Sent",
  viewed: "Viewed",
  partially_signed: "Partially Signed",
  signed: "Signed",
  declined: "Declined",
  expired: "Expired",
  cancelled: "Cancelled",
};
