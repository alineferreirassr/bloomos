/**
 * Mirrors the `profiles` table (supabase/migrations) verbatim (snake_case),
 * matching the rest of this codebase's domain types. `id` is the same UUID
 * as the Supabase Auth user (`auth.users.id`) — profiles are provisioned
 * automatically by the `handle_new_user()` trigger, never created directly.
 */
export interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}
