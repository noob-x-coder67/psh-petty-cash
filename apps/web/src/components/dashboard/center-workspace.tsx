"use client";

import type { ComplianceResponse, DashboardUnitResponse } from "@psh/contracts";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, KpiCard, Money, cn } from "@psh/ui";
import { ArrowDownToLine, ArrowUpFromLine, Landmark } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { revealVariants, usePrefersReducedMotion } from "../../lib/motion";
import { ComplianceTimeline } from "../month-close/compliance-timeline";

const ENTRY_TYPE_LABEL: Record<string, string> = {
  OPENING: "Opening balance",
  ALLOCATION: "Allocation",
  REPLENISHMENT: "Replenishment",
  EXPENSE: "Expense",
  CASH_RETURN: "Cash return",
  ADJUSTMENT_POSITIVE: "Adjustment (+)",
  ADJUSTMENT_NEGATIVE: "Adjustment (-)",
  REVERSAL: "Reversal",
};

// SRS §12.3 Center Workspace.
export function CenterWorkspace({
  data,
  compliance,
}: {
  data: DashboardUnitResponse;
  compliance: ComplianceResponse;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const isNegative = Number(data.balance) < 0;

  return (
    <motion.div
      className="flex flex-col gap-6 p-6"
      initial={reducedMotion ? false : "hidden"}
      animate={reducedMotion ? false : "visible"}
      variants={revealVariants}
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">{data.unit.name}</h1>
          <p className="text-sm text-ink-muted">{data.unit.code}</p>
        </div>
        <Button asChild>
          <Link href="/expenses/new">New Expense</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Current Balance"
          value={<Money value={data.balance} className={cn(isNegative && "text-coral-500")} />}
          icon={Landmark}
          accent={isNegative ? "danger" : "success"}
        />
        <KpiCard
          label="Cash Received (this period)"
          value={<Money value={data.period.cashReceived} />}
          icon={ArrowDownToLine}
          accent="primary"
        />
        <KpiCard label="Spent (this period)" value={<Money value={data.period.spent} />} icon={ArrowUpFromLine} accent="info" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Three-Month Compliance</CardTitle>
            <Badge variant={compliance.nextReplenishment.isCompliant ? "positive" : "attention"}>
              {compliance.nextReplenishment.isCompliant ? "Eligible" : "Hold"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ComplianceTimeline months={compliance.timeline} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentEntries.length === 0 ? (
            <p className="text-sm text-ink-muted">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.recentEntries.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium text-ink">{ENTRY_TYPE_LABEL[entry.entryType] ?? entry.entryType}</p>
                    <p className="text-ink-muted">{entry.effectiveDate}</p>
                  </div>
                  <div className="text-right">
                    <Money value={entry.direction > 0 ? entry.amount : `-${entry.amount}`} />
                    <p className="text-xs text-ink-muted">
                      Balance: <Money value={entry.balanceAfter} />
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
