const API_BASE_URL = import.meta.env.VITE_API_GO_SERVICE_URL || "http://localhost:8081/api";

export type OnboardingStep =
    | "STARTED"
    | "EMAIL_VERIFIED"
    | "PHONE_VERIFIED"
    | "OCR_DONE"
    | "CONFIRMED"
    | "WALLET_BOUND";

export type UploadKYCResponse = {
    session_id: string;
    step: OnboardingStep;
    stage: "id_card" | "second_doc" | "selfie" | "full";
    id_number?: string;
    id_number_hint: string;
    ocr_name: string;
    ocr_gender?: string;
    ocr_birth_date: string;
    ocr_issue_date?: string;
    ocr_issue_location?: string;
    ocr_address: string;
    ocr_father_name?: string;
    ocr_mother_name?: string;
    face_match_score: number;
    ocr_success: boolean;
};

export type VerifyEmailOTPResponse = {
    session_id: string;
    step: OnboardingStep;
    is_resume?: boolean;
    resume_wizard_step?: string;
    // OCR pre-fill (set whenever is_resume and session has OCR data)
    id_number?: string;
    id_number_hint?: string;
    ocr_name?: string;
    ocr_gender?: string;
    ocr_birth_date?: string;
    ocr_issue_date?: string;
    ocr_issue_location?: string;
    ocr_address?: string;
    ocr_father_name?: string;
    ocr_mother_name?: string;
};

export type WalletMessageResponse = {
    message: string;
};

export type BindWalletResponse = {
    wallet_address: string;
    kyc_status: "PENDING" | "VERIFIED" | "REJECTED" | "UNVERIFIED";
    message: string;
};

/** Thrown when the wallet is already bound to an identity on-chain (HTTP 409). */
export class WalletAlreadyBoundError extends Error {
    readonly idHint: string;
    constructor(idHint: string) {
        super("此錢包已完成身份綁定，若非本人操作請聯絡客服");
        this.name = "WalletAlreadyBoundError";
        this.idHint = idHint;
    }
}

/** Thrown when the email is registered but password was never set (HTTP 409). */
export class EmailNotActivatedError extends Error {
    readonly email: string;
    constructor(email: string) {
        super("此 Email 已完成 KYC 但尚未設定密碼");
        this.name = "EmailNotActivatedError";
        this.email = email;
    }
}

/** Thrown when the email is already registered to another member (HTTP 409). */
export class EmailAlreadyUsedError extends Error {
    readonly idHint: string;
    constructor(idHint: string) {
        super("此 Email 已被其他會員使用");
        this.name = "EmailAlreadyUsedError";
        this.idHint = idHint;
    }
}

/** Thrown when the phone is already registered to another member (HTTP 409). */
export class PhoneAlreadyUsedError extends Error {
    readonly idHint: string;
    constructor(idHint: string) {
        super("此手機號碼已被其他會員使用");
        this.name = "PhoneAlreadyUsedError";
        this.idHint = idHint;
    }
}

/** Thrown when the ID number is already bound to another account (HTTP 409). */
export class IdentityAlreadyUsedError extends Error {
    readonly idHint: string;
    constructor(idHint: string) {
        super("此身分證字號已完成 KYC 綁定，若非本人操作請聯絡客服");
        this.name = "IdentityAlreadyUsedError";
        this.idHint = idHint;
    }
}

async function parseResponse<T>(response: Response): Promise<T> {
    const raw = await response.text();
    const data = raw ? (JSON.parse(raw) as T & { error?: string }) : ({} as T & { error?: string });

    if (!response.ok) {
        throw new Error(data.error || raw || `Request failed: ${response.status}`);
    }

    return data;
}

export type RequestEmailOTPResponse = {
    ok: boolean;
    message?: string;
    has_active_session: boolean;
    active_step?: OnboardingStep;
};

