-- ============================================================
-- 2026-04-16 schema cleanup
-- Purpose:
-- 1. Remove unused house-platform tables that are not wired yet.
-- 2. Shrink users to the live identity/auth footprint.
-- 3. Add missing task_blockchain_logs table.
-- 4. Ensure indexer tables exist for the active IdentityNFT worker.
-- ============================================================

BEGIN;

DROP TABLE IF EXISTS case_events;
DROP TABLE IF EXISTS cases;
DROP TABLE IF EXISTS tenant_demands;
DROP TABLE IF EXISTS listing_views;
DROP TABLE IF EXISTS listings;
DROP TABLE IF EXISTS agent_profiles;
DROP TABLE IF EXISTS property_authorizations;
DROP TABLE IF EXISTS property_owners;
DROP TABLE IF EXISTS properties;

ALTER TABLE users
    DROP COLUMN IF EXISTS role,
    DROP COLUMN IF EXISTS kyc_provider,
    DROP COLUMN IF EXISTS kyc_reference_id,
    DROP COLUMN IF EXISTS occupation,
    DROP COLUMN IF EXISTS income_range,
    DROP COLUMN IF EXISTS family_status,
    DROP COLUMN IF EXISTS household_size,
    DROP COLUMN IF EXISTS profile_completed,
    DROP COLUMN IF EXISTS agent_license_no,
    DROP COLUMN IF EXISTS agent_company,
    DROP COLUMN IF EXISTS agent_brand;

CREATE TABLE IF NOT EXISTS task_blockchain_logs (
    id                  BIGSERIAL       PRIMARY KEY,
    task_id             VARCHAR(64)     NOT NULL REFERENCES tasks (task_id),
    action              VARCHAR(50)     NOT NULL,
    tx_hash             VARCHAR(128)    NOT NULL,
    chain_id            BIGINT          NOT NULL,
    contract_address    VARCHAR(128)    NOT NULL,
    status              VARCHAR(32)     NOT NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_blockchain_logs_task_id
    ON task_blockchain_logs (task_id);

CREATE INDEX IF NOT EXISTS idx_task_blockchain_logs_tx_hash
    ON task_blockchain_logs (tx_hash);

CREATE TABLE IF NOT EXISTS indexer_checkpoints (
    contract_name        VARCHAR(64) PRIMARY KEY,
    last_processed_block BIGINT      NOT NULL DEFAULT 0,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO indexer_checkpoints (contract_name, last_processed_block)
VALUES ('IdentityNFT', 0)
ON CONFLICT (contract_name) DO NOTHING;

CREATE TABLE IF NOT EXISTS processed_events (
    tx_hash       VARCHAR(128) NOT NULL,
    log_index     INT          NOT NULL,
    contract_name VARCHAR(64)  NOT NULL,
    event_name    VARCHAR(64)  NOT NULL,
    block_number  BIGINT       NOT NULL,
    processed_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_processed_events_block
    ON processed_events (block_number);

CREATE INDEX IF NOT EXISTS idx_processed_events_contract
    ON processed_events (contract_name);

COMMIT;
