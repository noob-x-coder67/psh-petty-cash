"use client";

import type { DashboardFinanceResponse } from "@psh/contracts";
import { Badge, Card, CardContent, CardHeader, CardTitle, Input, KpiCard, Money, UnitPulseCard } from "@psh/ui";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  Landmark,
  Receipt,
  Search,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAnimatedNumber } from "../../lib/use-animated-number";
import { revealVariants, staggerContainer, usePrefersReducedMotion } from "../../lib/motion";

// SRS §12.2 Finance Command Center. Quick report launches are still omitted — Reports
// Studio (Phase 6) has no notion yet of "launch pre-filtered from this KPI". Period-
// over-period comparison and per-unit trend lines are likewise omitted: the /dashboard/
// finance response carries no previous-period figures to compare against, and inventing
// one client-side would mean showing a number the API never actually computed.
export function CommandCenter({ data, asOf }: { data: DashboardFinanceResponse; asOf: string }) {
  const reducedMotion = usePrefersReducedMotion();
  const router = useRouter();
  const negativeUnits = data.units.filter((unit) => Number(unit.balance) < 0);
  const heldUnitCodes = useMemo(() => new Set(data.unitsOnHold.map((u) => u.unitCode)), [data.unitsOnHold]);

  function goToUnit(unitCode: string): void {
    router.push(`/my-unit?unit=${unitCode}`);
  }

  const cashIssued = useAnimatedNumber(Number(data.kpis.cashIssued), reducedMotion);
  const spending = useAnimatedNumber(Number(data.kpis.spending), reducedMotion);
  const expectedCash = useAnimatedNumber(Number(data.kpis.expectedCash), reducedMotion);
  const uncheckedCount = useAnimatedNumber(data.kpis.uncheckedCount, reducedMotion);

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Finance Command Center</h1>
        <p className="mt-0.5 text-sm text-ink-muted">Every petty-cash unit, this period · synchronized {asOf}</p>
      </div>

      <motion.div
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        initial={reducedMotion ? false : "hidden"}
        animate={reducedMotion ? false : "visible"}
        variants={staggerContainer(80)}
      >
        <motion.div variants={revealVariants}>
          <KpiCard
            label="Cash Issued"
            value={<Money value={cashIssued} />}
            icon={ArrowDownToLine}
            accent="primary"
            tooltip="Total replenishments confirmed to petty-cash accounts this period."
          />
        </motion.div>
        <motion.div variants={revealVariants}>
          <KpiCard
            label="Total Spending"
            value={<Money value={spending} />}
            icon={ArrowUpFromLine}
            accent="info"
            tooltip="Sum of active expense vouchers recorded this period, across every unit."
          />
        </motion.div>
        <motion.div variants={revealVariants}>
          <KpiCard
            label="Expected Cash"
            value={<Money value={expectedCash} />}
            icon={Landmark}
            accent={Number(data.kpis.expectedCash) < 0 ? "danger" : "success"}
            tooltip="Live ledger balance across every unit — allocations and replenishments minus spending, as of now."
          />
        </motion.div>
        <motion.div variants={revealVariants}>
          <KpiCard
            label="Unchecked Receipts"
            value={Math.round(uncheckedCount)}
            icon={Receipt}
            accent={data.kpis.uncheckedCount > 0 ? "warning" : "success"}
            tooltip="Vouchers with a bill on file that Finance hasn't marked Checked yet — viewing a receipt, not approving it (BR-008)."
          />
        </motion.div>
      </motion.div>

      {negativeUnits.length > 0 ? (
        <Card className="relative overflow-hidden border-coral-500/30">
          <div aria-hidden className="absolute inset-y-0 left-0 w-1 bg-coral-500" />
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-coral-500/15">
                <ShieldAlert className="h-4 w-4 text-coral-500" aria-hidden />
              </div>
              <CardTitle className="text-coral-500">Negative Balance Spotlight</CardTitle>
              <Badge variant="negative">{negativeUnits.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {negativeUnits.map((unit) => (
              <UnitPulseCard
                key={unit.unitId}
                unitName={unit.unitName}
                unitCode={unit.unitCode}
                balance={unit.balance}
                uncheckedCount={unit.uncheckedCount}
                onSelect={() => goToUnit(unit.unitCode)}
              />
            ))}
          </CardContent>
        </Card>
      ) : null}

      <ComplianceHoldPanel unitsOnHold={data.unitsOnHold} onReview={goToUnit} />

      <Card>
        <CardHeader>
          <CardTitle>Unit Pulse</CardTitle>
        </CardHeader>
        <CardContent>
          <motion.div
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            initial={reducedMotion ? false : "hidden"}
            animate={reducedMotion ? false : "visible"}
            variants={staggerContainer(40)}
          >
            {data.units.map((unit) => (
              <motion.div key={unit.unitId} variants={revealVariants}>
                <UnitPulseCard
                  unitName={unit.unitName}
                  unitCode={unit.unitCode}
                  balance={unit.balance}
                  uncheckedCount={unit.uncheckedCount}
                  onSelect={() => goToUnit(unit.unitCode)}
                  className={heldUnitCodes.has(unit.unitCode) ? "border-amber-500/40" : undefined}
                />
              </motion.div>
            ))}
          </motion.div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Receipt Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {data.uncheckedQueue.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-ink-muted">
              <ShieldCheck className="h-4 w-4 text-emerald-500" aria-hidden />
              Nothing waiting for review.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {data.uncheckedQueue.map((item) => (
                <li key={item.voucherId} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-ink">{item.voucherNo}</p>
                    <p className="text-ink-muted">
                      {item.unitCode} · {item.vendorName}
                    </p>
                  </div>
                  <Money value={item.billTotal} className="tabular-nums" />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// SRS §8: units held under BR-013's three-month rule. The dashboard response only
// carries unitId/unitCode/unitName for each held unit (see UnitOnHoldSchema) — no
// last-completed-month, incomplete-month-count, or responsible-person fields exist on
// this endpoint, so this panel doesn't fabricate any of that. The real per-unit detail
// (the three-month timeline) already exists on /month-close; "Review" links there.
function ComplianceHoldPanel({
  unitsOnHold,
  onReview,
}: {
  unitsOnHold: DashboardFinanceResponse["unitsOnHold"];
  onReview: (unitCode: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const isLong = unitsOnHold.length > 6;

  const filtered = useMemo(() => {
    if (!query.trim()) return unitsOnHold;
    const q = query.trim().toLowerCase();
    return unitsOnHold.filter((u) => u.unitName.toLowerCase().includes(q) || u.unitCode.toLowerCase().includes(q));
  }, [unitsOnHold, query]);

  const visible = isLong && !expanded ? filtered.slice(0, 4) : filtered;

  if (unitsOnHold.length === 0) {
    return (
      <Card className="relative overflow-hidden border-emerald-500/25">
        <div aria-hidden className="absolute inset-y-0 left-0 w-1 bg-emerald-500" />
        <CardContent className="flex items-center gap-3 p-4 text-sm text-ink">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
            <ShieldCheck className="h-4 w-4 text-emerald-500" aria-hidden />
          </div>
          All units are clear of the three-month compliance hold.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden border-amber-500/30">
      <div aria-hidden className="absolute inset-y-0 left-0 w-1 bg-amber-500" />
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
            <ShieldAlert className="h-4 w-4 text-amber-500" aria-hidden />
          </div>
          <CardTitle className="text-amber-500">Three-Month Compliance Hold</CardTitle>
          <Badge variant="attention">{unitsOnHold.length}</Badge>
        </div>
        <p className="text-sm text-ink-muted">
          A fourth-month replenishment is held for any unit where one of the preceding three monthly closings
          isn&apos;t complete (BR-013) — a Finance Manager can record an audited exception.
        </p>
        {isLong ? (
          <div className="relative max-w-xs">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search held units"
              className="h-8 pl-8 text-sm"
              aria-label="Search held units"
            />
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {visible.map((unit) => (
          <button
            key={unit.unitId}
            type="button"
            onClick={() => onReview(unit.unitCode)}
            className="psh-focus-ring flex items-center justify-between gap-3 rounded-control border border-amber-500/30 bg-amber-100/60 px-3 py-2 text-left text-sm transition-colors hover:bg-amber-100"
          >
            <span className="flex flex-col">
              <span className="font-medium text-ink">{unit.unitName}</span>
              <span className="text-xs text-ink-muted">{unit.unitCode}</span>
            </span>
            <span className="text-xs font-medium text-amber-500">Review →</span>
          </button>
        ))}
        {filtered.length === 0 ? (
          <p className="p-2 text-sm text-ink-muted">No held units match &quot;{query}&quot;.</p>
        ) : null}
        {isLong && filtered.length > 4 ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="psh-focus-ring mt-1 flex items-center gap-1 self-start rounded-control px-2 py-1 text-xs font-medium text-ink-muted hover:text-ink"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden />
            {expanded ? "Show fewer" : `Show all ${filtered.length}`}
          </button>
        ) : null}
      </CardContent>
    </Card>
  );
}
