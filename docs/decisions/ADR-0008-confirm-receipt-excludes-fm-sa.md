# ADR-0008: Confirming allocation/replenishment receipt excludes Finance Manager/Super Admin

**Status:** Accepted
**Date:** 2026-07-30

## Context

`allocation.confirm_receipt` (`prisma/seed-data.ts:74`) was granted to `UNIT_USER`, `UNIT_INCHARGE`, `FINANCE_MANAGER`, and `SUPER_ADMIN`, matching Appendix A's `Confirm allocation receipt` row (`Yes Yes No Yes Yes`). `FINANCE_MANAGER`/`SUPER_ADMIN` also hold `allocation.record` (creation) — so either role could single-handedly create an allocation or replenishment and then confirm receipt of it themselves, in the same session, with no independent party involved. This defeats the purpose of a confirmation step: it exists to verify that cash physically reached the receiving unit, which is meaningless if the sender can also perform the verification.

No separate permission exists for replenishments. `ReplenishmentsController` reuses `allocation.confirm_receipt` for both `POST /replenishments/:id/confirm` and `GET /replenishments/pending/:unitId` (an existing code comment there notes a replenishment is treated as the same capability as recording an allocation), so this decision applies identically to both flows.

## Decision

- `allocation.confirm_receipt` is restricted to `UNIT_USER`, `UNIT_INCHARGE` (Appendix A `Confirm allocation receipt`: `Yes Yes No No No`). `FINANCE_MANAGER`/`SUPER_ADMIN` can no longer confirm receipt of an allocation or replenishment, whether one they created themselves or one created by anyone else.
- `allocation.record` is unchanged — Finance Officer, Finance Manager, and Super Admin still create allocations and replenishments; only the confirmation side is affected.
- No route, service, or schema changes: this is a pure permission-grant change. The API already 403s any caller lacking `allocation.confirm_receipt`, and the frontend's "Pending Confirmations" card (`pending-confirmations.tsx`) already returns `null` entirely when the caller lacks the permission, computed server-side from `/me`'s `permissionKeys` (`cash-flow/page.tsx`) — no UI code changes were needed to hide it.

## Rationale

Same separation-of-duties principle already applied in ADR-0007 (cash-count entry vs. month close): the party who authorizes/creates a financial action should not also be the party who confirms/verifies it. Restricting to `UNIT_USER`/`UNIT_INCHARGE` keeps confirmation exclusively with the unit actually receiving the cash, which is the only party in a position to know whether it physically arrived.

## Consequences

- If a unit never confirms receipt, Finance Manager/Super Admin now have no way to force-confirm it on the unit's behalf. No ledger entry posts for an allocation or replenishment until it is confirmed (`cash-accounts-ledger.integration.spec.ts` confirms creation alone posts nothing) — the money remains issued-but-unconfirmed on the books until someone with `UNIT_USER`/`UNIT_INCHARGE` for that unit acts. This is the deliberate intent of this decision, not an oversight, but it is a new operational dependency on the receiving unit that the SRS didn't previously have.
- A unit with no `UNIT_USER`/`UNIT_INCHARGE` account provisioned at all has no one who can ever confirm receipt for it. This is an existing admin/provisioning gap (a unit needs a seeded account), not something this permission change creates or is intended to fix — flagged here because it surfaced directly while auditing this change's test fixtures (unit PSH-COE, used in `replenishments.integration.spec.ts`, has no such account).
