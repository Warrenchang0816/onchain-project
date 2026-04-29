-- ============================================================
-- Credential submissions for Gate 1A role credentials
-- ============================================================

CREATE TABLE IF NOT EXISTS credential_submissions (
    id                      BIGSERIAL    PRIMARY KEY,
    user_id                 BIGINT       NOT NULL REFERENCES users(id),
    credential_type         VARCHAR(20)  NOT NULL,
    review_route            VARCHAR(20)  NOT NULL,
    review_status           VARCHAR(30)  NOT NULL,
    activation_status       VARCHAR(20)  NOT NULL DEFAULT 'NOT_READY',
    form_payload_json       JSONB        NOT NULL DEFAULT '{}'::jsonb,
    main_doc_path           VARCHAR(512) DEFAULT NULL,
    support_doc_path        VARCHAR(512) DEFAULT NULL,
    notes                   TEXT         NOT NULL DEFAULT '',
    ocr_text_main           TEXT         NOT NULL DEFAULT '',
    ocr_text_support        TEXT         NOT NULL DEFAULT '',
    check_result_json       JSONB        NOT NULL DEFAULT '{}'::jsonb,
    decision_summary        TEXT         NOT NULL DEFAULT '',
    reviewer_note           TEXT         NOT NULL DEFAULT '',
    reviewed_by_wallet      VARCHAR(255) DEFAULT NULL,
    decided_at              TIMESTAMPTZ  DEFAULT NULL,
    activated_at            TIMESTAMPTZ  DEFAULT NULL,
    activation_tx_hash      VARCHAR(66)  DEFAULT NULL,
    activation_token_id     INT          DEFAULT NULL,
    superseded_by_submission_id BIGINT   DEFAULT NULL REFERENCES credential_submissions(id),
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credential_submissions_user_type_created
    ON credential_submissions (user_id, credential_type, created_at DESC);
