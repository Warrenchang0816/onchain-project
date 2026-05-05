import type { TaiwanDistrictOption } from "../../api/listingApi";

export type DistrictSelection = {
    county: string;
    district: string;
    postalCode: string;
};

export type DistrictGroup = {
    county: string;
    districts: TaiwanDistrictOption[];
};

export type DistrictSelectionMode = "single" | "multi";

const countyOrder = [
    "台北市",
    "新北市",
    "基隆市",
    "桃園市",
    "新竹市",
    "新竹縣",
    "苗栗縣",
    "台中市",
    "彰化縣",
    "南投縣",
    "雲林縣",
    "嘉義市",
    "嘉義縣",
    "台南市",
    "高雄市",
    "屏東縣",
    "宜蘭縣",
    "花蓮縣",
    "台東縣",
    "澎湖縣",
    "金門縣",
    "連江縣",
];

function countyRank(county: string): number {
    const index = countyOrder.indexOf(county);
    return index >= 0 ? index : countyOrder.length;
}

export function encodeDistrictToken(option: TaiwanDistrictOption | DistrictSelection): string {
    const postalCode = "postal_code" in option ? option.postal_code : option.postalCode;
    return `${option.county}:${option.district}:${postalCode}`;
}

export function districtOptionToSelection(option: TaiwanDistrictOption): DistrictSelection {
    return {
        county: option.county,
        district: option.district,
        postalCode: option.postal_code,
    };
}

export function districtRecordToSelection(district: { county: string; district: string; zipCode: string }): DistrictSelection {
    return {
        county: district.county,
        district: district.district,
        postalCode: district.zipCode,
    };
}

export function groupDistrictOptions(options: TaiwanDistrictOption[]): DistrictGroup[] {
    const groups = new Map<string, TaiwanDistrictOption[]>();
    for (const option of options) {
        groups.set(option.county, [...(groups.get(option.county) ?? []), option]);
    }

    return [...groups.entries()]
        .sort(([a], [b]) => countyRank(a) - countyRank(b) || a.localeCompare(b, "zh-TW"))
        .map(([county, districts]) => ({
            county,
            districts: [...districts].sort((a, b) => Number(a.postal_code) - Number(b.postal_code) || a.district.localeCompare(b.district, "zh-TW")),
        }));
}

export function toggleDistrictSelection(current: DistrictSelection[], option: TaiwanDistrictOption, mode: DistrictSelectionMode): DistrictSelection[] {
    const next = districtOptionToSelection(option);
    const token = encodeDistrictToken(next);

    if (mode === "single") {
        return current.length === 1 && encodeDistrictToken(current[0]) === token ? [] : [next];
    }

    if (current.some((item) => encodeDistrictToken(item) === token)) {
        return current.filter((item) => encodeDistrictToken(item) !== token);
    }
    return [...current, next];
}

export function getDistrictSelectionSummary(selection: DistrictSelection[]): string {
    if (selection.length === 0) return "不限行政區";

    const counties = new Set(selection.map((item) => item.county));
    if (selection.length === 1) return `${selection[0].county} ${selection[0].district}`;
    if (counties.size === 1) return `${selection[0].county} ${selection.length} 區`;
    return `${counties.size} 縣市 ${selection.length} 區`;
}
