const API_BASE_URL = import.meta.env.VITE_API_GO_SERVICE_URL || "http://localhost:8081/api";

type ApiEnvelope<T> = {
    success?: boolean;
    message?: string;
    error?: string;
    data?: T;
};

async function unwrap<T>(res: Response): Promise<T> {
    const raw = await res.text();
    let parsed: ApiEnvelope<T> | null = null;

    if (raw) {
        try {
            parsed = JSON.parse(raw) as ApiEnvelope<T>;
        } catch {
            throw new Error(raw.trim() || `Request failed: ${res.status}`);
        }
    }

    if (!res.ok || !parsed?.success) {
        throw new Error(parsed?.message || parsed?.error || raw.trim() || `Request failed: ${res.status}`);
    }

    return parsed.data as T;
}

export type TenantAdvancedDataStatus = "BASIC" | "ADVANCED";
export type TenantRequirementStatus = "OPEN" | "PAUSED" | "CLOSED";
export type TenantDocumentType = "INCOME_PROOF" | "HOUSEHOLD_DOC" | "OTHER";

export type TenantProfileDocument = {
    id: number;
    docType: TenantDocumentType;
};

export type TenantProfile = {
    occupationType: string;
    orgName: string;
    incomeRange: string;
    householdSize: number;
    coResidentNote: string;
    moveInTimeline: string;
    additionalNote: string;
    advancedDataStatus: TenantAdvancedDataStatus;
    documents: TenantProfileDocument[];
};

export type TenantRequirement = {
    id: number;
    targetDistrict: string;
    budgetMin: number;
    budgetMax: number;
    layoutNote: string;
    moveInDate?: string;
    petFriendlyNeeded: boolean;
    parkingNeeded: boolean;
    status: TenantRequirementStatus;
    hasAdvancedData: boolean;
    occupationType?: string;
    incomeRange?: string;
    moveInTimeline?: string;
    createdAt: string;
    updatedAt: string;
};

export type TenantProfilePayload = Omit<TenantProfile, "advancedDataStatus" | "documents">;

export type TenantRequirementPayload = {
    targetDistrict: string;
    budgetMin: number;
    budgetMax: number;
    layoutNote: string;
    moveInDate?: string | null;
    petFriendlyNeeded: boolean;
    parkingNeeded: boolean;
};

export async function getMyTenantProfile(): Promise<TenantProfile> {
    const res = await fetch(`${API_BASE_URL}/tenant/profile`, {
        method: "GET",
        credentials: "include",
    });
    return unwrap<TenantProfile>(res);
}

export async function updateMyTenantProfile(payload: TenantProfilePayload): Promise<TenantProfile> {
    const res = await fetch(`${API_BASE_URL}/tenant/profile`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    return unwrap<TenantProfile>(res);
}

export async function uploadMyTenantDocument(docType: TenantDocumentType, file: File): Promise<TenantProfile> {
    const form = new FormData();
    form.append("docType", docType);
    form.append("file", file);

    const res = await fetch(`${API_BASE_URL}/tenant/profile/documents`, {
        method: "POST",
        credentials: "include",
        body: form,
    });
    return unwrap<TenantProfile>(res);
}

export async function getMyRequirements(): Promise<TenantRequirement[]> {
    const res = await fetch(`${API_BASE_URL}/tenant/requirements/mine`, {
        method: "GET",
        credentials: "include",
    });
    const data = await unwrap<{ items: TenantRequirement[] }>(res);
    return data.items;
}

export async function createRequirement(payload: TenantRequirementPayload): Promise<TenantRequirement> {
    const res = await fetch(`${API_BASE_URL}/tenant/requirements`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    return unwrap<TenantRequirement>(res);
}

export async function updateRequirement(id: number, payload: TenantRequirementPayload): Promise<TenantRequirement> {
    const res = await fetch(`${API_BASE_URL}/tenant/requirements/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    return unwrap<TenantRequirement>(res);
}

export async function updateRequirementStatus(id: number, status: TenantRequirementStatus): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/tenant/requirements/${id}/status`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
    });
    await unwrap<unknown>(res);
}

export async function getRequirementList(filters?: { district?: string; status?: TenantRequirementStatus }): Promise<TenantRequirement[]> {
    const qs = new URLSearchParams();
    if (filters?.district) qs.set("district", filters.district);
    if (filters?.status) qs.set("status", filters.status);

    const res = await fetch(`${API_BASE_URL}/requirements${qs.toString() ? `?${qs}` : ""}`, {
        method: "GET",
        credentials: "include",
    });
    const data = await unwrap<{ items: TenantRequirement[] }>(res);
    return data.items;
}

export async function getRequirementDetail(id: number): Promise<TenantRequirement> {
    const res = await fetch(`${API_BASE_URL}/requirements/${id}`, {
        method: "GET",
        credentials: "include",
    });
    return unwrap<TenantRequirement>(res);
}
