# PSH Petty Cash — Technical Build Plan v1.0

**Derived from:** Master SRS v4.0 (25 July 2026)
**Status:** Engineering baseline — implements SRS §14, §15, §16, §23; does not alter any confirmed business rule (BR-001…BR-020).
**Rule of precedence:** Where this document is silent, the Master SRS governs. Where this document conflicts with the SRS on a *business* rule, the SRS wins and this document is defective and must be corrected.

---

## 0. Binding constraints this plan is built around

These five constraints shape almost every decision below. They are restated here because they are the ones most likely to be violated by an unexamined default choice.

| Constraint | Source | Architectural consequence |
|---|---|---|
| PSH-ISB may never own a petty-cash account | BR-016, FR-ORG-003, R-11 | Enforced in the **database**, not just the API. Composite foreign key + CHECK + seed guard + acceptance test. |
| Negative balance is allowed | BR-011, FR-CASH-007 | No balance guard in the write path. Sign is a *reporting and alerting* concern, never a validation failure. |
| No pre-spend approval, no status machine | BR-001, BR-008, FR-EXP-008 | Voucher has no `status` enum beyond `ACTIVE`/`REVERSED`. `checked` is a separate nullable marker pair, not a state. |
| Only Finance Manager / Super Admin may edit saved entries, always audited | BR-009, BR-010 | Privileged mutation path is a distinct controller + interceptor. Reason string is a required DTO field, not optional metadata. |
| Online-only; never confirm before commit | BR-012, FR-EXP-009, NFR-008 | No optimistic UI on financial writes. No service worker write queue. TanStack Query mutations use `onSuccess` only after 2xx. |

---

## 1. Repository architecture

### 1.1 Toolchain

| Concern | Choice | Note |
|---|---|---|
| Package manager | pnpm 10 (workspaces) | Lockfile committed; CI installs with `--frozen-lockfile`. |
| Task orchestration | Turborepo | Remote cache optional; local cache mandatory for CI speed. |
| Language | TypeScript 6.0, `strict: true` | `noUncheckedIndexedAccess` on. No `any` in finance code paths. |
| Node | 24 LTS | Pinned via `.nvmrc` and `engines`. |
| Web | Next.js 16 App Router, React 19.2 | Server Components for read-heavy shells; Client Components for forms/tables. |
| API | NestJS 11 | Modular REST + OpenAPI. |
| DB access | Prisma ORM → PostgreSQL 18 | Raw SQL permitted in migrations for constraints Prisma cannot express. |

### 1.2 Tree

```
psh-petty-cash/
├── apps/
│   ├── web/                          # Next.js 16
│   │   ├── src/
│   │   │   ├── app/                  # route map — see §4
│   │   │   ├── features/             # feature-sliced UI (expenses, cash-flow, reports…)
│   │   │   │   └── expenses/
│   │   │   │       ├── components/
│   │   │   │       ├── hooks/        # TanStack Query hooks
│   │   │   │       └── schemas.ts    # re-exports @psh/contracts zod
│   │   │   ├── lib/
│   │   │   │   ├── api-client.ts     # typed fetch wrapper, request-id, error envelope
│   │   │   │   ├── money.ts          # PKR formatting, tabular figures
│   │   │   │   ├── period.ts         # Asia/Karachi month boundaries
│   │   │   │   └── motion.ts         # shared variants + reduced-motion guard
│   │   │   └── styles/
│   │   ├── e2e/                      # Playwright
│   │   └── next.config.ts            # /api/* rewrite → NestJS (first-party cookies, §6.2)
│   │
│   └── api/                          # NestJS 11
│       ├── src/
│       │   ├── modules/              # one folder per module — see §3
│       │   │   └── expenses/
│       │   │       ├── expenses.controller.ts
│       │   │       ├── expenses.service.ts        # orchestration only
│       │   │       ├── expenses.posting.ts        # pure ledger/total logic — unit tested
│       │   │       ├── expenses.repository.ts     # Prisma access
│       │   │       └── dto/
│       │   ├── common/
│       │   │   ├── guards/           # JwtAuthGuard, RolesGuard, UnitScopeGuard
│       │   │   ├── interceptors/     # AuditInterceptor, RequestIdInterceptor
│       │   │   ├── filters/          # AllExceptionsFilter → error envelope
│       │   │   ├── decorators/       # @Roles, @RequiresUnitScope, @Audited
│       │   │   └── money/            # Decimal helpers, never float
│       │   ├── storage/              # AttachmentStorage adapter (SRS §20.3)
│       │   │   ├── storage.interface.ts
│       │   │   ├── postgres-bytea.driver.ts       # demo
│       │   │   └── filesystem.driver.ts           # production VPS
│       │   └── main.ts
│       └── test/                     # integration (real Postgres via testcontainers or CI service)
│
├── packages/
│   ├── contracts/                    # SINGLE SOURCE OF TRUTH for shapes
│   │   ├── src/schemas/              # Zod: voucher, line, allocation, filters, report params
│   │   ├── src/enums/                # ExpenseCategory, Role, LedgerEntryType, AuditAction
│   │   └── src/errors.ts             # error codes shared by API and web
│   ├── ui/                           # PSH design system ("Aurora Ledger")
│   │   ├── src/tokens/               # colors, spacing, radius, elevation, motion durations
│   │   ├── src/primitives/           # shadcn/ui components restyled — NOT default template
│   │   ├── src/finance/              # Money, BalanceDelta, CategoryChip, CheckedMarker,
│   │   │                             #   ComplianceRibbon, VarianceCell, UnitPulseCard
│   │   └── .storybook/
│   ├── config/                       # eslint, tsconfig bases, tailwind preset, prettier
│   └── testing/                      # fixtures, factories, seeded scenarios, test matchers
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/                   # hand-edited SQL where constraints require it
│   └── seed.ts                       # units incl. PSH-ISB with petty_cash_enabled = false
│
├── docs/
│   ├── MASTER_SRS.md                 # verbatim v4.0 — the binding baseline
│   ├── TECHNICAL_BUILD_PLAN.md       # this document
│   ├── architecture/                 # diagrams, storage adapter, balance model
│   ├── decisions/                    # ADR-0001…  (one per meaningful deviation)
│   ├── runbooks/                     # backup/restore, month-close ops, incident
│   └── uat/                          # scripts, evidence, sign-off scans
│
├── scripts/                          # seed-demo, migrate-bytea-to-disk, rebuild-balances
├── .github/workflows/ci.yml
├── CLAUDE.md                         # non-negotiable rules (SRS §24.2) — verbatim
├── turbo.json
└── pnpm-workspace.yaml
```

### 1.3 Dependency boundaries (enforced, not advisory)

