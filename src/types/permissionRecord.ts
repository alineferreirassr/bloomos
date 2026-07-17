import type { Permission } from "@/core/enums/permission";

/** Mirrors the `permissions` table (supabase/migrations) verbatim (snake_case). Global, not Workspace-scoped — seeded once, read-only to the app. Named PermissionRecord (not Permission) to avoid colliding with the string-literal union type in core/enums/permission.ts. */
export interface PermissionRecord {
  id: Permission;
  description: string;
  created_at: string;
  updated_at: string;
}

/** Mirrors the `role_permissions` table verbatim (snake_case). A pure join row — no id, no updated_at (a grant either exists or doesn't, it's never edited in place). */
export interface RolePermission {
  role_id: string;
  permission_id: Permission;
  created_at: string;
}
