import type { RolePermissionMatrix } from "@psh/contracts";
import { Badge } from "@psh/ui";
import { Check } from "lucide-react";
import { ROLE_LABELS, ROLE_OPTIONS } from "./role-labels";

// Static display only — no edit controls. Appendix A's role/permission grants are
// seeded data (prisma/seed-data.ts's ROLE_PERMISSIONS), changed via a reviewed
// seed/migration rather than a live admin toggle; see the Administration plan's
// deferred "editable matrix" decision.
export function RolePermissionMatrixTable({ matrix }: { matrix: RolePermissionMatrix }) {
  const grantSet = new Set(matrix.grants.map((grant) => `${grant.roleKey}:${grant.permissionKey}`));
  // ROLE_OPTIONS gives a stable, hierarchy-ordered column order — the API's own list is
  // alphabetical by role name, which reads oddly as a matrix (e.g. Auditor before Super
  // Admin). Filtered against the API's actual roles so a role the seed hasn't created yet
  // never renders as a phantom column.
  const seededRoleKeys = new Set(matrix.roles.map((role) => role.key));
  const orderedRoleKeys = ROLE_OPTIONS.filter((key) => seededRoleKeys.has(key));

  return (
    <div className="overflow-x-auto rounded-card border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-0 text-left text-xs font-medium text-ink-muted">
            <th className="sticky left-0 bg-surface-0 px-4 py-2.5">Permission</th>
            {orderedRoleKeys.map((roleKey) => (
              <th key={roleKey} className="px-3 py-2.5 text-center whitespace-nowrap">
                {ROLE_LABELS[roleKey]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.permissions.map((permission) => (
            <tr key={permission.key} className="border-b border-border last:border-0">
              <td className="sticky left-0 bg-surface-1 px-4 py-2.5">
                <div className="flex items-center gap-1.5">
                  <p className="font-medium text-ink">{permission.key}</p>
                  {!permission.enforced ? (
                    <Badge variant="attention" title="Granted in Appendix A, but no route in the API checks this permission yet">
                      Not yet enforced
                    </Badge>
                  ) : null}
                </div>
                {permission.description ? <p className="text-xs text-ink-muted">{permission.description}</p> : null}
              </td>
              {orderedRoleKeys.map((roleKey) => (
                <td key={roleKey} className="px-3 py-2.5 text-center">
                  {grantSet.has(`${roleKey}:${permission.key}`) ? (
                    <Check className="mx-auto h-4 w-4 text-emerald-500" aria-label="Granted" />
                  ) : (
                    <span aria-label="Not granted" className="text-ink-muted">
                      —
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
