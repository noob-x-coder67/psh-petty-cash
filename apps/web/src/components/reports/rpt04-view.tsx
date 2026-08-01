"use client";

import type { Rpt04Response } from "@psh/contracts";
import { Money, Tabs, TabsContent, TabsList, TabsTrigger } from "@psh/ui";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const CATEGORY_COLORS = Array.from({ length: 6 }, (_, index) => `var(--color-chart-${index + 1})`);

function categoryColor(index: number): string {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length] ?? "var(--color-chart-1)";
}

export function Rpt04View({ response }: { response: Rpt04Response }) {
  const barData = response.rows.map((row) => ({
    categoryId: row.categoryId,
    categoryName: row.category.name,
    total: Number(row.totalAmount),
  }));

  // Reshape the flat trend series into one row per month with a stable category-ID
  // column per managed category. Display names remain editable labels, never data keys.
  const trendByMonth = new Map<string, Record<string, number | string>>();
  for (const point of response.trend) {
    const key = `${point.year}-${String(point.month).padStart(2, "0")}`;
    const row = trendByMonth.get(key) ?? { month: key };
    row[point.categoryId] = Number(point.totalAmount);
    trendByMonth.set(key, row);
  }
  const trendData = Array.from(trendByMonth.values()).sort((a, b) =>
    String(a.month).localeCompare(String(b.month)),
  );
  const trendCategoryIds = new Set(response.trend.map((point) => point.categoryId));
  const trendCategories = response.rows.filter((row) => trendCategoryIds.has(row.categoryId));

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-0">
            <tr>
              <th className="border-b border-border px-3 py-2 text-left font-medium text-ink-muted">Category</th>
              <th className="border-b border-border px-3 py-2 text-right font-medium text-ink-muted">Total</th>
              <th className="border-b border-border px-3 py-2 text-right font-medium text-ink-muted">Lines</th>
              <th className="border-b border-border px-3 py-2 text-right font-medium text-ink-muted">% of Total</th>
            </tr>
          </thead>
          <tbody>
            {response.rows.map((row) => (
              <tr key={row.categoryId} className="border-b border-border last:border-0">
                <td className="px-3 py-2 text-ink">
                  {row.category.name}
                  {row.category.isActive ? "" : " (Inactive)"}
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={row.totalAmount} />
                </td>
                <td className="px-3 py-2 text-right text-ink">{row.lineCount}</td>
                <td className="px-3 py-2 text-right text-ink">{row.percentageOfTotal}%</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-surface-0 font-semibold">
              <td className="px-3 py-2 text-ink">Total</td>
              <td className="px-3 py-2 text-right">
                <Money value={response.totalAmount} />
              </td>
              <td className="px-3 py-2" />
              <td className="px-3 py-2 text-right text-ink">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <Tabs defaultValue="split">
        <TabsList>
          <TabsTrigger value="split">Category split</TabsTrigger>
          <TabsTrigger value="trend">Monthly trend</TabsTrigger>
        </TabsList>
        <TabsContent value="split">
          <div
            className="rounded-card border border-border p-4"
            style={{ height: Math.max(288, response.rows.length * 34) }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" fontSize={12} />
                <YAxis dataKey="categoryName" type="category" width={220} fontSize={12} />
                <Tooltip formatter={(value) => <Money value={Number(value)} />} />
                <Bar dataKey="total">
                  {barData.map((row, index) => (
                    <Cell key={row.categoryId} fill={categoryColor(index)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>
        <TabsContent value="trend">
          <div className="h-72 rounded-card border border-border p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(value) => <Money value={Number(value)} />} />
                <Legend />
                {trendCategories.map((categoryRow, index) => (
                  <Line
                    key={categoryRow.categoryId}
                    type="monotone"
                    dataKey={categoryRow.categoryId}
                    name={categoryRow.category.name}
                    stroke={categoryColor(index)}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
