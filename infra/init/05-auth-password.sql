-- ============================================================
-- Auth v2：Email + 密碼登入
--
-- 新增：
--   1. users.password_hash — bcrypt hash，email+password 登入用
--
-- Session 機制不變（wallet_session），session cookie 改為
-- session-only（不帶 MaxAge），瀏覽器關閉即清空由 App layer 控制。
--
-- 更新日期：2026-04-16
-- ============================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) DEFAULT NULL;
