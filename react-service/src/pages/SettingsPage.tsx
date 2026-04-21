import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchSIWEMessage, getAuthMe } from "@/api/authApi";
import { signSIWEMessage, toChecksumAddress } from "@/api/walletApi";
import Header from "@/components/common/Header";

const API_BASE_URL = import.meta.env.VITE_API_GO_SERVICE_URL ?? "http://localhost:8081/api";
const SEPOLIA_CHAIN_ID = "0xaa36a7";

type PageState =
    | { status: "loading" }
    | { status: "unauthenticated" }
    | { status: "ready"; address: string };

type WalletSignState =
    | { status: "idle" }
    | { status: "signing" }
    | { status: "signed"; address: string; siweMessage: string; siweSignature: string };

const inputCls =
    "w-full bg-surface border-none rounded-lg px-4 py-3 text-on-surface " +
    "focus:ring-2 focus:ring-primary-container outline outline-1 outline-outline-variant/15 placeholder:text-outline";

const SettingsPage = () => {
    const navigate = useNavigate();
    const [page, setPage] = useState<PageState>({ status: "loading" });
    const [walletSign, setWalletSign] = useState<WalletSignState>({ status: "idle" });
    const [showWalletChange, setShowWalletChange] = useState(false);

    // Password change
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordBusy, setPasswordBusy] = useState(false);
    const [passwordError, setPasswordError] = useState("");
    const [passwordSuccess, setPasswordSuccess] = useState("");

    // Wallet change
    const [walletPassword, setWalletPassword] = useState("");
    const [walletBusy, setWalletBusy] = useState(false);
    const [walletError, setWalletError] = useState("");
    const [walletSuccess, setWalletSuccess] = useState("");

    useEffect(() => {
        getAuthMe()
            .then((auth) => {
                if (!auth.authenticated || !auth.address) {
                    setPage({ status: "unauthenticated" });
                } else {
                    setPage({ status: "ready", address: auth.address });
                }
            })
            .catch(() => setPage({ status: "unauthenticated" }));
    }, []);

    const connectNewWallet = async () => {
        const provider = window.ethereum;
        if (!provider) { setWalletError("請先安裝 MetaMask。"); return; }
        setWalletError("");
        setWalletSign({ status: "signing" });
        try {
            const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
            const address = toChecksumAddress(accounts[0]);
            const chainId = (await provider.request({ method: "eth_chainId" })) as string;
            if (chainId.toLowerCase() !== SEPOLIA_CHAIN_ID) {
                await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: SEPOLIA_CHAIN_ID }] });
            }
            const { message } = await fetchSIWEMessage({ address });
            const signature = await signSIWEMessage(message, address);
            setWalletSign({ status: "signed", address, siweMessage: message, siweSignature: signature });
        } catch (err) {
            setWalletSign({ status: "idle" });
            setWalletError(err instanceof Error ? err.message : "錢包連接失敗，請稍後再試。");
        }
    };

    const handleChangeWallet = async (e: React.FormEvent) => {
        e.preventDefault();
        if (walletSign.status !== "signed") return;
        setWalletError("");
        setWalletSuccess("");
        setWalletBusy(true);
        try {
            const resp = await fetch(`${API_BASE_URL}/auth/wallet/change`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    new_siwe_message: walletSign.siweMessage,
                    new_siwe_signature: walletSign.siweSignature,
                    password: walletPassword,
                }),
            });
            const raw = await resp.text();
            const data = raw ? (JSON.parse(raw) as { ok?: boolean; message?: string; error?: string }) : {};
            if (!resp.ok) throw new Error(data.error ?? `切換失敗 (${resp.status})`);
            setWalletSuccess(data.message ?? "錢包已切換，請重新登入。");
            setTimeout(() => navigate("/login"), 2000);
        } catch (err) {
            setWalletError(err instanceof Error ? err.message : "切換失敗，請稍後再試。");
        } finally {
            setWalletBusy(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError("");
        setPasswordSuccess("");
        if (newPassword.length < 8) { setPasswordError("新密碼至少需要 8 個字元"); return; }
        if (newPassword !== confirmPassword) { setPasswordError("兩次輸入的密碼不一致"); return; }
        setPasswordBusy(true);
        try {
            const resp = await fetch(`${API_BASE_URL}/auth/password/change`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
            });
            const raw = await resp.text();
            const data = raw ? (JSON.parse(raw) as { message?: string; error?: string }) : {};
            if (!resp.ok) throw new Error(data.error ?? `更改失敗 (${resp.status})`);
            setPasswordSuccess(data.message ?? "密碼已更新。");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err) {
            setPasswordError(err instanceof Error ? err.message : "更改失敗，請稍後再試。");
        } finally {
            setPasswordBusy(false);
        }
    };

    const handleLogout = async () => {
        try {
            await fetch(`${API_BASE_URL}/auth/logout`, { method: "POST", credentials: "include" });
        } catch {
            // ignore errors
        }
        window.dispatchEvent(new CustomEvent("wallet-auth-changed"));
        navigate("/login");
    };

    if (page.status === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <span className="text-sm text-on-surface-variant animate-pulse">讀取中...</span>
            </div>
        );
    }

    if (page.status === "unauthenticated") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center">
                    <p className="text-on-surface-variant mb-4">目前尚未登入。</p>
                    <button
                        type="button"
                        className="bg-primary-container text-on-primary-container px-6 py-3 rounded-lg font-bold hover:brightness-105 transition-all"
                        onClick={() => navigate("/login")}
                    >
                        前往登入
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-background text-on-surface min-h-screen flex flex-col">
            <Header />

            <main className="flex-grow w-full max-w-[800px] mx-auto px-6 py-12 md:py-24">
                <div className="mb-12">
                    <h1 className="text-[32px] md:text-[40px] font-extrabold font-headline text-on-surface leading-tight tracking-tight mb-2">設定</h1>
                    <p className="text-[15px] font-body text-on-surface-variant leading-[1.75]">管理您的錢包、密碼與帳號安全設定。</p>
                </div>

                <div className="space-y-8">
                    {/* Wallet Management */}
                    <section className="bg-surface-container-lowest rounded-xl p-8 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-surface-container-low opacity-50 -z-10 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="flex items-start justify-between mb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-primary-container">
                                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance_wallet</span>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold font-headline text-on-surface">錢包管理</h2>
                                    <p className="text-[15px] text-on-surface-variant mt-1 leading-[1.75]">連結您的 Web3 錢包以進行智能合約操作。</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-surface rounded-lg p-6 flex flex-col sm:flex-row items-center justify-between gap-4 outline outline-1 outline-outline-variant/15">
                            <div className="flex items-center gap-4 w-full">
                                <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center">
                                    <span className="material-symbols-outlined text-tertiary">check_circle</span>
                                </div>
                                <div className="flex-grow overflow-hidden">
                                    <p className="text-sm font-bold text-on-surface">MetaMask</p>
                                    <p className="text-sm text-on-surface-variant font-mono truncate">{page.address}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowWalletChange((v) => !v)}
                                className="whitespace-nowrap px-6 py-2.5 rounded-lg bg-surface-container-lowest text-on-surface text-sm font-bold hover:bg-surface-container-low transition-colors outline outline-1 outline-outline-variant/15 w-full sm:w-auto"
                            >
                                {showWalletChange ? "取消" : "中斷連結"}
                            </button>
                        </div>

                        {showWalletChange && (
                            <form className="mt-6 flex flex-col gap-4" onSubmit={(e) => void handleChangeWallet(e)}>
                                <p className="text-sm text-on-surface-variant">連接新的 MetaMask 錢包並完成簽名，再輸入登入密碼即可切換。</p>
                                {walletSign.status === "signed" ? (
                                    <div className="flex items-center gap-3 px-4 py-3 bg-tertiary/10 border border-tertiary/20 rounded-lg">
                                        <span className="material-symbols-outlined text-tertiary text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                        <span className="text-sm font-mono text-on-surface flex-1">{walletSign.address.slice(0, 6)}…{walletSign.address.slice(-4)}</span>
                                        <button type="button" className="text-xs text-on-surface-variant hover:text-error bg-transparent" onClick={() => setWalletSign({ status: "idle" })}>重新選擇</button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => void connectNewWallet()}
                                        disabled={walletSign.status === "signing"}
                                        className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-lg bg-surface-container-lowest text-on-surface font-medium border border-outline-variant/30 hover:bg-surface-container-low transition-colors disabled:opacity-60"
                                    >
                                        <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
                                        {walletSign.status === "signing" ? "連接中..." : "連接新錢包並簽名"}
                                    </button>
                                )}
                                <input
                                    type="password"
                                    className={inputCls}
                                    placeholder="請輸入目前的登入密碼"
                                    value={walletPassword}
                                    onChange={(e) => setWalletPassword(e.target.value)}
                                    required
                                    autoComplete="current-password"
                                />
                                {walletError && <p className="text-sm text-error">{walletError}</p>}
                                {walletSuccess && <p className="text-sm text-tertiary">{walletSuccess}</p>}
                                <div className="flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={walletBusy || walletSign.status !== "signed" || !walletPassword}
                                        className="bg-[#E8B800] text-[#1C1917] px-8 py-3 rounded-lg font-bold hover:brightness-105 transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] disabled:opacity-50"
                                    >
                                        {walletBusy ? "切換中..." : "確認切換錢包"}
                                    </button>
                                </div>
                            </form>
                        )}
                    </section>

                    {/* Password */}
                    <section className="bg-surface-container-lowest rounded-xl p-8 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-surface-container-low opacity-50 -z-10 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="flex items-start justify-between mb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-primary-container">
                                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold font-headline text-on-surface">密碼設定</h2>
                                    <p className="text-[15px] text-on-surface-variant mt-1 leading-[1.75]">更新您的登入密碼以確保帳號安全。</p>
                                </div>
                            </div>
                        </div>
                        <form className="space-y-6" onSubmit={(e) => void handleChangePassword(e)}>
                            <div>
                                <label className="block text-sm font-bold text-on-surface mb-2">目前密碼</label>
                                <input
                                    type="password"
                                    className={inputCls}
                                    placeholder="••••••••"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    required
                                    autoComplete="current-password"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-on-surface mb-2">新密碼</label>
                                <input
                                    type="password"
                                    className={inputCls}
                                    placeholder="至少 8 個字元"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    autoComplete="new-password"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-on-surface mb-2">確認新密碼</label>
                                <input
                                    type="password"
                                    className={inputCls}
                                    placeholder="再次輸入新密碼"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    autoComplete="new-password"
                                />
                            </div>
                            {passwordError && <p className="text-sm text-error">{passwordError}</p>}
                            {passwordSuccess && <p className="text-sm text-tertiary">{passwordSuccess}</p>}
                            <div className="pt-2 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={passwordBusy}
                                    className="bg-[#E8B800] text-[#1C1917] px-8 py-3 rounded-lg font-bold hover:brightness-105 transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] disabled:opacity-50"
                                >
                                    {passwordBusy ? "更改中..." : "更改密碼"}
                                </button>
                            </div>
                        </form>
                    </section>

                    {/* Logout */}
                    <div className="pt-8 flex justify-center">
                        <button
                            type="button"
                            onClick={() => void handleLogout()}
                            className="bg-transparent text-error hover:text-on-error hover:bg-error px-6 py-3 rounded-lg font-bold transition-colors flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined">logout</span>
                            登出帳號
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default SettingsPage;
