const API_BASE_URL = import.meta.env.VITE_API_GO_SERVICE_URL || "http://localhost:8081/api";

export type KYCStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
export type KYCReviewStatus = "DRAFT" | "UPLOADED" | "OCR_PROCESSING" | "FACE_MATCH_PROCESSING" | "PENDING" | "AUTO_VERIFIED" | "MANUAL_REVIEW" | "VERIFIED" | "REJECTED";

export type KYCStatusResponse = {
    kycStatus: KYCStatus;
    identityNftTokenId?: number;
    kycMintTxHash?: string;
    credentials: string[]; // verified credential types: "OWNER" | "TENANT" | "AGENT"
    txHistory?: Array<{
        timestamp: string;
        event: string;
        txHash?: string;
    }>;
};

export type KYCSubmissionCreateResponse = {
    submissionId: number;
    status: string;
    message?: string;
};

export type KYCFieldChecks = {
    fullName: string;
    birthDate: string;
    documentNumber: string;
    address: string;
    faceMatch: string;
};

export type KYCSubmissionDetailResponse = {
    submissionId: number;
    walletAddress: string;
    reviewStatus: KYCReviewStatus;
    ocrSuccess: boolean;
    faceMatchScore?: number;
    ocrName?: string;
    ocrBirthDate?: string;
    ocrAddress?: string;
    fieldChecks?: KYCFieldChecks;
    submittedAt: string;
    reviewedAt?: string;
};

export type SubmitKYCResponse = {
    submissionId: number;
    reviewStatus: KYCReviewStatus;
    faceMatchScore: number;
    ocrSuccess: boolean;
    fieldChecks: KYCFieldChecks;
    message: string;
};

async function unwrap<T>(res: Response): Promise<T> {
    const raw = await res.text();
    let result: { success?: boolean; message?: string; error?: string; data?: T } | null = null;

    if (raw) {
        try {
            result = JSON.parse(raw) as { success?: boolean; message?: string; error?: string; data?: T };
        } catch {
            if (!res.ok) {
                throw new Error(raw.trim() || `Request failed: ${res.status}`);
            }
            throw new Error("API 回應格式錯誤，無法解析 JSON");
        }
    }

    if (!res.ok || !result?.success) {
        throw new Error(result?.message || result?.error || raw.trim() || `Request failed: ${res.status}`);
    }

    return result.data as T;
}

export async function getKYCStatus(): Promise<KYCStatusResponse> {
    const res = await fetch(`${API_BASE_URL}/kyc/me`, {
        method: "GET",
        credentials: "include",
    });
    return unwrap<KYCStatusResponse>(res);
}

export async function createKYCSubmission(documentType = "TW_ID"): Promise<KYCSubmissionCreateResponse> {
    const res = await fetch(`${API_BASE_URL}/kyc/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ documentType }),
    });
    return unwrap<KYCSubmissionCreateResponse>(res);
}

export async function uploadKYCSubmissionDocuments(submissionId: number, idFront: File, idBack: File, selfie: File): Promise<KYCSubmissionCreateResponse> {
    const form = new FormData();
    form.append("id_front", idFront);
    form.append("id_back", idBack);
    form.append("selfie", selfie);

    const res = await fetch(`${API_BASE_URL}/kyc/submissions/${submissionId}/documents`, {
        method: "POST",
        credentials: "include",
        body: form,
    });
    return unwrap<KYCSubmissionCreateResponse>(res);
}

export async function analyzeKYCSubmission(submissionId: number): Promise<SubmitKYCResponse> {
    const res = await fetch(`${API_BASE_URL}/kyc/submissions/${submissionId}/analyze`, {
        method: "POST",
        credentials: "include",
    });
    return unwrap<SubmitKYCResponse>(res);
}

export async function getKYCSubmission(submissionId: number): Promise<KYCSubmissionDetailResponse> {
    const res = await fetch(`${API_BASE_URL}/kyc/submissions/${submissionId}`, {
        method: "GET",
        credentials: "include",
    });
    return unwrap<KYCSubmissionDetailResponse>(res);
}

export async function submitKYC(idFront: File, idBack: File, selfie: File): Promise<SubmitKYCResponse> {
    const created = await createKYCSubmission();
    await uploadKYCSubmissionDocuments(created.submissionId, idFront, idBack, selfie);
    return analyzeKYCSubmission(created.submissionId);
}
