/**
 * Minimal mock Client record — just enough to prove the Lead-to-Client
 * conversion workflow. The full Clients module (docs/database.md `clients`
 * table) is a later step; do not add fields here beyond what conversion needs.
 */
export interface Client {
  id: string;
  workspace_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  origin_lead_id: string;
  is_returning: boolean;
  created_at: string;
  updated_at: string;
}
