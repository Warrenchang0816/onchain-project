import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { AgentDetailResponse } from "@/api/agentApi";
import { getMyAgentProfile } from "@/api/agentApi";
import { getAuthMe } from "@/api/authApi";
import { getCredentialCenter, type CredentialCenterResponse, type CredentialType } from "@/api/credentialApi";
import { getKYCStatus, type KYCStatus, type KYCStatusResponse } from "@/api/kycApi";
import { getMyListings, type Listing } from "@/api/listingApi";
import { getMyRequirements, getMyTenantProfile, type TenantProfile, type TenantRequirement } from "@/api/tenantApi";
import SiteLayout from "../layouts/SiteLayout";
import {
    buildAgentSummary,
    buildOwnerSummary,
    buildTenantSummary,
    type RoleDashboardSummary,
} from "./identityCenterViewModel";

type IdentityCenterState = {
    loading: boolean;
    authenticated: boolean;
    address?: string;
    kyc?: KYCStatusResponse;
    center?: CredentialCenterResponse;
    ownerListings: Listing[];
    tenantRequirements: TenantRequirement[];
    tenantProfile?: TenantProfile;
    agentProfile: AgentDetailResponse | null;
    roleErrors: Partial<Record<CredentialType, string>>;
    error?: string;
};

const KYC_STATUS_LABEL: Record<KYCStatus, string> = {
    UNVERIFIED: "未驗證",
    PENDING: "審核中",
    VERIFIED: "已驗證",
    REJECTED: "已退回",
};

