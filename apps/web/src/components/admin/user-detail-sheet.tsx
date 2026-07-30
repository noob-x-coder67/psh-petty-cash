"use client";

import type { AdminUser, AdminUserRole, OrganizationalUnit, ResetPasswordResult } from "@psh/contracts";
import { Alert, Badge, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Sheet, SheetContent, SheetTitle } from "@psh/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "../../lib/api-client";
import { ROLE_LABELS, ROLE_OPTIONS } from "./role-labels";

export function UserDetailSheet({
  user,
  open,
  onOpenChange,
  units,
  canManageAccounts,
  canManageAccess,
}: {
  user: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  units: OrganizationalUnit[];
  canManageAccounts: boolean;
  canManageAccess: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetResult, setResetResult] = useState<ResetPasswordResult | null>(null);
  const [addUnitId, setAddUnitId] = useState<string>("");

  if (!user) return null;
  // Rebound so closures below capture a definitely-non-null reference — `if (!user)
  // return null` alone doesn't narrow `user` inside function declarations defined
  // further down this component body.
  const currentUser = user;

  const grantableUnits = units.filter((unit) => !currentUser.units.some((granted) => granted.id === unit.id));

  function resetLocalState(): void {
    setError(null);
    setConfirmingDeactivate(false);
    setConfirmingReset(false);
    setResetResult(null);
    setAddUnitId("");
  }

  function handleClose(): void {
    resetLocalState();
    onOpenChange(false);
  }

  async function runAction(action: () => Promise<unknown>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRoleChange(role: AdminUserRole): Promise<void> {
    await runAction(() =>
      apiFetch(`/admin/users/${currentUser.id}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
    );
  }

  async function handleGrantUnit(): Promise<void> {
    if (!addUnitId) return;
    await runAction(() =>
      apiFetch(`/admin/users/${currentUser.id}/units`, { method: "POST", body: JSON.stringify({ unitId: addUnitId }) }),
    );
    setAddUnitId("");
  }

  async function handleRevokeUnit(unitId: string): Promise<void> {
    await runAction(() => apiFetch(`/admin/users/${currentUser.id}/units/${unitId}`, { method: "DELETE" }));
  }

  async function handleSetActive(isActive: boolean): Promise<void> {
    await runAction(() =>
      apiFetch(`/admin/users/${currentUser.id}/status`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
    );
    setConfirmingDeactivate(false);
  }

  async function handleResetPassword(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<ResetPasswordResult>(`/admin/users/${currentUser.id}/reset-password`, { method: "POST" });
      setResetResult(result);
      setConfirmingReset(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}>
      <SheetContent open={open} className="overflow-y-auto p-6">
        <SheetTitle>{user.fullName}</SheetTitle>
        <p className="text-sm text-ink-muted">{user.email}</p>

        <div className="mt-4 flex flex-col gap-6">
          {error ? <p className="text-sm text-coral-500">{error}</p> : null}

          <section className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-muted">Role</span>
            <Select value={user.roles[0]} onValueChange={(value) => void handleRoleChange(value as AdminUserRole)} disabled={!canManageAccess || busy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          <section className="flex flex-col gap-2">
            <span className="text-xs font-medium text-ink-muted">Unit access</span>
            <div className="flex flex-wrap gap-1.5">
              {user.units.length === 0 ? <span className="text-sm text-ink-muted">No units granted.</span> : null}
              {user.units.map((unit) => (
                <Badge key={unit.id} variant="neutral" className="gap-1.5">
                  {unit.code}
                  {canManageAccess ? (
                    <button
                      type="button"
                      onClick={() => void handleRevokeUnit(unit.id)}
                      disabled={busy}
                      aria-label={`Revoke access to ${unit.code}`}
                      className="text-ink-muted hover:text-coral-500"
                    >
                      ×
                    </button>
                  ) : null}
                </Badge>
              ))}
            </div>
            {canManageAccess && grantableUnits.length > 0 ? (
              <div className="flex gap-2">
                <Select value={addUnitId} onValueChange={setAddUnitId} disabled={busy}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Grant access to…" />
                  </SelectTrigger>
                  <SelectContent>
                    {grantableUnits.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.code} — {unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="secondary" size="sm" onClick={() => void handleGrantUnit()} disabled={!addUnitId || busy}>
                  Grant
                </Button>
              </div>
            ) : null}
          </section>

          {canManageAccounts ? (
            <section className="flex flex-col gap-2 border-t border-border pt-4">
              <span className="text-xs font-medium text-ink-muted">Account</span>
              <div className="flex items-center justify-between">
                <Badge variant={user.isActive ? "positive" : "neutral"}>{user.isActive ? "Active" : "Inactive"}</Badge>
                {user.isActive ? (
                  confirmingDeactivate ? (
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setConfirmingDeactivate(false)} disabled={busy}>
                        Cancel
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => void handleSetActive(false)} disabled={busy}>
                        Confirm deactivate
                      </Button>
                    </div>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => setConfirmingDeactivate(true)} disabled={busy}>
                      Deactivate
                    </Button>
                  )
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => void handleSetActive(true)} disabled={busy}>
                    Reactivate
                  </Button>
                )}
              </div>

              {resetResult ? (
                <Alert variant="success" title="Password reset">
                  <div className="mt-2 flex flex-col gap-1.5">
                    <p className="text-sm text-ink-muted">
                      Share this new temporary password with {user.fullName} — it won&apos;t be shown again.
                    </p>
                    <code className="rounded-control border border-border bg-surface-0 px-3 py-2 text-sm font-mono text-ink select-all">
                      {resetResult.temporaryPassword}
                    </code>
                  </div>
                </Alert>
              ) : confirmingReset ? (
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setConfirmingReset(false)} disabled={busy}>
                    Cancel
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => void handleResetPassword()} disabled={busy}>
                    Confirm reset password
                  </Button>
                </div>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setConfirmingReset(true)} disabled={busy}>
                  Reset password
                </Button>
              )}
            </section>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
