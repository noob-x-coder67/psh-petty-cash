"use client";

import type { DashboardFinanceResponse } from "@psh/contracts";
import { Card, CardContent, CardHeader, CardTitle, Money, UnitPulseCard } from "@psh/ui";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useAnimatedNumber } from "../../lib/use-animated-number";
import { revealVariants, staggerContainer, usePrefersReducedMotion } from "../../lib/motion";

// SRS §12.2 Finance Command Center. Three-month compliance ribbon and quick report
// launches are omitted — both depend on data that doesn't exist until Month Close
// (Phase 7) and Reports Studio (Phase 6); showing them now would mean fabricating data.
export function CommandCenter({ data }: { data: DashboardFinanceResponse }) {
  const reducedMotion = usePrefersReducedMotion();
  const router = useRouter();
  const negativeUnits = data.units.filter((unit) => Number(unit.balance) < 0);

  function goToUnit(unitCode: string): void {
    router.push(`/my-unit?unit=${unitCode}`);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <motion.div
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        initial={reducedMotion ? false : "hidden"}
        animate={reducedMotion ? false : "visible"}
        variants={staggerContainer(80)}
      >
        <KpiCard label="Cash Issued (this period)" value={data.kpis.cashIssued} reducedMotion={reducedMotion} />
        <KpiCard label="Spending (this period)" value={data.kpis.spending} reducedMotion={reducedMotion} />
        <KpiCard label="Expected Cash (live)" value={data.kpis.expectedCash} reducedMotion={reducedMotion} />
        <KpiCard
          label="Unchecked Receipts"
          value={data.kpis.uncheckedCount}
          isCount
          reducedMotion={reducedMotion}
        />
      </motion.div>

      {negativeUnits.length > 0 ? (
        <Card className="border-coral-500/40">
          <CardHeader>
            <CardTitle className="text-coral-500">Negative Balance Spotlight</CardTitle>
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
              <motion.div
                key={unit.unitId}
                initial={reducedMotion ? false : "hidden"}
                animate={reducedMotion ? false : "visible"}
                variants={revealVariants}
              >
                <UnitPulseCard
                  unitName={unit.unitName}
                  unitCode={unit.unitCode}
                  balance={unit.balance}
                  uncheckedCount={unit.uncheckedCount}
                  onSelect={() => goToUnit(unit.unitCode)}
                />
              </motion.div>
            ))}
          </motion.div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Receipt Queue (unchecked first)</CardTitle>
        </CardHeader>
        <CardContent>
          {data.uncheckedQueue.length === 0 ? (
            <p className="text-sm text-ink-muted">Nothing waiting for review.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.uncheckedQueue.map((item) => (
                <li key={item.voucherId} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium text-ink">{item.voucherNo}</p>
                    <p className="text-ink-muted">
                      {item.unitCode} · {item.vendorName}
                    </p>
                  </div>
                  <Money value={item.billTotal} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  value,
  isCount = false,
  reducedMotion,
}: {
  label: string;
  value: string | number;
  isCount?: boolean;
  reducedMotion: boolean;
}) {
  const animated = useAnimatedNumber(Number(value), reducedMotion);
  return (
    <motion.div
      initial={reducedMotion ? false : "hidden"}
      animate={reducedMotion ? false : "visible"}
      variants={revealVariants}
    >
      <Card>
        <CardContent className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-ink">
            {isCount ? Math.round(animated) : <Money value={animated} />}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
