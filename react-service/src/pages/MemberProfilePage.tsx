import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    getUserProfile,
    requestEmailChangeOTP,
    verifyEmailChange,
    requestPhoneChangeOTP,
    verifyPhoneChange,
    requestMailingAddressOTP,
    updateMailingAddress,
    type UserProfile,
} from "@/api/userApi";
import SiteLayout from "../layouts/SiteLayout";

const CREDENTIAL_LABEL: Record<string, string> = {
    OWNER:  "屋主",
    TENANT: "租客",
    AGENT:  "仲介",
};

const KYC_STATUS_LABEL: Record<string, string> = {
    UNVERIFIED: "未驗證",
    PENDING:    "審核中",
    VERIFIED:   "已驗證",
    REJECTED:   "未通過",
};

type PageState =
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ok"; profile: UserProfile };

type EditField = "email" | "phone" | "mailing";

type EditState =
    | { stage: "idle" }
    | { stage: "input"; value: string; channel?: "email" | "phone"; busy: boolean; error: string }
    | { stage: "otp";   value: string; channel?: "email" | "phone"; otp: string; busy: boolean; error: string; sent: boolean };

const inputCls =
    "block w-full px-4 py-3 border-0 bg-surface-container-low text-on-surface rounded-lg " +
    "focus:ring-2 focus:ring-primary-container focus:bg-surface-container-lowest transition-colors " +
    "text-sm outline-none placeholder:text-outline";

