import assert from "node:assert/strict";
import {
    findCountyForSelection,
    getDistrictSelectionLabel,
    groupDistrictOptions,
} from "../src/components/listing/listingDistrictOptions.ts";
import type { TaiwanDistrictOption } from "../src/api/listingApi.ts";

const options: TaiwanDistrictOption[] = [
    { id: 1, county: "台中市", district: "西屯區", postal_code: "407" },
    { id: 2, county: "台北市", district: "大同區", postal_code: "103" },
    { id: 3, county: "台北市", district: "中正區", postal_code: "100" },
];

const groups = groupDistrictOptions(options);

assert.equal(groups[0]?.county, "台北市", "county groups should use the expected Taiwan display order");
assert.deepEqual(
    groups[0]?.districts.map((option) => option.district),
    ["中正區", "大同區"],
    "districts should sort by postal code within the selected county",
);
assert.equal(findCountyForSelection(groups, "大同區"), "台北市", "selected child district should resolve its parent county");
assert.equal(getDistrictSelectionLabel(""), "不限行政區", "empty selection should show the unrestricted label");

console.log("listingDistrictOptions tests passed");
