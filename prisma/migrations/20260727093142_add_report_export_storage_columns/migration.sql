-- Phase 6d (export pipeline): report_exports gains the same StorageLocator shape
-- Attachment already has (driver/storage_key/data), routed through the same
-- AttachmentStorage interface (rule 18), plus file_name/mime_type/size_bytes metadata
-- and error_message for a FAILED export's poller. file_ref (a placeholder from the
-- Phase 6a migration, before the storage shape was worked out) is dropped in favor of
-- file_name, which now carries that same "display filename" meaning.

-- AlterTable
ALTER TABLE "report_exports" DROP COLUMN "file_ref",
ADD COLUMN     "data" BYTEA,
ADD COLUMN     "driver" "storage_driver",
ADD COLUMN     "error_message" TEXT,
ADD COLUMN     "file_name" TEXT,
ADD COLUMN     "mime_type" TEXT,
ADD COLUMN     "size_bytes" INTEGER,
ADD COLUMN     "storage_key" TEXT;

-- Same bytes-pair invariant as ck_attachment_bytes_pair, adapted for PENDING/FAILED
-- rows that legitimately have no bytes yet — only a READY export must have exactly one
-- of the two storage shapes populated.
ALTER TABLE "report_exports" ADD CONSTRAINT "ck_report_export_bytes_pair" CHECK (
  (status <> 'READY')
  OR (driver = 'POSTGRES_BYTEA' AND data IS NOT NULL AND storage_key IS NULL)
  OR (driver = 'FILESYSTEM' AND storage_key IS NOT NULL AND data IS NULL)
);
