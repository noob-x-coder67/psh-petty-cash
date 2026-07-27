# ADR-0003: Defer RPT-09 and RPT-10 to Phase 7, revise Phase 6's exit gate to 4 reports

**Status:** Accepted
**Date:** 2026-07-27

## Context

`docs/TECHNICAL_BUILD_PLAN.md`'s Phase 6 exit gate reads: "Finance reviews and accepts at least RPT-01, 03, 04, 06, 09, 10 against a known dataset. Report totals reconcile to the ledger exactly." Phase 6 (Reports Studio) is sequenced before Phase 7 (Month Close & Compliance) in the same phase table.

RPT-09 (Three-Month Compliance) and RPT-10 (Cash Count and Variance) are both fundamentally reports *over* Month Close data — physical cash counts, expected-vs-actual variance, and the three-month rolling compliance projection (BR-013) — none of which exists until Phase 7 builds the `monthly_closings` table and its closing/variance logic. There is no way to build a real, Finance-reviewable RPT-09 or RPT-10 with actual data before that table exists. This is a genuine contradiction in the Build Plan's own phase sequencing, not an ambiguity in wording.

## Decision

Phase 6 builds and gets Finance review on **RPT-01, RPT-03, RPT-04, and RPT-06** only, plus all of RPT-02, 05, 07, 08, 11 through 16 (the full 16-report dataset set minus RPT-09/RPT-10). RPT-09 and RPT-10 — and their ledger-reconciliation tests — are deferred until Phase 7 creates `monthly_closings`, and get their Finance review immediately after Phase 7 lands, not as part of Phase 6's own exit gate.

## Rationale

Building fake/stub Month Close data just to give RPT-09/RPT-10 something to reconcile against would mean shipping a report that reconciles against data invented for the purpose of passing the gate, not the real system — worse than honestly deferring it. The Build Plan's own Phase 7 sequencing note ("Phase 7 cannot start before Phase 2 and 3 are gate-passed, because compliance reads closing balances that read the ledger") already establishes the precedent that report-like features wait on their real data dependency; the same logic applies here, the Build Plan's phase-table ordering just didn't account for it when listing Phase 6's exit-gate report set.

## Consequences

- Phase 6's actual, revised exit gate: RPT-01/03/04/06 reviewed and accepted by Finance; report totals for all four reconcile exactly against direct ledger/voucher aggregates (an automated test suite, modeled on `scripts/rebuild-balances.ts`'s drift-check precedent).
- RPT-09 and RPT-10 are still built as part of Phase 6's 16-dataset scope wherever their *query logic* doesn't require `monthly_closings` (e.g. a Three-Month Compliance report can still show which of the preceding three months are `CLOSED` once that state exists) — but they cannot be meaningfully reviewed or reconciliation-tested until Phase 7 supplies real closing data. If Phase 6 work reveals that RPT-09/10's dataset code has no meaningful shape without `monthly_closings` at all, building them is itself deferred to Phase 7, not just their review.
- Phase 7's own eventual exit gate should explicitly include "RPT-09 and RPT-10 reviewed and accepted by Finance" as a carry-over item from this deferral.
