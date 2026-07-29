"use client";

import type { ReportFilter, Rpt14Response } from "@psh/contracts";
import { Button, EmptyState, Skeleton } from "@psh/ui";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { ScrollText } from "lucide-react";
import { useMemo } from "react";
import { apiFetch } from "../../lib/api-client";
import { ReportHeader } from "./report-header";

type Cursor = { occurredAt: string; id: string };
type Rpt14Row = Rpt14Response["rows"][number];

// RPT-14 is the one report whose result set isn't bounded by a single date-range
// preview the way RPT-01..13/15/16 are — every login, view and mutation writes a row,
// so it gets its own useInfiniteQuery + keyset cursor (mirroring ExpenseRegister's
// exact pattern) instead of the shared single-shot useReportQuery every other report
// view uses.
async function fetchPage(filter: ReportFilter, cursor?: Cursor): Promise<Rpt14Response> {
  const params = new URLSearchParams({ filters: JSON.stringify(filter) });
  if (cursor) {
    params.set("cursorOccurredAt", cursor.occurredAt);
    params.set("cursorId", cursor.id);
  }
  return apiFetch<Rpt14Response>(`/reports/RPT-14?${params.toString()}`);
}

const columnHelper = createColumnHelper<Rpt14Row>();

const columns = [
  columnHelper.accessor("occurredAt", {
    header: "When",
    cell: (info) => new Date(info.getValue()).toLocaleString(),
  }),
  columnHelper.accessor("actorName", { header: "Actor", cell: (info) => info.getValue() ?? "—" }),
  columnHelper.accessor("actorRole", { header: "Role", cell: (info) => info.getValue() ?? "—" }),
  columnHelper.accessor("action", { header: "Action" }),
  columnHelper.accessor("entityType", { header: "Entity" }),
  columnHelper.accessor("unitCode", { header: "Unit", cell: (info) => info.getValue() ?? "—" }),
  columnHelper.accessor("reason", { header: "Reason", cell: (info) => info.getValue() ?? "—" }),
];

export function Rpt14View({ filter }: { filter: ReportFilter }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, error } = useInfiniteQuery({
    queryKey: ["report", "RPT-14", filter],
    queryFn: ({ pageParam }: { pageParam?: Cursor }) => fetchPage(filter, pageParam),
    initialPageParam: undefined as Cursor | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const rows = useMemo(() => data?.pages.flatMap((page) => page.rows) ?? [], [data]);
  const firstPage = data?.pages[0];

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="flex flex-col gap-4">
      {isError ? (
        <p className="text-sm text-coral-500">
          Could not load this report{error instanceof Error ? `: ${error.message}` : "."}
        </p>
      ) : null}

      {firstPage ? <ReportHeader title="Audit Trail" response={firstPage} /> : null}

      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-sticky bg-muted-surface">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="border-b border-border px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <tr key={index} className="border-b border-border last:border-0">
                  {columns.map((_, colIndex) => (
                    <td key={colIndex} className="px-3 py-3">
                      <Skeleton className="h-4 w-full max-w-32" />
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2.5 text-ink">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="p-0">
                      <EmptyState
                        icon={ScrollText}
                        title="No audit activity matches these filters"
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
