# ADR-0006: Remove the unused role-based guard branch; `RolesGuard` renamed to `PermissionGuard`

**Status:** Accepted
**Date:** 2026-07-29

## Context

`docs/TECHNICAL_BUILD_PLAN.md` §6 ("Authorization: three layers, none skippable") documents `RolesGuard` as one of three intended authorization layers, illustrated with an example `@Roles('FINANCE_MANAGER', 'SUPER_ADMIN')`. `RolesGuard.canActivate` was built and unit-tested with two independent branches: a `requiredRoles` check (via `@Roles`/`ROLES_KEY`) and a `requiredPermission` check (via `@RequiresPermission`/`REQUIRES_PERMISSION_KEY`).

Confirmed empirically (grepping the entire `apps/api/src` tree, real code and test code both): `@Roles(` is applied to zero routes, anywhere. It was registered globally (`APP_GUARD` in `common.module.ts`) and reachable on every request, but its role branch never once executed against real traffic — every controller uses `@RequiresPermission` exclusively. The permission-test matrix added earlier this phase (`permission-matrix.spec.ts`) empirically confirmed the same thing from the other direction: `route.requiredRoles` was `undefined` for all 36+ gated routes it walked, making its role clause vacuously true in every case.

Separately, `docs/MASTER_SRS.md` Appendix A (the binding role-permission matrix) is implemented entirely through seeded `role_permissions` rows resolved against `@RequiresPermission` — the Build Plan's own text (§ "Appendix A is seeded as data, not hardcoded in guards") already states this is the intended mechanism. No BR-/FR-/AC- requirement ID anywhere mandates a second, role-only gating layer independent of permissions.

## Decision

Remove `@Roles`/`ROLES_KEY` entirely (`apps/api/src/common/decorators/roles.decorator.ts` deleted). `RolesGuard` is renamed to `PermissionGuard` (`roles.guard.ts` → `permission.guard.ts`) and stripped down to only its `requiredPermission` branch — the branch that was ever actually exercised. `packages/testing`'s `buildPermissionMatrix` drops the now-meaningless `rolesMetadataKey`/`requiredRoles` parameter and field.

**Note for anyone who goes looking for `RolesGuard` after reading the Build Plan's three-layers section**: that class no longer exists under that name. It is `PermissionGuard` (`apps/api/src/common/guards/permission.guard.ts`), and it only ever checks `@RequiresPermission` — the role-checking behavior the Build Plan illustrates was never wired to any real route and has been removed, not merely renamed around.

## Rationale

Wiring `@Roles` into real routes now, instead of removing it, was the alternative considered — but every access-control outcome Appendix A specifies is already fully expressed through `@RequiresPermission` plus seeded `role_permissions`. Adding role checks on top would create a second, independent authorization axis with no functional gain and a real ongoing cost: two sources of truth (a seeded permission matrix and a set of hardcoded role lists scattered across decorators) that can silently drift apart as roles or permissions change. This is exactly the "narrative design language explains intent but never overrides an explicit requirement" case `CLAUDE.md` describes — the Build Plan illustrates a role-based layer, but nothing binding requires one, and the permission-based model alone already satisfies every binding requirement.

## Consequences

- `PermissionGuard` is the sole `APP_GUARD`-registered authorization guard alongside `JwtAuthGuard`/`UnitScopeGuard`/`ThrottlerGuard`; there is no remaining role-based backstop distinct from permissions.
- If a future requirement genuinely needs role-only gating independent of the permission matrix (a real BR-/FR-/AC- id, not just convenience), it should be reintroduced deliberately against that requirement — not by resurrecting this branch, since the permission-key model is now the sole documented access-control mechanism.
- `permission-matrix.spec.ts`'s test count is unaffected: the role clause it dropped was already vacuously true for every case, so removing it changes zero pass/fail outcomes.
