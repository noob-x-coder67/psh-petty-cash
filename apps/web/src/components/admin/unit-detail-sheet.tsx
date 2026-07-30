"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UpdateUnitRequestSchema, type OrganizationalUnit, type UpdateUnitRequest } from "@psh/contracts";
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@psh/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { apiFetch } from "../../lib/api-client";
import { UNIT_TYPE_LABELS, UNIT_TYPE_OPTIONS } from "./unit-type-labels";

export function UnitDetailSheet({
  unit,
  open,
  onOpenChange,
  canManage,
}: {
  unit: OrganizationalUnit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateUnitRequest>({
    resolver: zodResolver(UpdateUnitRequestSchema),
    defaultValues: { name: "", type: "CENTER", city: "", pettyCashEnabled: false },
  });

  // Re-seed the form whenever a different unit is opened — the sheet instance is
  // shared across rows (same pattern the row-click model in users-workspace.tsx uses).
  useEffect(() => {
    if (unit) {
      reset({ name: unit.name, type: unit.type, city: unit.city ?? "", pettyCashEnabled: unit.pettyCashEnabled });
    }
  }, [unit, reset]);

  if (!unit) return null;
  // Rebound so closures below capture a definitely-non-null reference, same reasoning
  // as user-detail-sheet.tsx's currentUser rebind.
  const currentUnit = unit;
  const isPshIsb = currentUnit.code === "PSH-ISB";
  const watchedPettyCash = watch("pettyCashEnabled");

  function resetLocalState(): void {
    setServerError(null);
    setConfirmingDeactivate(false);
  }

  function handleClose(): void {
    resetLocalState();
    onOpenChange(false);
  }

  async function onSubmit(values: UpdateUnitRequest): Promise<void> {
    setServerError(null);
    try {
      await apiFetch(`/admin/units/${currentUnit.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...values, pettyCashEnabled: isPshIsb ? false : values.pettyCashEnabled }),
      });
      router.refresh();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Failed to update unit");
    }
  }

  async function handleSetActive(isActive: boolean): Promise<void> {
    setBusy(true);
    setServerError(null);
    try {
      await apiFetch(`/admin/units/${currentUnit.id}`, { method: "PATCH", body: JSON.stringify({ isActive }) });
      setConfirmingDeactivate(false);
      router.refresh();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}>
      <SheetContent open={open} className="overflow-y-auto p-6">
        <SheetTitle>{currentUnit.code}</SheetTitle>
        <p className="text-sm text-ink-muted">{currentUnit.name}</p>

        <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="mt-4 flex flex-col gap-4" noValidate>
          <fieldset disabled={!canManage || isSubmitting} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-unit-name">Name</Label>
              <Input id="edit-unit-name" {...register("name")} />
              {errors.name ? <p className="text-xs text-coral-500">{errors.name.message}</p> : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-unit-type">Type</Label>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={!canManage || isSubmitting}>
                    <SelectTrigger id="edit-unit-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_TYPE_OPTIONS.map((type) => (
                        <SelectItem key={type} value={type}>
                          {UNIT_TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-unit-city">City</Label>
              <Input id="edit-unit-city" {...register("city")} />
            </div>
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="pettyCashEnabled"
                render={({ field }) => (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-2">
                        <Checkbox
                          id="edit-unit-petty-cash"
                          checked={field.value}
                          disabled={!canManage || isSubmitting || isPshIsb}
                          onCheckedChange={(checked) => field.onChange(checked === true)}
                        />
                      </span>
                    </TooltipTrigger>
                    {isPshIsb ? <TooltipContent>PSH-ISB cannot have petty cash enabled</TooltipContent> : null}
                  </Tooltip>
                )}
              />
              <Label htmlFor="edit-unit-petty-cash" className="font-normal">
                Petty cash enabled
              </Label>
            </div>
            {isPshIsb && watchedPettyCash === false ? (
              <p className="text-xs text-ink-muted">PSH-ISB never owns a petty-cash account (BR-016).</p>
            ) : null}
          </fieldset>

          {serverError ? <p className="text-sm text-coral-500">{serverError}</p> : null}

          {canManage ? (
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={handleClose}>
                Close
              </Button>
              <Button type="submit" disabled={isSubmitting || !isDirty}>
                {isSubmitting ? "Saving…" : "Save changes"}
              </Button>
            </div>
          ) : null}
        </form>

        {canManage ? (
          <section className="mt-6 flex flex-col gap-2 border-t border-border pt-4">
            <span className="text-xs font-medium text-ink-muted">Status</span>
            <div className="flex items-center justify-between">
              <Badge variant={currentUnit.isActive ? "positive" : "neutral"}>
                {currentUnit.isActive ? "Active" : "Inactive"}
              </Badge>
              {currentUnit.isActive ? (
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
          </section>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
