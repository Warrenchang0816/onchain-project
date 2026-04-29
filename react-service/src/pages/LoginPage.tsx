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
    "block w-full rounded-lg border-0 bg-surface-container-low py-3 pl-10 pr-3 text-on-surface outline-none transition-colors " +
    "placeholder:text-outline focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container sm:text-sm";

export default function LoginPage() {
    const navigate = useNavigate();
    const [idNumber, setIdNumber] = useState("");
    const [password, setPassword] = useState("");
    const [wallet, setWallet] = useState<WalletState>({ status: "idle" });
    const [error, setError] = useState("");
    const [isBusy, setIsBusy] = useState(false);
    const [showPass, setShowPass] = useState(false);

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
                await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: SEPOLIA_CHAIN_ID }] });
            }
            const { message } = await fetchSIWEMessage({ address });
            const signature = await signSIWEMessage(message, address);
            setWallet({ status: "signed", address, siweMessage: message, siweSignature: signature });
        } catch (err) {
            setWallet({ status: "idle" });
            setError(err instanceof Error ? err.message : "錢包簽章失敗，請再試一次。");
        }
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (wallet.status !== "signed") {
            setError("請先連接錢包並完成簽章。");
            return;
        }
        setError("");
        setIsBusy(true);
        try {
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
            setError(err instanceof Error ? err.message : "登入失敗，請確認資料後再試。");
        } finally {
            setIsBusy(false);
        }
    };

    const walletSigned = wallet.status === "signed";

    return (
        <main className="flex min-h-screen w-full">
            <section className="relative hidden w-[45%] flex-col justify-between overflow-hidden bg-gradient-to-br from-primary-container to-primary-fixed-dim p-16 lg:flex">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 80%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
                <div className="relative z-10">
                    <button type="button" onClick={() => navigate("/")} className="mb-2 bg-transparent text-left text-4xl font-extrabold tracking-tight text-on-surface transition-opacity hover:opacity-80">
                        去中心化房屋平台
                    </button>
                    <div className="mb-6 h-1 w-12 bg-on-surface" />
                    <p className="text-xl font-medium leading-[1.75] text-on-primary-container">以身份揭露為起點，讓房源媒合更透明。</p>
                </div>
                <div className="relative z-10 text-sm text-on-primary-container/80">
                    <p>登入後可查看身份中心、角色狀態與私人工作區。</p>
                </div>
            </section>

            <section className="relative flex w-full items-center justify-center bg-background p-8 sm:p-12 md:p-24 lg:w-[55%]">
                <div className="absolute left-8 top-8 lg:hidden">
                    <h1 className="inline-block border-b-2 border-primary-container pb-0.5 text-2xl font-extrabold text-on-surface">
                        去中心化房屋平台
                    </h1>
                </div>

                <div className="relative z-10 w-full max-w-md">
                    <div className="mb-10 text-center lg:text-left">
                        <h2 className="mb-3 text-[32px] font-bold tracking-tight text-on-surface">會員登入</h2>
                        <p className="text-[15px] leading-[1.75] text-on-surface-variant">
                            使用身分證字號雜湊、錢包簽章與密碼登入，原始證號不會送出到伺服器。
                        </p>
                    </div>

                    <div className="relative rounded-xl bg-surface-container-lowest p-8 sm:p-10">
                        <div className="pointer-events-none absolute inset-0 rounded-xl border border-outline-variant opacity-15" />
                        <form className="relative z-10 space-y-6" onSubmit={(e) => void handleSubmit(e)}>
                            <div>
                                <label className="mb-2 block text-[15px] font-medium text-on-surface" htmlFor="identifier">身分證字號</label>
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute inset-y-0 left-0 flex items-center pl-3 text-outline">person</span>
                                    <input id="identifier" type="text" className={inputCls} placeholder="輸入身分證字號" required autoComplete="off" spellCheck={false} value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-[15px] font-medium text-on-surface">錢包簽章</label>
                                {walletSigned && wallet.status === "signed" ? (
                                    <div className="flex items-center gap-3 rounded-lg border border-tertiary/20 bg-tertiary/10 px-4 py-3">
                                        <span className="material-symbols-outlined text-base text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                        <span className="flex-1 font-mono text-sm text-on-surface">{wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}</span>
                                        <button type="button" className="bg-transparent text-xs text-on-surface-variant transition-colors hover:text-error" onClick={() => setWallet({ status: "idle" })}>
                                            重新簽章
                                        </button>
                                    </div>
                                ) : (
                                    <button type="button" onClick={() => void connectAndSign()} disabled={wallet.status === "signing"} className="flex w-full items-center justify-center gap-3 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 font-medium text-on-surface transition-colors hover:bg-surface-variant disabled:opacity-60">
                                        <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
                                        <span>{wallet.status === "signing" ? "簽章中..." : "連接 MetaMask"}</span>
                                    </button>
                                )}
                            </div>

                            <div>
                                <div className="mb-2 flex items-center justify-between">
                                    <label className="block text-[15px] font-medium text-on-surface" htmlFor="password">密碼</label>
                                    <Link to="/forgot-password" className="text-sm font-medium text-tertiary transition-colors hover:text-on-surface">忘記密碼？</Link>
                                </div>
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute inset-y-0 left-0 flex items-center pl-3 text-outline">lock</span>
                                    <input id="password" type={showPass ? "text" : "password"} className={`${inputCls} pr-10`} placeholder="輸入密碼" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                                    <button type="button" className="absolute inset-y-0 right-0 flex items-center bg-transparent pr-3 text-outline transition-colors hover:text-on-surface" onClick={() => setShowPass((show) => !show)}>
                                        <span className="material-symbols-outlined text-[20px]">{showPass ? "visibility" : "visibility_off"}</span>
                                    </button>
                                </div>
                            </div>

                            {error ? <div className="rounded-lg bg-error-container px-4 py-3 text-sm text-on-error-container">{error}</div> : null}

                            <button type="submit" disabled={isBusy || !walletSigned} className="flex w-full items-center justify-center rounded-lg bg-primary-container px-4 py-3.5 text-[15px] font-bold text-on-primary-container transition-opacity hover:opacity-90 disabled:opacity-50">
                                {isBusy ? "登入中..." : "登入"}
                            </button>
                        </form>

                        <p className="relative z-10 mt-8 text-center text-[15px] text-on-surface-variant">
                            還沒有會員資料？{" "}
                            <Link to="/kyc" className="font-medium text-tertiary underline decoration-tertiary underline-offset-4 transition-colors hover:text-on-surface">
                                開始 KYC
                            </Link>
                        </p>
                    </div>
                </div>
            </section>
        </main>
    );
}
