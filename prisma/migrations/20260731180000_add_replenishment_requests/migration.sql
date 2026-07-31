-- ADR-0010 (Replenishment Request -> Approve -> Confirm workflow). BR-013's three-month
-- hold is now enforced at request time (unit cannot submit at all when non-compliant);
-- the old direct-create path is removed in application code. `replenishments` itself is
-- untouched in shape except for one new nullable FK back to the request that produced
-- it (existing rows created before this migration keep request_id NULL, no backfill
-- needed) -- its own confirm/ledger-posting flow (ADR-0009) is unaffected.

-- CreateEnum
CREATE TYPE "replenishment_request_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "replenishments" ADD COLUMN "request_id" UUID;

-- CreateTable
CREATE TABLE "replenishment_requests" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "account_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "replenishment_request_status" NOT NULL DEFAULT 'PENDING',
    "requested_by" UUID NOT NULL,
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_compliant" BOOLEAN NOT NULL,
    "exception_reason" TEXT,
    "exception_by" UUID,
    "exception_at" TIMESTAMPTZ(6),
    "decided_by" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "issue_date" DATE,
    "reference_no" TEXT,
    "payment_mode" TEXT,
    "remarks" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "replenishment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "replenishment_requests_idempotency_key_key" ON "replenishment_requests"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "replenishments_request_id_key" ON "replenishments"("request_id");

-- AddForeignKey
ALTER TABLE "replenishments" ADD CONSTRAINT "replenishments_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "replenishment_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replenishment_requests" ADD CONSTRAINT "replenishment_requests_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "petty_cash_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replenishment_requests" ADD CONSTRAINT "replenishment_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replenishment_requests" ADD CONSTRAINT "replenishment_requests_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replenishment_requests" ADD CONSTRAINT "replenishment_requests_exception_by_fkey" FOREIGN KEY ("exception_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- replenishment_requests is a financial/audit-adjacent record (rule 9) -- UPDATE stays
-- granted (approve/reject transitions are legitimate UPDATEs) but rows are never
-- hard-deleted, same convention as monthly_closings/replenishments.
REVOKE DELETE ON "replenishment_requests" FROM psh_app;
