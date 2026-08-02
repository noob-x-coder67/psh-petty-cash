import type { AuthenticatedUser } from "@psh/contracts";
import { Building2, KeyRound, Settings2, Tags, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { visibleAdministrationModules, type AdministrationModuleKey } from "../../../lib/admin-navigation";
import { serverApiFetch } from "../../../lib/server-api-client";

// SRS §12.10 Administration — all four modules are now real (Phases 1-6 of the
// Administration effort). Permissions and Configuration are both read-only; see
// role-permission-matrix.tsx and admin/settings/page.tsx for the deferred "editable"
// decisions.
const MODULE_ICONS: Record<AdministrationModuleKey, LucideIcon> = {
  users: Users,
  units: Building2,
  permissions: KeyRound,
  configuration: Settings2,
  categories: Tags,
};

export default async function AdminPage() {
  const me = await serverApiFetch<AuthenticatedUser>("/me");
  const modules = visibleAdministrationModules(me.permissionKeys);
  if (modules.length === 0) {
    redirect(me.unitScope.all ? "/overview" : "/my-unit");
  }

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Administration</h1>
        <p className="mt-1 text-sm text-ink-muted">Manage the system areas available to your role.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {modules.map(({ key, label, description, href }) => {
          const Icon = MODULE_ICONS[key];
          return (
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
          );
        })}
      </div>
    </div>
  );
}
