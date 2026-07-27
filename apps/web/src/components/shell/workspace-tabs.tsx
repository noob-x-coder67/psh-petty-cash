"use client";

import type { AuthenticatedUser } from "@psh/contracts";
import { cn } from "@psh/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Tab {
  label: string;
  href: string;
}

// SRS §11.2 horizontal workspace tabs, in order: Overview, Cash Flow, Expenses, Reports
// Studio, Month Close, Administration (role based). Unit-scoped users get "My Unit"
// (their Center Workspace, §12.3) in the first slot instead of the finance-wide
// Command Center, since /overview aggregates every unit including ones they can't see.
export function WorkspaceTabs({ user }: { user: AuthenticatedUser }) {
  const pathname = usePathname();
  const firstTab: Tab = user.unitScope.all
    ? { label: "Overview", href: "/overview" }
    : { label: "My Unit", href: "/my-unit" };

  const tabs: Tab[] = [
    firstTab,
    { label: "Cash Flow", href: "/cash-flow" },
    { label: "Expenses", href: "/expenses" },
    { label: "Reports Studio", href: "/reports" },
    { label: "Month Close", href: "/month-close" },
  ];
  if (user.permissionKeys.includes("admin.manage_users_units")) {
    tabs.push({ label: "Administration", href: "/admin" });
  }

  return (
    <nav
      className="flex items-center gap-1 overflow-x-auto border-b border-border bg-surface-1 px-4"
      aria-label="Workspaces"
    >
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "psh-focus-ring whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink",
              active && "border-royal-600 text-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
