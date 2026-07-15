export const PAYMENT_TYPES = [
  "deposit",
  "installment",
  "final_payment",
  "full_payment",
  "retainer",
  "reimbursement",
  "refund",
  "adjustment",
  "other",
] as const;

export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  deposit: "Deposit",
  installment: "Installment",
  final_payment: "Final Payment",
  full_payment: "Full Payment",
  retainer: "Retainer",
  reimbursement: "Reimbursement",
  refund: "Refund",
  adjustment: "Adjustment",
  other: "Other",
};
