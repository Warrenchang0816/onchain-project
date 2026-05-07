import type { TenantRequirement, TenantRequirementPayload } from "../../api/tenantApi";
import type { DistrictSelection } from "../location/districtSelection";

export type RequirementFormValues = {
    districts: DistrictSelection[];
    budgetMin: string;
    budgetMax: string;
    areaMinPing: string;
    areaMaxPing: string;
    roomMin: string;
    bathroomMin: string;
    moveInDate: string;
    moveInTimeline: string;
    minimumLeaseMonths: string;
    petFriendlyNeeded: boolean;
    parkingNeeded: boolean;
    canCookNeeded: boolean;
    canRegisterHouseholdNeeded: boolean;
    layoutNote: string;
    lifestyleNote: string;
    mustHaveNote: string;
};

export function createRequirementFormInitialValues(): RequirementFormValues {
    return {
        districts: [],
        budgetMin: "",
        budgetMax: "",
        areaMinPing: "",
        areaMaxPing: "",
        roomMin: "",
        bathroomMin: "",
        moveInDate: "",
        moveInTimeline: "",
        minimumLeaseMonths: "",
        petFriendlyNeeded: false,
        parkingNeeded: false,
        canCookNeeded: false,
        canRegisterHouseholdNeeded: false,
        layoutNote: "",
        lifestyleNote: "",
        mustHaveNote: "",
    };
}

function toNumber(value: string): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function toOptionalNumber(value: string): number | undefined {
    if (value.trim() === "") return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function numberToString(value?: number): string {
    return value === undefined || value === null ? "" : String(value);
}

export function toRequirementPayload(form: RequirementFormValues): TenantRequirementPayload {
    return {
        targetDistrict: "",
        districts: form.districts.map((district) => ({
            county: district.county,
            district: district.district,
            zipCode: district.postalCode,
        })),
        budgetMin: toNumber(form.budgetMin),
        budgetMax: toNumber(form.budgetMax),
        areaMinPing: toOptionalNumber(form.areaMinPing),
        areaMaxPing: toOptionalNumber(form.areaMaxPing),
        roomMin: toNumber(form.roomMin),
        bathroomMin: toNumber(form.bathroomMin),
        layoutNote: form.layoutNote.trim(),
        moveInDate: form.moveInDate || null,
        moveInTimeline: form.moveInTimeline.trim(),
        minimumLeaseMonths: toNumber(form.minimumLeaseMonths),
        petFriendlyNeeded: form.petFriendlyNeeded,
        parkingNeeded: form.parkingNeeded,
        canCookNeeded: form.canCookNeeded,
        canRegisterHouseholdNeeded: form.canRegisterHouseholdNeeded,
        lifestyleNote: form.lifestyleNote.trim(),
        mustHaveNote: form.mustHaveNote.trim(),
    };
}

export function requirementToFormValues(requirement: TenantRequirement): RequirementFormValues {
    return {
        districts: requirement.districts.map((district) => ({
            county: district.county,
            district: district.district,
            postalCode: district.zipCode,
        })),
        budgetMin: numberToString(requirement.budgetMin),
        budgetMax: numberToString(requirement.budgetMax),
        areaMinPing: numberToString(requirement.areaMinPing),
        areaMaxPing: numberToString(requirement.areaMaxPing),
        roomMin: numberToString(requirement.roomMin),
        bathroomMin: numberToString(requirement.bathroomMin),
        moveInDate: requirement.moveInDate ?? "",
        moveInTimeline: requirement.moveInTimeline ?? "",
        minimumLeaseMonths: numberToString(requirement.minimumLeaseMonths),
        petFriendlyNeeded: requirement.petFriendlyNeeded,
        parkingNeeded: requirement.parkingNeeded,
        canCookNeeded: requirement.canCookNeeded,
        canRegisterHouseholdNeeded: requirement.canRegisterHouseholdNeeded,
        layoutNote: requirement.layoutNote,
        lifestyleNote: requirement.lifestyleNote,
        mustHaveNote: requirement.mustHaveNote,
    };
}
