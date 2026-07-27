"use client";

import { cn } from "@psh/ui";
import { BarChart3, Home, List, Menu, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Build Plan §4.4: "<768: Title bar + bottom dock (Overview · Expenses · New · Reports ·
// More)... The centre dock slot on mobile is the New Expense action — the single most
// frequent task for the users who are most often on phones (§12.11)." Full-width,
// bottom-anchored only (not left/right full-height) — not the sidebar pattern AC-018 bans.
const DOCK_ITEMS = [
  { label: "Overview", href: "/overview", icon: Home },
  { label: "Expenses", href: "/expenses", icon: List },
  { label: "New", href: "/expenses/new", icon: Plus },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "More", href: "/my-unit", icon: Menu },
] as const;

export function MobileDock() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-surface-1 py-1.5 md:hidden"
      aria-label="Mobile navigation"
    >
      {DOCK_ITEMS.map((item) => {
        const active = pathname === item.href;
        const isCenter = item.label === "New";
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "psh-focus-ring flex flex-col items-center gap-0.5 rounded-control px-3 py-1 text-[10px] font-medium",
              isCenter ? "bg-royal-600 text-white" : active ? "text-royal-600" : "text-ink-muted",
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
