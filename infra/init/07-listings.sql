-- ============================================================
-- 房源媒合平台 — Listings Schema
-- Phase 2：listings（房源）與 listing_appointments（預約看房）
--
-- 執行時機：Docker Volume 首次初始化時自動執行（僅一次）。
-- 手動執行：psql -h localhost -U postgres -d TASK -f 07-listings.sql
-- 更新日期：2026-04-19
-- ============================================================


-- ------------------------------------------------------------
-- listings（房源）
-- 規則：
--   - owner_user_id 須為 kyc_status = VERIFIED 的使用者
--   - status 狀態機：
--       DRAFT → ACTIVE → NEGOTIATING → LOCKED → SIGNING → CLOSED
--       任何狀態 → REMOVED（屋主下架）
--       任何狀態 → EXPIRED（自動到期）
--       任何狀態 → SUSPENDED（平台停權）
--   - negotiating_appointment_id：屋主手動鎖定洽談中的那組預約；
--     NULL 表示未鎖定
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS listings (
    id                          BIGSERIAL       PRIMARY KEY,
    owner_user_id               BIGINT          NOT NULL REFERENCES users(id),

    -- 基本資訊
    title                       VARCHAR(200)    NOT NULL,
    description                 TEXT,
    address                     TEXT            NOT NULL,
    district                    VARCHAR(50),            -- 例：台北市大安區

    -- 房源類型與條件
    list_type                   VARCHAR(10)     NOT NULL CHECK (list_type IN ('RENT', 'SALE')),
    price                       NUMERIC(14,2)   NOT NULL,
    area_ping                   NUMERIC(6,1),           -- 坪數
    floor                       INT,
    total_floors                INT,
    room_count                  INT,
    bathroom_count              INT,
    is_pet_allowed              BOOLEAN         NOT NULL DEFAULT FALSE,
    is_parking_included         BOOLEAN         NOT NULL DEFAULT FALSE,

    -- 狀態機
    -- DRAFT | ACTIVE | NEGOTIATING | LOCKED | SIGNING | CLOSED | EXPIRED | REMOVED | SUSPENDED
    status                      VARCHAR(20)     NOT NULL DEFAULT 'DRAFT',

    -- 洽談鎖定（屋主手動；FK 在下方補入，避免循環依賴）
    negotiating_appointment_id  BIGINT,

    -- 上架費用（NT$/天）
    daily_fee_ntd               NUMERIC(8,2)    NOT NULL DEFAULT 40,

    -- 時間
    published_at                TIMESTAMPTZ,
    expires_at                  TIMESTAMPTZ,            -- ACTIVE 時計算，到期自動轉 EXPIRED
    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listings_owner_user_id
    ON listings (owner_user_id);

CREATE INDEX IF NOT EXISTS idx_listings_status
    ON listings (status);

CREATE INDEX IF NOT EXISTS idx_listings_list_type
    ON listings (list_type);

CREATE INDEX IF NOT EXISTS idx_listings_district
    ON listings (district);


-- ------------------------------------------------------------
-- listing_appointments（預約看房）
-- 規則：
--   - visitor_user_id 須為 kyc_status = VERIFIED 的使用者
--   - queue_position：同 listing 內依 created_at 順序指派，從 1 開始
--   - status 流轉：
--       PENDING → CONFIRMED（屋主確認時段）
--       CONFIRMED → VIEWED（訪客看完後更新）
--       VIEWED → INTERESTED（訪客有意願）
--       任何狀態 → CANCELLED（雙方皆可）
--   - 不鎖定預約順序：所有人皆可預約，隊列公開可見
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS listing_appointments (
    id              BIGSERIAL       PRIMARY KEY,
    listing_id      BIGINT          NOT NULL REFERENCES listings(id),
    visitor_user_id BIGINT          NOT NULL REFERENCES users(id),

    queue_position  INT             NOT NULL,   -- 此 listing 的預約序號（建立時 +1）
    preferred_time  TIMESTAMPTZ     NOT NULL,   -- 訪客希望的看房時間
    confirmed_time  TIMESTAMPTZ,               -- 屋主確認的實際時段

    -- PENDING | CONFIRMED | VIEWED | INTERESTED | CANCELLED
    status          VARCHAR(20)     NOT NULL DEFAULT 'PENDING',

    note            TEXT,                       -- 訪客留言給屋主

    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- 同一 listing 同一位訪客只能有一筆 active 預約
    CONSTRAINT uq_listing_visitor UNIQUE (listing_id, visitor_user_id)
);

CREATE INDEX IF NOT EXISTS idx_listing_appointments_listing_id
    ON listing_appointments (listing_id);

CREATE INDEX IF NOT EXISTS idx_listing_appointments_visitor_user_id
    ON listing_appointments (visitor_user_id);

CREATE INDEX IF NOT EXISTS idx_listing_appointments_status
    ON listing_appointments (status);


-- ------------------------------------------------------------
-- listings.negotiating_appointment_id → listing_appointments.id
-- 必須在兩張表都建好後才能加 FK（避免循環依賴）
-- ------------------------------------------------------------
ALTER TABLE listings
    ADD CONSTRAINT fk_listings_negotiating_appointment
    FOREIGN KEY (negotiating_appointment_id)
    REFERENCES listing_appointments(id)
    DEFERRABLE INITIALLY DEFERRED;