Add `eslint-plugin-boundaries` (or `dependency-cruiser`) to CI with these rules:

- `apps/web` **may not** import from `apps/api`. Shared shapes travel through `@psh/contracts` only.
- `apps/api` **may not** import from `packages/ui`.
- `packages/ui` **may not** import TanStack Query, the API client, or anything network-aware. It receives data as props; this keeps Storybook honest.
- `packages/contracts` has **zero** runtime dependencies except `zod`.
- Nothing outside `apps/api/src/modules/*/repository.ts` and `prisma/` may import `PrismaClient`.
- Nothing outside `apps/api/src/storage/**` may reference a storage driver by name — callers depend on the interface.

The last two rules are what make the VPS migration a configuration change instead of a rewrite (SRS §20.1).

### 1.4 Branching and commits

- `main` protected; all work via short-lived branches `feat/`, `fix/`, `chore/`.
- Migrations reviewed by a human before merge — never auto-applied from a branch (R-08).
- One vertical slice per PR where possible: API + migration + UI + tests together.
- ADR required for: any new table, any change to the balance formula, any deviation from an approved library in SRS §13.1.

---

## 2. Database schema plan

### 2.1 Ground rules

| Rule | Implementation |
|---|---|
| Money is never floating point | `NUMERIC(14,2)` everywhere; Prisma `Decimal`; `decimal.js` in JS. Lint rule bans `parseFloat` on amount fields. |
| Timestamps stored UTC | `TIMESTAMPTZ`. Display converted to `Asia/Karachi` at the edge. |
| **Accounting periods computed in Asia/Karachi** | A voucher entered 2026-08-01 02:00 PKT is 2025-07-31 21:00 UTC. Period assignment must use PKT or month totals will be wrong at boundaries. Store a generated `period_year`/`period_month` derived from `expense_date` (a DATE, not a timestamp) to sidestep this entirely. |
| Ledger is append-only | `REVOKE UPDATE, DELETE` from the application role + trigger raising an exception. Corrections post compensating entries. |
| No hard deletion of financial or audit rows | Reversal/deactivation only (BR-020, FR-AUD-006). |
| Surrogate keys | `UUID v7` (time-ordered — index locality without exposing counts). |

### 2.2 Enums

```sql
CREATE TYPE unit_type          AS ENUM ('HEAD_OFFICE','CENTER','PROJECT','PROJECT_LOCATION','SERVICE');
CREATE TYPE expense_category   AS ENUM ('BUILDING','VEHICLE','OTHER');           -- BR-006, exactly three
CREATE TYPE ledger_entry_type  AS ENUM ('OPENING','ALLOCATION','REPLENISHMENT','EXPENSE',
                                        'CASH_RETURN','ADJUSTMENT_POSITIVE','ADJUSTMENT_NEGATIVE',
                                        'REVERSAL');
CREATE TYPE voucher_state      AS ENUM ('ACTIVE','REVERSED');                    -- NOT an approval workflow
CREATE TYPE closing_state      AS ENUM ('DRAFT','COUNTED','CLOSED','REOPENED');
CREATE TYPE role_key           AS ENUM ('SUPER_ADMIN','FINANCE_MANAGER','FINANCE_OFFICER',
                                        'UNIT_USER','UNIT_INCHARGE','AUDITOR','SUPPORT');
CREATE TYPE storage_driver     AS ENUM ('POSTGRES_BYTEA','FILESYSTEM');
```

`expense_category` deliberately has no `subcategory` table. Appendix C forbids hidden subcategories in release 1; adding the table "just in case" invites drift.

### 2.3 Tables

#### Organization and identity

**`organizational_units`**
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `code` | text UNIQUE NOT NULL | e.g. `PSH-ISB`, `PSH-SOH`, `FTZ-RAJA` |
| `name` | text NOT NULL | |
| `type` | unit_type NOT NULL | |
| `city` | text | |
| `parent_id` | uuid FK → self | hierarchy per SRS §4.3 |
| `petty_cash_enabled` | boolean NOT NULL DEFAULT false | **false by default** — enabling is an explicit Finance act (SRS §4.4) |
| `is_active` | boolean NOT NULL DEFAULT true | inactive blocks new transactions, retains history (FR-ORG-006) |
| `created_at / updated_at` | timestamptz | |

Constraints:
```sql
ALTER TABLE organizational_units ADD CONSTRAINT uq_unit_id_pce UNIQUE (id, petty_cash_enabled);
ALTER TABLE organizational_units ADD CONSTRAINT ck_psh_isb_never_enabled
  CHECK (code <> 'PSH-ISB' OR petty_cash_enabled = false);          -- R-11, BR-016
```

**`users`** — `id`, `email` UNIQUE (citext), `username` UNIQUE, `password_hash` (Argon2id), `full_name`, `is_active`, `must_change_password`, `failed_login_count`, `locked_until`, `last_login_at`, `totp_secret_enc` (nullable, FR-AUTH-007), timestamps.

**`roles`** (`id`, `key` role_key UNIQUE, `name`) and **`permissions`** (`id`, `key` text UNIQUE, e.g. `expense.edit_saved`, `month.close`, `compliance.override`), joined by **`role_permissions`**. Appendix A is seeded as data, not hardcoded in guards — so a permission change is a migration, not a redeploy.

**`user_roles`** (`user_id`, `role_id`) and **`user_unit_access`** (`user_id`, `unit_id`, `granted_by`, `granted_at`, PK on the pair). Finance/Super Admin scope is derived from role, not enumerated rows.

#### Cash

**`petty_cash_accounts`**
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `unit_id` | uuid NOT NULL UNIQUE | one account per unit |
| `unit_petty_cash_enabled` | boolean NOT NULL GENERATED ALWAYS AS (true) STORED | see below |
| `approved_float` | numeric(14,2) NOT NULL DEFAULT 0 | |
| `low_balance_threshold` | numeric(14,2) | FR-CASH-010 |
| `cached_balance` | numeric(14,2) NOT NULL DEFAULT 0 | derived cache, not truth |
| `cached_balance_at` | timestamptz | |
| `is_active` | boolean NOT NULL DEFAULT true | |

The exclusion is enforced structurally:
```sql
ALTER TABLE petty_cash_accounts
  ADD CONSTRAINT fk_account_requires_enabled_unit
  FOREIGN KEY (unit_id, unit_petty_cash_enabled)
  REFERENCES organizational_units (id, petty_cash_enabled);
```
Because the local column is generated as constant `true`, the row can only reference a unit whose `petty_cash_enabled` is `true`. Disabling a unit that has an account fails at the database level, and PSH-ISB can never be enabled because of `ck_psh_isb_never_enabled`. Three independent layers — CHECK, FK, and the API guard — all have to be defeated for R-11 to occur. Prisma cannot express this; write it in the migration SQL.

