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

## Rare `test:int` flake: `dashboard.integration.spec.ts` › "a reversed voucher's amount drops back out of period.spent"

**Observed:** 2026-07-30, during Cash Flow bug-fix verification (new `DashboardRepository.sumNetSpend`, unrelated to voucher reversal itself). One `pnpm test:int` run out of four consecutive full-suite runs failed with:

```
FAIL test/dashboard.integration.spec.ts > GET /dashboard/unit/:id — spent (this period) nets out reversed vouchers > a reversed voucher's amount drops back out of period.spent
Error: expected 201 "Created", got ... (POST /expenses/:id/reverse)
```

**Ruled out:** not a repeat of the `sumNetSpend` uuid/text bug fixed earlier the same session (that one failed deterministically on every run with a 500 and a distinct Prisma error; this failure is a plain unexpected status on a `POST .../reverse` call). Two subsequent full-suite runs both passed clean (214/214 both times), and the same test had already passed clean on the very first run after the real bug was fixed.

**Not investigated further** — matches the same auth/session-timing-under-parallel-load signature already suspected for the `attachments-and-checks.integration.spec.ts` and `expenses.integration.spec.ts` flakes above (a POST that should succeed intermittently doesn't, no data-assertion involved). Adds a third file to that suspected pattern.

## Rare `test:int` flake: `admin-settings.integration.spec.ts` › "Finance Officer gets 403" — `loginAs` itself fails

**Observed:** 2026-07-30, during denomination-based cash count verification (schema/API/UI changes confined to `MonthlyClosing`/`CashCountDenomination` and the month-close module — nothing touching admin settings or auth). One `pnpm test:int` run out of four consecutive full-suite runs failed with:

```
FAIL test/admin-settings.integration.spec.ts > GET /admin/settings — permission gate (admin.manage_users_units, Super Admin only) > Finance Officer gets 403
Error: expected 200 "OK", got 404 "Not Found"
  ❯ loginAs test/admin-settings.integration.spec.ts:25:111
```

`POST /auth/login` itself returned 404 instead of 200. Ruled out as unrelated to this session's change (a completely different module); two subsequent full-suite runs both passed clean (217/217 both times). Same suspected root cause as the two other auth/session-timing flakes already documented above (`attachments-and-checks.integration.spec.ts`, `expenses.integration.spec.ts`) — a new symptom (404 on the login route itself, not a 401/403 on a later request) but the same general class, not investigated further for the same reasons.

## Rare `test:int` flake: `exports.integration.spec.ts` › async export polling times out (recurrence)

**Observed:** 2026-07-30, during ADR-0008 verification (`allocation.confirm_receipt` permission grant change — nothing touching reports/exports). One `pnpm test:int` run out of four consecutive full-suite runs (immediately after a fresh `pnpm db:seed` reseed of both dev and test databases) failed with a supertest assertion timeout inside the async job-polling helper (`test/exports.integration.spec.ts:43-45`), 2 tests affected. Same file and same general mechanism (async export-job polling) as the entry above, but a different failure shape (a raw timeout, not "expected FAILED to be READY").

**Ruled out:** not caused by this session's change — ADR-0008 touches only `allocation.confirm_receipt`'s grant and the allocation/replenishment confirm flows, nothing in the reports/exports pipeline. The isolated file passed clean (9/9) run in isolation immediately after. Two subsequent full-suite runs both passed clean (224/224 both times).

**Not investigated further** — same reasoning as the original entry; noting the recurrence (a second, differently-shaped failure in the same file) as weak evidence this is a real, if rare, timing issue in the export-job polling path rather than a one-off fluke, still not diagnosed.

## Rare `test:int` flake: `reports-extended.integration.spec.ts` › "the open (endDate: null) streak unit codes exactly match the accounts currently negative"

**Observed:** 2026-07-30, same ADR-0008 verification session, on the run immediately following the `exports.integration.spec.ts` flake above (i.e., the second of four consecutive full-suite runs). Failed with:

```
FAIL test/reports-extended.integration.spec.ts > RPT-07 Negative Balance > the open (endDate: null) streak unit codes exactly match the accounts currently negative
AssertionError: expected Set{ 'PSH-SOH' } to deeply equal Set{}
```

**Ruled out:** not caused by ADR-0008 — the change touches only `allocation.confirm_receipt` and the two test files that exercise it directly (`replenishments.integration.spec.ts`, `pending-confirmations.integration.spec.ts`, both using PSH-SUK, not PSH-SOH). The isolated file passed clean (32/32) immediately after. Two subsequent full-suite runs both passed clean (224/224 both times).

**Not investigated further** — matches the already-suspected root cause named in the `attachments-and-checks.integration.spec.ts` entry above: PSH-SOH's heavy reuse as a shared fixture account across many test files, combined with the test database never being reset between repeated `pnpm test:int` invocations within one working session (as opposed to a single isolated CI run) — each rerun accumulates more ledger history on the same account. Consistent with that entry's guess, still unconfirmed.

**Update, 2026-07-31, during ADR-0009 verification:** escalated from rare to reliably reproducing — three full-suite runs in a row failed with this exact assertion, and it now fails even in isolation (previously always passed 32/32 alone). Confirmed unrelated to ADR-0009: that change touches only `packages/contracts/src/schemas/{allocations,replenishments}.ts`, `allocations.service.ts`/`replenishments.service.ts`, and the frontend confirm UI — no file anywhere near `reports.service.ts`, `reports.repository.ts`, or PSH-SOH. Live-queried PSH-SOH's actual `cached_balance` in `psh_petty_cash_test` at failure time: `584.56`, positive — so the account genuinely isn't negative right now, yet the streak detector reports an open (unclosed) negative streak for it.

Looked one level deeper this time: `listAllLedgerEntriesChronological` (`reports.repository.ts`) orders by `[{ effectiveDate: "asc" }, { createdAt: "asc" }]` — a real tiebreaker exists, so the ordering itself is deterministic for a fixed set of rows. That rules out query non-determinism. What's left is exactly the already-suspected mechanism, now with a concrete shape: several files (`cash-accounts-ledger.integration.spec.ts` especially) reuse a small fixed set of `effectiveDate`s for PSH-SOH (e.g. `2026-07-01`..`2026-07-10`) on every single `pnpm test:int` run this whole session, and because `createdAt` breaks ties, whichever fixture's row happened to be inserted *last* among same-dated entries — which depends on this session's specific run history, not on any single run's own logic — determines whether the reconstructed point-in-time balance curve's last point on that date is negative or positive. Still not fixed, still out of scope for whatever task surfaces it next, but the mechanism is no longer a total guess.

**Update, 2026-07-31, during the organizational-unit rename:** same failure, same account, now reported as `Set{ 'PSH-CCS' }` instead of `Set{ 'PSH-SOH' }` — PSH-SOH was renamed to PSH-CCS in-place (same `id`, same ledger history) as part of that task. Confirms the root cause is genuinely about accumulated ledger rows on that one account, not anything tied to the literal code string. Unrelated to the rename itself (which only ever `UPDATE`s `organizational_units.code`/`name`/`city`, never touches `cash_ledger_entries`).

## Rare `test:int` flake: `replenishment-requests.integration.spec.ts` › `loginAs` itself fails (recurrence)

**Observed:** 2026-07-31, during ADR-0010 verification (the new Replenishment Request → Approve → Confirm workflow — a new module/controller/service/test file, nothing touching `auth.*`). One full-suite `pnpm test:int` run failed at the very first step of `replenishment-requests.integration.spec.ts`'s "is blocked with 409 for a held unit" test:

```
POST /auth/login → 404 (expected 200)
  ❯ loginAs test/replenishment-requests.integration.spec.ts
```

**Investigated before concluding it's the same pre-existing flake, not a new bug:**
- Confirmed `user.ftzdhq@psh.local`/`user.ftzmcr@psh.local` (the emails this test's `loginAs` calls) and `FTZ-DST-DHQ`/`FTZ-DST-MCR` (their units) are real, active, correctly present in `psh_petty_cash_test` right now — queried directly, not assumed. Rules out a stale-seed-data theory (plausible on its face, given this session's earlier org-unit rename, but not what actually happened here).
- Ran the file in isolation: 19/19 clean.
- Ran the full suite five more times after the failure (three during this investigation, two more explicitly to check for reproduction): 19/19 files, 243/243 tests, clean every time. Could not reproduce.
- Confirmed `/auth/login` is `@Throttle`d (20/60s) — a plausible-sounding culprit, but throttling produces 429, not 404, and this exact "429 vs 404" distinction was already explicitly ruled out for the very first flake in this file (`attachments-and-checks.integration.spec.ts` entry, above). Not the cause here either.
- Confirmed the integration suite never goes through `main.ts`'s real `bootstrap()` (CORS/helmet/etc.) — each file builds its own `Test.createTestingModule({ imports: [AppModule] }).compile()` and talks to it in-process via `supertest(app.getHttpServer())`, so `main.ts` isn't a candidate mechanism.

**Conclusion:** this is the same symptom, on the same route, as the already-documented `admin-settings.integration.spec.ts` entry immediately above — "404 on `POST /auth/login` itself under full-suite load" — now recurring for the third time, in a second unrelated file, with a third unrelated code change underneath it. Not caused by this session's change (a brand-new module with no auth-path involvement at all). No fix was applied to the test, because there is nothing demonstrably wrong with it — `loginAs` here is byte-for-byte the same pattern every other integration file already uses correctly, and it passes reliably. Recording this occurrence per this doc's own purpose: three sightings of the same specific symptom, across three sessions and three unrelated code changes, is stronger evidence this is a real (if rare) environmental issue than any single sighting — still not diagnosed, still out of scope for whatever task surfaces it next.

**Update, 2026-07-31 — deliberate reproduction attempt with request-level instrumentation:** built temporary diagnostics (`apps/api/test/_diagnostics.ts`, patched `http.Server.prototype.emit`/`http.ServerResponse.prototype.writeHead` process-wide, logging every request/response and dumping the live Express route table on startup and on any 404/401) and wired it into all 18 app-creating integration test files. Ran `pnpm test:int` in a loop, ~36 full-suite runs total across three loop configurations. Findings, reported in full rather than just the headline:

- **The exact originally-reported symptom — 404 specifically on `POST /auth/login` — did not reproduce even once** across all ~36 instrumented runs, despite this investigation being triggered by a real sighting of it. Whatever conditions produce it are narrower than "run the suite repeatedly," or it's rarer than the ~10% rate the broader symptom family showed (below).
- **A broader, related symptom family reproduced readily**: real tests that `.expect(200)`/`.expect(201)` getting back 401/403/404 instead, at roughly a 10% per-run rate, concentrated almost entirely in `reports-extended.integration.spec.ts` (the largest file, 32 tests, first to run, includes async export-job polling loops) — e.g. `RPT-08`'s summary-reconciliation request got 404, `RPT-15`'s cross-unit ranking request got 401, `RPT-01`'s export-status poll got 403, all on requests that had just been working moments earlier in the same run.
- **In every case the instrumentation could confirm, the route itself was present and correctly registered** in the live Express route table at the moment of failure (`routeExistsInTable: true`) — this rules out "a route silently disappears from the table" as the mechanism, for at least the cases captured.
- **One apparent capture (`month-close.integration.spec.ts`'s "reopening without a reason is rejected" getting `expected 400, got 404`) turned out to be a genuine gap in the diagnostic instrumentation itself, not a clean capture**: the request-level log for that exact run/time-window shows the same reopen call succeeding with 201, meaning the patched `writeHead` hook did not observe whatever actually produced the reported 404 — some response path in this stack (NestJS exception filter → Express `res.status().json()` → Node's `ServerResponse`) evidently doesn't always route through `writeHead` in a way the patch catches. This means the "route table at the failure moment" question is **answered only for the cases the hook actually saw** (route present, every time) — it is not a complete accounting, and the hook itself should not be trusted as exhaustive if resurrected for a future attempt.
- **The already-documented RPT-07 negative-streak flake (PSH-CCS ledger accumulation, entries above) fired constantly during this loop** — 13–17 failures out of every ~20 runs — now effectively the *dominant* failure mode of a repeated `pnpm test:int` loop within one long working session, exactly matching what was predicted in this doc's earlier updates. It is unrelated to the 401/403/404 family and was correctly distinguished from it throughout (by grepping for the specific `expected <2xx>, got <4xx>` shape vs. the `Set{...}` assertion shape).

**Net conclusion:** the 401/403/404-under-load family is real, reproducible at ~10%/run, and concentrated in the suite's biggest/most polling-heavy file — but a specific, provable root cause (e.g. a connection-pool exhaustion point, a session-lookup race, a throttler edge case) was not established, and the one deep-dive capture that looked promising turned out to reveal a gap in the diagnostic method rather than the app. The original login-404 sighting specifically was not reproduced even once under deliberate, repeated, instrumented pressure. All temporary instrumentation (`apps/api/test/_diagnostics.ts` and every `installAuthLoginDiagnostics(...)` call) has been removed — `pnpm typecheck`/`pnpm lint`/`pnpm test` confirmed clean afterward. **If this is picked up again:** don't re-derive a `writeHead` patch — instrument at the NestJS exception-filter / `Response` level instead (guaranteed to see every response NestJS sends, unlike a raw Node-core patch), and consider whether `reports-extended.integration.spec.ts`'s export-polling loops are saturating something under Postgres connection-pool pressure specifically, given the strong file-level concentration.
