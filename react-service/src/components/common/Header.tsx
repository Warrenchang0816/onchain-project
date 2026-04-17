import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { getAuthMe, logout } from "@/api/authApi";
import { getKYCStatus, type KYCStatus } from "@/api/kycApi";

async function revokeWalletPermissions() {
    const provider = window.ethereum;
    if (provider) {
        try {
            await provider.request({
                method: "wallet_revokePermissions",
                params: [{ eth_accounts: {} }],
            });
        } catch { /* some wallets don't support revokePermissions */ }
    }
}

function deriveRole(kycStatus: KYCStatus, credentials: string[]): string {
    if (credentials.includes("AGENT"))  return "仲介";
    if (credentials.includes("OWNER"))  return "屋主";
    if (credentials.includes("TENANT")) return "租客";
    if (kycStatus === "VERIFIED")       return "自然人";
    if (kycStatus === "PENDING")        return "審核中";
    return "訪客";
}

function formatLoginTime(date: Date): string {
    return date.toLocaleString("zh-TW", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
}

type HeaderState = {
    loading: boolean;
    authenticated: boolean;
    address?: string;
    kycStatus: KYCStatus;
    credentials: string[];
    loginTime?: Date;
};

const Header = () => {
    const navigate = useNavigate();
    const [isMemberMenuOpen, setIsMemberMenuOpen] = useState(false);
    const [state, setState] = useState<HeaderState>({
        loading: true,
        authenticated: false,
        kycStatus: "UNVERIFIED",
        credentials: [],
    });
    const menuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (!menuRef.current?.contains(event.target as Node)) {
                setIsMemberMenuOpen(false);
            }
        };

        const syncHeaderState = async () => {
            try {
                const auth = await getAuthMe();
                if (!auth.authenticated) {
                    setState({ loading: false, authenticated: false, kycStatus: "UNVERIFIED", credentials: [] });
                    return;
                }
                const kyc = await getKYCStatus().catch(() => ({ kycStatus: "UNVERIFIED" as KYCStatus, credentials: [] }));
                setState((prev) => ({
                    loading: false,
                    authenticated: true,
                    address: auth.address,
                    kycStatus: kyc.kycStatus,
                    credentials: kyc.credentials ?? [],
                    // preserve loginTime if already set (avoid overwrite on re-sync)
                    loginTime: prev.loginTime ?? new Date(),
                }));
            } catch {
                setState({ loading: false, authenticated: false, kycStatus: "UNVERIFIED", credentials: [] });
            }
        };

        void syncHeaderState();
        document.addEventListener("mousedown", handleClickOutside);
        window.addEventListener("wallet-auth-changed", syncHeaderState);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            window.removeEventListener("wallet-auth-changed", syncHeaderState);
        };
    }, []);

    const handleLogout = async () => {
        await logout().catch(() => undefined);
        await revokeWalletPermissions();
        setIsMemberMenuOpen(false);
        setState({ loading: false, authenticated: false, kycStatus: "UNVERIFIED", credentials: [] });
        navigate("/login");
    };

    const role = deriveRole(state.kycStatus, state.credentials);

    return (
        <header className="site-header">
            <div className="site-header-inner">
                <div className="site-brand">
                    <h2>去中心化房屋平台</h2>
                    <nav>
                        <NavLink to="/" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
                            首頁
                        </NavLink>
                        <NavLink to="/listings" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
                            列表
                        </NavLink>
                        <NavLink to="/logs" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
                            足跡
                        </NavLink>
                    </nav>
                </div>

                {/* Centre greeting — only shown when authenticated */}
                {state.authenticated && !state.loading ? (
                    <div className="header-greeting">
                        <span className="header-greeting-role">{role}</span>
                        <span className="header-greeting-text">，歡迎回來</span>
                    </div>
                ) : null}

                <div className="site-header-actions">
                    {state.loading ? (
                        <span className="header-loading">讀取中...</span>
                    ) : state.authenticated ? (
                        <>
                            {state.loginTime ? (
                                <span className="header-login-time">
                                    登入 {formatLoginTime(state.loginTime)}
                                </span>
                            ) : null}

                            <div className="member-menu" ref={menuRef}>
                                <button
                                    type="button"
                                    className="member-menu-trigger"
                                    onClick={() => setIsMemberMenuOpen((open) => !open)}
                                    aria-label="帳號選單"
                                >
                                    <span className="member-menu-avatar" aria-hidden="true">鏈</span>
                                </button>

                                {isMemberMenuOpen && (
                                    <div className="member-menu-dropdown">
                                        {state.address ? (
                                            <div className="member-menu-address" title={state.address}>
                                                {state.address.slice(0, 6)}…{state.address.slice(-4)}
                                            </div>
                                        ) : null}
                                        <button
                                            type="button"
                                            className="member-menu-item"
                                            onClick={() => { setIsMemberMenuOpen(false); navigate("/profile"); }}
                                        >
                                            會員資料
                                        </button>
                                        <button
                                            type="button"
                                            className="member-menu-item"
                                            onClick={() => { setIsMemberMenuOpen(false); navigate("/member"); }}
                                        >
                                            身份中心
                                        </button>
                                        <button
                                            type="button"
                                            className="member-menu-item"
                                            onClick={() => { setIsMemberMenuOpen(false); navigate("/settings"); }}
                                        >
                                            設定
                                        </button>
                                        <button
                                            type="button"
                                            className="member-menu-item member-menu-item--danger"
                                            onClick={() => void handleLogout()}
                                        >
                                            登出
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="guest-actions">
                            <button
                                type="button"
                                className="header-cta-button"
                                onClick={() => navigate("/login")}
                            >
                                登入
                            </button>
                            <button
                                type="button"
                                className="header-cta-button header-cta-button--secondary"
                                onClick={() => navigate("/kyc")}
                            >
                                註冊 KYC
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
