# Dashboard Experience Resolver

Checkpoint 19, Step 4. `/dashboard` is one route that renders one of two entirely different experiences depending on who's signed in — never a hardcoded user name, never a decision based on the route path alone.

## How it resolves

`resolveDashboardExperience(role: WorkspaceMemberRole)` (`src/core/dashboard/resolveDashboardExperience.ts`) is a pure function:

```ts
owner | admin  → "owner"  (the Owner Dashboard)
manager | staff → "team"   (the Team Dashboard)
```

`WorkspaceMemberRole` (`core/enums/workspaceRole.ts`) is the **only** access-control role vocabulary this codebase has — `owner`/`admin`/`manager`/`staff`. The checkpoint's own reference list of team roles (Planner, Coordinator, Designer, Setup Team, Finance, Photographer, General Staff) is **not** a fifth/sixth/seventh access-control role — seebelow.

`/dashboard/page.tsx` (a Server Component) calls `resolveMemberSessionSnapshot()`, resolves the experience, and renders `OwnerDashboardView`/`TeamDashboardView` accordingly — a routing convenience only. The real security boundary is inside each aggregator: `getOwnerDashboardData()` and `getTeamDashboardData()` **each independently re-check** `resolveDashboardExperience()` against the resolved session before returning any data (Step 17). An `admin` calling `getTeamDashboardData()` directly (or a `staff` member calling `getOwnerDashboardData()`) gets rejected, not just hidden client-side.

Admins resolving to the *Owner* experience (rather than getting their own admin-flavored view) is a deliberate mapping: this codebase's own `WORKSPACE_MANAGEMENT_ROLES` (`core/enums/workspaceRole.ts`) already groups owner+admin together as the workspace's management tier, and the reference images only show two experiences (Owner, Team) — there is no separate "Admin Dashboard" in the spec.

## The Client Dashboard is resolved separately

A Client Account is never a `WorkspaceMemberRole` at all — it authenticates through an entirely different session (`resolveClientAccountSessionSnapshot`/`getCurrentClientAccountContext`), and always lands on `getClientDashboardData()` (`src/modules/clientAccess/getClientDashboardData.ts`). There is no shared resolver between the internal and client sides; mixing them would blur a real trust boundary this codebase has kept separate since the Client Portal was built (Checkpoint 14).

## `TeamRoleLabel` — cosmetic only, never a second access-control system

Step 8 asks for role-specific Team Dashboard content (Planner sees client communication/design approvals, Setup Team sees arrival/material checklist, and so on). This codebase has no Employee/Vendor/job-title module, and inventing 6 new `WorkspaceMemberRole` values would mean a real Supabase migration + new RLS policies — out of scope for a UI checkpoint, and risky to attempt without a verified release blocker.

Instead, `TeamRoleLabel` (`src/types/teamRoleLabel.ts`) — `planner | coordinator | designer | setup_team | finance | photographer | general_staff` — is a **purely cosmetic** field, stored in a small, independent, mock-only side table (`src/lib/data/core/dashboard/teamRoleLabelStore.ts`, keyed by `member_id`, defaulting to `general_staff`), completely separate from `WorkspaceMemberRole`/`Permission`. It is:

- **Set** via a new "Dashboard role" column on the Team management page (`TeamView.tsx`), gated by the existing `team.manage_roles` permission (`setTeamRoleLabelAction`).
- **Read** by `getTeamDashboardData()` and surfaced as a badge next to the member's real role in the Team Dashboard's own profile menu.
- **Never** consulted by any permission check, any RLS policy, or any Server Action's own access gate.

Two members with the same real role (`staff`) and the same real permissions but different `TeamRoleLabel`s see the same underlying data (Step 8's "same foundation, role-aware composition, not a separate design system per role") — today the label is descriptive metadata only; the Team Dashboard's own card composition doesn't yet branch its layout per label (see `docs/team-dashboard.md`'s Known limitations for the exact scope line drawn here).

## Adding a new dashboard role variant

1. Add the new label to `TEAM_ROLE_LABELS`/`TEAM_ROLE_LABEL_NAMES` in `src/types/teamRoleLabel.ts`.
2. If the new variant needs different content composition (not just a badge), branch inside `TeamDashboardView.tsx` on `data.teamRoleLabel` — the aggregator (`getTeamDashboardData.ts`) already returns everything role-agnostic; a variant only changes which cards/fields are shown, never re-fetches different data.
3. No change to `resolveDashboardExperience`, `Permission`, or any RLS policy is ever needed for a new label.
