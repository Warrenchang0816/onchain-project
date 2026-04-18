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

const KYC_STATUS_LABEL: Record<string, string> = {
    UNVERIFIED: "未驗證",
    PENDING:    "審核中",
    VERIFIED:   "已驗證",
    REJECTED:   "未通過",
};

const KYC_STATUS_CLASS: Record<string, string> = {
    UNVERIFIED: "status-badge status-badge--gray",
    PENDING:    "status-badge status-badge--yellow",
    VERIFIED:   "status-badge status-badge--green",
    REJECTED:   "status-badge status-badge--red",
};

const CREDENTIAL_LABEL: Record<string, string> = {
    OWNER:  "屋主",
    TENANT: "租客",
    AGENT:  "仲介",
};

function formatDate(iso?: string): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("zh-TW", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
        hour12: false,
    });
}

function shortTx(tx: string): string {
    return `${tx.slice(0, 10)}...${tx.slice(-8)}`;
}

type PageState =
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ok"; profile: UserProfile };

// ── Inline field editor with OTP verification ─────────────────────────────

type EditField = "email" | "phone" | "mailing";

type EditState =
    | { stage: "idle" }
    | { stage: "input"; value: string; channel?: "email" | "phone"; busy: boolean; error: string }
    | { stage: "otp";   value: string; channel?: "email" | "phone"; otp: string; busy: boolean; error: string; sent: boolean };

type EditButtonProps = { field: EditField; editing: EditField | null; onStart: (f: EditField) => void };

function EditButton({ field, editing, onStart }: EditButtonProps) {
    if (editing === field) return null;
    return (
        <button type="button" className="profile-edit-trigger" onClick={() => onStart(field)}>
            變更
        </button>
    );
}

