import assert from "node:assert/strict";
import {
    encodeDistrictToken,
    getDistrictSelectionSummary,
    groupDistrictOptions,
    toggleDistrictSelection,
    type DistrictSelection,
} from "../src/components/location/districtSelection.ts";
import type { TaiwanDistrictOption } from "../src/api/listingApi.ts";

const options: TaiwanDistrictOption[] = [
    { id: 1, county: "台北市", district: "大安區", postal_code: "106" },
    { id: 2, county: "台北市", district: "信義區", postal_code: "110" },
    { id: 3, county: "新北市", district: "板橋區", postal_code: "220" },
];

assert.equal(encodeDistrictToken(options[0]), "台北市:大安區:106");

const groups = groupDistrictOptions(options);
assert.equal(groups.length, 2);
assert.equal(groups[0]?.county, "台北市");

let selected: DistrictSelection[] = [];
selected = toggleDistrictSelection(selected, options[0], "multi");
selected = toggleDistrictSelection(selected, options[2], "multi");
assert.equal(selected.length, 2);
assert.equal(getDistrictSelectionSummary(selected), "2 縣市 2 區");

selected = toggleDistrictSelection(selected, options[0], "multi");
assert.deepEqual(selected.map((item) => item.district), ["板橋區"]);

selected = toggleDistrictSelection(selected, options[0], "single");
selected = toggleDistrictSelection(selected, options[1], "single");
assert.deepEqual(selected.map((item) => item.district), ["信義區"]);

console.log("districtSelection tests passed");
