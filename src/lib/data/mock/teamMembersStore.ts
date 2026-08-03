import type { TeamMember } from "@/types/teamMember";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

/**
 * Realistic seed team roster covering every role. `member_1` (owner) is
 * treated as "the current user" throughout mock mode — see
 * MOCK_CURRENT_MEMBER_ID below — since mock mode has no real
 * authentication to resolve an actual signed-in user from.
 */
const SEED_TEAM_MEMBERS: TeamMember[] = [
  {
    id: "member_1",
    workspace_id: CURRENT_WORKSPACE_ID,
    user_id: "user_1",
    role: "owner",
    status: "active",
    full_name: "Amoré Bloom Owner",
    email: "owner@amorebloom.com",
    avatar_url: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "member_2",
    workspace_id: CURRENT_WORKSPACE_ID,
    user_id: "user_2",
    role: "admin",
    status: "active",
    full_name: "Ana Ferreira",
    email: "ana@amorebloom.com",
    avatar_url: null,
    created_at: "2026-02-10T00:00:00.000Z",
    updated_at: "2026-02-10T00:00:00.000Z",
  },
  {
    id: "member_3",
    workspace_id: CURRENT_WORKSPACE_ID,
    user_id: "user_3",
    role: "manager",
    status: "active",
    full_name: "Marina Costa",
    email: "marina@amorebloom.com",
    avatar_url: null,
    created_at: "2026-03-15T00:00:00.000Z",
    updated_at: "2026-03-15T00:00:00.000Z",
  },
  {
    id: "member_4",
    workspace_id: CURRENT_WORKSPACE_ID,
    user_id: "user_4",
    role: "staff",
    status: "suspended",
    full_name: "Sofia Lima",
    email: "sofia@amorebloom.com",
    avatar_url: null,
    created_at: "2026-04-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
  },
];

/** Mock mode has no real authentication — the seeded owner stands in for "the current user" everywhere the app needs one. */
export const MOCK_CURRENT_MEMBER_ID = "member_1";

let teamMembers: TeamMember[] = SEED_TEAM_MEMBERS;

export function readTeamMembers(): TeamMember[] {
  return teamMembers;
}

export function writeTeamMembers(next: TeamMember[]): void {
  teamMembers = next;
}

export function resetTeamMembersStore(): void {
  teamMembers = SEED_TEAM_MEMBERS;
}
