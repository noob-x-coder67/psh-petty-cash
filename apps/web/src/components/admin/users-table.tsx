"use client";

import type { AdminUser } from "@psh/contracts";
import { Badge, Button, EmptyState } from "@psh/ui";
import { Users } from "lucide-react";
import { ROLE_LABELS } from "./role-labels";

// Plain markup, not TanStack Table — admin user lists are a handful to a few dozen
// rows with no sorting/filtering requirement, unlike the expense register's
// keyset-paginated thousands of rows. Reaching for the same table library there would
// be complexity this screen doesn't need.
export function UsersTable({ users, onManage }: { users: AdminUser[]; onManage: (userId: string) => void }) {
  if (users.length === 0) {
    return <EmptyState icon={Users} title="No users yet" description="Create the first user to get started." />;
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-0 text-left text-xs font-medium text-ink-muted">
            <th className="px-4 py-2.5">Name</th>
            <th className="px-4 py-2.5">Email</th>
            <th className="px-4 py-2.5">Role</th>
            <th className="px-4 py-2.5">Units</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b border-border last:border-0">
              <td className="px-4 py-2.5 font-medium text-ink">{user.fullName}</td>
              <td className="px-4 py-2.5 text-ink-muted">{user.email}</td>
              <td className="px-4 py-2.5 text-ink-muted">{user.roles.map((role) => ROLE_LABELS[role]).join(", ")}</td>
              <td className="px-4 py-2.5 text-ink-muted">
                {user.units.length > 0 ? user.units.map((unit) => unit.code).join(", ") : "—"}
              </td>
              <td className="px-4 py-2.5">
                <Badge variant={user.isActive ? "positive" : "neutral"}>{user.isActive ? "Active" : "Inactive"}</Badge>
                {user.mustChangePassword ? (
                  <Badge variant="attention" className="ml-1.5">
                    Password pending
                  </Badge>
                ) : null}
              </td>
              <td className="px-4 py-2.5 text-right">
                <Button variant="secondary" size="sm" onClick={() => onManage(user.id)}>
                  Manage
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
