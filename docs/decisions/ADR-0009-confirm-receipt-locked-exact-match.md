# ADR-0009: Confirming receipt is a locked, exact-match action, not a variable amount

**Status:** Accepted
**Date:** 2026-07-31

## Context

Earlier the same night, live testing found that confirming an allocation or replenishment for an amount different from what was issued was accepted with no validation at all. That was fixed inline (not as its own ADR) by reusing month-close's cash-count variance pattern: `confirmedAmount` became a client-supplied figure, and a mismatch against the original amount required `varianceRemarks` before it would save (`allocations.service.ts`/`replenishments.service.ts`, both citing FR-CLS-003/004's "flag, don't block" precedent).

On reflection, that model doesn't fit this flow. Petty cash is handed over physically, hand-to-hand. Unlike a bank transfer, there is no realistic mechanism by which a center could receive a different amount than what Finance actually handed over — either the exact amount arrived, or something went wrong in a way that a same-form "reason" text field cannot meaningfully capture. Reusing the cash-count variance pattern here treated a routine handoff as if it were as failure-prone as a physical drawer count, which it structurally isn't.

`docs/MASTER_SRS.md` §8.1 step 5 (Cash Allocation workflow) narrative had already said *"Unit confirms receipt date and received amount"* — the origin of the variable-amount design — but no binding requirement mandates it. **FR-CASH-003** ("Record recipient confirmation"), **FR-CASH-009** ("Audit allocation edits, reversals and confirmations"), and **FR-REP-005** ("Record replenishment amount, date, reference and receipt confirmation") are all satisfied identically by a locked exact-match confirmation. §8.5 (Replenishment workflow) never had equivalent wording.

## Decision

- Confirming an allocation or replenishment no longer accepts a client-supplied amount. `ConfirmAllocationRequestSchema`/`ConfirmReplenishmentRequestSchema` (`packages/contracts`) now carry only `confirmedDate`.
- The confirmed amount is always the record's own original amount, read server-side, never taken from the request. There is no variance check and no remarks requirement in this flow.
- The frontend's confirm panel (`pending-confirmations.tsx`) shows the original amount as a locked, read-only value — not an editable input — alongside a `confirmedDate` field and a plain "Confirm" action.
- `confirmedDate` remains client-supplied and editable (not forced to "today"): it is the ledger entry's `effectiveDate`, which determines the accounting period the cash movement lands in, and a center may legitimately confirm a few days after physically receiving the cash.
- `docs/MASTER_SRS.md` §8.1 step 5 is reworded to match: confirmation is a locked, exact-match attestation, not a "received amount" the unit types in.

A genuine discrepancy (cash missing in transit, damaged, etc.) is an exceptional, out-of-band event. It is not handled by this flow. If it needs a system-recorded path in the future, that is a separate, deliberately-scoped "report a discrepancy" feature, not a repurposed variance field on routine confirmation.

## Rationale

The variance/remarks model is still correct and unchanged for month-close's cash-count reconciliation (`month-close.service.ts`, via `computeVariance`/`remarksRequired` in `month-close.rules.ts`) — a physical drawer count genuinely can and does differ from a computed expected balance, for ordinary reasons (timing, minor counting error) that are worth recording inline. Confirming receipt of a hand-to-hand cash handoff is a different kind of event with a different failure mode, and borrowing the same UI/validation pattern for it was a mismatch, not a reuse of a good idea.

## Consequences

- `confirmedAmount` (API response) and the `confirmed_amount`/`confirmed_variance_remarks` database columns are unchanged in shape. Going forward, `confirmedAmount` will always equal the original amount, and `confirmedVarianceRemarks` will always be `null` on new confirmations. Rows confirmed earlier tonight under the old variance-based flow (a small number, from live testing) keep whatever variance and remarks were recorded at the time — no backfill, no deletion, per this codebase's standing rule against altering historical financial records.
- Any external or future caller that still sends `confirmedAmount`/`varianceRemarks` in a confirm request has those fields silently ignored (the schema no longer defines them) — the server never trusts a client-supplied amount for this action, by construction, not by an added check.
- There is currently no system-level way to record a discrepancy between what was allocated/replenished and what a center says it received. This is a known, accepted gap until (and unless) a dedicated discrepancy-reporting feature is scoped.
