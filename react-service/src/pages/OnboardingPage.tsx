import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { logout, setPassword } from "@/api/authApi";
import {
    bindWallet,
    confirmKYCData,
    EmailAlreadyUsedError,
    EmailNotActivatedError,
    IdentityAlreadyUsedError,
    PhoneAlreadyUsedError,
    requestEmailOTP,
    requestPhoneOTP,
    requestWalletMessage,
    restartOnboardingSession,
    uploadKYCDocuments,
    verifyEmailOTP,
    verifyPhoneOTP,
    WalletAlreadyBoundError,
    type OnboardingStep,
    type RequestEmailOTPResponse,
} from "@/api/onboardingApi";
import { signSIWEMessage, toChecksumAddress } from "@/api/walletApi";
import LoadingOverlay from "../components/common/LoadingOverlay";

type WizardStep =
    | "email"
    | "phone"
    | "id-card"
    | "confirm"
    | "second-doc"
    | "selfie"
    | "wallet"
    | "done";

function backendStepToWizardStep(s: OnboardingStep): WizardStep {
    switch (s) {
        case "STARTED":
        case "EMAIL_VERIFIED": return "phone";
        case "PHONE_VERIFIED": return "id-card";
        case "OCR_DONE":       return "confirm";
        case "CONFIRMED":      return "second-doc";
        case "WALLET_BOUND":   return "done";
    }
}

type FileState = {
    idFront: File | null;
    idBack: File | null;
    secondDoc: File | null;
    selfie: File | null;
};

type PreviewState = Record<keyof FileState, string>;

const SEPOLIA_CHAIN_ID = "0xaa36a7";

const progressStepsConfig = [
    { key: "email",      label: "Email 驗證" },
    { key: "phone",      label: "手機驗證" },
    { key: "id-card",    label: "身分證上傳" },
    { key: "confirm",    label: "資料確認" },
    { key: "second-doc", label: "第二證件" },
    { key: "selfie",     label: "本人自拍" },
    { key: "wallet",     label: "綁定錢包" },
    { key: "done",       label: "完成" },
] as const;

const stepLabels: Record<WizardStep, string> = {
    email:        "Email 驗證",
    phone:        "手機驗證",
    "id-card":    "身分證上傳",
    confirm:      "資料確認",
    "second-doc": "第二證件",
    selfie:       "本人自拍",
    wallet:       "綁定錢包",
    done:         "完成",
};

const initialFiles: FileState = { idFront: null, idBack: null, secondDoc: null, selfie: null };
const initialPreviews: PreviewState = { idFront: "", idBack: "", secondDoc: "", selfie: "" };

const inputCls =
    "block w-full px-4 py-3 bg-surface-container-low text-on-surface rounded-lg border-0 " +
    "focus:ring-2 focus:ring-primary-container transition-colors text-sm outline-none placeholder:text-outline";

// ── Upload field ───────────────────────────────────────────────────────────────

