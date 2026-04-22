import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAuthMe } from "@/api/authApi";
import { getCredentialCenter, type CredentialCenterItem, type CredentialCenterResponse } from "@/api/credentialApi";
import { getKYCStatus, type KYCStatus, type KYCStatusResponse } from "@/api/kycApi";
import { CREDENTIAL_STATUS_LABEL } from "@/components/credential/credentialStatusLabels";
import SiteLayout from "../layouts/SiteLayout";

type IdentityCenterState = {
    loading: boolean;
    authenticated: boolean;
    address?: string;
    kyc?: KYCStatusResponse;
    center?: CredentialCenterResponse;
    error?: string;
};

type ActionConfig = {
    label: string;
    description: string;
    disabled?: boolean;
    onClick?: () => void;
};

const KYC_STATUS_LABEL: Record<KYCStatus, string> = {
    UNVERIFIED: "未驗證",
    PENDING: "審核中",
    VERIFIED: "已驗證",
    REJECTED: "未通過",
};

function statusBadgeClass(status: KYCStatus): string {
    if (status === "VERIFIED") return "border-tertiary/20 bg-tertiary/10 text-tertiary";
    if (status === "PENDING") return "border-amber-700/20 bg-amber-700/10 text-amber-700";
    if (status === "REJECTED") return "border-error/20 bg-error/10 text-error";
    return "border-outline-variant/20 bg-surface-container text-on-surface-variant";
}

