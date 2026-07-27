"use client";

import type { ReportExportFormatValue, ReportFilter, ReportKey } from "@psh/contracts";
import { Button } from "@psh/ui";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { useExport } from "./use-export";

const FORMAT_LABEL: Record<ReportExportFormatValue, string> = {
  PDF: "PDF",
  EXCEL: "Excel",
  CSV: "CSV",
};

// SRS §10.4 "Print, PDF, Excel and CSV where appropriate" + Build Plan §3.7's async
// job pattern: request → poll → download link, never a blocking wait on the request.
export function ExportButton({ reportKey, filter }: { reportKey: ReportKey; filter: ReportFilter }) {
  const [format, setFormat] = useState<ReportExportFormatValue>("PDF");
  const { requestExport, isCreating, createError, status, downloadUrl } = useExport(reportKey, filter);
  const isGenerating = status !== undefined && status.status === "PENDING";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Export format"
        className="psh-focus-ring h-10 rounded-control border border-border bg-surface-1 px-2 text-sm text-ink"
        value={format}
        onChange={(event) => setFormat(event.target.value as ReportExportFormatValue)}
        disabled={isCreating || isGenerating}
      >
        <option value="PDF">PDF</option>
        <option value="EXCEL">Excel</option>
        <option value="CSV">CSV</option>
      </select>
      <Button
        variant="secondary"
        onClick={() => requestExport(format)}
        disabled={isCreating || isGenerating}
      >
        {isCreating || isGenerating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {isGenerating ? "Generating..." : `Export ${FORMAT_LABEL[format]}`}
      </Button>

      {createError ? (
        <span className="text-sm text-coral-500">
          {createError instanceof Error ? createError.message : "Could not start export."}
        </span>
      ) : null}

      {status?.status === "FAILED" ? (
        <span className="text-sm text-coral-500">Export failed{status.errorMessage ? `: ${status.errorMessage}` : "."}</span>
      ) : null}

      {downloadUrl ? (
        <a href={downloadUrl} className="inline-flex items-center gap-1.5 text-sm font-medium text-royal-600 underline">
          <Download className="h-4 w-4" aria-hidden />
          Download {status?.fileRef}
        </a>
      ) : null}
    </div>
  );
}
