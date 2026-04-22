import type { CredentialDisplayStatus } from "@/api/credentialApi";

export const CREDENTIAL_STATUS_LABEL: Record<CredentialDisplayStatus, string> = {
    NOT_STARTED: "尚未申請",
    SMART_REVIEWING: "智能審核中",
    MANUAL_REVIEWING: "人工審核中",
    PASSED_READY: "已通過，待啟用",
    FAILED: "未通過",
    ACTIVATED: "已啟用",
    REVOKED: "已撤銷",
};
