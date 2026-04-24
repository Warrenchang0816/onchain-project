-- ============================================================
-- Identity reset script
-- ============================================================

DO $$
DECLARE
    v_email      TEXT := NULL;
    v_id_number  TEXT := NULL;

    v_person_hash TEXT;
    v_user_ids    BIGINT[];
    v_wallets     TEXT[];
    v_session_ids UUID[];
    v_phones      TEXT[];
    v_listing_ids BIGINT[];
BEGIN
    IF v_id_number IS NOT NULL THEN
        v_person_hash := encode(digest(v_id_number, 'sha256'), 'hex');
    END IF;

    IF v_email IS NOT NULL OR v_id_number IS NOT NULL THEN
        SELECT
            ARRAY_AGG(id),
            ARRAY_AGG(wallet_address),
            ARRAY_AGG(phone) FILTER (WHERE phone IS NOT NULL)
        INTO v_user_ids, v_wallets, v_phones
        FROM users
        WHERE (v_email IS NOT NULL AND LOWER(email) = LOWER(v_email))
           OR (v_person_hash IS NOT NULL AND person_hash = v_person_hash);

        SELECT ARRAY_AGG(id) INTO v_session_ids
        FROM kyc_sessions
        WHERE (v_email IS NOT NULL AND LOWER(email) = LOWER(v_email))
           OR (v_person_hash IS NOT NULL AND person_hash = v_person_hash)
           OR (v_user_ids IS NOT NULL AND bound_user_id = ANY(v_user_ids));

        SELECT ARRAY_AGG(id) INTO v_listing_ids
        FROM listings
        WHERE v_user_ids IS NOT NULL AND owner_user_id = ANY(v_user_ids);

        DELETE FROM otp_codes
        WHERE (v_session_ids IS NOT NULL AND session_id = ANY(v_session_ids))
           OR (v_email IS NOT NULL AND LOWER(target) = LOWER(v_email))
           OR (v_phones IS NOT NULL AND target = ANY(v_phones));

        DELETE FROM listing_appointments
        WHERE (v_user_ids IS NOT NULL AND visitor_user_id = ANY(v_user_ids))
           OR (v_listing_ids IS NOT NULL AND listing_id = ANY(v_listing_ids));

        DELETE FROM listings
        WHERE v_user_ids IS NOT NULL AND owner_user_id = ANY(v_user_ids);

        DELETE FROM kyc_submissions
        WHERE v_user_ids IS NOT NULL AND user_id = ANY(v_user_ids);

        DELETE FROM credential_submissions
        WHERE v_user_ids IS NOT NULL AND user_id = ANY(v_user_ids);

        DELETE FROM user_credentials
        WHERE v_user_ids IS NOT NULL AND user_id = ANY(v_user_ids);

        DELETE FROM kyc_sessions
        WHERE v_session_ids IS NOT NULL AND id = ANY(v_session_ids);

        DELETE FROM wallet_session
        WHERE v_wallets IS NOT NULL AND wallet_address = ANY(v_wallets);

        DELETE FROM auth_nonce
        WHERE v_wallets IS NOT NULL AND wallet_address = ANY(v_wallets);

        DELETE FROM tenant_profile_documents
        USING tenant_profiles
        WHERE tenant_profile_documents.tenant_profile_id = tenant_profiles.id
          AND v_user_ids IS NOT NULL
          AND tenant_profiles.user_id = ANY(v_user_ids);

        DELETE FROM tenant_profiles
        WHERE v_user_ids IS NOT NULL AND user_id = ANY(v_user_ids);

        DELETE FROM tenant_requirements
        WHERE v_user_ids IS NOT NULL AND user_id = ANY(v_user_ids);

        DELETE FROM agent_profiles
        WHERE v_user_ids IS NOT NULL AND user_id = ANY(v_user_ids);

        DELETE FROM users
        WHERE v_user_ids IS NOT NULL AND id = ANY(v_user_ids);

        RAISE NOTICE 'Done. Deleted % users / % kyc sessions / % listings.',
            COALESCE(array_length(v_user_ids, 1), 0),
            COALESCE(array_length(v_session_ids, 1), 0),
            COALESCE(array_length(v_listing_ids, 1), 0);
    ELSE
        DELETE FROM otp_codes;
        DELETE FROM listing_appointments;
        DELETE FROM listings;
        DELETE FROM kyc_submissions;
        DELETE FROM credential_submissions;
        DELETE FROM user_credentials;
        DELETE FROM kyc_sessions;
        DELETE FROM wallet_session;
        DELETE FROM auth_nonce;
        DELETE FROM tenant_profile_documents;
        DELETE FROM tenant_profiles;
        DELETE FROM tenant_requirements;
        DELETE FROM agent_profiles;
        DELETE FROM users;

        RAISE NOTICE 'Done. Cleared all users, KYC, and listings data.';
    END IF;
END $$;
