const API_BASE_URL = import.meta.env.VITE_API_GO_SERVICE_URL || "http://localhost:8081/api";

export type UserProfile = {
    walletAddress: string;
    displayName: string;
    email: string;
    phone: string;
    idNumber: string;          // from KYC OCR
    gender: string;            // "男" | "女" | ""
    birthDate: string;         // ROC format from OCR
    registeredAddress: string; // from KYC OCR
    mailingAddress: string;    // user-updatable
    kycStatus: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
    kycSubmittedAt?: string;   // ISO 8601
    kycVerifiedAt?: string;    // ISO 8601
    identityNftTokenId?: number;
    kycMintTxHash?: string;
    credentials: string[];     // ["OWNER", "TENANT", "AGENT"] — verified only
    createdAt: string;         // ISO 8601
};

async function unwrap<T>(res: Response): Promise<T> {
    const raw = await res.text();
    const data = raw
        ? (JSON.parse(raw) as { success?: boolean; message?: string; error?: string; data?: T })
        : ({} as { success?: boolean; message?: string; error?: string; data?: T });

    if (!res.ok || !data.success) {
        throw new Error(data.message ?? data.error ?? `Request failed: ${res.status}`);
    }
    return data.data as T;
}

export async function getUserProfile(): Promise<UserProfile> {
    const res = await fetch(`${API_BASE_URL}/user/profile`, {
        method: "GET",
        credentials: "include",
    });
    return unwrap<UserProfile>(res);
}

export async function requestEmailChangeOTP(newEmail: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/user/profile/email/otp`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: newEmail }),
    });
    await unwrap<null>(res);
}

export async function verifyEmailChange(newEmail: string, otp: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/user/profile/email`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail, otp }),
    });
    await unwrap<null>(res);
}

export async function requestPhoneChangeOTP(newPhone: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/user/profile/phone/otp`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: newPhone }),
    });
    await unwrap<null>(res);
}

export async function verifyPhoneChange(newPhone: string, otp: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/user/profile/phone`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPhone, otp }),
    });
    await unwrap<null>(res);
}

export async function requestMailingAddressOTP(channel: "email" | "phone"): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/user/profile/mailing-address/otp`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
    });
    await unwrap<null>(res);
}

export async function updateMailingAddress(address: string, channel: "email" | "phone", otp: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/user/profile/mailing-address`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, channel, otp }),
    });
    await unwrap<null>(res);
}
