-- ============================================================
-- KYC 提交紀錄（eKYC 拍照上傳版）
--
-- 設計原則：
--   - 不儲存身分證字號原文，只存 identity_hash（SHA-256）
--   - 圖片存 MinIO，此表只存 object path
--   - OCR 提取欄位可為 NULL（OCR 失敗時仍建立記錄，等人工審）
--   - identity_hash UNIQUE：確保一人一帳號
--
-- review_status 狀態機：
--   PENDING → AUTO_VERIFIED（人臉 ≥ 80%，自動通過）
--   PENDING → MANUAL_REVIEW（人臉 60~80%，等人工）
--   PENDING → REJECTED（人臉 < 60% 或 OCR 失敗）
--   MANUAL_REVIEW → VERIFIED / REJECTED（管理員審核）
-- ============================================================

CREATE TABLE IF NOT EXISTS kyc_submissions (
    id                  BIGSERIAL       PRIMARY KEY,
    user_id             BIGINT          NOT NULL REFERENCES users(id),
    wallet_address      VARCHAR(255)    NOT NULL,

    -- MinIO object paths（格式：kyc/{wallet}/{id}/id_front.jpg）
    id_front_path       VARCHAR(512)    DEFAULT NULL,
    id_back_path        VARCHAR(512)    DEFAULT NULL,
    selfie_path         VARCHAR(512)    DEFAULT NULL,

    -- OCR 提取（正面）
    ocr_name            VARCHAR(100)    DEFAULT NULL,   -- 姓名
    identity_hash       VARCHAR(64)     UNIQUE,          -- SHA-256(id_number + wallet)
    ocr_birth_date      VARCHAR(30)     DEFAULT NULL,   -- 民國生日字串
    ocr_issue_date      VARCHAR(30)     DEFAULT NULL,   -- 發證日期
    ocr_issue_location  VARCHAR(100)    DEFAULT NULL,   -- 發證機關

    -- OCR 提取（背面）
    ocr_address         VARCHAR(255)    DEFAULT NULL,   -- 戶籍地址
    ocr_father_name     VARCHAR(100)    DEFAULT NULL,   -- 父
    ocr_mother_name     VARCHAR(100)    DEFAULT NULL,   -- 母
    ocr_spouse_name     VARCHAR(100)    DEFAULT NULL,   -- 配偶（未婚為空）

    -- AI 驗證結果
    face_match_score    NUMERIC(5,2)    DEFAULT NULL,   -- Rekognition 相似度（0~100）
    ocr_success         BOOLEAN         NOT NULL DEFAULT FALSE,

    -- 審核
    review_status       VARCHAR(20)     NOT NULL DEFAULT 'PENDING',
    -- PENDING | AUTO_VERIFIED | MANUAL_REVIEW | VERIFIED | REJECTED
    reviewer_note       TEXT            NOT NULL DEFAULT '',
    reviewed_by_wallet  VARCHAR(255)    DEFAULT NULL,

    submitted_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    reviewed_at         TIMESTAMPTZ     DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_kyc_sub_user     ON kyc_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_sub_wallet   ON kyc_submissions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_kyc_sub_status   ON kyc_submissions(review_status);
CREATE INDEX IF NOT EXISTS idx_kyc_sub_hash     ON kyc_submissions(identity_hash);
