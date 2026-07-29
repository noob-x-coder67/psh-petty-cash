# ADR-0005: `@Audited` is a metadata-only decorator, not a transaction-owning interceptor

**Status:** Accepted
**Date:** 2026-07-29

## Context

`docs/TECHNICAL_BUILD_PLAN.md` §3.4 describes the intended `@Audited` mechanism: a NestJS interceptor that owns the request's database transaction (via a `ClsService`-carried transaction handle) and writes the audit row itself, with the decorator becoming functional rather than purely descriptive. The stated reason is that "an audit row written after commit can be lost independently of the change it describes."

In the current codebase, every one of the 8 services that write audit rows (`auth`, `expenses`, `accounts`, `allocations`, `month-close`, `replenishments`, `attachments`, `reports/exports`) already manages its own `prisma.$transaction(async (tx) => {...})` block directly, and calls `AuditLogRepository.record(tx, {...})` as the literal last statement inside that same block — using the same `tx` handle the preceding business-logic writes used. This is confirmed correct: `record()`'s signature takes `tx: Prisma.TransactionClient` as its first positional argument, with no way to call it outside a transaction callback, and its own doc comment states the same intent as FR-AUD-002.

Adopting the build plan's original interceptor design as written would require: (a) adding `nestjs-cls` as a new dependency, and (b) refactoring all 8 services to stop opening their own `$transaction` blocks and instead pull a transaction handle from CLS state set up by the interceptor. That is a materially larger, riskier change to code that is already correct — and unrelated to fixing the actual gap, which is that audit coverage today is ad hoc (nothing declares which routes are expected to write an audit row, and nothing verifies they do).

## Decision

`@Audited({ action, entityType })` is implemented as a plain `SetMetadata`-based decorator, following the exact pattern already established by `@RequiresPermission`/`@RequiresUnitScope`/`@Roles` in `apps/api/src/common/decorators/`. It is purely declarative — it does not run any code, open any transaction, or write any row. The existing `record(tx, ...)` call sites, each already the last line inside its own `$transaction`, are unchanged.

The decorator's metadata is read by a reflection-based coverage test (Phase 2 of this security-hardening effort) that asserts every mutating controller route carries it, and by a permission test matrix (`packages/testing`) that reuses the same controller-reflection approach. A separate integration test proves the underlying atomicity claim directly — that a forced mid-transaction failure on an already-audited route leaves no orphaned audit row — rather than relying on the decorator to guarantee it.

## Rationale

The interceptor design solves a problem this codebase doesn't currently have: none of the 8 services has ever written an audit row outside its transaction. The actual, present gap is that this discipline is manual and unenforced — a new endpoint can be added without anyone noticing it should also write an audit row. A metadata decorator plus a coverage test closes exactly that gap, at a fraction of the risk, without touching a single line of the proven-correct transaction/audit code.

## Consequences

- `@Audited` never performs the write; a developer adding a new mutating endpoint must still call `auditLogRepository.record(tx, ...)` inside their own transaction, and must also add `@Audited(...)` metadata so the coverage test (Phase 2) doesn't fail on their PR.
- If the codebase later moves to a CLS-based request-scoped transaction (for reasons unrelated to audit — e.g. simplifying repository signatures), this decorator's metadata shape (`action`, `entityType`) is still reusable by a future interceptor; only the *mechanism* reading it would change.
- `nestjs-cls` is not introduced by this change.
