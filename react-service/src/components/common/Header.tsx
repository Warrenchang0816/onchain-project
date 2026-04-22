import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { getAuthMe, logout } from "@/api/authApi";
import { getKYCStatus, type KYCStatus } from "@/api/kycApi";

async function revokeWalletPermissions() {
    const provider = window.ethereum;
    if (provider) {
        try {
            await provider.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] });
        } catch { /* ignore */ }
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

type HeaderState = {
    loading: boolean;
    authenticated: boolean;
    address?: string;
    kycStatus: KYCStatus;
    credentials: string[];
};

const Header = () => {
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [state, setState] = useState<HeaderState>({
        loading: true,
        authenticated: false,
        kycStatus: "UNVERIFIED",
        credentials: [],
    });
    const menuRef = useRef<HTMLDivElement | null>(null);

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
                setState({ loading: false, authenticated: true, address: auth.address, kycStatus: kyc.kycStatus, credentials: kyc.credentials ?? [] });
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

    const navLinkCls = ({ isActive }: { isActive: boolean }) =>
        isActive
            ? "text-[#E8B800] font-bold border-b-2 border-[#E8B800] pb-1 scale-95 active:opacity-80 transition-transform"
            : "text-[#1C1917] dark:text-stone-300 font-medium hover:text-[#E8B800] hover:bg-[#F5F3EE] dark:hover:bg-stone-900 transition-all duration-300 scale-95 active:opacity-80 transition-transform";

    return (
        <header className="bg-[#FFFEF9]/80 dark:bg-stone-950/80 backdrop-blur-3xl sticky top-0 h-[64px] w-full z-50 bg-[#F5F3EE] dark:bg-stone-900">
            <div className="flex justify-between items-center w-full px-6 md:px-12 max-w-[1440px] mx-auto h-full font-['Inter','Noto_Sans_TC'] tracking-tight leading-[1.75]">

                {/* Brand — first flex child, stays left */}
                <button
                    type="button"
                    onClick={() => navigate("/")}
                    className="text-xl font-extrabold text-[#1C1917] dark:text-stone-50 border-b-2 border-[#E8B800] pb-0.5 bg-transparent"
                >
                    去中心化房屋平台
                </button>

                {/* Navigation — second flex child, justify-between centres it */}
                <nav className="hidden md:flex items-center gap-8">
                    <NavLink to="/" end className={navLinkCls}>首頁</NavLink>
                    <NavLink to="/listings" className={navLinkCls}>列表</NavLink>
                </nav>

                {/* Trailing — third flex child, stays right */}
                <div className="flex items-center gap-4">
                    {state.loading ? (
                        <span className="text-xs text-[#807660] animate-pulse">讀取中…</span>
                    ) : state.authenticated ? (
                        <>
                            <button
                                type="button"
                                className="hidden md:block text-[#1C1917] font-medium hover:text-[#E8B800] transition-colors bg-transparent"
                                onClick={() => navigate("/member")}
                            >
                                {role}
                            </button>
                            <div className="relative" ref={menuRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsMenuOpen((o) => !o)}
                                    aria-label="帳號選單"
                                    className="w-8 h-8 rounded-full bg-surface-variant overflow-hidden flex items-center justify-center border border-outline-variant/30"
                                >
                                    <span
                                        className="material-symbols-outlined text-on-surface-variant"
                                        style={{ fontVariationSettings: "'FILL' 1" }}
                                    >
                                        person
                                    </span>
                                </button>

                                {isMenuOpen && (
                                    <div className="absolute right-0 top-full mt-2 w-44 bg-surface-container-lowest rounded-xl shadow-[0_8px_32px_rgba(28,25,23,0.12)] border border-outline-variant/20 overflow-hidden z-50">
                                        {state.address && (
                                            <div className="px-4 py-3 text-xs text-outline border-b border-surface-container font-mono truncate">
                                                {state.address.slice(0, 6)}…{state.address.slice(-4)}
                                            </div>
                                        )}
                                        {[
                                            { label: "會員資料", path: "/profile" },
                                            { label: "身份中心", path: "/member" },
                                            { label: "Legacy logs", path: "/logs" },
                                            { label: "設定",     path: "/settings" },
                                        ].map(({ label, path }) => (
                                            <button
                                                key={path}
                                                type="button"
                                                className="w-full text-left px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors bg-transparent"
                                                onClick={() => { setIsMenuOpen(false); navigate(path); }}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                        <div className="border-t border-surface-container">
                                            <button
                                                type="button"
                                                className="w-full text-left px-4 py-2.5 text-sm text-error hover:bg-error-container transition-colors bg-transparent"
                                                onClick={() => void handleLogout()}
                                            >
                                                登出
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        /* Unauthenticated — matches Stitch visual: text link + round avatar circle */
                        <>
                            <button
                                type="button"
                                onClick={() => navigate("/login")}
                                className="hidden md:block text-[#1C1917] font-medium hover:text-[#E8B800] transition-colors bg-transparent"
                            >
                                登入
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate("/login")}
                                aria-label="登入"
                                className="w-8 h-8 rounded-full bg-surface-variant overflow-hidden flex items-center justify-center"
                            >
                                <span
                                    className="material-symbols-outlined text-on-surface-variant"
                                    style={{ fontVariationSettings: "'FILL' 1" }}
                                >
                                    person
                                </span>
                            </button>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