**`cash_ledger_entries`** — the balance source of truth (FR-CASH-004).
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid NOT NULL FK | |
| `entry_type` | ledger_entry_type NOT NULL | |
| `direction` | smallint NOT NULL | `+1` in, `-1` out; CHECK `direction IN (-1,1)` |
| `amount` | numeric(14,2) NOT NULL | CHECK `amount > 0` — sign lives in `direction` |
| `signed_amount` | numeric(14,2) GENERATED ALWAYS AS (amount * direction) STORED | sum this for balance |
| `effective_date` | date NOT NULL | drives period assignment |
| `period_year` / `period_month` | smallint GENERATED from `effective_date` | indexed |
| `source_table` / `source_id` | text / uuid | polymorphic link to voucher, allocation, replenishment |
| `reverses_entry_id` | uuid FK → self | compensating entries |
| `balance_after` | numeric(14,2) NOT NULL | snapshot at post time; enables negative-duration reporting (RPT-07) |
| `created_by` / `created_at` | uuid / timestamptz | |

```sql
CREATE INDEX ix_ledger_account_date ON cash_ledger_entries (account_id, effective_date DESC, id DESC);
CREATE INDEX ix_ledger_period       ON cash_ledger_entries (account_id, period_year, period_month);
CREATE RULE ledger_no_update AS ON UPDATE TO cash_ledger_entries DO INSTEAD NOTHING;  -- plus REVOKE
```

**`cash_allocations`** — `id`, `account_id`, `amount`, `issue_date`, `reference_no`, `payment_mode`, `remarks`, `issued_by`, `confirmed_amount`, `confirmed_date`, `confirmed_by`, `confirmed_at`, `idempotency_key` UNIQUE. Ledger entry is posted **only on confirmation** (FR-CASH-003, workflow §8.1 step 5–6) — this is the detail most likely to be implemented wrongly.

**`replenishments`** — same shape plus `compliance_result` (`ELIGIBLE`/`HELD`), `held_reason`, `exception_by`, `exception_reason`, `exception_at`, and `UNIQUE(account_id, reference_no)` (FR-REP-006).

#### Expenses

**`expense_vouchers`**
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `voucher_no` | text UNIQUE NOT NULL | `PSH-SOH-2026-000123`, generated in-transaction (§2.5) |
| `account_id` | uuid NOT NULL FK | |
| `expense_date` | date NOT NULL | |
| `bill_date` | date | |
| `vendor_name` | text NOT NULL | |
| `vendor_bill_no` | text | |
| `justification` | text NOT NULL | CHECK `length(btrim(justification)) >= 10` (BR-002) |
| `bill_total` | numeric(14,2) NOT NULL | CHECK `> 0` |
| `lines_total` | numeric(14,2) NOT NULL | maintained by trigger; CHECK `lines_total = bill_total` DEFERRABLE |
| `state` | voucher_state NOT NULL DEFAULT 'ACTIVE' | |
| `has_bill` | boolean NOT NULL DEFAULT false | |
| `missing_bill_reason` | text | CHECK `has_bill OR missing_bill_reason IS NOT NULL` (FR-DOC-007) |
| `checked_by` / `checked_at` | uuid / timestamptz | CHECK `(checked_by IS NULL) = (checked_at IS NULL)` |
| `is_backdated` | boolean | set at insert vs. configured threshold (FR-EXP-013) |
| `balance_after` | numeric(14,2) | copy of posting-time balance for fast negative reporting |
| `entered_by` / `entered_at` | uuid / timestamptz NOT NULL | |
| `reversed_by_voucher_id` | uuid FK → self | |
| `period_year` / `period_month` | generated from `expense_date` | |

The total-equality rule (BR-005) is enforced twice: in the service transaction *and* by a `DEFERRABLE INITIALLY DEFERRED` check backed by a row-level trigger that recomputes `lines_total` on any line insert/update. Application-only enforcement fails the moment a script or a future endpoint writes lines directly.

**`expense_lines`** — `id`, `voucher_id` FK ON DELETE RESTRICT, `line_no`, `description` NOT NULL, `category` expense_category NOT NULL, `amount` numeric(14,2) CHECK `> 0`, `other_explanation` text.
```sql
ALTER TABLE expense_lines ADD CONSTRAINT ck_other_requires_explanation
  CHECK (category <> 'OTHER' OR length(btrim(coalesce(other_explanation,''))) >= 5);  -- BR-007
```

**`attachments`** — `id`, `voucher_id`, `driver` storage_driver, `storage_key` (path, production), `bytes` bytea (demo only, NULL in production), `file_name`, `mime_type`, `size_bytes`, `sha256` (dedupe + integrity, FR-DOC-006), `page_no`, `uploaded_by`, `uploaded_at`, `deleted_at`, `deleted_by`, `archive_id`. Row survives deletion of bytes (FR-DOC-018/FR-EXP-018) — `deleted_at` set, `bytes`/file removed.

**`receipt_check_events`** — `id`, `voucher_id`, `action` (`CHECKED`/`UNCHECKED`), `actor_id`, `acted_at`, `reason` (required when `UNCHECKED`, FR-DOC-010). The voucher columns are the current marker; this table is the history.

#### Close and compliance

**`monthly_closings`** — `id`, `account_id`, `period_year`, `period_month`, `opening_balance`, `total_allocations`, `total_expenses`, `total_adjustments`, `expected_closing`, `physical_count`, `variance` GENERATED `physical_count - expected_closing`, `variance_remarks` (CHECK: required when `variance <> 0`), `counted_by`, `counted_at`, `confirmed_by`, `state` closing_state, `closed_by`, `closed_at`, `reopened_by`, `reopen_reason`, `closing_remarks`. `UNIQUE(account_id, period_year, period_month)`.

**`three_month_compliance`** — cached projection: `account_id`, `target_year`, `target_month`, `is_eligible`, `missing_periods` jsonb, `computed_at`. Refreshed on close/reopen and on demand; the service can always recompute from `monthly_closings` so a stale cache is a performance bug, never a correctness one.

#### Cross-cutting

**`audit_logs`** — `id`, `actor_id`, `actor_role`, `action` text, `entity_type`, `entity_id`, `unit_id`, `occurred_at`, `ip`, `user_agent`, `request_id`, `reason`, `before` jsonb, `after` jsonb, `diff` jsonb. Written by the same transaction as the change it describes (§3.4).
```sql
REVOKE UPDATE, DELETE ON audit_logs FROM psh_app;   -- FR-AUD-003
CREATE INDEX ix_audit_entity ON audit_logs (entity_type, entity_id, occurred_at DESC);
CREATE INDEX ix_audit_actor  ON audit_logs (actor_id, occurred_at DESC);
```

