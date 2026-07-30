import type { AdminSettingsResponse } from "@psh/contracts";
import { Badge } from "@psh/ui";
import { serverApiFetch } from "../../../../lib/server-api-client";

// Server-rendered, read-only — permission enforcement happens on the API side
// (@RequiresPermission on GET /admin/settings). No mutation path (the Administration
// plan's confirmed "read-only for now" scope) — a settings table with audited edits is
// deferred future work, not built here.
export default async function AdminSettingsPage() {
  const { settings } = await serverApiFetch<AdminSettingsResponse>("/admin/settings");

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Configuration</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Currently-effective deployment settings, configured via environment variables — not editable here yet.
        </p>
      </div>

      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-0 text-left text-xs font-medium text-ink-muted">
              <th className="px-4 py-2.5">Setting</th>
              <th className="px-4 py-2.5">Value</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {settings.map((setting) => (
              <tr key={setting.key} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5">
                  <p className="font-medium text-ink">{setting.label}</p>
                  <p className="text-xs text-ink-muted">{setting.key}</p>
                </td>
                <td className="px-4 py-2.5 text-ink">
                  {setting.value}
                  {setting.note ? <p className="mt-0.5 text-xs text-ink-muted">{setting.note}</p> : null}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Badge variant={setting.enforced ? "positive" : "attention"}>
                    {setting.enforced ? "Enforced" : "Not yet enforced"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
