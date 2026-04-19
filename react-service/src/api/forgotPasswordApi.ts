const API_BASE_URL = import.meta.env.VITE_API_GO_SERVICE_URL || "http://localhost:8081/api";

async function parseResponse<T>(response: Response): Promise<T> {
    const raw = await response.text();
    const data = raw ? (JSON.parse(raw) as T & { error?: string }) : ({} as T & { error?: string });
    if (!response.ok) throw new Error((data as { error?: string }).error || `Request failed: ${response.status}`);
    return data;
}

export async function resetPasswordRequestOTP(email: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/auth/reset-password/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
    });
    await parseResponse<{ ok: boolean }>(response);
}

export async function resetPasswordSetPassword(email: string, code: string, password: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/auth/reset-password/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, password }),
    });
    await parseResponse<{ ok: boolean }>(response);
}
