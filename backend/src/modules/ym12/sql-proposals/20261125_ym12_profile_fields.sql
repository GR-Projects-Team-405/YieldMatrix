-- REVIEW ONLY. Not applied to the shared database.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS business_type TEXT,
  ADD COLUMN IF NOT EXISTS tagline TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS operating_since_year SMALLINT;

-- Existing users receive NULL for optional descriptive/year fields.
-- Existing users receive verified=false; no historic account is implicitly
-- granted an identity-verification claim.
