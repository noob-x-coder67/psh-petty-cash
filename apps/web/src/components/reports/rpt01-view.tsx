"use client";

import type { Rpt01Response } from "@psh/contracts";
import { Money, Tabs, TabsContent, TabsList, TabsTrigger } from "@psh/ui";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function Rpt01View({ response }: { response: Rpt01Response }) {
  const chartData = response.rows.map((row) => ({
    unit: row.unitCode,
    expectedBalance: Number(row.expectedBalance),
  }));

  return (
    <Tabs defaultValue="table">
      <TabsList>
        <TabsTrigger value="table">Table</TabsTrigger>
        <TabsTrigger value="chart">Chart</TabsTrigger>
      </TabsList>

      <TabsContent value="table">
        <div className="overflow-x-auto rounded-card border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-0">
              <tr>
                <th className="border-b border-border px-3 py-2 text-left font-medium text-ink-muted">Unit</th>
                <th className="border-b border-border px-3 py-2 text-right font-medium text-ink-muted">Opening</th>
                <th className="border-b border-border px-3 py-2 text-right font-medium text-ink-muted">
                  Allocations
                </th>
                <th className="border-b border-border px-3 py-2 text-right font-medium text-ink-muted">
                  Replenishments
                </th>
                <th className="border-b border-border px-3 py-2 text-right font-medium text-ink-muted">
                  Expenditure
                </th>
                <th className="border-b border-border px-3 py-2 text-right font-medium text-ink-muted">
                  Adjustments
                </th>
                <th className="border-b border-border px-3 py-2 text-right font-medium text-ink-muted">
                  Expected Balance
                </th>
              </tr>
            </thead>
            <tbody>
              {response.rows.map((row) => (
                <tr key={row.unitId} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 text-ink">
                    {row.unitCode} — {row.unitName}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={row.openingBalance} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={row.allocations} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={row.replenishments} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={row.expenditure} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={row.adjustments} />
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    <Money value={row.expectedBalance} />
                  </td>
                </tr>
              ))}
              {response.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-ink-muted">
                    No units match these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
            {response.rows.length > 0 ? (
              <tfoot>
                <tr className="border-t-2 border-border bg-surface-0 font-semibold">
                  <td className="px-3 py-2 text-ink">Total</td>
                  <td className="px-3 py-2 text-right">
                    <Money value={response.totals.openingBalance} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={response.totals.allocations} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={response.totals.replenishments} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={response.totals.expenditure} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={response.totals.adjustments} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={response.totals.expectedBalance} />
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </TabsContent>

      <TabsContent value="chart">
        <div className="h-80 rounded-card border border-border p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="unit" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip formatter={(value) => <Money value={Number(value)} />} />
              <Bar dataKey="expectedBalance" fill="var(--color-royal-500)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </TabsContent>
    </Tabs>
  );
}
