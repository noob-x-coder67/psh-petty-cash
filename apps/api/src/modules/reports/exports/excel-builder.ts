import ExcelJS from "exceljs";
import type { ReportDatasetResponse } from "@psh/contracts";
import { getExportColumns } from "../export-columns";

export async function buildExcelBuffer(response: ReportDatasetResponse): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PSH Petty Cash System";
  workbook.created = new Date(response.generatedAt);

  const sheet = workbook.addWorksheet(response.reportKey);

  // SRS §10.4 header block: title, generated date/time and by, applied filters.
  const titleRow = sheet.addRow([`PSH Petty Cash — ${response.reportKey}`]);
  titleRow.font = { bold: true, size: 14 };
  sheet.addRow([`Generated ${response.generatedAt} by ${response.generatedBy.fullName}`]);
  sheet.addRow([`Period: ${response.period.start} to ${response.period.end}`]);
  sheet.addRow([]);

  const columns = getExportColumns(response.reportKey);
  const headerRow = sheet.addRow(columns.map((column) => column.header));
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
  });

  for (const row of response.rows as Array<Record<string, unknown>>) {
    sheet.addRow(columns.map((column) => column.get(row)));
  }

  sheet.columns.forEach((column) => {
    column.width = 22;
  });

  // Confidentiality footer (SRS §10.4) as the final row, distinguishable by italics
  // rather than a real page footer — worksheets don't repaginate the way PDF pages do.
  sheet.addRow([]);
  const footerRow = sheet.addRow(["Confidential — Pakistan Sweet Home internal financial record"]);
  footerRow.font = { italic: true, size: 9 };

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
