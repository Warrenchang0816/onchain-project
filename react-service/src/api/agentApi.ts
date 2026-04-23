const API_BASE_URL = import.meta.env.VITE_API_GO_SERVICE_URL || "http://localhost:8081/api";

export type AgentListItem = {
    walletAddress: string;
    displayName?: string;
    activatedAt: string;
    nftTokenId: number;
};

export type AgentDetailResponse = {
    walletAddress: string;
    displayName?: string;
    activatedAt: string;
    nftTokenId: number;
    txHash: string;
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
        throw new Error(parsed?.message || parsed?.error || `Request failed: ${res.status}`);
    }
    return parsed.data as T;
}

export async function getAgentList(): Promise<{ items: AgentListItem[] }> {
    const res = await fetch(`${API_BASE_URL}/agents`);
    return unwrap<{ items: AgentListItem[] }>(res);
}

export async function getAgentDetail(wallet: string): Promise<AgentDetailResponse> {
    const res = await fetch(`${API_BASE_URL}/agents/${wallet}`);
    return unwrap<AgentDetailResponse>(res);
}