function UploadZone({
    label, preview, hint, onChange, required = false,
}: {
    label: string; preview: string; hint: string;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void; required?: boolean;
}) {
    return (
        <div>
            <p className="text-sm font-bold text-on-surface mb-3">{label}</p>
            <label className="w-full h-52 border-2 border-dashed border-outline-variant rounded-xl bg-surface-container-low/50 hover:bg-surface-container transition-colors duration-300 cursor-pointer group flex flex-col items-center justify-center px-6 text-center relative overflow-hidden">
                {preview ? (
                    <img src={preview} alt={label} className="absolute inset-0 w-full h-full object-cover rounded-[10px]" />
                ) : (
                    <div className="w-16 h-16 rounded-full bg-surface-container-lowest shadow-[0_4px_16px_rgba(28,25,23,0.06)] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300">
                        <span
                            className="material-symbols-outlined text-[32px] text-primary"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                            id_card
                        </span>
                    </div>
                )}
                {!preview && (
                    <>
                        <span className="text-lg font-bold text-on-surface mb-2">點擊上傳或拖曳檔案至此處</span>
                        <span className="text-sm text-on-surface-variant">{hint}</span>
                    </>
                )}
                <input aria-label={label} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" type="file" accept="image/*" onChange={onChange} required={required} />
            </label>
        </div>
    );
}

// ── Progress Dots ──────────────────────────────────────────────────────────────

function ProgressDots({ currentStep }: { currentStep: WizardStep }) {
    const currentIndex = progressStepsConfig.findIndex((s) => s.key === currentStep);
    const progressPercent = currentIndex > 0 ? (currentIndex / (progressStepsConfig.length - 1)) * 100 : 0;

    return (
        <div className="w-full max-w-[520px] mb-12 flex justify-between items-center relative">
            {/* Background line */}
            <div className="absolute top-1/2 left-0 w-full h-[2px] bg-surface-variant -translate-y-1/2 z-0" />
            {/* Active progress line */}
            <div
                className="absolute top-1/2 left-0 h-[2px] bg-tertiary-container -translate-y-1/2 z-0 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
            />
            {progressStepsConfig.map((step, index) => {
                const isCompleted = currentIndex > index;
                const isActive    = step.key === currentStep;
                return (
                    <div
                        key={step.key}
                        title={step.label}
                        className={`w-8 h-8 rounded-full flex items-center justify-center relative z-10 ring-4 ring-background transition-all duration-300 ${
                            isCompleted
                                ? "bg-tertiary-container text-on-tertiary-container"
                                : isActive
                                ? "bg-primary-container text-on-primary-container shadow-[0_0_16px_rgba(232,184,0,0.3)]"
                                : "bg-surface-variant text-on-surface-variant"
                        }`}
                    >
                        {isCompleted ? (
                            <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                        ) : (
                            <span className="text-sm font-bold">{index + 1}</span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ── Card wrapper ───────────────────────────────────────────────────────────────

function StepCard({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
    return (
        <div className="w-full max-w-[520px] bg-surface-container-lowest rounded-xl p-8 md:p-12 shadow-[0_8px_32px_rgba(28,25,23,0.04)] relative overflow-hidden">
            {/* decorative blur */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary-fixed rounded-full blur-[80px] opacity-20 pointer-events-none" />
            <h2 className="text-[32px] font-headline font-bold text-on-surface tracking-tight leading-tight mb-3">{title}</h2>
            {desc && <p className="text-[15px] text-on-surface-variant leading-[1.75] mb-8 font-body">{desc}</p>}
            {children}
        </div>
    );
}

// ── Nav buttons ────────────────────────────────────────────────────────────────

function NavRow({ onBack, onNext, nextLabel = "繼續", nextDisabled = false, showBack = true, showNext = true }: {
    onBack?: () => void; onNext?: () => void; nextLabel?: string; nextDisabled?: boolean; showBack?: boolean; showNext?: boolean;
}) {
    return (
        <div className="mt-12 flex justify-between items-center pt-6 border-t border-surface-variant/50">
            {showBack && onBack ? (
                <button
                    type="button"
                    onClick={onBack}
                    className="px-6 py-3 rounded-xl border border-outline-variant text-on-surface bg-surface-container-lowest hover:bg-surface-container-low transition-colors duration-200 font-bold text-[15px] flex items-center gap-2"
                >
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    上一步
                </button>
            ) : <div />}
            {showNext && (
                <button
                    type="submit"
                    onClick={onNext}
                    disabled={nextDisabled}
                    className="px-8 py-3 rounded-xl bg-primary-container text-on-surface font-bold text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] hover:brightness-105 transition-all duration-200 flex items-center gap-2 disabled:opacity-50"
                >
                    {nextLabel}
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
            )}
        </div>
    );
}

// ── Security badge ─────────────────────────────────────────────────────────────

function SecurityBadge() {
    return (
        <div className="mt-8 flex items-center justify-center gap-2 bg-surface-container-low rounded-lg py-3 px-4 w-fit mx-auto border border-outline-variant/30">
            <span className="material-symbols-outlined text-[18px] text-tertiary-container" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
            <span className="text-sm text-on-surface-variant font-medium">端到端加密保護，符合台灣個資法規範</span>
        </div>
    );
}

// ── Main component ─────────────────────────────────────────────────────────────

const OnboardingPage = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState<WizardStep>("email");
    const [sessionId, setSessionId] = useState("");
    const [email, setEmail] = useState("");
    const [emailCode, setEmailCode] = useState("");
    const [phone, setPhone] = useState("");
    const [phoneCode, setPhoneCode] = useState("");
    const [fullName, setFullName] = useState("");
    const [birthDate, setBirthDate] = useState("");
    const [address, setAddress] = useState("");
    const [idNumber, setIdNumber] = useState("");
    const [idNumberHint, setIdNumberHint] = useState("");
    const [gender, setGender] = useState("");
    const [issueDate, setIssueDate] = useState("");
    const [issueLocation, setIssueLocation] = useState("");
    const [fatherName, setFatherName] = useState("");
    const [motherName, setMotherName] = useState("");
    const [walletAddress, setWalletAddress] = useState("");
    const [statusMessage, setStatusMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [emailSessionInfo, setEmailSessionInfo] = useState<RequestEmailOTPResponse | null>(null);
    const [isBusy, setIsBusy] = useState(false);
    const [busyMessage, setBusyMessage] = useState("");
    const [walletAlreadyBound, setWalletAlreadyBound] = useState<{ idHint: string } | null>(null);
    const [emailConflict, setEmailConflict] = useState<{ idHint: string } | null>(null);
    const [phoneConflict, setPhoneConflict] = useState<{ idHint: string } | null>(null);
    const [identityConflict, setIdentityConflict] = useState<{ idHint: string } | null>(null);
    const [newPassword, setNewPassword] = useState("");
    const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
    const [passwordSaved, setPasswordSaved] = useState(false);
    const [passwordError, setPasswordError] = useState("");
    const [files, setFiles] = useState<FileState>(initialFiles);
    const [previews, setPreviews] = useState<PreviewState>(initialPreviews);
    const [showOTPInput, setShowOTPInput] = useState(false);
    const [confirmEditing, setConfirmEditing] = useState(false);
    const [confirmManuallyEdited, setConfirmManuallyEdited] = useState(false);
    const [showPhoneOTPInput, setShowPhoneOTPInput] = useState(false);

    useEffect(() => {
        const provider = window.ethereum;
        const handleAccountsChanged = (accounts: unknown) => {
            const list = accounts as string[];
            if (!list || list.length === 0 || list[0].toLowerCase() !== walletAddress.toLowerCase()) {
                setWalletAddress("");
            }
        };
        provider?.on?.("accountsChanged", handleAccountsChanged);
        return () => { provider?.removeListener?.("accountsChanged", handleAccountsChanged); };
    }, [walletAddress]);

    useEffect(() => {
        return () => {
            Object.values(previews).forEach((value) => {
                if (value) URL.revokeObjectURL(value);
            });
        };
    }, [previews]);

    const stepRef = useRef(step);
    stepRef.current = step;
    const passwordSavedRef = useRef(passwordSaved);
    passwordSavedRef.current = passwordSaved;
    useEffect(() => {
        return () => {
            if (stepRef.current === "done" && !passwordSavedRef.current) {
                void logout().catch(() => {});
            }
        };
    }, []);

    const setPreviewFile = (field: keyof FileState, nextFile: File | null) => {
        setFiles((current) => ({ ...current, [field]: nextFile }));
        setPreviews((current) => {
            if (current[field]) URL.revokeObjectURL(current[field]);
            return { ...current, [field]: nextFile ? URL.createObjectURL(nextFile) : "" };
        });
    };

    const handleFile = (field: keyof FileState) => (event: ChangeEvent<HTMLInputElement>) => {
        setPreviewFile(field, event.target.files?.[0] ?? null);
    };

    const withBusy = async (work: () => Promise<void>, message = "處理中，請稍候...") => {
        try {
            setIsBusy(true); setBusyMessage(message); setErrorMessage("");
            await work();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "流程執行失敗，請稍後再試。");
        } finally {
            setIsBusy(false); setBusyMessage("");
        }
    };

    const resolveAlreadyBoundSession = (message: string) => {
        const n = message.toLowerCase();
        return n.includes("已完成綁定") || n.includes("already bound");
    };

    // ── Email step ─────────────────────────────────────────────────────────────

    const submitEmailOTP = async (event: FormEvent) => {
        event.preventDefault();
        await withBusy(async () => {
            const result = await requestEmailOTP(email.trim().toLowerCase());
            setEmailSessionInfo(result);
            setShowOTPInput(true);
            setStatusMessage("Email 驗證碼已送出，請查看信箱。");
        }, "發送驗證碼中...");
    };

    const verifyEmailAndProceed = async (restart: boolean) => {
        await withBusy(async () => {
            let result;
            try {
                result = await verifyEmailOTP(email.trim().toLowerCase(), emailCode.trim());
            } catch (err) {
                if (err instanceof EmailNotActivatedError) { navigate(`/forgot-password?email=${encodeURIComponent(err.email)}`); return; }
                if (err instanceof EmailAlreadyUsedError) { setEmailConflict({ idHint: err.idHint }); return; }
                throw err;
            }
            if (result.is_resume && restart) {
                const newSess = await restartOnboardingSession(result.session_id);
                setEmailSessionInfo(null); setSessionId(newSess.session_id);
                setStep("phone"); setStatusMessage("已重新開始 KYC 流程，請繼續完成手機驗證。");
            } else if (result.is_resume) {
                const targetStep = (result.resume_wizard_step as WizardStep) || backendStepToWizardStep(result.step);
                // Always pre-fill ALL OCR state so navigating back to confirm shows data
                setIdNumber(result.id_number ?? "");
                setIdNumberHint(result.id_number_hint ?? "");
                setFullName((result.ocr_name ?? "").replace(/\s+/g, ""));
                setGender(result.ocr_gender ?? "");
                setBirthDate(result.ocr_birth_date ?? "");
                setIssueDate(result.ocr_issue_date ?? "");
                setIssueLocation(result.ocr_issue_location ?? "");
                setAddress(result.ocr_address ?? "");
                setFatherName(result.ocr_father_name ?? "");
                setMotherName(result.ocr_mother_name ?? "");
                setEmailSessionInfo(null); setSessionId(result.session_id);
                setStep(targetStep); setStatusMessage("已接續上次 KYC 進度，請繼續完成流程。");
            } else {
                setEmailSessionInfo(null); setSessionId(result.session_id);
                setStep("phone"); setStatusMessage("Email 驗證完成，繼續完成手機驗證。");
            }
        });
    };

    // ── Phone step ─────────────────────────────────────────────────────────────

    const submitPhoneOTP = async (event: FormEvent) => {
        event.preventDefault();
        await withBusy(async () => {
            try {
                await requestPhoneOTP(sessionId, phone.trim());
            } catch (err) {
                if (err instanceof PhoneAlreadyUsedError) { setPhoneConflict({ idHint: err.idHint }); return; }
                throw err;
            }
            setShowPhoneOTPInput(true);
            setStatusMessage("手機驗證碼已送出。");
        }, "發送簡訊中...");
    };

    const verifyPhone = async (event: FormEvent) => {
        event.preventDefault();
        await withBusy(async () => {
            await verifyPhoneOTP(sessionId, phone.trim(), phoneCode.trim());
            setStep("id-card"); setStatusMessage("手機驗證完成，請上傳身分證正反面。");
        }, "驗證中...");
    };

    // ── ID Card step ───────────────────────────────────────────────────────────

    const submitIdCards = async (event: FormEvent) => {
        event.preventDefault();
        if (!files.idFront || !files.idBack) { setErrorMessage("請先上傳身分證正面與背面。"); return; }
        await withBusy(async () => {
            const result = await uploadKYCDocuments(sessionId, "id_card", { idFront: files.idFront, idBack: files.idBack });
            setFullName((result.ocr_name || "").replace(/\s+/g, ""));
            setBirthDate(result.ocr_birth_date || "");
            setAddress(result.ocr_address || "");
            setIdNumber(result.id_number || "");
            setIdNumberHint(result.id_number_hint || "");
            setGender(result.ocr_gender || "");
            setIssueDate(result.ocr_issue_date || "");
            setIssueLocation(result.ocr_issue_location || "");
            setFatherName(result.ocr_father_name || "");
            setMotherName(result.ocr_mother_name || "");
            setStep("confirm");
            setStatusMessage(result.ocr_success ? "身分證分析完成，請確認回填資料。" : "身分證已上傳，請手動確認資料。");
        }, "上傳並分析身分證中，請稍候...");
    };

    // ── Confirm step ───────────────────────────────────────────────────────────

    const submitConfirm = async (event: FormEvent) => {
        event.preventDefault();
        if (!fullName.trim() || !birthDate.trim()) { setErrorMessage("姓名與出生日期必須填寫。"); return; }
        await withBusy(async () => {
            await confirmKYCData(sessionId, fullName.trim(), birthDate.trim());
            setStep("second-doc"); setStatusMessage("基本資料已確認，請上傳第二證件備查。");
        }, "儲存資料中...");
    };

    // ── Second doc step ────────────────────────────────────────────────────────

    const submitSecondDoc = async (event: FormEvent) => {
        event.preventDefault();
        if (!files.secondDoc) { setErrorMessage("請上傳第二證件。"); return; }
        await withBusy(async () => {
            await uploadKYCDocuments(sessionId, "second_doc", { secondDoc: files.secondDoc });
            setStep("selfie"); setStatusMessage("第二證件已上傳，最後請上傳本人自拍照。");
        }, "上傳第二證件中...");
    };

    // ── Selfie step ────────────────────────────────────────────────────────────

    const submitSelfie = async (event: FormEvent) => {
        event.preventDefault();
        if (!files.selfie) { setErrorMessage("請確認自拍已上傳。"); return; }
        await withBusy(async () => {
            const result = await uploadKYCDocuments(sessionId, "selfie", { selfie: files.selfie! });
            setStep("wallet");
            setStatusMessage(`本人自拍已完成，臉部比對分數 ${result.face_match_score.toFixed(2)}，請綁定唯一錢包。`);
        }, "上傳自拍並進行臉部比對，請稍候...");
    };

    // ── Wallet step ────────────────────────────────────────────────────────────

    const connectWallet = async () => {
        const provider = window.ethereum;
        if (!provider) throw new Error("請先安裝 MetaMask。");
        const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
        const currentChainId = (await provider.request({ method: "eth_chainId" })) as string;
        if (currentChainId.toLowerCase() !== SEPOLIA_CHAIN_ID) {
            await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: SEPOLIA_CHAIN_ID }] });
        }
        const nextAddress = accounts[0];
        if (!nextAddress) throw new Error("MetaMask 沒有回傳可用帳號。");
        setWalletAddress(toChecksumAddress(nextAddress));
    };

    const submitWalletBind = async () => {
        setIsBusy(true); setBusyMessage("準備 SIWE 訊息中..."); setErrorMessage("");
        try {
            if (!walletAddress) throw new Error("請先連接 MetaMask。");
            const { message } = await requestWalletMessage(sessionId, walletAddress);
            setBusyMessage("等待 MetaMask 簽名，請在錢包視窗確認...");
            const signature = await signSIWEMessage(message, walletAddress);
            setBusyMessage("驗證簽名並建立鏈上憑證，請稍候...");
            const result = await bindWallet(sessionId, walletAddress, message, signature);
            setStatusMessage(result.message); setStep("done");
            window.dispatchEvent(new CustomEvent("wallet-auth-changed"));
        } catch (error) {
            if (error instanceof WalletAlreadyBoundError) { setWalletAlreadyBound({ idHint: error.idHint }); return; }
            if (error instanceof IdentityAlreadyUsedError) { setIdentityConflict({ idHint: error.idHint }); return; }
            const message = error instanceof Error ? error.message : "流程執行失敗，請稍後再試。";
            if (resolveAlreadyBoundSession(message)) {
                setStatusMessage("這個 KYC session 已完成錢包綁定，請直接設定登入密碼。");
                setStep("done"); return;
            }
            setErrorMessage(message);
        } finally {
            setIsBusy(false); setBusyMessage("");
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <div className="bg-background text-on-surface min-h-screen flex flex-col font-body antialiased">
            <LoadingOverlay isVisible={isBusy} message={busyMessage || "處理中，請稍候..."} />

            {/* Minimal header */}
            <div className="w-full h-[80px] flex items-center px-6 md:px-12 max-w-[1440px] mx-auto z-50">
                <a href="/" className="flex items-center gap-2">
                    <span className="text-xl font-extrabold text-on-surface border-b-2 border-primary-container pb-0.5 tracking-tight">
                        去中心化房屋平台
                    </span>
                </a>
                <div className="ml-auto">
                    <button
                        type="button"
                        className="text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1 text-sm font-medium bg-transparent"
                        onClick={() => navigate("/")}
                    >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                        儲存並離開
                    </button>
                </div>
            </div>

            <main className="flex-grow flex flex-col items-center justify-center py-12 px-4 md:px-8 relative z-10">
                <ProgressDots currentStep={step} />

                {/* Status / Error banners */}
                {statusMessage && (
                    <div className="w-full max-w-[520px] mb-6 px-4 py-3 bg-tertiary/10 border border-tertiary/20 rounded-xl text-tertiary text-sm font-medium">
                        {statusMessage}
                    </div>
                )}
                {errorMessage && (
                    <div className="w-full max-w-[520px] mb-6 px-4 py-3 bg-error-container text-on-error-container rounded-xl text-sm">
                        {errorMessage}
                    </div>
                )}

                {/* ── Email step ── */}
                {step === "email" && emailConflict && (
                    <StepCard title="Email 已被使用">
                        <p className="text-[15px] text-on-surface-variant leading-[1.75] mb-8">
                            此 Email 已綁定另一位會員{emailConflict.idHint ? `（身分證隱碼：${emailConflict.idHint}）` : ""}。
                            若此為本人操作，請聯絡客服協助處理。
                        </p>
                        <button
                            type="button"
                            className="px-6 py-3 rounded-xl border border-outline-variant text-on-surface bg-surface-container-lowest hover:bg-surface-container-low transition-colors font-bold text-[15px]"
                            onClick={() => { setEmailConflict(null); setEmail(""); setEmailCode(""); setEmailSessionInfo(null); setShowOTPInput(false); }}
                        >
                            換一個 Email
                        </button>
                    </StepCard>
                )}

                {step === "email" && !emailConflict && (
                    <form className="w-full max-w-[520px]" onSubmit={
                        showOTPInput && emailSessionInfo?.has_active_session
                            ? (e) => { e.preventDefault(); }
                            : showOTPInput
                            ? (e) => { e.preventDefault(); void verifyEmailAndProceed(false); }
                            : submitEmailOTP
                    }>
                        <StepCard
                            title={showOTPInput ? (emailSessionInfo?.has_active_session ? "發現未完成的進度" : "確認 Email 驗證碼") : stepLabels.email}
                            desc={
                                showOTPInput
                                    ? emailSessionInfo?.has_active_session
                                        ? `你的 KYC 流程停在「${stepLabels[backendStepToWizardStep(emailSessionInfo.active_step!)]}」步驟。輸入驗證碼後選擇接續或重新開始。`
                                        : "輸入 Email 驗證碼後，才會進入手機驗證。"
                                    : "輸入信箱後送出驗證碼，系統會同時確認是否有未完成進度。"
                            }
                        >
                            {!showOTPInput && (
                                <input
                                    className={inputCls}
                                    type="email"
                                    placeholder="your@email.com"
                                    value={email}
                                    onChange={(e) => { setEmail(e.target.value); setEmailSessionInfo(null); setShowOTPInput(false); }}
                                    required
                                />
                            )}
                            {showOTPInput && (
                                <input
                                    className={`${inputCls} tracking-widest font-mono text-center text-lg`}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    placeholder="6 位驗證碼"
                                    value={emailCode}
                                    onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ""))}
                                    autoFocus
                                    required
                                />
                            )}
                            <SecurityBadge />
                            <div className="mt-12 flex justify-between items-center pt-6 border-t border-surface-variant/50">
                                {showOTPInput ? (
                                    <button
                                        type="button"
                                        className="px-6 py-3 rounded-xl border border-outline-variant text-on-surface bg-surface-container-lowest hover:bg-surface-container-low transition-colors font-bold text-[15px] flex items-center gap-2"
                                        onClick={() => { setShowOTPInput(false); setEmailCode(""); setEmailSessionInfo(null); }}
                                    >
                                        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                                        上一步
                                    </button>
                                ) : <div />}
                                <div className="flex gap-3">
                                    {showOTPInput && emailSessionInfo?.has_active_session && (
                                        <button
                                            type="button"
                                            onClick={() => void verifyEmailAndProceed(true)}
                                            disabled={isBusy || !emailCode}
                                            className="px-6 py-3 rounded-xl border border-outline-variant text-on-surface bg-surface-container-lowest hover:bg-surface-container-low transition-colors font-bold text-[15px] disabled:opacity-50"
                                        >
                                            重新開始
                                        </button>
                                    )}
                                    <button
                                        type={showOTPInput && emailSessionInfo?.has_active_session ? "button" : "submit"}
                                        onClick={showOTPInput && emailSessionInfo?.has_active_session ? () => void verifyEmailAndProceed(false) : undefined}
                                        disabled={isBusy || (showOTPInput && !emailCode) || (!showOTPInput && !email)}
                                        className="px-8 py-3 rounded-xl bg-primary-container text-on-surface font-bold text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] hover:brightness-105 transition-all flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {showOTPInput ? (emailSessionInfo?.has_active_session ? "接續上次進度" : "驗證 Email") : "送出驗證碼"}
                                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                    </button>
                                </div>
                            </div>
                        </StepCard>
                    </form>
                )}

                {/* ── Phone step ── */}
                {step === "phone" && phoneConflict && (
                    <StepCard title="手機號碼已被使用">
                        <p className="text-[15px] text-on-surface-variant leading-[1.75] mb-8">
                            此手機號碼已綁定另一位會員{phoneConflict.idHint ? `（身分證隱碼：${phoneConflict.idHint}）` : ""}。
                        </p>
                        <button
                            type="button"
                            className="px-6 py-3 rounded-xl border border-outline-variant text-on-surface bg-surface-container-lowest hover:bg-surface-container-low transition-colors font-bold text-[15px]"
                            onClick={() => { setPhoneConflict(null); setPhone(""); setPhoneCode(""); setShowPhoneOTPInput(false); }}
                        >
                            換一個手機號碼
                        </button>
                    </StepCard>
                )}

                {step === "phone" && !phoneConflict && (
                    <form className="w-full max-w-[520px]" onSubmit={showPhoneOTPInput ? verifyPhone : submitPhoneOTP}>
                        <StepCard
                            title={showPhoneOTPInput ? "確認手機驗證碼" : stepLabels.phone}
                            desc={showPhoneOTPInput ? "請輸入收到的 6 位驗證碼。" : "完成手機驗證後，才開放證件上傳流程。"}
                        >
                            {!showPhoneOTPInput ? (
                                <input
                                    className={inputCls}
                                    type="tel"
                                    placeholder="09xxxxxxxx"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    required
                                />
                            ) : (
                                <input
                                    className={`${inputCls} tracking-widest font-mono text-center text-lg`}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    placeholder="6 位驗證碼"
                                    value={phoneCode}
                                    onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, ""))}
                                    autoFocus
                                    required
                                />
                            )}
                            <SecurityBadge />
                            <div className="mt-12 flex justify-between items-center pt-6 border-t border-surface-variant/50">
                                {showPhoneOTPInput ? (
                                    <button
                                        type="button"
                                        className="px-6 py-3 rounded-xl border border-outline-variant text-on-surface bg-surface-container-lowest hover:bg-surface-container-low transition-colors font-bold text-[15px] flex items-center gap-2"
                                        onClick={() => { setShowPhoneOTPInput(false); setPhoneCode(""); }}
                                    >
                                        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                                        上一步
                                    </button>
                                ) : <div />}
                                <button
                                    type="submit"
                                    disabled={isBusy || (showPhoneOTPInput ? !phoneCode : !phone)}
                                    className="px-8 py-3 rounded-xl bg-primary-container text-on-surface font-bold text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] hover:brightness-105 transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {showPhoneOTPInput ? "驗證手機" : "送出驗證碼"}
                                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                </button>
                            </div>
                        </StepCard>
                    </form>
                )}

                {/* ── ID Card step ── */}
                {step === "id-card" && (
                    <form className="w-full max-w-[520px]" onSubmit={submitIdCards}>
                        <StepCard title={stepLabels["id-card"]} desc="為了確保平台交易的安全性，我們需要核實您的身份。資料將進行加密處理，僅用於審核用途。">
                            <div className="flex flex-col gap-6">
                                <UploadZone
                                    label="身分證正面"
                                    preview={previews.idFront}
                                    hint="支援 JPG, PNG，最大 10MB。請確認四角完整、反光不要太強。"
                                    onChange={handleFile("idFront")}
                                    required
                                />
                                <UploadZone
                                    label="身分證背面"
                                    preview={previews.idBack}
                                    hint="支援 JPG, PNG，最大 10MB。請確認住址與備註欄清楚可見。"
                                    onChange={handleFile("idBack")}
                                    required
                                />
                            </div>
                            <SecurityBadge />
                            <NavRow nextLabel="下一步：資訊確認" nextDisabled={isBusy} showBack={false} />
                        </StepCard>
                    </form>
                )}

                {/* ── Confirm step ── */}
                {step === "confirm" && (
                    <form className="w-full max-w-[520px]" onSubmit={submitConfirm}>
                        <StepCard title={stepLabels.confirm} desc="請確認以下由身分證讀取的基本資料是否正確。">
                            {/* Edit toggle header */}
                            <div className="flex items-center justify-between mb-4">
                                {confirmManuallyEdited ? (
                                    <span className="flex items-center gap-1.5 text-xs font-bold text-error bg-error-container px-3 py-1 rounded-full">
                                        <span className="material-symbols-outlined text-[14px]">edit</span>
                                        已手動修改
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1.5 text-xs font-bold text-tertiary bg-tertiary/10 px-3 py-1 rounded-full">
                                        <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                                        OCR 自動識別
                                    </span>
                                )}
                                {!confirmEditing && (
                                    <button
                                        type="button"
                                        className="flex items-center gap-1 text-sm font-bold text-primary-container bg-transparent hover:opacity-70 transition-opacity"
                                        onClick={() => setConfirmEditing(true)}
                                    >
                                        <span className="material-symbols-outlined text-[16px]">edit</span>
                                        修改資料
                                    </button>
                                )}
                                {confirmEditing && (
                                    <button
                                        type="button"
                                        className="flex items-center gap-1 text-sm font-medium text-on-surface-variant bg-transparent hover:opacity-70 transition-opacity"
                                        onClick={() => setConfirmEditing(false)}
                                    >
                                        <span className="material-symbols-outlined text-[16px]">lock</span>
                                        鎖定
                                    </button>
                                )}
                            </div>

                            {/* Fields */}
                            <div className="flex flex-col gap-4">
                                {[
                                    { label: "身分證字號", value: idNumber || idNumberHint, setter: setIdNumber, placeholder: "A123456789" },
                                    { label: "姓名",       value: fullName,      setter: setFullName,      placeholder: "王小明" },
                                    { label: "性別",       value: gender,        setter: setGender,        placeholder: "男 / 女" },
                                    { label: "出生日期",   value: birthDate,     setter: setBirthDate,     placeholder: "77/8/16" },
                                    { label: "發證日期",   value: issueDate,     setter: setIssueDate,     placeholder: "103/1/16" },
                                    { label: "發證地",     value: issueLocation, setter: setIssueLocation, placeholder: "臺北市" },
                                    { label: "戶籍地址",   value: address,       setter: setAddress,       placeholder: "可先人工輸入" },
                                    { label: "父親姓名",   value: fatherName,    setter: setFatherName,    placeholder: "可先人工輸入" },
                                    { label: "母親姓名",   value: motherName,    setter: setMotherName,    placeholder: "可先人工輸入" },
                                ].map(({ label, value, setter, placeholder }) => (
                                    <div key={label} className="flex flex-col gap-1">
                                        <label className="text-sm font-bold text-on-surface">{label}</label>
                                        {confirmEditing ? (
                                            <input
                                                className={inputCls}
                                                value={value}
                                                placeholder={placeholder}
                                                onChange={(e) => { setter(e.target.value); setConfirmManuallyEdited(true); }}
                                            />
                                        ) : (
                                            <p className={`${inputCls} text-on-surface-variant select-all cursor-default`}>
                                                {value || <em className="not-italic text-outline">{placeholder}</em>}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <NavRow
                                onBack={() => {
                                    setPreviewFile("idFront", null);
                                    setPreviewFile("idBack", null);
                                    setConfirmEditing(false);
                                    setConfirmManuallyEdited(false);
                                    setStep("id-card");
                                }}
                                nextLabel="下一步：第二證件"
                                nextDisabled={isBusy}
                            />
                        </StepCard>
                    </form>
                )}

                {/* ── Second doc step ── */}
                {step === "second-doc" && (
                    <form className="w-full max-w-[520px]" onSubmit={submitSecondDoc}>
                        <StepCard title={stepLabels["second-doc"]} desc="請上傳第二證件（例如健保卡、駕照）作為備查。">
                            <UploadZone
                                label="第二證件"
                                preview={previews.secondDoc}
                                hint="支援 JPG, PNG，最大 10MB。"
                                onChange={handleFile("secondDoc")}
                                required
                            />
                            <SecurityBadge />
                            <NavRow
                                onBack={() => {
                                    setPreviewFile("secondDoc", null);
                                    setStep("confirm");
                                }}
                                nextLabel="下一步：本人自拍"
                                nextDisabled={isBusy}
                            />
                        </StepCard>
                    </form>
                )}

                {/* ── Selfie step ── */}
                {step === "selfie" && (
                    <form className="w-full max-w-[520px]" onSubmit={submitSelfie}>
                        <StepCard title={stepLabels.selfie} desc="最後請上傳本人自拍照，用於確認您與身分證上的照片相符。">
                            <UploadZone
                                label="本人自拍"
                                preview={previews.selfie}
                                hint="支援 JPG, PNG，最大 10MB。請正面、清晰、避免墨鏡與過暗光線。"
                                onChange={handleFile("selfie")}
                                required
                            />
                            <SecurityBadge />
                            <NavRow
                                onBack={() => {
                                    setPreviewFile("selfie", null);
                                    setStep("second-doc");
                                }}
                                nextLabel="送出分析"
                                nextDisabled={isBusy}
                            />
                        </StepCard>
                    </form>
                )}

                {/* ── Wallet step ── */}
                {step === "wallet" && identityConflict && (
                    <StepCard title="此身分字號已完成 KYC 綁定">
                        <p className="text-[15px] text-on-surface-variant leading-[1.75]">
                            若此為本人操作，請聯絡客服協助處理。
                        </p>
                    </StepCard>
                )}

                {step === "wallet" && !identityConflict && walletAlreadyBound && (
                    <StepCard title="此錢包已完成身份綁定">
                        <p className="text-[15px] text-on-surface-variant leading-[1.75] mb-8">
                            此錢包已綁定身份{walletAlreadyBound.idHint ? `（身分證隱碼：${walletAlreadyBound.idHint}）` : ""}。
                        </p>
                        <button
                            type="button"
                            className="px-6 py-3 rounded-xl border border-outline-variant text-on-surface bg-surface-container-lowest hover:bg-surface-container-low transition-colors font-bold text-[15px]"
                            onClick={() => { setWalletAlreadyBound(null); setWalletAddress(""); }}
                        >
                            換一個錢包
                        </button>
                    </StepCard>
                )}

                {step === "wallet" && !identityConflict && !walletAlreadyBound && (
                    <StepCard title={stepLabels.wallet} desc="請連接您的 MetaMask 錢包，完成唯一綁定。">
                        <div className="flex flex-col gap-4">
                            {walletAddress ? (
                                <div className="flex items-center gap-3 px-4 py-3 bg-tertiary/10 border border-tertiary/20 rounded-lg">
                                    <span className="material-symbols-outlined text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                    <span className="font-mono text-sm text-on-surface flex-1 break-all">{walletAddress}</span>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => void withBusy(connectWallet, "連接錢包中...")}
                                    disabled={isBusy}
                                    className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-lg bg-surface-container-lowest text-on-surface font-medium border border-outline-variant/30 hover:bg-surface-container-low transition-colors disabled:opacity-60"
                                >
                                    <span className="material-symbols-outlined">account_balance_wallet</span>
                                    連接 MetaMask
                                </button>
                            )}
                        </div>
                        <SecurityBadge />
                        <div className="mt-12 flex justify-between pt-6 border-t border-surface-variant/50">
                            <button
                                type="button"
                                onClick={() => {
                                    setFiles(initialFiles);
                                    setPreviews(initialPreviews);
                                    setIdNumber("");
                                    setIdNumberHint("");
                                    setFullName("");
                                    setGender("");
                                    setBirthDate("");
                                    setIssueDate("");
                                    setIssueLocation("");
                                    setAddress("");
                                    setFatherName("");
                                    setMotherName("");
                                    setConfirmEditing(false);
                                    setConfirmManuallyEdited(false);
                                    setStep("id-card");
                                }}
                                disabled={isBusy}
                                className="px-6 py-3 rounded-xl border border-outline-variant/40 bg-transparent text-on-surface-variant font-medium text-[15px] hover:bg-surface-container-low transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                <span className="material-symbols-outlined text-[18px]">upload_file</span>
                                重新身份上傳
                            </button>
                            <button
                                type="button"
                                onClick={() => void submitWalletBind()}
                                disabled={isBusy || !walletAddress}
                                className="px-8 py-3 rounded-xl bg-primary-container text-on-surface font-bold text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] hover:brightness-105 transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                綁定唯一錢包
                                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                            </button>
                        </div>
                    </StepCard>
                )}

                {/* ── Done step ── */}
                {step === "done" && (
                    <StepCard title="KYC 完成！" desc="錢包已綁定成功。請設定一組登入密碼，之後用身分證字號 + 密碼即可進入平台。">
                        {!passwordSaved ? (
                            <form
                                className="flex flex-col gap-4"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    setPasswordError("");
                                    if (newPassword.length < 8) { setPasswordError("密碼至少需要 8 個字元"); return; }
                                    if (newPassword !== newPasswordConfirm) { setPasswordError("兩次輸入的密碼不一致"); return; }
                                    void (async () => {
                                        try {
                                            await setPassword(walletAddress, newPassword);
                                            setPasswordSaved(true);
                                            setTimeout(() => navigate("/member"), 1500);
                                        } catch (err) {
                                            setPasswordError(err instanceof Error ? err.message : "設定失敗，請稍後再試");
                                        }
                                    })();
                                }}
                            >
                                <input
                                    className={inputCls}
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="8 個字元以上"
                                    required
                                    autoComplete="new-password"
                                />
                                <input
                                    className={inputCls}
                                    type="password"
                                    value={newPasswordConfirm}
                                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                                    placeholder="再輸入一次"
                                    required
                                    autoComplete="new-password"
                                />
                                {passwordError && <p className="text-sm text-error">{passwordError}</p>}
                                <div className="mt-6 flex justify-end pt-6 border-t border-surface-variant/50">
                                    <button
                                        type="submit"
                                        className="px-8 py-3 rounded-xl bg-primary-container text-on-surface font-bold text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] hover:brightness-105 transition-all flex items-center gap-2"
                                    >
                                        設定密碼 <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="text-center py-4">
                                <p className="text-tertiary font-bold text-lg mb-4">密碼設定成功！正在前往身份中心...</p>
                                <button type="button" className="text-tertiary text-sm underline bg-transparent" onClick={() => navigate("/member")}>
                                    前往身份中心
                                </button>
                            </div>
                        )}
                    </StepCard>
                )}
            </main>
        </div>
    );
};

export default OnboardingPage;
