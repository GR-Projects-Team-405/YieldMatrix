
-- YM-03 registration profile storage
-- Requires the shared YieldMatrix schema.sql.
-- Review and apply through the team's database migration process.
-- Do not execute directly against the shared Neon database.

BEGIN;

CREATE TABLE IF NOT EXISTS buyer_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    buyer_type TEXT NOT NULL
        CHECK (buyer_type IN ('individual', 'commercial')),
    business_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (
        (buyer_type = 'individual'
            AND business_name IS NULL)
        OR
        (buyer_type = 'commercial'
            AND business_name IS NOT NULL
            AND length(trim(business_name)) > 0)
    )
);

CREATE TABLE IF NOT EXISTS driver_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    operating_area TEXT NOT NULL
        CHECK (length(trim(operating_area)) > 0),
    licence_number TEXT NOT NULL
        CHECK (length(trim(licence_number)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
