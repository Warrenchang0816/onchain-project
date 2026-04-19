import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchSIWEMessage, login, sha256hex } from "@/api/authApi";
import { signSIWEMessage, toChecksumAddress } from "@/api/walletApi";

const SEPOLIA_CHAIN_ID = "0xaa36a7";

type WalletState =
    | { status: "idle" }
    | { status: "signing" }
    | { status: "signed"; address: string; siweMessage: string; siweSignature: string };

const inputCls =
    "block w-full pl-10 pr-3 py-3 border-0 bg-surface-container-low text-on-surface rounded-lg " +
    "focus:ring-2 focus:ring-primary-container focus:bg-surface-container-lowest transition-colors " +
    "sm:text-sm placeholder:text-outline outline-none";

const LoginPage = () => {
    const navigate = useNavigate();
    const [idNumber, setIdNumber]   = useState("");
    const [password, setPassword]   = useState("");
    const [wallet, setWallet]       = useState<WalletState>({ status: "idle" });
    const [error, setError]         = useState("");
    const [isBusy, setIsBusy]       = useState(false);
    const [showPass, setShowPass]   = useState(false);

    const connectAndSign = async () => {
        const provider = window.ethereum;
        if (!provider) { setError("請先安裝 MetaMask。"); return; }
        setError("");
        setWallet({ status: "signing" });
        try {
            const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
            const address  = toChecksumAddress(accounts[0]);
            const chainId  = (await provider.request({ method: "eth_chainId" })) as string;
            if (chainId.toLowerCase() !== SEPOLIA_CHAIN_ID) {
                await provider.request({
                    method: "wallet_switchEthereumChain",
                    params: [{ chainId: SEPOLIA_CHAIN_ID }],
                });
            }
            const { message } = await fetchSIWEMessage({ address });
            const signature   = await signSIWEMessage(message, address);
            setWallet({ status: "signed", address, siweMessage: message, siweSignature: signature });
        } catch (err) {
            setWallet({ status: "idle" });
            setError(err instanceof Error ? err.message : "錢包連接失敗，請稍後再試。");
        }
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (wallet.status !== "signed") { setError("請先完成錢包連接與簽名。"); return; }
        setError("");
        setIsBusy(true);
        try {
            const personHash = await sha256hex(idNumber.trim().toUpperCase());
            await login({
                person_hash:    personHash,
                siwe_message:   wallet.siweMessage,
                siwe_signature: wallet.siweSignature,
                password,
            });
            window.dispatchEvent(new CustomEvent("wallet-auth-changed"));
            navigate("/member");
        } catch (err) {
            const msg = err instanceof Error ? err.message : "登入失敗，請稍後再試。";
            if (msg.includes("錢包地址與帳號不符") && wallet.status === "signed") {
                const addr = wallet.address;
                setError(`${msg}（簽名錢包：${addr.slice(0, 7)}...${addr.slice(-5)}）`);
            } else {
                setError(msg);
            }
        } finally {
            setIsBusy(false);
        }
    };

    const walletSigned = wallet.status === "signed";

    return (
        <main className="flex w-full min-h-screen">
            {/* ── Left panel ── */}
            <section className="hidden lg:flex w-[45%] relative bg-gradient-to-br from-primary-container to-primary-fixed-dim flex-col justify-between p-16 overflow-hidden">
                {/* dot grid */}
                <div
                    className="absolute inset-0 opacity-10 pointer-events-none"
                    style={{ backgroundImage: "radial-gradient(circle at 20% 80%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }}
                />
                {/* architectural SVG */}
                <div className="absolute right-0 top-1/4 w-[120%] h-full pointer-events-none opacity-20">
                    <svg className="w-full h-full stroke-on-primary-container stroke-[0.5]" fill="none" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
                        <path d="M50 350 L150 150 L250 200 L350 50 M150 150 L150 350 M250 200 L250 350" />
                        <rect height="300" strokeWidth="1" width="300" x="50" y="50" />
                        <line strokeWidth="0.5" x1="50" x2="350" y1="150" y2="150" />
                        <line strokeWidth="0.5" x1="50" x2="350" y1="250" y2="250" />
                    </svg>
                </div>

                <div className="relative z-10">
                    <button
                        type="button"
                        onClick={() => navigate("/")}
                        className="text-4xl font-extrabold text-on-surface tracking-tight mb-2 text-left bg-transparent cursor-pointer hover:opacity-80 transition-opacity"
                    >
                        去中心化房屋平台
                    </button>
                    <div className="w-12 h-1 bg-on-surface mb-6" />
                    <p className="text-xl text-on-primary-container font-medium leading-[1.75]">可信任的房屋媒合市場</p>
                </div>
                <div className="relative z-10 text-on-primary-container/80 text-sm">
                    <p>光照充足・空氣流通</p>
                    <p>The Luminous Pavilion Architecture</p>
                </div>
            </section>

            {/* ── Right panel ── */}
            <section className="w-full lg:w-[55%] flex items-center justify-center p-8 sm:p-12 md:p-24 bg-background relative">
                {/* mobile brand */}
                <div className="absolute top-8 left-8 lg:hidden">
                    <h1 className="text-2xl font-extrabold text-on-surface border-b-2 border-primary-container pb-0.5 inline-block">
                        去中心化房屋平台
                    </h1>
                </div>

                <div className="w-full max-w-md relative z-10">
                    {/* Welcome Text */}
                    <div className="mb-10 text-center lg:text-left">
                        <h2 className="text-[32px] font-headline font-bold text-on-surface tracking-tight mb-3">歡迎回來</h2>
                        <p className="text-on-surface-variant text-[15px] leading-[1.75]">
                            請登入您的帳戶以繼續探索優質房源。
                        </p>
                    </div>

                    {/* Form Card */}
                    <div className="bg-surface-container-lowest rounded-xl p-8 sm:p-10 relative">
                        <div className="absolute inset-0 bg-on-surface opacity-[0.02] blur-xl rounded-xl -z-10" />
                        <div className="absolute inset-0 border border-outline-variant opacity-15 rounded-xl pointer-events-none" />

                        <form className="space-y-6 relative z-10" onSubmit={(e) => void handleSubmit(e)}>
                            {/* ID Number */}
                            <div>
                                <label className="block text-[15px] font-medium text-on-surface mb-2" htmlFor="identifier">
                                    身分證字號
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <span className="material-symbols-outlined text-outline">person</span>
                                    </div>
                                    <input
                                        id="identifier"
                                        type="text"
                                        className={inputCls}
                                        placeholder="輸入您的身分證字號"
                                        required
                                        autoComplete="off"
                                        spellCheck={false}
                                        value={idNumber}
                                        onChange={(e) => setIdNumber(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Wallet Connect */}
                            <div>
                                <label className="block text-[15px] font-medium text-on-surface mb-2">
                                    連結錢包
                                </label>
                                {walletSigned && wallet.status === "signed" ? (
                                    <div className="flex items-center gap-3 px-4 py-3 bg-tertiary/10 border border-tertiary/20 rounded-lg">
                                        <span className="material-symbols-outlined text-tertiary text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                        <span className="text-sm font-mono text-on-surface flex-1">
                                            {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}
                                        </span>
                                        <button
                                            type="button"
                                            className="text-xs text-on-surface-variant hover:text-error transition-colors bg-transparent"
                                            onClick={() => setWallet({ status: "idle" })}
                                        >
                                            重新簽名
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => void connectAndSign()}
                                        disabled={wallet.status === "signing"}
                                        className="w-full flex justify-center items-center gap-3 py-3 px-4 rounded-lg bg-surface-container-low text-on-surface font-medium border border-outline-variant opacity-90 hover:opacity-100 hover:bg-surface-variant transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-container"
                                    >
                                        <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
                                        <span>{wallet.status === "signing" ? "連接中…" : "連接 MetaMask"}</span>
                                    </button>
                                )}
                            </div>

                            {/* Password */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-[15px] font-medium text-on-surface" htmlFor="password">
                                        密碼
                                    </label>
                                    <Link
                                        to="/forgot-password"
                                        className="text-sm font-medium text-tertiary hover:text-on-surface transition-colors underline decoration-transparent hover:decoration-tertiary"
                                    >
                                        忘記密碼？
                                    </Link>
                                </div>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <span className="material-symbols-outlined text-outline">lock</span>
                                    </div>
                                    <input
                                        id="password"
                                        type={showPass ? "text" : "password"}
                                        className={`${inputCls} pr-10`}
                                        placeholder="••••••••"
                                        required
                                        autoComplete="current-password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-outline hover:text-on-surface transition-colors bg-transparent"
                                        onClick={() => setShowPass((s) => !s)}
                                    >
                                        <span className="material-symbols-outlined text-[20px]">
                                            {showPass ? "visibility" : "visibility_off"}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="px-4 py-3 bg-error-container text-on-error-container rounded-lg text-sm">
                                    {error}
                                </div>
                            )}

                            {/* Login Button */}
                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={isBusy || !walletSigned}
                                    className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-lg text-on-primary-fixed bg-primary-container hover:bg-inverse-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-container transition-all duration-300 font-bold text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] disabled:opacity-50"
                                >
                                    {isBusy ? "驗證中…" : "登入"}
                                </button>
                            </div>
                        </form>

                        {/* Registration Link */}
                        <p className="mt-8 text-center text-[15px] text-on-surface-variant">
                            還沒有帳戶？{" "}
                            <Link
                                to="/kyc"
                                className="font-medium text-tertiary hover:text-on-surface transition-colors underline decoration-tertiary underline-offset-4"
                            >
                                立即註冊
                            </Link>
                        </p>
                    </div>
                </div>
            </section>
        </main>
    );
};

export default LoginPage;
