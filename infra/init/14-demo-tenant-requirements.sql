-- Demo tenant requirements for rental matching search validation.
-- Idempotent: re-running this file replaces only the demo tenant requirements below.

INSERT INTO users (wallet_address, kyc_status, kyc_verified_at)
VALUES ('0xDemoTenant000000000000000000000000000000000001', 'VERIFIED', NOW())
ON CONFLICT (wallet_address) DO UPDATE SET
    kyc_status = 'VERIFIED',
    kyc_verified_at = COALESCE(users.kyc_verified_at, NOW()),
    updated_at = NOW();

INSERT INTO user_credentials (
    user_id, credential_type, review_status, nft_token_id, tx_hash,
    reviewed_by_wallet, verified_at
)
SELECT id, 'TENANT', 'APPROVED', 2, '0x0000000000000000000000000000000000000000000000000000000000000def',
       '0xDemoReviewer0000000000000000000000000000000001', NOW()
FROM users
WHERE wallet_address = '0xDemoTenant000000000000000000000000000000000001'
ON CONFLICT (user_id, credential_type) DO UPDATE SET
    review_status = 'APPROVED',
    nft_token_id = EXCLUDED.nft_token_id,
    tx_hash = EXCLUDED.tx_hash,
    reviewed_by_wallet = EXCLUDED.reviewed_by_wallet,
    verified_at = COALESCE(user_credentials.verified_at, NOW()),
    updated_at = NOW();

INSERT INTO tenant_profiles (
    user_id, occupation_type, org_name, income_range, household_size,
    co_resident_note, move_in_timeline, additional_note, advanced_data_status
)
SELECT id, '上班族', '科技公司', '60,000 以上', 2,
       '伴侶同住，無小孩。', '一個月內', '作息穩定，偏好安靜社區。', 'ADVANCED'
FROM users
WHERE wallet_address = '0xDemoTenant000000000000000000000000000000000001'
ON CONFLICT (user_id) DO UPDATE SET
    occupation_type = EXCLUDED.occupation_type,
    org_name = EXCLUDED.org_name,
    income_range = EXCLUDED.income_range,
    household_size = EXCLUDED.household_size,
    co_resident_note = EXCLUDED.co_resident_note,
    move_in_timeline = EXCLUDED.move_in_timeline,
    additional_note = EXCLUDED.additional_note,
    advanced_data_status = EXCLUDED.advanced_data_status,
    updated_at = NOW();

DO $$
DECLARE
    tenant_id BIGINT;
    requirement_id BIGINT;
BEGIN
    SELECT id INTO tenant_id
    FROM users
    WHERE wallet_address = '0xDemoTenant000000000000000000000000000000000001';

    DELETE FROM tenant_requirements
    WHERE user_id = tenant_id
      AND layout_note IN (
          '希望兩房以上，有對外窗與陽台。',
          '單人租住，接受小坪數套房。',
          '需要可養大型犬與平面車位。'
      );

    INSERT INTO tenant_requirements (
        user_id, target_district, budget_min, budget_max, layout_note,
        move_in_date, pet_friendly_needed, parking_needed, status,
        area_min_ping, area_max_ping, room_min, bathroom_min, move_in_timeline,
        minimum_lease_months, can_cook_needed, can_register_household_needed,
        lifestyle_note, must_have_note
    ) VALUES (
        tenant_id, '台北市 2 區', 25000, 36000, '希望兩房以上，有對外窗與陽台。',
        CURRENT_DATE + INTERVAL '30 days', TRUE, FALSE, 'OPEN',
        12, 28, 2, 1, '一個月內',
        12, TRUE, TRUE,
        '兩人同住，作息穩定，不抽菸。', '近捷運，可開伙，可設籍。'
    ) RETURNING id INTO requirement_id;

    INSERT INTO tenant_requirement_districts (requirement_id, county, district, zip_code)
    VALUES
        (requirement_id, '台北市', '大安區', '106'),
        (requirement_id, '台北市', '信義區', '110')
    ON CONFLICT (requirement_id, county, district, zip_code) DO NOTHING;

    INSERT INTO tenant_requirements (
        user_id, target_district, budget_min, budget_max, layout_note,
        move_in_date, pet_friendly_needed, parking_needed, status,
        area_min_ping, area_max_ping, room_min, bathroom_min, move_in_timeline,
        minimum_lease_months, can_cook_needed, can_register_household_needed,
        lifestyle_note, must_have_note
    ) VALUES (
        tenant_id, '台北市 中山區', 16000, 22000, '單人租住，接受小坪數套房。',
        CURRENT_DATE + INTERVAL '45 days', FALSE, FALSE, 'OPEN',
        8, 16, 1, 1, '兩個月內',
        6, FALSE, FALSE,
        '單人上班族，平日晚上在家。', '近公車站或捷運站。'
    ) RETURNING id INTO requirement_id;

    INSERT INTO tenant_requirement_districts (requirement_id, county, district, zip_code)
    VALUES (requirement_id, '台北市', '中山區', '104')
    ON CONFLICT (requirement_id, county, district, zip_code) DO NOTHING;

    INSERT INTO tenant_requirements (
        user_id, target_district, budget_min, budget_max, layout_note,
        move_in_date, pet_friendly_needed, parking_needed, status,
        area_min_ping, area_max_ping, room_min, bathroom_min, move_in_timeline,
        minimum_lease_months, can_cook_needed, can_register_household_needed,
        lifestyle_note, must_have_note
    ) VALUES (
        tenant_id, '新北市 板橋區', 18000, 26000, '需要可養大型犬與平面車位。',
        CURRENT_DATE + INTERVAL '60 days', TRUE, TRUE, 'OPEN',
        20, 36, 2, 1, '三個月內',
        12, TRUE, FALSE,
        '有一隻大型犬，需要安靜社區。', '需車位，需寵物友善。'
    ) RETURNING id INTO requirement_id;

    INSERT INTO tenant_requirement_districts (requirement_id, county, district, zip_code)
    VALUES (requirement_id, '新北市', '板橋區', '220')
    ON CONFLICT (requirement_id, county, district, zip_code) DO NOTHING;
END $$;
