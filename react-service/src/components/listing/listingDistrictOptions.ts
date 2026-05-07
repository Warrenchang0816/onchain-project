export {
    groupDistrictOptions,
    type DistrictGroup,
} from "../location/districtSelection.ts";

import type { DistrictGroup } from "../location/districtSelection.ts";

export function findCountyForSelection(groups: DistrictGroup[], selectedDistrict: string): string {
    if (!selectedDistrict) return groups[0]?.county ?? "";
    const selectedGroup = groups.find((group) => group.county === selectedDistrict || group.districts.some((option) => option.district === selectedDistrict));
    return selectedGroup?.county ?? groups[0]?.county ?? "";
}

export function getDistrictSelectionLabel(selectedDistrict: string): string {
    return selectedDistrict ? selectedDistrict : "不限行政區";
}
