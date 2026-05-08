-- Demo properties and listings for local development and UI validation.
-- Creates 10 rental + 10 sale ACTIVE listings using the new property/rental_listing/sale_listing tables.
-- Idempotent: re-running this file replaces only the demo properties below.

INSERT INTO users (wallet_address, kyc_status, kyc_verified_at)
VALUES ('0xDemoPropertyOwner0000000000000000000000000000001', 'VERIFIED', NOW())
ON CONFLICT (wallet_address) DO UPDATE SET
    kyc_status = 'VERIFIED',
    kyc_verified_at = COALESCE(users.kyc_verified_at, NOW()),
    updated_at = NOW();

INSERT INTO user_credentials (
    user_id, credential_type, review_status, nft_token_id, tx_hash,
    reviewed_by_wallet, verified_at
)
SELECT id, 'OWNER', 'APPROVED', 3,
       '0x0000000000000000000000000000000000000000000000000000000000000bbb',
       '0xDemoReviewer0000000000000000000000000000000001', NOW()
FROM users
WHERE wallet_address = '0xDemoPropertyOwner0000000000000000000000000000001'
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
    prop_id  BIGINT;
BEGIN
    SELECT id INTO owner_id
    FROM users
    WHERE wallet_address = '0xDemoPropertyOwner0000000000000000000000000000001';

    DELETE FROM rental_listing
    WHERE property_id IN (
        SELECT id FROM property
        WHERE owner_user_id = owner_id
          AND title IN (
              '大安路精裝兩房採光宅', '信義世貿三房', '中山捷運套房',
              '內湖科技兩房', '木柵捷運三房', '板橋府中三房',
              '中和景觀兩房', '新店碧潭兩房', '七期精裝兩房', '北屯親子三房',
              '大安精品三房', '信義高樓景觀宅', '中山雙捷兩房',
              '北投溫泉透天', '板橋車站兩房', '新莊副都心兩房',
              '七期高層三房', '南屯透天別墅', '竹科生活圈兩房', '竹北高端三房'
          )
    );

    DELETE FROM sale_listing
    WHERE property_id IN (
        SELECT id FROM property
        WHERE owner_user_id = owner_id
          AND title IN (
              '大安路精裝兩房採光宅', '信義世貿三房', '中山捷運套房',
              '內湖科技兩房', '木柵捷運三房', '板橋府中三房',
              '中和景觀兩房', '新店碧潭兩房', '七期精裝兩房', '北屯親子三房',
              '大安精品三房', '信義高樓景觀宅', '中山雙捷兩房',
              '北投溫泉透天', '板橋車站兩房', '新莊副都心兩房',
              '七期高層三房', '南屯透天別墅', '竹科生活圈兩房', '竹北高端三房'
          )
    );

    DELETE FROM property
    WHERE owner_user_id = owner_id
      AND title IN (
          '大安路精裝兩房採光宅', '信義世貿三房', '中山捷運套房',
          '內湖科技兩房', '木柵捷運三房', '板橋府中三房',
          '中和景觀兩房', '新店碧潭兩房', '七期精裝兩房', '北屯親子三房',
          '大安精品三房', '信義高樓景觀宅', '中山雙捷兩房',
          '北投溫泉透天', '板橋車站兩房', '新莊副都心兩房',
          '七期高層三房', '南屯透天別墅', '竹科生活圈兩房', '竹北高端三房'
      );

    -- ============================================================
    -- 出租物件 x 10
    -- ============================================================

    INSERT INTO property (
        owner_user_id, title, address, building_type,
        floor, total_floors, main_area, auxiliary_area, balcony_area,
        shared_area, awning_area, land_area,
        rooms, living_rooms, bathrooms,
        is_corner_unit, has_dark_room, parking_type, security_type, setup_status,
        building_age, management_fee, building_orientation, window_orientation,
        building_structure, exterior_material, building_usage, zoning, units_on_floor,
        created_at, updated_at
    ) VALUES (
        owner_id, '大安路精裝兩房採光宅', '台北市大安區大安路一段168號',
        'BUILDING', 6, 12, 21.5, 3.2, 1.8,
        5.2, 1.5, NULL,
        2, 1, 1,
        FALSE, FALSE, 'NONE', 'PARTTIME', 'READY',
        5, 1500, '南', '東南',
        '鋼筋混凝土', '磁磚', '集合住宅', '第三種住宅區', 6,
        NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'
    ) RETURNING id INTO prop_id;

    INSERT INTO rental_listing (
        property_id, status, duration_days, monthly_rent, deposit_months,
        management_fee_payer, min_lease_months, allow_pets, allow_cooking,
        notes, published_at, expires_at, created_at, updated_at,
        has_sofa, has_bed, has_wardrobe, has_tv, has_fridge,
        has_ac, has_washer, has_water_heater, has_gas, has_internet, has_cable_tv,
        near_school, near_supermarket, near_convenience_store, near_park
    ) VALUES (
        prop_id, 'ACTIVE', 90, 35000, 2,
        'TENANT', 12, TRUE, TRUE,
        '近捷運科技大樓站，採光明亮，可開伙與設籍。',
        NOW() - INTERVAL '9 days', NOW() + INTERVAL '81 days',
        NOW() - INTERVAL '10 days', NOW() - INTERVAL '9 days',
        TRUE, TRUE, TRUE, TRUE, TRUE,
        TRUE, TRUE, TRUE, FALSE, TRUE, FALSE,
        FALSE, TRUE, TRUE, FALSE
    );

    INSERT INTO property (
        owner_user_id, title, address, building_type,
        floor, total_floors, main_area, auxiliary_area, balcony_area,
        shared_area, awning_area, land_area,
        rooms, living_rooms, bathrooms,
        is_corner_unit, has_dark_room, parking_type, security_type, setup_status,
        building_age, management_fee, building_orientation, window_orientation,
        building_structure, exterior_material, building_usage, zoning, units_on_floor,
        created_at, updated_at
    ) VALUES (
        owner_id, '信義世貿三房', '台北市信義區松仁路88號',
        'BUILDING', 8, 25, 32.0, 5.0, 2.5,
        8.5, NULL, NULL,
        3, 2, 2,
        TRUE, FALSE, 'MECHANICAL', 'FULLTIME', 'READY',
        3, 3500, '西南', '南',
        '鋼骨鋼筋混凝土', '石材', '集合住宅', '第三種住宅區', 8,
        NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days'
    ) RETURNING id INTO prop_id;

    INSERT INTO rental_listing (
        property_id, status, duration_days, monthly_rent, deposit_months,
        management_fee_payer, min_lease_months, allow_pets, allow_cooking,
        notes, published_at, expires_at, created_at, updated_at,
        has_sofa, has_bed, has_wardrobe, has_tv, has_fridge,
        has_ac, has_washer, has_water_heater, has_gas, has_internet, has_cable_tv,
        near_school, near_supermarket, near_convenience_store, near_park
    ) VALUES (
        prop_id, 'ACTIVE', 90, 52000, 2,
        'TENANT', 12, FALSE, TRUE,
        '社區管理完善，近世貿中心，機械停車位含租金。',
        NOW() - INTERVAL '8 days', NOW() + INTERVAL '82 days',
        NOW() - INTERVAL '9 days', NOW() - INTERVAL '8 days',
        TRUE, TRUE, TRUE, TRUE, TRUE,
        TRUE, TRUE, TRUE, TRUE, TRUE, TRUE,
        FALSE, TRUE, TRUE, FALSE
    );

    INSERT INTO property (
        owner_user_id, title, address, building_type,
        floor, total_floors, main_area, auxiliary_area,
        shared_area, awning_area, land_area,
        rooms, living_rooms, bathrooms,
        is_corner_unit, has_dark_room, parking_type, security_type, setup_status,
        building_age, building_orientation,
        building_structure, exterior_material, building_usage, zoning, units_on_floor,
        created_at, updated_at
    ) VALUES (
        owner_id, '中山捷運套房', '台北市中山區林森北路186號',
        'STUDIO', 5, 12, 12.0, 1.5,
        NULL, 1.2, NULL,
        1, 0, 1,
        FALSE, FALSE, 'NONE', 'NONE', 'READY',
        15, '東',
        '加強磚造', '磁磚', '集合住宅', '第二種住宅區', 4,
        NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days'
    ) RETURNING id INTO prop_id;

    INSERT INTO rental_listing (
        property_id, status, duration_days, monthly_rent, deposit_months,
        management_fee_payer, min_lease_months, allow_pets, allow_cooking,
        notes, published_at, expires_at, created_at, updated_at,
        has_sofa, has_bed, has_wardrobe, has_tv, has_fridge,
        has_ac, has_washer, has_water_heater, has_gas, has_internet, has_cable_tv,
        near_school, near_supermarket, near_convenience_store, near_park
    ) VALUES (
        prop_id, 'ACTIVE', 90, 16000, 2,
        'TENANT', 6, FALSE, FALSE,
        '近中山國小捷運站，生活機能成熟，適合單身上班族。',
        NOW() - INTERVAL '7 days', NOW() + INTERVAL '83 days',
        NOW() - INTERVAL '8 days', NOW() - INTERVAL '7 days',
        FALSE, FALSE, FALSE, TRUE, TRUE,
        TRUE, FALSE, TRUE, FALSE, TRUE, TRUE,
        FALSE, TRUE, TRUE, FALSE
    );

    INSERT INTO property (
        owner_user_id, title, address, building_type,
        floor, total_floors, main_area, auxiliary_area, balcony_area,
        shared_area, awning_area, land_area,
        rooms, living_rooms, bathrooms,
        is_corner_unit, has_dark_room, parking_type, security_type, setup_status,
        building_age, management_fee, building_orientation, window_orientation,
        building_structure, exterior_material, building_usage, zoning, units_on_floor,
        created_at, updated_at
    ) VALUES (
        owner_id, '內湖科技兩房', '台北市內湖區瑞光路568號',
        'BUILDING', 7, 15, 22.0, 3.5, 2.0,
        4.8, NULL, NULL,
        2, 1, 1,
        FALSE, FALSE, 'RAMP', 'PARTTIME', 'READY',
        8, 2000, '南', '東南',
        '鋼筋混凝土', '磁磚', '集合住宅', '第二種住宅區', 5,
        NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'
    ) RETURNING id INTO prop_id;

    INSERT INTO rental_listing (
        property_id, status, duration_days, monthly_rent, deposit_months,
        management_fee_payer, min_lease_months, allow_pets, allow_cooking,
        notes, published_at, expires_at, created_at, updated_at,
        has_sofa, has_bed, has_wardrobe, has_tv, has_fridge,
        has_ac, has_washer, has_water_heater, has_gas, has_internet, has_cable_tv,
        near_school, near_supermarket, near_convenience_store, near_park
    ) VALUES (
        prop_id, 'ACTIVE', 90, 28000, 2,
        'TENANT', 12, FALSE, TRUE,
        '步行至內湖科技園區，含機車停車位，有電梯。',
        NOW() - INTERVAL '6 days', NOW() + INTERVAL '84 days',
        NOW() - INTERVAL '7 days', NOW() - INTERVAL '6 days',
        FALSE, TRUE, TRUE, FALSE, TRUE,
        TRUE, TRUE, TRUE, FALSE, TRUE, FALSE,
        FALSE, TRUE, TRUE, FALSE
    );

    INSERT INTO property (
        owner_user_id, title, address, building_type,
        floor, total_floors, main_area, auxiliary_area, balcony_area,
        shared_area, awning_area, land_area,
        rooms, living_rooms, bathrooms,
        is_corner_unit, has_dark_room, parking_type, security_type, setup_status,
        building_age, management_fee, building_orientation, window_orientation,
        building_structure, exterior_material, building_usage, zoning, units_on_floor,
        created_at, updated_at
    ) VALUES (
        owner_id, '木柵捷運三房', '台北市文山區木柵路四段200號',
        'APARTMENT', 3, 5, 38.0, 6.0, 3.5,
        NULL, 2.0, NULL,
        3, 2, 2,
        TRUE, FALSE, 'NONE', 'NONE', 'READY',
        20, 1200, '東南', '東',
        '加強磚造', '磁磚（整建）', '集合住宅', '第二種住宅區', 3,
        NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days'
    ) RETURNING id INTO prop_id;

    INSERT INTO rental_listing (
        property_id, status, duration_days, monthly_rent, deposit_months,
        management_fee_payer, min_lease_months, allow_pets, allow_cooking,
        notes, published_at, expires_at, created_at, updated_at,
        has_sofa, has_bed, has_wardrobe, has_tv, has_fridge,
        has_ac, has_washer, has_water_heater, has_gas, has_internet, has_cable_tv,
        near_school, near_supermarket, near_convenience_store, near_park
    ) VALUES (
        prop_id, 'ACTIVE', 90, 32000, 2,
        'OWNER', 12, TRUE, TRUE,
        '近木柵捷運站，前後陽台，適合家庭入住，可養寵物。',
        NOW() - INTERVAL '5 days', NOW() + INTERVAL '85 days',
        NOW() - INTERVAL '6 days', NOW() - INTERVAL '5 days',
        TRUE, TRUE, TRUE, TRUE, TRUE,
        TRUE, TRUE, TRUE, TRUE, TRUE, FALSE,
        TRUE, TRUE, TRUE, TRUE
    );

    INSERT INTO property (
        owner_user_id, title, address, building_type,
        floor, total_floors, main_area, auxiliary_area, balcony_area,
        shared_area, awning_area, land_area,
        rooms, living_rooms, bathrooms,
        is_corner_unit, has_dark_room, parking_type, security_type, setup_status,
        building_age, management_fee, building_orientation, window_orientation,
        building_structure, exterior_material, building_usage, zoning, units_on_floor,
        created_at, updated_at
    ) VALUES (
        owner_id, '板橋府中三房', '新北市板橋區府中路30號',
        'APARTMENT', 4, 8, 34.0, 5.5, 3.0,
        NULL, 2.5, NULL,
        3, 2, 2,
        FALSE, FALSE, 'RAMP', 'NONE', 'READY',
        18, 1500, '南', '南',
        '磚造', NULL, '集合住宅', '第三種住宅區', 4,
        NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'
    ) RETURNING id INTO prop_id;

    INSERT INTO rental_listing (
        property_id, status, duration_days, monthly_rent, deposit_months,
        management_fee_payer, min_lease_months, allow_pets, allow_cooking,
        notes, published_at, expires_at, created_at, updated_at,
        has_sofa, has_bed, has_wardrobe, has_tv, has_fridge,
        has_ac, has_washer, has_water_heater, has_gas, has_internet, has_cable_tv,
        near_school, near_supermarket, near_convenience_store, near_park
    ) VALUES (
        prop_id, 'ACTIVE', 90, 38000, 2,
        'TENANT', 12, TRUE, TRUE,
        '步行至府中捷運站，含坡道停車位，屋況良好。',
        NOW() - INTERVAL '4 days', NOW() + INTERVAL '86 days',
        NOW() - INTERVAL '5 days', NOW() - INTERVAL '4 days',
        TRUE, TRUE, TRUE, FALSE, TRUE,
        TRUE, TRUE, TRUE, TRUE, FALSE, TRUE,
        TRUE, TRUE, TRUE, FALSE
    );

    INSERT INTO property (
        owner_user_id, title, address, building_type,
        floor, total_floors, main_area, auxiliary_area, balcony_area,
        shared_area, awning_area, land_area,
        rooms, living_rooms, bathrooms,
        is_corner_unit, has_dark_room, parking_type, security_type, setup_status,
        building_age, management_fee, building_orientation, window_orientation,
        building_structure, exterior_material, building_usage, zoning, units_on_floor,
        created_at, updated_at
    ) VALUES (
        owner_id, '中和景觀兩房', '新北市中和區景平路688號',
        'BUILDING', 12, 20, 20.0, 3.0, 1.5,
        4.0, NULL, NULL,
        2, 1, 1,
        FALSE, FALSE, 'MECHANICAL', 'FULLTIME', 'READY',
        6, 2500, '北', '北',
        '鋼筋混凝土', '磁磚', '集合住宅', '第三種住宅區', 6,
        NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'
    ) RETURNING id INTO prop_id;

    INSERT INTO rental_listing (
        property_id, status, duration_days, monthly_rent, deposit_months,
        management_fee_payer, min_lease_months, allow_pets, allow_cooking,
        notes, published_at, expires_at, created_at, updated_at,
        has_sofa, has_bed, has_wardrobe, has_tv, has_fridge,
        has_ac, has_washer, has_water_heater, has_gas, has_internet, has_cable_tv,
        near_school, near_supermarket, near_convenience_store, near_park
    ) VALUES (
        prop_id, 'ACTIVE', 90, 24000, 2,
        'TENANT', 12, FALSE, TRUE,
        '高樓層景觀，近中和環路，社區有管理員，機械停車。',
        NOW() - INTERVAL '3 days', NOW() + INTERVAL '87 days',
        NOW() - INTERVAL '4 days', NOW() - INTERVAL '3 days',
        FALSE, FALSE, TRUE, TRUE, TRUE,
        TRUE, FALSE, TRUE, FALSE, TRUE, FALSE,
        FALSE, TRUE, TRUE, TRUE
    );

    INSERT INTO property (
        owner_user_id, title, address, building_type,
        floor, total_floors, main_area, auxiliary_area, balcony_area,
        shared_area, awning_area, land_area,
        rooms, living_rooms, bathrooms,
        is_corner_unit, has_dark_room, parking_type, security_type, setup_status,
        building_age, management_fee, building_orientation, window_orientation,
        building_structure, exterior_material, building_usage, zoning, units_on_floor,
        created_at, updated_at
    ) VALUES (
        owner_id, '新店碧潭兩房', '新北市新店區中正路138號',
        'BUILDING', 6, 14, 25.0, 4.0, 2.0,
        4.5, 1.8, NULL,
        2, 1, 1,
        TRUE, FALSE, 'NONE', 'NONE', 'READY',
        10, 1800, '東', '東南',
        '鋼筋混凝土', '磁磚', '集合住宅', '第三種住宅區', 5,
        NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'
    ) RETURNING id INTO prop_id;

    INSERT INTO rental_listing (
        property_id, status, duration_days, monthly_rent, deposit_months,
        management_fee_payer, min_lease_months, allow_pets, allow_cooking,
        notes, published_at, expires_at, created_at, updated_at,
        has_sofa, has_bed, has_wardrobe, has_tv, has_fridge,
        has_ac, has_washer, has_water_heater, has_gas, has_internet, has_cable_tv,
        near_school, near_supermarket, near_convenience_store, near_park
    ) VALUES (
        prop_id, 'ACTIVE', 90, 26000, 2,
        'OWNER', 12, TRUE, TRUE,
        '近碧潭風景區，環境優美，步行至新店捷運站，可設籍。',
        NOW() - INTERVAL '2 days', NOW() + INTERVAL '88 days',
        NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days',
        TRUE, TRUE, TRUE, FALSE, TRUE,
        TRUE, TRUE, TRUE, FALSE, TRUE, FALSE,
        TRUE, FALSE, TRUE, TRUE
    );

    INSERT INTO property (
        owner_user_id, title, address, building_type,
        floor, total_floors, main_area, auxiliary_area, balcony_area,
        shared_area, awning_area, land_area,
        rooms, living_rooms, bathrooms,
        is_corner_unit, has_dark_room, parking_type, security_type, setup_status,
        building_age, management_fee, building_orientation, window_orientation,
        building_structure, exterior_material, building_usage, zoning, units_on_floor,
        created_at, updated_at
    ) VALUES (
        owner_id, '七期精裝兩房', '台中市西屯區市政北七路200號',
        'BUILDING', 15, 30, 26.0, 4.2, 2.2,
        5.5, NULL, NULL,
        2, 1, 2,
        FALSE, FALSE, 'MECHANICAL', 'FULLTIME', 'READY',
        4, 3200, '南', '西南',
        '鋼骨鋼筋混凝土', '玻璃帷幕', '集合住宅', '第三種住宅區', 4,
        NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'
    ) RETURNING id INTO prop_id;

    INSERT INTO rental_listing (
        property_id, status, duration_days, monthly_rent, deposit_months,
        management_fee_payer, min_lease_months, allow_pets, allow_cooking,
        notes, published_at, expires_at, created_at, updated_at,
        has_sofa, has_bed, has_wardrobe, has_tv, has_fridge,
        has_ac, has_washer, has_water_heater, has_gas, has_internet, has_cable_tv,
        near_school, near_supermarket, near_convenience_store, near_park
    ) VALUES (
        prop_id, 'ACTIVE', 90, 22000, 2,
        'TENANT', 12, FALSE, TRUE,
        '台中七期核心地段，高樓層視野開闊，社區設施完善。',
        NOW() - INTERVAL '1 day', NOW() + INTERVAL '89 days',
        NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day',
        TRUE, TRUE, TRUE, TRUE, TRUE,
        TRUE, TRUE, TRUE, TRUE, TRUE, TRUE,
        FALSE, TRUE, TRUE, FALSE
    );

    INSERT INTO property (
        owner_user_id, title, address, building_type,
        floor, total_floors, main_area, auxiliary_area, balcony_area,
        shared_area, awning_area, land_area,
        rooms, living_rooms, bathrooms,
        is_corner_unit, has_dark_room, parking_type, security_type, setup_status,
        building_age, management_fee, building_orientation, window_orientation,
        building_structure, exterior_material, building_usage, zoning, units_on_floor,
        created_at, updated_at
    ) VALUES (
        owner_id, '北屯親子三房', '台中市北屯區北屯路399號',
        'APARTMENT', 2, 7, 35.0, 5.5, 3.0,
        NULL, NULL, NULL,
        3, 2, 2,
        FALSE, FALSE, 'RAMP', 'NONE', 'READY',
        12, 1000, '東南', '東',
        '加強磚造', '磁磚', '集合住宅', '第二種住宅區', 3,
        NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'
    ) RETURNING id INTO prop_id;

    INSERT INTO rental_listing (
        property_id, status, duration_days, monthly_rent, deposit_months,
        management_fee_payer, min_lease_months, allow_pets, allow_cooking,
        notes, published_at, expires_at, created_at, updated_at,
        has_sofa, has_bed, has_wardrobe, has_tv, has_fridge,
        has_ac, has_washer, has_water_heater, has_gas, has_internet, has_cable_tv,
        near_school, near_supermarket, near_convenience_store, near_park
    ) VALUES (
        prop_id, 'ACTIVE', 90, 20000, 2,
        'TENANT', 12, TRUE, TRUE,
        '鄰近北屯運動公園，適合親子家庭，含坡道停車位。',
        NOW() - INTERVAL '12 hours', NOW() + INTERVAL '89 days' + INTERVAL '12 hours',
        NOW() - INTERVAL '1 day', NOW() - INTERVAL '12 hours',
        TRUE, TRUE, TRUE, TRUE, TRUE,
        TRUE, TRUE, TRUE, FALSE, TRUE, FALSE,
        TRUE, FALSE, TRUE, TRUE
    );

    -- ============================================================
    -- 出售物件 x 10
    -- ============================================================

    INSERT INTO property (
        owner_user_id, title, address, building_type,
        floor, total_floors, main_area, auxiliary_area, balcony_area,
        shared_area, awning_area, land_area,
        rooms, living_rooms, bathrooms,
        is_corner_unit, has_dark_room, parking_type, security_type, setup_status,
        building_age, management_fee, building_orientation, window_orientation,
        building_structure, exterior_material, building_usage, zoning, units_on_floor,
        created_at, updated_at
    ) VALUES (
        owner_id, '大安精品三房', '台北市大安區仁愛路四段380號',
        'BUILDING', 8, 16, 42.0, 7.0, 3.2,
        8.2, NULL, NULL,
        3, 2, 2,
        TRUE, FALSE, 'MECHANICAL', 'FULLTIME', 'READY',
        2, 4500, '南', '東南',
        '鋼筋混凝土', '石材', '集合住宅', '第三種住宅區', 4,
        NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days'
    ) RETURNING id INTO prop_id;

    INSERT INTO sale_listing (
        property_id, status, duration_days, total_price, unit_price_per_ping,
        notes, published_at, expires_at, created_at, updated_at
    ) VALUES (
        prop_id, 'ACTIVE', 90, 45000000, 1071429,
        '屋況極佳，含裝潢，近大安森林公園，全棟安管。',
        NOW() - INTERVAL '14 days', NOW() + INTERVAL '76 days',
        NOW() - INTERVAL '15 days', NOW() - INTERVAL '14 days'
    );

    INSERT INTO property (
        owner_user_id, title, address, building_type,
        floor, total_floors, main_area, auxiliary_area, balcony_area,
        shared_area, awning_area, land_area,
        rooms, living_rooms, bathrooms,
        is_corner_unit, has_dark_room, parking_type, security_type, setup_status,
        building_age, management_fee, building_orientation, window_orientation,
        building_structure, exterior_material, building_usage, zoning, units_on_floor,
        created_at, updated_at
    ) VALUES (
        owner_id, '信義高樓景觀宅', '台北市信義區信義路五段168號',
        'BUILDING', 22, 35, 50.0, 8.5, 4.0,
        12.0, NULL, NULL,
        3, 2, 2,
        FALSE, FALSE, 'TOWER', 'FULLTIME', 'READY',
        5, 5500, '西南', '西南',
        '鋼骨鋼筋混凝土', '玻璃帷幕', '集合住宅', '第三種住宅區', 5,
        NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'
    ) RETURNING id INTO prop_id;

    INSERT INTO sale_listing (
        property_id, status, duration_days, total_price, unit_price_per_ping,
        notes, published_at, expires_at, created_at, updated_at
    ) VALUES (
        prop_id, 'ACTIVE', 90, 68000000, 1360000,
        '信義計畫區高層，台北101及港景一覽無遺，塔式停車，全棟管理。',
        NOW() - INTERVAL '13 days', NOW() + INTERVAL '77 days',
        NOW() - INTERVAL '14 days', NOW() - INTERVAL '13 days'
    );

    INSERT INTO property (
        owner_user_id, title, address, building_type,
        floor, total_floors, main_area, auxiliary_area, balcony_area,
        shared_area, awning_area, land_area,
        rooms, living_rooms, bathrooms,
        is_corner_unit, has_dark_room, parking_type, security_type, setup_status,
        building_age, management_fee, building_orientation, window_orientation,
        building_structure, exterior_material, building_usage, zoning, units_on_floor,
        created_at, updated_at
    ) VALUES (
        owner_id, '中山雙捷兩房', '台北市中山區中山北路二段48號',
        'APARTMENT', 4, 12, 28.0, 4.5, 2.0,
        NULL, 2.2, NULL,
        2, 1, 1,
        FALSE, FALSE, 'NONE', 'NONE', 'READY',
        25, 1200, '東', '東',
        '加強磚造', '磁磚（整建）', '集合住宅', '第二種住宅區', 4,
        NOW() - INTERVAL '13 days', NOW() - INTERVAL '13 days'
    ) RETURNING id INTO prop_id;

    INSERT INTO sale_listing (
        property_id, status, duration_days, total_price, unit_price_per_ping,
        notes, published_at, expires_at, created_at, updated_at
    ) VALUES (
        prop_id, 'ACTIVE', 90, 28000000, 1000000,
        '雙捷運交匯，屋齡新，近中山商圈，自住投資皆宜。',
        NOW() - INTERVAL '12 days', NOW() + INTERVAL '78 days',
        NOW() - INTERVAL '13 days', NOW() - INTERVAL '12 days'
    );

    INSERT INTO property (
        owner_user_id, title, address, building_type,
        floor, total_floors, main_area, auxiliary_area, balcony_area,
        shared_area, awning_area, land_area,
        rooms, living_rooms, bathrooms,
        is_corner_unit, has_dark_room, parking_type, security_type, setup_status,
        building_age, building_orientation, window_orientation,
        building_structure, exterior_material, building_usage, zoning, units_on_floor,
        created_at, updated_at
    ) VALUES (
        owner_id, '北投溫泉透天', '台北市北投區中山路66號',
        'TOWNHOUSE', 1, 3, 65.0, 10.0, 5.0,
        NULL, 1.5, 30.0,
        4, 3, 3,
        TRUE, FALSE, 'RAMP', 'NONE', 'READY',
        30, '南', '南',
        '磚造', '洗石子', '透天住宅', '第一種住宅區', NULL,
        NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days'
    ) RETURNING id INTO prop_id;

    INSERT INTO sale_listing (
        property_id, status, duration_days, total_price, unit_price_per_ping,
        notes, published_at, expires_at, created_at, updated_at
    ) VALUES (
        prop_id, 'ACTIVE', 90, 52000000, 800000,
        '北投溫泉區，透天獨棟，私人庭院，溫泉引管，三代同堂首選。',
        NOW() - INTERVAL '11 days', NOW() + INTERVAL '79 days',
        NOW() - INTERVAL '12 days', NOW() - INTERVAL '11 days'
    );

    INSERT INTO property (
        owner_user_id, title, address, building_type,
        floor, total_floors, main_area, auxiliary_area, balcony_area,
        shared_area, awning_area, land_area,
        rooms, living_rooms, bathrooms,
        is_corner_unit, has_dark_room, parking_type, security_type, setup_status,
        building_age, management_fee, building_orientation, window_orientation,
        building_structure, exterior_material, building_usage, zoning, units_on_floor,
        created_at, updated_at
    ) VALUES (
        owner_id, '板橋車站兩房', '新北市板橋區縣民大道二段68號',
        'BUILDING', 9, 22, 30.0, 5.0, 2.5,
        6.0, NULL, NULL,
        2, 1, 2,
        FALSE, FALSE, 'TOWER', 'PARTTIME', 'READY',
        8, 2800, '東南', '東',
        '鋼筋混凝土', '磁磚', '集合住宅', '第三種住宅區', 6,
        NOW() - INTERVAL '11 days', NOW() - INTERVAL '11 days'
    ) RETURNING id INTO prop_id;

    INSERT INTO sale_listing (
        property_id, status, duration_days, total_price, unit_price_per_ping,
        notes, published_at, expires_at, created_at, updated_at
    ) VALUES (
        prop_id, 'ACTIVE', 90, 26000000, 866667,
        '步行至板橋車站（高鐵/台鐵/捷運），交通便利，屋況整潔。',
        NOW() - INTERVAL '10 days', NOW() + INTERVAL '80 days',
        NOW() - INTERVAL '11 days', NOW() - INTERVAL '10 days'
    );

    INSERT INTO property (
        owner_user_id, title, address, building_type,
        floor, total_floors, main_area, auxiliary_area, balcony_area,
        shared_area, awning_area, land_area,
        rooms, living_rooms, bathrooms,
        is_corner_unit, has_dark_room, parking_type, security_type, setup_status,
        building_age, management_fee, building_orientation, window_orientation,
        building_structure, exterior_material, building_usage, zoning, units_on_floor,
        created_at, updated_at
    ) VALUES (
        owner_id, '新莊副都心兩房', '新北市新莊區新泰路386號',
        'BUILDING', 5, 18, 24.0, 4.0, 2.0,
        4.5, NULL, NULL,
        2, 1, 1,
        FALSE, FALSE, 'MECHANICAL', 'NONE', 'READY',
        4, 2200, '南', '西南',
        '鋼筋混凝土', '磁磚', '集合住宅', '第三種住宅區', 5,
        NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'
    ) RETURNING id INTO prop_id;

    INSERT INTO sale_listing (
        property_id, status, duration_days, total_price, unit_price_per_ping,
        notes, published_at, expires_at, created_at, updated_at
    ) VALUES (
        prop_id, 'ACTIVE', 90, 19800000, 825000,
        '新莊副都心發展區，近捷運輔大站，含機械停車位。',
        NOW() - INTERVAL '9 days', NOW() + INTERVAL '81 days',
        NOW() - INTERVAL '10 days', NOW() - INTERVAL '9 days'
    );

    INSERT INTO property (
        owner_user_id, title, address, building_type,
        floor, total_floors, main_area, auxiliary_area, balcony_area,
        shared_area, awning_area, land_area,
        rooms, living_rooms, bathrooms,
        is_corner_unit, has_dark_room, parking_type, security_type, setup_status,
        building_age, management_fee, building_orientation, window_orientation,
        building_structure, exterior_material, building_usage, zoning, units_on_floor,
        created_at, updated_at
    ) VALUES (
        owner_id, '七期高層三房', '台中市西屯區惠中路三段68號',
        'BUILDING', 18, 28, 54.0, 9.0, 4.0,
        14.0, NULL, NULL,
        3, 2, 2,
        FALSE, FALSE, 'MECHANICAL', 'FULLTIME', 'READY',
        6, 5000, '西', '西南',
        '鋼骨鋼筋混凝土', '玻璃帷幕', '集合住宅', '第三種住宅區', 4,
        NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days'
    ) RETURNING id INTO prop_id;

    INSERT INTO sale_listing (
        property_id, status, duration_days, total_price, unit_price_per_ping,
        notes, published_at, expires_at, created_at, updated_at
    ) VALUES (
        prop_id, 'ACTIVE', 90, 38000000, 703704,
        '台中七期高樓層，視野遼闊，含裝潢，社區安管完善。',
        NOW() - INTERVAL '8 days', NOW() + INTERVAL '82 days',
        NOW() - INTERVAL '9 days', NOW() - INTERVAL '8 days'
    );

    INSERT INTO property (
        owner_user_id, title, address, building_type,
        floor, total_floors, main_area, auxiliary_area, balcony_area,
        shared_area, awning_area, land_area,
        rooms, living_rooms, bathrooms,
        is_corner_unit, has_dark_room, parking_type, security_type, setup_status,
        building_age, building_orientation, window_orientation,
        building_structure, exterior_material, building_usage, zoning, units_on_floor,
        created_at, updated_at
    ) VALUES (
        owner_id, '南屯透天別墅', '台中市南屯區文心南路二段186號',
        'TOWNHOUSE', 1, 4, 58.0, 9.5, 4.5,
        NULL, NULL, 25.0,
        4, 3, 3,
        TRUE, FALSE, 'RAMP', 'NONE', 'READY',
        10, '東南', '東',
        '鋼骨造', '磁磚', '透天住宅', '第二種住宅區', NULL,
        NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days'
    ) RETURNING id INTO prop_id;

    INSERT INTO sale_listing (
        property_id, status, duration_days, total_price, unit_price_per_ping,
        notes, published_at, expires_at, created_at, updated_at
    ) VALUES (
        prop_id, 'ACTIVE', 90, 32000000, 551724,
        '台中精華地段透天，前後庭院，坡道停車，適合三代同堂。',
        NOW() - INTERVAL '7 days', NOW() + INTERVAL '83 days',
        NOW() - INTERVAL '8 days', NOW() - INTERVAL '7 days'
    );

    INSERT INTO property (
        owner_user_id, title, address, building_type,
        floor, total_floors, main_area, auxiliary_area, balcony_area,
        shared_area, awning_area, land_area,
        rooms, living_rooms, bathrooms,
        is_corner_unit, has_dark_room, parking_type, security_type, setup_status,
        building_age, management_fee, building_orientation, window_orientation,
        building_structure, exterior_material, building_usage, zoning, units_on_floor,
        created_at, updated_at
    ) VALUES (
        owner_id, '竹科生活圈兩房', '新竹市東區光復路二段168號',
        'BUILDING', 6, 15, 26.0, 4.2, 2.0,
        5.0, NULL, NULL,
        2, 1, 1,
        FALSE, FALSE, 'RAMP', 'NONE', 'READY',
        3, 2000, '南', '東南',
        '鋼筋混凝土', '磁磚', '集合住宅', '第二種住宅區', 5,
        NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'
    ) RETURNING id INTO prop_id;

    INSERT INTO sale_listing (
        property_id, status, duration_days, total_price, unit_price_per_ping,
        notes, published_at, expires_at, created_at, updated_at
    ) VALUES (
        prop_id, 'ACTIVE', 90, 22000000, 846154,
        '距竹科約10分鐘，屋齡較新，採光良好，生活機能完整。',
        NOW() - INTERVAL '6 days', NOW() + INTERVAL '84 days',
        NOW() - INTERVAL '7 days', NOW() - INTERVAL '6 days'
    );

    INSERT INTO property (
        owner_user_id, title, address, building_type,
        floor, total_floors, main_area, auxiliary_area, balcony_area,
        shared_area, awning_area, land_area,
        rooms, living_rooms, bathrooms,
        is_corner_unit, has_dark_room, parking_type, security_type, setup_status,
        building_age, management_fee, building_orientation, window_orientation,
        building_structure, exterior_material, building_usage, zoning, units_on_floor,
        created_at, updated_at
    ) VALUES (
        owner_id, '竹北高端三房', '新竹縣竹北市縣政九路168號',
        'BUILDING', 10, 24, 38.0, 6.5, 3.0,
        8.0, NULL, NULL,
        3, 2, 2,
        FALSE, FALSE, 'MECHANICAL', 'FULLTIME', 'READY',
        1, 3800, '南', '西南',
        '鋼骨鋼筋混凝土', '石材', '集合住宅', '第一種住宅區', 4,
        NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days'
    ) RETURNING id INTO prop_id;

    INSERT INTO sale_listing (
        property_id, status, duration_days, total_price, unit_price_per_ping,
        notes, published_at, expires_at, created_at, updated_at
    ) VALUES (
        prop_id, 'ACTIVE', 90, 29000000, 763158,
        '竹北市精華區，近高鐵竹北站，品牌建商社區，全棟管理。',
        NOW() - INTERVAL '5 days', NOW() + INTERVAL '85 days',
        NOW() - INTERVAL '6 days', NOW() - INTERVAL '5 days'
    );
END $$;
