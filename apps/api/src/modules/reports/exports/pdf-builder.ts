import pdfMake, { type Content } from "pdfmake";
import type { TDocumentDefinitions } from "pdfmake/interfaces";
import type { ReportDatasetResponse } from "@psh/contracts";
import { getExportColumns } from "../export-columns";

// Standard PDF fonts (Helvetica) need no embedded TTF files — pdfkit (which pdfmake 0.3.x
// builds on) recognizes these names directly. setLocalAccessPolicy(() => true) is safe
// here specifically because these font values are hardcoded by us, never user input;
// pdfmake treats every font path as a "local file" it must be granted access to,
// standard-font names included.
pdfMake.setFonts({
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
});
pdfMake.setLocalAccessPolicy(() => true);
pdfMake.setUrlAccessPolicy(() => false);

function humanizeKey(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

// SRS §10.4's "summary KPI strip before detail tables" — generic over whichever flat
// summary/totals object a given report response carries (Rpt01's `totals`, Rpt03/06/08/
// 11's `summary`, Rpt04/05/16's bare `totalAmount`). Reports with no summary shape at
// all (RPT-02/07/12/13/14/15 — plain lists with nothing to roll up) get no KPI strip,
// not a fabricated one.
function kpiStripContent(response: ReportDatasetResponse): Content[] {
  const summary: Record<string, unknown> | null =
    "summary" in response
      ? (response.summary as Record<string, unknown>)
      : "totals" in response
        ? (response.totals as Record<string, unknown>)
        : "totalAmount" in response
          ? { "Total Amount": response.totalAmount }
          : null;

  if (!summary) {
    return [];
  }

  return [
    {
      columns: Object.entries(summary).map(([key, value]) => ({
        text: [{ text: `${humanizeKey(key)}\n`, bold: true, fontSize: 8 }, { text: String(value), fontSize: 11 }],
      })),
      margin: [0, 8, 0, 12],
    },
  ];
}

export async function buildPdfBuffer(response: ReportDatasetResponse): Promise<Buffer> {
  const columns = getExportColumns(response.reportKey);
  const appliedFilters = Object.entries(response.appliedFilters).filter(
    ([, value]) => value !== undefined && value !== "",
  );

  const content: Content[] = [
    { text: response.reportKey, style: "title" },
    {
      text: `Generated ${response.generatedAt} by ${response.generatedBy.fullName}`,
      fontSize: 8,
      margin: [0, 0, 0, 2],
    },
    { text: `Period: ${response.period.start} to ${response.period.end}`, fontSize: 8, margin: [0, 0, 0, 8] },
    appliedFilters.length > 0
      ? {
          text: `Filters applied: ${appliedFilters.map(([key, value]) => `${key}=${String(value)}`).join(", ")}`,
          fontSize: 8,
          margin: [0, 0, 0, 8],
        }
      : { text: "" },
    ...kpiStripContent(response),
    {
      table: {
        headerRows: 1,
        widths: columns.map(() => "*"),
        body: [
          columns.map((column) => ({ text: column.header, bold: true, fontSize: 8 })),
          ...(response.rows as Array<Record<string, unknown>>).map((row) =>
            columns.map((column) => ({ text: column.get(row), fontSize: 8 })),
          ),
        ],
      },
    },
  ];

  const docDefinition: TDocumentDefinitions = {
    defaultStyle: { font: "Helvetica", fontSize: 9 },
    pageOrientation: "landscape",
    pageMargins: [30, 60, 30, 40],
    header: {
      text: `PSH Petty Cash — ${response.reportKey}`,
      alignment: "left",
      margin: [30, 20, 0, 0],
      fontSize: 10,
      bold: true,
    },
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: "Confidential — Pakistan Sweet Home internal financial record", fontSize: 7, margin: [30, 0, 0, 0] },
        { text: `Page ${currentPage} of ${pageCount}`, alignment: "right", fontSize: 7, margin: [0, 0, 30, 0] },
      ],
    }),
    content,
    styles: {
      title: { fontSize: 16, bold: true, margin: [0, 0, 0, 4] },
    },
  };

  const doc = pdfMake.createPdf(docDefinition);
  return doc.getBuffer();
}
