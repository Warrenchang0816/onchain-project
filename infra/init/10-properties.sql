-- Gate 2: 房屋物件與揭露主線

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
    updated_at                      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT properties_verification_status_check
        CHECK (verification_status IN ('DRAFT', 'VERIFIED', 'REJECTED')),
    CONSTRAINT properties_completeness_status_check
        CHECK (completeness_status IN (
            'BASIC_CREATED',
            'DISCLOSURE_REQUIRED',
            'WARRANTY_REQUIRED',
            'SNAPSHOT_READY',
            'READY_FOR_LISTING'
        ))
);

CREATE INDEX IF NOT EXISTS idx_properties_owner_user_id
    ON properties (owner_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_deed_hash
    ON properties (deed_hash)
    WHERE deed_hash <> '';

CREATE INDEX IF NOT EXISTS idx_properties_verification_status
    ON properties (verification_status);

CREATE INDEX IF NOT EXISTS idx_properties_completeness_status
    ON properties (completeness_status);

ALTER TABLE listings
    ADD COLUMN IF NOT EXISTS property_id BIGINT REFERENCES properties(id);

CREATE INDEX IF NOT EXISTS idx_listings_property_id
    ON listings (property_id);
