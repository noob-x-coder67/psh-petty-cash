"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  EditVoucherRequestSchema,
  type EditVoucherRequest,
  type ExpenseVoucher,
} from "@psh/contracts";
import { Button, Input, Label, Sheet, SheetContent, SheetTitle } from "@psh/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { apiFetch } from "../../lib/api-client";

// BR-009/010: only Finance Manager/Super Admin reach this (gated by the caller on
// expense.edit_saved), always with a mandatory reason and a full before/after audit
// record (expenses.service.ts's editVoucher). Amounts are never editable here — BR-020
// corrections go through reversal, not an in-place edit of a posted total.
export function EditVoucherSheet({
  voucher,
  open,
  onOpenChange,
}: {
  voucher: ExpenseVoucher;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditVoucherRequest>({
    resolver: zodResolver(EditVoucherRequestSchema),
    defaultValues: {
      reason: "",
      vendorName: voucher.vendorName,
      vendorBillNo: voucher.vendorBillNo ?? undefined,
      billDate: voucher.billDate ?? undefined,
      justification: voucher.justification,
      missingBillReason: voucher.missingBillReason ?? undefined,
    },
  });

  async function onSubmit(values: EditVoucherRequest): Promise<void> {
    setServerError(null);
    try {
      await apiFetch(`/expenses/${voucher.id}`, {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Failed to save edit");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent open={open} className="overflow-y-auto p-6">
        <SheetTitle>Edit voucher {voucher.voucherNo}</SheetTitle>
        <form
          onSubmit={(event) => void handleSubmit(onSubmit)(event)}
          className="mt-4 flex flex-col gap-4"
          noValidate
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-reason">Reason for this edit (required)</Label>
            <Input id="edit-reason" {...register("reason")} />
            {errors.reason ? <p className="text-xs text-coral-500">{errors.reason.message}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-vendorName">Vendor name</Label>
            <Input id="edit-vendorName" {...register("vendorName")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-vendorBillNo">Vendor bill no.</Label>
            <Input id="edit-vendorBillNo" {...register("vendorBillNo")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-billDate">Bill date</Label>
            <Input id="edit-billDate" type="date" {...register("billDate")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-justification">Justification</Label>
            <textarea
              id="edit-justification"
              rows={3}
              className="psh-focus-ring w-full rounded-control border border-border bg-surface-1 p-3 text-sm text-ink"
              {...register("justification")}
            />
          </div>
          {serverError ? <p className="text-sm text-coral-500">{serverError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Save
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
