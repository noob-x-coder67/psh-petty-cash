-- CreateEnum
CREATE TYPE "expense_category" AS ENUM ('BUILDING', 'VEHICLE', 'OTHER');

-- CreateEnum
CREATE TYPE "voucher_state" AS ENUM ('ACTIVE', 'REVERSED');

-- Needed for ix_voucher_vendor_trgm below (fuzzy vendor-name search, RPT-05/register).
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateTable
CREATE TABLE "expense_vouchers" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "voucher_no" TEXT NOT NULL,
    "account_id" UUID NOT NULL,
    "expense_date" DATE NOT NULL,
    "bill_date" DATE,
    "vendor_name" TEXT NOT NULL,
    "vendor_bill_no" TEXT,
    "justification" TEXT NOT NULL,
    "bill_total" DECIMAL(14,2) NOT NULL,
    "lines_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "state" "voucher_state" NOT NULL DEFAULT 'ACTIVE',
    "has_bill" BOOLEAN NOT NULL DEFAULT false,
    "missing_bill_reason" TEXT,
    "checked_by" UUID,
    "checked_at" TIMESTAMPTZ(6),
    "is_backdated" BOOLEAN NOT NULL DEFAULT false,
    "balance_after" DECIMAL(14,2),
    "entered_by" UUID NOT NULL,
    "entered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversed_by_voucher_id" UUID,

    CONSTRAINT "expense_vouchers_pkey" PRIMARY KEY ("id")
);

