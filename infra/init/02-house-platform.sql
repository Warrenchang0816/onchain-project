-- ============================================================
-- House Platform Core Schema
-- Current scope: account identity only.
--
-- This file intentionally keeps only the users table used by the
-- live auth + onboarding + KYC flow. Property/listing/case tables
-- were removed because they are not wired into the current backend
-- or frontend data path yet.
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id                    BIGSERIAL    PRIMARY KEY,
    wallet_address        VARCHAR(255) NOT NULL UNIQUE,
    kyc_status            VARCHAR(20)  NOT NULL DEFAULT 'UNVERIFIED',
    identity_hash         VARCHAR(64)  DEFAULT NULL,
    identity_nft_token_id BIGINT       DEFAULT NULL,
    kyc_mint_tx_hash      VARCHAR(128) DEFAULT NULL,
    kyc_submitted_at      TIMESTAMPTZ  DEFAULT NULL,
    kyc_verified_at       TIMESTAMPTZ  DEFAULT NULL,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_wallet_address
    ON users (wallet_address);

CREATE INDEX IF NOT EXISTS idx_users_kyc_status
    ON users (kyc_status);

CREATE INDEX IF NOT EXISTS idx_users_identity_hash
    ON users (identity_hash);


CREATE TABLE IF NOT EXISTS indexer_checkpoints (
    contract_name        VARCHAR(64) PRIMARY KEY,
    last_processed_block BIGINT      NOT NULL DEFAULT 0,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO indexer_checkpoints (contract_name, last_processed_block)
VALUES
    ('IdentityNFT', 0)
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