const MemberProfilePage = () => {
    const navigate = useNavigate();
    const [state, setState] = useState<PageState>({ status: "loading" });
    const [copied, setCopied] = useState(false);
    const [editing, setEditing] = useState<EditField | null>(null);
    const [editState, setEditState] = useState<EditState>({ stage: "idle" });

    const loadProfile = () => {
        setState({ status: "loading" });
        void getUserProfile()
            .then((profile) => setState({ status: "ok", profile }))
            .catch((err) => setState({
                status: "error",
                message: err instanceof Error ? err.message : "讀取會員資料失敗",
            }));
    };

    useEffect(() => {
        void getUserProfile()
            .then((profile) => setState({ status: "ok", profile }))
            .catch((err) => setState({
                status: "error",
                message: err instanceof Error ? err.message : "讀取會員資料失敗",
            }));
    }, []);

    const copyWallet = (address: string) => {
        void navigator.clipboard.writeText(address).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const startEdit = (field: EditField) => {
        setEditing(field);
        const initialValue = state.status === "ok"
            ? field === "email" ? state.profile.email
            : field === "phone" ? state.profile.phone
            : (state.profile.mailingAddress || state.profile.registeredAddress)
            : "";
        setEditState({ stage: "input", value: initialValue, channel: undefined, busy: false, error: "" });
    };

    const cancelEdit = () => {
        setEditing(null);
        setEditState({ stage: "idle" });
    };

    const handleSendOTP = async () => {
        if (editState.stage !== "input") return;
        setEditState({ ...editState, busy: true, error: "" });
        try {
            if (editing === "email") {
                await requestEmailChangeOTP(editState.value);
            } else if (editing === "phone") {
                await requestPhoneChangeOTP(editState.value);
            } else {
                await requestMailingAddressOTP(editState.channel ?? "email");
            }
            setEditState({ stage: "otp", value: editState.value, channel: editState.channel, otp: "", busy: false, error: "", sent: true });
        } catch (err) {
            setEditState({ ...editState, busy: false, error: err instanceof Error ? err.message : "發送失敗" });
        }
    };

    const handleVerify = async () => {
        if (editState.stage !== "otp") return;
        setEditState({ ...editState, busy: true, error: "" });
        try {
            if (editing === "email") {
                await verifyEmailChange(editState.value, editState.otp);
            } else if (editing === "phone") {
                await verifyPhoneChange(editState.value, editState.otp);
            } else {
                await updateMailingAddress(editState.value, editState.channel ?? "email", editState.otp);
            }
            cancelEdit();
            loadProfile();
        } catch (err) {
            setEditState({ ...editState, busy: false, error: err instanceof Error ? err.message : "驗證失敗" });
        }
    };

    const renderEditPanel = (field: EditField) => {
        if (editing !== field) return null;
        const isMailing = field === "mailing";
        const isEmail   = field === "email";
        const isPhone   = field === "phone";

        if (editState.stage === "input") {
            return (
                <div className="mt-4 flex flex-col gap-3 bg-surface-container-low rounded-lg p-4">
                    {isMailing && (
                        <>
                            <textarea
                                className={`${inputCls} resize-none`}
                                placeholder="請輸入通訊地址"
                                value={editState.value}
                                onChange={(e) => setEditState({ ...editState, value: e.target.value })}
                                rows={2}
                            />
                            <div className="flex items-center gap-4">
                                <span className="text-sm text-on-surface-variant">驗證方式：</span>
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input type="radio" name="channel" value="email" checked={(editState.channel ?? "email") === "email"} onChange={() => setEditState({ ...editState, channel: "email" })} />
                                    Email
                                </label>
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input type="radio" name="channel" value="phone" checked={editState.channel === "phone"} onChange={() => setEditState({ ...editState, channel: "phone" })} />
                                    手機
                                </label>
                            </div>
                        </>
                    )}
                    {(isEmail || isPhone) && (
                        <input
                            className={inputCls}
                            type={isEmail ? "email" : "tel"}
                            placeholder={isEmail ? "請輸入新 Email" : "請輸入新手機號碼"}
                            value={editState.value}
                            onChange={(e) => setEditState({ ...editState, value: e.target.value })}
                        />
                    )}
                    {editState.error && <p className="text-xs text-error">{editState.error}</p>}
                    <div className="flex gap-2">
                        <button
                            type="button"
                            className="px-4 py-2 bg-primary-container text-on-primary-container text-sm font-bold rounded-lg hover:bg-inverse-primary transition-colors disabled:opacity-50"
                            onClick={() => void handleSendOTP()}
                            disabled={editState.busy || editState.value.trim() === ""}
                        >
                            {editState.busy ? "發送中..." : "發送驗證碼"}
                        </button>
                        <button
                            type="button"
                            className="px-4 py-2 bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-sm font-medium rounded-lg hover:bg-surface-container-low transition-colors"
                            onClick={cancelEdit}
                        >
                            取消
                        </button>
                    </div>
                </div>
            );
        }

        if (editState.stage === "otp") {
            return (
                <div className="mt-4 flex flex-col gap-3 bg-surface-container-low rounded-lg p-4">
                    <p className="text-sm text-on-surface-variant">驗證碼已發送，請在 5 分鐘內完成驗證。</p>
                    <input
                        className={`${inputCls} tracking-widest font-mono`}
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="請輸入 6 位驗證碼"
                        value={editState.otp}
                        onChange={(e) => setEditState({ ...editState, otp: e.target.value.replace(/\D/g, "") })}
                    />
                    {editState.error && <p className="text-xs text-error">{editState.error}</p>}
                    <div className="flex gap-2">
                        <button
                            type="button"
                            className="px-4 py-2 bg-primary-container text-on-primary-container text-sm font-bold rounded-lg hover:bg-inverse-primary transition-colors disabled:opacity-50"
                            onClick={() => void handleVerify()}
                            disabled={editState.busy || editState.otp.length !== 6}
                        >
                            {editState.busy ? "驗證中..." : "確認"}
                        </button>
                        <button
                            type="button"
                            className="px-4 py-2 bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-sm font-medium rounded-lg hover:bg-surface-container-low transition-colors"
                            onClick={cancelEdit}
                        >
                            取消
                        </button>
                    </div>
                </div>
            );
        }

        return null;
    };

    if (state.status === "loading") {
        return (
            <SiteLayout>
                <main className="flex-grow w-full max-w-[1440px] mx-auto px-6 md:px-12 py-12">
                    <div className="max-w-3xl mx-auto">
                        <div className="flex items-center justify-center py-20">
                            <span className="text-sm text-on-surface-variant animate-pulse">讀取中...</span>
                        </div>
                    </div>
                </main>
            </SiteLayout>
        );
    }

    if (state.status === "error") {
        return (
            <SiteLayout>
                <main className="flex-grow w-full max-w-[1440px] mx-auto px-6 md:px-12 py-12">
                    <div className="max-w-3xl mx-auto">
                        <div className="bg-error-container text-on-error-container rounded-xl p-4 text-sm">{state.message}</div>
                        <button type="button" className="mt-4 text-tertiary text-sm underline bg-transparent" onClick={() => navigate("/login")}>
                            重新登入
                        </button>
                    </div>
                </main>
            </SiteLayout>
        );
    }

    const { profile } = state;
    const roleLabel = profile.credentials.length > 0
        ? profile.credentials.map((c) => CREDENTIAL_LABEL[c] ?? c).join("／")
        : "一般會員";

    return (
        <SiteLayout>
            <main className="flex-grow w-full max-w-[1440px] mx-auto px-6 md:px-12 py-12">
                <div className="max-w-3xl mx-auto">
                    {/* Page Header */}
                    <div className="mb-12">
                        <h1 className="text-3xl md:text-[32px] font-extrabold text-on-surface tracking-tight mb-2">會員資料</h1>
                        <p className="text-on-surface-variant text-[15px] leading-[1.75]">管理您的個人資訊與數位資產連結</p>
                    </div>

                    <div className="flex flex-col gap-8">
                        {/* Card 1: Basic Data */}
                        <section className="bg-surface-container-lowest rounded-xl p-8 relative overflow-hidden shadow-[0_4px_32px_rgba(28,25,23,0.02)]">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-container rounded-l-xl" />
                            <h3 className="text-xl font-bold text-on-surface mb-6 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary-container">person</span>
                                基本資料
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                                <div className="flex flex-col gap-1">
                                    <span className="text-sm font-medium text-outline">姓名</span>
                                    <span className="text-[15px] font-medium text-on-surface">
                                        {profile.displayName || <em className="not-italic text-outline">未填寫</em>}
                                    </span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-sm font-medium text-outline">會員身分</span>
                                    <span className="text-[15px] font-medium text-on-surface">{roleLabel}</span>
                                </div>
                                {profile.idNumber && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm font-medium text-outline">身分證字號</span>
                                        <span className="text-[15px] font-mono text-on-surface">{profile.idNumber}</span>
                                    </div>
                                )}
                                {profile.gender && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm font-medium text-outline">性別</span>
                                        <span className="text-[15px] font-medium text-on-surface">{profile.gender}</span>
                                    </div>
                                )}
                                {profile.birthDate && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm font-medium text-outline">出生日期</span>
                                        <span className="text-[15px] font-medium text-on-surface">{profile.birthDate}</span>
                                    </div>
                                )}
                                {profile.registeredAddress && (
                                    <div className="flex flex-col gap-1 md:col-span-2">
                                        <span className="text-sm font-medium text-outline">戶籍地址（OCR）</span>
                                        <span className="text-[15px] font-medium text-on-surface">{profile.registeredAddress}</span>
                                    </div>
                                )}
                                <div className="flex flex-col gap-1">
                                    <span className="text-sm font-medium text-outline">加入日期</span>
                                    <span className="text-[15px] font-medium text-on-surface">
                                        {profile.createdAt
                                            ? new Date(profile.createdAt).toLocaleDateString("zh-TW")
                                            : "—"}
                                    </span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-sm font-medium text-outline">實名認證</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[15px] font-medium text-on-surface">
                                            {KYC_STATUS_LABEL[profile.kycStatus] ?? profile.kycStatus}
                                        </span>
                                        {profile.kycStatus === "VERIFIED" && (
                                            <span className="material-symbols-outlined text-tertiary-container text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Card 2: Contact Info */}
                        <section className="bg-surface-container-lowest rounded-xl p-8 relative overflow-hidden shadow-[0_4px_32px_rgba(28,25,23,0.02)]">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-container rounded-l-xl" />
                            <div className="flex justify-between items-start mb-6">
                                <h3 className="text-xl font-bold text-on-surface flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary-container">contact_mail</span>
                                    聯絡資訊
                                </h3>
                            </div>
                            <div className="flex flex-col gap-6">
                                {/* Email */}
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-surface-container-low">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm font-medium text-outline">電子郵件</span>
                                        <span className="text-[15px] font-medium text-on-surface">
                                            {profile.email || <em className="not-italic text-outline">未設定</em>}
                                        </span>
                                    </div>
                                    {editing !== "email" && (
                                        <button
                                            type="button"
                                            className="px-4 py-2 bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-sm font-medium rounded-lg hover:bg-surface-container-low transition-colors w-fit"
                                            onClick={() => startEdit("email")}
                                        >
                                            修改
                                        </button>
                                    )}
                                </div>
                                {renderEditPanel("email")}

                                {/* Phone */}
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-surface-container-low">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm font-medium text-outline">聯絡電話</span>
                                        <span className="text-[15px] font-medium text-on-surface">
                                            {profile.phone || <em className="not-italic text-outline">未設定</em>}
                                        </span>
                                    </div>
                                    {editing !== "phone" && (
                                        <button
                                            type="button"
                                            className="px-4 py-2 bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-sm font-medium rounded-lg hover:bg-surface-container-low transition-colors w-fit"
                                            onClick={() => startEdit("phone")}
                                        >
                                            修改
                                        </button>
                                    )}
                                </div>
                                {renderEditPanel("phone")}

                                {/* Mailing Address */}
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm font-medium text-outline">通訊地址</span>
                                        <span className="text-[15px] font-medium text-on-surface">
                                            {profile.mailingAddress || profile.registeredAddress
                                                ? (profile.mailingAddress || profile.registeredAddress)
                                                : <em className="not-italic text-outline">未設定</em>
                                            }
                                        </span>
                                        {!profile.mailingAddress && profile.registeredAddress && (
                                            <span className="text-xs text-outline mt-1">預設同戶籍地址，可修改</span>
                                        )}
                                    </div>
                                    {editing !== "mailing" && (
                                        <button
                                            type="button"
                                            className="px-4 py-2 bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-sm font-medium rounded-lg hover:bg-surface-container-low transition-colors w-fit"
                                            onClick={() => startEdit("mailing")}
                                        >
                                            修改
                                        </button>
                                    )}
                                </div>
                                {renderEditPanel("mailing")}
                            </div>
                        </section>

                        {/* Card 3: Wallet */}
                        <section className="bg-surface-container-lowest rounded-xl p-8 relative overflow-hidden shadow-[0_4px_32px_rgba(28,25,23,0.02)]">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-container rounded-l-xl" />
                            <div className="flex justify-between items-start mb-6">
                                <h3 className="text-xl font-bold text-on-surface flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary-container">account_balance_wallet</span>
                                    錢包綁定
                                </h3>
                                <span className="px-3 py-1 bg-tertiary/10 text-tertiary text-xs font-bold rounded-full">已連結</span>
                            </div>
                            <div className="bg-surface-container p-4 rounded-lg flex flex-col md:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-4 w-full md:w-auto">
                                    <div className="w-10 h-10 rounded-full bg-surface-container-lowest flex items-center justify-center shadow-sm">
                                        <span className="material-symbols-outlined text-on-surface-variant">currency_exchange</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-outline">主錢包地址 (Ethereum)</span>
                                        <span className="font-mono text-sm text-on-surface break-all">
                                            {profile.walletAddress
                                                ? `${profile.walletAddress.slice(0, 6)}...${profile.walletAddress.slice(-4)}`
                                                : "未連結"}
                                        </span>
                                    </div>
                                </div>
                                {profile.walletAddress && (
                                    <button
                                        type="button"
                                        className="p-2 bg-transparent text-on-surface-variant hover:text-primary-container hover:bg-surface-container-lowest rounded-full transition-colors flex items-center justify-center"
                                        onClick={() => copyWallet(profile.walletAddress)}
                                        title={copied ? "已複製" : "複製地址"}
                                    >
                                        <span className="material-symbols-outlined text-[20px]">
                                            {copied ? "check" : "content_copy"}
                                        </span>
                                    </button>
                                )}
                            </div>
                        </section>
                    </div>
                </div>
            </main>
        </SiteLayout>
    );
};

export default MemberProfilePage;
