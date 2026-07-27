-- CreateEnum
CREATE TYPE "ledger_entry_type" AS ENUM ('OPENING', 'ALLOCATION', 'REPLENISHMENT', 'EXPENSE', 'CASH_RETURN', 'ADJUSTMENT_POSITIVE', 'ADJUSTMENT_NEGATIVE', 'REVERSAL');

-- CreateTable
CREATE TABLE "petty_cash_accounts" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "unit_id" UUID NOT NULL,
    "approved_float" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "low_balance_threshold" DECIMAL(14,2),
    "cached_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cached_balance_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "petty_cash_accounts_pkey" PRIMARY KEY ("id")
);

-- AddColumn (hand-added: GENERATED ALWAYS column, not expressible in Prisma's schema DSL)
-- This constant-true column plus the composite FK below is R-11/BR-016's third and
-- final structural defense layer — PSH-ISB can never own an account because
-- uq_unit_id_pce (Phase 1) has no row where petty_cash_enabled = true for it.
ALTER TABLE "petty_cash_accounts" ADD COLUMN "unit_petty_cash_enabled" BOOLEAN NOT NULL GENERATED ALWAYS AS (true) STORED;

-- CreateTable
CREATE TABLE "cash_ledger_entries" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "account_id" UUID NOT NULL,
    "entry_type" "ledger_entry_type" NOT NULL,
    "direction" SMALLINT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "effective_date" DATE NOT NULL,
    "source_table" TEXT,
    "source_id" UUID,
    "reverses_entry_id" UUID,
    "balance_after" DECIMAL(14,2) NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- AddColumn (hand-added: GENERATED ALWAYS columns, not expressible in Prisma's schema DSL)
ALTER TABLE "cash_ledger_entries" ADD COLUMN "signed_amount" DECIMAL(14,2) NOT NULL GENERATED ALWAYS AS ("amount" * "direction") STORED;
ALTER TABLE "cash_ledger_entries" ADD COLUMN "period_year" SMALLINT NOT NULL GENERATED ALWAYS AS (EXTRACT(YEAR FROM "effective_date")::smallint) STORED;
ALTER TABLE "cash_ledger_entries" ADD COLUMN "period_month" SMALLINT NOT NULL GENERATED ALWAYS AS (EXTRACT(MONTH FROM "effective_date")::smallint) STORED;

-- AddCheckConstraint (hand-added: sign lives in direction, not in amount's own value)
ALTER TABLE "cash_ledger_entries" ADD CONSTRAINT "ck_ledger_direction" CHECK ("direction" IN (-1, 1));
ALTER TABLE "cash_ledger_entries" ADD CONSTRAINT "ck_ledger_amount_positive" CHECK ("amount" > 0);

-- CreateTable
CREATE TABLE "cash_allocations" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "account_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "issue_date" DATE NOT NULL,
    "reference_no" TEXT,
    "payment_mode" TEXT,
    "remarks" TEXT,
    "issued_by" UUID NOT NULL,
    "confirmed_amount" DECIMAL(14,2),
    "confirmed_date" DATE,
    "confirmed_by" UUID,
    "confirmed_at" TIMESTAMPTZ(6),
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "petty_cash_accounts_unit_id_key" ON "petty_cash_accounts"("unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_allocations_idempotency_key_key" ON "cash_allocations"("idempotency_key");

-- CreateIndex (hand-added, Build Plan §2.3/§2.4 — ledger read patterns)
CREATE INDEX "ix_ledger_account_date" ON "cash_ledger_entries" ("account_id", "effective_date" DESC, "id" DESC);
CREATE INDEX "ix_ledger_period" ON "cash_ledger_entries" ("account_id", "period_year", "period_month");

-- AddForeignKey
ALTER TABLE "petty_cash_accounts" ADD CONSTRAINT "petty_cash_accounts_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "organizational_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (hand-added: the composite FK is the actual R-11/BR-016 enforcement —
-- Prisma cannot express a multi-column FK against a generated shadow column)
ALTER TABLE "petty_cash_accounts"
  ADD CONSTRAINT "fk_account_requires_enabled_unit"
  FOREIGN KEY ("unit_id", "unit_petty_cash_enabled")
  REFERENCES "organizational_units" ("id", "petty_cash_enabled");

-- AddForeignKey
ALTER TABLE "cash_ledger_entries" ADD CONSTRAINT "cash_ledger_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "petty_cash_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_ledger_entries" ADD CONSTRAINT "cash_ledger_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_ledger_entries" ADD CONSTRAINT "cash_ledger_entries_reverses_entry_id_fkey" FOREIGN KEY ("reverses_entry_id") REFERENCES "cash_ledger_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_allocations" ADD CONSTRAINT "cash_allocations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "petty_cash_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_allocations" ADD CONSTRAINT "cash_allocations_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_allocations" ADD CONSTRAINT "cash_allocations_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Application role separation (Build Plan §6.6). psh_app is the low-privilege runtime
-- role the application connects as; the role that owns/applies migrations (psh, via
-- DIRECT_DATABASE_URL) keeps full DDL rights. Idempotent so this is safe to run against
-- a cluster where the role already exists. No password is set here — that is a secret,
-- set out-of-band via ALTER ROLE from an environment variable, never committed.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'psh_app') THEN
    CREATE ROLE psh_app LOGIN;
  END IF;
END
$$;

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO psh_app', current_database());
END
$$;

GRANT USAGE ON SCHEMA public TO psh_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO psh_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO psh_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO psh_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO psh_app;

-- The cash ledger is append-only (BR-020, rule 17: "UPDATE/DELETE are revoked for the
-- application role. Fix mistakes with compensating entries."). REVOKE removes psh_app's
-- ability to even attempt UPDATE/DELETE; the RULE is a second, independent layer that
-- turns any UPDATE attempted by a role that somehow still holds the privilege into a
-- no-op instead of a silent mutation.
REVOKE UPDATE, DELETE ON cash_ledger_entries FROM psh_app;
CREATE RULE ledger_no_update AS ON UPDATE TO cash_ledger_entries DO INSTEAD NOTHING;
