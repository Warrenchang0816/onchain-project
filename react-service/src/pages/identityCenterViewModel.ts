import type { AgentDetailResponse } from "@/api/agentApi";
import type { CredentialCenterItem, CredentialType } from "@/api/credentialApi";
import type { Listing } from "@/api/listingApi";
import type { TenantProfile, TenantRequirement } from "@/api/tenantApi";

export type RoleActivationState = "inactive" | "pending" | "ready" | "active" | "rejected";

export type RoleDashboardSummary = {
    title: string;
    state: RoleActivationState;
    statusLabel: string;
    primaryActionLabel: string;
    primaryActionPath: string;
    secondaryActions: Array<{ label: string; path: string }>;
    metrics: Array<{ label: string; value: string | number }>;
    nextStep: string;
};

const credentialPaths: Record<CredentialType, string> = {
    OWNER: "/credential/owner",
    TENANT: "/credential/tenant",
    AGENT: "/credential/agent",
};

function activationState(item?: CredentialCenterItem): RoleActivationState {
    if (!item) return "inactive";
    if (item.displayStatus === "ACTIVATED") return "active";
    if (item.displayStatus === "PASSED_READY") return "ready";
    if (item.displayStatus === "FAILED" || item.displayStatus === "REVOKED") return "rejected";
    return "pending";
}

function inactiveSummary(type: CredentialType, title: string, nextStep: string): RoleDashboardSummary {
    return {
        title,
        state: "inactive",
        statusLabel: "未啟用",
        primaryActionLabel: "啟用身分",
        primaryActionPath: credentialPaths[type],
        secondaryActions: [],
        metrics: [{ label: "狀態", value: "未申請" }],
        nextStep,
    };
}

export function buildOwnerSummary(item: CredentialCenterItem | undefined, listings: Listing[]): RoleDashboardSummary {
    const state = activationState(item);
    if (state !== "active") {
        return inactiveSummary("OWNER", "房東工作台", "啟用房東身分後，可以管理物件、補齊刊登資料並發布出租或出售資訊。");
    }

    const draft = listings.filter((listing) => listing.status === "DRAFT");
    const active = listings.filter((listing) => listing.status === "ACTIVE");
    const incomplete = draft.filter((listing) => listing.setup_status === "INCOMPLETE");
    const ready = draft.filter((listing) => listing.setup_status === "READY");

    return {
        title: "房東工作台",
        state,
        statusLabel: "已啟用",
        primaryActionLabel: "管理物件",
        primaryActionPath: "/my/listings",
        secondaryActions: [{ label: "新增刊登", path: "/my/listings/new" }],
        metrics: [
            { label: "待補資料", value: incomplete.length },
            { label: "可發布草稿", value: ready.length },
            { label: "已上架", value: active.length },
        ],
        nextStep: listings.length === 0 ? "目前沒有物件，先建立或啟用房東資料來產生第一筆草稿。" : "檢查草稿是否已補齊出租或出售明細。",
    };
}

export function buildTenantSummary(
    item: CredentialCenterItem | undefined,
    requirements: TenantRequirement[],
    profile?: TenantProfile,
): RoleDashboardSummary {
    const state = activationState(item);
    if (state !== "active") {
        return inactiveSummary("TENANT", "租客工作台", "啟用租客身分後，可以建立租屋需求並補充租客資料。");
    }

    const open = requirements.filter((requirement) => requirement.status === "OPEN");
    const paused = requirements.filter((requirement) => requirement.status === "PAUSED");

    return {
        title: "租客工作台",
        state,
        statusLabel: profile?.advancedDataStatus === "ADVANCED" ? "進階資料已完成" : "基本資料",
        primaryActionLabel: "管理需求",
        primaryActionPath: "/my/requirements",
        secondaryActions: [{ label: "租客資料", path: "/my/tenant-profile" }],
        metrics: [
            { label: "開放中", value: open.length },
            { label: "暫停", value: paused.length },
            { label: "資料狀態", value: profile?.advancedDataStatus === "ADVANCED" ? "進階" : "基本" },
        ],
        nextStep: requirements.length === 0 ? "建立第一筆租屋需求，讓房東與仲介看見你的條件。" : "維護需求狀態，讓開放中的需求保持可被瀏覽。",
    };
}

export function buildAgentSummary(item: CredentialCenterItem | undefined, profile: AgentDetailResponse | null, wallet?: string): RoleDashboardSummary {
    const state = activationState(item);
    if (state !== "active") {
        return inactiveSummary("AGENT", "仲介工作台", "啟用仲介身分後，可以建立公開個人頁並出現在仲介列表。");
    }

    return {
        title: "仲介工作台",
        state,
        statusLabel: profile?.isProfileComplete ? "公開頁已完成" : "公開頁未完成",
        primaryActionLabel: "編輯個人頁",
        primaryActionPath: "/my/agent-profile",
        secondaryActions: wallet ? [{ label: "查看公開頁", path: `/agents/${wallet}` }] : [{ label: "仲介列表", path: "/agents" }],
        metrics: [
            { label: "服務區域", value: profile?.serviceAreas.length ?? 0 },
            { label: "公開頁", value: profile?.isProfileComplete ? "已完成" : "未完成" },
            { label: "證照備註", value: profile?.licenseNote ? "已填寫" : "待補" },
        ],
        nextStep: profile?.isProfileComplete ? "定期更新服務區域與公開說明。" : "補齊標題、介紹、服務區域與證照說明，讓公開頁可被信任。",
    };
}
