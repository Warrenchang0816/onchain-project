import type {
    Listing,
    UpdateRentDetailsPayload,
    UpdateSaleDetailsPayload,
} from "../../api/listingApi";

type SharedDetailValues = {
    title: string;
    description: string;
    address: string;
    district: string;
    price: string;
    areaPing: string;
    floor: string;
    totalFloors: string;
    roomCount: string;
    bathroomCount: string;
    isPetAllowed: boolean;
    isParkingIncluded: boolean;
};

export type RentDetailValues = SharedDetailValues & {
    monthlyRent: string;
    depositMonths: string;
    managementFeeMonthly: string;
    minimumLeaseMonths: string;
    canRegisterHousehold: boolean;
    canCook: boolean;
    rentNotes: string;
};

export type SaleDetailValues = SharedDetailValues & {
    saleTotalPrice: string;
    saleUnitPricePerPing: string;
    mainBuildingPing: string;
    auxiliaryBuildingPing: string;
    balconyPing: string;
    landPing: string;
    parkingSpaceType: string;
    parkingSpacePrice: string;
    saleNotes: string;
};

function toValue(value?: number): string {
    return value !== undefined ? String(value) : "";
}

function toRequiredNumber(value: string): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function toOptionalNumber(value: string): number | undefined {
    if (value.trim() === "") return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function sharedValues(listing: Listing): SharedDetailValues {
    return {
        title: listing.title,
        description: listing.description ?? "",
        address: listing.address,
        district: listing.district ?? "",
        price: String(listing.price),
        areaPing: toValue(listing.area_ping),
        floor: toValue(listing.floor),
        totalFloors: toValue(listing.total_floors),
        roomCount: toValue(listing.room_count),
        bathroomCount: toValue(listing.bathroom_count),
        isPetAllowed: listing.is_pet_allowed,
        isParkingIncluded: listing.is_parking_included,
    };
}

function sharedPayload(values: SharedDetailValues) {
    return {
        title: values.title.trim(),
        description: values.description.trim() || undefined,
        address: values.address.trim(),
        district: values.district.trim() || undefined,
        price: toRequiredNumber(values.price),
        area_ping: toRequiredNumber(values.areaPing),
        floor: toOptionalNumber(values.floor),
        total_floors: toOptionalNumber(values.totalFloors),
        room_count: toRequiredNumber(values.roomCount),
        bathroom_count: toRequiredNumber(values.bathroomCount),
        is_pet_allowed: values.isPetAllowed,
        is_parking_included: values.isParkingIncluded,
    };
}

export function listingToRentDetailValues(listing: Listing): RentDetailValues {
    return {
        ...sharedValues(listing),
        monthlyRent: toValue(listing.rent_details?.monthly_rent) || String(listing.price || ""),
        depositMonths: toValue(listing.rent_details?.deposit_months),
        managementFeeMonthly: toValue(listing.rent_details?.management_fee_monthly),
        minimumLeaseMonths: toValue(listing.rent_details?.minimum_lease_months),
        canRegisterHousehold: listing.rent_details?.can_register_household ?? false,
        canCook: listing.rent_details?.can_cook ?? false,
        rentNotes: listing.rent_details?.rent_notes ?? "",
    };
}

export function listingToSaleDetailValues(listing: Listing): SaleDetailValues {
    return {
        ...sharedValues(listing),
        saleTotalPrice: toValue(listing.sale_details?.sale_total_price) || String(listing.price || ""),
        saleUnitPricePerPing: toValue(listing.sale_details?.sale_unit_price_per_ping),
        mainBuildingPing: toValue(listing.sale_details?.main_building_ping),
        auxiliaryBuildingPing: toValue(listing.sale_details?.auxiliary_building_ping),
        balconyPing: toValue(listing.sale_details?.balcony_ping),
        landPing: toValue(listing.sale_details?.land_ping),
        parkingSpaceType: listing.sale_details?.parking_space_type ?? "",
        parkingSpacePrice: toValue(listing.sale_details?.parking_space_price),
        saleNotes: listing.sale_details?.sale_notes ?? "",
    };
}

export function rentDetailValuesToPayload(values: RentDetailValues): UpdateRentDetailsPayload {
    return {
        ...sharedPayload(values),
        monthly_rent: toRequiredNumber(values.monthlyRent),
        deposit_months: toRequiredNumber(values.depositMonths),
        management_fee_monthly: toRequiredNumber(values.managementFeeMonthly),
        minimum_lease_months: toRequiredNumber(values.minimumLeaseMonths),
        can_register_household: values.canRegisterHousehold,
        can_cook: values.canCook,
        rent_notes: values.rentNotes.trim(),
    };
}

export function saleDetailValuesToPayload(values: SaleDetailValues): UpdateSaleDetailsPayload {
    return {
        ...sharedPayload(values),
        sale_total_price: toRequiredNumber(values.saleTotalPrice),
        sale_unit_price_per_ping: toOptionalNumber(values.saleUnitPricePerPing),
        main_building_ping: toOptionalNumber(values.mainBuildingPing),
        auxiliary_building_ping: toOptionalNumber(values.auxiliaryBuildingPing),
        balcony_ping: toOptionalNumber(values.balconyPing),
        land_ping: toOptionalNumber(values.landPing),
        parking_space_type: values.parkingSpaceType.trim() || undefined,
        parking_space_price: toOptionalNumber(values.parkingSpacePrice),
        sale_notes: values.saleNotes.trim(),
    };
}
