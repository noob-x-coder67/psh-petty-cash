// Accounting periods are computed in Asia/Karachi from date columns, never derived from
// a UTC timestamp (rule 15). effective_date/expense_date are DATE columns (no time or
// timezone component), so once "now" is resolved to a calendar year/month in Asia/
// Karachi, the boundaries are plain calendar dates — no further TZ conversion is needed
// to compare them against those columns.
export function currentKarachiPeriod(now: Date = new Date()): { start: Date; end: Date } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value); // 1-12

  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}
