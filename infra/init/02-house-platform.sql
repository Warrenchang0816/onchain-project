-- ============================================================
-- 可信房屋媒合平台 — PostgreSQL Schema（On-chain First）
-- DB: TASK
--
-- 設計原則：
--   - 合約為主體（Source of Truth）
--   - DB 為索引、查詢、文件存放與後台審核輔助層
--   - 每個核心狀態皆保留 onchain_tx_hash 對應鏈上記錄
--
-- 依賴：01-init.sql（auth_nonce、wallet_session 已存在）
-- 執行方式：
--   首次啟動 → docker compose down -v && docker compose up -d
--   Volume 已存在 → pgcli 直接執行本檔
--
-- 更新日期：2026-04-13
-- ============================================================


-- ------------------------------------------------------------
-- users（身份與 KYC）
-- 對應合約：IdentityNFT.sol
--
-- 設計原則（TWID 整合，不自建 KYC）：
--   - 平台不儲存敏感個資（無身分證號碼、無姓名）
--   - KYC 委由第三方身份驗證（第一階段：TWID）
--   - 僅保存驗證結果、provider reference 與鏈上憑證資訊
--   - kyc_reference_id = TWID 回傳的參考識別碼（UNIQUE，確保一人一帳號）
--   - identity_hash = platform 端計算的 hash（不含原始個資）
--   - identity_nft_token_id = IdentityNFT.sol 的 SBT tokenId
--
-- 自然人畫像欄位（occupation / income_range / family_status）：
--   - KYC 完成後由使用者自填，用於平台數據統計與媒合推薦
--   - 不與身分證資訊綁定，屬使用者自申報
--   - profile_completed = TRUE 後才納入統計與推播
--
-- role：USER（一般）/ OWNER（強驗證屋主）/ AGENT（仲介）
-- AGENT 欄位由後台另行審核填入
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id                      BIGSERIAL       PRIMARY KEY,
    wallet_address          VARCHAR(255)    NOT NULL UNIQUE,    -- SIWE 登入主鍵
    role                    VARCHAR(20)     NOT NULL DEFAULT 'USER',
    -- USER | OWNER | AGENT

    -- KYC（第三方驗證結果，不存原始個資）
    kyc_status              VARCHAR(20)     NOT NULL DEFAULT 'UNVERIFIED',
    -- UNVERIFIED | PENDING | VERIFIED | REJECTED
    kyc_provider            VARCHAR(50)     DEFAULT NULL,       -- 第一階段：TWID
    kyc_reference_id        VARCHAR(255)    UNIQUE,             -- provider 回傳的參考識別碼，UNIQUE 確保一人一帳號
    identity_hash           VARCHAR(64)     DEFAULT NULL,       -- platform 計算之 hash（不含原始資料）

    -- 鏈上 SBT 憑證（IdentityNFT）
    identity_nft_token_id   BIGINT          DEFAULT NULL,       -- IdentityNFT.sol tokenId
    kyc_mint_tx_hash        VARCHAR(128)    DEFAULT NULL,       -- mint SBT 的 tx hash

    -- 自然人畫像（使用者自填，KYC 完成後可填寫，用於媒合推薦與數據統計）
    occupation              VARCHAR(100)    DEFAULT NULL,       -- 職業（自由填寫）
    income_range            VARCHAR(30)     DEFAULT NULL,
    -- UNDER_30K | 30K_60K | 60K_100K | 100K_200K | OVER_200K（月收入區間，萬/月）
    family_status           VARCHAR(30)     DEFAULT NULL,
    -- SINGLE | COUPLE | FAMILY_WITH_CHILD | MULTI_GEN | OTHER
    household_size          SMALLINT        DEFAULT NULL,       -- 同住人數（含自己）
    profile_completed       BOOLEAN         NOT NULL DEFAULT FALSE,
    -- 自然人畫像是否已完整填寫（完成後才納入媒合推薦與數據統計）

    -- AGENT 專用欄位
    agent_license_no        VARCHAR(100)    DEFAULT NULL,       -- 不動產營業員 / 經紀人執照號碼
    agent_company           VARCHAR(255)    DEFAULT NULL,
    agent_brand             VARCHAR(255)    DEFAULT NULL,

    -- 時間戳
    kyc_submitted_at        TIMESTAMPTZ     DEFAULT NULL,
    kyc_verified_at         TIMESTAMPTZ     DEFAULT NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_wallet         ON users (wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_kyc_ref        ON users (kyc_reference_id);
CREATE INDEX IF NOT EXISTS idx_users_kyc_status     ON users (kyc_status);
CREATE INDEX IF NOT EXISTS idx_users_role           ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_profile        ON users (profile_completed);


-- ------------------------------------------------------------
-- properties（房屋物件）
-- 對應合約：PropertyRegistry.sol
--
-- 設計：
--   - deed_hash = SHA-256(產權文件)，鏈上 / 鏈下雙重 UNIQUE
--   - disclosure_* = 揭露義務欄位（未完成揭露不可上架）
--   - disclosure_hash = SHA-256(揭露資料)，上鏈存證
--   - 格局 / 家電 / 水電 / 寵物等出租頁面細項一併儲存
--   - property_tx_hash：鏈上 registerProperty tx
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS properties (
    id                      BIGSERIAL       PRIMARY KEY,
    property_id             VARCHAR(64)     NOT NULL UNIQUE,
    title                   VARCHAR(255)    NOT NULL,
    description             TEXT            NOT NULL DEFAULT '',
    address                 VARCHAR(255)    NOT NULL,           -- 依物件認證固定，不可由屋主自改
    city                    VARCHAR(64)     NOT NULL DEFAULT '',
    district                VARCHAR(64)     NOT NULL DEFAULT '',
    property_type           VARCHAR(32)     NOT NULL DEFAULT 'APARTMENT',
    -- APARTMENT | HOUSE | OFFICE | STUDIO | LAND

    -- 物件規格
    area_sqm                NUMERIC(10, 2)  NOT NULL DEFAULT 0, -- 室內坪數（平方公尺）
    floor                   SMALLINT        DEFAULT NULL,       -- 所在樓層
    total_floors            SMALLINT        DEFAULT NULL,       -- 總樓層數
    bedroom_count           SMALLINT        DEFAULT NULL,       -- 房數
    living_room_count       SMALLINT        DEFAULT NULL,       -- 廳數
    bathroom_count          SMALLINT        DEFAULT NULL,       -- 衛浴數
    balcony_count           SMALLINT        NOT NULL DEFAULT 0, -- 陽台數

    -- 家電 / 傢俱（JSON 物件，key = 品項名稱，value = 是否提供）
    -- 例：{"冷氣": true, "洗衣機": true, "冰箱": false, "床": true, "沙發": false}
    appliances              JSONB           NOT NULL DEFAULT '{}',

    -- 水電費計算方式
    utility_type            VARCHAR(30)     DEFAULT NULL,
    -- SELF_PAY（自付）| MANAGED（代管固定費）| RATIO（按比例分攤）
    utility_notes           TEXT            NOT NULL DEFAULT '', -- 水電費說明（如：每度電 X 元）

    -- 其他條件
    pet_allowed             BOOLEAN         DEFAULT NULL,       -- 可養寵物（NULL=未說明）
    parking_included        BOOLEAN         NOT NULL DEFAULT FALSE, -- 含車位
    management_fee          NUMERIC(10, 2)  NOT NULL DEFAULT 0, -- 管理費（月）

    -- 定價
    asking_price            NUMERIC(20, 8)  DEFAULT NULL,       -- 售價
    asking_rent             NUMERIC(20, 8)  DEFAULT NULL,       -- 月租

    -- 產權文件
    deed_document_url       VARCHAR(512)    DEFAULT NULL,
    deed_hash               VARCHAR(64)     UNIQUE,             -- SHA-256(產權文件)

    -- 揭露義務（依財產說明書規格，未完成不可刊登）
    disclosure_is_haunted   BOOLEAN         DEFAULT NULL,       -- 是否凶宅
    disclosure_has_leak     BOOLEAN         DEFAULT NULL,       -- 是否漏水
    disclosure_has_dispute  BOOLEAN         DEFAULT NULL,       -- 是否有重大糾紛
    disclosure_is_occupied  BOOLEAN         DEFAULT NULL,       -- 是否有人居住 / 現有租約
    disclosure_has_mortgage BOOLEAN         DEFAULT NULL,       -- 是否有設定抵押
    disclosure_has_lien     BOOLEAN         DEFAULT NULL,       -- 是否有查封 / 假扣押
    disclosure_notes        TEXT            NOT NULL DEFAULT '', -- 其他重大瑕疵補充
    disclosure_completed    BOOLEAN         NOT NULL DEFAULT FALSE,
    disclosure_hash         VARCHAR(64)     DEFAULT NULL,       -- SHA-256(揭露資料 JSON)，上鏈存證

    -- 驗證狀態
    verification_status     VARCHAR(20)     NOT NULL DEFAULT 'PENDING',
    -- PENDING | VERIFIED | REJECTED
    verified_at             TIMESTAMPTZ     DEFAULT NULL,

    -- 物件狀態
    status                  VARCHAR(20)     NOT NULL DEFAULT 'DRAFT',
    -- DRAFT | ACTIVE | UNDER_CONTRACT | RENTED | SOLD | INACTIVE

    -- 鏈上同步
    property_tx_hash        VARCHAR(128)    DEFAULT NULL,       -- PropertyRegistry registerProperty tx
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_properties_status        ON properties (status);
CREATE INDEX IF NOT EXISTS idx_properties_verify_status ON properties (verification_status);
CREATE INDEX IF NOT EXISTS idx_properties_city          ON properties (city);
CREATE INDEX IF NOT EXISTS idx_properties_type          ON properties (property_type);
CREATE INDEX IF NOT EXISTS idx_properties_disclosure    ON properties (disclosure_completed);
CREATE INDEX IF NOT EXISTS idx_properties_pet           ON properties (pet_allowed);
CREATE INDEX IF NOT EXISTS idx_properties_rent          ON properties (asking_rent);


-- ------------------------------------------------------------
-- property_owners（共同持有）
-- 對應合約：PropertyRegistry.sol（addOwner）
--
-- 設計：
--   - 一個物件可有多位持有人（應對夫妻/家族共有）
--   - share_bps：持分比例（basis points，10000 = 100%）
--   - is_primary_operator：主操作人，全體持有人中只能有一個為 TRUE
--   - owner_verified：強屋主驗證是否通過
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS property_owners (
    id                      BIGSERIAL       PRIMARY KEY,
    property_id             BIGINT          NOT NULL REFERENCES properties (id),
    owner_wallet_address    VARCHAR(255)    NOT NULL,
    share_bps               INTEGER         NOT NULL DEFAULT 10000, -- 持分(bps)，預設100%
    is_primary_operator     BOOLEAN         NOT NULL DEFAULT FALSE,
    owner_verified          BOOLEAN         NOT NULL DEFAULT FALSE,  -- 強屋主驗證
    verified_at             TIMESTAMPTZ     DEFAULT NULL,
    verify_tx_hash          VARCHAR(128)    DEFAULT NULL,            -- 強驗證 tx
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (property_id, owner_wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_property_owners_property ON property_owners (property_id);
CREATE INDEX IF NOT EXISTS idx_property_owners_wallet   ON property_owners (owner_wallet_address);
CREATE INDEX IF NOT EXISTS idx_property_owners_primary  ON property_owners (property_id, is_primary_operator);


-- ------------------------------------------------------------
-- property_authorizations（委託授權）
-- 對應合約：AgencyRegistry.sol
--
-- 設計：
--   - 屋主在平台正式授權仲介，授權時需同意委託合約核心條款
--   - 保留歷史（revoked 只更新 status，不刪除資料）
--   - mutual_consent_required：進入媒合後由後端設為 TRUE，
--     此後屋主無法單方解約（對應合約 lockForMutualConsent）
--   - contract_hash：委託合約內容 SHA-256，上鏈存證
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS property_authorizations (
    id                          BIGSERIAL       PRIMARY KEY,
    auth_id                     VARCHAR(64)     NOT NULL UNIQUE,
    property_id                 BIGINT          NOT NULL REFERENCES properties (id),
    owner_wallet_address        VARCHAR(255)    NOT NULL,
    agent_wallet_address        VARCHAR(255)    NOT NULL,
    purpose                     VARCHAR(20)     NOT NULL DEFAULT 'RENT',
    -- RENT | SALE | BOTH

    -- 委託合約核心條款（雙方簽署時確認）
    service_fee_bps             INTEGER         DEFAULT NULL,
    -- 仲介服務費率（basis points，e.g. 100 = 1%）
    mandate_duration_days       INTEGER         DEFAULT NULL,       -- 委託期限（天）
    penalty_amount              NUMERIC(20, 8)  DEFAULT NULL,       -- 違約金（合意金額）
    signing_method              VARCHAR(20)     DEFAULT NULL,       -- ONLINE | OFFLINE
    contract_hash               VARCHAR(64)     DEFAULT NULL,       -- SHA-256(委託合約內容)，上鏈存證

    -- 解約管制
    mutual_consent_required     BOOLEAN         NOT NULL DEFAULT FALSE,
    -- FALSE = 屋主可單方解約；TRUE = 進入媒合後需雙方合意
    -- 由後端在案件進入 MATCHED 時呼叫 lockForMutualConsent 設為 TRUE

    -- 狀態
    status                      VARCHAR(20)     NOT NULL DEFAULT 'ACTIVE',
    -- ACTIVE | REVOKED | EXPIRED

    -- 鏈上同步
    auth_tx_hash                VARCHAR(128)    DEFAULT NULL,   -- AgencyRegistry grantAuthorization tx
    revoke_tx_hash              VARCHAR(128)    DEFAULT NULL,   -- AgencyRegistry revokeAuthorization tx
    lock_tx_hash                VARCHAR(128)    DEFAULT NULL,   -- AgencyRegistry lockForMutualConsent tx

    authorized_at               TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    revoked_at                  TIMESTAMPTZ     DEFAULT NULL,
    expires_at                  TIMESTAMPTZ     DEFAULT NULL,   -- authorized_at + mandate_duration_days
    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_property    ON property_authorizations (property_id);
CREATE INDEX IF NOT EXISTS idx_auth_owner       ON property_authorizations (owner_wallet_address);
CREATE INDEX IF NOT EXISTS idx_auth_agent       ON property_authorizations (agent_wallet_address);
CREATE INDEX IF NOT EXISTS idx_auth_status      ON property_authorizations (status);
CREATE INDEX IF NOT EXISTS idx_auth_consent     ON property_authorizations (mutual_consent_required);


-- ------------------------------------------------------------
-- agent_profiles（仲介業務檔案）
-- 對應：users 表中 role = AGENT 的使用者
--
-- 設計：
--   - 仲介通過執照認證後，自行建立業務檔案
--   - 包含自我介紹、專長區域、服務項目
--   - 成交紀錄 / 接受委託從 cases / property_authorizations 查詢
--   - is_accepting_mandates：仲介是否開放接受新委託
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_profiles (
    id                      BIGSERIAL       PRIMARY KEY,
    user_id                 BIGINT          NOT NULL UNIQUE REFERENCES users (id),
    wallet_address          VARCHAR(255)    NOT NULL UNIQUE,
    bio                     TEXT            NOT NULL DEFAULT '',       -- 自我介紹
    years_of_experience     SMALLINT        DEFAULT NULL,              -- 執業年資
    specializations         JSONB           NOT NULL DEFAULT '[]',
    -- e.g. ["RENT", "SALE", "LUXURY", "COMMERCIAL"]
    service_areas           JSONB           NOT NULL DEFAULT '[]',
    -- e.g. ["台北市大安區", "台北市信義區"]
    license_verified        BOOLEAN         NOT NULL DEFAULT FALSE,    -- 執照是否通過後台審核
    license_verified_at     TIMESTAMPTZ     DEFAULT NULL,
    is_accepting_mandates   BOOLEAN         NOT NULL DEFAULT TRUE,     -- 是否接受新委託
    profile_visible         BOOLEAN         NOT NULL DEFAULT TRUE,     -- 是否公開業務頁面
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_profiles_wallet    ON agent_profiles (wallet_address);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_verified  ON agent_profiles (license_verified);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_visible   ON agent_profiles (profile_visible);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_mandate   ON agent_profiles (is_accepting_mandates);


-- ------------------------------------------------------------
-- listings（刊登上架）
-- 對應合約：ListingStakeVault.sol
--
-- 設計：
--   - 只有 verification_status = VERIFIED 且 disclosure_completed = TRUE 的物件可刊登
--   - 非屋主刊登需有 ACTIVE 授權（property_authorizations）
--   - viewing_schedule：可線下看屋時段（JSON 陣列）
--   - current_rental_status：目前出租情況（出租頁面必填）
--   - stake_* = 行為押金（鏈上存證）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS listings (
    id                      BIGSERIAL       PRIMARY KEY,
    listing_id              VARCHAR(64)     NOT NULL UNIQUE,
    property_id             BIGINT          NOT NULL REFERENCES properties (id),
    listed_by_wallet        VARCHAR(255)    NOT NULL,           -- 屋主或授權仲介
    listing_type            VARCHAR(20)     NOT NULL DEFAULT 'RENT',
    -- RENT | SALE
    price                   NUMERIC(20, 8)  NOT NULL DEFAULT 0,
    description             TEXT            NOT NULL DEFAULT '',
    image_urls              JSONB           NOT NULL DEFAULT '[]',

    -- 目前出租情況（出租頁面必須標示）
    current_rental_status   VARCHAR(20)     NOT NULL DEFAULT 'VACANT',
    -- VACANT（空屋）| OCCUPIED（有人居住）| NOTICE_GIVEN（已通知搬遷中）

    -- 可看屋時段（JSON 陣列）
    -- 格式：[{"day_of_week": 1, "time_from": "09:00", "time_to": "18:00"}, ...]
    -- day_of_week: 1=週一 ... 7=週日
    viewing_schedule        JSONB           NOT NULL DEFAULT '[]',

    -- 刊登狀態
    status                  VARCHAR(20)     NOT NULL DEFAULT 'ACTIVE',
    -- ACTIVE | PAUSED | MATCHED | CLOSED

    -- 統計（訪客人數由 listing_views 聚合，此處備存快取值）
    view_count              INTEGER         NOT NULL DEFAULT 0,
    reservation_count       INTEGER         NOT NULL DEFAULT 0,

    -- 行為押金（鏈上）
    stake_amount            NUMERIC(20, 8)  NOT NULL DEFAULT 0,
    stake_token             VARCHAR(20)     NOT NULL DEFAULT 'ETH',    -- ETH | USDC | USDT
    stake_tx_hash           VARCHAR(128)    DEFAULT NULL,
    slash_tx_hash           VARCHAR(128)    DEFAULT NULL,              -- 若違規沒收
    listing_tx_hash         VARCHAR(128)    DEFAULT NULL,

    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listings_property        ON listings (property_id);
CREATE INDEX IF NOT EXISTS idx_listings_status          ON listings (status);
CREATE INDEX IF NOT EXISTS idx_listings_type            ON listings (listing_type);
CREATE INDEX IF NOT EXISTS idx_listings_wallet          ON listings (listed_by_wallet);
CREATE INDEX IF NOT EXISTS idx_listings_rental_status   ON listings (current_rental_status);


-- ------------------------------------------------------------
-- listing_views（訪客瀏覽紀錄 & 畫像統計）
-- Append-only
--
-- 設計：
--   - 每次登入使用者瀏覽刊登頁時新增一筆
--   - 儲存瀏覽當下的使用者畫像快照（職業、收入、家庭）
--     供出租頁面「訪客群組統計」使用，屋主可看到
--     「有哪些職業/收入的人在看這個物件」
--   - 畫像欄位為快照，不隨使用者更新而異動
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS listing_views (
    id                      BIGSERIAL       PRIMARY KEY,
    listing_id              BIGINT          NOT NULL REFERENCES listings (id),
    viewer_user_id          BIGINT          NOT NULL REFERENCES users (id),

    -- 瀏覽當下的使用者畫像快照（來自 users 表，存快照供統計用）
    viewer_occupation       VARCHAR(100)    DEFAULT NULL,
    viewer_income_range     VARCHAR(30)     DEFAULT NULL,
    viewer_family_status    VARCHAR(30)     DEFAULT NULL,
    viewer_household_size   SMALLINT        DEFAULT NULL,

    viewed_at               TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listing_views_listing    ON listing_views (listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_views_user       ON listing_views (viewer_user_id);
CREATE INDEX IF NOT EXISTS idx_listing_views_time       ON listing_views (listing_id, viewed_at);


-- ------------------------------------------------------------
-- tenant_demands（租客需求清單）
--
-- 設計：
--   - 租客建立理想租屋條件，供屋主 / 仲介推薦媒合用
--   - preferred_source：想看屋主直租 / 仲介物件 / 不限
--   - 平台根據此清單定期推播符合的刊登給租客
--   - 屋主自租時，可從此清單中主動推送給條件貼近的租客
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_demands (
    id                          BIGSERIAL       PRIMARY KEY,
    demand_id                   VARCHAR(64)     NOT NULL UNIQUE,
    tenant_wallet_address       VARCHAR(255)    NOT NULL,

    -- 希望租的地區（可複選，存 JSON 陣列）
    -- e.g. ["台北市大安區", "台北市信義區"]
    preferred_areas             JSONB           NOT NULL DEFAULT '[]',

    -- 物件條件
    property_type               VARCHAR(32)     DEFAULT NULL,       -- 同 properties.property_type
    min_area_sqm                NUMERIC(10, 2)  DEFAULT NULL,
    max_rent                    NUMERIC(20, 8)  DEFAULT NULL,        -- 最高可接受月租
    min_bedrooms                SMALLINT        DEFAULT NULL,
    pet_required                BOOLEAN         NOT NULL DEFAULT FALSE,
    parking_required            BOOLEAN         NOT NULL DEFAULT FALSE,

    -- 偏好來源
    preferred_source            VARCHAR(20)     NOT NULL DEFAULT 'ANY',
    -- ANY | OWNER_DIRECT（屋主直租）| AGENT（仲介物件）

    -- 是否開放仲介主動聯絡（FALSE = 預設不開放）
    open_to_agent_contact       BOOLEAN         NOT NULL DEFAULT FALSE,

    -- 備注
    notes                       TEXT            NOT NULL DEFAULT '',

    -- 狀態
    status                      VARCHAR(20)     NOT NULL DEFAULT 'ACTIVE',
    -- ACTIVE | PAUSED | MATCHED | CLOSED

    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_demands_wallet    ON tenant_demands (tenant_wallet_address);
CREATE INDEX IF NOT EXISTS idx_tenant_demands_status    ON tenant_demands (status);
CREATE INDEX IF NOT EXISTS idx_tenant_demands_source    ON tenant_demands (preferred_source);


-- ------------------------------------------------------------
-- cases（媒合案件）
-- 對應合約：CaseTracker.sol
--
-- 設計：
--   租屋狀態機：OPEN → MATCHED → SIGN → CLOSED
--   買賣狀態機：OPEN → MATCHED → SIGN → BANKING → CLOSED
--   糾紛：任何狀態 → DISPUTED（需後台介入）
--   可取消：非 CLOSED / DISPUTED 狀態 → CANCELLED
--
--   introduced_by_agent_wallet：
--     若此案件由仲介引入（仲介推播 → 租客回應），記錄仲介錢包。
--     是防「過河拆橋」的鏈上足跡：屋主在 MATCHED 後解約並私下成交，
--     仲介可憑此欄位發起申訴，觸發 slash 懲罰。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cases (
    id                              BIGSERIAL       PRIMARY KEY,
    case_id                         VARCHAR(64)     NOT NULL UNIQUE,
    listing_id                      BIGINT          NOT NULL REFERENCES listings (id),
    property_id                     BIGINT          NOT NULL REFERENCES properties (id),
    owner_wallet_address            VARCHAR(255)    NOT NULL,
    counterparty_wallet_address     VARCHAR(255)    NOT NULL,   -- 租客或買方
    introduced_by_agent_wallet      VARCHAR(255)    DEFAULT NULL,
    -- 引入仲介錢包（若為自租媒合則為 NULL）
    -- 進入 MATCHED 後此欄位鎖定，不可修改
    case_type                       VARCHAR(20)     NOT NULL DEFAULT 'RENT',
    -- RENT | SALE

    status                          VARCHAR(20)     NOT NULL DEFAULT 'OPEN',
    -- RENT:  OPEN | MATCHED | SIGN | CLOSED | CANCELLED | DISPUTED
    -- SALE:  OPEN | MATCHED | SIGN | BANKING | CLOSED | CANCELLED | DISPUTED

    -- 各階段時間戳
    opened_at                       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    matched_at                      TIMESTAMPTZ     DEFAULT NULL,
    sign_at                         TIMESTAMPTZ     DEFAULT NULL,
    banking_at                      TIMESTAMPTZ     DEFAULT NULL,   -- 買賣專用
    closed_at                       TIMESTAMPTZ     DEFAULT NULL,
    cancelled_at                    TIMESTAMPTZ     DEFAULT NULL,
    disputed_at                     TIMESTAMPTZ     DEFAULT NULL,   -- 進入糾紛時間

    -- 各階段鏈上 tx
    open_tx_hash                    VARCHAR(128)    DEFAULT NULL,
    matched_tx_hash                 VARCHAR(128)    DEFAULT NULL,
    sign_tx_hash                    VARCHAR(128)    DEFAULT NULL,
    banking_tx_hash                 VARCHAR(128)    DEFAULT NULL,
    closed_tx_hash                  VARCHAR(128)    DEFAULT NULL,
    cancelled_tx_hash               VARCHAR(128)    DEFAULT NULL,
    disputed_tx_hash                VARCHAR(128)    DEFAULT NULL,

    -- 服務費
    fee_amount                      NUMERIC(20, 8)  DEFAULT NULL,
    fee_token                       VARCHAR(20)     DEFAULT NULL,   -- ETH | USDC | USDT
    fee_tx_hash                     VARCHAR(128)    DEFAULT NULL,

    created_at                      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cases_listing        ON cases (listing_id);
CREATE INDEX IF NOT EXISTS idx_cases_property       ON cases (property_id);
CREATE INDEX IF NOT EXISTS idx_cases_owner          ON cases (owner_wallet_address);
CREATE INDEX IF NOT EXISTS idx_cases_counterparty   ON cases (counterparty_wallet_address);
CREATE INDEX IF NOT EXISTS idx_cases_agent          ON cases (introduced_by_agent_wallet);
CREATE INDEX IF NOT EXISTS idx_cases_status         ON cases (status);
CREATE INDEX IF NOT EXISTS idx_cases_type           ON cases (case_type);


-- ------------------------------------------------------------
-- case_events（案件事件日誌）
-- Append-only，永不刪改
--
-- 每次狀態推進都追加一筆事件
-- 鏈上有對應 CaseTracker 的 event log
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS case_events (
    id              BIGSERIAL       PRIMARY KEY,
    case_id         BIGINT          NOT NULL REFERENCES cases (id),
    event_type      VARCHAR(50)     NOT NULL,
    -- OPENED | MATCHED | SIGN_STARTED | BANKING_STARTED
    -- | CLOSED | CANCELLED | DISPUTED | DISPUTE_RESOLVED
    actor_wallet    VARCHAR(255)    NOT NULL,
    note            TEXT            NOT NULL DEFAULT '',
    tx_hash         VARCHAR(128)    DEFAULT NULL,   -- 對應鏈上 tx
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_events_case ON case_events (case_id);


-- ------------------------------------------------------------
-- indexer_checkpoints（Indexer 斷點續傳）
--
-- 每個合約一筆記錄，追蹤最後處理到的 block number。
-- Indexer 重啟後從 last_processed_block + 1 繼續掃描。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS indexer_checkpoints (
    contract_name           VARCHAR(64)     PRIMARY KEY,
    -- IdentityNFT | PropertyRegistry | AgencyRegistry
    -- | ListingStakeVault | CaseTracker
    last_processed_block    BIGINT          NOT NULL DEFAULT 0,
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- 預先插入各合約的初始 checkpoint（0 = 從創世區塊掃起）
INSERT INTO indexer_checkpoints (contract_name, last_processed_block)
VALUES
    ('IdentityNFT',          0),
    ('PropertyRegistry',     0),
    ('AgencyRegistry',       0),
    ('ListingStakeVault',    0),
    ('CaseTracker',          0)
ON CONFLICT (contract_name) DO NOTHING;


-- ------------------------------------------------------------
-- processed_events（已處理事件去重 / Re-org 防護）
--
-- 每個已處理的 EVM log 記錄 (tx_hash, log_index) 作為唯一鍵。
-- 同一事件重複投遞 → ON CONFLICT DO NOTHING，天然冪等。
-- Re-org 偵測：若同一 block_number 出現不同 tx_hash 可觸發警告。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS processed_events (
    tx_hash             VARCHAR(128)    NOT NULL,
    log_index           INT             NOT NULL,
    contract_name       VARCHAR(64)     NOT NULL,
    event_name          VARCHAR(64)     NOT NULL,
    block_number        BIGINT          NOT NULL,
    processed_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_processed_events_block    ON processed_events (block_number);
CREATE INDEX IF NOT EXISTS idx_processed_events_contract ON processed_events (contract_name);
