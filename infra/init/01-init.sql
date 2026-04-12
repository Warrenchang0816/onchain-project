-- ============================================================
-- Onchain Task Tracker — PostgreSQL Schema
-- DB: TASK
--
-- 執行時機：Docker Volume 首次初始化時自動執行（僅一次）。
-- 若 Volume 已存在，本腳本不會重複執行。
-- 手動重建：docker compose down -v && docker compose up -d
--
-- 欄位定義依據：go-service/internal/repository/*.go 的 SQL 查詢
-- 更新日期：2026-04-03
-- ============================================================


-- ------------------------------------------------------------
-- tasks
-- 對應：task_repository.go
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
    id                      BIGSERIAL       PRIMARY KEY,
    task_id                 VARCHAR(64)     NOT NULL UNIQUE,
    wallet_address          VARCHAR(255)    NOT NULL,
    assignee_wallet_address VARCHAR(64)     DEFAULT NULL,
    title                   VARCHAR(255)    NOT NULL,
    description             TEXT            NOT NULL DEFAULT '',
    status                  VARCHAR(50)     NOT NULL DEFAULT 'OPEN',
    priority                VARCHAR(50)     NOT NULL DEFAULT 'MEDIUM',
    reward_amount           NUMERIC(20, 8)  NOT NULL DEFAULT 0,
    fee_bps                 INTEGER         NOT NULL DEFAULT 500,
    chain_id                BIGINT          DEFAULT NULL,
    vault_contract_address  VARCHAR(128)    DEFAULT NULL,
    contract_task_id        VARCHAR(128)    DEFAULT NULL,
    onchain_status          VARCHAR(32)     NOT NULL DEFAULT 'NOT_FUNDED',
    fund_tx_hash            VARCHAR(128)    DEFAULT NULL,
    approve_tx_hash         VARCHAR(128)    DEFAULT NULL,
    claim_tx_hash           VARCHAR(128)    DEFAULT NULL,
    cancel_tx_hash          VARCHAR(128)    DEFAULT NULL,
    due_date                TIMESTAMPTZ     DEFAULT NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_wallet_address
    ON tasks (wallet_address);

CREATE INDEX IF NOT EXISTS idx_tasks_status
    ON tasks (status);

CREATE INDEX IF NOT EXISTS idx_tasks_onchain_status
    ON tasks (onchain_status);


-- ------------------------------------------------------------
-- task_submissions
-- 對應：handler/task_handler.go SubmitTask（POST /tasks/:id/submissions）
-- 前端送出欄位：resultContent、resultFileUrl、resultHash
-- Phase 4 Blueprint：task_submissions table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_submissions (
    id              BIGSERIAL       PRIMARY KEY,
    task_id         BIGINT          NOT NULL REFERENCES tasks (id),
    result_content  TEXT            NOT NULL DEFAULT '',
    result_file_url VARCHAR(512)    DEFAULT NULL,
    result_hash     VARCHAR(128)    DEFAULT NULL,
    submitted_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_submissions_task_id
    ON task_submissions (task_id);


-- ------------------------------------------------------------
-- auth_nonce
-- 對應：repository/nonce_repository.go
--
-- 注意：Create() 不插入 issued_at，依賴此欄位的 DEFAULT NOW()。
--       FindLatestByWalletAddress() 會讀取 issued_at，
--       因此 DEFAULT 必須存在，否則查詢結果為 NULL。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_nonce (
    id              BIGSERIAL       PRIMARY KEY,
    wallet_address  VARCHAR(255)    NOT NULL,
    nonce           VARCHAR(255)    NOT NULL,
    issued_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    expired_at      TIMESTAMPTZ     NOT NULL,
    used            BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_nonce_wallet_address
    ON auth_nonce (wallet_address);


-- ------------------------------------------------------------
-- wallet_session
-- 對應：repository/session_repository.go
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wallet_session (
    id              BIGSERIAL       PRIMARY KEY,
    session_token   VARCHAR(128)    NOT NULL UNIQUE,
    wallet_address  VARCHAR(255)    NOT NULL,
    chain_id        VARCHAR(32)     NOT NULL,
    expired_at      TIMESTAMPTZ     NOT NULL,
    revoked         BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_session_wallet_address
    ON wallet_session (wallet_address);
