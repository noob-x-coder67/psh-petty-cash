import { BadRequestException } from "@nestjs/common";
import type { ReportFilter } from "@psh/contracts";
import { ReportFilterSchema } from "@psh/contracts";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { currentKarachiPeriod } from "../dashboard/period.util";

const DAY_MS = 24 * 60 * 60 * 1000;

/** GET /reports/:reportKey takes its filter object as a single JSON query string (the
 * same shape POST /exports sends as a body) so a saved preset, a live preview and an
 * export all serialize from the exact same ReportFilter value. */
export function parseFiltersQuery(raw: string | undefined): ReportFilter {
  if (!raw) return {};
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new BadRequestException("filters query parameter must be valid JSON");
  }
  const result = ReportFilterSchema.safeParse(json);
  if (!result.success) {
    throw new BadRequestException(result.error.flatten());
  }
  return result.data;
}

/** Appendix A "Export reports": Own for Center User/In-Charge, All for Finance/Auditor/
 * Super Admin. `null` means no unit filter (every petty-cash unit); a non-null array is
 * an exact allow-list — for a unit-scoped caller this is always clamped to their own
 * units, even if they explicitly ask for a unit outside that scope (the intersection
 * empties out rather than silently expanding access). Pure and unit-tested since this is
 * the one place a permission boundary and a data filter interact. */
export function resolveScopedUnitIds(requested: string[] | undefined, user: AuthenticatedUser): string[] | null {
  if (user.unitScope.all) {
    return requested && requested.length > 0 ? requested : null;
  }
  if (!requested || requested.length === 0) {
    return user.unitScope.unitIds;
  }
  const allowed = new Set(user.unitScope.unitIds);
  return requested.filter((id) => allowed.has(id));
}

/** Reports default to the current Asia/Karachi month (matching the dashboard) when no
 * explicit range is given. dateTo is user-facing "through this date" (inclusive), so it's
 * converted to an exclusive upper bound one day later — the same convention every
 * ledger-range query in this codebase already uses. */
export function resolveReportPeriod(
  filter: Pick<ReportFilter, "dateFrom" | "dateTo">,
  now: Date = new Date(),
): { start: Date; end: Date } {
  if (!filter.dateFrom && !filter.dateTo) {
    return currentKarachiPeriod(now);
  }
  const start = filter.dateFrom ? new Date(`${filter.dateFrom}T00:00:00.000Z`) : new Date(0);
  const end = filter.dateTo ? new Date(new Date(`${filter.dateTo}T00:00:00.000Z`).getTime() + DAY_MS) : now;
  return { start, end };
}
