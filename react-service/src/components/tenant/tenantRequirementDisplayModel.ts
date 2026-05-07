import type { TenantRequirement, TenantRequirementStatus } from "../../api/tenantApi";
import { districtRecordToSelection, getDistrictSelectionSummary } from "../location/districtSelection.ts";

export type TenantRequirementDisplayModel = {
    title: string;
    statusLabel: string;
    districtSummary: string;
    budgetLabel: string;
    areaLabel: string;
    roomLabel: string;
    bathroomLabel: string;
    moveInLabel: string;
    leaseLabel: string;
    conditionChips: string[];
    notes: {
        layout: string;
        lifestyle: string;
        mustHave: string;
    };
    matchLabel: string;
    matchTone: "good" | "partial" | "low" | "none";
    matchReasons: string[];
    matchGaps: string[];
};

const statusLabels: Record<TenantRequirementStatus, string> = {
    OPEN: "開放中",
    PAUSED: "暫停",
    CLOSED: "已結案",
};

function formatCurrency(value: number): string {
    return `NT$ ${value.toLocaleString("zh-TW")}`;
}

function formatRange(min?: number, max?: number, unit = ""): string {
    if (min && max) return `${min} - ${max}${unit}`;
    if (min) return `${min}${unit}以上`;
    if (max) return `${max}${unit}以下`;
    return "";
}

export function getTenantRequirementStatusLabel(status: TenantRequirementStatus): string {
    return statusLabels[status];
}

export function buildTenantRequirementDisplayModel(requirement: TenantRequirement): TenantRequirementDisplayModel {
    const districtSummary = getDistrictSelectionSummary(requirement.districts.map(districtRecordToSelection));
    const matchLevel = requirement.match?.level;
    const matchTone = matchLevel === "GOOD" ? "good" : matchLevel === "PARTIAL" ? "partial" : matchLevel === "LOW" ? "low" : "none";
    const matchPrefix = matchLevel === "GOOD" ? "高度符合" : matchLevel === "PARTIAL" ? "部分符合" : matchLevel === "LOW" ? "低度符合" : "尚未媒合";

    return {
        title: requirement.targetDistrict || (requirement.districts.length > 0 ? districtSummary : "未指定行政區"),
        statusLabel: getTenantRequirementStatusLabel(requirement.status),
        districtSummary,
        budgetLabel: `${formatCurrency(requirement.budgetMin)} - ${requirement.budgetMax.toLocaleString("zh-TW")}`,
        areaLabel: formatRange(requirement.areaMinPing, requirement.areaMaxPing, " 坪") || "不限坪數",
        roomLabel: requirement.roomMin > 0 ? `至少 ${requirement.roomMin} 房` : "不限房數",
        bathroomLabel: requirement.bathroomMin > 0 ? `至少 ${requirement.bathroomMin} 衛` : "不限衛浴",
        moveInLabel: requirement.moveInDate || requirement.moveInTimeline || "時間可議",
        leaseLabel: requirement.minimumLeaseMonths > 0 ? `至少 ${requirement.minimumLeaseMonths} 個月` : "租期可議",
        conditionChips: [
            requirement.petFriendlyNeeded ? "需可寵物" : "",
            requirement.parkingNeeded ? "需車位" : "",
            requirement.canCookNeeded ? "需可開伙" : "",
            requirement.canRegisterHouseholdNeeded ? "需可設籍" : "",
        ].filter(Boolean),
        notes: {
            layout: requirement.layoutNote || "尚未補充格局偏好",
            lifestyle: requirement.lifestyleNote || "尚未補充生活習慣",
            mustHave: requirement.mustHaveNote || "尚未補充必要條件",
        },
        matchLabel: requirement.match ? `${matchPrefix} ${requirement.match.score}%` : matchPrefix,
        matchTone,
        matchReasons: requirement.match?.matchedReasons ?? [],
        matchGaps: requirement.match?.missingReasons ?? [],
    };
}
