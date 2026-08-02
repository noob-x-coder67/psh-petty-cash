-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";
-- Enable UUIDv7 support on PostgreSQL versions without native uuidv7()
CREATE EXTENSION IF NOT EXISTS "pg_uuidv7";

-- Compatibility wrapper used by the existing migration files
CREATE OR REPLACE FUNCTION public.uuidv7()
RETURNS uuid
LANGUAGE sql
VOLATILE
PARALLEL SAFE
AS $$
    SELECT public.uuid_generate_v7();
$$;
-- CreateEnum
CREATE TYPE "unit_type" AS ENUM ('HEAD_OFFICE', 'CENTER', 'PROJECT', 'PROJECT_LOCATION', 'SERVICE');

-- CreateEnum
CREATE TYPE "role_key" AS ENUM ('SUPER_ADMIN', 'FINANCE_MANAGER', 'FINANCE_OFFICER', 'UNIT_USER', 'UNIT_INCHARGE', 'AUDITOR', 'SUPPORT');

-- CreateTable
CREATE TABLE "organizational_units" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "unit_type" NOT NULL,
    "city" TEXT,
    "parent_id" UUID,
    "petty_cash_enabled" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organizational_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "email" CITEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "totp_secret_enc" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "key" "role_key" NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "key" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "user_unit_access" (
    "user_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "granted_by" UUID NOT NULL,
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_unit_access_pkey" PRIMARY KEY ("user_id","unit_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizational_units_code_key" ON "organizational_units"("code");

-- AddUniqueConstraint
ALTER TABLE "organizational_units" ADD CONSTRAINT "uq_unit_id_pce" UNIQUE ("id", "petty_cash_enabled");

-- AddCheckConstraint
-- Hand-added: Prisma's schema DSL cannot express CHECK constraints (Build Plan §2.3).
-- PSH-ISB may never own a petty-cash account (BR-016, R-11). This CHECK is layer one
-- of the three-layer defense; the composite FK layer (fk_account_requires_enabled_unit,
-- referencing uq_unit_id_pce above) is added in Phase 2 when petty_cash_accounts exists.
ALTER TABLE "organizational_units" ADD CONSTRAINT "ck_psh_isb_never_enabled"
  CHECK ("code" <> 'PSH-ISB' OR "petty_cash_enabled" = false);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- AddForeignKey
ALTER TABLE "organizational_units" ADD CONSTRAINT "organizational_units_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "organizational_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_unit_access" ADD CONSTRAINT "user_unit_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_unit_access" ADD CONSTRAINT "user_unit_access_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_unit_access" ADD CONSTRAINT "user_unit_access_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "organizational_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
