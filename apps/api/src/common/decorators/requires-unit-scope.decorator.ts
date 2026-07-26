import { SetMetadata, type CustomDecorator } from "@nestjs/common";

export const REQUIRES_UNIT_SCOPE_KEY = "requiresUnitScope";

/**
 * `"derived"` — no specific target unit to check; the handler/repository applies
 * `req.user.unitScope` itself as a filter (e.g. a list endpoint).
 * `"param.<name>"` / `"body.<name>"` — a specific target unit id is present on the
 * request; reject with 403 if it falls outside the caller's unit scope.
 */
export type UnitScopeSource = "derived" | `param.${string}` | `body.${string}`;

export const RequiresUnitScope = (source: UnitScopeSource): CustomDecorator<string> =>
  SetMetadata(REQUIRES_UNIT_SCOPE_KEY, source);
