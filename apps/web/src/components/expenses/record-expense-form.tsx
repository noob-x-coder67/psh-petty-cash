"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  CreateVoucherRequestSchema,
  type CreateVoucherRequest,
  type CreateVoucherResult,
  type DashboardUnitResponse,
  type OrganizationalUnit,
} from "@psh/contracts";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Money, cn } from "@psh/ui";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FormProvider, useFieldArray, useForm } from "react-hook-form";
import { apiFetch } from "../../lib/api-client";
import { Field } from "./field";
import { LineItemRow } from "./line-item-row";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RecordExpenseForm({ unit }: { unit: OrganizationalUnit }) {
  const router = useRouter();
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateVoucherResult | null>(null);

  const { data: unitDashboard } = useQuery({
    queryKey: ["dashboard", "unit", unit.id],
    queryFn: () => apiFetch<DashboardUnitResponse>(`/dashboard/unit/${unit.id}`),
  });

  const form = useForm<CreateVoucherRequest>({
    resolver: zodResolver(CreateVoucherRequestSchema),
    defaultValues: {
      unitId: unit.id,
      expenseDate: todayIsoDate(),
      vendorName: "",
      justification: "",
      billTotal: "",
      hasBill: true,
      lines: [{ description: "", category: "BUILDING", amount: "" }],
    },
  });
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  const lines = watch("lines");
  const billTotal = watch("billTotal");
  const hasBill = watch("hasBill");

  const linesSum = useMemo(
    () => lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0),
    [lines],
  );
  const billTotalNumber = Number(billTotal) || 0;
  const totalsMatch = billTotal.length > 0 && Math.abs(linesSum - billTotalNumber) < 0.005;

  const currentBalance = unitDashboard ? Number(unitDashboard.balance) : null;
  const projectedBalance = currentBalance !== null ? currentBalance - billTotalNumber : null;

  async function onSubmit(values: CreateVoucherRequest): Promise<void> {
    setServerError(null);
    try {
      const created = await apiFetch<CreateVoucherResult>("/expenses", {
        method: "POST",
        body: JSON.stringify(values),
      });

      if (fileToUpload) {
        const formData = new FormData();
        formData.append("file", fileToUpload);
        await apiFetch(`/expenses/${created.voucher.id}/attachments`, {
          method: "POST",
          body: formData,
        });
      }

      setResult(created);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Failed to save voucher");
    }
  }

  if (result) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Card className="border-emerald-500/40">
          <CardHeader>
            <CardTitle>Voucher {result.voucher.voucherNo} saved</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {result.balanceWarning ? (
              <p className="text-sm text-coral-500">This entry has driven the account balance negative.</p>
            ) : null}
            {result.duplicateWarning ? (
              <p className="text-sm text-amber-500">
                A similar voucher (same vendor, date, and amount) already exists.
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button onClick={() => router.push(`/expenses/${result.voucher.id}`)}>View voucher</Button>
              <Button variant="secondary" onClick={() => router.refresh()}>
                Record another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="flex flex-col gap-6 p-6" noValidate>
        <div>
          <h1 className="text-lg font-semibold text-ink">Record Expense</h1>
          <p className="text-sm text-ink-muted">
            {unit.name} ({unit.code})
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bill Header</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Vendor name" error={errors.vendorName?.message}>
              <Input autoFocus {...register("vendorName")} />
            </Field>
            <Field label="Vendor bill no. (optional)" error={errors.vendorBillNo?.message}>
              <Input {...register("vendorBillNo")} />
            </Field>
            <Field label="Expense date" error={errors.expenseDate?.message}>
              <Input type="date" {...register("expenseDate")} />
            </Field>
            <Field label="Bill date (optional)" error={errors.billDate?.message}>
              <Input type="date" {...register("billDate")} />
            </Field>
            <Field label="Bill total" error={errors.billTotal?.message}>
              <Input inputMode="decimal" placeholder="0.00" {...register("billTotal")} />
            </Field>
            <div className="flex items-center gap-2 pt-6">
              <input id="hasBill" type="checkbox" className="h-4 w-4" {...register("hasBill")} />
              <Label htmlFor="hasBill">Bill available</Label>
            </div>
            {!hasBill ? (
              <Field
                label="Reason bill is missing"
                error={errors.missingBillReason?.message}
                className="sm:col-span-2"
              >
                <Input {...register("missingBillReason")} />
              </Field>
            ) : null}
            <Field label="Justification" error={errors.justification?.message} className="sm:col-span-2">
              <textarea
                rows={3}
                className="psh-focus-ring w-full rounded-control border border-border bg-surface-1 p-3 text-sm text-ink"
                {...register("justification")}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Line Items</CardTitle>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                totalsMatch ? "bg-emerald-500/10 text-emerald-500" : "bg-surface-0 text-ink-muted",
              )}
            >
              {totalsMatch ? "Match" : "Not yet matched"}
            </span>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {fields.map((field, index) => (
              <LineItemRow
                key={field.id}
                index={index}
                onRemove={fields.length > 1 ? () => remove(index) : undefined}
              />
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="self-start"
              onClick={() => append({ description: "", category: "BUILDING", amount: "" })}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add line
            </Button>
            <div className="flex justify-between border-t border-border pt-3 text-sm">
              <span className="text-ink-muted">Lines total</span>
              <Money value={linesSum} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Receipt</CardTitle>
          </CardHeader>
          <CardContent>
            <input
              type="file"
              aria-label="Receipt file"
              accept="image/jpeg,image/png,application/pdf"
              className="text-sm text-ink"
              onChange={(event) => setFileToUpload(event.target.files?.[0] ?? null)}
            />
          </CardContent>
        </Card>

        {currentBalance !== null ? (
          <Card>
            <CardContent className="flex items-center justify-between p-4 text-sm">
              <span className="text-ink-muted">Balance after this entry</span>
              <Money
                value={projectedBalance ?? currentBalance}
                className={cn(
                  "text-lg font-semibold",
                  (projectedBalance ?? 0) < 0 && "text-coral-500",
                )}
              />
            </CardContent>
          </Card>
        ) : null}

        {serverError ? <p className="text-sm text-coral-500">{serverError}</p> : null}

        <Button type="submit" disabled={isSubmitting} className="self-start">
          {isSubmitting ? "Saving..." : "Save voucher"}
        </Button>
      </form>
    </FormProvider>
  );
}
