import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetPasswordRequestOTP, resetPasswordSetPassword } from "@/api/forgotPasswordApi";

type Step = "email" | "otp" | "password" | "done";

const inputCls =
    "block w-full rounded-lg border-0 bg-surface-container-low py-3 pl-10 pr-3 text-on-surface outline-none transition-colors " +
    "placeholder:text-outline focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container sm:text-sm";

export default function ForgotPasswordPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [step, setStep] = useState<Step>("email");
    const [email, setEmail] = useState(searchParams.get("email") ?? "");
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [isBusy, setIsBusy] = useState(false);
    const [error, setError] = useState("");
    const [cooldown, setCooldown] = useState(0);

    const startCooldown = () => {
        setCooldown(60);
        const id = setInterval(() => {
            setCooldown((seconds) => {
                if (seconds <= 1) {
                    clearInterval(id);
                    return 0;
                }
                return seconds - 1;
            });
        }, 1000);
    };

    const handleRequestOTP = async (e: FormEvent) => {
        e.preventDefault();
        setError("");
        setIsBusy(true);
        try {
            await resetPasswordRequestOTP(email.trim().toLowerCase());
            setStep("otp");
            startCooldown();
        } catch (err) {
            setError(err instanceof Error ? err.message : "寄送驗證碼失敗。");
        } finally {
            setIsBusy(false);
        }
    };

    const handleResendOTP = async () => {
        if (cooldown > 0) return;
        setError("");
        setIsBusy(true);
        try {
            await resetPasswordRequestOTP(email.trim().toLowerCase());
            startCooldown();
        } catch (err) {
            setError(err instanceof Error ? err.message : "重新寄送失敗。");
        } finally {
            setIsBusy(false);
        }
    };

    const handleVerifyOTP = (e: FormEvent) => {
        e.preventDefault();
        if (code.length !== 6) {
            setError("請輸入 6 位數驗證碼。");
            return;
        }
        setError("");
        setStep("password");
    };

    const handleSetPassword = async (e: FormEvent) => {
        e.preventDefault();
        if (password.length < 8) {
            setError("密碼至少需要 8 個字元。");
            return;
        }
        if (password !== passwordConfirm) {
            setError("兩次輸入的密碼不一致。");
            return;
        }
        setError("");
        setIsBusy(true);
        try {
            await resetPasswordSetPassword(email.trim().toLowerCase(), code, password);
            setStep("done");
        } catch (err) {
            setError(err instanceof Error ? err.message : "設定密碼失敗。");
        } finally {
            setIsBusy(false);
        }
    };

    return (
        <main className="flex min-h-screen w-full">
            <section className="relative hidden w-[45%] flex-col justify-between overflow-hidden bg-gradient-to-br from-primary-container to-primary-fixed-dim p-16 lg:flex">
                <div className="relative z-10">
                    <button type="button" onClick={() => navigate("/")} className="mb-2 bg-transparent text-left text-4xl font-extrabold tracking-tight text-on-surface transition-opacity hover:opacity-80">
                        去中心化房屋平台
                    </button>
                    <div className="mb-6 h-1 w-12 bg-on-surface" />
                    <p className="text-xl font-medium leading-[1.75] text-on-primary-container">重新設定密碼後，即可回到身份中心。</p>
                </div>
                <p className="relative z-10 text-sm text-on-primary-container/80">驗證碼會寄送至你綁定的電子郵件。</p>
            </section>

            <section className="relative flex w-full items-center justify-center bg-background p-8 sm:p-12 md:p-24 lg:w-[55%]">
                <div className="absolute left-8 top-8 lg:hidden">
                    <h1 className="inline-block border-b-2 border-primary-container pb-0.5 text-2xl font-extrabold text-on-surface">去中心化房屋平台</h1>
                </div>

                <div className="relative z-10 w-full max-w-md">
                    <div className="mb-10 text-center lg:text-left">
                        <h2 className="mb-3 text-[32px] font-bold tracking-tight text-on-surface">
                            {step === "done" ? "密碼已更新" : "重設密碼"}
                        </h2>
                        <p className="text-[15px] leading-[1.75] text-on-surface-variant">
                            {step === "email" ? "輸入電子郵件後，我們會寄送一次性驗證碼給你。" : null}
                            {step === "otp" ? `驗證碼已寄送至 ${email}，請在有效時間內輸入。` : null}
                            {step === "password" ? "請設定一組至少 8 個字元的新密碼。" : null}
                            {step === "done" ? "密碼已更新，請回到登入頁使用新密碼登入。" : null}
                        </p>
                    </div>

                    <div className="relative rounded-xl bg-surface-container-lowest p-8 sm:p-10">
                        <div className="pointer-events-none absolute inset-0 rounded-xl border border-outline-variant opacity-15" />

                        {step === "email" ? (
                            <form className="relative z-10 space-y-6" onSubmit={(e) => void handleRequestOTP(e)}>
                                <label className="block text-[15px] font-medium text-on-surface">
                                    電子郵件
                                    <div className="relative mt-2">
                                        <span className="material-symbols-outlined absolute inset-y-0 left-0 flex items-center pl-3 text-outline">mail</span>
                                        <input type="email" className={inputCls} placeholder="輸入電子郵件" required value={email} onChange={(e) => setEmail(e.target.value)} />
                                    </div>
                                </label>
                                {error ? <div className="rounded-lg bg-error-container px-4 py-3 text-sm text-on-error-container">{error}</div> : null}
                                <button type="submit" disabled={isBusy} className="flex w-full items-center justify-center rounded-lg bg-primary-container px-4 py-3.5 text-[15px] font-bold text-on-primary-container transition-opacity hover:opacity-90 disabled:opacity-50">
                                    {isBusy ? "寄送中..." : "寄送驗證碼"}
                                </button>
                            </form>
                        ) : null}

                        {step === "otp" ? (
                            <form className="relative z-10 space-y-6" onSubmit={(e) => void handleVerifyOTP(e)}>
                                <label className="block text-[15px] font-medium text-on-surface">
                                    電子郵件驗證碼
                                    <div className="relative mt-2">
                                        <span className="material-symbols-outlined absolute inset-y-0 left-0 flex items-center pl-3 text-outline">pin</span>
                                        <input type="text" inputMode="numeric" maxLength={6} className={inputCls} placeholder="6 位數驗證碼" required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
                                    </div>
                                </label>
                                {error ? <div className="rounded-lg bg-error-container px-4 py-3 text-sm text-on-error-container">{error}</div> : null}
                                <button type="submit" disabled={isBusy} className="flex w-full items-center justify-center rounded-lg bg-primary-container px-4 py-3.5 text-[15px] font-bold text-on-primary-container transition-opacity hover:opacity-90 disabled:opacity-50">
                                    驗證
                                </button>
                                <button type="button" disabled={cooldown > 0 || isBusy} onClick={() => void handleResendOTP()} className="w-full bg-transparent text-sm text-on-surface-variant transition-colors hover:text-on-surface disabled:opacity-50">
                                    {cooldown > 0 ? `重新寄送（${cooldown}s）` : "重新寄送驗證碼"}
                                </button>
                            </form>
                        ) : null}

                        {step === "password" ? (
                            <form className="relative z-10 space-y-6" onSubmit={(e) => void handleSetPassword(e)}>
                                <label className="block text-[15px] font-medium text-on-surface">
                                    新密碼
                                    <div className="relative mt-2">
                                        <span className="material-symbols-outlined absolute inset-y-0 left-0 flex items-center pl-3 text-outline">lock</span>
                                        <input type={showPass ? "text" : "password"} className={`${inputCls} pr-10`} placeholder="至少 8 個字元" required value={password} onChange={(e) => setPassword(e.target.value)} />
                                        <button type="button" className="absolute inset-y-0 right-0 flex items-center bg-transparent pr-3 text-outline hover:text-on-surface" onClick={() => setShowPass((show) => !show)}>
                                            <span className="material-symbols-outlined text-[20px]">{showPass ? "visibility" : "visibility_off"}</span>
                                        </button>
                                    </div>
                                </label>
                                <label className="block text-[15px] font-medium text-on-surface">
                                    確認新密碼
                                    <div className="relative mt-2">
                                        <span className="material-symbols-outlined absolute inset-y-0 left-0 flex items-center pl-3 text-outline">lock</span>
                                        <input type={showPass ? "text" : "password"} className={inputCls} placeholder="再次輸入密碼" required value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} />
                                    </div>
                                </label>
                                {error ? <div className="rounded-lg bg-error-container px-4 py-3 text-sm text-on-error-container">{error}</div> : null}
                                <button type="submit" disabled={isBusy} className="flex w-full items-center justify-center rounded-lg bg-primary-container px-4 py-3.5 text-[15px] font-bold text-on-primary-container transition-opacity hover:opacity-90 disabled:opacity-50">
                                    {isBusy ? "設定中..." : "設定新密碼"}
                                </button>
                            </form>
                        ) : null}

                        {step === "done" ? (
                            <div className="relative z-10 flex flex-col items-center gap-6 py-4">
                                <span className="material-symbols-outlined text-6xl text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                <p className="text-center text-sm text-on-surface-variant">密碼已完成更新。</p>
                                <button type="button" onClick={() => navigate("/login")} className="flex w-full items-center justify-center rounded-lg bg-primary-container px-4 py-3.5 text-[15px] font-bold text-on-primary-container transition-opacity hover:opacity-90">
                                    前往登入
                                </button>
                            </div>
                        ) : null}

                        <p className="relative z-10 mt-8 text-center text-[15px] text-on-surface-variant">
                            <Link to="/login" className="font-medium text-tertiary underline decoration-tertiary underline-offset-4 transition-colors hover:text-on-surface">
                                返回登入
                            </Link>
                        </p>
                    </div>
                </div>
            </section>
        </main>
    );
}
