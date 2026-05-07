-- Demo public listings for local development and UI validation.
-- Idempotent: re-running this file replaces only the demo listings below.

INSERT INTO users (wallet_address, kyc_status, kyc_verified_at)
VALUES ('0xDemoListingOwner00000000000000000000000000000001', 'VERIFIED', NOW())
ON CONFLICT (wallet_address) DO UPDATE SET
    kyc_status = 'VERIFIED',
    kyc_verified_at = COALESCE(users.kyc_verified_at, NOW()),
    updated_at = NOW();

INSERT INTO user_credentials (
    user_id, credential_type, review_status, nft_token_id, tx_hash,
    reviewed_by_wallet, verified_at
)
SELECT id, 'OWNER', 'APPROVED', 1, '0x0000000000000000000000000000000000000000000000000000000000000abc',
       '0xDemoReviewer0000000000000000000000000000000001', NOW()
FROM users
WHERE wallet_address = '0xDemoListingOwner00000000000000000000000000000001'
ON CONFLICT (user_id, credential_type) DO UPDATE SET
    review_status = 'APPROVED',
    nft_token_id = EXCLUDED.nft_token_id,
    tx_hash = EXCLUDED.tx_hash,
    reviewed_by_wallet = EXCLUDED.reviewed_by_wallet,
    verified_at = COALESCE(user_credentials.verified_at, NOW()),
    updated_at = NOW();

DO $$
DECLARE
    owner_id BIGINT;
    listing_id BIGINT;
BEGIN
    SELECT id INTO owner_id
    FROM users
    WHERE wallet_address = '0xDemoListingOwner00000000000000000000000000000001';

    DELETE FROM listings
    WHERE owner_user_id = owner_id
      AND title IN (
          '大安捷運兩房採光宅',
          '中山小資套房',
          '台中七期景觀大樓',
          '板橋車站三房',
          '宜蘭庭院透天'
      );

    INSERT INTO listings (
        owner_user_id, title, description, address, district,
        list_type, price, area_ping, floor, total_floors, room_count, bathroom_count,
        is_pet_allowed, is_parking_included, status, draft_origin, setup_status,
        daily_fee_ntd, published_at, expires_at
    ) VALUES (
        owner_id, '大安捷運兩房採光宅', '近捷運科技大樓站，採光明亮，可開伙與設籍，適合穩定上班族。',
        '台北市大安區復興南路二段180號', '大安區',
        'RENT', 32000, 21.5, 6, 12, 2, 1,
        TRUE, FALSE, 'ACTIVE', 'MANUAL_CREATE', 'READY',
        40, NOW() - INTERVAL '2 days', NOW() + INTERVAL '28 days'
    ) RETURNING id INTO listing_id;

    INSERT INTO listing_rent_details (
        listing_id, monthly_rent, deposit_months, management_fee_monthly,
        minimum_lease_months, can_register_household, can_cook, rent_notes
    ) VALUES (listing_id, 32000, 2, 1800, 12, TRUE, TRUE, '可寵物需另簽清潔約，廚房可明火。');

    INSERT INTO listings (
        owner_user_id, title, description, address, district,
        list_type, price, area_ping, floor, total_floors, room_count, bathroom_count,
        is_pet_allowed, is_parking_included, status, draft_origin, setup_status,
        daily_fee_ntd, published_at, expires_at
    ) VALUES (
        owner_id, '中山小資套房', '生活機能成熟，近公車與商圈，適合單人租住。',
        '台北市中山區南京東路二段16號', '中山區',
        'RENT', 18000, 10.5, 8, 14, 1, 1,
        FALSE, FALSE, 'ACTIVE', 'MANUAL_CREATE', 'READY',
        40, NOW() - INTERVAL '1 day', NOW() + INTERVAL '29 days'
    ) RETURNING id INTO listing_id;

    INSERT INTO listing_rent_details (
        listing_id, monthly_rent, deposit_months, management_fee_monthly,
        minimum_lease_months, can_register_household, can_cook, rent_notes
    ) VALUES (listing_id, 18000, 2, 900, 6, FALSE, FALSE, '簡易電磁爐可用，不接受寵物。');

    INSERT INTO listings (
        owner_user_id, title, description, address, district,
        list_type, price, area_ping, floor, total_floors, room_count, bathroom_count,
        is_pet_allowed, is_parking_included, status, draft_origin, setup_status,
        daily_fee_ntd, published_at, expires_at
    ) VALUES (
        owner_id, '台中七期景觀大樓', '高樓層視野佳，社區管理完整，車位另計。',
        '台中市西屯區市政北七路68號', '西屯區',
        'SALE', 46800000, 58.6, 18, 28, 4, 2,
        TRUE, TRUE, 'ACTIVE', 'MANUAL_CREATE', 'READY',
        40, NOW() - INTERVAL '4 hours', NOW() + INTERVAL '30 days'
    ) RETURNING id INTO listing_id;

    INSERT INTO listing_sale_details (
        listing_id, sale_total_price, sale_unit_price_per_ping,
        main_building_ping, auxiliary_building_ping, balcony_ping, land_ping,
        parking_space_type, parking_space_price, sale_notes
    ) VALUES (listing_id, 46800000, 798634, 36.8, 5.2, 3.6, 8.4, '坡道平面', 2200000, '含裝潢，車位另計。');

    INSERT INTO listings (
        owner_user_id, title, description, address, district,
        list_type, price, area_ping, floor, total_floors, room_count, bathroom_count,
        is_pet_allowed, is_parking_included, status, draft_origin, setup_status,
        daily_fee_ntd, published_at, expires_at
    ) VALUES (
        owner_id, '板橋車站三房', '近板橋車站與商圈，生活交通方便。',
        '新北市板橋區文化路一段88號', '板橋區',
        'SALE', 32600000, 38.2, 9, 15, 3, 2,
        FALSE, TRUE, 'ACTIVE', 'MANUAL_CREATE', 'READY',
        40, NOW() - INTERVAL '8 hours', NOW() + INTERVAL '30 days'
    ) RETURNING id INTO listing_id;

    INSERT INTO listing_sale_details (
        listing_id, sale_total_price, sale_unit_price_per_ping,
        main_building_ping, auxiliary_building_ping, balcony_ping, land_ping,
        parking_space_type, parking_space_price, sale_notes
    ) VALUES (listing_id, 32600000, 853403, 25.4, 3.1, 2.2, 5.8, '機械車位', 1200000, '屋況佳，可約看。');

    INSERT INTO listings (
        owner_user_id, title, description, address, district,
        list_type, price, area_ping, floor, total_floors, room_count, bathroom_count,
        is_pet_allowed, is_parking_included, status, draft_origin, setup_status,
        daily_fee_ntd, published_at, expires_at
    ) VALUES (
        owner_id, '宜蘭庭院透天', '有前庭與後院，適合三代同堂或工作室使用。',
        '宜蘭縣宜蘭市泰山路6號', '宜蘭市',
        'SALE', 23800000, 46.0, 1, 4, 4, 3,
        TRUE, TRUE, 'ACTIVE', 'MANUAL_CREATE', 'READY',
        40, NOW() - INTERVAL '12 hours', NOW() + INTERVAL '30 days'
    ) RETURNING id INTO listing_id;

    INSERT INTO listing_sale_details (
        listing_id, sale_total_price, sale_unit_price_per_ping,
        main_building_ping, auxiliary_building_ping, balcony_ping, land_ping,
        parking_space_type, parking_space_price, sale_notes
    ) VALUES (listing_id, 23800000, 517391, 31.0, 4.5, 2.5, 19.2, '庭院停車', 0, '自有庭院可停車。');
END $$;
