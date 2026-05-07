ALTER TABLE tenant_requirements
    ADD COLUMN IF NOT EXISTS area_min_ping NUMERIC(6,1),
    ADD COLUMN IF NOT EXISTS area_max_ping NUMERIC(6,1),
    ADD COLUMN IF NOT EXISTS room_min INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS bathroom_min INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS move_in_timeline TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS minimum_lease_months INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS can_cook_needed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS can_register_household_needed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS lifestyle_note TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS must_have_note TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS tenant_requirement_districts (
    id BIGSERIAL PRIMARY KEY,
    requirement_id BIGINT NOT NULL REFERENCES tenant_requirements(id) ON DELETE CASCADE,
    county VARCHAR(20) NOT NULL,
    district VARCHAR(30) NOT NULL,
    zip_code CHAR(3) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_requirement_districts UNIQUE (requirement_id, county, district, zip_code)
);

CREATE INDEX IF NOT EXISTS idx_tenant_requirement_districts_requirement_id
    ON tenant_requirement_districts (requirement_id);

CREATE INDEX IF NOT EXISTS idx_tenant_requirement_districts_location
    ON tenant_requirement_districts (county, district, zip_code);

INSERT INTO tenant_requirement_districts (requirement_id, county, district, zip_code)
SELECT tr.id, td.county, td.district, td.postal_code
FROM tenant_requirements tr
JOIN taiwan_districts td ON td.district = tr.target_district
WHERE tr.target_district <> ''
  AND NOT EXISTS (
    SELECT 1 FROM tenant_requirement_districts existing
    WHERE existing.requirement_id = tr.id
  );
