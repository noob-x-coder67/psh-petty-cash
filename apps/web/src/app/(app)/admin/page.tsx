import { Building2, KeyRound, Settings2, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

// SRS §12.10 Administration — all four modules are now real (Phases 1-6 of the
// Administration effort). Permissions and Configuration are both read-only; see
// role-permission-matrix.tsx and admin/settings/page.tsx for the deferred "editable"
// decisions.
const MODULES: Array<{ icon: LucideIcon; label: string; description: string; href: string }> = [
  { icon: Users, label: "Users", description: "Accounts, roles and access assignment", href: "/admin/users" },
  { icon: Building2, label: "Units", description: "Petty-cash unit registry and metadata", href: "/admin/units" },
  { icon: KeyRound, label: "Permissions", description: "Role-to-permission mapping", href: "/admin/roles" },
  { icon: Settings2, label: "Configuration", description: "System-wide settings", href: "/admin/settings" },
];

export default function AdminPage() {
  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Administration</h1>
        <p className="mt-1 text-sm text-ink-muted">Users, units, permissions and system configuration.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MODULES.map(({ icon: Icon, label, description, href }) => (
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
      </div>
    </div>
  );
}