**`report_exports`** — `id`, `report_key`, `filters` jsonb, `format`, `row_count`, `generated_by`, `generated_at`, `file_ref`, `downloaded_at`. Satisfies RPT-13 and the "sensitive export" audit group (§16.2).

**`monthly_archives`** — `id`, `scope` (unit or consolidated), `account_id`, `period_year`, `period_month`, `file_count`, `total_bytes`, `generated_by/at`, `downloaded_at`, `confirmed_by`, `confirmed_at`, `deletion_eligible_at` (= `confirmed_at + ARCHIVE_GRACE_DAYS`), `deletion_executed_at`, `deleted_by`. This table is what makes BR-014 auditable rather than aspirational.

**`system_settings`** — key/value jsonb with `updated_by`/`updated_at`, audited. Holds retention days, grace days, upload limits, backdate threshold, low-balance defaults.

**`voucher_counters`** — `account_id`, `year`, `last_seq`. Locked with `SELECT … FOR UPDATE` inside the voucher transaction.

### 2.4 Indexing for NFR-003 (100k rows, p95 ≤ 2s first page)

```sql
CREATE INDEX ix_voucher_register ON expense_vouchers (account_id, expense_date DESC, id DESC)
  WHERE state = 'ACTIVE';
CREATE INDEX ix_voucher_unchecked ON expense_vouchers (account_id, expense_date DESC)
  WHERE checked_at IS NULL AND state = 'ACTIVE';        -- receipt queue, RPT-06
CREATE INDEX ix_voucher_negative ON expense_vouchers (account_id, expense_date)
  WHERE balance_after < 0;                              -- RPT-07
CREATE INDEX ix_voucher_vendor_trgm ON expense_vouchers USING gin (vendor_name gin_trgm_ops);
CREATE INDEX ix_voucher_search ON expense_vouchers USING gin
  (to_tsvector('simple', voucher_no || ' ' || vendor_name || ' ' || justification));
CREATE INDEX ix_lines_category ON expense_lines (category, voucher_id);
```
Use **keyset pagination** (`(expense_date, id) < (:cursor_date, :cursor_id)`) for the register, not `OFFSET`. At page 400 of an audit review, `OFFSET` degrades badly and the partial indexes above stop being useful.

### 2.5 Voucher posting transaction (the one path that must be exactly right)

```
BEGIN;
  SELECT … FROM petty_cash_accounts WHERE id = :account FOR UPDATE;   -- serialize per account
  -- guard: account active, unit active, user has scope, period not CLOSED
  UPDATE voucher_counters SET last_seq = last_seq + 1 … RETURNING last_seq;
  INSERT INTO expense_vouchers (…);
  INSERT INTO expense_lines (…) ×n;                                   -- trigger maintains lines_total
  SET CONSTRAINTS ck_voucher_totals IMMEDIATE;                        -- fail here if BR-005 violated
  INSERT INTO cash_ledger_entries (type EXPENSE, direction -1, balance_after = new_balance);
  UPDATE petty_cash_accounts SET cached_balance = new_balance, cached_balance_at = now();
  INSERT INTO audit_logs (action 'EXPENSE_CREATE', after = voucher_snapshot);
COMMIT;
```
Row-locking the account is what makes concurrent entries from two users at the same unit produce a correct `balance_after` chain. Response is returned only after commit (NFR-008). Negative resulting balance is posted normally — the API returns `balanceWarning: true` in the payload and the UI shows it; it is not an error.

`scripts/rebuild-balances.ts` recomputes every `cached_balance` and `balance_after` from the ledger and reports drift. Run it nightly in production and as a CI integration assertion.

---

## 3. API modules

### 3.1 Module map

