-- CreateTable
CREATE TABLE "cash_count_denominations" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "closing_id" UUID NOT NULL,
    "denomination" INTEGER NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "cash_count_denominations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_cash_count_denomination" ON "cash_count_denominations"("closing_id", "denomination");

-- AddForeignKey
ALTER TABLE "cash_count_denominations" ADD CONSTRAINT "cash_count_denominations_closing_id_fkey" FOREIGN KEY ("closing_id") REFERENCES "monthly_closings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint
ALTER TABLE "cash_count_denominations" ADD CONSTRAINT "ck_denomination_count_non_negative" CHECK ("count" >= 0);
ALTER TABLE "cash_count_denominations" ADD CONSTRAINT "ck_denomination_positive" CHECK ("denomination" > 0);
