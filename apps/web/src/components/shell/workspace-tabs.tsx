"use client";

import type { AuthenticatedUser } from "@psh/contracts";
import { cn } from "@psh/ui";
import { LayoutDashboard, PiggyBank, Receipt, ShieldCheck, ShieldQuestion, Sliders } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrefersReducedMotion } from "../../lib/motion";

interface Tab {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
}

// SRS §11.2 horizontal workspace tabs, in order: Overview, Cash Flow, Expenses, Reports
// Studio, Month Close, Administration (role based). Unit-scoped users get "My Unit"
// (their Center Workspace, §12.3) in the first slot instead of the finance-wide
// Command Center, since /overview aggregates every unit including ones they can't see.
export function WorkspaceTabs({ user }: { user: AuthenticatedUser }) {
  const pathname = usePathname();
  const reducedMotion = usePrefersReducedMotion();
  const firstTab: Tab = user.unitScope.all
    ? { label: "Overview", href: "/overview", icon: LayoutDashboard }
    : { label: "My Unit", href: "/my-unit", icon: LayoutDashboard };

  const tabs: Tab[] = [
    firstTab,
    { label: "Cash Flow", href: "/cash-flow", icon: PiggyBank },
    { label: "Expenses", href: "/expenses", icon: Receipt },
    { label: "Reports Studio", href: "/reports", icon: ShieldQuestion },
    { label: "Month Close", href: "/month-close", icon: ShieldCheck },
  ];
  if (user.permissionKeys.includes("admin.manage_users_units")) {
    tabs.push({ label: "Administration", href: "/admin", icon: Sliders });
  }

  return (
    <nav
      className="flex items-center gap-1 overflow-x-auto border-b border-border bg-surface-1 px-2 sm:px-4"
      aria-label="Workspaces"
    >
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "psh-focus-ring group relative flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink",
              active && "text-ink",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute inset-x-1 top-1.5 bottom-1.5 -z-10 rounded-control bg-interactive-surface opacity-0 transition-opacity group-hover:opacity-100",
                active && "opacity-0",
              )}
            />
            <Icon className="h-4 w-4" aria-hidden />
            {tab.label}
            {active ? (
              <motion.div
                layoutId={reducedMotion ? undefined : "workspace-tab-indicator"}
                className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-royal-600"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
