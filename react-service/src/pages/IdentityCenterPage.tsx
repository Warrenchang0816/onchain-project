import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAuthMe } from "@/api/authApi";
import { getCredentialCenter, type CredentialCenterItem, type CredentialCenterResponse, type CredentialType } from "@/api/credentialApi";
import { getMyListings, type Listing } from "@/api/listingApi";
import { getKYCStatus, type KYCStatus, type KYCStatusResponse } from "@/api/kycApi";
import { getMyAgentProfile } from "@/api/agentApi";
import { getMyRequirements, type TenantRequirement } from "@/api/tenantApi";
import { CREDENTIAL_STATUS_LABEL } from "@/components/credential/credentialStatusLabels";
import SiteLayout from "../layouts/SiteLayout";

type IdentityCenterState = {
    loading: boolean;
    authenticated: boolean;
    address?: string;
    kyc?: KYCStatusResponse;
    center?: CredentialCenterResponse;
    ownerListings: Listing[];
    tenantRequirements: TenantRequirement[];
    agentProfileComplete: boolean;
    error?: string;
};

const KYC_STATUS_LABEL: Record<KYCStatus, string> = {
    UNVERIFIED: "尚未驗證",
    PENDING: "審核中",
    VERIFIED: "已驗證",
    REJECTED: "未通過",
};

const roleMeta: Record<CredentialType, { title: string; icon: string; credentialPath: string; workbenchPath: string; description: string }> = {
    OWNER: {
        title: "屋主身份",
        icon: "home",
        credentialPath: "/credential/owner",
        workbenchPath: "/my/listings",
        description: "屋主身份通過後，第一筆名下房源會成為私有草稿；補齊資料後才可上架。",
    },
    TENANT: {
        title: "租客身份",
        icon: "key",
        credentialPath: "/credential/tenant",
        workbenchPath: "/my/requirements",
        description: "租客身份是人的基本資料；租屋需求需由你另外建立與管理。",
    },
    AGENT: {
        title: "仲介身份",
        icon: "work",
        credentialPath: "/credential/agent",
        workbenchPath: "/my/agent-profile",
        description: "仲介身份可建立公開專頁，讓屋主與租客自行判斷服務範圍與可信資訊。",
    },
};

