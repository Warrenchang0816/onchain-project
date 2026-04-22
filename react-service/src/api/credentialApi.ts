const API_BASE_URL = import.meta.env.VITE_API_GO_SERVICE_URL || "http://localhost:8081/api";

export type CredentialType = "OWNER" | "TENANT" | "AGENT";
export type CredentialReviewRoute = "SMART" | "MANUAL";
export type CredentialDisplayStatus =
    | "NOT_STARTED"
    | "SMART_REVIEWING"
    | "MANUAL_REVIEWING"
    | "STOPPED"
    | "PASSED_READY"
    | "FAILED"
    | "ACTIVATED"
    | "REVOKED";

export type CredentialCenterItem = {
    credentialType: CredentialType;
    displayStatus: CredentialDisplayStatus;
    latestSubmissionId?: number;
    reviewRoute?: CredentialReviewRoute;
    summary?: string;
    canActivate: boolean;
    canRetrySmart: boolean;
    canRequestManual: boolean;
    activationTxHash?: string;
};

export type CredentialCenterResponse = {
    kycStatus: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
    items: CredentialCenterItem[];
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
            if (!res.ok) {
                throw new Error(raw.trim() || `Request failed: ${res.status}`);
            }
            throw new Error("API 回應格式錯誤，無法解析 JSON");
        }
    }

    if (!res.ok || !parsed?.success) {
        throw new Error(parsed?.message || parsed?.error || raw.trim() || `Request failed: ${res.status}`);
    }

    return parsed.data as T;
}

export async function getCredentialCenter(): Promise<CredentialCenterResponse> {
    const res = await fetch(`${API_BASE_URL}/credentials/me`, {
        method: "GET",
        credentials: "include",
    });
    return unwrap<CredentialCenterResponse>(res);
}

export async function createCredentialSubmission(
    type: CredentialType,
    payload: { route: CredentialReviewRoute; formPayload: Record<string, string>; notes: string },
): Promise<{ submissionId: number }> {
    const res = await fetch(`${API_BASE_URL}/credentials/${type.toLowerCase()}/submissions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    return unwrap<{ submissionId: number }>(res);
}

export async function uploadCredentialFiles(
    type: CredentialType,
    submissionId: number,
    mainDoc: File,
    supportDoc?: File,
): Promise<void> {
    const form = new FormData();
    form.append("main_doc", mainDoc);
    if (supportDoc) {
        form.append("support_doc", supportDoc);
    }

    const res = await fetch(`${API_BASE_URL}/credentials/${type.toLowerCase()}/submissions/${submissionId}/files`, {
        method: "POST",
        credentials: "include",
        body: form,
    });
    await unwrap<unknown>(res);
}

export async function analyzeCredentialSubmission(type: CredentialType, submissionId: number): Promise<CredentialCenterItem> {
    const res = await fetch(`${API_BASE_URL}/credentials/${type.toLowerCase()}/submissions/${submissionId}/analyze`, {
        method: "POST",
        credentials: "include",
    });
    return unwrap<CredentialCenterItem>(res);
}

export async function requestManualCredentialReview(type: CredentialType, submissionId: number): Promise<CredentialCenterItem> {
    const res = await fetch(`${API_BASE_URL}/credentials/${type.toLowerCase()}/submissions/${submissionId}/manual`, {
        method: "POST",
        credentials: "include",
    });
    return unwrap<CredentialCenterItem>(res);
}

export async function activateCredentialSubmission(type: CredentialType, submissionId: number): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/credentials/${type.toLowerCase()}/submissions/${submissionId}/activate`, {
        method: "POST",
        credentials: "include",
    });
    await unwrap<unknown>(res);
}

export type CredentialSubmissionDetail = {
    submissionId: number;
    credentialType: CredentialType;
    reviewRoute: CredentialReviewRoute;
    displayStatus: CredentialDisplayStatus;
    formPayload: Record<string, string>;
    notes: string;
    summary?: string;
    mainFileUrl?: string;
    supportFileUrl?: string;
    canStopReview: boolean;
    canRestartReview: boolean;
    canActivate: boolean;
    activationTxHash?: string;
};

export async function getLatestCredentialSubmission(type: CredentialType): Promise<CredentialSubmissionDetail | null> {
    const res = await fetch(`${API_BASE_URL}/credentials/${type.toLowerCase()}/submissions/latest`, {
        method: "GET",
        credentials: "include",
    });
    return unwrap<CredentialSubmissionDetail | null>(res);
}

export async function stopCredentialSubmission(type: CredentialType, submissionId: number): Promise<CredentialSubmissionDetail> {
    const res = await fetch(`${API_BASE_URL}/credentials/${type.toLowerCase()}/submissions/${submissionId}/stop`, {
        method: "POST",
        credentials: "include",
    });
    return unwrap<CredentialSubmissionDetail>(res);
}

export function getCredentialSubmissionFileUrl(type: CredentialType, submissionId: number, kind: "main" | "support"): string {
    return `${API_BASE_URL}/credentials/${type.toLowerCase()}/submissions/${submissionId}/files/${kind}`;
}
