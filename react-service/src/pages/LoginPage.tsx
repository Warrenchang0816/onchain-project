import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchSIWEMessage, login, sha256hex } from "@/api/authApi";
import { signSIWEMessage, toChecksumAddress } from "@/api/walletApi";
import SiteLayout from "../layouts/SiteLayout";

const SEPOLIA_CHAIN_ID = "0xaa36a7";

type WalletState =
    | { status: "idle" }
    | { status: "signing" }
    | { status: "signed"; address: string; siweMessage: string; siweSignature: string };

const LoginPage = () => {
    const navigate = useNavigate();
    const [idNumber, setIdNumber] = useState("");
    const [password, setPassword] = useState("");
    const [wallet, setWallet] = useState<WalletState>({ status: "idle" });
    const [error, setError] = useState("");
    const [isBusy, setIsBusy] = useState(false);

    const connectAndSign = async () => {
        const provider = window.ethereum;
        if (!provider) {
            setError("請先安裝 MetaMask。");
            return;
        }
        setError("");
        setWallet({ status: "signing" });
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

            setWallet({ status: "signed", address, siweMessage: message, siweSignature: signature });
        } catch (err) {
            setWallet({ status: "idle" });
            setError(err instanceof Error ? err.message : "錢包連接失敗，請稍後再試。");
        }
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (wallet.status !== "signed") {
            setError("請先完成錢包連接與簽名。");
            return;
        }
        setError("");
        setIsBusy(true);
        try {
            // Compute person_hash = SHA-256(id_number) in the browser — raw ID never sent.
            const personHash = await sha256hex(idNumber.trim().toUpperCase());

            await login({
                person_hash: personHash,
                siwe_message: wallet.siweMessage,
                siwe_signature: wallet.siweSignature,
                password,
            });

            window.dispatchEvent(new CustomEvent("wallet-auth-changed"));
            navigate("/member");
        } catch (err) {
            const msg = err instanceof Error ? err.message : "登入失敗，請稍後再試。";
            // If the error is about wallet mismatch, append the signed wallet address hint.
            if (msg.includes("錢包地址與帳號不符") && wallet.status === "signed") {
                const addr = wallet.address;
                const hint = `${addr.slice(0, 7)}...${addr.slice(-5)}`;
                setError(`${msg}（簽名錢包：${hint}）`);
            } else {
                setError(msg);
            }
        } finally {
            setIsBusy(false);
        }
    };

    const walletSigned = wallet.status === "signed";

    return (
        <SiteLayout>
            <section className="auth-shell">
                <div className="auth-hero">
                    <h1>登入平台</h1>
                    <p>
                        使用身分證字號、綁定的錢包簽名與登入密碼進行三重驗證。
                        首次使用請先完成 KYC 身份驗證。
                    </p>
                </div>

                <form className="auth-card" onSubmit={(e) => void handleSubmit(e)}>
                    {/* ── ID number ── */}
                    <label className="form-field">
                        <span>身分證字號</span>
                        <input
                            type="text"
                            value={idNumber}
                            onChange={(e) => setIdNumber(e.target.value)}
                            placeholder="A123456789"
                            maxLength={10}
                            required
                            autoComplete="off"
                            spellCheck={false}
                        />
                    </label>

                    {/* ── Wallet connect + sign ── */}
                    <div className="form-field">
                        <span>錢包簽名</span>
                        {walletSigned ? (
                            <div className="login-wallet-box login-wallet-box--signed">
                                <span className="login-wallet-check">✓</span>
                                <span className="login-wallet-addr">
                                    {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}
                                </span>
                                <button
                                    type="button"
                                    className="login-wallet-reset"
                                    onClick={() => setWallet({ status: "idle" })}
                                >
                                    重新簽名
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                className="login-wallet-connect-btn"
                                onClick={() => void connectAndSign()}
                                disabled={wallet.status === "signing"}
                            >
                                {wallet.status === "signing" ? "連接中..." : "連接 MetaMask 並簽名"}
                            </button>
                        )}
                    </div>

                    {/* ── Password ── */}
                    <label className="form-field">
                        <span>登入密碼</span>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                            placeholder="8 個字元以上"
                        />
                    </label>

                    {error ? <p className="form-error">{error}</p> : null}

                    <button type="submit" disabled={isBusy || !walletSigned}>
                        {isBusy ? "驗證中..." : "登入"}
                    </button>

                    <p className="auth-switch">
                        還沒有帳號？
                        <Link to="/kyc">前往 KYC 註冊</Link>
                    </p>
                </form>
            </section>
        </SiteLayout>
    );
};

export default LoginPage;
