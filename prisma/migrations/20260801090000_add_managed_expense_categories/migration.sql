BEGIN;

-- ADR-0011: expense categories are managed reference data, not a closed state enum.
CREATE TABLE "expense_categories" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" CITEXT NOT NULL,
    "requires_explanation" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "expense_categories_name_key" UNIQUE ("name"),
    CONSTRAINT "ck_expense_category_name" CHECK (length(btrim("name"::text)) > 0),
    CONSTRAINT "ck_expense_category_sort_order" CHECK ("sort_order" > 0)
);

CREATE INDEX "ix_expense_categories_active_order"
  ON "expense_categories" ("is_active", "sort_order", "name");

-- Finance's approved 24 values, with persisted display ranks in strict A-Z order.
-- Miscellaneous is intentionally in its natural alphabetical position.
INSERT INTO "expense_categories"
  ("name", "requires_explanation", "is_active", "sort_order")
VALUES
  ('Books & Stationary', false, true, 1),
  ('Eidi (Eid ul Adha)', false, true, 2),
  ('Eidi (Eid ul Fitr)', false, true, 3),
  ('Electricity Bill', false, true, 4),
  ('Fee', false, true, 5),
  ('Food', false, true, 6),
  ('Fuel Charges', false, true, 7),
  ('Function Expense', false, true, 8),
  ('Gas Bill', false, true, 9),
  ('House Hold Items', false, true, 10),
  ('Internet', false, true, 11),
  ('Medicine', false, true, 12),
  ('Miscellaneous', true, true, 13),
  ('Pocket Money', false, true, 14),
  ('Postage & Courier', false, true, 15),
  ('Printing & Copy', false, true, 16),
  ('Printing & Publishing', false, true, 17),
  ('Repair & Maintenance: Building', false, true, 18),
  ('Repair & Maintenance: Others', false, true, 19),
  ('Repair & Maintenance: Vehicle', false, true, 20),
  ('Salary', false, true, 21),
  ('Telephone Bill', false, true, 22),
  ('Travelling Expense', false, true, 23),
  ('Zoo', false, true, 24);

ALTER TABLE "expense_lines"
  ADD COLUMN "category_id" UUID;

-- Approved Option 1 historical mapping. No voucher, line, amount, or explanation is
-- rewritten; only the category representation changes from enum value to FK.
UPDATE "expense_lines" AS line
SET "category_id" = category."id"
FROM "expense_categories" AS category
WHERE category."name" =
  CASE line."category"::text
    WHEN 'BUILDING' THEN 'Repair & Maintenance: Building'
    WHEN 'VEHICLE' THEN 'Repair & Maintenance: Vehicle'
    WHEN 'OTHER' THEN 'Miscellaneous'
  END;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "expense_lines"
    WHERE "category_id" IS NULL
  ) THEN
    RAISE EXCEPTION
      'expense category migration left one or more expense lines unmapped';
  END IF;
END
$$;

-- Saved presets are live reusable filters, so convert them to stable category IDs.
UPDATE "report_presets" AS preset
SET "filters" = jsonb_set(
  preset."filters" - 'category',
  '{categoryId}',
  to_jsonb(category."id"::text),
  true
)
FROM "expense_categories" AS category
WHERE preset."filters" ? 'category'
  AND category."name" =
    CASE preset."filters"->>'category'
      WHEN 'BUILDING' THEN 'Repair & Maintenance: Building'
      WHEN 'VEHICLE' THEN 'Repair & Maintenance: Vehicle'
      WHEN 'OTHER' THEN 'Miscellaneous'
    END;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "report_presets"
    WHERE "filters" ? 'category'
  ) THEN
    RAISE EXCEPTION
      'expense category migration left one or more saved presets unmapped';
  END IF;
END
$$;

-- report_exports.filters and audit_logs JSON are historical audit snapshots and are
-- intentionally not rewritten.

ALTER TABLE "expense_lines"
  ALTER COLUMN "category_id" SET NOT NULL;

ALTER TABLE "expense_lines"
  ADD CONSTRAINT "expense_lines_category_id_fkey"
  FOREIGN KEY ("category_id")
  REFERENCES "expense_categories"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

DROP INDEX "ix_lines_category";

CREATE INDEX "ix_lines_category"
  ON "expense_lines" ("category_id", "voucher_id");

ALTER TABLE "expense_lines"
  DROP CONSTRAINT "ck_other_requires_explanation";

-- A CHECK constraint cannot consult category metadata in another table. This trigger
-- retains BR-007's exact five-trimmed-character database guarantee for Miscellaneous
-- and for any future category deliberately configured to require an explanation.
CREATE FUNCTION enforce_expense_line_category_explanation()
RETURNS trigger AS $$
DECLARE
  category_requires_explanation BOOLEAN;
BEGIN
  SELECT "requires_explanation"
  INTO category_requires_explanation
  FROM "expense_categories"
  WHERE "id" = NEW."category_id";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'expense category % does not exist', NEW."category_id"
      USING
        ERRCODE = '23503',
        CONSTRAINT = 'expense_lines_category_id_fkey';
  END IF;

  IF category_requires_explanation
     AND length(btrim(coalesce(NEW."other_explanation", ''))) < 5 THEN
    RAISE EXCEPTION
      'selected expense category requires an explanation of at least 5 characters'
      USING
        ERRCODE = '23514',
        CONSTRAINT = 'ck_category_requires_explanation';
  END IF;

  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_expense_line_category_explanation"
BEFORE INSERT OR UPDATE OF "category_id", "other_explanation"
ON "expense_lines"
FOR EACH ROW
EXECUTE FUNCTION enforce_expense_line_category_explanation();

ALTER TABLE "expense_lines"
  DROP COLUMN "category";

DROP TYPE "expense_category";

-- Deactivation preserves history; hard deletion is never a supported category action.
REVOKE DELETE ON "expense_categories" FROM psh_app;

COMMIT;
