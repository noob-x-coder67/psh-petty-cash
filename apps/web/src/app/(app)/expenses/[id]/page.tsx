import type { AuthenticatedUser, ExpenseVoucher } from "@psh/contracts";
import { notFound } from "next/navigation";
import { VoucherDetail } from "../../../../components/expenses/voucher-detail";
import { ApiError } from "../../../../lib/api-error";
import { serverApiFetch } from "../../../../lib/server-api-client";

// Route segment is the voucher's UUID id, not voucherNo (deviating from the Build
// Plan's illustrative [voucherNo] route name) — GET /expenses/:id only supports lookup
// by id, and there's no by-voucherNo endpoint. Voucher ids are never hand-typed by a
// user; every link to this page (Register rows, the Command Center receipt queue,
// Record Expense's post-save link) already has the id, so this doesn't cost anything
// in practice.
export default async function VoucherDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let voucher: ExpenseVoucher;
  try {
    voucher = await serverApiFetch<ExpenseVoucher>(`/expenses/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }
  const user = await serverApiFetch<AuthenticatedUser>("/me");

  return <VoucherDetail voucher={voucher} user={user} />;
}
