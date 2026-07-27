import type { ReportDatasetResponse } from "@psh/contracts";
import { getExportColumns } from "../export-columns";

// ADR-0002: CSV needs no library — plain string construction, escaped per RFC 4180
// (quote a field if it contains a comma, quote, or newline; double up embedded quotes).
function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCsv(response: ReportDatasetResponse): string {
  const columns = getExportColumns(response.reportKey);
  const lines: string[] = [];

  // SRS §10.4: report title/ID, generated date/time and by, applied filters — same
  // header block the PDF/Excel builders render, just as plain rows here.
  lines.push(csvEscape(`Report: ${response.reportKey}`));
  lines.push(csvEscape(`Generated: ${response.generatedAt} by ${response.generatedBy.fullName}`));
  lines.push(csvEscape(`Period: ${response.period.start} to ${response.period.end}`));
  lines.push("");
  lines.push(columns.map((column) => csvEscape(column.header)).join(","));

  for (const row of response.rows as Array<Record<string, unknown>>) {
    lines.push(columns.map((column) => csvEscape(column.get(row))).join(","));
  }

  return lines.join("\n");
}
