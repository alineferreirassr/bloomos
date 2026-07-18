import type { ClientAccount, ClientAccountContext } from "@/types/clientAccount";
import type { ClientInvitation, ClientInvitationWithToken, ClientInvitationPreview } from "@/types/clientInvitation";
import type { InvitationStatus } from "@/core/enums/invitationStatus";
import type { DataResult } from "@/lib/data/result";

export interface CreateClientInvitationInput {
  client_id: string;
  email: string;
}

export interface ClientInvitationFilters {
  clientId?: string;
  status?: InvitationStatus | "all";
}

/**
 * The single Client Accounts + Invitations persistence contract —
 * implemented once by the mock repository (mockRepository.ts) and once by
 * the Supabase repository (supabaseRepository.ts), exactly mirroring
 * TeamRepository's shape. lib/data/index.ts picks between them via
 * lib/data/provider.ts's selectRepository().
 *
 * Deliberately separate from TeamRepository: a client account is never a
 * `workspace_members` row, never carries an internal role, and never
 * grants access to any other Client's records. This is the Client
 * Accounts + Invitations foundation only — the full Client Portal (a
 * client-facing UI for Events/Contracts/Invoices/Documents) is a later,
 * separately-scoped phase. See docs/permissions.md.
 */
export interface ClientAccessRepository {
  // Accounts
  getClientAccounts(clientId?: string): Promise<ClientAccount[]>;
  getClientAccountById(id: string): Promise<ClientAccount>;
  getClientAccountsByClientId(clientId: string): Promise<ClientAccount[]>;
  getCurrentClientAccount(): Promise<ClientAccount | null>;
  /** Display-safe context for the Client Portal landing page — client/Workspace names a client caller can never reach via the business-module repositories (those require Workspace membership). */
  getCurrentClientAccountContext(): Promise<ClientAccountContext | null>;
  activateClientAccount(id: string): Promise<DataResult<ClientAccount>>;
  suspendClientAccount(id: string): Promise<DataResult<ClientAccount>>;
  reactivateClientAccount(id: string): Promise<DataResult<ClientAccount>>;
  revokeClientAccount(id: string): Promise<DataResult<ClientAccount>>;
  updateClientLastAccess(id: string): Promise<void>;
  canCurrentUserAccessClient(clientId: string): Promise<boolean>;

  // Invitations
  getClientInvitations(filters?: ClientInvitationFilters): Promise<ClientInvitation[]>;
  getClientInvitationById(id: string): Promise<ClientInvitation>;
  createClientInvitation(input: CreateClientInvitationInput): Promise<DataResult<ClientInvitationWithToken>>;
  resendClientInvitation(id: string): Promise<DataResult<ClientInvitationWithToken>>;
  revokeClientInvitation(id: string): Promise<DataResult<ClientInvitation>>;
  acceptClientInvitation(token: string): Promise<DataResult<ClientAccount>>;
  expireClientInvitations(): Promise<void>;
  getClientInvitationByToken(token: string): Promise<ClientInvitationPreview | null>;
  getClientInvitationStatus(id: string): Promise<InvitationStatus>;
  getClientInvitationNextAction(id: string): Promise<string | null>;
}