function shortenAddress(address?: string): string {
    if (!address) return "未連線";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function shortenTxHash(txHash?: string): string | null {
    if (!txHash) return null;
    if (txHash.length < 14) return txHash;
    return `${txHash.slice(0, 8)}...${txHash.slice(-6)}`;
}

function ActionButton(props: ActionConfig) {
    return (
        <button
            type="button"
            disabled={props.disabled}
            onClick={props.onClick}
            className={`w-full rounded-xl px-4 py-3 text-sm font-bold transition-colors ${
                props.disabled
                    ? "cursor-not-allowed border border-outline-variant/20 bg-surface-container text-on-surface-variant"
                    : "bg-primary-container text-on-primary-container hover:opacity-90"
            }`}
        >
            {props.label}
        </button>
    );
}

function RoleCard(props: {
    icon: string;
    title: string;
    stateLabel: string;
    description: string;
    action: ActionConfig;
}) {
    return (
        <section className="flex flex-col gap-6 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
            <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-container/10">
                    <span
                        className="material-symbols-outlined text-2xl text-primary-container"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                        {props.icon}
                    </span>
                </div>
                <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
                    {props.stateLabel}
                </span>
            </div>
            <div className="space-y-2">
                <h3 className="text-xl font-bold text-on-surface">{props.title}</h3>
                <p className="text-sm leading-[1.75] text-on-surface-variant">{props.description}</p>
            </div>
            <div className="space-y-3">
                <ActionButton {...props.action} />
                <p className="text-xs leading-[1.75] text-on-surface-variant">{props.action.description}</p>
            </div>
        </section>
    );
}

function roleAction(item: CredentialCenterItem | undefined, fallbackPath: string, navigate: ReturnType<typeof useNavigate>): ActionConfig {
    if (!item) {
        return {
            label: "開始申請",
            description: "此身份尚未建立申請紀錄，可以先走智能審核，再視情況改送人工審核。",
            onClick: () => navigate(fallbackPath),
        };
    }

    switch (item.displayStatus) {
        case "ACTIVATED":
            return {
                label: "查看已啟用狀態",
                description: "身份 NFT 已啟用，可回到該頁查看目前結果與交易資訊。",
                onClick: () => navigate(fallbackPath),
            };
        case "PASSED_READY":
            return {
                label: "前往啟用",
                description: "審核已通過，是否啟用 NFT 憑證由你自行決定。",
                onClick: () => navigate(fallbackPath),
            };
        case "MANUAL_REVIEWING":
            return {
                label: "查看人工審核進度",
                description: "案件已進入人工審核，頁面會持續顯示目前進度與結果。",
                onClick: () => navigate(fallbackPath),
            };
        case "SMART_REVIEWING":
            return {
                label: "查看智能結果",
                description: "智能審核資料已送出，可回頁面確認最新結果。",
                onClick: () => navigate(fallbackPath),
            };
        case "FAILED":
            return {
                label: "重新送件",
                description: "本次未通過，可重新跑一次智能審核或改送人工審核。",
                onClick: () => navigate(fallbackPath),
            };
        case "REVOKED":
            return {
                label: "重新申請",
                description: "此身份憑證已撤銷，如需恢復可重新送件。",
                onClick: () => navigate(fallbackPath),
            };
        default:
            return {
                label: "開始申請",
                description: "此身份尚未建立申請紀錄，可以先走智能審核，再視情況改送人工審核。",
                onClick: () => navigate(fallbackPath),
            };
    }
}

export default function IdentityCenterPage() {
    const navigate = useNavigate();
    const [state, setState] = useState<IdentityCenterState>({ loading: true, authenticated: false });

    useEffect(() => {
        const load = async () => {
            try {
                const auth = await getAuthMe();
                if (!auth.authenticated) {
                    setState({ loading: false, authenticated: false });
                    return;
                }

                const [kycResult, centerResult] = await Promise.allSettled([getKYCStatus(), getCredentialCenter()]);
                const errors: string[] = [];

                const nextState: IdentityCenterState = {
                    loading: false,
                    authenticated: true,
                    address: auth.address,
                };

                if (kycResult.status === "fulfilled") {
                    nextState.kyc = kycResult.value;
                } else {
                    errors.push(kycResult.reason instanceof Error ? kycResult.reason.message : "KYC 狀態載入失敗");
                }
                if (centerResult.status === "fulfilled") {
                    nextState.center = centerResult.value;
                } else {
                    errors.push(centerResult.reason instanceof Error ? centerResult.reason.message : "身份狀態載入失敗");
                }
                if (errors.length > 0) {
                    nextState.error = errors.join(" / ");
                }

                setState({
                    ...nextState,
                });
            } catch (error) {
                setState({
                    loading: false,
                    authenticated: false,
                    error: error instanceof Error ? error.message : "無法載入身份中心。",
                });
            }
        };

        void load();
    }, []);

    if (!state.loading && !state.authenticated) {
        return (
            <SiteLayout>
                <main className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-6 py-20 md:px-12">
                    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-10">
                        <h1 className="font-headline text-4xl font-extrabold text-on-surface">身份中心</h1>
                        <p className="mt-4 text-sm leading-[1.8] text-on-surface-variant">
                            請先登入，才能查看 KYC 狀態、角色身份申請進度與既有鏈上紀錄。
                        </p>
                        {state.error ? <p className="mt-4 text-sm text-error">{state.error}</p> : null}
                        <div className="mt-8 flex flex-wrap gap-3">
                            <Link
                                to="/login"
                                className="rounded-xl bg-primary-container px-6 py-3 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90"
                            >
                                前往登入
                            </Link>
                            <Link
                                to="/kyc"
                                className="rounded-xl border border-outline-variant/25 bg-surface-container-low px-6 py-3 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
                            >
                                查看 KYC 流程
                            </Link>
                        </div>
                    </div>
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
            <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-12 px-6 py-12 md:px-12 md:py-20">
                <section className="grid gap-8 lg:grid-cols-[1.35fr_0.65fr]">
                    <div className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8 md:p-10">
                        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-low px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
                            Gate 1A 身份申請主線
                        </div>
                        <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">
                            身份中心
                        </h1>
                        <p className="mt-4 max-w-3xl text-base leading-[1.8] text-on-surface-variant">
                            這裡是 OWNER、TENANT、AGENT 三種身份的正式入口。你可以先走智能審核，再決定是否採用結果；若不採用，也能改送人工審核。通過後是否啟用 NFT 憑證，由你自己決定。
                        </p>

                        <div className="mt-8 grid gap-4 md:grid-cols-3">
                            <div className="rounded-2xl bg-surface-container-low p-5">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">錢包</div>
                                <div className="mt-2 text-lg font-bold text-on-surface">{shortenAddress(state.address)}</div>
                            </div>
                            <div className="rounded-2xl bg-surface-container-low p-5">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">KYC 狀態</div>
                                <div className={`mt-3 inline-flex rounded-full border px-3 py-1 text-sm font-bold ${statusBadgeClass(kycStatus)}`}>
                                    {KYC_STATUS_LABEL[kycStatus]}
                                </div>
                            </div>
                            <div className="rounded-2xl bg-surface-container-low p-5">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">自然人 NFT</div>
                                <div className="mt-2 text-lg font-bold text-on-surface">
                                    {state.kyc?.identityNftTokenId !== undefined ? `#${state.kyc.identityNftTokenId}` : "尚未鑄造"}
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5 text-sm leading-[1.8] text-on-surface-variant">
                            <strong className="text-on-surface">目前規則：</strong>
                            Gate 1A 已完成身份申請、審核與啟用流程，但刊登物件與預約看房的權限切換仍保留在 Gate 1B。
                            也就是說，現階段平台主線仍維持以 <code>KYC VERIFIED</code> 作為 Gate 0 既有操作的開放條件。
                        </div>
                    </div>

                    <aside className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8">
                        <div className="flex items-center justify-between gap-4">
                            <h2 className="text-2xl font-bold text-on-surface">下一步建議</h2>
                            <span className="material-symbols-outlined text-on-surface-variant">bolt</span>
                        </div>
                        <div className="mt-6 space-y-4">
                            {isVerified ? (
                                <>
                                    <p className="text-sm leading-[1.8] text-on-surface-variant">
                                        你已具備送出身份申請的基本條件。接下來可依角色需求選擇屋主、租客或仲介身份，先走智能審核，再決定是否啟用 NFT。
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => navigate("/credential/owner")}
                                        className="w-full rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90"
                                    >
                                        先申請屋主身份
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => navigate("/credential/tenant")}
                                        className="w-full rounded-xl border border-outline-variant/25 bg-surface-container-low px-5 py-3 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
                                    >
                                        申請租客身份
                                    </button>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm leading-[1.8] text-on-surface-variant">
                                        角色身份認證建立在自然人 KYC 上。先完成 KYC，之後三種身份申請都會開放。
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => navigate("/kyc")}
                                        className="w-full rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90"
                                    >
                                        前往 KYC
                                    </button>
                                </>
                            )}
                            <button
                                type="button"
                                onClick={() => navigate("/profile")}
                                className="w-full rounded-xl border border-outline-variant/25 bg-surface-container-low px-5 py-3 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
                            >
                                查看會員資料
                            </button>
                        </div>
                    </aside>
                </section>

                {state.loading ? (
                    <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-sm text-on-surface-variant">
                        載入身份中心中...
                    </section>
                ) : (
                    <>
                        <section className="grid gap-6 md:grid-cols-3">
                            <RoleCard
                                icon="home"
                                title="屋主身份"
                                stateLabel={ownerItem ? CREDENTIAL_STATUS_LABEL[ownerItem.displayStatus] : "尚未申請"}
                                description="上傳權狀或可證明持有權的文件後，系統會先給你智能審核結果；你可以決定是否啟用，或改送人工審核。"
                                action={roleAction(ownerItem, "/credential/owner", navigate)}
                            />
                            <RoleCard
                                icon="key"
                                title="租客身份"
                                stateLabel={tenantItem ? CREDENTIAL_STATUS_LABEL[tenantItem.displayStatus] : "尚未申請"}
                                description="上傳可說明租住能力或租住身分的資料後，先走智能審核；若不採用，也能轉人工審核。"
                                action={roleAction(tenantItem, "/credential/tenant", navigate)}
                            />
                            <RoleCard
                                icon="work"
                                title="仲介身份"
                                stateLabel={agentItem ? CREDENTIAL_STATUS_LABEL[agentItem.displayStatus] : "尚未申請"}
                                description="仲介身份支援證照或登錄資料的智能初審，通過後由你自行決定是否啟用對應 NFT 憑證。"
                                action={roleAction(agentItem, "/credential/agent", navigate)}
                            />
                        </section>

                        <section className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
                            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                                <div className="flex items-center justify-between gap-4">
                                    <h2 className="text-2xl font-bold text-on-surface">目前已啟用身份</h2>
                                    <span className="material-symbols-outlined text-on-surface-variant">badge</span>
                                </div>
                                {activatedItems.length > 0 ? (
                                    <div className="mt-6 flex flex-wrap gap-3">
                                        {activatedItems.map((item) => (
                                            <Link
                                                key={item.credentialType}
                                                to={`/credential/${item.credentialType.toLowerCase()}`}
                                                className="rounded-full border border-tertiary/20 bg-tertiary/10 px-4 py-2 text-sm font-bold text-tertiary"
                                            >
                                                {item.credentialType}
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="mt-6 text-sm leading-[1.8] text-on-surface-variant">
                                        目前尚未啟用任何角色 NFT 憑證。這是正常的，因為啟用動作完全由你自行決定。
                                    </p>
                                )}
                            </div>

                            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                                <div className="flex items-center justify-between gap-4">
                                    <h2 className="text-2xl font-bold text-on-surface">鏈上紀錄</h2>
                                    <span className="material-symbols-outlined text-on-surface-variant">history</span>
                                </div>
                                {state.kyc?.txHistory && state.kyc.txHistory.length > 0 ? (
                                    <div className="mt-6 space-y-4">
                                        {state.kyc.txHistory.map((tx, index) => (
                                            <div key={`${tx.txHash ?? tx.event}-${index}`} className="rounded-2xl bg-surface-container-low p-4">
                                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                                                    {new Date(tx.timestamp).toLocaleString("zh-TW")}
                                                </div>
                                                <div className="mt-2 text-base font-bold text-on-surface">{tx.event}</div>
                                                {tx.txHash ? (
                                                    <a
                                                        href={`https://sepolia.etherscan.io/tx/${tx.txHash}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="mt-2 inline-flex items-center gap-1 text-sm text-secondary transition-colors hover:text-primary-container hover:underline"
                                                    >
                                                        {shortenTxHash(tx.txHash)}
                                                        <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                                                    </a>
                                                ) : null}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="mt-6 text-sm leading-[1.8] text-on-surface-variant">
                                        目前尚未記錄新的角色啟用交易；完成啟用後，這裡會持續累積鏈上紀錄。
                                    </p>
                                )}
                            </div>
                        </section>

                        <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-bold text-on-surface">Gate 0 既有主線</h2>
                                    <p className="text-sm leading-[1.8] text-on-surface-variant">
                                        在 Gate 1B 權限切換前，既有刊登物件與預約看房流程仍維持 Gate 0 規則：KYC VERIFIED 即可操作。
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <button
                                        type="button"
                                        disabled={!isVerified}
                                        onClick={() => navigate("/listings/new")}
                                        className="rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        建立房源草稿
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => navigate("/listings")}
                                        className="rounded-xl border border-outline-variant/25 bg-surface-container-low px-5 py-3 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
                                    >
                                        瀏覽房源
                                    </button>
                                </div>
                            </div>
                        </section>
                    </>
                )}
            </main>
        </SiteLayout>
    );
}
