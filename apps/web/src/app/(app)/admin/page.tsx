import { Badge } from "@psh/ui";
import { Building2, KeyRound, Settings2, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

// SRS §12.10 Administration — Users and Units (through this phase) are real;
// Permissions/Configuration are still deliberate, polished "not available yet" previews
// (no href/onClick) until their own phases land, per the redesign brief's "no fake
// working controls" rule.
const AVAILABLE_MODULES: Array<{ icon: LucideIcon; label: string; description: string; href: string }> = [
  { icon: Users, label: "Users", description: "Accounts, roles and access assignment", href: "/admin/users" },
  { icon: Building2, label: "Units", description: "Petty-cash unit registry and metadata", href: "/admin/units" },
];

const PLANNED_MODULES: Array<{ icon: LucideIcon; label: string; description: string }> = [
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {AVAILABLE_MODULES.map(({ icon: Icon, label, description, href }) => (
          <Link
            key={label}
            href={href}
            className="psh-focus-ring flex flex-col gap-3 rounded-card border border-border bg-surface-1 p-4 transition-colors hover:bg-surface-0"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-interactive-surface">
              <Icon className="h-4.5 w-4.5 text-royal-600" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">{label}</p>
              <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
            </div>
          </Link>
        ))}
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
