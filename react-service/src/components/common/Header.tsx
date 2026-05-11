import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { getAuthMe, logout } from "@/api/authApi";
import { getKYCStatus, type KYCStatus } from "@/api/kycApi";

async function revokeWalletPermissions() {
    const provider = window.ethereum;
    if (provider) {
        try {
            await provider.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] });
        } catch {
            // Wallets may reject this method; session logout is still handled server-side.
        }
    }
}

function deriveRole(kycStatus: KYCStatus, credentials: string[]): string {
    if (kycStatus === "VERIFIED") {
        return credentials.length > 0 ? "貴賓" : "尚未啟用身份";
    }
    if (kycStatus === "PENDING") return "審核中";
    return "訪客";
}

type HeaderState = {
    loading: boolean;
    authenticated: boolean;
    address?: string;
    kycStatus: KYCStatus;
    credentials: string[];
};

export default function Header() {
    const navigate = useNavigate();
    const menuRef = useRef<HTMLDivElement | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [state, setState] = useState<HeaderState>({
        loading: true,
        authenticated: false,
        kycStatus: "UNVERIFIED",
        credentials: [],
    });

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (!menuRef.current?.contains(e.target as Node)) setIsMenuOpen(false);
        };

        const sync = async () => {
            try {
                const auth = await getAuthMe();
                if (!auth.authenticated) {
                    setState({ loading: false, authenticated: false, kycStatus: "UNVERIFIED", credentials: [] });
                    return;
                }
                const kyc = await getKYCStatus().catch(() => ({ kycStatus: "UNVERIFIED" as KYCStatus, credentials: [] }));
                setState({
                    loading: false,
                    authenticated: true,
                    address: auth.address,
                    kycStatus: kyc.kycStatus,
                    credentials: kyc.credentials ?? [],
                });
            } catch {
                setState({ loading: false, authenticated: false, kycStatus: "UNVERIFIED", credentials: [] });
            }
        };

        void sync();
        document.addEventListener("mousedown", handleClickOutside);
        window.addEventListener("wallet-auth-changed", sync);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            window.removeEventListener("wallet-auth-changed", sync);
        };
    }, []);

    const handleLogout = async () => {
        await logout().catch(() => undefined);
        await revokeWalletPermissions();
        setIsMenuOpen(false);
        setState({ loading: false, authenticated: false, kycStatus: "UNVERIFIED", credentials: [] });
        navigate("/login");
    };

    const role = deriveRole(state.kycStatus, state.credentials);
    const canBrowseRequirements = state.authenticated && (state.credentials.includes("OWNER") || state.credentials.includes("AGENT"));

    const navLinkCls = ({ isActive }: { isActive: boolean }) =>
        isActive
            ? "border-b-2 border-primary-container pb-1 font-bold text-primary-container"
            : "pb-1 font-medium text-on-surface transition-colors hover:text-primary-container";

    const menuItems = [
        { label: "會員資料", path: "/profile" },
        { label: "身分工作台", path: "/member" },
        { label: "收藏", path: "/favorites" },
        { label: "鏈上紀錄", path: "/logs" },
        { label: "設定", path: "/settings" },
    ];

    return (
        <header className="sticky top-0 z-50 h-[64px] w-full border-b border-outline-variant/10 bg-[#FFFEF9]/90 backdrop-blur-xl">
            <div className="mx-auto flex h-full w-full max-w-[1440px] items-center justify-between px-6 font-['Inter','Noto_Sans_TC'] md:px-12">
                <button type="button" onClick={() => navigate("/")} className="bg-transparent text-xl font-extrabold text-on-surface">
                    鏈上房產平台
                </button>

                <nav className="hidden items-center gap-8 md:flex">
                    <NavLink to="/" end className={navLinkCls}>首頁</NavLink>
                    <NavLink to="/sale" className={navLinkCls}>出售物件</NavLink>
                    <NavLink to="/rent" className={navLinkCls}>出租物件</NavLink>
                    {canBrowseRequirements ? <NavLink to="/requirements" className={navLinkCls}>租屋需求</NavLink> : null}
                    <NavLink to="/agents" className={navLinkCls}>仲介列表</NavLink>
                </nav>

                <div className="flex items-center gap-4">
                    {state.loading ? (
                        <span className="text-xs text-on-surface-variant">讀取中...</span>
                    ) : state.authenticated ? (
                        <>
                            <button type="button" className="hidden bg-transparent font-medium text-on-surface transition-colors hover:text-primary-container md:block" onClick={() => navigate("/member")}>
                                {role}
                            </button>
                            <div className="relative" ref={menuRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsMenuOpen((open) => !open)}
                                    aria-label="開啟會員選單"
                                    className="flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant/30 bg-surface-variant"
                                >
                                    <span className="material-symbols-outlined text-on-surface-variant" style={{ fontVariationSettings: "'FILL' 1" }}>
                                        person
                                    </span>
                                </button>

                                {isMenuOpen ? (
                                    <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-lowest shadow-[0_8px_32px_rgba(28,25,23,0.12)]">
                                        {state.address ? (
                                            <div className="truncate border-b border-surface-container px-4 py-3 font-mono text-xs text-outline">
                                                {state.address.slice(0, 6)}...{state.address.slice(-4)}
                                            </div>
                                        ) : null}
                                        {menuItems.map(({ label, path }) => (
                                            <button
                                                key={path}
                                                type="button"
                                                className="w-full bg-transparent px-4 py-2.5 text-left text-sm text-on-surface transition-colors hover:bg-surface-container-low"
                                                onClick={() => {
                                                    setIsMenuOpen(false);
                                                    navigate(path);
                                                }}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                        <div className="border-t border-surface-container">
                                            <button type="button" className="w-full bg-transparent px-4 py-2.5 text-left text-sm text-error transition-colors hover:bg-error-container" onClick={() => void handleLogout()}>
                                                登出
                                            </button>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </>
                    ) : (
                        <>
                            <button type="button" onClick={() => navigate("/login")} className="hidden bg-transparent font-medium text-on-surface transition-colors hover:text-primary-container md:block">
                                登入
                            </button>
                            <button type="button" onClick={() => navigate("/login")} aria-label="登入" className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-variant">
                                <span className="material-symbols-outlined text-on-surface-variant" style={{ fontVariationSettings: "'FILL' 1" }}>
                                    person
                                </span>
                            </button>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
