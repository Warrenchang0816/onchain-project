package db

import (
	"database/sql"
	"fmt"
)

type schemaExecutor interface {
	Exec(query string, args ...any) (sql.Result, error)
}

// EnsureSchema applies idempotent schema repairs needed by long-lived local
// Docker volumes that do not re-run infra/init SQL after the first boot.
func EnsureSchema(db schemaExecutor) error {
	statements := []string{
		`DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'properties') THEN
        ALTER TABLE properties RENAME TO customer;
    END IF;
END $$`,

		`
CREATE TABLE IF NOT EXISTS taiwan_districts (
    id BIGSERIAL PRIMARY KEY,
    county VARCHAR(20) NOT NULL,
    district VARCHAR(30) NOT NULL,
    postal_code CHAR(3) NOT NULL,
    sort_order INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_taiwan_districts UNIQUE (county, district, postal_code)
)`,

		`CREATE TABLE IF NOT EXISTS property (
    id                   BIGSERIAL    PRIMARY KEY,
    owner_user_id        BIGINT       NOT NULL REFERENCES users(id),
    title                TEXT         NOT NULL DEFAULT '',
    address              TEXT         NOT NULL DEFAULT '',
    district_id          BIGINT       REFERENCES taiwan_districts(id),
    building_type        VARCHAR(20)  NOT NULL DEFAULT 'APARTMENT',
    floor                SMALLINT,
    total_floors         SMALLINT,
    main_area            NUMERIC(6,2),
    auxiliary_area       NUMERIC(6,2),
    balcony_area         NUMERIC(6,2),
    shared_area          NUMERIC(6,2),
    awning_area          NUMERIC(6,2),
    land_area            NUMERIC(8,2),
    rooms                SMALLINT,
    living_rooms         SMALLINT,
    bathrooms            SMALLINT,
    is_corner_unit       BOOLEAN      NOT NULL DEFAULT FALSE,
    has_dark_room        BOOLEAN      NOT NULL DEFAULT FALSE,
    building_age         SMALLINT,
    building_structure   VARCHAR(50),
    exterior_material    VARCHAR(100),
    building_usage       TEXT,
    zoning               TEXT,
    units_on_floor       SMALLINT,
    building_orientation VARCHAR(10),
    window_orientation   VARCHAR(10),
    parking_type         VARCHAR(20)  NOT NULL DEFAULT 'NONE',
    management_fee       NUMERIC(10,2),
    security_type        VARCHAR(20)  NOT NULL DEFAULT 'NONE',
    setup_status         VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
)`,

		`CREATE INDEX IF NOT EXISTS idx_property_owner ON property (owner_user_id)`,

		`CREATE TABLE IF NOT EXISTS property_attachment (
    id          BIGSERIAL   PRIMARY KEY,
    property_id BIGINT      NOT NULL REFERENCES property(id) ON DELETE CASCADE,
    type        VARCHAR(20) NOT NULL,
    url         TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`,

		`CREATE INDEX IF NOT EXISTS idx_property_attachment_property ON property_attachment (property_id)`,

		`CREATE TABLE IF NOT EXISTS rental_listing (
    id                   BIGSERIAL     PRIMARY KEY,
    property_id          BIGINT        NOT NULL REFERENCES property(id),
    status               VARCHAR(20)   NOT NULL DEFAULT 'DRAFT',
    duration_days        INT           NOT NULL DEFAULT 30,
    monthly_rent         NUMERIC(14,2) NOT NULL DEFAULT 0,
    deposit_months       NUMERIC(4,1)  NOT NULL DEFAULT 0,
    management_fee_payer VARCHAR(20)   NOT NULL DEFAULT 'TENANT',
    min_lease_months     INT           NOT NULL DEFAULT 0,
    allow_pets           BOOLEAN       NOT NULL DEFAULT FALSE,
    allow_cooking        BOOLEAN       NOT NULL DEFAULT FALSE,
    gender_restriction   VARCHAR(20),
    notes                TEXT,
    has_sofa             BOOLEAN       NOT NULL DEFAULT FALSE,
    has_bed              BOOLEAN       NOT NULL DEFAULT FALSE,
    has_wardrobe         BOOLEAN       NOT NULL DEFAULT FALSE,
    has_tv               BOOLEAN       NOT NULL DEFAULT FALSE,
    has_fridge           BOOLEAN       NOT NULL DEFAULT FALSE,
    has_ac               BOOLEAN       NOT NULL DEFAULT FALSE,
    has_washer           BOOLEAN       NOT NULL DEFAULT FALSE,
    has_water_heater     BOOLEAN       NOT NULL DEFAULT FALSE,
    has_gas              BOOLEAN       NOT NULL DEFAULT FALSE,
    has_internet         BOOLEAN       NOT NULL DEFAULT FALSE,
    has_cable_tv         BOOLEAN       NOT NULL DEFAULT FALSE,
    near_school          BOOLEAN       NOT NULL DEFAULT FALSE,
    near_supermarket     BOOLEAN       NOT NULL DEFAULT FALSE,
    near_convenience_store BOOLEAN     NOT NULL DEFAULT FALSE,
    near_park            BOOLEAN       NOT NULL DEFAULT FALSE,
    published_at         TIMESTAMPTZ,
    expires_at           TIMESTAMPTZ,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
)`,

		`CREATE INDEX IF NOT EXISTS idx_rental_listing_property ON rental_listing (property_id)`,
		`CREATE INDEX IF NOT EXISTS idx_rental_listing_status   ON rental_listing (status)`,

		`ALTER TABLE rental_listing
    ADD COLUMN IF NOT EXISTS has_sofa             BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS has_bed              BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS has_wardrobe         BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS has_tv               BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS has_fridge           BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS has_ac               BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS has_washer           BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS has_water_heater     BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS has_gas              BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS has_internet         BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS has_cable_tv         BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS near_school          BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS near_supermarket     BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS near_convenience_store BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS near_park            BOOLEAN NOT NULL DEFAULT FALSE`,

		`CREATE TABLE IF NOT EXISTS sale_listing (
    id                  BIGSERIAL     PRIMARY KEY,
    property_id         BIGINT        NOT NULL REFERENCES property(id),
    status              VARCHAR(20)   NOT NULL DEFAULT 'DRAFT',
    duration_days       INT           NOT NULL DEFAULT 30,
    total_price         NUMERIC(14,2) NOT NULL DEFAULT 0,
    unit_price_per_ping NUMERIC(14,2),
    parking_type        VARCHAR(50),
    parking_price       NUMERIC(14,2),
    notes               TEXT,
    published_at        TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
)`,

		`CREATE INDEX IF NOT EXISTS idx_sale_listing_property ON sale_listing (property_id)`,
		`CREATE INDEX IF NOT EXISTS idx_sale_listing_status   ON sale_listing (status)`,

		`
CREATE TABLE IF NOT EXISTS customer (
    id                              BIGSERIAL PRIMARY KEY,
    owner_user_id                   BIGINT       NOT NULL REFERENCES users(id),
    source_credential_submission_id BIGINT       UNIQUE REFERENCES credential_submissions(id),
    address                         TEXT         NOT NULL,
    deed_no                         VARCHAR(120) NOT NULL DEFAULT '',
    deed_hash                       VARCHAR(64)  NOT NULL DEFAULT '',
    property_statement_json         JSONB        NOT NULL DEFAULT '{}'::jsonb,
    warranty_answers_json           JSONB        NOT NULL DEFAULT '[]'::jsonb,
    disclosure_snapshot_json        JSONB        NOT NULL DEFAULT '{}'::jsonb,
    disclosure_hash                 VARCHAR(64)  NOT NULL DEFAULT '',
    verification_status             VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
    completeness_status             VARCHAR(30)  NOT NULL DEFAULT 'DISCLOSURE_REQUIRED',
    created_at                      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
)`,
		`ALTER TABLE listings
    ADD COLUMN IF NOT EXISTS draft_origin VARCHAR(20) NOT NULL DEFAULT 'MANUAL_CREATE',
    ADD COLUMN IF NOT EXISTS setup_status VARCHAR(20) NOT NULL DEFAULT 'READY',
    ADD COLUMN IF NOT EXISTS source_credential_submission_id BIGINT REFERENCES credential_submissions(id)`,
		`ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_list_type_check`,
		`ALTER TABLE listings
    ADD CONSTRAINT listings_list_type_check
    CHECK (list_type IN ('UNSET', 'RENT', 'SALE'))`,
		`ALTER TABLE listings ALTER COLUMN list_type SET DEFAULT 'UNSET'`,
		`ALTER TABLE listings ADD COLUMN IF NOT EXISTS property_id BIGINT REFERENCES customer(id)`,
		`CREATE INDEX IF NOT EXISTS idx_listings_property_id ON listings (property_id)`,
		`DROP INDEX IF EXISTS idx_listings_source_credential_submission_id`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_source_credential_submission_id
    ON listings (source_credential_submission_id)
    WHERE source_credential_submission_id IS NOT NULL`,
		`
CREATE TABLE IF NOT EXISTS listing_rent_details (
    id                         BIGSERIAL PRIMARY KEY,
    listing_id                 BIGINT        NOT NULL UNIQUE REFERENCES listings(id) ON DELETE CASCADE,
    monthly_rent               NUMERIC(14,2) NOT NULL DEFAULT 0,
    deposit_months             NUMERIC(4,1)  NOT NULL DEFAULT 0,
    management_fee_monthly     NUMERIC(14,2) NOT NULL DEFAULT 0,
    minimum_lease_months       INT           NOT NULL DEFAULT 0,
    can_register_household     BOOLEAN       NOT NULL DEFAULT FALSE,
    can_cook                   BOOLEAN       NOT NULL DEFAULT FALSE,
    rent_notes                 TEXT          NOT NULL DEFAULT '',
    created_at                 TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ   NOT NULL DEFAULT NOW()
)`,
		`CREATE INDEX IF NOT EXISTS idx_listing_rent_details_listing_id ON listing_rent_details (listing_id)`,
		`
CREATE TABLE IF NOT EXISTS listing_sale_details (
    id                         BIGSERIAL PRIMARY KEY,
    listing_id                 BIGINT        NOT NULL UNIQUE REFERENCES listings(id) ON DELETE CASCADE,
    sale_total_price           NUMERIC(14,2) NOT NULL DEFAULT 0,
    sale_unit_price_per_ping   NUMERIC(14,2),
    main_building_ping         NUMERIC(6,1),
    auxiliary_building_ping    NUMERIC(6,1),
    balcony_ping               NUMERIC(6,1),
    land_ping                  NUMERIC(8,2),
    parking_space_type         VARCHAR(50),
    parking_space_price        NUMERIC(14,2),
    sale_notes                 TEXT          NOT NULL DEFAULT '',
    created_at                 TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ   NOT NULL DEFAULT NOW()
)`,
		`CREATE INDEX IF NOT EXISTS idx_listing_sale_details_listing_id ON listing_sale_details (listing_id)`,
		`CREATE INDEX IF NOT EXISTS idx_taiwan_districts_county_sort ON taiwan_districts (county, sort_order)`,
		`DELETE FROM taiwan_districts WHERE county = '新北市' AND postal_code IN ('209', '210', '211', '212')`,
		`ALTER TABLE tenant_requirements
    ADD COLUMN IF NOT EXISTS area_min_ping NUMERIC(6,1),
    ADD COLUMN IF NOT EXISTS area_max_ping NUMERIC(6,1),
    ADD COLUMN IF NOT EXISTS room_min INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS bathroom_min INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS move_in_timeline TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS minimum_lease_months INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS can_cook_needed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS can_register_household_needed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS lifestyle_note TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS must_have_note TEXT NOT NULL DEFAULT ''`,
		`CREATE TABLE IF NOT EXISTS tenant_requirement_districts (
    id BIGSERIAL PRIMARY KEY,
    requirement_id BIGINT NOT NULL REFERENCES tenant_requirements(id) ON DELETE CASCADE,
    county VARCHAR(20) NOT NULL,
    district VARCHAR(30) NOT NULL,
    zip_code CHAR(3) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_requirement_districts UNIQUE (requirement_id, county, district, zip_code)
)`,
		`CREATE INDEX IF NOT EXISTS idx_tenant_requirement_districts_requirement_id
    ON tenant_requirement_districts (requirement_id)`,
		`CREATE INDEX IF NOT EXISTS idx_tenant_requirement_districts_location
    ON tenant_requirement_districts (county, district, zip_code)`,
		`INSERT INTO tenant_requirement_districts (requirement_id, county, district, zip_code)
    SELECT tr.id, td.county, td.district, td.postal_code
    FROM tenant_requirements tr
    JOIN taiwan_districts td ON td.district = tr.target_district
    WHERE tr.target_district <> ''
      AND NOT EXISTS (
        SELECT 1 FROM tenant_requirement_districts existing
        WHERE existing.requirement_id = tr.id
      )`,
	}

	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			return fmt.Errorf("ensure schema: %w", err)
		}
	}

	for i, row := range taiwanDistrictSeed {
		if _, err := db.Exec(`
INSERT INTO taiwan_districts (county, district, postal_code, sort_order)
VALUES ($1, $2, $3, $4)
ON CONFLICT (county, district, postal_code) DO UPDATE SET
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW()`,
			row.County, row.District, row.PostalCode, i+1,
		); err != nil {
			return fmt.Errorf("ensure schema seed taiwan district %s %s: %w", row.County, row.District, err)
		}
	}

	return nil
}
