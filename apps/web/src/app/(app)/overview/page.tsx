import type { DashboardFinanceResponse } from "@psh/contracts";
import { CommandCenter } from "../../../components/dashboard/command-center";
import { ApiError } from "../../../lib/api-error";
import { serverApiFetch } from "../../../lib/server-api-client";

// Real enforcement is server-side (dashboard.view_all permission, verified in
// dashboard.integration.spec.ts) — this catch only replaces the crash a Center User
// would otherwise hit navigating here directly with a plain message; hiding the
// Overview tab in favor of My Unit for unit-scoped users (workspace-tabs.tsx) is
// cosmetic only, per Build Plan §4.3.
export default async function OverviewPage() {
  try {
    const data = await serverApiFetch<DashboardFinanceResponse>("/dashboard/finance");
    // This page is server-rendered per request with no cache directive, so "now" at
    // render time genuinely is when this data was fetched — not a fabricated figure.
    const asOf = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Asia/Karachi",
    }).format(new Date());
    return <CommandCenter data={data} asOf={asOf} />;
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return (
        <div className="p-6">
          <p className="text-sm text-ink-muted">
            The Finance Command Center is only available to Finance and Super Admin roles.
          </p>
        </div>
      );
    }
    throw error;
  }
}
