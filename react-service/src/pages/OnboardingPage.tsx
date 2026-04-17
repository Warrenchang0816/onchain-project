import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { setPassword } from "@/api/authApi";
import {
    bindWallet,
    confirmKYCData,
    EmailAlreadyUsedError,
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
import SiteLayout from "../layouts/SiteLayout";

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

const stepLabels: Record<WizardStep, string> = {
    email: "Email 驗證",
    phone: "手機驗證",
    "id-card": "身分證上傳",
    confirm: "資料確認",
    "second-doc": "第二證件",
    selfie: "本人自拍",
    wallet: "綁定錢包",
    done: "完成",
};

const initialFiles: FileState = {
    idFront: null,
    idBack: null,
    secondDoc: null,
    selfie: null,
};

const initialPreviews: PreviewState = {
    idFront: "",
    idBack: "",
    secondDoc: "",
    selfie: "",
};

function FieldPreview({
    label,
    file,
    preview,
    required = false,
    hint,
    onChange,
}: {
    label: string;
    file: File | null;
    preview: string;
    required?: boolean;
    hint: string;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
    return (
        <label className="form-field onboarding-file-field">
            <span>{label}</span>
            <input type="file" accept="image/*" onChange={onChange} required={required} />
            <div className="onboarding-file-preview-shell">
                {preview ? (
                    <img className="onboarding-file-preview-image" src={preview} alt={label} />
                ) : (
                    <div className="onboarding-file-preview-empty">尚未選擇檔案</div>
                )}
            </div>
            <div className="onboarding-file-meta">
                <strong>{file?.name || "未上傳"}</strong>
                <span>{hint}</span>
            </div>
        </label>
    );
}

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
    const [idNumberHint, setIdNumberHint] = useState("");
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

    const progressSteps = useMemo(
        () => [
            { key: "email", label: "Email" },
            { key: "phone", label: "手機" },
            { key: "id-card", label: "身分證" },
            { key: "confirm", label: "確認資料" },
            { key: "second-doc", label: "第二證件" },
            { key: "selfie", label: "自拍" },
            { key: "wallet", label: "錢包" },
            { key: "done", label: "完成" },
        ],
        [],
    );

    useEffect(() => {
        return () => {
            Object.values(previews).forEach((value) => {
                if (value) {
                    URL.revokeObjectURL(value);
                }
            });
        };
    }, [previews]);

    const setPreviewFile = (field: keyof FileState, nextFile: File | null) => {
        setFiles((current) => ({ ...current, [field]: nextFile }));
        setPreviews((current) => {
            if (current[field]) {
                URL.revokeObjectURL(current[field]);
            }
            return {
                ...current,
                [field]: nextFile ? URL.createObjectURL(nextFile) : "",
            };
        });
    };

    const handleFile =
        (field: keyof FileState) =>
        (event: ChangeEvent<HTMLInputElement>) => {
            const nextFile = event.target.files?.[0] ?? null;
            setPreviewFile(field, nextFile);
        };

    const withBusy = async (work: () => Promise<void>, message = "處理中，請稍候...") => {
        try {
            setIsBusy(true);
            setBusyMessage(message);
            setErrorMessage("");
            await work();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "流程執行失敗，請稍後再試。");
        } finally {
            setIsBusy(false);
            setBusyMessage("");
        }
    };

    const resolveAlreadyBoundSession = (message: string) => {
        const normalized = message.toLowerCase();
        return normalized.includes("已完成綁定") || normalized.includes("already bound");
    };

    const submitEmailOTP = async (event: FormEvent) => {
        event.preventDefault();
        await withBusy(async () => {
            const result = await requestEmailOTP(email.trim().toLowerCase());
            setEmailSessionInfo(result);
            setStatusMessage("Email 驗證碼已送出，開發階段請先查看 go-service log。");
        }, "發送驗證碼中...");
    };

    // Verify OTP and either resume or restart depending on user's choice.
    const verifyEmailAndProceed = async (restart: boolean) => {
        await withBusy(async () => {
            let result;
            try {
                result = await verifyEmailOTP(email.trim().toLowerCase(), emailCode.trim());
            } catch (err) {
                if (err instanceof EmailAlreadyUsedError) {
                    setEmailConflict({ idHint: err.idHint });
                    return;
                }
                throw err;
            }
            if (result.is_resume && restart) {
                const newSess = await restartOnboardingSession(result.session_id);
                setEmailSessionInfo(null);
                setSessionId(newSess.session_id);
                setStep("phone");
                setStatusMessage("已重新開始 KYC 流程，請繼續完成手機驗證。");
            } else if (result.is_resume) {
                const targetStep = backendStepToWizardStep(result.step);
                if (targetStep === "confirm") {
                    setFullName(result.ocr_name ?? "");
                    setBirthDate(result.ocr_birth_date ?? "");
                    setAddress(result.ocr_address ?? "");
                    setIdNumberHint(result.id_number_hint ?? "");
                }
                setEmailSessionInfo(null);
                setSessionId(result.session_id);
                setStep(targetStep);
                setStatusMessage("已接續上次 KYC 進度，請繼續完成流程。");
            } else {
                setEmailSessionInfo(null);
                setSessionId(result.session_id);
                setStep("phone");
                setStatusMessage("Email 驗證完成，繼續完成手機驗證。");
            }
        });
    };

    const submitPhoneOTP = async (event: FormEvent) => {
        event.preventDefault();
        await withBusy(async () => {
            try {
                await requestPhoneOTP(sessionId, phone.trim());
            } catch (err) {
                if (err instanceof PhoneAlreadyUsedError) {
                    setPhoneConflict({ idHint: err.idHint });
                    return;
                }
                throw err;
            }
            setStatusMessage("手機驗證碼已送出，開發階段以 log 為主。");
        }, "發送簡訊中...");
    };

    const verifyPhone = async (event: FormEvent) => {
        event.preventDefault();
        await withBusy(async () => {
            await verifyPhoneOTP(sessionId, phone.trim(), phoneCode.trim());
            setStep("id-card");
            setStatusMessage("手機驗證完成，請先上傳身分證正反面。");
        }, "驗證中...");
    };

    const submitIdCards = async (event: FormEvent) => {
        event.preventDefault();
        if (!files.idFront || !files.idBack) {
            setErrorMessage("請先上傳身分證正面與背面。");
            return;
        }
        await withBusy(async () => {
            const result = await uploadKYCDocuments(sessionId, "id_card", {
                idFront: files.idFront,
                idBack: files.idBack,
            });
            setFullName(result.ocr_name || "");
            setBirthDate(result.ocr_birth_date || "");
            setAddress(result.ocr_address || "");
            setIdNumberHint(result.id_number_hint || "");
            setStep("confirm");
            setStatusMessage(
                result.ocr_success
                    ? "身分證分析完成，請確認回填資料。"
                    : "身分證已上傳，但 OCR 未完整讀到，請手動確認資料。",
            );
        }, "上傳並分析身分證中，請稍候...");
    };

    const submitConfirm = async (event: FormEvent) => {
        event.preventDefault();
        if (!fullName.trim() || !birthDate.trim()) {
            setErrorMessage("姓名與出生日期必須填寫。");
            return;
        }
        await withBusy(async () => {
            await confirmKYCData(sessionId, fullName.trim(), birthDate.trim());
            setStep("second-doc");
            setStatusMessage("基本資料已確認，請上傳第二證件備查。");
        }, "儲存資料中...");
    };

    const submitSecondDoc = async (event: FormEvent) => {
        event.preventDefault();
        if (!files.secondDoc) {
            setErrorMessage("請上傳第二證件。");
            return;
        }
        await withBusy(async () => {
            await uploadKYCDocuments(sessionId, "second_doc", {
                secondDoc: files.secondDoc,
            });
            setStep("selfie");
            setStatusMessage("第二證件已上傳，最後請上傳本人自拍照。");
        }, "上傳第二證件中...");
    };

    const submitSelfie = async (event: FormEvent) => {
        event.preventDefault();
        if (!files.idFront || !files.idBack || !files.secondDoc || !files.selfie) {
            setErrorMessage("請確認身分證、第二證件與自拍都已上傳。");
            return;
        }

        await withBusy(async () => {
            const result = await uploadKYCDocuments(sessionId, "selfie", {
                selfie: files.selfie!,
            });

            setStep("wallet");
            setStatusMessage(`本人自拍已完成，臉部比對分數 ${result.face_match_score.toFixed(2)}，請綁定唯一錢包。`);
        }, "上傳自拍並進行臉部比對，請稍候...");
    };

    const connectWallet = async () => {
        const provider = window.ethereum;
        if (!provider) {
            throw new Error("請先安裝 MetaMask。");
        }

        const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
        const currentChainId = (await provider.request({ method: "eth_chainId" })) as string;

        if (currentChainId.toLowerCase() !== SEPOLIA_CHAIN_ID) {
            await provider.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: SEPOLIA_CHAIN_ID }],
            });
        }

        const nextAddress = accounts[0];
        if (!nextAddress) {
            throw new Error("MetaMask 沒有回傳可用帳號。");
        }

        setWalletAddress(toChecksumAddress(nextAddress));
    };

    const submitWalletBind = async () => {
        setIsBusy(true);
        setBusyMessage("準備 SIWE 訊息中...");
        setErrorMessage("");

        try {
            if (!walletAddress) {
                throw new Error("請先連接 MetaMask。");
            }

            const { message } = await requestWalletMessage(sessionId, walletAddress);
            setBusyMessage("等待 MetaMask 簽名，請在錢包視窗確認...");
            const signature = await signSIWEMessage(message, walletAddress);
            setBusyMessage("驗證簽名並建立鏈上憑證，請稍候...");
            const result = await bindWallet(sessionId, walletAddress, message, signature);

            setStatusMessage(result.message);
            setStep("done");
            window.dispatchEvent(new CustomEvent("wallet-auth-changed"));
        } catch (error) {
            if (error instanceof WalletAlreadyBoundError) {
                setWalletAlreadyBound({ idHint: error.idHint });
                return;
            }
            if (error instanceof IdentityAlreadyUsedError) {
                setIdentityConflict({ idHint: error.idHint });
                return;
            }
            const message = error instanceof Error ? error.message : "流程執行失敗，請稍後再試。";
            if (resolveAlreadyBoundSession(message)) {
                setStatusMessage("這個 KYC session 已完成錢包綁定，請直接設定登入密碼。");
                setErrorMessage("");
                setStep("done");
                return;
            }
            setErrorMessage(message);
        } finally {
            setIsBusy(false);
            setBusyMessage("");
        }
    };

    const currentStepIndex = progressSteps.findIndex((item) => item.key === step);

    return (
        <SiteLayout>
            <section className="page-section onboarding-shell">
                <LoadingOverlay isVisible={isBusy} message={busyMessage || "處理中，請稍候..."} />

                <div className="page-heading">
                    <h1>KYC 驗證與錢包綁定</h1>
                    <p>
                        流程改成分頁進行：先完成 Email 與手機驗證，再依序上傳身分證正反面、確認資料、第二證件、本人自拍，最後綁定唯一錢包。
                    </p>
                </div>

                <div className="onboarding-progress onboarding-progress--eight">
                    {progressSteps.map((item, index) => (
                        <div
                            key={item.key}
                            className={`onboarding-progress-step ${item.key === step ? "is-active" : ""} ${currentStepIndex >= index ? "is-complete" : ""}`}
                        >
                            <span>{item.label}</span>
                        </div>
                    ))}
                </div>

                {statusMessage ? <div className="onboarding-banner">{statusMessage}</div> : null}
                {errorMessage ? (
                    <div className="onboarding-error">
                        {errorMessage}
                    </div>
                ) : null}

                {step === "email" && emailConflict ? (
                    <div className="onboarding-card onboarding-card--wide onboarding-wallet-bound-card">
                        <div className="onboarding-wallet-bound-icon">⚠️</div>
                        <h2>此 Email 已被其他會員使用</h2>
                        {emailConflict.idHint ? (
                            <p>
                                此 Email 已綁定另一位會員（身分證隱碼：<strong>{emailConflict.idHint}</strong>）。
                            </p>
                        ) : (
                            <p>此 Email 已被其他會員使用。</p>
                        )}
                        <p className="onboarding-wallet-bound-hint">
                            若此為本人操作，請聯絡客服協助處理。若非本人，請改用其他 Email 重新申請。
                        </p>
                        <div className="hero-actions">
                            <button
                                type="button"
                                className="inline-link-button inline-link-button--secondary"
                                onClick={() => {
                                    setEmailConflict(null);
                                    setEmail("");
                                    setEmailCode("");
                                    setEmailSessionInfo(null);
                                }}
                            >
                                換一個 Email
                            </button>
                        </div>
                    </div>
                ) : null}

                {step === "email" && !emailConflict ? (
                    <div className="onboarding-grid">
                        {/* Left card: email input + send OTP */}
                        <form className="onboarding-card" onSubmit={submitEmailOTP}>
                            <h2>{stepLabels.email}</h2>
                            <p>輸入信箱後送出驗證碼，系統會同時確認是否有未完成進度。</p>
                            <label className="form-field">
                                <span>Email</span>
                                <input value={email} onChange={(event) => { setEmail(event.target.value); setEmailSessionInfo(null); }} type="email" required />
                            </label>
                            <button type="submit" disabled={isBusy}>送出驗證碼</button>
                        </form>

                        {/* Right card: normal OTP verification OR resume choice */}
                        {emailSessionInfo?.has_active_session ? (
                            <div className="onboarding-card">
                                <h2>發現未完成的進度</h2>
                                <p>
                                    你的 KYC 流程停在「<strong>{stepLabels[backendStepToWizardStep(emailSessionInfo.active_step!)]}</strong>」步驟。
                                    輸入驗證碼後選擇接續或重新開始。
                                </p>
                                <label className="form-field">
                                    <span>6 碼驗證碼</span>
                                    <input
                                        value={emailCode}
                                        onChange={(event) => setEmailCode(event.target.value)}
                                        inputMode="numeric"
                                        maxLength={6}
                                        required
                                        autoFocus
                                    />
                                </label>
                                <div className="hero-actions">
                                    <button
                                        type="button"
                                        onClick={() => void verifyEmailAndProceed(false)}
                                        disabled={isBusy || !emailCode}
                                    >
                                        接續上次進度
                                    </button>
                                    <button
                                        type="button"
                                        className="inline-link-button inline-link-button--secondary"
                                        onClick={() => void verifyEmailAndProceed(true)}
                                        disabled={isBusy || !emailCode}
                                    >
                                        重新開始
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <form className="onboarding-card" onSubmit={(e) => { e.preventDefault(); void verifyEmailAndProceed(false); }}>
                                <h2>確認 Email 驗證碼</h2>
                                <p>輸入 Email 驗證碼後，才會進入手機驗證。</p>
                                <label className="form-field">
                                    <span>6 碼驗證碼</span>
                                    <input value={emailCode} onChange={(event) => setEmailCode(event.target.value)} inputMode="numeric" maxLength={6} required />
                                </label>
                                <button type="submit" disabled={isBusy || !email}>驗證 Email</button>
                            </form>
                        )}
                    </div>
                ) : null}

                {step === "phone" && phoneConflict ? (
                    <div className="onboarding-card onboarding-card--wide onboarding-wallet-bound-card">
                        <div className="onboarding-wallet-bound-icon">⚠️</div>
                        <h2>此手機號碼已被其他會員使用</h2>
                        {phoneConflict.idHint ? (
                            <p>
                                此手機號碼已綁定另一位會員（身分證隱碼：<strong>{phoneConflict.idHint}</strong>）。
                            </p>
                        ) : (
                            <p>此手機號碼已被其他會員使用。</p>
                        )}
                        <p className="onboarding-wallet-bound-hint">
                            若此為本人操作，請聯絡客服協助處理。若非本人，請改用其他手機號碼重新申請。
                        </p>
                        <div className="hero-actions">
                            <button
                                type="button"
                                className="inline-link-button inline-link-button--secondary"
                                onClick={() => {
                                    setPhoneConflict(null);
                                    setPhone("");
                                    setPhoneCode("");
                                }}
                            >
                                換一個手機號碼
                            </button>
                        </div>
                    </div>
                ) : null}

                {step === "phone" && !phoneConflict ? (
                    <div className="onboarding-grid">
                        <form className="onboarding-card" onSubmit={submitPhoneOTP}>
                            <h2>{stepLabels.phone}</h2>
                            <p>完成手機驗證後，才開放證件上傳流程。</p>
                            <label className="form-field">
                                <span>手機號碼</span>
                                <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="09xxxxxxxx" required />
                            </label>
                            <button type="submit" disabled={isBusy}>送出手機驗證碼</button>
                        </form>

                        <form className="onboarding-card" onSubmit={verifyPhone}>
                            <h2>確認手機驗證碼</h2>
                            <p>開發階段先把流程跑通，之後再接真實簡訊服務。</p>
                            <label className="form-field">
                                <span>6 碼驗證碼</span>
                                <input value={phoneCode} onChange={(event) => setPhoneCode(event.target.value)} inputMode="numeric" maxLength={6} required />
                            </label>
                            <button type="submit" disabled={isBusy || !phone}>驗證手機</button>
                        </form>
                    </div>
                ) : null}

                {step === "id-card" ? (
                    <form className="onboarding-card onboarding-card--wide" onSubmit={submitIdCards}>
                        <h2>{stepLabels["id-card"]}</h2>
                        <p>這一頁只處理身分證正面與背面，兩張都要能先預覽再往下走。</p>
                        <div className="onboarding-upload-grid onboarding-upload-grid--single-purpose">
                            <FieldPreview
                                label="身分證正面"
                                file={files.idFront}
                                preview={previews.idFront}
                                required
                                hint="請確認四角完整、反光不要太強。"
                                onChange={handleFile("idFront")}
                            />
                            <FieldPreview
                                label="身分證背面"
                                file={files.idBack}
                                preview={previews.idBack}
                                required
                                hint="請確認住址與備註欄清楚可見。"
                                onChange={handleFile("idBack")}
                            />
                        </div>
                        <div className="hero-actions">
                            <button type="submit" disabled={isBusy}>下一步：資訊確認</button>
                        </div>
                    </form>
                ) : null}

                {step === "confirm" ? (
                    <form className="onboarding-card onboarding-card--wide" onSubmit={submitConfirm}>
                        <h2>{stepLabels.confirm}</h2>
                        <p>先讓使用者人工確認基本資料。OCR 結果會在完成自拍分析後再回填補強，但這一頁先照金融流程讓客戶確認。</p>
                        <div className="onboarding-summary">
                            <div className="member-row">
                                <span className="member-label">身分證預覽</span>
                                <span className="member-value">已上傳正反面，可返回上一頁重選。</span>
                            </div>
                            <div className="member-row">
                                <span className="member-label">證號提示</span>
                                <span className="member-value">{idNumberHint || "尚未分析"}</span>
                            </div>
                            <div className="member-row">
                                <span className="member-label">戶籍地址</span>
                                <span className="member-value">{address || "自拍分析後若 OCR 讀到，會自動補回。"}</span>
                            </div>
                        </div>
                        <div className="kyc-form-grid">
                            <label className="form-field">
                                <span>姓名</span>
                                <input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
                            </label>
                            <label className="form-field">
                                <span>出生日期</span>
                                <input value={birthDate} onChange={(event) => setBirthDate(event.target.value)} placeholder="1990-01-01" required />
                            </label>
                            <label className="form-field kyc-form-field-wide">
                                <span>戶籍地址</span>
                                <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="可先人工輸入，後續 OCR 有值會補回" />
                            </label>
                        </div>
                        <div className="hero-actions">
                            <button type="button" className="inline-link-button inline-link-button--secondary" onClick={() => setStep("id-card")}>返回身分證頁</button>
                            <button type="submit" disabled={isBusy}>下一步：第二證件</button>
                        </div>
                    </form>
                ) : null}

                {step === "second-doc" ? (
                    <form className="onboarding-card onboarding-card--wide" onSubmit={submitSecondDoc}>
                        <h2>{stepLabels["second-doc"]}</h2>
                        <p>第二證件目前先做備份留存，不做主要 OCR 判讀，但要能預覽與重選。</p>
                        <div className="onboarding-upload-grid onboarding-upload-grid--single-upload">
                            <FieldPreview
                                label="第二證件"
                                file={files.secondDoc}
                                preview={previews.secondDoc}
                                required
                                hint="例如健保卡、駕照或其他輔助證件。"
                                onChange={handleFile("secondDoc")}
                            />
                        </div>
                        <div className="hero-actions">
                            <button type="button" className="inline-link-button inline-link-button--secondary" onClick={() => setStep("confirm")}>返回資料確認</button>
                            <button type="submit" disabled={isBusy}>下一步：本人自拍</button>
                        </div>
                    </form>
                ) : null}

                {step === "selfie" ? (
                    <form className="onboarding-card onboarding-card--wide" onSubmit={submitSelfie}>
                        <h2>{stepLabels.selfie}</h2>
                        <p>最後上傳本人自拍。送出這一步時，前端會一次把所有證件與自拍送到後端分析，再銜接綁定錢包。</p>
                        <div className="onboarding-upload-grid onboarding-upload-grid--single-upload">
                            <FieldPreview
                                label="本人自拍"
                                file={files.selfie}
                                preview={previews.selfie}
                                required
                                hint="請正面、清晰、避免墨鏡與過暗光線。"
                                onChange={handleFile("selfie")}
                            />
                        </div>
                        <div className="hero-actions">
                            <button type="button" className="inline-link-button inline-link-button--secondary" onClick={() => setStep("second-doc")}>返回第二證件</button>
                            <button type="submit" disabled={isBusy}>送出分析並前往綁定錢包</button>
                        </div>
                    </form>
                ) : null}

                {step === "wallet" ? (
                    identityConflict ? (
                        <div className="onboarding-card onboarding-card--wide onboarding-wallet-bound-card">
                            <div className="onboarding-wallet-bound-icon">⚠️</div>
                            <h2>此身分字號已完成 KYC 綁定</h2>
                            {identityConflict.idHint ? (
                                <p>
                                    此身分字號已由另一位會員完成綁定（身分證隱碼：<strong>{identityConflict.idHint}</strong>）。
                                </p>
                            ) : (
                                <p>此身分字號已完成 KYC 綁定。</p>
                            )}
                            <p className="onboarding-wallet-bound-hint">
                                若此為本人操作，請聯絡客服協助處理。若非本人，請立即聯絡客服回報。
                            </p>
                        </div>
                    ) : walletAlreadyBound ? (
                        <div className="onboarding-card onboarding-card--wide onboarding-wallet-bound-card">
                            <div className="onboarding-wallet-bound-icon">⚠️</div>
                            <h2>此錢包已完成身份綁定</h2>
                            {walletAlreadyBound.idHint ? (
                                <p>
                                    此錢包已綁定身份（身分證隱碼：<strong>{walletAlreadyBound.idHint}</strong>）。
                                </p>
                            ) : (
                                <p>此錢包已在平台綁定過身份。</p>
                            )}
                            <p className="onboarding-wallet-bound-hint">
                                若此為本人操作，可能是舊帳號資料，請聯絡客服協助處理。
                                若非本人，請立即更換錢包並聯絡客服。
                            </p>
                            <div className="hero-actions">
                                <button
                                    type="button"
                                    className="inline-link-button inline-link-button--secondary"
                                    onClick={() => {
                                        setWalletAlreadyBound(null);
                                        setWalletAddress("");
                                    }}
                                >
                                    換一個錢包
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="onboarding-grid">
                            <div className="onboarding-card">
                                <h2>{stepLabels.wallet}</h2>
                                <p>證件與自拍完成後，再要求綁定唯一錢包，才符合你要的 KYC 主體流程。</p>
                                <button type="button" onClick={() => void withBusy(connectWallet, "連接錢包中...")} disabled={isBusy}>
                                    {walletAddress ? "已連接 MetaMask" : "連接 MetaMask"}
                                </button>
                                <div className="onboarding-wallet-box">
                                    {walletAddress || "尚未連接錢包"}
                                </div>
                            </div>

                            <div className="onboarding-card">
                                <h2>完成 SIWE 綁定</h2>
                                <p>平台會要求使用者簽署訊息，綁定這個 onboarding session 與唯一錢包地址。</p>
                                <button type="button" onClick={() => void submitWalletBind()} disabled={isBusy || !walletAddress}>
                                    綁定唯一錢包
                                </button>
                            </div>
                        </div>
                    )
                ) : null}

                {step === "done" ? (
                    <div className="onboarding-card onboarding-card--wide">
                        <h2>KYC 完成！設定登入密碼</h2>
                        <p>錢包已綁定成功。請設定一組登入密碼，之後用 Email + 密碼即可進入平台，不需要每次連 MetaMask。</p>

                        {!passwordSaved ? (
                            <form
                                className="onboarding-password-form"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    setPasswordError("");
                                    if (newPassword.length < 8) {
                                        setPasswordError("密碼至少需要 8 個字元");
                                        return;
                                    }
                                    if (newPassword !== newPasswordConfirm) {
                                        setPasswordError("兩次輸入的密碼不一致");
                                        return;
                                    }
                                    void (async () => {
                                        try {
                                            await setPassword(walletAddress, newPassword);
                                            setPasswordSaved(true);
                                            navigate("/member");
                                        } catch (err) {
                                            setPasswordError(err instanceof Error ? err.message : "設定失敗，請稍後再試");
                                        }
                                    })();
                                }}
                            >
                                <label className="form-field">
                                    <span>登入密碼</span>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="8 個字元以上"
                                        required
                                        autoComplete="new-password"
                                    />
                                </label>
                                <label className="form-field">
                                    <span>確認密碼</span>
                                    <input
                                        type="password"
                                        value={newPasswordConfirm}
                                        onChange={(e) => setNewPasswordConfirm(e.target.value)}
                                        placeholder="再輸入一次"
                                        required
                                        autoComplete="new-password"
                                    />
                                </label>
                                {passwordError ? <p className="form-error">{passwordError}</p> : null}
                                <button type="submit">設定密碼</button>
                            </form>
                        ) : (
                            <div className="hero-actions">
                                <p className="onboarding-password-saved">密碼設定成功，正在前往身份中心...</p>
                                <button type="button" className="inline-link-button" onClick={() => navigate("/member")}>
                                    前往身份中心
                                </button>
                            </div>
                        )}
                    </div>
                ) : null}
            </section>
        </SiteLayout>
    );
};

export default OnboardingPage;
