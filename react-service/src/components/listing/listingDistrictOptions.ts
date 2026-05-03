import type { TaiwanDistrictOption } from "../../api/listingApi";

export type DistrictGroup = {
    county: string;
    districts: TaiwanDistrictOption[];
};

const preferredCountyOrder = [
    "台北市",
    "新北市",
    "基隆市",
    "宜蘭縣",
    "新竹市",
    "新竹縣",
    "桃園市",
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
    "台東縣",
    "花蓮縣",
    "澎湖縣",
    "金門縣",
    "連江縣",
    "南海諸島",
];

function countyRank(county: string): number {
    const index = preferredCountyOrder.indexOf(county);
    return index >= 0 ? index : preferredCountyOrder.length;
}

export function groupDistrictOptions(options: TaiwanDistrictOption[]): DistrictGroup[] {
    const groups = new Map<string, TaiwanDistrictOption[]>();
    for (const option of options) {
        const group = groups.get(option.county) ?? [];
        group.push(option);
        groups.set(option.county, group);
    }

    return Array.from(groups.entries())
        .sort(([a], [b]) => countyRank(a) - countyRank(b) || a.localeCompare(b, "zh-TW"))
        .map(([county, districts]) => ({
            county,
            districts: [...districts].sort((a, b) => Number(a.postal_code) - Number(b.postal_code) || a.district.localeCompare(b.district, "zh-TW")),
        }));
}

export function findCountyForSelection(groups: DistrictGroup[], selectedDistrict: string): string {
    if (!selectedDistrict) return groups[0]?.county ?? "";
    const selectedGroup = groups.find((group) => group.county === selectedDistrict || group.districts.some((option) => option.district === selectedDistrict));
    return selectedGroup?.county ?? groups[0]?.county ?? "";
}

export function getDistrictSelectionLabel(selectedDistrict: string): string {
    return selectedDistrict ? selectedDistrict : "不限行政區";
}
