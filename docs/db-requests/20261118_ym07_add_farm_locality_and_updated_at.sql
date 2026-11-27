-- YM07 Farm Management proposal. Status: Not applied.
-- Submit for approval and test on a safe PostgreSQL copy before deployment.
BEGIN;

ALTER TABLE farms
  ADD COLUMN locality TEXT CHECK (locality IS NULL OR length(btrim(locality)) > 0),
  ADD COLUMN updated_at TIMESTAMPTZ;

-- Existing rows retain NULL. New rows receive a known modification timestamp.
ALTER TABLE farms
  ALTER COLUMN updated_at SET DEFAULT now();

COMMIT;
