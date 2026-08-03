import { registerConnector } from "@/core/marketplace/connectorRegistry";
import type { ConnectorDefinition } from "@/types/connector";

let registered = false;

/** Checkpoint 18, Step 4 — Payments' own 2 built-in connectors. */
export function registerPaymentsConnectors(): void {
  if (registered) return;

  registerConnector({
    id: "stripe",
    name: "Stripe",
    category: "payments",
    icon: "CreditCard",
    version: 1,
    status: "available",
    description: "Reconcile paid Invoices and issued Receipts against a Stripe account — a placeholder connector; no real Stripe account is ever contacted.",
    requiredPermission: "workspace.manage",
    requiredApiScopes: ["finance.read"],
    subscribedWebhookEvents: ["invoice.paid", "receipt.created"],
    configSchema: [
      { key: "accountId", label: "Stripe account ID", type: "text", required: true, placeholder: "acct_..." },
      { key: "currency", label: "Default currency", type: "select", required: true, options: [{ value: "usd", label: "USD" }, { value: "eur", label: "EUR" }, { value: "gbp", label: "GBP" }] },
    ],
  } satisfies ConnectorDefinition);

  registerConnector({
    id: "paypal",
    name: "PayPal",
    category: "payments",
    icon: "Wallet",
    version: 1,
    status: "available",
    description: "Accept PayPal as an Invoice payment method — a placeholder connector; no real PayPal account is ever contacted.",
    requiredPermission: "workspace.manage",
    requiredApiScopes: ["finance.read"],
    subscribedWebhookEvents: ["invoice.created", "invoice.paid"],
    configSchema: [
      { key: "merchantId", label: "PayPal merchant ID", type: "text", required: true },
    ],
  } satisfies ConnectorDefinition);

  registered = true;
}
