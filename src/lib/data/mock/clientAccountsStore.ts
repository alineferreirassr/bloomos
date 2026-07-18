import type { ClientAccount } from "@/types/clientAccount";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

/**
 * Realistic seed data: one active Client Portal account (client_1, Naomi
 * Whitfield) and one suspended account (client_2), so mock-mode UI/tests
 * can exercise every state without a live acceptance flow. Mock mode has
 * no real Supabase Auth, so `auth_user_id` values here are placeholder
 * mock ids, never real `auth.users` rows.
 */
const SEED_CLIENT_ACCOUNTS: ClientAccount[] = [
  {
    id: "client_account_1",
    workspace_id: CURRENT_WORKSPACE_ID,
    client_id: "client_1",
    auth_user_id: "mock_client_user_1",
    email: "naomi.whitfield@example.com",
    status: "active",
    invited_by: "user_1",
    accepted_at: "2026-06-01T00:00:00.000Z",
    suspended_at: null,
    revoked_at: null,
    last_access_at: "2026-07-10T00:00:00.000Z",
    created_at: "2026-05-28T00:00:00.000Z",
    updated_at: "2026-07-10T00:00:00.000Z",
  },
  {
    id: "client_account_2",
    workspace_id: CURRENT_WORKSPACE_ID,
    client_id: "client_2",
    auth_user_id: "mock_client_user_2",
    email: "jordan.ellis@example.com",
    status: "suspended",
    invited_by: "user_1",
    accepted_at: "2026-04-15T00:00:00.000Z",
    suspended_at: "2026-06-20T00:00:00.000Z",
    revoked_at: null,
    last_access_at: "2026-06-01T00:00:00.000Z",
    created_at: "2026-04-10T00:00:00.000Z",
    updated_at: "2026-06-20T00:00:00.000Z",
  },
];

/** Mock mode has no real Client Portal authentication — this seeded active account stands in for "the current client user," the same precedent as MOCK_CURRENT_MEMBER_ID. */
export const MOCK_CURRENT_CLIENT_ACCOUNT_ID = "client_account_1";

let clientAccounts: ClientAccount[] = SEED_CLIENT_ACCOUNTS;

export function readClientAccounts(): ClientAccount[] {
  return clientAccounts;
}

export function writeClientAccounts(next: ClientAccount[]): void {
  clientAccounts = next;
}

export function resetClientAccountsStore(): void {
  clientAccounts = SEED_CLIENT_ACCOUNTS;
}
