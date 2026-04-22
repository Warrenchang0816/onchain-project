import type { ListingType } from "../../api/listingApi";

export type ListingEditorValues = {
    title: string;
    description: string;
    address: string;
    district: string;
    listType: ListingType;
    price: string;
    areaPing: string;
    floor: string;
    totalFloors: string;
    roomCount: string;
    bathroomCount: string;
    isPetAllowed: boolean;
    isParkingIncluded: boolean;
    durationDays: string;
};

export function createListingEditorInitialValues(): ListingEditorValues {
    return {
        title: "",
        description: "",
        address: "",
        district: "",
        listType: "RENT",
        price: "",
        areaPing: "",
        floor: "",
        totalFloors: "",
        roomCount: "",
        bathroomCount: "",
        isPetAllowed: false,
        isParkingIncluded: false,
        durationDays: "30",
    };
}

export function listingToEditorValues(payload: {
    title: string;
    description?: string;
    address: string;
    district?: string;
    list_type: ListingType;
    price: number;
    area_ping?: number;
    floor?: number;
    total_floors?: number;
    room_count?: number;
    bathroom_count?: number;
    is_pet_allowed: boolean;
    is_parking_included: boolean;
}): ListingEditorValues {
    return {
        title: payload.title,
        description: payload.description ?? "",
        address: payload.address,
        district: payload.district ?? "",
        listType: payload.list_type,
        price: String(payload.price),
        areaPing: payload.area_ping !== undefined ? String(payload.area_ping) : "",
        floor: payload.floor !== undefined ? String(payload.floor) : "",
        totalFloors: payload.total_floors !== undefined ? String(payload.total_floors) : "",
        roomCount: payload.room_count !== undefined ? String(payload.room_count) : "",
        bathroomCount: payload.bathroom_count !== undefined ? String(payload.bathroom_count) : "",
        isPetAllowed: payload.is_pet_allowed,
        isParkingIncluded: payload.is_parking_included,
        durationDays: "30",
    };
}
