import { cn } from "../lib/cn.js";

export interface MoneyProps {
  // Accepts the already-computed decimal value as returned by the API (a string, e.g.
  // "1234.56", or a plain number) — this component only ever formats for display. It
  // never does arithmetic, so parsing it through Number() here for Intl.NumberFormat is
  // not the float-arithmetic rule 14 forbids; that math happens server-side on
  // Prisma.Decimal and never touches this component.
  value: string | number;
  className?: string;
}

const formatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function Money({ value, className }: MoneyProps) {
  const numeric = typeof value === "number" ? value : Number(value);
  const isNegative = numeric < 0;
  const formatted = formatter.format(Math.abs(numeric));
  return (
    <span className={cn("tabular-nums", isNegative && "text-coral-500", className)}>
      {isNegative ? "-" : ""}PKR {formatted}
    </span>
  );
}
