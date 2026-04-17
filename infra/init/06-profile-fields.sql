-- Migration: add profile fields
-- Run this on an already-running DB, or it will be included automatically on fresh volumes.

ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS ocr_id_number   VARCHAR(20);
ALTER TABLE users           ADD COLUMN IF NOT EXISTS mailing_address  TEXT;
ALTER TABLE users           ADD COLUMN IF NOT EXISTS id_number_hint   VARCHAR(10);
