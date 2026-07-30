"use client";

import type { AdminUser, OrganizationalUnit } from "@psh/contracts";
import { Button } from "@psh/ui";
import { Plus } from "lucide-react";
import { useState } from "react";
import { CreateUserSheet } from "./create-user-sheet";
import { UserDetailSheet } from "./user-detail-sheet";
import { UsersTable } from "./users-table";

export function UsersWorkspace({
  initialUsers,
  units,
  canManageAccounts,
  canManageAccess,
}: {
  initialUsers: AdminUser[];
  units: OrganizationalUnit[];
  canManageAccounts: boolean;
  canManageAccess: boolean;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);

  // initialUsers is server-fetched fresh on every router.refresh() the child sheets
  // trigger after a mutation — no client-side cache/state duplication of the list.
  const detailUser = initialUsers.find((user) => user.id === detailUserId) ?? null;

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Users</h1>
          <p className="mt-1 text-sm text-ink-muted">Accounts, roles and unit access.</p>
        </div>
        {canManageAccounts ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Create user
          </Button>
        ) : null}
      </div>

      <UsersTable users={initialUsers} onManage={setDetailUserId} />

      {canManageAccounts ? <CreateUserSheet open={createOpen} onOpenChange={setCreateOpen} /> : null}

      <UserDetailSheet
        user={detailUser}
        open={detailUserId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailUserId(null);
        }}
        units={units}
        canManageAccounts={canManageAccounts}
        canManageAccess={canManageAccess}
      />
    </div>
  );
}