-- AddColumn (hand-added: GENERATED ALWAYS columns, not expressible in Prisma's schema DSL)
ALTER TABLE "expense_vouchers" ADD COLUMN "period_year" SMALLINT NOT NULL GENERATED ALWAYS AS (EXTRACT(YEAR FROM "expense_date")::smallint) STORED;
ALTER TABLE "expense_vouchers" ADD COLUMN "period_month" SMALLINT NOT NULL GENERATED ALWAYS AS (EXTRACT(MONTH FROM "expense_date")::smallint) STORED;

-- AddCheckConstraint (hand-added — Prisma has no CHECK attribute)
ALTER TABLE "expense_vouchers" ADD CONSTRAINT "ck_voucher_justification_length"
  CHECK (length(btrim("justification")) >= 10);                                    -- BR-002
ALTER TABLE "expense_vouchers" ADD CONSTRAINT "ck_voucher_bill_total_positive"
  CHECK ("bill_total" > 0);
ALTER TABLE "expense_vouchers" ADD CONSTRAINT "ck_voucher_missing_bill_reason"
  CHECK ("has_bill" OR "missing_bill_reason" IS NOT NULL);                          -- FR-DOC-007
ALTER TABLE "expense_vouchers" ADD CONSTRAINT "ck_voucher_checked_pair"
  CHECK (("checked_by" IS NULL) = ("checked_at" IS NULL));

-- CreateTable
CREATE TABLE "expense_lines" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "voucher_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "category" "expense_category" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "other_explanation" TEXT,

    CONSTRAINT "expense_lines_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraint (hand-added)
ALTER TABLE "expense_lines" ADD CONSTRAINT "ck_line_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "expense_lines" ADD CONSTRAINT "ck_other_requires_explanation"
  CHECK ("category" <> 'OTHER' OR length(btrim(coalesce("other_explanation", ''))) >= 5);  -- BR-007

-- CreateTable
CREATE TABLE "voucher_counters" (
    "account_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "last_seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "voucher_counters_pkey" PRIMARY KEY ("account_id","year")
);

-- CreateIndex
CREATE UNIQUE INDEX "expense_vouchers_voucher_no_key" ON "expense_vouchers"("voucher_no");

-- CreateIndex (hand-added, Build Plan §2.4 — NFR-003: 100k rows, p95 <= 2s first page)
CREATE INDEX "ix_voucher_register" ON "expense_vouchers" ("account_id", "expense_date" DESC, "id" DESC)
  WHERE "state" = 'ACTIVE';
CREATE INDEX "ix_voucher_unchecked" ON "expense_vouchers" ("account_id", "expense_date" DESC)
  WHERE "checked_at" IS NULL AND "state" = 'ACTIVE';
CREATE INDEX "ix_voucher_negative" ON "expense_vouchers" ("account_id", "expense_date")
  WHERE "balance_after" < 0;
CREATE INDEX "ix_voucher_vendor_trgm" ON "expense_vouchers" USING gin ("vendor_name" gin_trgm_ops);
CREATE INDEX "ix_voucher_search" ON "expense_vouchers" USING gin
  (to_tsvector('simple', "voucher_no" || ' ' || "vendor_name" || ' ' || "justification"));
CREATE INDEX "ix_lines_category" ON "expense_lines" ("category", "voucher_id");

-- AddForeignKey
ALTER TABLE "expense_vouchers" ADD CONSTRAINT "expense_vouchers_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "petty_cash_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_vouchers" ADD CONSTRAINT "expense_vouchers_entered_by_fkey" FOREIGN KEY ("entered_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_vouchers" ADD CONSTRAINT "expense_vouchers_checked_by_fkey" FOREIGN KEY ("checked_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_vouchers" ADD CONSTRAINT "expense_vouchers_reversed_by_voucher_id_fkey" FOREIGN KEY ("reversed_by_voucher_id") REFERENCES "expense_vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_lines" ADD CONSTRAINT "expense_lines_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "expense_vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_counters" ADD CONSTRAINT "voucher_counters_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "petty_cash_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Total-equality (BR-005), enforced twice per Build Plan §2.3: once in the service
-- transaction, once here. lines_total is trigger-maintained (an aggregate across rows
-- in another table — not expressible as a GENERATED column, which can only reference
-- the same row).
CREATE OR REPLACE FUNCTION recompute_voucher_lines_total() RETURNS TRIGGER AS $$
BEGIN
  UPDATE expense_vouchers
  SET lines_total = (
    SELECT COALESCE(SUM(amount), 0) FROM expense_lines
    WHERE voucher_id = COALESCE(NEW.voucher_id, OLD.voucher_id)
  )
  WHERE id = COALESCE(NEW.voucher_id, OLD.voucher_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recompute_lines_total
AFTER INSERT OR UPDATE OR DELETE ON expense_lines
FOR EACH ROW EXECUTE FUNCTION recompute_voucher_lines_total();

-- Build Plan's literal SQL for this ("CHECK (...) DEFERRABLE") is not valid PostgreSQL —
-- verified against this project's actual engine (18.4): CHECK constraints cannot be
-- marked DEFERRABLE, only UNIQUE/PK/FK/EXCLUDE can. A deferrable CONSTRAINT TRIGGER is
-- the correct mechanism for the same intent (defer validation until after all lines are
-- inserted, force it with `SET CONSTRAINTS ck_voucher_totals IMMEDIATE`, or let it fire
-- at COMMIT regardless) — prototyped and verified on a scratch database before writing
-- this: matching totals commit, mismatched totals raise and roll back the whole
-- transaction, both with and without an explicit IMMEDIATE call.
CREATE OR REPLACE FUNCTION check_voucher_totals() RETURNS TRIGGER AS $$
DECLARE
  v_bill_total numeric(14,2);
  v_lines_total numeric(14,2);
BEGIN
  SELECT bill_total, lines_total INTO v_bill_total, v_lines_total
  FROM expense_vouchers WHERE id = NEW.id;

  IF v_lines_total <> v_bill_total THEN
    RAISE EXCEPTION 'voucher % line total (%) does not match bill total (%)', NEW.id, v_lines_total, v_bill_total;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER ck_voucher_totals
AFTER INSERT OR UPDATE ON expense_vouchers
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_voucher_totals();
