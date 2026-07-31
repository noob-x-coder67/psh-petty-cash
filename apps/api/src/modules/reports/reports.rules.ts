import { Prisma, type LedgerEntryType } from "@prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

// OPENING is folded into "allocations" — both represent cash being made available to the
// unit, and RPT-01's row shape has no separate "opening entries posted inside this
// range" field. Every one of the 8 LedgerEntryType values appears in exactly one bucket
// below, so openingBalance + allocations + replenishments - expenditure + adjustments is
// always exactly equal to expectedBalance — the identity the reconciliation test asserts.
export const ALLOCATION_TYPES: LedgerEntryType[] = ["OPENING", "ALLOCATION"];
export const ADJUSTMENT_TYPES: LedgerEntryType[] = ["ADJUSTMENT_POSITIVE", "ADJUSTMENT_NEGATIVE", "CASH_RETURN", "REVERSAL"];

export function sumEntryTypes(accMap: Map<LedgerEntryType, Prisma.Decimal> | undefined, types: LedgerEntryType[]): Prisma.Decimal {
  let total = new Prisma.Decimal(0);
  for (const type of types) {
    total = total.plus(accMap?.get(type) ?? new Prisma.Decimal(0));
  }
  return total;
}

export interface ConsolidatedCashAmounts {
  openingBalance: Prisma.Decimal;
  allocations: Prisma.Decimal;
  replenishments: Prisma.Decimal;
  expenditure: Prisma.Decimal;
  adjustments: Prisma.Decimal;
  expectedBalance: Prisma.Decimal;
}

export function computeConsolidatedCashAmounts(
  openingBalance: Prisma.Decimal,
  expectedBalance: Prisma.Decimal,
  typeSums: Map<LedgerEntryType, Prisma.Decimal> | undefined,
): ConsolidatedCashAmounts {
  const expenditureSigned = sumEntryTypes(typeSums, ["EXPENSE"]);
  return {
    openingBalance,
    allocations: sumEntryTypes(typeSums, ALLOCATION_TYPES),
    replenishments: sumEntryTypes(typeSums, ["REPLENISHMENT"]),
    expenditure: expenditureSigned.abs(),
    adjustments: sumEntryTypes(typeSums, ADJUSTMENT_TYPES),
    expectedBalance,
  };
}

/** Days between voucher entry and receipt check, or between entry and `now` if still
 * unchecked — always computable (entered_at is never null), so this never returns null
 * in practice even though the response contract permits it for future flexibility. */
export function computeCheckAgeDays(enteredAt: Date, checkedAt: Date | null, now: Date): number {
  const end = checkedAt ?? now;
  return Math.floor((end.getTime() - enteredAt.getTime()) / DAY_MS);
}

export function computeCategoryPercentage(categoryTotal: Prisma.Decimal, grandTotal: Prisma.Decimal): number {
  if (grandTotal.isZero()) return 0;
  return categoryTotal.dividedBy(grandTotal).times(100).toDecimalPlaces(2).toNumber();
}

export interface LedgerPoint {
  effectiveDate: Date;
  balanceAfter: Prisma.Decimal;
  sourceTable: string | null;
  sourceId: string | null;
}

export interface LedgerMovement {
  effectiveDate: Date;
  direction: number;
  amount: Prisma.Decimal;
  sourceTable: string | null;
  sourceId: string | null;
}

/** Rebuilds effective-date balance snapshots from signed ledger movements. The stored
 * `balanceAfter` is a posting-order snapshot, so using it after sorting backdated entries
 * by effective date can report a stale final balance. `entries` must already be sorted
 * by effectiveDate and a stable tiebreaker. */
export function computeEffectiveBalancePoints(entries: LedgerMovement[]): LedgerPoint[] {
  let balance = new Prisma.Decimal(0);
  return entries.map((entry) => {
    balance = balance.plus(entry.amount.times(entry.direction));
    return {
      effectiveDate: entry.effectiveDate,
      balanceAfter: balance,
      sourceTable: entry.sourceTable,
      sourceId: entry.sourceId,
    };
  });
}

export interface NegativeBalanceStreak {
  startDate: Date;
  // null = still negative as of the last entry seen (an ongoing negative period).
  endDate: Date | null;
  triggerSourceTable: string | null;
  triggerSourceId: string | null;
  lowestBalance: Prisma.Decimal;
  durationDays: number;
}

/** RPT-07: scans one account's ledger entries in chronological order and returns every
 * maximal run of consecutive negative `balanceAfter` values as its own streak (BR-011 —
 * negative balance is allowed and reportable, never blocked). `entries` must already be
 * sorted ascending by effectiveDate (then a stable tiebreaker) by the caller — this
 * function has no way to re-derive chronological order from balance alone. */
export function computeNegativeBalanceStreaks(entries: LedgerPoint[], now: Date): NegativeBalanceStreak[] {
  const streaks: NegativeBalanceStreak[] = [];
  let current: NegativeBalanceStreak | null = null;

  for (const entry of entries) {
    if (entry.balanceAfter.isNegative()) {
      if (!current) {
        current = {
          startDate: entry.effectiveDate,
          endDate: null,
          triggerSourceTable: entry.sourceTable,
          triggerSourceId: entry.sourceId,
          lowestBalance: entry.balanceAfter,
          durationDays: 0,
        };
      } else if (entry.balanceAfter.lessThan(current.lowestBalance)) {
        current.lowestBalance = entry.balanceAfter;
      }
    } else if (current) {
      current.endDate = entry.effectiveDate;
      current.durationDays = Math.floor((current.endDate.getTime() - current.startDate.getTime()) / DAY_MS);
      streaks.push(current);
      current = null;
    }
  }

  if (current) {
    current.durationDays = Math.floor((now.getTime() - current.startDate.getTime()) / DAY_MS);
    streaks.push(current);
  }

  return streaks;
}
