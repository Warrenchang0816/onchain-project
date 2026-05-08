const API = import.meta.env.VITE_API_GO_SERVICE_URL || "http://localhost:8081/api";

export type SaleListingStatus = "DRAFT" | "ACTIVE" | "NEGOTIATING" | "LOCKED" | "CLOSED" | "EXPIRED";

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
    has_dark_room: boolean;
    shared_area?: number;
    awning_area?: number;
    land_area?: number;
    building_structure?: string;
    exterior_material?: string;
    building_usage?: string;
    zoning?: string;
    units_on_floor?: number;
};

export type SaleListing = {
    id: number;
    property_id: number;
    status: SaleListingStatus;
    duration_days: number;
    total_price: number;
    unit_price_per_ping?: number;
    parking_type?: string;
    parking_price?: number;
    notes?: string;
    published_at?: string;
    expires_at?: string;
    created_at: string;
    updated_at: string;
    property?: PropertySummary;
};

export type CreateSaleListingPayload = {
    total_price: number;
    unit_price_per_ping?: number;
    parking_type?: string;
    parking_price?: number;
    notes?: string;
    duration_days: number;
};

export type UpdateSaleListingPayload = Partial<CreateSaleListingPayload>;

async function parse<T>(res: Response): Promise<T> {
    const raw = await res.text();
    const data = raw ? (JSON.parse(raw) as T & { error?: string; message?: string }) : ({} as T & { error?: string; message?: string });
    if (!res.ok) throw new Error((data as { error?: string; message?: string }).error ?? (data as { message?: string }).message ?? raw ?? `Request failed: ${res.status}`);
    return data;
}

export async function getSaleListings(): Promise<SaleListing[]> {
    const res = await fetch(`${API}/sale-listing`, { credentials: "include" });
    const data = await parse<{ data: SaleListing[] }>(res);
    return data.data ?? [];
}

export async function getSaleListing(id: number): Promise<SaleListing> {
    const res = await fetch(`${API}/sale-listing/${id}`, { credentials: "include" });
    const data = await parse<{ data: SaleListing }>(res);
    return data.data;
}

export async function getSaleListingForProperty(propertyId: number): Promise<SaleListing | null> {
    const res = await fetch(`${API}/property/${propertyId}/sale-listing`, { credentials: "include" });
    const data = await parse<{ data: SaleListing | null }>(res);
    return data.data;
}

export async function createSaleListing(propertyId: number, payload: CreateSaleListingPayload): Promise<{ id: number }> {
    const res = await fetch(`${API}/property/${propertyId}/sale-listing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const data = await parse<{ data: { id: number } }>(res);
    return data.data;
}

export async function updateSaleListing(id: number, payload: UpdateSaleListingPayload): Promise<void> {
    const res = await fetch(`${API}/sale-listing/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    await parse<unknown>(res);
}

export async function publishSaleListing(id: number, durationDays: number): Promise<void> {
    const res = await fetch(`${API}/sale-listing/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ duration_days: durationDays }),
    });
    await parse<unknown>(res);
}

export async function closeSaleListing(id: number): Promise<void> {
    const res = await fetch(`${API}/sale-listing/${id}/close`, {
        method: "POST",
        credentials: "include",
    });
    await parse<unknown>(res);
}