export async function requestEmailOTP(email: string): Promise<RequestEmailOTPResponse> {
    const response = await fetch(`${API_BASE_URL}/onboard/email/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
    });

    return parseResponse<RequestEmailOTPResponse>(response);
}

export async function verifyEmailOTP(email: string, code: string): Promise<VerifyEmailOTPResponse> {
    const response = await fetch(`${API_BASE_URL}/onboard/email/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
    });

    if (response.status === 409) {
        const raw = await response.text();
        const data = raw ? (JSON.parse(raw) as { error_code?: string; id_hint?: string; email?: string }) : {};
        if (data.error_code === "EMAIL_NOT_ACTIVATED") {
            throw new EmailNotActivatedError(data.email ?? "");
        }
        if (data.error_code === "EMAIL_ALREADY_USED") {
            throw new EmailAlreadyUsedError(data.id_hint ?? "");
        }
    }

    return parseResponse<VerifyEmailOTPResponse>(response);
}

export async function restartOnboardingSession(sessionId: string): Promise<VerifyEmailOTPResponse> {
    const response = await fetch(`${API_BASE_URL}/onboard/session/restart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
    });

    return parseResponse<VerifyEmailOTPResponse>(response);
}

export async function requestPhoneOTP(sessionId: string, phone: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/onboard/phone/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, phone }),
    });

    if (response.status === 409) {
        const raw = await response.text();
        const data = raw ? (JSON.parse(raw) as { error_code?: string; id_hint?: string }) : {};
        if (data.error_code === "PHONE_ALREADY_USED") {
            throw new PhoneAlreadyUsedError(data.id_hint ?? "");
        }
    }

    await parseResponse<{ ok: boolean; message?: string }>(response);
}

export async function verifyPhoneOTP(sessionId: string, phone: string, code: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/onboard/phone/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, phone, code }),
    });

    await parseResponse<{ ok: boolean; message?: string }>(response);
}

export async function uploadKYCDocuments(
    sessionId: string,
    stage: "id_card" | "second_doc" | "selfie" | "full",
    payload: {
        idFront?: File | null;
        idBack?: File | null;
        selfie?: File | null;
        secondDoc?: File | null;
    },
): Promise<UploadKYCResponse> {
    const form = new FormData();
    form.append("session_id", sessionId);
    form.append("stage", stage);
    if (payload.idFront) {
        form.append("id_front", payload.idFront);
    }
    if (payload.idBack) {
        form.append("id_back", payload.idBack);
    }
    if (payload.selfie) {
        form.append("selfie", payload.selfie);
    }
    if (payload.secondDoc) {
        form.append("second_doc", payload.secondDoc);
    }

    const response = await fetch(`${API_BASE_URL}/onboard/kyc/upload`, {
        method: "POST",
        body: form,
    });

    return parseResponse<UploadKYCResponse>(response);
}

export async function confirmKYCData(sessionId: string, confirmedName: string, confirmedBirthDate: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/onboard/kyc/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            session_id: sessionId,
            confirmed_name: confirmedName,
            confirmed_birth_date: confirmedBirthDate,
        }),
    });

    await parseResponse<{ ok: boolean; message?: string }>(response);
}

export async function requestWalletMessage(sessionId: string, walletAddress: string): Promise<WalletMessageResponse> {
    const response = await fetch(`${API_BASE_URL}/onboard/wallet/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            session_id: sessionId,
            wallet_address: walletAddress,
        }),
    });

    return parseResponse<WalletMessageResponse>(response);
}

export async function bindWallet(sessionId: string, walletAddress: string, siweMessage: string, siweSignature: string): Promise<BindWalletResponse> {
    const response = await fetch(`${API_BASE_URL}/onboard/wallet/bind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
            session_id: sessionId,
            wallet_address: walletAddress,
            siwe_message: siweMessage,
            siwe_signature: siweSignature,
        }),
    });

    // 409 = wallet already bound to an identity on-chain
    if (response.status === 409) {
        const raw = await response.text();
        const data = raw ? (JSON.parse(raw) as { id_hint?: string }) : {};
        throw new WalletAlreadyBoundError(data.id_hint ?? "");
    }

    return parseResponse<BindWalletResponse>(response);
}
