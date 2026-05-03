-- Demo public listings for local development and UI validation.
-- Idempotent: re-running this file replaces only the demo listings below.

INSERT INTO users (wallet_address, kyc_status, kyc_verified_at)
VALUES ('0xDemoListingOwner00000000000000000000000000000001', 'VERIFIED', NOW())
ON CONFLICT (wallet_address) DO UPDATE SET
    kyc_status = 'VERIFIED',
    kyc_verified_at = COALESCE(users.kyc_verified_at, NOW()),
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
          '信義安和採光兩房',
          '中山捷運小資套房',
          '西屯七期景觀宅',
          '板橋新埔電梯三房',
          '左營高鐵成家透天'
      );

    INSERT INTO listings (
        owner_user_id, title, description, address, district,
        list_type, price, area_ping, floor, total_floors, room_count, bathroom_count,
        is_pet_allowed, is_parking_included, status, draft_origin, setup_status,
        daily_fee_ntd, published_at, expires_at
    ) VALUES (
        owner_id, '信義安和採光兩房', '近信義安和站，採光明亮，適合雙人入住。',
        '台北市大安區通化街88號', '大安區',
        'RENT', 42000, 24.5, 6, 12, 2, 1,
        TRUE, FALSE, 'ACTIVE', 'MANUAL_CREATE', 'READY',
        40, NOW() - INTERVAL '2 days', NOW() + INTERVAL '28 days'
    ) RETURNING id INTO listing_id;

    INSERT INTO listing_rent_details (
        listing_id, monthly_rent, deposit_months, management_fee_monthly,
        minimum_lease_months, can_register_household, can_cook, rent_notes
    ) VALUES (listing_id, 42000, 2, 2500, 12, TRUE, TRUE, '可討論家具配置。');

    INSERT INTO listings (
        owner_user_id, title, description, address, district,
        list_type, price, area_ping, floor, total_floors, room_count, bathroom_count,
        is_pet_allowed, is_parking_included, status, draft_origin, setup_status,
        daily_fee_ntd, published_at, expires_at
    ) VALUES (
        owner_id, '中山捷運小資套房', '生活機能完整，步行可到雙連與中山商圈。',
        '台北市中山區民生西路16號', '中山區',
        'RENT', 23500, 12.8, 8, 14, 1, 1,
        FALSE, FALSE, 'ACTIVE', 'MANUAL_CREATE', 'READY',
        40, NOW() - INTERVAL '1 day', NOW() + INTERVAL '29 days'
    ) RETURNING id INTO listing_id;

    INSERT INTO listing_rent_details (
        listing_id, monthly_rent, deposit_months, management_fee_monthly,
        minimum_lease_months, can_register_household, can_cook, rent_notes
    ) VALUES (listing_id, 23500, 2, 1200, 12, FALSE, FALSE, '適合單人入住。');

    INSERT INTO listings (
        owner_user_id, title, description, address, district,
        list_type, price, area_ping, floor, total_floors, room_count, bathroom_count,
        is_pet_allowed, is_parking_included, status, draft_origin, setup_status,
        daily_fee_ntd, published_at, expires_at
    ) VALUES (
        owner_id, '西屯七期景觀宅', '七期核心，視野開闊，近百貨與公園。',
        '台中市西屯區市政北七路168號', '西屯區',
        'SALE', 46800000, 58.6, 18, 28, 4, 2,
        TRUE, TRUE, 'ACTIVE', 'MANUAL_CREATE', 'READY',
        40, NOW() - INTERVAL '4 hours', NOW() + INTERVAL '30 days'
    ) RETURNING id INTO listing_id;

    INSERT INTO listing_sale_details (
        listing_id, sale_total_price, sale_unit_price_per_ping,
        main_building_ping, auxiliary_building_ping, balcony_ping, land_ping,
        parking_space_type, parking_space_price, sale_notes
    ) VALUES (listing_id, 46800000, 798634, 36.8, 5.2, 3.6, 8.4, '坡道平面車位', 2200000, '含一個車位。');

    INSERT INTO listings (
        owner_user_id, title, description, address, district,
        list_type, price, area_ping, floor, total_floors, room_count, bathroom_count,
        is_pet_allowed, is_parking_included, status, draft_origin, setup_status,
        daily_fee_ntd, published_at, expires_at
    ) VALUES (
        owner_id, '板橋新埔電梯三房', '近新埔站，格局方正，適合小家庭。',
        '新北市板橋區文化路一段188號', '板橋區',
        'SALE', 32600000, 38.2, 9, 15, 3, 2,
        FALSE, TRUE, 'ACTIVE', 'MANUAL_CREATE', 'READY',
        40, NOW() - INTERVAL '8 hours', NOW() + INTERVAL '30 days'
    ) RETURNING id INTO listing_id;

    INSERT INTO listing_sale_details (
        listing_id, sale_total_price, sale_unit_price_per_ping,
        main_building_ping, auxiliary_building_ping, balcony_ping, land_ping,
        parking_space_type, parking_space_price, sale_notes
    ) VALUES (listing_id, 32600000, 853403, 25.4, 3.1, 2.2, 5.8, '機械車位', 1200000, '近捷運與學區。');

    INSERT INTO listings (
        owner_user_id, title, description, address, district,
        list_type, price, area_ping, floor, total_floors, room_count, bathroom_count,
        is_pet_allowed, is_parking_included, status, draft_origin, setup_status,
        daily_fee_ntd, published_at, expires_at
    ) VALUES (
        owner_id, '左營高鐵成家透天', '近高鐵與蓮池潭生活圈，適合自住。',
        '高雄市左營區重愛路66號', '左營區',
        'SALE', 23800000, 46.0, 1, 4, 4, 3,
        TRUE, TRUE, 'ACTIVE', 'MANUAL_CREATE', 'READY',
        40, NOW() - INTERVAL '12 hours', NOW() + INTERVAL '30 days'
    ) RETURNING id INTO listing_id;

    INSERT INTO listing_sale_details (
        listing_id, sale_total_price, sale_unit_price_per_ping,
        main_building_ping, auxiliary_building_ping, balcony_ping, land_ping,
        parking_space_type, parking_space_price, sale_notes
    ) VALUES (listing_id, 23800000, 517391, 31.0, 4.5, 2.5, 19.2, '門前停車', 0, '透天產品，土地持分完整。');
END $$;
