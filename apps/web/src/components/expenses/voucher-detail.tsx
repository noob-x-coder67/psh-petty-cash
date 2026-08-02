"use client";

import type { AuthenticatedUser, ExpenseVoucher } from "@psh/contracts";
import {
  Badge,
  Button,
  CategoryChip,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Money,
} from "@psh/ui";
import { useState } from "react";
import { CheckControl } from "./check-control";
import { EditVoucherSheet } from "./edit-voucher-sheet";
import { ReceiptViewer } from "./receipt-viewer";
import { ReverseVoucherDialog } from "./reverse-voucher-dialog";

export function VoucherDetail({ voucher, user }: { voucher: ExpenseVoucher; user: AuthenticatedUser }) {
  const [editOpen, setEditOpen] = useState(false);
  const [reverseOpen, setReverseOpen] = useState(false);

  const canEdit = user.permissionKeys.includes("expense.edit_saved") && voucher.state === "ACTIVE";
  const canCheck = user.permissionKeys.includes("receipt.check");
  const isNegativeAfter = voucher.balanceAfter !== null && Number(voucher.balanceAfter) < 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-ink">{voucher.voucherNo}</h1>
            {voucher.state === "REVERSED" ? <Badge variant="negative">Reversed</Badge> : null}
            {voucher.isBackdated ? <Badge variant="attention">Backdated</Badge> : null}
          </div>
          <p className="text-sm text-ink-muted">
            {voucher.vendorName} · {voucher.expenseDate}
          </p>
        </div>
        {canEdit ? (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button variant="destructive" onClick={() => setReverseOpen(true)}>
              Reverse
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Receipt</CardTitle>
          </CardHeader>
          <CardContent>
            <ReceiptViewer attachments={voucher.attachments} />
            {!voucher.hasBill ? (
              <p className="mt-3 text-sm text-ink-muted">
                No bill available. Reason: {voucher.missingBillReason}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Voucher Detail</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <CheckControl voucherId={voucher.id} checked={voucher.checkedAt !== null} canCheck={canCheck} />

            <ul className="divide-y divide-border">
              {voucher.lines.map((line) => (
                <li key={line.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CategoryChip category={line.category.name} />
                    <span className="text-ink">{line.description}</span>
                  </div>
                  <Money value={line.amount} />
                </li>
              ))}
            </ul>

            <div className="flex justify-between border-t border-border pt-3 text-sm font-medium">
              <span className="text-ink">Bill total</span>
              <Money value={voucher.billTotal} />
            </div>

            {voucher.balanceAfter !== null ? (
              <div className="flex justify-between text-sm">
                <span className="text-ink-muted">Balance after this voucher</span>
                <Money
                  value={voucher.balanceAfter}
                  className={isNegativeAfter ? "text-coral-500" : undefined}
                />
              </div>
            ) : null}

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Justification</p>
              <p className="mt-1 text-sm text-ink">{voucher.justification}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <EditVoucherSheet voucher={voucher} open={editOpen} onOpenChange={setEditOpen} />
      <ReverseVoucherDialog
        voucherId={voucher.id}
        voucherNo={voucher.voucherNo}
        open={reverseOpen}
        onOpenChange={setReverseOpen}
      />
    </div>
  );
}
