const API_BASE_URL = import.meta.env.VITE_API_GO_SERVICE_URL || "http://localhost:8081/api";

export type AgentListItem = {
    walletAddress: string;
    displayName?: string;
    activatedAt: string;
    nftTokenId: number;
    headline?: string;
    serviceAreas: string[];
    isProfileComplete: boolean;
};

export type AgentDetailResponse = {
    walletAddress: string;
    displayName?: string;
    activatedAt: string;
    nftTokenId: number;
    txHash: string;
    headline?: string;
    bio?: string;
    serviceAreas: string[];
    licenseNote?: string;
    isProfileComplete: boolean;
};

export type AgentListFilters = {
    serviceArea?: string;
    profile?: "complete" | "incomplete";
};

export type UpsertMyAgentProfileRequest = {
    headline: string;
    bio: string;
    serviceAreas: string[];
    licenseNote: string;
    contactPreferences: string;
};

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

export async function getAgentList(filters?: AgentListFilters): Promise<{ items: AgentListItem[] }> {
    const qs = new URLSearchParams();
    if (filters?.serviceArea) qs.set("serviceArea", filters.serviceArea);
    if (filters?.profile) qs.set("profile", filters.profile);
    const res = await fetch(`${API_BASE_URL}/agents${qs.toString() ? `?${qs}` : ""}`);
    return unwrap<{ items: AgentListItem[] }>(res);
}

export async function getAgentDetail(wallet: string): Promise<AgentDetailResponse> {
    const res = await fetch(`${API_BASE_URL}/agents/${wallet}`);
    return unwrap<AgentDetailResponse>(res);
}

export async function getMyAgentProfile(): Promise<AgentDetailResponse> {
    const res = await fetch(`${API_BASE_URL}/agents/me/profile`, {
        method: "GET",
        credentials: "include",
    });
    return unwrap<AgentDetailResponse>(res);
}

export async function updateMyAgentProfile(payload: UpsertMyAgentProfileRequest): Promise<AgentDetailResponse> {
    const res = await fetch(`${API_BASE_URL}/agents/me/profile`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    return unwrap<AgentDetailResponse>(res);
}
