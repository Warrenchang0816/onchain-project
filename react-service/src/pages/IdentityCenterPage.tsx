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
    PENDING: "審核中",
    VERIFIED: "已驗證",
    REJECTED: "未通過",
};

const KYC_STATUS_CLASS: Record<KYCStatus, string> = {
    UNVERIFIED: "status-badge status-badge--gray",
    PENDING: "status-badge status-badge--yellow",
    VERIFIED: "status-badge status-badge--green",
    REJECTED: "status-badge status-badge--red",
};

const roles = [
    {
        key: "owner",
        title: "屋主身份",
        description: "上傳不動產權狀與產權資料，完成核驗後取得屋主憑證，方可在平台發布房源、簽署租賃合約。",
        path: "/credential/owner",
    },
    {
        key: "tenant",
        title: "租客身份",
        description: "提交工作收入與信用佐證，建立個人租客信用憑證，平台將據此媒合適合房源並提升租賃申請優先順序。",
        path: "/credential/tenant",
    },
    {
        key: "agent",
        title: "仲介身份",
        description: "提供仲介執業證照與公司資料，核驗通過後開放代理授權與多屋代管相關操作。",
        path: "/credential/agent",
    },
] as const;

const IdentityCenterPage = () => {
    const navigate = useNavigate();
    const [state, setState] = useState<IdentityCenterState>({
        loading: true,
        authenticated: false,
    });

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

    const isVerified = state.kyc?.kycStatus === "VERIFIED";

    return (
        <SiteLayout>
            <section className="page-section">
                <div className="page-heading">
                    <h1>身份中心</h1>
                    <p>自然人 KYC 通過後，可申請屋主、租客或仲介角色憑證，進入對應的平台功能。</p>
                </div>

                {state.loading ? (
                    <div className="member-card">
                        <p>正在讀取身份資訊...</p>
                    </div>
                ) : null}

                {!state.loading && !state.authenticated ? (
                    <div className="member-card">
                        <p>{state.error ?? "尚未完成錢包登入，請先進行 KYC 流程。"}</p>
                        <Link className="inline-link-button" to="/kyc">
                            前往 KYC 流程
                        </Link>
                    </div>
                ) : null}

                {state.authenticated && state.kyc ? (
                    <>
                        <div className="member-card">
                            <div className="member-row">
                                <span className="member-label">錢包地址</span>
                                <span className="member-value member-value--mono">
                                    {state.address
                                        ? `${state.address.slice(0, 6)}…${state.address.slice(-4)}`
                                        : "—"}
                                </span>
                            </div>
                            <div className="member-row">
                                <span className="member-label">自然人 KYC</span>
                                <span className={KYC_STATUS_CLASS[state.kyc.kycStatus]}>
                                    {KYC_STATUS_LABEL[state.kyc.kycStatus]}
                                </span>
                            </div>
                            <div className="member-row">
                                <span className="member-label">身份 NFT</span>
                                <span className="member-value">
                                    {state.kyc.identityNftTokenId ?? "尚未回填"}
                                </span>
                            </div>
                        </div>

                        {!isVerified ? (
                            <div className="identity-notice">
                                <span className="identity-notice-icon" aria-hidden="true">ℹ</span>
                                <span>
                                    {state.kyc.kycStatus === "PENDING"
                                        ? "自然人 KYC 審核中，通過後即可申請角色憑證。"
                                        : "需先完成自然人 KYC，才能申請下方角色憑證。"}
                                    {state.kyc.kycStatus === "UNVERIFIED" || state.kyc.kycStatus === "REJECTED" ? (
                                        <>
                                            {" "}
                                            <Link to="/kyc" className="inline-text-link">
                                                前往 KYC 流程
                                            </Link>
                                        </>
                                    ) : null}
                                </span>
                            </div>
                        ) : null}

                        <div className="identity-role-grid">
                            {roles.map((role) => (
                                <article
                                    key={role.key}
                                    className={`identity-role-card${!isVerified ? " identity-role-card--locked" : ""}`}
                                >
                                    <h2>{role.title}</h2>
                                    <p>{role.description}</p>
                                    <button
                                        type="button"
                                        className="identity-role-btn"
                                        disabled={!isVerified}
                                        onClick={() => navigate(role.path)}
                                    >
                                        {isVerified ? "開始申請" : "KYC 驗證後開放"}
                                    </button>
                                </article>
                            ))}
                        </div>
                    </>
                ) : null}
            </section>
        </SiteLayout>
    );
};

export default IdentityCenterPage;
