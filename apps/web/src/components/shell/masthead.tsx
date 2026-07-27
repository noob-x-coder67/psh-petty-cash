"use client";

import type { AuthenticatedUser, OrganizationalUnit } from "@psh/contracts";
import { Button } from "@psh/ui";
import { useQuery } from "@tanstack/react-query";
import { Bell, Search } from "lucide-react";
import { apiFetch } from "../../lib/api-client";
import { useUnitScope } from "../../lib/use-unit-scope";
import { UserMenu } from "./user-menu";

export interface MastheadProps {
  user: AuthenticatedUser;
  onOpenCommandPalette: () => void;
}

function currentPeriodLabel(): string {
  // Period switcher is a stub until Reports Studio/Month Close (Phase 6/7) give it
  // something to actually switch between — shows the current Asia/Karachi month only.
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Karachi",
  }).format(new Date());
}

export function Masthead({ user, onOpenCommandPalette }: MastheadProps) {
  const { data: units } = useQuery({
    queryKey: ["units"],
    queryFn: () => apiFetch<OrganizationalUnit[]>("/units"),
  });
  const { unitCode, setUnitCode } = useUnitScope();
  const environment = process.env.NEXT_PUBLIC_APP_ENV;
  const envBadge = environment && environment !== "production" ? environment : null;

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-surface-1 px-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink">
        PSH Petty Cash
        {envBadge ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-500">
            {envBadge}
          </span>
        ) : null}
      </div>

      {units && units.length > 1 ? (
        <select
          aria-label="Unit"
          className="psh-focus-ring h-9 rounded-control border border-border bg-surface-1 px-2 text-sm text-ink"
          value={unitCode ?? units[0]?.code ?? ""}
          onChange={(event) => setUnitCode(event.target.value)}
        >
          {units.map((unit) => (
            <option key={unit.id} value={unit.code}>
              {unit.name}
            </option>
          ))}
        </select>
      ) : units?.[0] ? (
        <span className="text-sm text-ink-muted">{units[0].name}</span>
      ) : null}

      <span className="text-sm text-ink-muted">{currentPeriodLabel()}</span>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onOpenCommandPalette}>
          <Search className="h-4 w-4" aria-hidden />
          <span className="hidden text-xs text-ink-muted md:inline">⌘K</span>
        </Button>
        <Button variant="ghost" size="sm" aria-label="Alerts">
          <Bell className="h-4 w-4" aria-hidden />
        </Button>
        <UserMenu user={user} />
      </div>
    </header>
  );
}
