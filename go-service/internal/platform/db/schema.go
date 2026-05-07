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
		`
CREATE TABLE IF NOT EXISTS properties (
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
		`ALTER TABLE listings ADD COLUMN IF NOT EXISTS property_id BIGINT REFERENCES properties(id)`,
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
