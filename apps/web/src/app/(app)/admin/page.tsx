import { Badge } from "@psh/ui";
import { Building2, KeyRound, Settings2, Sliders, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// SRS §12.10 Administration — genuinely not built yet (outside Phase 5's five core
// screens), and the redesign brief is explicit: no fake working controls, no invented
// functional modules. This is a deliberate, polished "not available yet" landing state,
// not a functional placeholder — the four cards below are non-interactive previews of
// what the module will eventually cover, clearly labeled "Planned," with no href/onClick.
const PLANNED_MODULES: Array<{ icon: LucideIcon; label: string; description: string }> = [
  { icon: Users, label: "Users", description: "Accounts, roles and access assignment" },
  { icon: Building2, label: "Units", description: "Petty-cash unit registry and metadata" },
  { icon: KeyRound, label: "Permissions", description: "Role-to-permission mapping" },
  { icon: Settings2, label: "Configuration", description: "System-wide settings" },
];

export default function AdminPage() {
  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Administration</h1>
        <p className="mt-1 text-sm text-ink-muted">Users, units, permissions and system configuration.</p>
      </div>

      <div className="flex flex-col items-center gap-4 rounded-feature border border-dashed border-border bg-muted-surface px-6 py-16 text-center">
        <div className="relative flex h-20 w-20 items-center justify-center">
          <div aria-hidden className="absolute inset-0 rounded-full bg-royal-100" />
          <div aria-hidden className="absolute inset-2 rounded-full border border-royal-500/30" />
          <Sliders className="h-8 w-8 text-royal-600" aria-hidden />
        </div>
        <div className="max-w-md space-y-1.5">
          <p className="text-base font-semibold text-ink">Administration isn&apos;t available yet</p>
          <p className="text-sm text-ink-muted">
            This module is planned for a later phase of the build. Everything shown below is a preview of what it
            will cover — nothing here is interactive yet.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANNED_MODULES.map(({ icon: Icon, label, description }) => (
          <div
            key={label}
            aria-disabled="true"
            className="flex cursor-not-allowed flex-col gap-3 rounded-card border border-border bg-surface-1 p-4 opacity-70"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-interactive-surface">
                <Icon className="h-4.5 w-4.5 text-ink-muted" aria-hidden />
              </div>
              <Badge variant="neutral">Planned</Badge>
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">{label}</p>
              <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
