import type { ReportDatasetResponse } from "@psh/contracts";
import { Badge } from "@psh/ui";

// SRS §10.4: official header, report title and unique report ID, generated date/time
// and generated-by user, visible list of applied filters. This is the on-screen
// equivalent; the PDF/Excel export (Phase 6d) renders the same information again on
// the document itself.
export function ReportHeader({ title, response }: { title: string; response: ReportDatasetResponse }) {
  const appliedEntries = Object.entries(response.appliedFilters).filter(([, val]) => val !== undefined && val !== "");

  return (
    <div className="flex flex-col gap-2 border-b border-border pb-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral">{response.reportKey}</Badge>
        <h1 className="text-lg font-semibold text-ink">{title}</h1>
      </div>
      <p className="text-xs text-ink-muted">
        Generated {new Date(response.generatedAt).toLocaleString()} by {response.generatedBy.fullName} · Period{" "}
        {response.period.start} to {response.period.end}
      </p>
      {appliedEntries.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {appliedEntries.map(([key, val]) => (
            <Badge key={key} variant="analytical">
              {key}: {Array.isArray(val) ? val.join(", ") : String(val)}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
