-- Phase 4: Documents & checks (FR-DOC-001..010, FR-CHK-001..007, BR-008, BR-014, BR-015,
-- BR-018). ArchivesModule's real ZIP/confirm/eligible-deletion workflow is deferred until
-- Month Close (Phase 7) supplies "a completed month" to archive — monthly_archives exists
-- here as schema only, so attachments.archive_id has somewhere to point later.

-- CreateEnum
CREATE TYPE "storage_driver" AS ENUM ('POSTGRES_BYTEA', 'FILESYSTEM');

-- CreateEnum
CREATE TYPE "receipt_check_action" AS ENUM ('CHECKED', 'UNCHECKED');

-- CreateEnum
CREATE TYPE "archive_scope" AS ENUM ('UNIT', 'CONSOLIDATED');

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "voucher_id" UUID NOT NULL,
    "driver" "storage_driver" NOT NULL,
    "storage_key" TEXT,
    "data" BYTEA,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "page_no" INTEGER NOT NULL DEFAULT 1,
    "uploaded_by" UUID NOT NULL,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "archive_id" UUID,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_check_events" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "voucher_id" UUID NOT NULL,
    "action" "receipt_check_action" NOT NULL,
    "actor_id" UUID NOT NULL,
    "acted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "receipt_check_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_archives" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "scope" "archive_scope" NOT NULL,
    "account_id" UUID,
    "period_year" INTEGER NOT NULL,
    "period_month" INTEGER NOT NULL,
    "file_count" INTEGER NOT NULL DEFAULT 0,
    "total_bytes" INTEGER NOT NULL DEFAULT 0,
    "generated_by" UUID NOT NULL,
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "downloaded_at" TIMESTAMPTZ(6),
    "confirmed_by" UUID,
    "confirmed_at" TIMESTAMPTZ(6),
    "deletion_eligible_at" TIMESTAMPTZ(6),
    "deletion_executed_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,

    CONSTRAINT "monthly_archives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attachments_voucher_id_idx" ON "attachments"("voucher_id");

-- CreateIndex
CREATE INDEX "attachments_sha256_idx" ON "attachments"("sha256");

-- CreateIndex
CREATE INDEX "receipt_check_events_voucher_id_acted_at_idx" ON "receipt_check_events"("voucher_id", "acted_at");

-- CreateIndex
CREATE INDEX "monthly_archives_account_id_period_year_period_month_idx" ON "monthly_archives"("account_id", "period_year", "period_month");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "expense_vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_archive_id_fkey" FOREIGN KEY ("archive_id") REFERENCES "monthly_archives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_check_events" ADD CONSTRAINT "receipt_check_events_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "expense_vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_check_events" ADD CONSTRAINT "receipt_check_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_archives" ADD CONSTRAINT "monthly_archives_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "petty_cash_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_archives" ADD CONSTRAINT "monthly_archives_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_archives" ADD CONSTRAINT "monthly_archives_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_archives" ADD CONSTRAINT "monthly_archives_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Hand-written: driver-vs-storage-location pairing (Prisma has no CHECK attribute). Once
-- an attachment is soft-deleted (deleted_at set), both bytes columns must be cleared —
-- deletion removes bytes only, never the row (FR-DOC-013, BR-015).
ALTER TABLE "attachments" ADD CONSTRAINT "ck_attachment_bytes_pair" CHECK (
  (deleted_at IS NOT NULL AND data IS NULL AND storage_key IS NULL)
  OR (deleted_at IS NULL AND driver = 'POSTGRES_BYTEA' AND data IS NOT NULL AND storage_key IS NULL)
  OR (deleted_at IS NULL AND driver = 'FILESYSTEM' AND storage_key IS NOT NULL AND data IS NULL)
);

-- Hand-written: FR-DOC-010 — reverting to Unchecked requires a reason; marking Checked
-- does not.
ALTER TABLE "receipt_check_events" ADD CONSTRAINT "ck_uncheck_requires_reason" CHECK (
  (action = 'CHECKED') OR (action = 'UNCHECKED' AND reason IS NOT NULL)
);

-- receipt_check_events is a history/audit trail, same immutability posture as audit_logs
-- (BR-020) — append-only at the database level, not just by application discipline.
REVOKE UPDATE, DELETE ON "receipt_check_events" FROM psh_app;

-- attachments: UPDATE stays granted (soft-delete sets deleted_at/deleted_by and clears the
-- byte columns; archive linking sets archive_id) but the row itself is never hard-deleted
-- (FR-DOC-013, BR-015).
REVOKE DELETE ON "attachments" FROM psh_app;

-- monthly_archives: UPDATE stays granted (confirmed_at/confirmed_by/deletion_eligible_at/
-- deletion_executed_at are set over its lifecycle) but rows are never hard-deleted.
REVOKE DELETE ON "monthly_archives" FROM psh_app;
