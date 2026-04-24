const API_BASE_URL = import.meta.env.VITE_API_GO_SERVICE_URL || "http://localhost:8081/api";

export type ListingStatus =
    | "DRAFT"
    | "ACTIVE"
    | "NEGOTIATING"
    | "LOCKED"
    | "SIGNING"
    | "CLOSED"
    | "EXPIRED"
    | "REMOVED"
    | "SUSPENDED";

export type ListingType = "UNSET" | "RENT" | "SALE";
export type ListingSetupStatus = "INCOMPLETE" | "READY";
export type ListingDraftOrigin = "MANUAL_CREATE" | "OWNER_ACTIVATION";

export type AppointmentStatus =
    | "PENDING"
    | "CONFIRMED"
    | "VIEWED"
    | "INTERESTED"
    | "CANCELLED";

export type Appointment = {
    id: number;
    listing_id: number;
    visitor_user_id: number;
    queue_position: number;
    preferred_time: string;
    confirmed_time?: string;
    status: AppointmentStatus;
    note?: string;
    created_at: string;
};

export type Listing = {
    id: number;
    owner_user_id: number;
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
    status: ListingStatus;
    draft_origin: ListingDraftOrigin;
    setup_status: ListingSetupStatus;
    source_credential_submission_id?: number;
    negotiating_appointment?: Appointment;
    appointments?: Appointment[];
    daily_fee_ntd: number;
    published_at?: string;
    expires_at?: string;
    created_at: string;
    updated_at: string;
    is_owner: boolean;
    image_url?: string; // optional cover photo when the backend provides one; UI must not synthesize fake inventory
};

export type CreateListingPayload = {
    title: string;
    description?: string;
    address: string;
    district?: string;
    list_type: Exclude<ListingType, "UNSET">;
    price: number;
    area_ping?: number;
    floor?: number;
    total_floors?: number;
    room_count?: number;
    bathroom_count?: number;
    is_pet_allowed: boolean;
    is_parking_included: boolean;
    duration_days: number;
};

export type UpdateListingPayload = {
    title: string;
    description?: string;
    address: string;
    district?: string;
    list_type?: ListingType;
    price: number;
    area_ping?: number;
    floor?: number;
    total_floors?: number;
    room_count?: number;
    bathroom_count?: number;
    is_pet_allowed: boolean;
    is_parking_included: boolean;
};

async function parseResponse<T>(res: Response): Promise<T> {
    const raw = await res.text();
    const data = raw ? (JSON.parse(raw) as T & { error?: string }) : ({} as T & { error?: string });
    if (!res.ok) {
        throw new Error((data as { error?: string }).error || raw || `Request failed: ${res.status}`);
    }
    return data;
}

// ── Listing queries ──────────────────────────────────────────────────────────

export async function getListings(params?: { type?: Exclude<ListingType, "UNSET">; district?: string }): Promise<Listing[]> {
    const qs = new URLSearchParams();
    if (params?.type) qs.set("type", params.type);
    if (params?.district) qs.set("district", params.district);
    const url = `${API_BASE_URL}/listings${qs.toString() ? `?${qs}` : ""}`;
    const res = await fetch(url, { credentials: "include" });
    const data = await parseResponse<{ data: Listing[] }>(res);
    return data.data;
}

export async function getMyListings(): Promise<Listing[]> {
    const res = await fetch(`${API_BASE_URL}/listings/mine`, { credentials: "include" });
    const data = await parseResponse<{ data: Listing[] }>(res);
    return data.data;
}

export async function getListing(id: number): Promise<Listing> {
    const res = await fetch(`${API_BASE_URL}/listings/${id}`, { credentials: "include" });
    const data = await parseResponse<{ data: Listing }>(res);
    return data.data;
}

// ── Listing mutations ────────────────────────────────────────────────────────

export async function createListing(payload: CreateListingPayload): Promise<{ id: number }> {
    const res = await fetch(`${API_BASE_URL}/listings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const data = await parseResponse<{ data: { id: number } }>(res);
    return data.data;
}

export async function updateListing(id: number, payload: UpdateListingPayload): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/listings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    await parseResponse<unknown>(res);
}

export async function publishListing(id: number, durationDays: number): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/listings/${id}/publish`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ duration_days: durationDays }),
    });
    await parseResponse<unknown>(res);
}

export async function removeListing(id: number): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/listings/${id}/remove`, {
        method: "PUT",
        credentials: "include",
    });
    await parseResponse<unknown>(res);
}

export async function closeListing(id: number): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/listings/${id}/close`, {
        method: "PUT",
        credentials: "include",
    });
    await parseResponse<unknown>(res);
}

export async function lockNegotiation(id: number, appointmentId: number): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/listings/${id}/negotiate`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ appointment_id: appointmentId }),
    });
    await parseResponse<unknown>(res);
}

export async function unlockNegotiation(id: number): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/listings/${id}/unlock`, {
        method: "PUT",
        credentials: "include",
    });
    await parseResponse<unknown>(res);
}

// ── Appointments ─────────────────────────────────────────────────────────────

export async function bookAppointment(listingId: number, preferredTime: string, note?: string): Promise<{ id: number }> {
    const res = await fetch(`${API_BASE_URL}/listings/${listingId}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ preferred_time: preferredTime, note }),
    });
    const data = await parseResponse<{ data: { id: number } }>(res);
    return data.data;
}

export async function confirmAppointment(listingId: number, apptId: number, confirmedTime: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/listings/${listingId}/appointments/${apptId}/confirm`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirmed_time: confirmedTime }),
    });
    await parseResponse<unknown>(res);
}

export async function updateAppointmentStatus(
    listingId: number,
    apptId: number,
    status: "VIEWED" | "INTERESTED" | "CANCELLED",
): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/listings/${listingId}/appointments/${apptId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
    });
    await parseResponse<unknown>(res);
}

export async function cancelAppointment(listingId: number, apptId: number): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/listings/${listingId}/appointments/${apptId}/cancel`, {
        method: "PUT",
        credentials: "include",
    });
    await parseResponse<unknown>(res);
}

/** 鏈上足跡會用到先暫留，後續再修改調整 **/
export type BlockchainLog = {
    id: number;
    taskId: string; // legacy reference id from the pre-housing task flow; field name stays until backend schema changes
    walletAddress: string;
    action: string;
    txHash: string;
    chainId: number;
    contractAddress: string;
    status: string;
    createdAt: string;
};

export async function getBlockchainLogs(): Promise<BlockchainLog[]> {
    const response = await fetch(`${API_BASE_URL}/blockchain-logs`, {
        method: "GET",
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error(`讀取鏈上紀錄失敗：${response.status}`);
    }

    const result: { success: boolean; data: BlockchainLog[]; message: string } = await response.json();

    if (!result.success) {
        throw new Error(result.message || "讀取鏈上紀錄失敗");
    }

    return result.data;
}
