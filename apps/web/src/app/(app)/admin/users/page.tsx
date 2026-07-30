import type { AdminUser, AuthenticatedUser, OrganizationalUnit } from "@psh/contracts";
import { UsersWorkspace } from "../../../../components/admin/users-workspace";
import { serverApiFetch } from "../../../../lib/server-api-client";

// Server-rendered list — permission enforcement happens on the API side
// (@RequiresPermission on GET /admin/users), same as every other page in this app;
// there's no separate client-side gate here beyond the Administration tab itself being
// hidden for a user without either admin permission (workspace-tabs.tsx).
export default async function AdminUsersPage() {
  const [users, units, me] = await Promise.all([
    serverApiFetch<AdminUser[]>("/admin/users"),
    serverApiFetch<OrganizationalUnit[]>("/units"),
    serverApiFetch<AuthenticatedUser>("/me"),
  ]);

  return (
    <UsersWorkspace
      initialUsers={users}
      units={units}
      canManageAccounts={me.permissionKeys.includes("admin.manage_users_units")}
      canManageAccess={me.permissionKeys.includes("admin.manage_unit_access")}
    />
  );
}
