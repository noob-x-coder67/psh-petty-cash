"use client";

import type { AuthenticatedUser, OrganizationalUnit } from "@psh/contracts";
import {
  Button,
  cn,
  IconButton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@psh/ui";
import { useQuery } from "@tanstack/react-query";
import { Bell, Building2, Calendar, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api-client";
import { useUnitScope } from "../../lib/use-unit-scope";
import { ThemeToggle } from "./theme-toggle";
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

// SRS §11.5's masthead should compact slightly while scrolling rather than jump — a
// short scroll listener toggling one boolean, transitioned via CSS, is enough; no need
// for a scroll library for a single threshold check.
function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > threshold);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

export function Masthead({ user, onOpenCommandPalette }: MastheadProps) {
  const { data: units } = useQuery({
    queryKey: ["units"],
    queryFn: () => apiFetch<OrganizationalUnit[]>("/units"),
  });
  const { unitCode, setUnitCode } = useUnitScope();
  const environment = process.env.NEXT_PUBLIC_APP_ENV;
  const envBadge = environment && environment !== "production" ? environment : null;
  const scrolled = useScrolled();

  return (
    <header
      style={{ zIndex: "var(--z-sticky)" }}
      className={cn(
        "sticky top-0 flex shrink-0 items-center gap-4 border-b border-border bg-surface-1/90 px-4 backdrop-blur-lg backdrop-saturate-150 transition-[height,box-shadow,border-color] duration-200",
        scrolled ? "h-12 border-border-strong/60 shadow-2" : "h-16",
      )}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-control bg-linear-to-br from-midnight-900 to-royal-600 font-semibold tracking-wide text-white shadow-1 transition-all duration-200",
            scrolled ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs",
          )}
        >
          PSH
        </div>
        <div className="hidden flex-col leading-tight sm:flex">
          <span className="flex items-center gap-2 text-sm font-semibold text-ink">
            Petty Cash
            {envBadge ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-500">
                {envBadge}
              </span>
            ) : null}
          </span>
          {!scrolled ? <span className="text-[11px] text-ink-muted">Pakistan Sweet Home</span> : null}
        </div>
      </div>

      <div className="hidden h-6 w-px bg-border lg:block" aria-hidden />

      {units && units.length > 1 ? (
        <div className="hidden items-center gap-1.5 lg:flex">
          <Building2 className="h-4 w-4 text-ink-muted" aria-hidden />
          <Select value={unitCode ?? units[0]?.code ?? ""} onValueChange={setUnitCode}>
            <SelectTrigger
              aria-label="Unit"
              className="w-40 max-w-56 border-transparent bg-transparent hover:bg-interactive-surface xl:w-56"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {units.map((unit) => (
                <SelectItem key={unit.id} value={unit.code}>
                  {unit.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : units?.[0] ? (
        <div className="hidden items-center gap-1.5 lg:flex">
          <Building2 className="h-4 w-4 text-ink-muted" aria-hidden />
          <span className="text-sm text-ink-muted">{units[0].name}</span>
        </div>
      ) : null}

      <div className="hidden items-center gap-1.5 text-sm text-ink-muted md:flex">
        <Calendar className="h-4 w-4" aria-hidden />
        {currentPeriodLabel()}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <ThemeToggle />
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenCommandPalette}
          className="gap-2 text-ink-muted hover:text-ink"
        >
          <Search className="h-4 w-4" aria-hidden />
          <span className="hidden items-center gap-0.5 text-xs md:flex">
            <kbd className="rounded border border-border bg-surface-0 px-1 py-0.5 font-sans">⌘K</kbd>
          </span>
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <IconButton aria-label="Alerts" size="sm">
              <Bell className="h-4 w-4" aria-hidden />
            </IconButton>
          </TooltipTrigger>
          <TooltipContent>Alerts</TooltipContent>
        </Tooltip>
        <UserMenu user={user} />
      </div>
    </header>
  );
}
