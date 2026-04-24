-- Phase 3: role workbench foundation
-- Adds OWNER bootstrap-draft metadata plus TENANT / AGENT profile tables.

ALTER TABLE listings
    ADD COLUMN IF NOT EXISTS draft_origin VARCHAR(20) NOT NULL DEFAULT 'MANUAL_CREATE',
    ADD COLUMN IF NOT EXISTS setup_status VARCHAR(20) NOT NULL DEFAULT 'READY',
    ADD COLUMN IF NOT EXISTS source_credential_submission_id BIGINT REFERENCES credential_submissions(id);

ALTER TABLE listings
    DROP CONSTRAINT IF EXISTS listings_list_type_check;

ALTER TABLE listings
    ADD CONSTRAINT listings_list_type_check
    CHECK (list_type IN ('UNSET', 'RENT', 'SALE'));

ALTER TABLE listings
    ALTER COLUMN list_type SET DEFAULT 'UNSET';

CREATE INDEX IF NOT EXISTS idx_listings_source_credential_submission_id
    ON listings (source_credential_submission_id);

CREATE TABLE IF NOT EXISTS tenant_profiles (
    id                   BIGSERIAL PRIMARY KEY,
    user_id              BIGINT      NOT NULL UNIQUE REFERENCES users(id),
    occupation_type      VARCHAR(50) NOT NULL DEFAULT '',
    org_name             VARCHAR(120) NOT NULL DEFAULT '',
    income_range         VARCHAR(50) NOT NULL DEFAULT '',
    household_size       INT         NOT NULL DEFAULT 0,
    co_resident_note     TEXT        NOT NULL DEFAULT '',
    move_in_timeline     VARCHAR(80) NOT NULL DEFAULT '',
    additional_note      TEXT        NOT NULL DEFAULT '',
    advanced_data_status VARCHAR(20) NOT NULL DEFAULT 'BASIC',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_profile_documents (
    id                BIGSERIAL PRIMARY KEY,
    tenant_profile_id BIGINT      NOT NULL REFERENCES tenant_profiles(id) ON DELETE CASCADE,
    doc_type          VARCHAR(30) NOT NULL,
    file_path         VARCHAR(512) NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_profile_documents_profile_id
    ON tenant_profile_documents (tenant_profile_id);

CREATE TABLE IF NOT EXISTS tenant_requirements (
    id                   BIGSERIAL PRIMARY KEY,
    user_id              BIGINT          NOT NULL REFERENCES users(id),
    target_district      VARCHAR(80)     NOT NULL DEFAULT '',
    budget_min           NUMERIC(14,2)   NOT NULL DEFAULT 0,
    budget_max           NUMERIC(14,2)   NOT NULL DEFAULT 0,
    layout_note          TEXT            NOT NULL DEFAULT '',
    move_in_date         DATE,
    pet_friendly_needed  BOOLEAN         NOT NULL DEFAULT FALSE,
    parking_needed       BOOLEAN         NOT NULL DEFAULT FALSE,
    status               VARCHAR(20)     NOT NULL DEFAULT 'OPEN',
    created_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_requirements_user_id
    ON tenant_requirements (user_id);

CREATE INDEX IF NOT EXISTS idx_tenant_requirements_status
    ON tenant_requirements (status);

CREATE INDEX IF NOT EXISTS idx_tenant_requirements_target_district
    ON tenant_requirements (target_district);

CREATE TABLE IF NOT EXISTS agent_profiles (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT          NOT NULL UNIQUE REFERENCES users(id),
    headline            VARCHAR(160)    NOT NULL DEFAULT '',
    bio                 TEXT            NOT NULL DEFAULT '',
    service_areas_json  JSONB           NOT NULL DEFAULT '[]'::jsonb,
    license_note        TEXT            NOT NULL DEFAULT '',
    contact_preferences TEXT            NOT NULL DEFAULT '',
    is_profile_complete BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
