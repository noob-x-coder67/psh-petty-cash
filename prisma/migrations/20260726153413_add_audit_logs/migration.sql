-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "actor_id" UUID,
    "actor_role" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "unit_id" UUID,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "user_agent" TEXT,
    "request_id" TEXT,
    "reason" TEXT,
    "before" JSONB,
    "after" JSONB,
    "diff" JSONB,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_audit_entity" ON "audit_logs"("entity_type", "entity_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "ix_audit_actor" ON "audit_logs"("actor_id", "occurred_at" DESC);

-- Audit logs are immutable to the application role (FR-AUD-003), same discipline as the
-- cash ledger (BR-020, rule 17). psh_app already exists from the Phase 2 migration.
REVOKE UPDATE, DELETE ON audit_logs FROM psh_app;
