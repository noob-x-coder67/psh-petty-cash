-- Phase 6 (Reports Studio): report_exports (export-audit trail, distinct from
-- audit_logs — §6.8/§14.2) and report_presets (per-user saved filters, SRS §12.8 —
-- no schema was specified anywhere for this, shape inferred from report_exports'
-- filters-jsonb column and documented as a design decision in the Phase 6 plan).

-- CreateEnum
CREATE TYPE "report_export_format" AS ENUM ('PDF', 'EXCEL', 'CSV');

-- CreateEnum
CREATE TYPE "report_export_status" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "report_exports" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "report_key" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "format" "report_export_format" NOT NULL,
    "status" "report_export_status" NOT NULL DEFAULT 'PENDING',
    "row_count" INTEGER,
    "generated_by" UUID NOT NULL,
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "file_ref" TEXT,
    "downloaded_at" TIMESTAMPTZ(6),

    CONSTRAINT "report_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_presets" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "report_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "report_presets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_report_exports_key" ON "report_exports"("report_key", "generated_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_preset_user_report_name" ON "report_presets"("user_id", "report_key", "name");

-- AddForeignKey
ALTER TABLE "report_exports" ADD CONSTRAINT "report_exports_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_presets" ADD CONSTRAINT "report_presets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- report_exports is an audit-adjacent record (§6.8: "often the first place an
-- investigation looks") — UPDATE stays granted (status transitions PENDING->READY/
-- FAILED, downloaded_at set later) but rows are never hard-deleted.
REVOKE DELETE ON "report_exports" FROM psh_app;

-- report_presets is a genuine exception to the "no hard deletion" convention (rule 9
-- scopes that to financial/audit records specifically) — it's user preference data, a
-- saved filter shortcut, not a financial or audit record. Users may delete their own
-- presets normally; no REVOKE here.
