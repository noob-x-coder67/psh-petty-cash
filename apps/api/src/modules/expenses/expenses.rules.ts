// Pure decision logic — no I/O, no Prisma, no Date.now() calls internally (caller
// supplies `now`) — so every branch is testable without a database. FR-EXP-013.

// Build Plan §8 open question #3: "the earlier finance form proposed 6 working days —
// confirm the default." Not yet confirmed by Finance — this is a working default, not
// a final decision. Change here (one named constant) when it's settled.
export const BACKDATE_THRESHOLD_WORKING_DAYS = 6;

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/** Counts working days strictly after `from` up to and including `to`. */
export function countWorkingDaysBetween(from: Date, to: Date): number {
  let count = 0;
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  while (cursor <= end) {
    if (!isWeekend(cursor)) {
      count += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

export function isBackdated(
  expenseDate: Date,
  now: Date,
  thresholdWorkingDays: number = BACKDATE_THRESHOLD_WORKING_DAYS,
): boolean {
  if (expenseDate >= now) {
    return false;
  }
  return countWorkingDaysBetween(expenseDate, now) > thresholdWorkingDays;
}
