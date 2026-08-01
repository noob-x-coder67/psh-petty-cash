"use client";

import {
  EXPENSE_ALL_UNITS,
  type ExpenseListUnitScope,
  type ExpenseRegisterVoucher,
  type OrganizationalUnit,
} from "@psh/contracts";
import {
  Badge,
  Button,
  CategoryChip,
  CheckedMarker,
  Checkbox,
  EmptyState,
  Input,
  Label,
  Money,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  cn,
} from "@psh/ui";
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
import { ChevronDown, ChevronUp, Columns3, Receipt, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../../lib/api-client";

// Matches ExpensesRepository.listVouchersForAccounts' default `limit` — the controller
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
  vouchers: ExpenseRegisterVoucher[];
  nextCursor: Cursor | null;
}

// Keyset pagination (NFR-003) — the API's sort order is fixed (expense_date, id desc);
// "Load more" advances the cursor rather than jumping to an arbitrary page number.
async function fetchPage(
  unitScope: ExpenseListUnitScope,
  filters: RegisterFilters,
  cursor?: Cursor,
): Promise<RegisterPage> {
  const params = new URLSearchParams({ unitId: unitScope });
  if (filters.search) params.set("q", filters.search);
  if (filters.checked !== "all") params.set("checked", filters.checked);
  if (filters.category !== "ALL") params.set("category", filters.category);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (cursor) {
    params.set("cursorDate", cursor.expenseDate);
    params.set("cursorId", cursor.id);
  }
  const vouchers = await apiFetch<ExpenseRegisterVoucher[]>(`/expenses?${params.toString()}`);
  const last = vouchers.at(-1);
  const nextCursor =
    vouchers.length === PAGE_SIZE && last ? { expenseDate: last.expenseDate, id: last.id } : null;
  return { vouchers, nextCursor };
}

const columnHelper = createColumnHelper<ExpenseRegisterVoucher>();

const columns = [
  columnHelper.accessor("expenseDate", { header: "Date" }),
  columnHelper.accessor("voucherNo", { header: "Voucher No." }),
  columnHelper.accessor((row) => row.unit.code, { id: "unit", header: "Unit" }),
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
    cell: (info) => <Money value={info.getValue()} className="font-medium" />,
  }),
  columnHelper.display({
    id: "checked",
    header: "Checked",
    cell: (info) => <CheckedMarker checked={info.row.original.checkedAt !== null} />,
  }),
  columnHelper.display({
    id: "state",
    header: "State",
    cell: (info) =>
      info.row.original.state === "REVERSED" ? <Badge variant="negative">Reversed</Badge> : null,
  }),
];

export function ExpenseRegister({ unit }: { unit: OrganizationalUnit | null }) {
  const router = useRouter();
  const unitScope: ExpenseListUnitScope = unit?.id ?? EXPENSE_ALL_UNITS;
  const [filters, setFilters] = useState<RegisterFilters>({
    search: "",
    checked: "all",
    category: "ALL",
    dateFrom: "",
    dateTo: "",
  });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    unit: unit === null,
  });

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["expenses", unitScope, filters],
    queryFn: ({ pageParam }: { pageParam?: Cursor }) => fetchPage(unitScope, filters, pageParam),
    initialPageParam: undefined as Cursor | undefined,
    getNextPageParam: (lastPage: RegisterPage) => lastPage.nextCursor ?? undefined,
  });

  const rows = useMemo(() => data?.pages.flatMap((page) => page.vouchers) ?? [], [data]);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setColumnVisibility((current) => ({ ...current, unit: unit === null }));
  }, [unit]);

  useEffect(() => {
    if (!columnsOpen) return;
    function onClickOutside(event: MouseEvent): void {
      if (columnsRef.current && !columnsRef.current.contains(event.target as Node))
        setColumnsOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [columnsOpen]);

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
          {unit ? `${unit.name} (${unit.code})` : "All petty-cash units"}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-muted-surface p-4">
        <div className="flex min-w-56 flex-1 flex-col gap-1.5">
          <Label htmlFor="expense-search">Search</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden
            />
            <Input
              id="expense-search"
              aria-label="Search voucher, vendor, or justification"
              placeholder="Voucher, vendor, justification..."
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expense-category">Category</Label>
          <Select
            value={filters.category}
            onValueChange={(value) =>
              setFilters((prev) => ({ ...prev, category: value as RegisterFilters["category"] }))
            }
          >
            <SelectTrigger id="expense-category" aria-label="Category" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All categories</SelectItem>
              <SelectItem value="BUILDING">Building</SelectItem>
              <SelectItem value="VEHICLE">Vehicle</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expense-checked">Status</Label>
          <Select
            value={filters.checked}
            onValueChange={(value) =>
              setFilters((prev) => ({ ...prev, checked: value as RegisterFilters["checked"] }))
            }
          >
            <SelectTrigger id="expense-checked" aria-label="Checked status" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Checked + Unchecked</SelectItem>
              <SelectItem value="true">Checked only</SelectItem>
              <SelectItem value="false">Unchecked only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expense-date-from">From</Label>
          <Input
            id="expense-date-from"
            aria-label="From date"
            type="date"
            value={filters.dateFrom}
            onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
            className="w-40"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expense-date-to">To</Label>
          <Input
            id="expense-date-to"
            aria-label="To date"
            type="date"
            value={filters.dateTo}
            onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
            className="w-40"
          />
        </div>

        <div ref={columnsRef} className="relative">
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            onClick={() => setColumnsOpen((v) => !v)}
            aria-expanded={columnsOpen}
            aria-haspopup="true"
          >
            <Columns3 className="h-4 w-4" aria-hidden />
            Columns
          </Button>
          {columnsOpen ? (
            <div className="absolute right-0 top-full z-popover mt-2 w-48 rounded-control border border-border bg-elevated p-2 shadow-3">
              {table.getAllLeafColumns().map((column) => (
                <label
                  key={column.id}
                  className="flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-sm text-ink hover:bg-interactive-surface"
                >
                  <Checkbox
                    checked={column.getIsVisible()}
                    onCheckedChange={() => column.toggleVisibility()}
                  />
                  {typeof column.columnDef.header === "string"
                    ? column.columnDef.header
                    : column.id}
                </label>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-sticky bg-muted-surface">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={cn(
                      "psh-focus-ring cursor-pointer select-none border-b border-border px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted transition-colors hover:text-ink",
                      header.column.id === "billTotal" && "text-right",
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div
                      className={cn(
                        "flex items-center gap-1",
                        header.column.id === "billTotal" && "justify-end",
                      )}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" ? (
                        <ChevronUp className="h-3 w-3" aria-hidden />
                      ) : null}
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
            {isLoading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <tr key={index} className="border-b border-border last:border-0">
                  {table.getAllLeafColumns().map((column) => (
                    <td key={column.id} className="px-3 py-3">
                      <Skeleton className="h-4 w-full max-w-32" />
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-interactive-surface"
                    onClick={() => router.push(`/expenses/${row.original.id}`)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={cn(
                          "px-3 py-2.5 text-ink",
                          cell.column.id === "billTotal" && "text-right tabular-nums",
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="p-0">
                      <EmptyState
                        icon={Receipt}
                        title="No vouchers match these filters"
                        description="Try widening the date range or clearing a filter."
                        className="rounded-none border-none"
                      />
                    </td>
                  </tr>
                ) : null}
              </>
            )}
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
