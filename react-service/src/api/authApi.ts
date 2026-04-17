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

export interface LoginRequest {
    /** SHA-256(id_number.toUpperCase()) — computed browser-side, raw ID never sent */
    person_hash: string;
    siwe_message: string;
    siwe_signature: string;
    password: string;
}

export interface LoginResponse {
    authenticated: boolean;
    address: string;
    email: string;
    kycStatus: string;
}

export async function login(payload: LoginRequest): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });

    const raw = await response.text();
    const data = raw ? (JSON.parse(raw) as LoginResponse & { error?: string }) : ({} as LoginResponse & { error?: string });

    if (!response.ok) {
        throw new Error(data.error || `登入失敗 (${response.status})`);
    }

    return data;
}

/** Compute SHA-256 of a string using Web Crypto API (no library needed). */
export async function sha256hex(input: string): Promise<string> {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
    return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

export async function setPassword(walletAddress: string, password: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/auth/password/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ wallet_address: walletAddress, password }),
    });

    const raw = await response.text();
    const data = raw ? (JSON.parse(raw) as { error?: string }) : ({} as { error?: string });

    if (!response.ok) {
        throw new Error(data.error || `設定密碼失敗 (${response.status})`);
    }
}