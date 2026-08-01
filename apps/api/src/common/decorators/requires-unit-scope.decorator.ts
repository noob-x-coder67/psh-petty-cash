import { SetMetadata, type CustomDecorator } from "@nestjs/common";

export const REQUIRES_UNIT_SCOPE_KEY = "requiresUnitScope";
export const ALL_UNITS_SCOPE_VALUE = "all";

/**
 * `"derived"` — no specific target unit to check; the handler/repository applies
 * `req.user.unitScope` itself as a filter (e.g. a list endpoint).
 * `"param.<name>"` / `"body.<name>"` / `"query.<name>"` — a specific target unit id
 * is present on the request; reject with 403 if it falls outside the caller's scope.
 */
export type UnitScopeSource = "derived" | `param.${string}` | `body.${string}` | `query.${string}`;

/** Optional aggregate access for a route whose unit field accepts a sentinel such as
 * `all`. Both broad unit scope and the named permission are required. Keeping the
 * sentinel and permission in metadata makes this reusable without teaching the guard
 * about an Expenses-specific query value or role list. */
export interface AggregateUnitScopePolicy {
  value: string;
  permission: string;
}

export interface UnitScopeRequirement {
  source: UnitScopeSource;
  allowAll?: AggregateUnitScopePolicy;
}

export type UnitScopeMetadata = UnitScopeSource | UnitScopeRequirement;

export const RequiresUnitScope = (requirement: UnitScopeMetadata): CustomDecorator<string> =>
  SetMetadata(REQUIRES_UNIT_SCOPE_KEY, requirement);
