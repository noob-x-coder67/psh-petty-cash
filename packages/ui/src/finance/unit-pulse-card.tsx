import type { KeyboardEvent } from "react";
import { Badge } from "../primitives/badge.js";
import { Card, CardContent, CardHeader, CardTitle } from "../primitives/card.js";
import { cn } from "../lib/cn.js";
import { Money } from "./money.js";

// SRS §12.2's "Unit Pulse Grid" — one cell per petty-cash-enabled unit. PSH-ISB never
// appears here since it never has an account (BR-016) — enforced by the caller only
// rendering units that have one, not by this component.
export interface UnitPulseCardProps {
  unitName: string;
  unitCode: string;
  balance: string | number;
  uncheckedCount: number;
  onSelect?: () => void;
  className?: string;
}

export function UnitPulseCard({
  unitName,
  unitCode,
  balance,
  uncheckedCount,
  onSelect,
  className,
}: UnitPulseCardProps) {
  const isNegative = Number(balance) < 0;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (onSelect && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      onSelect();
    }
  }

  return (
    <Card
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={cn(onSelect && "cursor-pointer transition-shadow hover:shadow-2", className)}
    >
      <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
        <div>
          <CardTitle className="text-sm">{unitName}</CardTitle>
          <p className="text-xs text-ink-muted">{unitCode}</p>
        </div>
        {isNegative ? <Badge variant="negative">Negative</Badge> : null}
      </CardHeader>
      <CardContent className="pt-0">
        <Money value={balance} className={cn("text-lg font-semibold text-ink", isNegative && "text-coral-500")} />
        {uncheckedCount > 0 ? <p className="mt-1 text-xs text-amber-500">{uncheckedCount} unchecked</p> : null}
      </CardContent>
    </Card>
  );
}
