import { getClientById } from "@/lib/data";
import { getStripeProviderForWorkspace } from "@/core/integrations/providers/stripe/stripeClient";
import { getStripeCustomerMappingByClientId, upsertStripeCustomerMapping, type StripeCustomerMapping } from "@/lib/data/core/integrations/stripeCustomerMappingStore";
import { getLogger } from "@/core/observability/logger";
import type Stripe from "stripe";
import type { Client } from "@/types/client";

/**
 * Customer Synchronization (v2 Checkpoint 23, Step 3). Maps a BloomOS
 * `Client` to a real Stripe `Customer` — name, email, phone, billing
 * address, and metadata linking the two records both ways
 * (`bloomos_client_id`/`bloomos_workspace_id` on the Stripe side,
 * `StripeCustomerMapping` on the BloomOS side). "Prevent duplicates" is
 * structural: `getStripeCustomerMappingByClientId` is always checked
 * first, so a second sync for the same Client always updates the same
 * Stripe Customer rather than creating a new one.
 */

function buildStripeAddress(client: Client): Stripe.AddressParam | undefined {
  if (!client.address && !client.city && !client.state && !client.zip_code) return undefined;
  return {
    line1: client.address ?? undefined,
    city: client.city ?? undefined,
    state: client.state ?? undefined,
    postal_code: client.zip_code ?? undefined,
  };
}

function clientDisplayName(client: Client): string {
  return `${client.first_name} ${client.last_name}`.trim();
}

export interface SyncClientResult {
  mapping: StripeCustomerMapping;
  stripeCustomer: Stripe.Customer;
}

export async function syncClientToStripeCustomer(workspaceId: string, clientId: string): Promise<SyncClientResult> {
  const client = await getClientById(clientId);
  const provider = await getStripeProviderForWorkspace(workspaceId);
  const existingMapping = getStripeCustomerMappingByClientId(clientId);

  const metadata = { bloomos_client_id: client.id, bloomos_workspace_id: workspaceId };
  const address = buildStripeAddress(client);

  let stripeCustomer: Stripe.Customer;
  if (existingMapping) {
    const updated = await provider.updateCustomer(existingMapping.stripe_customer_id, { email: client.email, name: clientDisplayName(client), phone: client.phone, address, metadata });
    stripeCustomer = updated;
  } else {
    stripeCustomer = await provider.createCustomer({ email: client.email, name: clientDisplayName(client), phone: client.phone, address, metadata });
  }

  const mapping = upsertStripeCustomerMapping(workspaceId, client.id, stripeCustomer.id);
  getLogger().info("Stripe customer synchronized", { workspaceId, clientId, stripeCustomerId: stripeCustomer.id, created: !existingMapping });

  return { mapping, stripeCustomer };
}

/** Read-only — returns the existing mapping without ever calling Stripe, for UI surfaces that just need to know "is this Client already synced." */
export function getExistingStripeCustomerMapping(clientId: string): StripeCustomerMapping | null {
  return getStripeCustomerMappingByClientId(clientId);
}
