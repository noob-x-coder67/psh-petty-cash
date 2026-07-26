import { Prisma } from "@prisma/client";

/** Sign lives in direction, never in the amount's own value (Build Plan §2.3). */
export type LedgerDirection = 1 | -1;

export function computeBalanceAfter(
  currentBalance: Prisma.Decimal,
  direction: LedgerDirection,
  amount: Prisma.Decimal,
): Prisma.Decimal {
  return currentBalance.plus(amount.times(direction));
}
