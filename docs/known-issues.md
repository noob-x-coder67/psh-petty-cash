# Known Issues

Observed, unresolved issues that don't yet have a root cause or a fix — tracked here so they aren't lost between sessions. Not a substitute for a GitHub issue if this repo later gets one; for now, this is the durable record.

## Rare `test:int` flake: `attachments-and-checks.integration.spec.ts` › "reverting to Unchecked requires a reason"

**Observed:** 2026-07-29, during Phase 8 cleanup verification. One `pnpm test:int` run out of roughly six consecutive full-suite runs failed with:

```
FAIL test/attachments-and-checks.integration.spec.ts > Checked/Unchecked (BR-008, FR-CHK-001..007) > reverting to Unchecked requires a reason and is recorded in history
Error: expected 201 "Created", got 404 "Not Found"
```

A `POST /expenses/:id/check` returned 404 for a voucher the same test had just created and received a 201 for, seconds earlier.

**Ruled out** (not re-investigated further, but confirmed before moving on):
- Not a `ThrottlerGuard` 429 — the error is explicitly a 404, not 429.
- Not caused by the closed-period enforcement added the same day (`expenses.service.ts`'s `assertPeriodNotClosed`) — grepped every real `POST /monthly-close/:id/close` call across the whole integration suite; none closes a real `2026-07` period for PSH-SOH (the unit this test uses), all use synthetic future test years.
- Not a bug in the test itself — the file passes reliably 3/3 in isolation.
- Not reliably reproducible — the full suite passed clean on 4 consecutive runs immediately before and after the one failure.

**Not yet investigated:** what specifically causes the 404 under full-suite load. Best guess, unconfirmed: some cross-file interaction via the shared, never-reset `psh_petty_cash_test` database and PSH-SOH's heavy reuse as a fixture account across many test files (the same general risk class as the year-collision and fixture-leak issues already fixed earlier this session) — but this is a guess, not a diagnosis.

**Next step, if picked up:** reproduce with the full suite's exact file order and DB state at failure time (e.g., dump `expense_vouchers`/`petty_cash_accounts` for PSH-SOH immediately on failure) rather than retrying blind.

## Rare `test:int` flake: `expenses.integration.spec.ts` — two different tests, two different error shapes

**Observed:** 2026-07-30, during Administration Phase 5 verification (a read-only `RolesController` addition with no relation to `expenses.*`). One `pnpm test:int` run out of three consecutive full-suite runs failed with two unrelated-looking assertions in the same file:

```
FAIL test/expenses.integration.spec.ts > closed-period enforcement (assertPeriodNotClosed, FR-CLS territory)
Error: expected 201 "Created", got 403 "Forbidden"

FAIL test/expenses.integration.spec.ts > Expense Register search/filter (SRS §12.6, Phase 5e) > date range filter excludes vouchers outside the range
Error: expected 200 "OK", got 401 "Unauthorized"
```

**Ruled out:** not caused by the Phase 5 change — `expenses.integration.spec.ts` passed 17/17 in isolation immediately after the failure, and two subsequent full-suite runs both passed clean (200/200 both times). Both failing assertions are auth/session related (401/403), not data assertions, which points at the same general class as the `attachments-and-checks` flake above — shared session/cookie state or DB timing under full-suite parallel load — rather than two independent new bugs.

**Not investigated further** — same reasoning as above: not reliably reproducible, out of scope for the task in progress when it was found.

## Rare `test:int` flake: `exports.integration.spec.ts` › "POST /exports returns PENDING immediately, then reaches READY"

**Observed:** 2026-07-30, during pending-confirmations verification (new `GET /allocations/pending/:unitId` and `GET /replenishments/pending/:unitId` routes, unrelated to reports/exports). One `pnpm test:int` run out of three consecutive full-suite runs failed with:

```
FAIL test/exports.integration.spec.ts > async export lifecycle (Build Plan §3.7) > POST /exports returns PENDING immediately, then reaches READY with a downloadable file
AssertionError: expected 'FAILED' to be 'READY'
```

An RPT-01 CSV export job reached the terminal `FAILED` status instead of `READY`, after polling.

**Ruled out:** not caused by this session's change — the two new routes touch `AllocationsRepository`/`ReplenishmentsRepository`/their services/controllers only, nothing in the reports/exports pipeline. Two subsequent full-suite runs both passed clean (209/209 both times).

**Not investigated further** — same reasoning as the two flakes above: not reliably reproducible, out of scope for the task in progress when it was found. Worth noting this is the first flake observed in `exports.integration.spec.ts` specifically (an async job-polling test, a different mechanism than the session/auth-timing suspected for the other two) — if this recurs, treat it as a possibly distinct root cause rather than assuming the same one.
