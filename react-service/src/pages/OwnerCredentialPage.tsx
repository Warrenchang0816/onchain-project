import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import SiteLayout from "@/layouts/SiteLayout";
import { getAuthMe } from "@/api/authApi";
import { getCredentialCenter, createCredentialSubmission, activateCredentialSubmission } from "@/api/credentialApi";
import { createProperty, updateProperty } from "@/api/propertyApi";
import { parsePropertyFields } from "@/components/credential/ownerFieldParsers";
import OwnerStep1Form from "@/components/credential/OwnerStep1Form";
import OwnerStep2Upload from "@/components/credential/OwnerStep2Upload";

const DRAFT_KEY = "owner_credential_draft_v1";

type DraftData = {
    fields: Record<string, string>;
    declarations: Record<string, boolean>;
};

function readDraft(): DraftData | null {
    try {
        const raw = localStorage.getItem(DRAFT_KEY);
        return raw ? (JSON.parse(raw) as DraftData) : null;
    } catch {
        return null;
    }
}

export default function OwnerCredentialPage() {
    const navigate = useNavigate();

    const [pageLoading, setPageLoading] = useState(true);
    const [authed, setAuthed] = useState(false);
    const [kycOk, setKycOk] = useState(false);
    const [alreadyOwner, setAlreadyOwner] = useState(false);

    const [step, setStep] = useState<1 | 2>(1);
    const [submissionId, setSubmissionId] = useState<number | null>(null);

    const draft = readDraft();
    const [fields, setFields] = useState<Record<string, string>>(draft?.fields ?? {});
    const [declarations, setDeclarations] = useState<Record<string, boolean>>(draft?.declarations ?? {});

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [showPostCompleteDialog, setShowPostCompleteDialog] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const [auth, center] = await Promise.all([getAuthMe(), getCredentialCenter()]);
                if (cancelled) return;
                if (!auth.authenticated) {
                    setAuthed(false);
                    setKycOk(false);
                    setPageLoading(false);
                    return;
                }
                const isVerified = center.kycStatus === "VERIFIED";
                const ownerItem = center.items.find((i) => i.credentialType === "OWNER");
                const activated = ownerItem?.displayStatus === "ACTIVATED";
                setAuthed(true);
                setKycOk(isVerified);
                setAlreadyOwner(activated);
            } catch {
                setAuthed(false);
                setKycOk(false);
            } finally {
                if (!cancelled) setPageLoading(false);
            }
        };
        void load();
        return () => { cancelled = true; };
    }, []);

    const doComplete = async () => {
        setSubmitting(true);
        setError("");
        try {
            const { id: propId } = await createProperty({
                title: fields.propertyAddress ?? "未命名物件",
                address: fields.propertyAddress ?? "",
            });
            await updateProperty(propId, parsePropertyFields(fields));

            const { submissionId: subId } = await createCredentialSubmission("OWNER", {
                route: "DECLARATIONS",
                formPayload: fields,
                notes: "",
            });
            await activateCredentialSubmission("OWNER", subId);

            localStorage.removeItem(DRAFT_KEY);
            setSubmissionId(subId);
            setShowPostCompleteDialog(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : "建立失敗，請重試");
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveDraft = () => {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ fields, declarations }));
        navigate("/member");
    };

    const handleDeleteDraft = () => {
        localStorage.removeItem(DRAFT_KEY);
        navigate("/member");
    };

    if (pageLoading) {
        return (
            <SiteLayout>
                <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-8 px-6 py-12 md:px-12 md:py-16">
                    <div className="text-sm text-on-surface-variant">載入中…</div>
                </main>
            </SiteLayout>
        );
    }

    if (!authed || !kycOk) {
        return (
            <SiteLayout>
                <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-8 px-6 py-12 md:px-12 md:py-16">
                    <Link to="/member" className="text-sm text-on-surface-variant hover:text-primary-container">
                        返回身份中心
                    </Link>
                    <p className="text-sm text-on-surface-variant">請先完成 KYC 身份驗證才能申請角色憑證。</p>
                </main>
            </SiteLayout>
        );
    }

    if (alreadyOwner) {
        return (
            <SiteLayout>
                <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-8 px-6 py-12 md:px-12 md:py-16">
                    <Link to="/member" className="text-sm text-on-surface-variant hover:text-primary-container">
                        返回身份中心
                    </Link>
                    <p className="text-sm text-on-surface-variant">
                        你已擁有屋主身份。
                        <button
                            type="button"
                            onClick={() => navigate("/my/properties")}
                            className="ml-1 bg-surface-container-lowest text-primary-container underline underline-offset-4"
                        >
                            前往我的物件
                        </button>
                    </p>
                </main>
            </SiteLayout>
        );
    }

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-8 px-6 py-12 md:px-12 md:py-16">
                <Link to="/member" className="text-sm text-on-surface-variant transition-colors hover:text-primary-container">
                    返回身份中心
                </Link>

                {step === 1 && (
                    <OwnerStep1Form
                        fields={fields}
                        declarations={declarations}
                        onFieldChange={(key, value) => { setFields((prev) => ({ ...prev, [key]: value })); setError(""); }}
                        onDeclarationChange={(key, checked) => setDeclarations((prev) => ({ ...prev, [key]: checked }))}
                        onComplete={() => void doComplete()}
                        onCancel={() => setShowCancelDialog(true)}
                        submitting={submitting}
                        error={error}
                    />
                )}

                {step === 2 && submissionId !== null && (
                    <OwnerStep2Upload
                        submissionId={submissionId}
                        onDone={() => navigate("/my/properties")}
                    />
                )}

                {/* Cancel Dialog */}
                {showCancelDialog && step === 1 && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                        <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-8 shadow-xl">
                            <h3 className="text-lg font-bold text-on-surface">確定要取消嗎？</h3>
                            <p className="mt-2 text-sm leading-[1.8] text-on-surface-variant">
                                目前填寫的資料尚未提交。你可以選擇保留草稿，下次進入頁面時自動帶回。
                            </p>
                            <div className="mt-6 flex flex-col gap-3">
                                <button
                                    type="button"
                                    onClick={handleSaveDraft}
                                    className="w-full rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90"
                                >
                                    保留草稿，返回身份中心
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDeleteDraft}
                                    className="w-full rounded-xl border border-outline-variant/20 bg-surface-container px-5 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface"
                                >
                                    刪除草稿，返回身份中心
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowCancelDialog(false)}
                                    className="w-full rounded-xl bg-surface px-5 py-3 text-sm font-medium text-on-surface-variant transition-opacity hover:opacity-80"
                                >
                                    繼續填寫
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Post Complete Dialog */}
                {showPostCompleteDialog && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                        <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-8 shadow-xl">
                            <h3 className="text-lg font-bold text-on-surface">物件已建立，身份已啟用！</h3>
                            <p className="mt-2 text-sm leading-[1.8] text-on-surface-variant">
                                是否現在提供證明文件？上傳權狀或所有權證明可提升物件可信度（選填）。
                            </p>
                            <div className="mt-6 flex flex-col gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowPostCompleteDialog(false);
                                        setStep(2);
                                    }}
                                    className="w-full rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90"
                                >
                                    現在提供
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate("/my/properties")}
                                    className="w-full rounded-xl border border-outline-variant/20 bg-surface-container px-5 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface"
                                >
                                    稍後再說，前往我的物件
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </SiteLayout>
    );
}
