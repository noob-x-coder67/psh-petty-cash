-- Phase 7 (Month Close & Compliance): monthly_closings (FR-CLS-001..009) and
-- replenishments (FR-REP-001..007). Three-month compliance (§14.2's
-- "three_month_compliance" entity) is computed on demand from monthly_closings rather
-- than a separate cached table — see the model comment in schema.prisma.

-- CreateEnum
CREATE TYPE "monthly_closing_status" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "monthly_closings" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "account_id" UUID NOT NULL,
    "period_year" INTEGER NOT NULL,
    "period_month" INTEGER NOT NULL,
    "physical_cash_count" DECIMAL(14,2),
    "counted_by" UUID,
    "counted_at" TIMESTAMPTZ(6),
    "expected_balance" DECIMAL(14,2),
    "variance" DECIMAL(14,2),
    "remarks" TEXT,
    "status" "monthly_closing_status" NOT NULL DEFAULT 'OPEN',
    "closed_by" UUID,
    "closed_at" TIMESTAMPTZ(6),
    "reopened_by" UUID,
    "reopened_at" TIMESTAMPTZ(6),
    "reopen_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "monthly_closings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replenishments" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "account_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "issue_date" DATE NOT NULL,
    "reference_no" TEXT,
    "payment_mode" TEXT,
    "remarks" TEXT,
    "is_compliant" BOOLEAN NOT NULL,
    "exception_reason" TEXT,
    "exception_by" UUID,
    "exception_at" TIMESTAMPTZ(6),
    "issued_by" UUID NOT NULL,
    "confirmed_amount" DECIMAL(14,2),
    "confirmed_date" DATE,
    "confirmed_by" UUID,
    "confirmed_at" TIMESTAMPTZ(6),
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "replenishments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_closing_account_period" ON "monthly_closings"("account_id", "period_year", "period_month");

-- CreateIndex
CREATE UNIQUE INDEX "replenishments_idempotency_key_key" ON "replenishments"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_replenishment_account_reference" ON "replenishments"("account_id", "reference_no");

-- AddForeignKey
ALTER TABLE "monthly_closings" ADD CONSTRAINT "monthly_closings_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "petty_cash_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_closings" ADD CONSTRAINT "monthly_closings_counted_by_fkey" FOREIGN KEY ("counted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_closings" ADD CONSTRAINT "monthly_closings_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_closings" ADD CONSTRAINT "monthly_closings_reopened_by_fkey" FOREIGN KEY ("reopened_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replenishments" ADD CONSTRAINT "replenishments_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "petty_cash_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replenishments" ADD CONSTRAINT "replenishments_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replenishments" ADD CONSTRAINT "replenishments_exception_by_fkey" FOREIGN KEY ("exception_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replenishments" ADD CONSTRAINT "replenishments_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- monthly_closings and replenishments are financial records (rule 9) — UPDATE stays
-- granted (cash-count entry, close, reopen, and replenishment confirmation are all
-- legitimate UPDATEs to an existing row) but rows are never hard-deleted.
REVOKE DELETE ON "monthly_closings" FROM psh_app;
REVOKE DELETE ON "replenishments" FROM psh_app;
