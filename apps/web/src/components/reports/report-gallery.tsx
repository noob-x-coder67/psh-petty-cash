"use client";

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Input } from "@psh/ui";
import {
  ArrowRightLeft,
  BarChart3,
  BookOpen,
  CalendarClock,
  ClipboardCheck,
  Coins,
  FileSearch,
  Landmark,
  LayoutGrid,
  ListTree,
  Paperclip,
  Receipt,
  ScanSearch,
  ScrollText,
  Search,
  ShieldAlert,
  Store,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { revealVariants, staggerContainer, usePrefersReducedMotion } from "../../lib/motion";
import { REPORT_CATALOG, type ReportCategory } from "./report-catalog";

// One icon per report — meaningful, not decorative (SRS §13.4). Lucide only, matching
// every other icon in the app.
const REPORT_ICONS: Record<string, LucideIcon> = {
  "RPT-01": Landmark,
  "RPT-02": ScrollText,
  "RPT-03": Receipt,
  "RPT-04": LayoutGrid,
  "RPT-05": Store,
  "RPT-06": ClipboardCheck,
  "RPT-07": ShieldAlert,
  "RPT-08": ArrowRightLeft,
  "RPT-09": CalendarClock,
  "RPT-10": Coins,
  "RPT-11": ScanSearch,
  "RPT-12": Paperclip,
  "RPT-13": Users,
  "RPT-14": BookOpen,
  "RPT-15": BarChart3,
  "RPT-16": ListTree,
};

const CATEGORIES: ReportCategory[] = ["Cash & Balance", "Expenses & Vendors", "Compliance & Controls", "Audit & Activity"];

export function ReportGallery() {
  const reducedMotion = usePrefersReducedMotion();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<ReportCategory | "ALL">("ALL");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return REPORT_CATALOG.filter((entry) => {
      if (activeCategory !== "ALL" && entry.category !== activeCategory) return false;
      if (!q) return true;
      return (
        entry.key.toLowerCase().includes(q) ||
        entry.title.toLowerCase().includes(q) ||
        entry.purpose.toLowerCase().includes(q)
      );
    });
  }, [query, activeCategory]);

  const grouped = useMemo(() => {
    return CATEGORIES.map((category) => ({
      category,
      entries: filtered.filter((entry) => entry.category === category),
    })).filter((group) => group.entries.length > 0);
  }, [filtered]);

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Reports Studio</h1>
          <p className="mt-1 text-sm text-ink-muted">
            16 required reports (SRS §10.2). Filter-rich, exportable, suitable for Finance review and audit.
          </p>
        </div>
        <Link href="/reports/presets">
          <Button variant="secondary">Saved Filters</Button>
        </Link>
      </div>

      <div className="flex flex-col gap-3 rounded-card border border-border bg-muted-surface p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <Input
            aria-label="Search reports"
            placeholder="Search reports..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveCategory("ALL")}
            className={`psh-focus-ring rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              activeCategory === "ALL" ? "bg-royal-600 text-white" : "bg-surface-1 text-ink-muted hover:text-ink"
            }`}
          >
            All
          </button>
          {CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`psh-focus-ring rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                activeCategory === category ? "bg-royal-600 text-white" : "bg-surface-1 text-ink-muted hover:text-ink"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {grouped.length === 0 ? (
        <EmptyState icon={FileSearch} title="No reports match" description="Try a different search term or category." />
      ) : (
        grouped.map((group) => (
          <div key={group.category} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">{group.category}</h2>
            <motion.div
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
              initial={reducedMotion ? false : "hidden"}
              animate={reducedMotion ? false : "visible"}
              variants={staggerContainer(40)}
            >
              {group.entries.map((entry) => {
                const Icon = REPORT_ICONS[entry.key] ?? Wallet;
                return (
                  <motion.div key={entry.key} variants={revealVariants}>
                    {entry.implemented ? (
                      <Link href={`/reports/${entry.key}`} className="block h-full">
                        <Card className="h-full transition-all hover:-translate-y-0.5 hover:border-royal-400 hover:shadow-2">
                          <CardHeader>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-royal-100">
                                <Icon className="h-4.5 w-4.5 text-royal-600" aria-hidden />
                              </div>
                              <Badge variant="positive">Available</Badge>
                            </div>
                            <CardTitle className="flex items-center gap-2">
                              {entry.title}
                              <span className="font-mono text-xs font-normal text-ink-muted">{entry.key}</span>
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-ink-muted">{entry.purpose}</p>
                          </CardContent>
                        </Card>
                      </Link>
                    ) : (
                      <Card className="h-full opacity-70">
                        <CardHeader>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-interactive-surface">
                              <Icon className="h-4.5 w-4.5 text-ink-muted" aria-hidden />
                            </div>
                            <Badge variant="attention">{entry.availableFrom}</Badge>
                          </div>
                          <CardTitle className="flex items-center gap-2">
                            {entry.title}
                            <span className="font-mono text-xs font-normal text-ink-muted">{entry.key}</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-ink-muted">{entry.purpose}</p>
                        </CardContent>
                      </Card>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        ))
      )}
    </div>
  );
}
