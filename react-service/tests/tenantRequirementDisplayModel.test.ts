import assert from "node:assert/strict";
import {
    buildTenantRequirementDisplayModel,
    getTenantRequirementStatusLabel,
} from "../src/components/tenant/tenantRequirementDisplayModel.ts";
import type { TenantRequirement } from "../src/api/tenantApi.ts";

const requirement: TenantRequirement = {
    id: 12,
    targetDistrict: "台北市 2 區",
    districts: [
        { county: "台北市", district: "大安區", zipCode: "106" },
        { county: "台北市", district: "信義區", zipCode: "110" },
    ],
    budgetMin: 22000,
    budgetMax: 36000,
    areaMinPing: 12,
    areaMaxPing: 24,
    roomMin: 2,
    bathroomMin: 1,
    layoutNote: "希望有對外窗與獨立陽台",
    moveInDate: "2026-06-15",
    moveInTimeline: "一個月內",
    minimumLeaseMonths: 12,
    petFriendlyNeeded: true,
    parkingNeeded: false,
    canCookNeeded: true,
    canRegisterHouseholdNeeded: true,
    lifestyleNote: "作息穩定，偏好安靜社區",
    mustHaveNote: "近捷運，採光佳",
    status: "OPEN",
    hasAdvancedData: true,
    occupationType: "上班族",
    incomeRange: "60,000 以上",
    createdAt: "2026-05-03T00:00:00Z",
    updatedAt: "2026-05-03T00:00:00Z",
    match: {
        score: 86,
        level: "GOOD",
        matchedReasons: ["預算符合", "行政區符合"],
        missingReasons: ["未確認車位"],
    },
};

assert.equal(getTenantRequirementStatusLabel("OPEN"), "開放中");
assert.equal(getTenantRequirementStatusLabel("PAUSED"), "暫停");
assert.equal(getTenantRequirementStatusLabel("CLOSED"), "已結案");

const model = buildTenantRequirementDisplayModel(requirement);

assert.equal(model.title, "台北市 2 區");
assert.equal(model.districtSummary, "台北市 2 區");
assert.equal(model.budgetLabel, "NT$ 22,000 - 36,000");
assert.equal(model.areaLabel, "12 - 24 坪");
assert.equal(model.roomLabel, "至少 2 房");
assert.equal(model.bathroomLabel, "至少 1 衛");
assert.equal(model.moveInLabel, "2026-06-15");
assert.equal(model.leaseLabel, "至少 12 個月");
assert.deepEqual(model.conditionChips, ["需可寵物", "需可開伙", "需可設籍"]);
assert.equal(model.matchLabel, "高度符合 86%");
assert.deepEqual(model.matchReasons, ["預算符合", "行政區符合"]);
assert.deepEqual(model.matchGaps, ["未確認車位"]);

const sparse = buildTenantRequirementDisplayModel({
    ...requirement,
    targetDistrict: "",
    districts: [],
    areaMinPing: undefined,
    areaMaxPing: undefined,
    moveInDate: undefined,
    match: undefined,
});

assert.equal(sparse.title, "未指定行政區");
assert.equal(sparse.districtSummary, "不限行政區");
assert.equal(sparse.areaLabel, "不限坪數");
assert.equal(sparse.moveInLabel, "一個月內");
assert.equal(sparse.matchLabel, "尚未媒合");

console.log("tenantRequirementDisplayModel tests passed");