function shortenAddress(address?: string): string {
    if (!address) return "尚未綁定";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function statusBadgeClass(status: KYCStatus): string {
    if (status === "VERIFIED") return "border-tertiary/20 bg-tertiary/10 text-tertiary";
    if (status === "PENDING") return "border-amber-700/20 bg-amber-700/10 text-amber-700";
    if (status === "REJECTED") return "border-error/20 bg-error/10 text-error";
    return "border-outline-variant/20 bg-surface-container text-on-surface-variant";
}

function actionLabel(item: CredentialCenterItem | undefined): string {
    if (!item) return "開始申請";
    if (item.displayStatus === "ACTIVATED") return "進入工作區";
    if (item.displayStatus === "PASSED_READY") return "前往啟用";
    return "查看申請狀態";
}

function RoleCard(props: { type: CredentialType; item?: CredentialCenterItem; onNavigate: (path: string) => void }) {
    const meta = roleMeta[props.type];
    const isActivated = props.item?.displayStatus === "ACTIVATED";
    const path = isActivated ? meta.workbenchPath : meta.credentialPath;

    return (
        <section className="flex flex-col gap-5 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
            <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-container/10">
                    <span className="material-symbols-outlined text-2xl text-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {meta.icon}
                    </span>
                </div>
                <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
                    {props.item ? CREDENTIAL_STATUS_LABEL[props.item.displayStatus] : "尚未申請"}
                </span>
            </div>
            <div>
                <h3 className="text-xl font-bold text-on-surface">{meta.title}</h3>
                <p className="mt-2 text-sm leading-[1.75] text-on-surface-variant">{meta.description}</p>
            </div>
            <button
                type="button"
                onClick={() => props.onNavigate(path)}
                className="mt-auto rounded-xl bg-primary-container px-4 py-3 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90"
            >
                {actionLabel(props.item)}
            </button>
        </section>
    );
}

export default function IdentityCenterPage() {
    const navigate = useNavigate();
    const [state, setState] = useState<IdentityCenterState>({
        loading: true,
        authenticated: false,
        ownerListings: [],
        tenantRequirements: [],
        agentProfileComplete: false,
    });

    useEffect(() => {
        const load = async () => {
            try {
                const auth = await getAuthMe();
                if (!auth.authenticated) {
                    setState((current) => ({ ...current, loading: false, authenticated: false }));
                    return;
                }

                const [kycResult, centerResult] = await Promise.allSettled([getKYCStatus(), getCredentialCenter()]);
                const kyc = kycResult.status === "fulfilled" ? kycResult.value : undefined;
                const center = centerResult.status === "fulfilled" ? centerResult.value : undefined;
                const credentials = kyc?.credentials ?? [];

                const [ownerListings, tenantRequirements, agentProfile] = await Promise.all([
                    credentials.includes("OWNER") ? getMyListings().catch(() => [] as Listing[]) : Promise.resolve([] as Listing[]),
                    credentials.includes("TENANT") ? getMyRequirements().catch(() => [] as TenantRequirement[]) : Promise.resolve([] as TenantRequirement[]),
                    credentials.includes("AGENT") ? getMyAgentProfile().catch(() => null) : Promise.resolve(null),
                ]);

                setState({
                    loading: false,
                    authenticated: true,
                    address: auth.address,
                    kyc,
                    center,
                    ownerListings,
                    tenantRequirements,
                    agentProfileComplete: agentProfile?.isProfileComplete ?? false,
                    error: kycResult.status === "rejected" || centerResult.status === "rejected" ? "部分身份資料讀取失敗，請稍後再試。" : undefined,
                });
            } catch (error) {
                setState({
                    loading: false,
                    authenticated: false,
                    ownerListings: [],
                    tenantRequirements: [],
                    agentProfileComplete: false,
                    error: error instanceof Error ? error.message : "讀取身份中心失敗。",
                });
            }
        };

        void load();
    }, []);

    if (!state.loading && !state.authenticated) {
        return (
            <SiteLayout>
                <main className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-6 py-20 md:px-12">
                    <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-10">
                        <h1 className="text-4xl font-extrabold text-on-surface">身份中心</h1>
                        <p className="mt-4 text-sm leading-[1.8] text-on-surface-variant">請先登入，才能查看 KYC 與角色啟用狀態。</p>
                        {state.error ? <p className="mt-4 text-sm text-error">{state.error}</p> : null}
                        <Link to="/login" className="mt-8 inline-flex rounded-xl bg-primary-container px-6 py-3 text-sm font-bold text-on-primary-container">
                            前往登入
                        </Link>
                    </section>
                </main>
            </SiteLayout>
        );
    }

    const kycStatus = state.kyc?.kycStatus ?? "UNVERIFIED";
    const isVerified = kycStatus === "VERIFIED";
    const centerItems = state.center?.items ?? [];
    const ownerItem = centerItems.find((item) => item.credentialType === "OWNER");
    const tenantItem = centerItems.find((item) => item.credentialType === "TENANT");
    const agentItem = centerItems.find((item) => item.credentialType === "AGENT");
    const activatedItems = centerItems.filter((item) => item.displayStatus === "ACTIVATED");

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-10 px-6 py-12 md:px-12 md:py-16">
                <section className="grid gap-8 lg:grid-cols-[1.35fr_0.65fr]">
                    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8 md:p-10">
                        <span className="inline-flex rounded-full border border-outline-variant/20 bg-surface-container-low px-4 py-2 text-xs font-semibold text-on-surface-variant">
                            身份與角色工作區
                        </span>
                        <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">身份中心</h1>
                        <p className="mt-4 max-w-3xl text-base leading-[1.8] text-on-surface-variant">
                            平台會揭露 KYC 與角色 NFT 狀態，但不替媒合對象背書。屋主、租客、仲介各自管理自己的資料，最後由合作各方自行確認。
                        </p>
                        {state.error ? <p className="mt-4 text-sm text-error">{state.error}</p> : null}

                        <div className="mt-8 grid gap-4 md:grid-cols-3">
                            <div className="rounded-2xl bg-surface-container-low p-5">
                                <p className="text-xs font-semibold text-on-surface-variant">錢包地址</p>
                                <p className="mt-2 font-mono text-lg font-bold text-on-surface">{shortenAddress(state.address)}</p>
                            </div>
                            <div className="rounded-2xl bg-surface-container-low p-5">
                                <p className="text-xs font-semibold text-on-surface-variant">KYC 狀態</p>
                                <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-sm font-bold ${statusBadgeClass(kycStatus)}`}>
                                    {KYC_STATUS_LABEL[kycStatus]}
                                </span>
                            </div>
                            <div className="rounded-2xl bg-surface-container-low p-5">
                                <p className="text-xs font-semibold text-on-surface-variant">自然人 NFT</p>
                                <p className="mt-2 text-lg font-bold text-on-surface">
                                    {state.kyc?.identityNftTokenId !== undefined ? `#${state.kyc.identityNftTokenId}` : "尚未鑄造"}
                                </p>
                            </div>
                        </div>
                    </div>

                    <aside className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                        <h2 className="text-2xl font-bold text-on-surface">快速操作</h2>
                        <div className="mt-6 space-y-3">
                            {isVerified ? (
                                <>
                                    <button type="button" onClick={() => navigate("/credential/owner")} className="w-full rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container">申請屋主身份</button>
                                    <button type="button" onClick={() => navigate("/credential/tenant")} className="w-full rounded-xl border border-outline-variant/25 bg-surface-container-low px-5 py-3 text-sm font-medium text-on-surface">申請租客身份</button>
                                    <button type="button" onClick={() => navigate("/credential/agent")} className="w-full rounded-xl border border-outline-variant/25 bg-surface-container-low px-5 py-3 text-sm font-medium text-on-surface">申請仲介身份</button>
                                </>
                            ) : (
                                <button type="button" onClick={() => navigate("/kyc")} className="w-full rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container">前往 KYC</button>
                            )}
                        </div>
                    </aside>
                </section>

                {state.loading ? (
                    <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-sm text-on-surface-variant">
                        讀取身份中心中...
                    </section>
                ) : (
                    <>
                        <section className="grid gap-6 md:grid-cols-3">
                            <RoleCard type="OWNER" item={ownerItem} onNavigate={navigate} />
                            <RoleCard type="TENANT" item={tenantItem} onNavigate={navigate} />
                            <RoleCard type="AGENT" item={agentItem} onNavigate={navigate} />
                        </section>

                        {activatedItems.length > 0 ? (
                            <section className="grid gap-6 lg:grid-cols-3">
                                {ownerItem?.displayStatus === "ACTIVATED" ? (
                                    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
                                        <h2 className="text-xl font-bold text-on-surface">屋主物件系統</h2>
                                        <p className="mt-2 text-sm text-on-surface-variant">
                                            草稿 {state.ownerListings.filter((item) => item.status === "DRAFT").length} 筆，上架 {state.ownerListings.filter((item) => item.status === "ACTIVE").length} 筆。
                                        </p>
                                        <button type="button" onClick={() => navigate("/my/listings")} className="mt-5 rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container">查看我的房源</button>
                                    </div>
                                ) : null}
                                {tenantItem?.displayStatus === "ACTIVATED" ? (
                                    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
                                        <h2 className="text-xl font-bold text-on-surface">租屋需求</h2>
                                        <p className="mt-2 text-sm text-on-surface-variant">目前共有 {state.tenantRequirements.length} 筆需求，可自行開放、暫停或關閉。</p>
                                        <div className="mt-5 flex flex-wrap gap-3">
                                            <button type="button" onClick={() => navigate("/my/requirements")} className="rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container">管理需求</button>
                                            <button type="button" onClick={() => navigate("/my/tenant-profile")} className="rounded-xl border border-outline-variant/25 bg-surface-container-low px-5 py-3 text-sm font-medium text-on-surface">租客資料</button>
                                        </div>
                                    </div>
                                ) : null}
                                {agentItem?.displayStatus === "ACTIVATED" ? (
                                    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
                                        <h2 className="text-xl font-bold text-on-surface">仲介專頁</h2>
                                        <p className="mt-2 text-sm text-on-surface-variant">{state.agentProfileComplete ? "公開專頁資料已完整。" : "公開專頁尚未完整，建議補上服務區域與介紹。"}</p>
                                        <button type="button" onClick={() => navigate("/my/agent-profile")} className="mt-5 rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container">編輯專頁</button>
                                    </div>
                                ) : null}
                            </section>
                        ) : null}
                    </>
                )}
            </main>
        </SiteLayout>
    );
}
