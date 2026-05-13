const API = import.meta.env.VITE_API_GO_SERVICE_URL || "http://localhost:8081/api";

export type PropertySetupStatus = "DRAFT" | "READY" | "ARCHIVED" | "REMOVED";
export type BuildingType = "APARTMENT" | "BUILDING" | "TOWNHOUSE" | "STUDIO";
export type ParkingType = "NONE" | "RAMP" | "MECHANICAL" | "TOWER";
export type SecurityType = "NONE" | "FULLTIME" | "PARTTIME";
export type AttachmentType = "PHOTO" | "DEED" | "FLOOR_PLAN" | "DISCLOSURE";

export type PropertyAttachment = {
    id: number;
    type: AttachmentType;
    url: string;
    created_at: string;
};

export type Property = {
    id: number;
    owner_user_id: number;
    title: string;
    address: string;
    district_id?: number;
    building_type: string;
    floor?: number;
    total_floors?: number;
    main_area?: number;
    auxiliary_area?: number;
    balcony_area?: number;
    shared_area?: number;
    awning_area?: number;
    land_area?: number;
    rooms?: number;
    living_rooms?: number;
    bathrooms?: number;
    is_corner_unit: boolean;
    has_dark_room: boolean;
    building_age?: number;
    building_structure?: string;
    exterior_material?: string;
    building_usage?: string;
    zoning?: string;
    units_on_floor?: number;
    building_orientation?: string;
    window_orientation?: string;
    parking_type: string;
    management_fee?: number;
    security_type: string;
    setup_status: PropertySetupStatus;
    attachments: PropertyAttachment[];
    created_at: string;
    updated_at: string;
};

export type CreatePropertyPayload = {
    title: string;
    address: string;
};

export type UpdatePropertyPayload = {
    title?: string;
    address?: string;
    building_type?: string;
    floor?: number;
    total_floors?: number;
    main_area?: number;
    auxiliary_area?: number;
    balcony_area?: number;
    shared_area?: number;
    awning_area?: number;
    land_area?: number;
    rooms?: number;
    living_rooms?: number;
    bathrooms?: number;
    is_corner_unit?: boolean;
    has_dark_room?: boolean;
    building_age?: number;
    building_structure?: string;
    exterior_material?: string;
    building_usage?: string;
    zoning?: string;
    units_on_floor?: number;
    building_orientation?: string;
    window_orientation?: string;
    parking_type?: string;
    management_fee?: number;
    security_type?: string;
};

async function parse<T>(res: Response): Promise<T> {
    const raw = await res.text();
    const data = raw ? (JSON.parse(raw) as T & { error?: string; message?: string }) : ({} as T & { error?: string; message?: string });
    if (!res.ok) throw new Error((data as { error?: string; message?: string }).error ?? (data as { message?: string }).message ?? raw ?? `Request failed: ${res.status}`);
    return data;
}

export async function listMyProperties(): Promise<Property[]> {
    const res = await fetch(`${API}/property`, { credentials: "include" });
    const data = await parse<{ data: Property[] }>(res);
    return data.data;
}

export async function getProperty(id: number): Promise<Property> {
    const res = await fetch(`${API}/property/${id}`, { credentials: "include" });
    const data = await parse<{ data: Property }>(res);
    return data.data;
}

export async function createProperty(payload: CreatePropertyPayload): Promise<{ id: number }> {
    const res = await fetch(`${API}/property`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const data = await parse<{ data: { id: number } }>(res);
    return data.data;
}

export async function updateProperty(id: number, payload: UpdatePropertyPayload): Promise<void> {
    const res = await fetch(`${API}/property/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    await parse<unknown>(res);
}

export async function addAttachment(propertyId: number, type: AttachmentType, url: string): Promise<{ id: number }> {
    const res = await fetch(`${API}/property/${propertyId}/attachment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type, url }),
    });
    const data = await parse<{ data: { id: number } }>(res);
    return data.data;
}

export async function deleteAttachment(propertyId: number, attachmentId: number): Promise<void> {
    const res = await fetch(`${API}/property/${propertyId}/attachment/${attachmentId}`, {
        method: "DELETE",
        credentials: "include",
    });
    await parse<unknown>(res);
}

export async function uploadPropertyPhoto(
    propertyId: number,
    file: File,
): Promise<{ id: number; url: string }> {
    const form = new FormData();
    form.append("photo", file);
    const res = await fetch(`${API}/property/${propertyId}/attachment/photo`, {
        method: "POST",
        credentials: "include",
        body: form,
    });
    const data = await parse<{ data: { id: number; url: string } }>(res);
    return data.data;
}

export async function removeProperty(id: number): Promise<void> {
    const res = await fetch(`${API}/property/${id}/remove`, {
        method: "PUT",
        credentials: "include",
    });
    await parse<unknown>(res);
}
