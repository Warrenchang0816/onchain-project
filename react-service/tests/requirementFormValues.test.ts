import assert from "node:assert/strict";
import {
    createRequirementFormInitialValues,
    requirementToFormValues,
    toRequirementPayload,
} from "../src/components/tenant/requirementFormValues.ts";

const empty = createRequirementFormInitialValues();
assert.deepEqual(empty.districts, []);
assert.equal(empty.budgetMin, "");

const payload = toRequirementPayload({
    ...empty,
    districts: [{ county: "台北市", district: "大安區", postalCode: "106" }],
    budgetMin: "20000",
    budgetMax: "36000",
    areaMinPing: "12",
    roomMin: "1",
    bathroomMin: "1",
    canCookNeeded: true,
});

assert.deepEqual(payload.districts, [{ county: "台北市", district: "大安區", zipCode: "106" }]);
assert.equal(payload.budgetMin, 20000);
assert.equal(payload.areaMinPing, 12);
assert.equal(payload.canCookNeeded, true);

const form = requirementToFormValues({
    id: 1,
    targetDistrict: "台北市 1 區",
    districts: [{ county: "台北市", district: "大安區", zipCode: "106" }],
    budgetMin: 20000,
    budgetMax: 36000,
    layoutNote: "兩房以上",
    petFriendlyNeeded: false,
    parkingNeeded: true,
    canCookNeeded: true,
    canRegisterHouseholdNeeded: false,
    roomMin: 2,
    bathroomMin: 1,
    minimumLeaseMonths: 12,
    lifestyleNote: "作息穩定",
    mustHaveNote: "近捷運",
    status: "OPEN",
    hasAdvancedData: false,
    createdAt: "2026-05-03T00:00:00Z",
    updatedAt: "2026-05-03T00:00:00Z",
});

assert.equal(form.roomMin, "2");
assert.equal(form.districts[0]?.postalCode, "106");

console.log("requirementFormValues tests passed");
