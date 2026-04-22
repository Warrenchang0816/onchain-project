-- ============================================================
-- Onboarding v2: KYC-first flow
-- ============================================================

-- 1. users expansion
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE,
    ADD COLUMN IF NOT EXISTS phone VARCHAR(20) UNIQUE,
    ADD COLUMN IF NOT EXISTS display_name VARCHAR(100) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS person_hash VARCHAR(64) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone);
CREATE INDEX IF NOT EXISTS idx_users_person_hash ON users (person_hash);

-- 2. kyc_sessions
CREATE TABLE IF NOT EXISTS kyc_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    email VARCHAR(255) DEFAULT NULL,
    phone VARCHAR(20) DEFAULT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,

    person_hash VARCHAR(64) DEFAULT NULL,
    ocr_id_number TEXT DEFAULT NULL,
    confirmed_name VARCHAR(100) DEFAULT NULL,
    confirmed_birth_date VARCHAR(20) DEFAULT NULL,
    ocr_address VARCHAR(255) DEFAULT NULL,
    ocr_id_number_hint VARCHAR(10) DEFAULT NULL,
    ocr_gender TEXT DEFAULT NULL,
    ocr_issue_date TEXT DEFAULT NULL,
    ocr_issue_location TEXT DEFAULT NULL,
    ocr_father_name TEXT DEFAULT NULL,
    ocr_mother_name TEXT DEFAULT NULL,

    id_front_path VARCHAR(512) DEFAULT NULL,
    id_back_path VARCHAR(512) DEFAULT NULL,
    selfie_path VARCHAR(512) DEFAULT NULL,
    second_doc_path VARCHAR(512) DEFAULT NULL,

    face_match_score NUMERIC(5,2) DEFAULT NULL,
    ocr_success BOOLEAN NOT NULL DEFAULT FALSE,

    step VARCHAR(30) NOT NULL DEFAULT 'STARTED',
    bound_user_id BIGINT DEFAULT NULL REFERENCES users(id),

    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyc_sessions_email ON kyc_sessions (email);
CREATE INDEX IF NOT EXISTS idx_kyc_sessions_expires ON kyc_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_kyc_sessions_person_hash ON kyc_sessions (person_hash);
CREATE INDEX IF NOT EXISTS idx_kyc_sessions_step ON kyc_sessions (step);

-- 3. otp_codes
CREATE TABLE IF NOT EXISTS otp_codes (
    id BIGSERIAL PRIMARY KEY,
    target VARCHAR(255) NOT NULL,
    channel VARCHAR(10) NOT NULL,
    code VARCHAR(6) NOT NULL,
    session_id UUID DEFAULT NULL REFERENCES kyc_sessions(id),
    used BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_target ON otp_codes (target, channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes (expires_at);

-- 4. user_credentials
CREATE TABLE IF NOT EXISTS user_credentials (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    credential_type VARCHAR(20) NOT NULL,

    doc_path VARCHAR(512) DEFAULT NULL,

    review_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    reviewer_note TEXT NOT NULL DEFAULT '',
    reviewed_by_wallet VARCHAR(255) DEFAULT NULL,
    revoked_at TIMESTAMPTZ DEFAULT NULL,
    revoked_reason TEXT NOT NULL DEFAULT '',

    nft_token_id INT DEFAULT NULL,
    tx_hash VARCHAR(66) DEFAULT NULL,

    verified_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, credential_type)
);

ALTER TABLE user_credentials
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS revoked_reason TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_user_creds_user ON user_credentials (user_id);
CREATE INDEX IF NOT EXISTS idx_user_creds_type ON user_credentials (credential_type);
CREATE INDEX IF NOT EXISTS idx_user_creds_status ON user_credentials (review_status);
