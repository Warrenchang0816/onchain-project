const API = import.meta.env.VITE_API_GO_SERVICE_URL || "http://localhost:8081/api";

export type RentalListingStatus = "DRAFT" | "ACTIVE" | "NEGOTIATING" | "LOCKED" | "CLOSED" | "EXPIRED";
export type ManagementFeePayer = "TENANT" | "OWNER" | "SPLIT";
export type GenderRestriction = "MALE" | "FEMALE" | "NONE";

export type PropertySummary = {
    id: number;
    title: string;
    address: string;
    building_type: string;
    floor?: number;
    total_floors?: number;
    main_area?: number;
    auxiliary_area?: number;
    balcony_area?: number;
    rooms?: number;
    living_rooms?: number;
    bathrooms?: number;
    building_age?: number;
    parking_type: string;
    management_fee?: number;
    is_corner_unit: boolean;
    security_type: string;
    building_orientation?: string;
    window_orientation?: string;
};

export type RentalListing = {
    id: number;
    property_id: number;
    status: RentalListingStatus;
    duration_days: number;
    monthly_rent: number;
    deposit_months: number;
    management_fee_payer: ManagementFeePayer;
    min_lease_months: number;
    allow_pets: boolean;
    allow_cooking: boolean;
    gender_restriction?: GenderRestriction;
    notes?: string;
    has_sofa: boolean;
    has_bed: boolean;
    has_wardrobe: boolean;
    has_tv: boolean;
    has_fridge: boolean;
    has_ac: boolean;
    has_washer: boolean;
    has_water_heater: boolean;
    has_gas: boolean;
    has_internet: boolean;
    has_cable_tv: boolean;
    near_school: boolean;
    near_supermarket: boolean;
    near_convenience_store: boolean;
    near_park: boolean;
    published_at?: string;
    expires_at?: string;
    created_at: string;
    updated_at: string;
    property?: PropertySummary;
};

export type CreateRentalListingPayload = {
    monthly_rent: number;
    deposit_months: number;
    management_fee_payer: ManagementFeePayer;
    min_lease_months: number;
    allow_pets: boolean;
    allow_cooking: boolean;
    gender_restriction?: string;
    notes?: string;
    duration_days: number;
};

export type UpdateRentalListingPayload = Partial<CreateRentalListingPayload>;

async function parse<T>(res: Response): Promise<T> {
    const raw = await res.text();
    const data = raw ? (JSON.parse(raw) as T & { error?: string; message?: string }) : ({} as T & { error?: string; message?: string });
    if (!res.ok) throw new Error((data as { error?: string; message?: string }).error ?? (data as { message?: string }).message ?? raw ?? `Request failed: ${res.status}`);
    return data;
}

export async function getRentalListings(): Promise<RentalListing[]> {
    const res = await fetch(`${API}/rental-listing`, { credentials: "include" });
    const data = await parse<{ data: RentalListing[] }>(res);
    return data.data ?? [];
}

export async function getRentalListing(id: number): Promise<RentalListing> {
    const res = await fetch(`${API}/rental-listing/${id}`, { credentials: "include" });
    const data = await parse<{ data: RentalListing }>(res);
    return data.data;
}

export async function getRentalListingForProperty(propertyId: number): Promise<RentalListing | null> {
    const res = await fetch(`${API}/property/${propertyId}/rental-listing`, { credentials: "include" });
    const data = await parse<{ data: RentalListing | null }>(res);
    return data.data;
}

export async function createRentalListing(propertyId: number, payload: CreateRentalListingPayload): Promise<{ id: number }> {
    const res = await fetch(`${API}/property/${propertyId}/rental-listing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const data = await parse<{ data: { id: number } }>(res);
    return data.data;
}

export async function updateRentalListing(id: number, payload: UpdateRentalListingPayload): Promise<void> {
    const res = await fetch(`${API}/rental-listing/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    await parse<unknown>(res);
}

export async function publishRentalListing(id: number, durationDays: number): Promise<void> {
    const res = await fetch(`${API}/rental-listing/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ duration_days: durationDays }),
    });
    await parse<unknown>(res);
}

export async function closeRentalListing(id: number): Promise<void> {
    const res = await fetch(`${API}/rental-listing/${id}/close`, {
        method: "POST",
        credentials: "include",
    });
    await parse<unknown>(res);
}
