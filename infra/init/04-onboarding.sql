-- ============================================================
-- Onboarding v2：KYC-first 入場流程
--
-- 新增：
--   1. users 表擴充（email / phone / person_hash）
--   2. kyc_sessions（KYC 暫存 session，綁錢包前的臨時狀態）
--   3. otp_codes（Email / SMS 驗證碼）
--   4. user_credentials（多角色 NFT 憑證：屋主 / 租客 / 仲介）
--
-- 執行方式：
--   Volume 已存在 → pgcli 直接執行本檔
--   全新啟動     → docker compose down -v && docker compose up -d
--
-- 更新日期：2026-04-15
-- ============================================================


-- ------------------------------------------------------------
-- 1. users 表擴充
--
-- person_hash  = SHA-256(id_number) — 個人唯一值，KYC 時計算
--   UNIQUE 確保一人僅能有一個帳號（無論綁定哪個錢包）
-- identity_hash（原有）= SHA-256(person_hash + lower(wallet_address))
--   在綁定錢包時計算，存入鏈上 SBT
-- ------------------------------------------------------------
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email           VARCHAR(255) UNIQUE,
    ADD COLUMN IF NOT EXISTS phone           VARCHAR(20)  UNIQUE,
    ADD COLUMN IF NOT EXISTS display_name    VARCHAR(100) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS email_verified  BOOLEAN      NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS phone_verified  BOOLEAN      NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS person_hash     VARCHAR(64)  UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_email       ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_phone       ON users (phone);
CREATE INDEX IF NOT EXISTS idx_users_person_hash ON users (person_hash);


-- ------------------------------------------------------------
-- 2. kyc_sessions（KYC 暫存 session）
--
-- 使用者完成 email/phone OTP 驗證後建立，TTL 30 分鐘。
-- 存放：
--   - 已驗證的 email / phone
--   - OCR 提取並由使用者確認的個人資料
--   - person_hash（SHA-256(id_number)）—唯一性檢查
--   - MinIO 圖片路徑（格式：kyc/session/{session_id}/...）
--   - 人臉比對結果
-- 錢包綁定完成後，此 session 不刪除（保留稽核軌跡）。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kyc_sessions (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 聯繫資訊（均已通過 OTP 驗證）
    email               VARCHAR(255) DEFAULT NULL,
    phone               VARCHAR(20)  DEFAULT NULL,
    email_verified      BOOLEAN      NOT NULL DEFAULT FALSE,
    phone_verified      BOOLEAN      NOT NULL DEFAULT FALSE,

    -- OCR 結果（使用者確認後的版本）
    person_hash         VARCHAR(64)  DEFAULT NULL,  -- SHA-256(id_number)，唯一性保證
    confirmed_name      VARCHAR(100) DEFAULT NULL,  -- 使用者確認/修正後的姓名
    confirmed_birth_date VARCHAR(20) DEFAULT NULL,
    ocr_address         VARCHAR(255) DEFAULT NULL,
    ocr_id_number_hint  VARCHAR(10)  DEFAULT NULL,  -- 身份證號末4碼，僅供 UX 顯示

    -- MinIO object paths（格式：kyc/session/{id}/...）
    id_front_path       VARCHAR(512) DEFAULT NULL,
    id_back_path        VARCHAR(512) DEFAULT NULL,
    selfie_path         VARCHAR(512) DEFAULT NULL,
    second_doc_path     VARCHAR(512) DEFAULT NULL,  -- 第二證件（備份用）

    -- AI 驗證結果
    face_match_score    NUMERIC(5,2) DEFAULT NULL,
    ocr_success         BOOLEAN      NOT NULL DEFAULT FALSE,

    -- 流程狀態
    -- STARTED → EMAIL_VERIFIED → PHONE_VERIFIED → OCR_DONE → CONFIRMED → WALLET_BOUND
    step                VARCHAR(30)  NOT NULL DEFAULT 'STARTED',

    -- 綁定後關聯
    bound_user_id       BIGINT       DEFAULT NULL REFERENCES users(id),

    expires_at          TIMESTAMPTZ  NOT NULL,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyc_sessions_email       ON kyc_sessions (email);
CREATE INDEX IF NOT EXISTS idx_kyc_sessions_expires     ON kyc_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_kyc_sessions_person_hash ON kyc_sessions (person_hash);
CREATE INDEX IF NOT EXISTS idx_kyc_sessions_step        ON kyc_sessions (step);


-- ------------------------------------------------------------
-- 3. otp_codes（Email / SMS 驗證碼）
--
-- target  = email 地址 或 手機號碼
-- channel = 'email' 或 'sms'
-- 頻率限制由 application layer 控制（同 target 60 秒內限 1 次）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS otp_codes (
    id          BIGSERIAL    PRIMARY KEY,
    target      VARCHAR(255) NOT NULL,   -- email 或 phone
    channel     VARCHAR(10)  NOT NULL,   -- 'email' | 'sms'
    code        VARCHAR(6)   NOT NULL,
    session_id  UUID         DEFAULT NULL REFERENCES kyc_sessions(id),
    used        BOOLEAN      NOT NULL DEFAULT FALSE,
    expires_at  TIMESTAMPTZ  NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_target  ON otp_codes (target, channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes (expires_at);


-- ------------------------------------------------------------
-- 4. user_credentials（多角色 NFT 憑證）
--
-- credential_type：OWNER（屋主）/ TENANT（租客）/ AGENT（仲介）
-- 對應 ERC-1155 tokenId：OWNER=2, TENANT=3, AGENT=4
--   （自然人 tokenId=1 存在 users.identity_nft_token_id）
-- doc_path：上傳的證明文件（MinIO 路徑）
-- review_status：PENDING → VERIFIED / REJECTED
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_credentials (
    id                  BIGSERIAL    PRIMARY KEY,
    user_id             BIGINT       NOT NULL REFERENCES users(id),
    credential_type     VARCHAR(20)  NOT NULL,
    -- OWNER | TENANT | AGENT

    -- 文件存證
    doc_path            VARCHAR(512) DEFAULT NULL,  -- MinIO 路徑

    -- 審核
    review_status       VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    -- PENDING | VERIFIED | REJECTED
    reviewer_note       TEXT         NOT NULL DEFAULT '',
    reviewed_by_wallet  VARCHAR(255) DEFAULT NULL,

    -- 鏈上憑證
    nft_token_id        INT          DEFAULT NULL,
    tx_hash             VARCHAR(66)  DEFAULT NULL,

    verified_at         TIMESTAMPTZ  DEFAULT NULL,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, credential_type)
);

CREATE INDEX IF NOT EXISTS idx_user_creds_user   ON user_credentials (user_id);
CREATE INDEX IF NOT EXISTS idx_user_creds_type   ON user_credentials (credential_type);
CREATE INDEX IF NOT EXISTS idx_user_creds_status ON user_credentials (review_status);
