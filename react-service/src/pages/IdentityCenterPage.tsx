import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAuthMe } from "@/api/authApi";
import { getKYCStatus, type KYCStatus, type KYCStatusResponse } from "@/api/kycApi";
import SiteLayout from "../layouts/SiteLayout";

type IdentityCenterState = {
    loading: boolean;
    authenticated: boolean;
    address?: string;
    kyc?: KYCStatusResponse;
    error?: string;
};

const KYC_STATUS_LABEL: Record<KYCStatus, string> = {
    UNVERIFIED: "未驗證",
    PENDING:    "審核中",
    VERIFIED:   "已驗證",
    REJECTED:   "未通過",
};

const IdentityCenterPage = () => {
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
                const kyc = await getKYCStatus();
                setState({ loading: false, authenticated: true, address: auth.address, kyc });
            } catch (error) {
                setState({
                    loading: false,
                    authenticated: false,
                    error: error instanceof Error ? error.message : "讀取身份中心失敗",
                });
            }
        };
        void load();
    }, []);

    const isVerified  = state.kyc?.kycStatus === "VERIFIED";
    const credentials = state.kyc?.credentials ?? [];
    const kycStatus   = state.kyc?.kycStatus ?? "UNVERIFIED";
    const hasOwner    = credentials.includes("OWNER");
    const hasTenant   = credentials.includes("TENANT");
    const hasAgent    = credentials.includes("AGENT");

    // Not authenticated
    if (!state.loading && !state.authenticated) {
        return (
            <SiteLayout>
                <div className="max-w-7xl mx-auto px-6 md:px-12 py-20 flex flex-col items-center gap-4">
                    <span className="material-symbols-outlined text-5xl text-outline">manage_accounts</span>
                    <p className="text-on-surface-variant text-sm">{state.error ?? "尚未登入，請先完成 KYC 流程。"}</p>
                    <Link to="/kyc" className="px-5 py-2.5 bg-primary-container text-on-primary-fixed font-bold rounded-lg text-sm hover:bg-inverse-primary transition-colors">
                        前往 KYC 流程
                    </Link>
                </div>
            </SiteLayout>
        );
    }

    return (
        <SiteLayout>
            <main className="flex-grow w-full max-w-[1440px] mx-auto px-6 md:px-12 py-12 md:py-20 flex flex-col gap-16">
                {/* Header */}
                <div className="flex flex-col gap-4 max-w-3xl">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-on-background tracking-tight font-headline">身份中心</h1>
                    <p className="text-lg text-on-surface-variant leading-[1.75] font-body">
                        管理您的去中心化身份認證，並解鎖不同角色的平台權限。所有資料均加密存儲於區塊鏈上。
                    </p>
                </div>

                {state.loading ? (
                    <div className="flex items-center justify-center py-24">
                        <div className="text-sm text-on-surface-variant animate-pulse">正在讀取身份資訊…</div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
                        {/* Left Column: KYC & Roles */}
                        <div className="lg:col-span-8 flex flex-col gap-12">

                            {/* KYC Status Card (Bento/Glassmorphism) */}
                            <div className="bg-surface-container-lowest rounded-xl p-8 md:p-10 relative overflow-hidden transition-all duration-500 hover:bg-surface-bright group">
                                {/* Glassmorphism decorative element */}
                                <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary-container/10 rounded-full blur-3xl pointer-events-none group-hover:bg-primary-container/20 transition-all duration-700" />
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative z-10">
                                    <div className="flex items-center gap-6">
                                        <div className="w-20 h-20 rounded-full bg-primary-container/10 flex items-center justify-center shrink-0 border border-primary-container/20">
                                            <span
                                                className="material-symbols-outlined text-4xl text-primary-container"
                                                style={{ fontVariationSettings: "'FILL' 1" }}
                                            >
                                                verified_user
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <h2 className="text-2xl font-bold text-on-background font-headline">KYC 身份認證</h2>
                                            <div className="flex items-center gap-3 flex-wrap">
                                                {isVerified ? (
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-tertiary/10 text-tertiary text-sm font-bold tracking-wide">
                                                        <span className="w-2 h-2 rounded-full bg-tertiary mr-2 animate-pulse" />
                                                        已驗證
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-surface-container text-on-surface-variant text-sm font-bold tracking-wide">
                                                        {KYC_STATUS_LABEL[kycStatus]}
                                                    </span>
                                                )}
                                                {state.kyc?.identityNftTokenId && (
                                                    <span className="text-sm text-on-surface-variant font-medium bg-surface-container px-3 py-1 rounded-lg border border-outline-variant/20 flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[16px]">token</span>
                                                        IdentityNFT
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-full md:w-auto">
                                        <button
                                            type="button"
                                            className="w-full md:w-auto bg-surface-container-lowest border border-outline-variant/15 text-on-background px-6 py-3 rounded-lg font-bold hover:bg-surface-container-low transition-colors duration-200"
                                            onClick={() => navigate("/profile")}
                                        >
                                            檢視憑證
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Notice for unverified */}
                            {!isVerified && (
                                <div className="flex items-start gap-3 px-4 py-3 bg-primary-fixed/20 border border-primary-fixed rounded-xl text-sm text-on-primary-fixed-variant -mt-6">
                                    <span className="material-symbols-outlined text-base mt-0.5">info</span>
                                    <span>
                                        {kycStatus === "PENDING"
                                            ? "自然人 KYC 審核中，通過後即可申請角色憑證。"
                                            : "需先完成自然人 KYC，才能申請下方角色憑證。"}
                                        {(kycStatus === "UNVERIFIED" || kycStatus === "REJECTED") && (
                                            <>{" "}<Link to="/kyc" className="font-semibold underline decoration-primary hover:text-primary transition-colors">前往 KYC 流程</Link></>
                                        )}
                                    </span>
                                </div>
                            )}

                            {/* Roles Grid (3-col) */}
                            <div className="flex flex-col gap-6">
                                <h3 className="text-2xl font-bold text-on-background font-headline">平台角色</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                                    {/* Role: Landlord */}
                                    <div className={`bg-surface-container-lowest rounded-xl p-6 border relative overflow-hidden flex flex-col gap-6 ${hasOwner ? "border-primary-container/20" : "border-outline-variant/15"}`}>
                                        <div className="absolute top-0 right-0 w-16 h-16 bg-primary-container/5 rounded-bl-full pointer-events-none" />
                                        <div className="flex justify-between items-start">
                                            <div className="w-12 h-12 rounded-full bg-primary-container/10 flex items-center justify-center border border-primary-container/20">
                                                <span className="material-symbols-outlined text-2xl text-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>home</span>
                                            </div>
                                            {hasOwner && (
                                                <span className="text-xs font-bold text-tertiary bg-tertiary/10 px-2 py-1 rounded-full">已取得</span>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <h4 className="text-xl font-bold text-on-background font-headline">屋主</h4>
                                            <p className="text-sm text-on-surface-variant leading-[1.75]">發布房源、管理租約並接收加密貨幣租金。</p>
                                        </div>
                                        {hasOwner ? (
                                            <button
                                                type="button"
                                                onClick={() => navigate("/listings")}
                                                className="mt-auto w-full bg-surface-container text-on-background px-4 py-2 rounded-lg font-medium text-sm hover:bg-surface-container-high transition-colors duration-200"
                                            >
                                                管理房源
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled={!isVerified}
                                                onClick={() => navigate("/credential/owner")}
                                                className={`mt-auto w-full px-4 py-2 rounded-lg font-bold text-sm transition-colors duration-200 ${
                                                    isVerified
                                                        ? "bg-primary-container text-on-primary-fixed hover:bg-primary-fixed-dim shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                                                        : "bg-transparent border border-outline-variant text-on-surface-variant cursor-not-allowed"
                                                }`}
                                            >
                                                {isVerified ? "申請屋主身份" : "KYC 驗證後開放"}
                                            </button>
                                        )}
                                    </div>

                                    {/* Role: Tenant */}
                                    <div className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/15 relative overflow-hidden flex flex-col gap-6">
                                        <div className="flex justify-between items-start">
                                            <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center border border-secondary/20">
                                                <span className="material-symbols-outlined text-2xl text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>key</span>
                                            </div>
                                            {hasTenant && (
                                                <span className="text-xs font-bold text-tertiary bg-tertiary/10 px-2 py-1 rounded-full">已取得</span>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <h4 className="text-xl font-bold text-on-background font-headline">租客</h4>
                                            <p className="text-sm text-on-surface-variant leading-[1.75]">瀏覽房源、簽署智能合約並支付押金。</p>
                                        </div>
                                        {hasTenant ? (
                                            <button
                                                type="button"
                                                onClick={() => navigate("/credential/tenant")}
                                                className="mt-auto w-full bg-surface-container text-on-background px-4 py-2 rounded-lg font-medium text-sm hover:bg-surface-container-high transition-colors duration-200"
                                            >
                                                管理租客身份
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled={!isVerified}
                                                onClick={() => navigate("/credential/tenant")}
                                                className={`mt-auto w-full px-4 py-2 rounded-lg font-bold text-sm transition-colors duration-200 ${
                                                    isVerified
                                                        ? "bg-primary-container text-on-primary-fixed hover:bg-primary-fixed-dim shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                                                        : "bg-transparent border border-outline-variant text-on-surface-variant cursor-not-allowed"
                                                }`}
                                            >
                                                {isVerified ? "申請租客身份" : "KYC 驗證後開放"}
                                            </button>
                                        )}
                                    </div>

                                    {/* Role: Agent */}
                                    <div className="bg-surface-container rounded-xl p-6 border border-outline-variant/10 relative overflow-hidden flex flex-col gap-6 opacity-75 grayscale-[20%]">
                                        <div className="flex justify-between items-start">
                                            <div className="w-12 h-12 rounded-full bg-surface-variant flex items-center justify-center border border-outline-variant/20">
                                                <span className="material-symbols-outlined text-2xl text-on-surface-variant" style={{ fontVariationSettings: "'FILL' 1" }}>work</span>
                                            </div>
                                            {hasAgent && (
                                                <span className="text-xs font-bold text-tertiary bg-tertiary/10 px-2 py-1 rounded-full">已取得</span>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <h4 className="text-xl font-bold text-on-surface-variant font-headline">仲介</h4>
                                            <p className="text-sm text-on-surface-variant leading-[1.75]">協助媒合、處理糾紛並獲取服務費。</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => navigate("/credential/agent")}
                                            className="mt-auto w-full bg-transparent border border-outline-variant text-on-surface-variant px-4 py-2 rounded-lg font-medium text-sm hover:bg-surface-container-high transition-colors duration-200"
                                        >
                                            了解資格
                                        </button>
                                    </div>

                                </div>
                            </div>
                        </div>

                        {/* Right Column: Blockchain Activity */}
                        <div className="lg:col-span-4 bg-surface-container-lowest rounded-xl p-8 border border-outline-variant/10">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xl font-bold text-on-background font-headline">鏈上活動</h3>
                                <span className="material-symbols-outlined text-on-surface-variant text-xl">history</span>
                            </div>

                            {state.kyc?.txHistory && state.kyc.txHistory.length > 0 ? (
                                <div className="relative pl-6 border-l border-outline-variant/30 space-y-8">
                                    {state.kyc.txHistory.map((tx, i) => (
                                        <div key={tx.txHash ?? i} className="relative">
                                            <div className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full ring-4 ring-surface-container-lowest ${
                                                i === 0 ? "bg-tertiary" : "bg-surface-variant border-2 border-tertiary"
                                            }`} />
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-medium text-on-surface-variant">
                                                    {new Date(tx.timestamp).toLocaleString("zh-TW")}
                                                </span>
                                                <h5 className="text-base font-bold text-on-background">{tx.event}</h5>
                                                {tx.txHash && (
                                                    <a
                                                        href={`https://sepolia.etherscan.io/tx/${tx.txHash}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-secondary hover:underline truncate mt-1 flex items-center gap-1"
                                                    >
                                                        {tx.txHash.slice(0, 6)}…{tx.txHash.slice(-4)}
                                                        <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="relative pl-6 border-l border-outline-variant/30 space-y-8">
                                    {isVerified && (
                                        <div className="relative">
                                            <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-tertiary ring-4 ring-surface-container-lowest" />
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-medium text-on-surface-variant">KYC 驗證完成</span>
                                                <h5 className="text-base font-bold text-on-background">取得屋主身份</h5>
                                                {state.kyc?.identityNftTokenId && (
                                                    <a href="#" className="text-xs text-secondary hover:underline truncate mt-1 flex items-center gap-1">
                                                        NFT #{state.kyc.identityNftTokenId}
                                                        <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    <div className="relative">
                                        <div className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full ring-4 ring-surface-container-lowest ${isVerified ? "bg-surface-variant border-2 border-tertiary" : "bg-surface-variant border-2 border-tertiary"}`} />
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs font-medium text-on-surface-variant">KYC 完成</span>
                                            <h5 className="text-base font-bold text-on-background">完成 KYC 驗證</h5>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-surface-variant border-2 border-outline-variant ring-4 ring-surface-container-lowest" />
                                        <div className="flex flex-col gap-1 opacity-60">
                                            <span className="text-xs font-medium text-on-surface-variant">錢包連接</span>
                                            <h5 className="text-base font-bold text-on-background">
                                                {state.address
                                                    ? `${state.address.slice(0, 6)}…${state.address.slice(-4)}`
                                                    : "已連接"}
                                            </h5>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </SiteLayout>
    );
};

export default IdentityCenterPage;
