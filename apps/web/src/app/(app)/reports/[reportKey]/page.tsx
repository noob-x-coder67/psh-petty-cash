import type { AuthenticatedUser, OrganizationalUnit } from "@psh/contracts";
import { Badge } from "@psh/ui";
import { notFound } from "next/navigation";
import { findReportCatalogEntry } from "../../../../components/reports/report-catalog";
import { ReportView } from "../../../../components/reports/report-view";
import { serverApiFetch } from "../../../../lib/server-api-client";

export default async function ReportDetailPage({ params }: { params: Promise<{ reportKey: string }> }) {
  const { reportKey } = await params;
  const entry = findReportCatalogEntry(reportKey);
  if (!entry) {
    notFound();
  }

  if (!entry.implemented) {
    return (
      <div className="flex flex-col gap-2 p-6">
        <div className="flex items-center gap-2">
          <Badge variant="neutral">{entry.key}</Badge>
          <h1 className="text-lg font-semibold text-ink">{entry.title}</h1>
        </div>
        <p className="text-sm text-ink-muted">{entry.purpose}</p>
        <p className="text-sm text-amber-500">Available from {entry.availableFrom}.</p>
      </div>
    );
  }

  const [user, units] = await Promise.all([
    serverApiFetch<AuthenticatedUser>("/me"),
    serverApiFetch<OrganizationalUnit[]>("/units"),
  ]);
  const pettyCashUnits = units.filter((unit) => unit.pettyCashEnabled);

  return <ReportView reportKey={entry.key} units={pettyCashUnits} showUnitPicker={user.unitScope.all} />;
}