const MemberProfilePage = () => {
    const navigate = useNavigate();
    const [state, setState] = useState<PageState>({ status: "loading" });
    const [copied, setCopied] = useState(false);
    const [editing, setEditing] = useState<EditField | null>(null);
    const [editState, setEditState] = useState<EditState>({ stage: "idle" });

    // Called from event handlers after a successful edit (sync setState is fine outside effects).
    const loadProfile = () => {
        setState({ status: "loading" });
        void getUserProfile()
            .then((profile) => setState({ status: "ok", profile }))
            .catch((err) => setState({
                status: "error",
                message: err instanceof Error ? err.message : "讀取會員資料失敗",
            }));
    };

    // Initial fetch: setState only called in async callbacks to satisfy react-hooks/set-state-in-effect.
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
            : state.profile.mailingAddress
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
                <div className="profile-edit-panel">
                    {isMailing && (
                        <>
                            <textarea
                                className="profile-edit-textarea"
                                placeholder="請輸入通訊地址"
                                value={editState.value}
                                onChange={(e) => setEditState({ ...editState, value: e.target.value })}
                                rows={2}
                            />
                            <div className="profile-edit-channel-row">
                                <span className="profile-edit-channel-label">以下列方式驗證身份：</span>
                                <label className="profile-edit-channel-option">
                                    <input
                                        type="radio"
                                        name="channel"
                                        value="email"
                                        checked={(editState.channel ?? "email") === "email"}
                                        onChange={() => setEditState({ ...editState, channel: "email" })}
                                    />
                                    Email
                                </label>
                                <label className="profile-edit-channel-option">
                                    <input
                                        type="radio"
                                        name="channel"
                                        value="phone"
                                        checked={editState.channel === "phone"}
                                        onChange={() => setEditState({ ...editState, channel: "phone" })}
                                    />
                                    手機
                                </label>
                            </div>
                        </>
                    )}
                    {(isEmail || isPhone) && (
                        <input
                            className="profile-edit-input"
                            type={isEmail ? "email" : "tel"}
                            placeholder={isEmail ? "請輸入新 Email" : "請輸入新手機號碼"}
                            value={editState.value}
                            onChange={(e) => setEditState({ ...editState, value: e.target.value })}
                        />
                    )}
                    {editState.error && <p className="profile-edit-error">{editState.error}</p>}
                    <div className="profile-edit-actions">
                        <button
                            type="button"
                            className="profile-edit-btn profile-edit-btn--primary"
                            onClick={() => void handleSendOTP()}
                            disabled={editState.busy || editState.value.trim() === ""}
                        >
                            {editState.busy ? "發送中..." : "發送驗證碼"}
                        </button>
                        <button type="button" className="profile-edit-btn" onClick={cancelEdit}>取消</button>
                    </div>
                </div>
            );
        }

        if (editState.stage === "otp") {
            return (
                <div className="profile-edit-panel">
                    {isMailing && (
                        <p className="profile-edit-hint">
                            新地址：<strong>{editState.value}</strong>
                        </p>
                    )}
                    <p className="profile-edit-hint">
                        驗證碼已發送，請在 5 分鐘內完成驗證。
                    </p>
                    <input
                        className="profile-edit-input profile-edit-input--otp"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="請輸入 6 位驗證碼"
                        value={editState.otp}
                        onChange={(e) => setEditState({ ...editState, otp: e.target.value.replace(/\D/g, "") })}
                    />
                    {editState.error && <p className="profile-edit-error">{editState.error}</p>}
                    <div className="profile-edit-actions">
                        <button
                            type="button"
                            className="profile-edit-btn profile-edit-btn--primary"
                            onClick={() => void handleVerify()}
                            disabled={editState.busy || editState.otp.length !== 6}
                        >
                            {editState.busy ? "驗證中..." : "確認"}
                        </button>
                        <button type="button" className="profile-edit-btn" onClick={cancelEdit}>取消</button>
                    </div>
                </div>
            );
        }

        return null;
    };

    const SEPOLIA_ETHERSCAN = "https://sepolia.etherscan.io";

    return (
        <SiteLayout>
            <section className="page-section">
                <div className="page-heading">
                    <h1>會員資料</h1>
                    <p>以下資料來自 KYC 審核結果。</p>
                </div>

                {state.status === "loading" ? (
                    <div className="member-card">
                        <p className="profile-loading">讀取中...</p>
                    </div>
                ) : state.status === "error" ? (
                    <div className="member-card">
                        <p className="form-error">{state.message}</p>
                        <button type="button" className="inline-link-button" onClick={() => navigate("/login")}>
                            重新登入
                        </button>
                    </div>
                ) : (
                    <>
                        {/* ── 基本資料 ── */}
                        <div className="member-card profile-section">
                            <h2 className="profile-section-title">基本資料</h2>

                            <div className="member-row">
                                <span className="member-label">顯示名稱</span>
                                <span className="member-value">
                                    {state.profile.displayName || <em className="profile-empty">未填寫</em>}
                                </span>
                            </div>

                            {state.profile.idNumber && (
                                <div className="member-row">
                                    <span className="member-label">身分字號</span>
                                    <span className="member-value member-value--mono">{state.profile.idNumber}</span>
                                </div>
                            )}

                            {state.profile.gender && (
                                <div className="member-row">
                                    <span className="member-label">性別</span>
                                    <span className="member-value">{state.profile.gender}</span>
                                </div>
                            )}

                            {state.profile.birthDate && (
                                <div className="member-row">
                                    <span className="member-label">生日</span>
                                    <span className="member-value">{state.profile.birthDate}</span>
                                </div>
                            )}

                            <div className="member-row profile-row--editable">
                                <span className="member-label">Email</span>
                                <span className="member-value">
                                    {state.profile.email || <em className="profile-empty">未設定</em>}
                                </span>
                                <EditButton field="email" editing={editing} onStart={startEdit} />
                            </div>
                            {renderEditPanel("email")}

                            <div className="member-row profile-row--editable">
                                <span className="member-label">手機號碼</span>
                                <span className="member-value">
                                    {state.profile.phone || <em className="profile-empty">未設定</em>}
                                </span>
                                <EditButton field="phone" editing={editing} onStart={startEdit} />
                            </div>
                            {renderEditPanel("phone")}

                            {state.profile.registeredAddress && (
                                <div className="member-row">
                                    <span className="member-label">戶籍地址</span>
                                    <span className="member-value">{state.profile.registeredAddress}</span>
                                </div>
                            )}

                            <div className="member-row profile-row--editable">
                                <span className="member-label">通訊地址</span>
                                <span className="member-value">
                                    {state.profile.mailingAddress || <em className="profile-empty">未設定</em>}
                                </span>
                                <EditButton field="mailing" editing={editing} onStart={startEdit} />
                            </div>
                            {renderEditPanel("mailing")}

                            <div className="member-row">
                                <span className="member-label">加入時間</span>
                                <span className="member-value">{formatDate(state.profile.createdAt)}</span>
                            </div>
                        </div>

                        {/* ── 錢包資料 ── */}
                        <div className="member-card profile-section">
                            <h2 className="profile-section-title">錢包資料</h2>

                            <div className="member-row profile-row--wallet">
                                <span className="member-label">錢包地址</span>
                                <span className="member-value member-value--mono profile-wallet-addr">
                                    {state.profile.walletAddress}
                                </span>
                                <button
                                    type="button"
                                    className="profile-copy-btn"
                                    onClick={() => copyWallet(state.profile.walletAddress)}
                                >
                                    {copied ? "已複製" : "複製"}
                                </button>
                            </div>
                        </div>

                        {/* ── 身份驗證 ── */}
                        <div className="member-card profile-section">
                            <h2 className="profile-section-title">身份驗證（KYC）</h2>

                            <div className="member-row">
                                <span className="member-label">自然人 KYC</span>
                                <span className={KYC_STATUS_CLASS[state.profile.kycStatus] ?? "status-badge status-badge--gray"}>
                                    {KYC_STATUS_LABEL[state.profile.kycStatus] ?? state.profile.kycStatus}
                                </span>
                            </div>

                            <div className="member-row">
                                <span className="member-label">提交時間</span>
                                <span className="member-value">{formatDate(state.profile.kycSubmittedAt)}</span>
                            </div>

                            <div className="member-row">
                                <span className="member-label">驗證通過時間</span>
                                <span className="member-value">{formatDate(state.profile.kycVerifiedAt)}</span>
                            </div>

                            {state.profile.identityNftTokenId != null ? (
                                <div className="member-row">
                                    <span className="member-label">身份 NFT</span>
                                    <span className="member-value">Token #{state.profile.identityNftTokenId}</span>
                                </div>
                            ) : null}

                            {state.profile.kycMintTxHash ? (
                                <div className="member-row">
                                    <span className="member-label">Mint 交易</span>
                                    <a
                                        className="profile-tx-link"
                                        href={`${SEPOLIA_ETHERSCAN}/tx/${state.profile.kycMintTxHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {shortTx(state.profile.kycMintTxHash)}
                                    </a>
                                </div>
                            ) : null}
                        </div>

                        {/* ── 角色憑證 ── */}
                        <div className="member-card profile-section">
                            <h2 className="profile-section-title">角色憑證</h2>
                            {state.profile.credentials.length === 0 ? (
                                <p className="profile-empty">尚未持有角色憑證</p>
                            ) : (
                                <div className="profile-credential-list">
                                    {state.profile.credentials.map((c) => (
                                        <span key={c} className="profile-credential-badge">
                                            {CREDENTIAL_LABEL[c] ?? c}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </section>
        </SiteLayout>
    );
};

export default MemberProfilePage;
