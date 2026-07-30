import type { RolePermissionMatrix } from "@psh/contracts";
import { RolePermissionMatrixTable } from "../../../../components/admin/role-permission-matrix";
import { serverApiFetch } from "../../../../lib/server-api-client";

// Server-rendered, read-only — permission enforcement happens on the API side
// (@RequiresPermission on GET /admin/roles), same as every other admin page. No mutation
// path exists yet (see the Administration plan's deferred "editable matrix" decision), so
// there's no client component here at all, unlike Users/Units.
export default async function AdminRolesPage() {
  const matrix = await serverApiFetch<RolePermissionMatrix>("/admin/roles");

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Permissions</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Role-to-permission mapping (Appendix A). Read-only — changes go through a reviewed seed update, not this
          screen.
        </p>
      </div>

      <RolePermissionMatrixTable matrix={matrix} />
    </div>
  );
}
