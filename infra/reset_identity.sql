-- ============================================================
-- 一鍵重生腳本 v2  (LAND DB · 2026-04-17)
--
-- 清除範圍：
--   users, kyc_sessions, kyc_submissions, user_credentials,
--   otp_codes, auth_nonce, wallet_session
--
-- 保留不動：
--   indexer_checkpoints, processed_events  ← 區塊鏈索引，刪了要重新同步
--   tasks, task_submissions, task_blockchain_logs  ← 任務資料
--
-- 使用方式（修改下方兩個變數）：
--   v_email     = 'test@example.com'  → 只刪該 email 帳號
--   v_id_number = 'A123456789'        → 只刪該身分字號帳號
--   兩者皆填  → OR，符合任一者都刪
--   兩者皆 NULL → 清除全部使用者 & KYC 資料
--
-- 前置需求：pgcrypto（pg14+ 預設已安裝）
--   CREATE EXTENSION IF NOT EXISTS pgcrypto;
--
-- 執行：
--   psql -U postgres -d LAND -f infra/reset_identity.sql
-- ============================================================

DO $$
DECLARE
    v_email      TEXT := NULL;   -- 例如 'test@example.com'
    v_id_number  TEXT := NULL;   -- 例如 'A123456789'

    v_person_hash TEXT;
    v_user_ids    BIGINT[];
    v_wallets     TEXT[];
    v_session_ids UUID[];
    v_phones      TEXT[];
BEGIN
    -- person_hash = SHA-256(id_number)，與 users.person_hash 對應
    IF v_id_number IS NOT NULL THEN
        v_person_hash := encode(digest(v_id_number, 'sha256'), 'hex');
    END IF;

    -- ================================================================
    -- 情境 A：有指定條件 → 只刪符合的使用者
    -- ================================================================
    IF v_email IS NOT NULL OR v_id_number IS NOT NULL THEN

        -- 1. 找符合條件的 users（id + wallet + phone）
        SELECT
            ARRAY_AGG(id),
            ARRAY_AGG(wallet_address),
            ARRAY_AGG(phone) FILTER (WHERE phone IS NOT NULL)
        INTO v_user_ids, v_wallets, v_phones
        FROM users
        WHERE (v_email       IS NOT NULL AND LOWER(email)   = LOWER(v_email))
           OR (v_person_hash IS NOT NULL AND person_hash     = v_person_hash);

        -- 2. 找相關 kyc_sessions
        --    （含尚未完成 bound_user_id 的進行中 session）
        SELECT ARRAY_AGG(id) INTO v_session_ids
        FROM kyc_sessions
        WHERE (v_email       IS NOT NULL AND LOWER(email) = LOWER(v_email))
           OR (v_person_hash IS NOT NULL AND person_hash   = v_person_hash)
           OR (v_user_ids    IS NOT NULL AND bound_user_id = ANY(v_user_ids));

        -- ── 依 FK 順序刪除 ──────────────────────────────────────

        -- otp_codes：
        --   · session_id 關聯的（onboarding 流程）
        --   · target 為 email 的（profile 變更 email OTP，無 session_id）
        --   · target 為 phone 的（profile 變更 phone OTP，無 session_id）
        DELETE FROM otp_codes
        WHERE (v_session_ids IS NOT NULL AND session_id = ANY(v_session_ids))
           OR (v_email       IS NOT NULL AND LOWER(target) = LOWER(v_email))
           OR (v_phones      IS NOT NULL AND target = ANY(v_phones));

        -- kyc_submissions（FK → users）
        DELETE FROM kyc_submissions
        WHERE v_user_ids IS NOT NULL AND user_id = ANY(v_user_ids);

        -- user_credentials（FK → users）
        DELETE FROM user_credentials
        WHERE v_user_ids IS NOT NULL AND user_id = ANY(v_user_ids);

        -- kyc_sessions（FK → users via bound_user_id）
        DELETE FROM kyc_sessions
        WHERE v_session_ids IS NOT NULL AND id = ANY(v_session_ids);

        -- wallet_session（以 wallet_address 關聯，無 FK）
        DELETE FROM wallet_session
        WHERE v_wallets IS NOT NULL AND wallet_address = ANY(v_wallets);

        -- auth_nonce（以 wallet_address 關聯，無 FK）
        DELETE FROM auth_nonce
        WHERE v_wallets IS NOT NULL AND wallet_address = ANY(v_wallets);

        -- users（最後刪）
        DELETE FROM users
        WHERE v_user_ids IS NOT NULL AND id = ANY(v_user_ids);

        RAISE NOTICE '完成。刪除：% 位使用者 / % 筆 kyc_session。',
            COALESCE(array_length(v_user_ids,    1), 0),
            COALESCE(array_length(v_session_ids, 1), 0);

    -- ================================================================
    -- 情境 B：無條件 → 全部清除（開發用核彈）
    -- ================================================================
    ELSE
        DELETE FROM otp_codes;
        DELETE FROM kyc_submissions;
        DELETE FROM user_credentials;
        DELETE FROM kyc_sessions;
        DELETE FROM wallet_session;
        DELETE FROM auth_nonce;
        DELETE FROM users;

        RAISE NOTICE '完成。所有使用者 & KYC 資料已全部清除。（區塊鏈索引與任務資料保留）';
    END IF;
END $$;
