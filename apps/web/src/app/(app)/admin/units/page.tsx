import type { AuthenticatedUser, OrganizationalUnit } from "@psh/contracts";
import { UnitsWorkspace } from "../../../../components/admin/units-workspace";
import { serverApiFetch } from "../../../../lib/server-api-client";

// GET /admin/units, not GET /units — the latter filters isActive:true for its
// unit-scope-switcher use elsewhere in the app, which would make a deactivated unit
// permanently invisible to the one screen meant to reactivate it. Server-rendered list —
// permission enforcement happens on the API side (@RequiresPermission on GET
// /admin/units), same as every other admin page.
export default async function AdminUnitsPage() {
  const [units, me] = await Promise.all([
    serverApiFetch<OrganizationalUnit[]>("/admin/units"),
    serverApiFetch<AuthenticatedUser>("/me"),
  ]);

  return <UnitsWorkspace initialUnits={units} canManage={me.permissionKeys.includes("admin.manage_users_units")} />;
}
