import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetPasswordRequestOTP, resetPasswordSetPassword } from "@/api/forgotPasswordApi";

type Step = "email" | "otp" | "password" | "done";

const inputCls =
    "block w-full pl-10 pr-3 py-3 border-0 bg-surface-container-low text-on-surface rounded-lg " +
    "focus:ring-2 focus:ring-primary-container focus:bg-surface-container-lowest transition-colors " +
    "sm:text-sm placeholder:text-outline outline-none";

const ForgotPasswordPage = () => {
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
            setCooldown((s) => {
                if (s <= 1) { clearInterval(id); return 0; }
                return s - 1;
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
            setError(err instanceof Error ? err.message : "發送失敗，請稍後再試");
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
            setError(err instanceof Error ? err.message : "發送失敗");
        } finally {
            setIsBusy(false);
        }
    };

    const handleVerifyOTP = (e: FormEvent) => {
        e.preventDefault();
        if (code.length !== 6) { setError("請輸入 6 位數驗證碼"); return; }
        setError("");
        setStep("password");
    };

    const handleSetPassword = async (e: FormEvent) => {
        e.preventDefault();
        if (password.length < 8) { setError("密碼至少需要 8 個字元"); return; }
        if (password !== passwordConfirm) { setError("兩次輸入的密碼不一致"); return; }
        setError("");
        setIsBusy(true);
        try {
            await resetPasswordSetPassword(email.trim().toLowerCase(), code, password);
            setStep("done");
        } catch (err) {
            setError(err instanceof Error ? err.message : "設定失敗，請稍後再試");
        } finally {
            setIsBusy(false);
        }
    };

    return (
        <main className="flex w-full min-h-screen">
            {/* Left panel */}
            <section className="hidden lg:flex w-[45%] relative bg-gradient-to-br from-primary-container to-primary-fixed-dim flex-col justify-between p-16 overflow-hidden">
                <div
                    className="absolute inset-0 opacity-10 pointer-events-none"
                    style={{ backgroundImage: "radial-gradient(circle at 20% 80%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }}
                />
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

            {/* Right panel */}
            <section className="w-full lg:w-[55%] flex items-center justify-center p-8 sm:p-12 md:p-24 bg-background relative">
                <div className="absolute top-8 left-8 lg:hidden">
                    <h1 className="text-2xl font-extrabold text-on-surface border-b-2 border-primary-container pb-0.5 inline-block">
                        去中心化房屋平台
                    </h1>
                </div>

                <div className="w-full max-w-md relative z-10">
                    <div className="mb-10 text-center lg:text-left">
                        <h2 className="text-[32px] font-headline font-bold text-on-surface tracking-tight mb-3">
                            {step === "done" ? "密碼設定完成" : "設定密碼"}
                        </h2>
                        <p className="text-on-surface-variant text-[15px] leading-[1.75]">
                            {step === "email" && "輸入您的 Email，我們將發送驗證碼供您設定密碼。"}
                            {step === "otp" && `驗證碼已發送至 ${email}，請在 10 分鐘內完成驗證。`}
                            {step === "password" && "請設定一組至少 8 個字元的登入密碼。"}
                            {step === "done" && "密碼已成功設定，現在可以使用身分證字號 + 錢包 + 密碼登入。"}
                        </p>
                    </div>

                    <div className="bg-surface-container-lowest rounded-xl p-8 sm:p-10 relative">
                        <div className="absolute inset-0 border border-outline-variant opacity-15 rounded-xl pointer-events-none" />

                        {/* Step: email */}
                        {step === "email" && (
                            <form className="space-y-6 relative z-10" onSubmit={(e) => void handleRequestOTP(e)}>
                                <div>
                                    <label className="block text-[15px] font-medium text-on-surface mb-2">Email</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <span className="material-symbols-outlined text-outline">mail</span>
                                        </div>
                                        <input
                                            type="email"
                                            className={inputCls}
                                            placeholder="輸入您的 Email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                        />
                                    </div>
                                </div>
                                {error && <div className="px-4 py-3 bg-error-container text-on-error-container rounded-lg text-sm">{error}</div>}
                                <button
                                    type="submit"
                                    disabled={isBusy}
                                    className="w-full flex justify-center items-center py-3.5 px-4 rounded-lg bg-primary-container text-on-surface font-bold text-[15px] hover:brightness-105 transition-all disabled:opacity-50"
                                >
                                    {isBusy ? "發送中…" : "發送驗證碼"}
                                </button>
                            </form>
                        )}

                        {/* Step: otp */}
                        {step === "otp" && (
                            <form className="space-y-6 relative z-10" onSubmit={(e) => void handleVerifyOTP(e)}>
                                <div>
                                    <label className="block text-[15px] font-medium text-on-surface mb-2">Email 驗證碼</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <span className="material-symbols-outlined text-outline">pin</span>
                                        </div>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={6}
                                            className={inputCls}
                                            placeholder="6 位數驗證碼"
                                            required
                                            value={code}
                                            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                        />
                                    </div>
                                </div>
                                {error && <div className="px-4 py-3 bg-error-container text-on-error-container rounded-lg text-sm">{error}</div>}
                                <button
                                    type="submit"
                                    disabled={isBusy}
                                    className="w-full flex justify-center items-center py-3.5 px-4 rounded-lg bg-primary-container text-on-surface font-bold text-[15px] hover:brightness-105 transition-all disabled:opacity-50"
                                >
                                    驗證
                                </button>
                                <button
                                    type="button"
                                    disabled={cooldown > 0 || isBusy}
                                    onClick={() => void handleResendOTP()}
                                    className="w-full text-sm text-on-surface-variant hover:text-on-surface transition-colors bg-transparent disabled:opacity-50"
                                >
                                    {cooldown > 0 ? `重新發送（${cooldown}s）` : "重新發送驗證碼"}
                                </button>
                            </form>
                        )}

                        {/* Step: password */}
                        {step === "password" && (
                            <form className="space-y-6 relative z-10" onSubmit={(e) => void handleSetPassword(e)}>
                                <div>
                                    <label className="block text-[15px] font-medium text-on-surface mb-2">新密碼</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <span className="material-symbols-outlined text-outline">lock</span>
                                        </div>
                                        <input
                                            type={showPass ? "text" : "password"}
                                            className={`${inputCls} pr-10`}
                                            placeholder="至少 8 個字元"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-outline hover:text-on-surface transition-colors bg-transparent"
                                            onClick={() => setShowPass((s) => !s)}
                                        >
                                            <span className="material-symbols-outlined text-[20px]">{showPass ? "visibility" : "visibility_off"}</span>
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[15px] font-medium text-on-surface mb-2">確認新密碼</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <span className="material-symbols-outlined text-outline">lock</span>
                                        </div>
                                        <input
                                            type={showPass ? "text" : "password"}
                                            className={inputCls}
                                            placeholder="再次輸入密碼"
                                            required
                                            value={passwordConfirm}
                                            onChange={(e) => setPasswordConfirm(e.target.value)}
                                        />
                                    </div>
                                </div>
                                {error && <div className="px-4 py-3 bg-error-container text-on-error-container rounded-lg text-sm">{error}</div>}
                                <button
                                    type="submit"
                                    disabled={isBusy}
                                    className="w-full flex justify-center items-center py-3.5 px-4 rounded-lg bg-primary-container text-on-surface font-bold text-[15px] hover:brightness-105 transition-all disabled:opacity-50"
                                >
                                    {isBusy ? "設定中…" : "設定密碼"}
                                </button>
                            </form>
                        )}

                        {/* Step: done */}
                        {step === "done" && (
                            <div className="relative z-10 flex flex-col items-center gap-6 py-4">
                                <span className="material-symbols-outlined text-tertiary text-6xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                <p className="text-on-surface-variant text-sm text-center">密碼已設定完成，請返回登入頁面使用新密碼登入。</p>
                                <button
                                    type="button"
                                    onClick={() => navigate("/login")}
                                    className="w-full flex justify-center items-center py-3.5 px-4 rounded-lg bg-primary-container text-on-surface font-bold text-[15px] hover:brightness-105 transition-all"
                                >
                                    前往登入
                                </button>
                            </div>
                        )}

                        <p className="mt-8 text-center text-[15px] text-on-surface-variant relative z-10">
                            <Link to="/login" className="font-medium text-tertiary hover:text-on-surface transition-colors underline decoration-tertiary underline-offset-4">
                                返回登入
                            </Link>
                        </p>
                    </div>
                </div>
            </section>
        </main>
    );
};

export default ForgotPasswordPage;
