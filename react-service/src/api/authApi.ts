const API_BASE_URL =
    import.meta.env.VITE_API_GO_SERVICE_URL ?? "http://localhost:8081/api";

export interface SIWEMessageRequest {
    address: string;
}

export interface SIWEMessageResponse {
    message: string;
}

export interface SIWEVerifyRequest {
    message: string;
    signature: string;
    address: string;
}

export interface SIWEVerifyResponse {
    authenticated: boolean;
    address: string;
}

export interface AuthMeResponse {
    authenticated: boolean;
    address?: string;
    chainId?: string;
    isPlatformWallet: boolean;
}

export interface AuthLogoutResponse {
    success: boolean;
}

export async function fetchSIWEMessage(
    payload: SIWEMessageRequest
): Promise<SIWEMessageResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/wallet/siwe/message`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error("Failed to fetch SIWE message.");
    }

    return response.json();
}

export async function verifySIWE(
    payload: SIWEVerifyRequest
): Promise<SIWEVerifyResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/wallet/siwe/verify`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error("Failed to verify SIWE signature.");
    }

    return response.json();
}

export async function getAuthMe(): Promise<AuthMeResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: "GET",
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error("Failed to fetch auth status.");
    }

    return response.json();
}

export async function logout(): Promise<AuthLogoutResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error("Failed to logout.");
    }

    return response.json();
}