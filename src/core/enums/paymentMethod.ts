/** Labels only — no payment-provider integration exists (Stripe/Square/PayPal/banks are not connected). */
export const PAYMENT_METHODS = [
  "cash",
  "check",
  "bank_transfer",
  "ach",
  "credit_card",
  "debit_card",
  "zelle",
  "venmo",
  "paypal",
  "stripe",
  "square",
  "other",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  check: "Check",
  bank_transfer: "Bank Transfer",
  ach: "ACH",
  credit_card: "Credit Card",
  debit_card: "Debit Card",
  zelle: "Zelle",
  venmo: "Venmo",
  paypal: "PayPal",
  stripe: "Stripe",
  square: "Square",
  other: "Other",
};