| Module | Owns | Key endpoints | Primary FR trace |
|---|---|---|---|
| `AuthModule` | Login, refresh, logout, lockout, TOTP | `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `GET /me` | FR-AUTH-001…008 |
| `UsersModule` | User CRUD, activation, password reset | `/admin/users*` | FR-AUTH-006 |
| `RolesModule` | Roles, permissions, unit access grants | `/admin/roles*`, `/admin/users/:id/units` | §6.1, App. A |
| `OrganizationModule` | Units, hierarchy, `petty_cash_enabled` | `GET /units`, `POST /admin/units`, `PATCH /admin/units/:id` | FR-ORG-001…007 |
| `PettyCashAccountsModule` | Account creation/config, balance read | `POST /accounts/:unitId`, `GET /accounts/:id` | FR-CASH-001, 008, 010 |
| `AllocationsModule` | Allocation record + receipt confirmation | `POST /allocations`, `POST /allocations/:id/confirm` | FR-CASH-002, 003, 009 |
| `ExpensesModule` | Voucher lifecycle, lines, privileged edit, reversal | `POST/GET/PATCH /expenses`, `POST /expenses/:id/reverse` | FR-EXP-001…018 |
| `AttachmentsModule` | Upload, stream, download, retention delete | `POST /expenses/:id/attachments`, `GET /attachments/:id/{view,download}` | FR-DOC-001…006, 012 |
| `ReceiptChecksModule` | Checked / Unchecked marker + history | `POST /expenses/:id/check`, `/uncheck`, `POST /expenses/bulk-check` | FR-CHK-001…007 |
| `ReplenishmentsModule` | Replenishment + three-month gate + exception | `POST /replenishments`, `GET /compliance/:unitId` | FR-REP-001…007 |
| `MonthlyCloseModule` | Cash count, variance, close, reopen | `POST /monthly-close`, `/:id/close`, `/:id/reopen` | FR-CLS-001…009 |
| `ReportsModule` | 16 report datasets + filter engine | `GET /reports/:reportKey`, `POST /exports` | RPT-01…16 |
| `ArchivesModule` | Monthly ZIP, download confirm, eligible deletion | `POST /archives/monthly`, `/:id/confirm`, `DELETE /attachments/eligible` | FR-DOC-011…013 |
| `AuditModule` | Audit search + export | `GET /audit`, `POST /audit/export` | FR-AUD-004, 005 |
| `SettingsModule` | Thresholds, retention, limits | `GET/PATCH /admin/settings` | FR-AUD-007 |
| `DashboardModule` | Finance command centre + unit dashboard aggregates | `GET /dashboard/finance`, `/dashboard/unit/:id` | §10.5 |
| `HealthModule` | Liveness, readiness, storage/disk check | `GET /health`, `/health/ready` | NFR-018 |

`DashboardModule` is added beyond the SRS §15.2 list because the two dashboard endpoints in §15.3 need an owner; it reads from other modules' repositories through their services and owns no tables.

### 3.2 Layering inside a module

`Controller` (HTTP, DTO validation, Swagger) → `Service` (orchestration, transaction boundary, authorization decisions that need data) → `Repository` (Prisma only). Pure finance logic — balance arithmetic, total equality, compliance windows, variance — lives in dependency-free `*.posting.ts` / `*.rules.ts` files so it can be unit-tested exhaustively without a database. Every one of these files must reach full branch coverage before its phase closes.

### 3.3 Authorization: three layers, none skippable

1. **`JwtAuthGuard`** — valid session, user active, not locked.
2. **`RolesGuard`** — `@Roles('FINANCE_MANAGER','SUPER_ADMIN')` resolved against seeded `role_permissions`, not string literals scattered in controllers.
3. **`UnitScopeGuard`** — `@RequiresUnitScope('body.unitId' | 'param.id' | 'derived')`. For unit-scoped roles it intersects the request's unit with `user_unit_access`; for Finance/Super Admin it passes all *petty-cash-enabled* units. Every list query additionally receives a `scopeFilter` from `AuthContext` that is applied in the repository — so even a controller that forgets a decorator cannot leak another unit's rows.

Client-supplied role or unit claims are never trusted (§15.4). The JWT carries `sub` and a session id only; roles and unit access are loaded server-side per request (cached 60s) so revocation takes effect quickly.

### 3.4 Audit interceptor

`@Audited({ action, entity, reasonRequired })` on a handler causes the interceptor to:
- reject the request if `reasonRequired` and `body.reason` is missing or under 10 characters,
- capture a `before` snapshot via the module's `snapshot(entityId)` method,
- run the handler **inside the same Prisma transaction** as the audit insert,
- compute a field-level `diff` and write `before`/`after`/`diff`/`actor`/`ip`/`request_id`.

The transaction sharing matters: an audit row written after commit can be lost independently of the change it describes, which breaks FR-AUD-002 and NFR-009. Use a `ClsService`-carried transaction handle.

### 3.5 API standards

- **Envelope:** `{ data, meta: { requestId, page }, error: null }` / `{ data: null, error: { code, message, details } }`. Codes come from `@psh/contracts/errors` so the web app can key UI messaging off `VOUCHER_TOTAL_MISMATCH`, `OTHER_EXPLANATION_REQUIRED`, `UNIT_NOT_PETTY_CASH_ENABLED`, `THREE_MONTH_HOLD`, `PERIOD_CLOSED`, `INSUFFICIENT_UNIT_SCOPE` rather than parsing prose.
- **Validation:** one Zod schema per operation in `@psh/contracts`, used by `nestjs-zod` on the server and React Hook Form on the client. A rule cannot drift between the two because there is only one copy.
- **Idempotency:** `Idempotency-Key` header required on `POST /allocations` and `POST /replenishments`; stored with the response hash for 24h (§15.4, FR-REP-006).
- **Pagination:** keyset by default (`cursor`, `limit` ≤ 200); offset only for report exports where total count is required.
- **Request tracing:** `x-request-id` generated at the edge, echoed in logs and audit rows.
- **OpenAPI:** generated at build; CI fails if the committed `openapi.json` differs from generated output — keeps §15.4's "kept current" requirement from decaying.

### 3.6 Endpoints not to build

No `POST /expenses/:id/approve`, no `status` transition endpoint, no `/workflows/*`. If one appears in a PR it is a BR-001 violation regardless of how it is labelled.

### 3.7 Serverless caveat for the demo

ZIP archive generation (`POST /archives/monthly`) and large PDF/Excel exports will exceed Vercel Hobby execution limits once a month holds real volume. For the demo phase: cap archive scope to one unit-month, stream the ZIP rather than buffering, and return `202` with a size-guard error above the limit. On the VPS these become a small in-process queue (BullMQ + Redis, or a Nest cron worker) writing to the report workspace directory in §19.2. Design the endpoint contract as *asynchronous-capable now* — `{ exportId, status }` with a poll endpoint — so the VPS move does not change the client.

---

## 4. UI route map

Next.js App Router. **No permanent sidebar anywhere** (BR/UI rule, AC-018): desktop uses masthead + horizontal workspace tabs + command palette; mobile uses a bottom dock and full-screen sheets.

### 4.1 Route tree

```
app/
├── (public)/
│   └── login/page.tsx                        § 12.1  animated identity, env badge
│
├── (workspace)/                              layout: Masthead + WorkspaceTabs + CommandPalette
│   ├── layout.tsx                            scope switcher, period switcher, alerts, user menu
│   │
│   ├── overview/page.tsx                     § 12.2 Finance Command Center  (finance/admin/auditor)
│   ├── my-unit/page.tsx                      § 12.3 Center Workspace        (unit user/in-charge)
│   │
│   ├── cash-flow/
│   │   ├── page.tsx                          § 12.7 allocation ledger + balance timeline
│   │   ├── allocations/new/page.tsx          finance only
│   │   ├── allocations/[id]/page.tsx         detail + confirm receipt
│   │   └── replenishments/
│   │       ├── page.tsx                      history + hold states
│   │       └── new/page.tsx                  three-month gate + exception dialog
│   │
│   ├── expenses/
│   │   ├── page.tsx                          § 12.6 register (TanStack Table, keyset, saved filters)
│   │   ├── new/page.tsx                      § 12.4 record expense
│   │   ├── [voucherNo]/page.tsx              § 12.5 detail: receipt viewer + audit timeline
│   │   ├── [voucherNo]/edit/page.tsx         privileged only; reason required
│   │   └── [voucherNo]/print/page.tsx        print-clean voucher, no chrome
│   │
│   ├── reports/
│   │   ├── page.tsx                          § 12.8 report gallery
│   │   ├── [reportKey]/page.tsx              filter composer + live preview + chart/table toggle
│   │   └── presets/page.tsx                  saved presets per user
│   │
│   ├── month-close/
│   │   ├── page.tsx                          unit-month grid + compliance ribbon
│   │   └── [accountId]/[period]/page.tsx     § 12.9 count, variance, remarks, close
│   │
│   ├── receipts/page.tsx                     receipt-control queue (unchecked-first)
│   ├── archives/page.tsx                     monthly ZIP, confirm download, deletion eligibility
│   │
│   └── admin/                                role-gated in layout + server-side
│       ├── users/page.tsx
│       ├── units/page.tsx                    petty-cash enablement; PSH-ISB read-only badge
│       ├── settings/page.tsx
│       └── audit/page.tsx                    § 12.10 audit viewer + export
│
└── @modal/(.)expenses/[voucherNo]/page.tsx   intercepted route: detail drawer over register
```

### 4.2 Scope handling

Unit scope is a **query parameter** (`?unit=PSH-SOH`), not a path segment. Finance users switch scope constantly across every workspace; a `/u/[unitCode]/...` prefix would duplicate the whole tree and break the shared-layout transition on unit switch (§13.3). The scope switcher writes the param, a `useUnitScope()` hook reads it, and server components pass it into the API client. Unit-scoped users have their single unit defaulted and the switcher hidden.

Period scope (`?period=2026-07`) behaves the same way and defaults to the current Asia/Karachi month.

### 4.3 Landing by role

| Role | Redirect from `/` |
|---|---|
| Super Admin, Finance Manager, Finance Officer, Auditor | `/overview` |
| Unit User, Unit In-Charge | `/my-unit` |

Route protection is enforced in a server-side `middleware.ts` (session presence) plus a per-segment server check (role/permission). Client-side hiding of tabs is cosmetic only.

### 4.4 Navigation surfaces

| Viewport | Primary nav | Secondary |
|---|---|---|
| ≥1280 | Masthead + full tab row | Command palette `⌘K`, contextual action rail on detail pages |
| 1024–1279 | Masthead + scrollable tabs | same |
| 768–1023 | Condensed masthead + tab rail | sheet-based filters |
| <768 | Title bar + bottom dock (Overview · Expenses · New · Reports · More) | full-screen command sheet |

The centre dock slot on mobile is the `New Expense` action — the single most frequent task for the users who are most often on phones (§12.11).

### 4.5 Data-fetching pattern

Read-heavy shells (dashboard cards, ledger summaries) render as Server Components with a short revalidate; anything interactive (register, forms, report preview) is a Client Component using TanStack Query. Mutations invalidate `['account', unitId, 'balance']`, `['expenses', unitId]`, and `['compliance', unitId]`. **No optimistic updates on financial mutations** — the balance only moves after the server responds (BR-012, FR-EXP-009).

### 4.6 UI rules that CI can check

- `packages/ui` exports no component named `Sidebar`; an ESLint `no-restricted-syntax` rule bans `position: fixed` elements with full-height left/right anchoring in `apps/web` (AC-018).
- Every animation variant imports the shared `reduced()` helper wrapping `useReducedMotion()` (AC-019, NFR-014); a lint rule flags direct `motion.*` transitions that bypass it.
- Amounts render only through `<Money />` from `packages/ui/finance` — never `toFixed()` in a component (guards the float ban and PKR/tabular-figure formatting).

---

## 5. Development phases

Phases follow SRS §23.1. Each has a hard exit gate — the next phase does not start until the gate passes, because every later phase depends on the finance primitives being correct. Durations assume one developer working with Claude Code; adjust for team size, keep the gates.

| Phase | Theme | Build | Exit gate | Est. |
|---|---|---|---|---|
| **0** | Foundation | pnpm/Turborepo, both apps booting, `@psh/contracts` + `@psh/config`, ESLint boundary rules, CI (lint/typecheck/test/build), `CLAUDE.md` verbatim from SRS §24.2, `docs/MASTER_SRS.md` committed, empty Prisma baseline | CI green on an empty PR; boundary rule proven by a deliberately failing import | 3–4 d |
| **1** | Identity & organization | Prisma schema for units/users/roles/permissions/access, PSH-ISB constraints (§2.3), Argon2id auth, session cookies, three guards, seed from Appendix E | **Integration test proves a petty-cash account cannot be created for PSH-ISB via API *or* direct SQL.** Unit user cannot read another unit's data. | 1 wk |
| **2** | Cash accounts & ledger | `petty_cash_accounts`, append-only `cash_ledger_entries`, allocations + confirmation, balance service, `rebuild-balances` script | Ledger `UPDATE`/`DELETE` rejected at DB level. Allocation posts to ledger **only on confirmation**. Rebuild script reports zero drift over a 500-entry fixture. | 1.5 wk |
| **3** | Expense core | Voucher + lines, category enum, Other explanation, total-equality (service + trigger), voucher numbering, posting transaction, negative balance, backdate flag, duplicate warning, privileged edit + reversal | Concurrent-write test: 20 parallel vouchers on one account yield a correct `balance_after` chain and no duplicate voucher numbers. Negative balance saves. Centre user gets 403 on edit. | 2 wk |
| **4** | Documents & checks | Storage adapter + both drivers, upload with magic-byte MIME sniffing, private streaming view/download, checksum, missing-bill reason, Checked/Unchecked + history, retention metadata | Unauthorized user gets 403 on `/attachments/:id/view` for another unit. Bytes deleted → voucher and metadata intact. Check does not move balance. | 1.5 wk |
| **5** | Modern UI | Design tokens, restyled shadcn primitives, masthead + tabs + command palette + mobile dock, Command Center, Center Workspace, Record Expense, Voucher Detail, Register, Storybook | No sidebar at any breakpoint. Reduced-motion pass. Axe clean on the five core screens. Record a voucher in ≤2 min (NFR-004) with a real user. | 2.5 wk |
| **6** | Reports Studio | Filter engine, RPT-01…16 datasets, chart/table preview, PDF + Excel + CSV export with header/filter summary/totals/page numbers, saved presets, `report_exports` audit | **Finance reviews and accepts at least RPT-01, 03, 04, 06, 09, 10 against a known dataset.** Report totals reconcile to the ledger exactly. | 2.5 wk |
| **7** | Month close & compliance | Monthly closing, expected/variance, remarks rules, close/reopen, three-month projection, replenishment hold + audited exception, compliance ribbon | Fourth-month replenishment blocked when any of three preceding months is not `CLOSED`; exception recorded with actor/reason/time; timeline renders correctly across a year boundary. | 1.5 wk |
| **8** | Audit & security | Audit viewer + export, `@Audited` on every mutating endpoint, rate limiting, lockout, security headers, DB role separation, dependency audit, permission test matrix | Every mutating endpoint appears in an audit-coverage test that asserts a row is written in the same transaction. OWASP checklist (§6) walked. | 1.5 wk |
| **9** | UAT demo | Vercel deploy (web + API), hosted Postgres, seeded demo units and roles, DEMO badge, multi-location session test, UAT scripts and evidence capture | ≥3 locations logged in simultaneously; SRS §21.2 scenario list executed and signed; issues triaged into fix/defer. | 1–2 wk |
| **10** | Production readiness | Docker Compose, Nginx/Caddy + Let's Encrypt, filesystem storage driver, bytea→disk migration script, `pg_dump` backups + **tested restore**, monitoring/alerts, runbooks, training material | Restore rehearsal from backup into a clean VM succeeds and balances match. Security review closed. Sign-off recorded (Appendix G/I). | 1.5 wk |

**Total ≈ 17–19 weeks** single-developer to production sign-off; roughly 11–12 weeks to a demonstrable UAT build (end of Phase 9).

### 5.1 Sequencing notes

- Phases 1–4 are strictly serial. Phase 5 can overlap Phase 4 by about a week once the voucher API contract is frozen — the UI can build against `@psh/contracts` with MSW mocks.
- Phase 6 depends on Phase 3 data existing in volume; seed 50k synthetic vouchers at the start of Phase 6 so NFR-002/003 are measured against realistic cardinality, not a demo dataset of forty rows.
- Phase 7 cannot start before Phase 2 and 3 are gate-passed, because compliance reads closing balances that read the ledger.
- Do not defer Phase 8's `@Audited` coverage to the end. Apply the decorator as each mutating endpoint is written in Phases 2–7; Phase 8 verifies and fills gaps.

### 5.2 Working method with Claude Code

Use the task template from SRS §24.3, one vertical slice per task, `CLAUDE.md` read first. Two additions worth enforcing (R-08):

- After each task, ask for a written list of changed files and remaining risks, and read the generated migration SQL before applying it. Generated migrations are where an accidental constraint drop hides.
- Keep a `docs/decisions/` ADR for anything that deviates from this plan. If a rule from §0 above is ever "worked around," that is a change request, not an implementation detail.

---

## 6. Security controls

### 6.1 Identity and session

| Control | Implementation | Trace |
|---|---|---|
| Password storage | Argon2id, `m=19456,t=2,p=1` minimum; per-user salt; rehash on parameter upgrade | §16.1, FR-AUTH-002 |
| Password policy | ≥12 chars, breach-list check on set, no forced rotation; `must_change_password` on admin reset | FR-AUTH-006 |
| Session | HTTP-only, `Secure`, `SameSite=Lax` cookie; 15-min access token + rotating refresh token bound to a server-side session row; absolute cap 12h, idle expiry configurable | FR-AUTH-004 |
| Refresh reuse detection | Rotated refresh tokens; reuse of a consumed token revokes the whole session family and writes an audit row | §16.1 |
| Brute force | Per-account exponential lockout after 5 failures (`locked_until`) + per-IP rate limit; every failure audited | FR-AUTH-005 |
| 2FA | TOTP for Head Office roles in production; enforced by role policy, secret encrypted at rest | FR-AUTH-007 |
| No public registration | No signup route exists in either app; users created only by Super Admin | FR-AUTH-008 |
| Impersonation | Demo only, banner-labelled, audited, disabled by `APP_ENV` in production | FR-ORG-008 |

### 6.2 First-party cookie architecture

Serve the API to browsers through a Next.js rewrite (`/api/* → NestJS`) so the session cookie is first-party. Cross-site cookies between two different Vercel domains require `SameSite=None`, which weakens CSRF posture and is fragile under browser privacy changes. With the rewrite, `SameSite=Lax` plus a double-submit CSRF token on state-changing requests is sufficient, and the same arrangement carries unchanged to the VPS behind Nginx.

### 6.3 Authorization

Three enforced layers (§3.3), plus a repository-level `scopeFilter` applied to every list query so unit isolation survives a forgotten decorator. Role→permission mapping is seeded data matching Appendix A; a permission test matrix in `packages/testing` asserts every (role × endpoint) pair against the expected allow/deny. That matrix is the artefact that keeps AC-002 and AC-011 true after refactors.

### 6.4 Attachment security

- Validate **magic bytes**, not just extension and client-supplied MIME (`file-type` sniffing) — an extension check alone accepts a renamed executable.
- Re-encode images server-side (sharp) to strip EXIF and embedded payloads; PDFs are size- and page-capped and served with `Content-Disposition: attachment` plus `X-Content-Type-Options: nosniff`.
- Never expose a public or predictable path (FR-DOC-005). Production files live outside the web root; access is streamed by an authenticated endpoint after a permission check on the owning voucher's unit.
- `sha256` stored for integrity and duplicate detection.
- Malware-scan hook (ClamAV) in the production storage driver; a no-op in demo, but the interface point exists from Phase 4 so adding it is not a redesign.
- Deletion removes bytes only; row, metadata, actor, time and archive reference persist (FR-DOC-013, BR-015).

### 6.5 Application and transport

| Control | Detail |
|---|---|
| TLS | HTTPS everywhere; Let's Encrypt on VPS; HSTS with preload after domain stabilises |
| Headers | CSP (no `unsafe-inline`; nonce-based), `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `nosniff`, restrictive `Permissions-Policy` |
| CSRF | Double-submit token on all non-GET requests |
| CORS | Explicit `CORS_ORIGINS` allowlist; credentials true; no wildcard |
| Input validation | Zod DTOs on every endpoint; unknown keys stripped |
| Injection | Prisma parameterised queries only; raw SQL requires `Prisma.sql` tagged templates and review |
| Rate limits | Global + stricter buckets on `/auth/login`, `/exports`, `/archives/monthly` |
| Errors | No stack traces or SQL to clients; correlated by `request_id` in server logs |
| Dependencies | `pnpm audit` + Dependabot in CI; critical advisories block merge (NFR-015) |

### 6.6 Database security

- Two roles: `psh_app` (DML on business tables; `INSERT`-only on `audit_logs` and `cash_ledger_entries`) and `psh_migrate` (DDL, used only by migrations).
- `REVOKE UPDATE, DELETE` on `audit_logs` and `cash_ledger_entries` from `psh_app` — immutability enforced by the engine, not by discipline.
- Production Postgres bound to localhost/private network; never a public port (§16.1).
- Secrets only in environment variables; `.env*` git-ignored; a `gitleaks` CI step blocks accidental commits.
- Daily `pg_dump`, retained 30 days, **plus a rehearsed restore** — an untested backup is not a control (R-09, NFR-016).

### 6.7 Demo-environment controls

No real financial data, redacted sample bills only, 2 MB attachment cap, 30-day byte retention, visible DEMO badge, separate secrets from production, and demo writes disabled at cutover (R-12, §18.3). Treat the demo database as compromised-by-default in threat modelling; nothing in it should matter if it leaks.

### 6.8 Audit as a security control

Every event group in §16.2 is covered, with `before`/`after` JSON, actor, reason, IP, request id, written transactionally. The audit viewer is searchable and exportable to Finance, Super Admin and Auditor only. `report_exports` records who extracted what, with which filters — the export log is often the first place an investigation looks.

---

## 7. Acceptance checklist

Two parts: the SRS §22 criteria expanded into verifiable tests, then engineering gates that must also hold. Each row needs recorded evidence (test id, screenshot, or UAT signature) before sign-off.

### 7.1 SRS acceptance criteria

| ✔ | ID | Criterion | Verification method |
|---|---|---|---|
| ☐ | AC-001 | Finance dashboard excludes PSH-ISB, shows every active petty-cash unit | E2E + DB assertion; attempt account creation for PSH-ISB via API **and** raw SQL — both rejected |
| ☐ | AC-002 | Centre user sees only assigned unit(s) | Permission matrix test across all list/detail endpoints; E2E with two unit users |
| ☐ | AC-003 | Voucher supports multiple line items with one bill | E2E: 5-line voucher, single attachment |
| ☐ | AC-004 | Only Building, Vehicle, Other selectable | DB enum test + UI test asserting exactly three options; API rejects a fourth value |
| ☐ | AC-005 | Other cannot save without explanation | Unit test (rule), integration test (CHECK constraint), E2E (form error) |
| ☐ | AC-006 | Line totals must equal bill total | Service test, deferred-constraint test, E2E showing save blocked on mismatch |
| ☐ | AC-007 | No pre-spend approval screen or status | Route inventory + OpenAPI review: no approve/status-transition endpoint or UI affordance exists |
| ☐ | AC-008 | New entry appears immediately and updates balance | E2E: save → register row present → balance changed by exact amount |
| ☐ | AC-009 | Negative balance allowed and clearly highlighted | E2E: overspend saves successfully; coral treatment + banner present; appears in RPT-07 |
| ☐ | AC-010 | Finance can mark receipt Checked; action auditable | E2E + audit row assertion; balance unchanged after check (FR-CHK-004) |
| ☐ | AC-011 | Only Finance Manager / Super Admin can edit saved entries | Permission matrix: 403 for unit user, in-charge, finance officer, auditor |
| ☐ | AC-012 | Edit audit shows before and after values | Integration test asserting `before`, `after`, `diff`, `reason`, actor, timestamp |
| ☐ | AC-013 | Reports support required filters and exports | Appendix D matrix test per report; PDF/Excel/CSV produced with header, filter summary, totals, page numbers |
| ☐ | AC-014 | Month close calculates variance | Unit test on formula; E2E with positive, zero and negative variance; remarks required when non-zero |
| ☐ | AC-015 | Three-month rule controls fourth-month eligibility | Integration tests: all three closed → eligible; any incomplete → held; audited exception unblocks; year-boundary case |
| ☐ | AC-016 | Files viewable/downloadable only by authorized users | 403 test for out-of-scope user; no public path; direct storage-key access fails |
| ☐ | AC-017 | Monthly archive and deletion workflow works | E2E: generate ZIP → confirm download → grace period → delete → metadata retained, audit row written |
| ☐ | AC-018 | No permanent sidebar on desktop or mobile | Visual review at 4 breakpoints + lint rule + Storybook snapshot |
| ☐ | AC-019 | Core motion respects reduced-motion | Playwright with `prefers-reduced-motion: reduce`: all flows completable, no nonessential animation |
| ☐ | AC-020 | Vercel demo accessible from multiple locations | UAT log of ≥3 locations logged in concurrently, with timestamps |

### 7.2 Engineering gates

| ✔ | Gate | Why |
|---|---|---|
| ☐ | Ledger `UPDATE`/`DELETE` rejected by the database for `psh_app` | BR-020 must not depend on application discipline |
| ☐ | `audit_logs` `UPDATE`/`DELETE` rejected for `psh_app` | FR-AUD-003 |
| ☐ | Audit row written in the **same transaction** as every mutation | FR-AUD-002; test asserts rollback removes both |
| ☐ | `rebuild-balances` reports zero drift on the full dataset | Cached balance is a cache, and caches must be provably reconcilable |
| ☐ | 20-way concurrent voucher posting produces a correct `balance_after` chain, no duplicate voucher numbers | Row-lock correctness |
| ☐ | All money columns `NUMERIC`; no float in any finance path | Lint rule + schema audit |
| ☐ | Period assignment correct at Asia/Karachi month boundaries | Test voucher at 2026-08-01 00:30 PKT lands in August |
| ☐ | Dashboard p95 ≤3s and filtered ledger first page p95 ≤2s at 100k vouchers | NFR-002/003, measured — not assumed |
| ☐ | Full branch coverage on `*.posting.ts` / `*.rules.ts` | Finance formulas |
| ☐ | Permission matrix test covers every (role × endpoint) pair | Prevents silent scope regressions |
| ☐ | Network failure never shows a success state | Playwright offline/500 test on save (BR-012) |
| ☐ | Committed `openapi.json` matches generated output | §15.4 |
| ☐ | WCAG 2.2 AA on core workflows (axe + keyboard + screen-reader pass) | NFR-005 |
| ☐ | Backup **restore** rehearsed into a clean VM; balances match | R-09; the backup itself is not the control |
| ☐ | `gitleaks` clean; no secrets in history | §16.1 |
| ☐ | Storage driver swap demo→production verified by migration script on a copy | §20.2 step 7 |
| ☐ | Appendix G release-readiness list complete and signed | Formal sign-off |

### 7.3 Sign-off

Development is not "done" at feature completion. Per Appendix I, closure requires: Finance acceptance of reports (Phase 6 gate), UAT evidence (Phase 9), restore rehearsal and security review (Phase 10), and recorded signatures. Any post-sign-off change to a confirmed business rule goes through a change request with impact assessment — not a commit.

---

## 8. Open questions for Finance / Administration

These are unresolved in v4.0 and will otherwise be decided by default by whoever writes the code first. Worth settling before Phase 2.

1. **Opening balances at go-live.** How is each unit's cash-in-hand on day one entered — a one-off `OPENING` ledger entry per unit, authorized by whom, and dated when?
2. **Safar-e-Akhrat operational location.** §4.2 marks it "configurable." Which unit does it report under for consolidated reporting, and does it close monthly like the others?
3. **Backdate threshold value.** FR-EXP-013 says configurable; the earlier finance form proposed 6 working days. Confirm the number that ships as the default.
4. **Cash returns.** The balance formula includes cash returns, but no workflow or endpoint is specified. Is a unit ever expected to return cash to Head Office, and if so who records it?
5. **Three-month rule edge case.** If a unit was created two months ago, is it eligible for a fourth-month deposit, or does the rule only apply once three closable months exist?
6. **Archive retention at Head Office.** §16.3 assigns responsibility for the downloaded archive but not a retention period or storage location standard.

---

*Prepared as an engineering companion to Master SRS v4.0. Business rules are restated here for traceability only; the SRS remains the authoritative baseline.*
