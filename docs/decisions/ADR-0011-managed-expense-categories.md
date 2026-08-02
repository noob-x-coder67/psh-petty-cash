# ADR-0011: Replace the fixed expense-category enum with managed categories

**Status:** Accepted
**Date:** 2026-08-01

## Context

BR-006 and the original Phase 3 implementation fixed every expense line to exactly one
of `BUILDING`, `VEHICLE`, or `OTHER`. That assumption is now explicitly superseded by
Finance's approved 24-category list. The change is not just a larger list: Finance must
be able to add, rename, deactivate, and reorder categories through Administration, and
the `category.manage` permission has existed since Phase 1 for precisely that capability
but has never guarded a real route.

PostgreSQL enums are appropriate for genuinely closed state machines. They are a poor
fit for user-managed reference data: adding or renaming a value requires a deployment,
there is no natural inactive state, and historical values are difficult to preserve
without keeping application constants indefinitely. The current three-value assumption
has already changed once before launch, so extending the enum to 24 values would repeat
the same architectural mistake at a larger scale.

`OTHER` currently has a three-layer BR-007 rule: the form asks for an explanation, the
API rejects fewer than five trimmed characters, and PostgreSQL enforces the same minimum.
Finance has renamed that category to `Miscellaneous`; the rule itself must not change.

## Decision

1. Replace the `expense_category` PostgreSQL enum with an `expense_categories` reference
   table. Expense lines reference a stable category UUID. Category names are case-
   insensitive unique values, while `is_active` controls whether a category is available
   for new vouchers. Categories are never hard-deleted.
2. Seed the 24 approved category names in strict A-Z display order. `Miscellaneous` keeps
   its natural alphabetical position and is not pinned to the end. `sort_order` stores
   that order so Finance can deliberately reorder categories later. A newly created
   category is inserted at its natural alphabetical rank and following ranks are shifted;
   a later explicit Finance reorder is treated as an intentional override of the default
   alphabetical order.
3. Store BR-007 as category metadata: `Miscellaneous.requires_explanation = true`; every
   other initial category is `false`. The existing `other_explanation` column and API
   field remain in place for compatibility. The UI label changes, but the minimum remains
   five trimmed characters and PostgreSQL continues to enforce it through a trigger.
4. Apply Finance's approved historical mapping in place:
   - `BUILDING` -> `Repair & Maintenance: Building`
   - `VEHICLE` -> `Repair & Maintenance: Vehicle`
   - `OTHER` -> `Miscellaneous`
   No legacy-only category rows are created. Voucher, line, amount, and explanation data
   are otherwise unchanged.
5. Convert live `report_presets.filters.category` strings to stable `categoryId` values.
   Do not rewrite `report_exports.filters` or `audit_logs` JSON: those are historical
   records of what the system and user called a category at the time.
6. Enforce `category.manage` on every Administration category read/write route. Finance
   Manager and Super Admin retain the existing grant; all other roles are denied by the
   normal server-side permission guard. Category mutations are audited atomically.
7. New-voucher creation accepts active category IDs only. Historical reads, reports, and
   reversal vouchers may still use an inactive category so deactivation can never make a
   financial record unreadable or irreversible.

The approved initial names are:

1. Books & Stationary
2. Eidi (Eid ul Adha)
3. Eidi (Eid ul Fitr)
4. Electricity Bill
5. Fee
6. Food
7. Fuel Charges
8. Function Expense
9. Gas Bill
10. House Hold Items
11. Internet
12. Medicine
13. Miscellaneous
14. Pocket Money
15. Postage & Courier
16. Printing & Copy
17. Printing & Publishing
18. Repair & Maintenance: Building
19. Repair & Maintenance: Others
20. Repair & Maintenance: Vehicle
21. Salary
22. Telephone Bill
23. Travelling Expense
24. Zoo

`Printing & Copy` and `Printing & Publishing` are intentionally distinct categories.
The stakeholder-provided spellings `Books & Stationary`, `House Hold Items`, and
`Travelling Expense` are preserved exactly.

## Consequences

- Prisma and the shared contracts no longer expose an `ExpenseCategory` string union;
  writes and filters use category UUIDs and reads include current category metadata.
- Expense selectors, register filters, reports, exports, and category chips become data-
  driven. RPT-04 can no longer assume exactly three rows or render three hard-coded trend
  lines.
- A database trigger replaces `ck_other_requires_explanation`, because a PostgreSQL CHECK
  constraint cannot look up `requires_explanation` in another table.
- Active-state validation stays in the application service rather than the trigger. This
  is deliberate: reversal vouchers copy the original lines and must remain possible after
  a category has been deactivated.
- The migration takes an `ACCESS EXCLUSIVE` lock while replacing the line column and enum.
  Production deployment therefore requires a short coordinated maintenance window (or a
  later expand/contract rewrite if zero downtime becomes mandatory). It must be rehearsed
  against a production-structure clone before `prisma migrate deploy` is run on Neon.
- The already-applied Phase 3 migration remains immutable. All changes are expressed in a
  new forward migration.
