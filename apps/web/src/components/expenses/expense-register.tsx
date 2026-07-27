"use client";

import type { ExpenseVoucher, OrganizationalUnit } from "@psh/contracts";
import { Badge, Button, CategoryChip, CheckedMarker, Input, Money } from "@psh/ui";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { apiFetch } from "../../lib/api-client";

// Matches ExpensesRepository.listVouchersForAccount's default `limit` — the controller
// doesn't expose a page-size query param, so this has to track that default rather
// than being independently configurable.
const PAGE_SIZE = 50;

interface RegisterFilters {
  search: string;
  checked: "all" | "true" | "false";
  category: "ALL" | "BUILDING" | "VEHICLE" | "OTHER";
  dateFrom: string;
  dateTo: string;
}

type Cursor = { expenseDate: string; id: string };

interface RegisterPage {
  vouchers: ExpenseVoucher[];
  nextCursor: Cursor | null;
}

// Keyset pagination (NFR-003) — the API's sort order is fixed (expense_date, id desc);
// "Load more" advances the cursor rather than jumping to an arbitrary page number.
async function fetchPage(unitId: string, filters: RegisterFilters, cursor?: Cursor): Promise<RegisterPage> {
  const params = new URLSearchParams({ unitId });
  if (filters.search) params.set("q", filters.search);
  if (filters.checked !== "all") params.set("checked", filters.checked);
  if (filters.category !== "ALL") params.set("category", filters.category);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (cursor) {
    params.set("cursorDate", cursor.expenseDate);
    params.set("cursorId", cursor.id);
  }
  const vouchers = await apiFetch<ExpenseVoucher[]>(`/expenses?${params.toString()}`);
  const last = vouchers.at(-1);
  const nextCursor = vouchers.length === PAGE_SIZE && last ? { expenseDate: last.expenseDate, id: last.id } : null;
  return { vouchers, nextCursor };
}

const columnHelper = createColumnHelper<ExpenseVoucher>();

const columns = [
  columnHelper.accessor("expenseDate", { header: "Date" }),
  columnHelper.accessor("voucherNo", { header: "Voucher No." }),
  columnHelper.accessor("vendorName", { header: "Vendor" }),
  columnHelper.display({
    id: "category",
    header: "Category",
    cell: (info) => {
      const categories = Array.from(new Set(info.row.original.lines.map((line) => line.category)));
      return (
        <div className="flex gap-1">
          {categories.map((category) => (
            <CategoryChip key={category} category={category} />
          ))}
        </div>
      );
    },
  }),
  columnHelper.accessor("billTotal", {
    header: "Amount",
    cell: (info) => <Money value={info.getValue()} />,
  }),
  columnHelper.display({
    id: "checked",
    header: "Checked",
    cell: (info) => <CheckedMarker checked={info.row.original.checkedAt !== null} />,
  }),
  columnHelper.display({
    id: "state",
    header: "State",
    cell: (info) => (info.row.original.state === "REVERSED" ? <Badge variant="negative">Reversed</Badge> : null),
  }),
];

export function ExpenseRegister({ unit }: { unit: OrganizationalUnit }) {
  const router = useRouter();
  const [filters, setFilters] = useState<RegisterFilters>({
    search: "",
    checked: "all",
    category: "ALL",
    dateFrom: "",
    dateTo: "",
  });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["expenses", unit.id, filters],
    queryFn: ({ pageParam }: { pageParam?: Cursor }) => fetchPage(unit.id, filters, pageParam),
    initialPageParam: undefined as Cursor | undefined,
    getNextPageParam: (lastPage: RegisterPage) => lastPage.nextCursor ?? undefined,
  });

  const rows = useMemo(() => data?.pages.flatMap((page) => page.vouchers) ?? [], [data]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">Expense Register</h1>
        <p className="text-sm text-ink-muted">
          {unit.name} ({unit.code})
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Input
          aria-label="Search voucher, vendor, or justification"
          placeholder="Search voucher, vendor, justification..."
          value={filters.search}
          onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
          className="w-64"
        />
        <select
          aria-label="Category"
          value={filters.category}
          onChange={(event) =>
            setFilters((prev) => ({ ...prev, category: event.target.value as RegisterFilters["category"] }))
          }
          className="psh-focus-ring h-10 rounded-control border border-border bg-surface-1 px-2 text-sm text-ink"
        >
          <option value="ALL">All categories</option>
          <option value="BUILDING">Building</option>
          <option value="VEHICLE">Vehicle</option>
          <option value="OTHER">Other</option>
        </select>
        <select
          aria-label="Checked status"
          value={filters.checked}
          onChange={(event) =>
            setFilters((prev) => ({ ...prev, checked: event.target.value as RegisterFilters["checked"] }))
          }
          className="psh-focus-ring h-10 rounded-control border border-border bg-surface-1 px-2 text-sm text-ink"
        >
          <option value="all">Checked + Unchecked</option>
          <option value="true">Checked only</option>
          <option value="false">Unchecked only</option>
        </select>
        <Input
          aria-label="From date"
          type="date"
          value={filters.dateFrom}
          onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
          className="w-40"
        />
        <Input
          aria-label="To date"
          type="date"
          value={filters.dateTo}
          onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
          className="w-40"
        />
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-ink-muted">
        {table.getAllLeafColumns().map((column) => (
          <label key={column.id} className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={column.getIsVisible()}
              onChange={column.getToggleVisibilityHandler()}
              className="h-3.5 w-3.5"
            />
            {typeof column.columnDef.header === "string" ? column.columnDef.header : column.id}
          </label>
        ))}
      </div>

      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface-0">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="cursor-pointer select-none border-b border-border px-3 py-2 text-left font-medium text-ink-muted"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" ? <ChevronUp className="h-3 w-3" aria-hidden /> : null}
                      {header.column.getIsSorted() === "desc" ? (
                        <ChevronDown className="h-3 w-3" aria-hidden />
                      ) : null}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="cursor-pointer border-b border-border last:border-0 hover:bg-surface-0"
                onClick={() => router.push(`/expenses/${row.original.id}`)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 text-ink">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {!isLoading && rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-ink-muted">
                  No vouchers match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {hasNextPage ? (
        <Button
          variant="secondary"
          onClick={() => void fetchNextPage()}
          disabled={isFetchingNextPage}
          className="self-center"
        >
          {isFetchingNextPage ? "Loading..." : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}
