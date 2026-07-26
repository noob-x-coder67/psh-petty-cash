# PSH Petty Cash — Repository Rules

You are working on the Pakistan Sweet Home – AFP Petty Cash Management and Monitoring System.

**Before implementing anything, read `docs/MASTER_SRS.md` (the binding baseline) and `docs/TECHNICAL_BUILD_PLAN.md` (the engineering plan).** Requirement IDs (BR-xxx, FR-xxx, AC-xxx, NFR-xxx) are binding. Narrative design language explains intent but never overrides an explicit requirement.

---

## Non-negotiable business rules

1. **PSH-ISB may never own a petty-cash account.** Enforced by database constraint, API guard, seed data and acceptance test. Never weaken any of these layers. (BR-016, R-11)
2. **No pre-spend approval.** There is no approval workflow, no status machine, no `approve` endpoint, no pending state. Saving the entry is sufficient. (BR-001, FR-EXP-008)
3. **Categories are exactly `BUILDING`, `VEHICLE`, `OTHER`.** Never invent a fourth, never add subcategories, never add free-text account heads. (BR-006, Appendix C)
4. **`OTHER` requires a non-empty explanation.** (BR-007)
5. **Line-item total must equal the bill total** before a voucher can save. (BR-005)
6. **Negative balance is allowed.** Never block a save because the balance goes negative. It is a highlighted, reportable condition — not a validation error. (BR-011)
7. **Only Finance Manager and Super Admin may edit saved financial entries**, always with a mandatory reason and a full before/after audit record. (BR-009, BR-010)
8. **Never mark a save successful before the server commits.** No optimistic UI on financial mutations, no offline write queue. The system is online-only. (BR-012, NFR-008)
9. **No hard deletion of financial or audit records.** Corrections use compensating ledger entries; vouchers use auditable reversal. (BR-020, FR-AUD-006)
10. **`Checked` means Finance viewed the receipt. It is not approval and never changes a balance.** (BR-008, FR-CHK-004/005)
11. **Bill files are deleted only after archive confirmation plus the grace period**, and voucher metadata always survives. (BR-014, BR-015)
12. **Three-month rule:** a fourth-month replenishment is held when any of the preceding three monthly closings is incomplete, unless a Finance Manager records an audited exception. (BR-013)

## Non-negotiable technical rules

13. **No permanent sidebar** on desktop or mobile. Navigation is masthead + horizontal workspace tabs + command palette; mobile uses a bottom dock. (AC-018)
14. **Money is `NUMERIC(14,2)` / `Decimal` everywhere.** Never float, never `parseFloat`, never `toFixed()` for display — use the shared `<Money />` and Decimal helpers.
15. **Timestamps are stored in UTC; accounting periods are computed in `Asia/Karachi`** from `expense_date` (a DATE). Never derive a period from a UTC timestamp.
16. **Audit rows are written inside the same transaction as the change they describe.**
17. **The cash ledger is append-only.** `UPDATE`/`DELETE` are revoked for the application role. Fix mistakes with compensating entries.
18. **Storage goes through the `AttachmentStorage` interface only.** Never reference a driver by name outside `apps/api/src/storage/**`. Demo = Postgres bytea; production = private VPS filesystem.
19. **Never trust client-supplied role or unit scope.** Roles and unit access are loaded server-side per request.
20. **Approved libraries only** (SRS §13.1): Motion for React (primary animation), Lucide (icons), shadcn/ui (restyled, never default template look), Tailwind, TanStack Table/Query, React Hook Form + Zod, Recharts. Do not introduce an alternative without an ADR.
21. **Shared shapes live in `packages/contracts`.** `apps/web` never imports from `apps/api`. `packages/ui` is network-unaware.
22. **Respect `prefers-reduced-motion`** — every animation goes through the shared reduced-motion helper. (AC-019, NFR-014)

---

## Working method

- Work in **small, verifiable increments**. One vertical slice per task: API + migration + UI + tests together.
- **Run `pnpm lint`, `pnpm typecheck` and the relevant tests after every task.** Do not report a task complete until they pass.
- **Never delete or skip a test to make a build pass.** If a test is wrong, explain why and ask.
- **Show me generated migration SQL before it is applied.** Never auto-apply a migration.
- Write tests for **every finance formula and every permission path**. Pure logic lives in `*.posting.ts` / `*.rules.ts` and must reach full branch coverage.
- After each task, list the files you changed and any remaining risks.
- **Ask before changing a confirmed business rule.** If a requirement seems wrong or contradictory, stop and raise it — do not work around it silently.
- Record meaningful deviations as an ADR in `docs/decisions/`.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm dev              # web + api
pnpm lint
pnpm typecheck
pnpm test             # unit
pnpm test:int         # integration (requires local Postgres)
pnpm test:e2e         # Playwright
pnpm db:migrate       # review SQL first
pnpm db:seed
pnpm build
```

## Definition of done

Requirement implemented · acceptance criteria met · lint + typecheck + tests pass · permission test added · audit behaviour verified · responsive and keyboard behaviour verified · no sidebar regression · docs/migrations updated.