function shortenAddress(address?: string): string {
    if (!address) return "尚未連接錢包";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function statusBadgeClass(status: KYCStatus): string {
    if (status === "VERIFIED") return "border-tertiary/20 bg-tertiary/10 text-tertiary";
    if (status === "PENDING") return "border-amber-700/20 bg-amber-700/10 text-amber-700";
    if (status === "REJECTED") return "border-error/20 bg-error/10 text-error";
    return "border-outline-variant/20 bg-surface-container text-on-surface-variant";
}

function WorkbenchCard(props: { summary: RoleDashboardSummary; error?: string; onNavigate: (path: string) => void }) {
    const stateLabel = props.summary.state === "active" ? "已啟用" : props.summary.state === "ready" ? "可啟用" : props.summary.state === "pending" ? "審核中" : props.summary.state === "rejected" ? "已退回" : "未啟用";

    return (
        <section className="flex min-h-[340px] flex-col gap-5 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-on-surface">{props.summary.title}</h2>
                    <p className="mt-1 text-sm text-on-surface-variant">{props.summary.statusLabel}</p>
                </div>
                <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">{stateLabel}</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                {props.summary.metrics.map((metric) => (
                    <div key={metric.label} className="rounded-xl bg-surface-container-low p-4">
                        <p className="text-xs text-on-surface-variant">{metric.label}</p>
                        <p className="mt-1 text-lg font-extrabold text-on-surface">{metric.value}</p>
                    </div>
                ))}
            </div>

            <p className="text-sm leading-[1.7] text-on-surface-variant">{props.summary.nextStep}</p>
            {props.error ? <p className="rounded-xl bg-error-container p-3 text-sm text-on-error-container">{props.error}</p> : null}

            <div className="mt-auto flex flex-wrap gap-3">
                <button
                    type="button"
                    onClick={() => props.onNavigate(props.summary.primaryActionPath)}
                    className="rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90"
                >
                    {props.summary.primaryActionLabel}
                </button>
                {props.summary.secondaryActions.map((action) => (
                    <button
                        key={action.path}
                        type="button"
                        onClick={() => props.onNavigate(action.path)}
                        className="rounded-xl border border-outline-variant/25 bg-surface-container-low px-5 py-3 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
                    >
                        {action.label}
                    </button>
                ))}
            </div>
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
        agentProfile: null,
        roleErrors: {},
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
                const roleErrors: Partial<Record<CredentialType, string>> = {};

                const ownerListings = credentials.includes("OWNER")
                    ? await getMyListings().catch((err: unknown) => {
                          roleErrors.OWNER = err instanceof Error ? err.message : "房東資料讀取失敗";
                          return [] as Listing[];
                      })
                    : [];

                const tenantRequirements = credentials.includes("TENANT")
                    ? await getMyRequirements().catch((err: unknown) => {
                          roleErrors.TENANT = err instanceof Error ? err.message : "租客需求讀取失敗";
                          return [] as TenantRequirement[];
                      })
                    : [];

                const tenantProfile = credentials.includes("TENANT")
                    ? await getMyTenantProfile().catch((err: unknown) => {
                          roleErrors.TENANT = err instanceof Error ? err.message : "租客資料讀取失敗";
                          return undefined;
                      })
                    : undefined;

                const agentProfile = credentials.includes("AGENT")
                    ? await getMyAgentProfile().catch((err: unknown) => {
                          roleErrors.AGENT = err instanceof Error ? err.message : "仲介個人頁讀取失敗";
                          return null;
                      })
                    : null;

                setState({
                    loading: false,
                    authenticated: true,
                    address: auth.address,
                    kyc,
                    center,
                    ownerListings,
                    tenantRequirements,
                    tenantProfile,
                    agentProfile,
                    roleErrors,
                    error: kycResult.status === "rejected" || centerResult.status === "rejected" ? "部分身分資料讀取失敗，請稍後重新整理。" : undefined,
                });
            } catch (error) {
                setState({
                    loading: false,
                    authenticated: false,
                    ownerListings: [],
                    tenantRequirements: [],
                    agentProfile: null,
                    roleErrors: {},
                    error: error instanceof Error ? error.message : "讀取身分工作台失敗",
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
                        <h1 className="text-4xl font-extrabold text-on-surface">身分工作台</h1>
                        <p className="mt-4 text-sm leading-[1.8] text-on-surface-variant">請先登入錢包，才能查看 KYC、角色憑證和三大身分工作區。</p>
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

    const ownerSummary = buildOwnerSummary(ownerItem, state.ownerListings);
    const tenantSummary = buildTenantSummary(tenantItem, state.tenantRequirements, state.tenantProfile);
    const agentSummary = buildAgentSummary(agentItem, state.agentProfile, state.address);

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-10 px-6 py-12 md:px-12 md:py-16">
                <section className="grid gap-8 lg:grid-cols-[1.35fr_0.65fr]">
                    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8 md:p-10">
                        <span className="inline-flex rounded-full border border-outline-variant/20 bg-surface-container-low px-4 py-2 text-xs font-semibold text-on-surface-variant">
                            三大身分整合儀表板
                        </span>
                        <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">身分工作台</h1>
                        <p className="mt-4 max-w-3xl text-base leading-[1.8] text-on-surface-variant">
                            這裡整合房東、租客、仲介三種身分。先確認 KYC 與角色啟用狀態，再進入各自工作台完成物件、需求或公開個人頁。
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
                                <p className="text-xs font-semibold text-on-surface-variant">身分 NFT</p>
                                <p className="mt-2 text-lg font-bold text-on-surface">
                                    {state.kyc?.identityNftTokenId !== undefined ? `#${state.kyc.identityNftTokenId}` : "尚未鑄造"}
                                </p>
                            </div>
                        </div>
                    </div>

                    <aside className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                        <h2 className="text-2xl font-bold text-on-surface">下一步</h2>
                        <p className="mt-3 text-sm leading-[1.8] text-on-surface-variant">
                            {isVerified ? "選擇要啟用或管理的身分。你可以同時擁有多種角色，所有入口都會集中在這個頁面。" : "完成 KYC 後，才能啟用房東、租客或仲介身分。"}
                        </p>
                        <div className="mt-6 space-y-3">
                            {isVerified ? (
                                <>
                                    <button type="button" onClick={() => navigate("/credential/owner")} className="w-full rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container">啟用房東身分</button>
                                    <button type="button" onClick={() => navigate("/credential/tenant")} className="w-full rounded-xl border border-outline-variant/25 bg-surface-container-low px-5 py-3 text-sm font-medium text-on-surface">啟用租客身分</button>
                                    <button type="button" onClick={() => navigate("/credential/agent")} className="w-full rounded-xl border border-outline-variant/25 bg-surface-container-low px-5 py-3 text-sm font-medium text-on-surface">啟用仲介身分</button>
                                </>
                            ) : (
                                <button type="button" onClick={() => navigate("/kyc")} className="w-full rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container">前往 KYC</button>
                            )}
                        </div>
                    </aside>
                </section>

                {state.loading ? (
                    <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-sm text-on-surface-variant">
                        讀取身分工作台中...
                    </section>
                ) : (
                    <section className="grid gap-6 xl:grid-cols-3">
                        <WorkbenchCard summary={ownerSummary} error={state.roleErrors.OWNER} onNavigate={navigate} />
                        <WorkbenchCard summary={tenantSummary} error={state.roleErrors.TENANT} onNavigate={navigate} />
                        <WorkbenchCard summary={agentSummary} error={state.roleErrors.AGENT} onNavigate={navigate} />
                    </section>
                )}
            </main>
        </SiteLayout>
    );
}
