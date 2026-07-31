# ADR-0007: Finance Manager/Super Admin close a month administratively, without a cash-count precondition

**Status:** Accepted
**Date:** 2026-07-30

## Context

`docs/MASTER_SRS.md` §6.5/§12 and the original Month Close implementation assumed a single linear flow: the unit records a physical cash count, then Finance closes the month once that count exists (`month-close.service.ts`'s `closeMonth` rejected closing with `ConflictException` whenever `physicalCashCount` was null). `cash_count.enter` (`prisma/seed-data.ts:75`) was granted to all five roles, including `FINANCE_MANAGER`/`SUPER_ADMIN`, and Appendix A's `Enter cash count` row read `Yes Yes Yes Yes Yes` — Finance could, in principle, enter a count itself to unblock closing.

In practice this created a dead end: Finance/Super Admin need to close a period administratively — e.g. a unit that never reports, or a period that needs closing to unblock three-month replenishment tracking for other units — without being the ones who physically count the drawer (that's the center's job, not Finance's) and without being blocked indefinitely on a count they have no practical way to obtain. The existing `POST /monthly-close/:id/close` route made this concretely impossible in a second way: it addressed the closing by an opaque row `id`, but a period with *no* cash count ever recorded also has no `MonthlyClosing` row and therefore no `id` — there was no way to close such a period at all, by any role.

## Decision

- `cash_count.enter` is restricted to `UNIT_USER`, `UNIT_INCHARGE`, `FINANCE_OFFICER` (Appendix A `Enter cash count`: `Yes Yes Yes No No`). `FINANCE_MANAGER`/`SUPER_ADMIN` no longer enter or review cash counts at all — the section is removed from their Month Close view entirely, not shown read-only either.
- `month.close` is unchanged (`FINANCE_MANAGER`/`SUPER_ADMIN` only — this was already the case before this ADR).
- Closing a month no longer requires a recorded physical cash count. Structurally this only ever affects Finance Manager/Super Admin, since they are the only roles that can reach `closeMonth` — the precondition is removed unconditionally from that method rather than branched by role.
- The close action is re-addressed by `unitId`/`periodYear`/`periodMonth` instead of a `MonthlyClosing` row id (`POST /monthly-close/close`, replacing `POST /monthly-close/:id/close`), so a period with no prior row can be closed directly. When closing a period with no existing row, `expectedBalance` is computed and frozen at close time (the same computation `recordCashCount` already performs), while `physicalCashCount`/`variance`/`remarks` remain `null` — an honest "never counted," distinct from a recorded zero.
- `GET /monthly-close/:unitId/:year/:month` is re-gated from `cash_count.enter` to `dashboard.view_own_unit`, so Finance Manager/Super Admin (and Unit In-Charge, and now Auditor) can still view a period's status and close/reopen it without needing cash-count entry rights.

## Rationale

Removing the precondition without also fixing the row-id addressing scheme would have left the actual reported problem unsolved (a period with no row still couldn't be closed by anyone). Re-gating `GET` was necessary, not optional: it was the only permission the read endpoint had, so removing `cash_count.enter` from Finance Manager/Super Admin without changing `GET` would have also removed their ability to see status or close at all. `dashboard.view_own_unit` already exists for exactly this "can view this unit's own data" purpose and is used identically by `ReplenishmentsController`'s compliance endpoint.

The alternative considered was branching `closeMonth`'s precondition checks by role instead of removing them outright. Rejected: only Finance Manager/Super Admin can ever call `closeMonth` (permission-gated), so a role branch inside the method would be dead code — and worse, the remarks-required-on-mismatch check would be a trap Finance Manager/Super Admin have no UI to resolve, since the cash-count section (where remarks live) is hidden from them entirely.

## Consequences

- **A `CLOSED` status alone no longer implies a reconciled physical count.** `evaluateThreeMonthCompliance` (`replenishments.rules.ts`) and BR-013's fourth-month replenishment gate read `status` alone — a period closed administratively by Finance Manager/Super Admin with no cash count satisfies the gate identically to a properly-counted one. This is accepted deliberately as this ADR's intent (Finance/Super Admin are trusted to close administratively), not an oversight, but anyone reading compliance/replenishment eligibility should know `CLOSED` no longer guarantees a reconciled drawer.
- RPT-10's `totalVariance` summary (`reports.service.ts`'s `buildCashCountVariance`) silently omits periods closed with no count from its total (rather than flagging them as unreconciled) — a known, accepted reporting limitation, not addressed by this change.
- `AUDITOR` gains read access to Month Close status as a side effect of the `GET` permission change (`dashboard.view_own_unit` already includes `AUDITOR`) — consistent with Auditor's existing read-only-all-units remit, not something requested but a natural and harmless consequence.
- `POST /monthly-close/:id/close` no longer exists; `POST /monthly-close/close` (body: `unitId`/`periodYear`/`periodMonth`) replaces it. Any external caller of the old route needs updating — none exist outside this codebase's own frontend at the time of this decision.
