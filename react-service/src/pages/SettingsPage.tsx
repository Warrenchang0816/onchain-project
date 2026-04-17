import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchSIWEMessage, getAuthMe } from "@/api/authApi";
import { signSIWEMessage, toChecksumAddress } from "@/api/walletApi";
import SiteLayout from "../layouts/SiteLayout";

const API_BASE_URL = import.meta.env.VITE_API_GO_SERVICE_URL ?? "http://localhost:8081/api";
const SEPOLIA_CHAIN_ID = "0xaa36a7";

type PageState =
    | { status: "loading" }
    | { status: "unauthenticated" }
    | { status: "ready"; address: string; kycStatus: string };

type WalletSignState =
    | { status: "idle" }
    | { status: "signing" }
    | { status: "signed"; address: string; siweMessage: string; siweSignature: string };

const SettingsPage = () => {
    const navigate = useNavigate();
    const [page, setPage] = useState<PageState>({ status: "loading" });
    const [walletSign, setWalletSign] = useState<WalletSignState>({ status: "idle" });
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        getAuthMe()
            .then((auth) => {
                if (!auth.authenticated || !auth.address) {
                    setPage({ status: "unauthenticated" });
                } else {
                    setPage({ status: "ready", address: auth.address, kycStatus: auth.isPlatformWallet ? "platform" : "user" });
                }
            })
            .catch(() => setPage({ status: "unauthenticated" }));
    }, []);

    const connectNewWallet = async () => {
        const provider = window.ethereum;
        if (!provider) {
            setError("請先安裝 MetaMask。");
            return;
        }
        setError("");
        setWalletSign({ status: "signing" });
        try {
            const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
            const address = toChecksumAddress(accounts[0]);

            const chainId = (await provider.request({ method: "eth_chainId" })) as string;
            if (chainId.toLowerCase() !== SEPOLIA_CHAIN_ID) {
                await provider.request({
                    method: "wallet_switchEthereumChain",
                    params: [{ chainId: SEPOLIA_CHAIN_ID }],
                });
            }

            const { message } = await fetchSIWEMessage({ address });
            const signature = await signSIWEMessage(message, address);
            setWalletSign({ status: "signed", address, siweMessage: message, siweSignature: signature });
        } catch (err) {
            setWalletSign({ status: "idle" });
            setError(err instanceof Error ? err.message : "錢包連接失敗，請稍後再試。");
        }
    };

    const handleChangeWallet = async (e: React.FormEvent) => {
        e.preventDefault();
        if (walletSign.status !== "signed") return;
        setError("");
        setSuccess("");
        setBusy(true);
        try {
            const resp = await fetch(`${API_BASE_URL}/auth/wallet/change`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    new_siwe_message: walletSign.siweMessage,
                    new_siwe_signature: walletSign.siweSignature,
                    password,
                }),
            });
            const raw = await resp.text();
            const data = raw ? (JSON.parse(raw) as { ok?: boolean; message?: string; error?: string }) : {};
            if (!resp.ok) throw new Error(data.error ?? `切換失敗 (${resp.status})`);
            setSuccess(data.message ?? "錢包已切換，請重新登入。");
            // Force logout after wallet change since session is now stale
            setTimeout(() => navigate("/login"), 2000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "切換失敗，請稍後再試。");
        } finally {
            setBusy(false);
        }
    };

    if (page.status === "loading") {
        return (
            <SiteLayout>
                <section className="page-section"><p>讀取中...</p></section>
            </SiteLayout>
        );
    }

    if (page.status === "unauthenticated") {
        return (
            <SiteLayout>
                <section className="page-section">
                    <div className="page-heading"><h1>設定</h1></div>
                    <div className="member-card">
                        <p>目前尚未登入。</p>
                        <button type="button" onClick={() => navigate("/login")}>前往登入</button>
                    </div>
                </section>
            </SiteLayout>
        );
    }

    const newWalletSigned = walletSign.status === "signed";

    return (
        <SiteLayout>
            <section className="page-section">
                <div className="page-heading">
                    <h1>設定</h1>
                    <p>管理帳號綁定的錢包地址。</p>
                </div>

                {/* ── Current wallet info ── */}
                <div className="member-card settings-info-card">
                    <div className="settings-info-row">
                        <span className="settings-info-label">目前綁定錢包</span>
                        <span className="settings-info-value">{page.address}</span>
                    </div>
                </div>

                {/* ── Change wallet module ── */}
                <div className="member-card">
                    <h2 className="settings-section-title">切換綁定錢包</h2>
                    <p className="settings-section-desc">
                        連接新的 MetaMask 錢包並完成簽名，再輸入登入密碼即可切換。
                        切換後請使用新錢包重新登入。
                    </p>

                    <form onSubmit={(e) => void handleChangeWallet(e)} style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
                        {/* New wallet sign */}
                        <div className="form-field">
                            <span>新錢包簽名</span>
                            {newWalletSigned ? (
                                <div className="login-wallet-box login-wallet-box--signed">
                                    <span className="login-wallet-check">✓</span>
                                    <span className="login-wallet-addr">
                                        {walletSign.address.slice(0, 6)}…{walletSign.address.slice(-4)}
                                    </span>
                                    <button
                                        type="button"
                                        className="login-wallet-reset"
                                        onClick={() => setWalletSign({ status: "idle" })}
                                    >
                                        重新選擇
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    className="login-wallet-connect-btn"
                                    onClick={() => void connectNewWallet()}
                                    disabled={walletSign.status === "signing"}
                                >
                                    {walletSign.status === "signing" ? "連接中..." : "連接新錢包並簽名"}
                                </button>
                            )}
                        </div>

                        {/* Password verification */}
                        <label className="form-field">
                            <span>登入密碼（確認身份）</span>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                                placeholder="請輸入目前的登入密碼"
                            />
                        </label>

                        {error ? <p className="form-error">{error}</p> : null}
                        {success ? <p className="member-success">{success}</p> : null}

                        <button type="submit" disabled={busy || !newWalletSigned || !password}>
                            {busy ? "切換中..." : "確認切換錢包"}
                        </button>
                    </form>
                </div>
            </section>
        </SiteLayout>
    );
};

export default SettingsPage;
