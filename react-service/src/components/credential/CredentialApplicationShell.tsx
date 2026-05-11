import { useState } from "react";
import type { FormEvent } from "react";
import type { CredentialCenterItem, CredentialSubmissionDetail, CredentialType } from "@/api/credentialApi";
import {
    activateCredentialSubmission,
    analyzeCredentialSubmission,
    createCredentialSubmission,
    getCredentialSubmissionFileUrl,
    requestManualCredentialReview,
    stopCredentialSubmission,
    uploadCredentialFiles,
} from "@/api/credentialApi";
import LoadingOverlay from "@/components/common/LoadingOverlay";
import CredentialConfirmDialog from "./CredentialConfirmDialog";
import CredentialDocumentUploader from "./CredentialDocumentUploader";
import CredentialStatusPanel from "./CredentialStatusPanel";
import CredentialSubmissionSnapshot from "./CredentialSubmissionSnapshot";
import { getSnapshotActionCopy, shouldRenderForm, shouldRenderSnapshot } from "./credentialViewState";

type FieldConfig = {
    key: string;
    label: string;
    placeholder: string;
};

type Props = {
    credentialType: CredentialType;
    title: string;
    description: string;
    primaryFields: FieldConfig[];
    kycDisplayName?: string;
    currentItem?: CredentialCenterItem;
    currentDetail?: CredentialSubmissionDetail;
    onRefresh: () => Promise<void>;
    declarations?: Array<{ key: string; text: string }>;
    mainDocRequired?: boolean;
};

type ConfirmAction = "SMART_SUBMIT" | "MANUAL_SUBMIT" | "STOP_REVIEW" | "ACTIVATE" | null;

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

export default function CredentialApplicationShell(props: Props) {
    const [formValues, setFormValues] = useState<Record<string, string>>({});
    const [notes, setNotes] = useState("");
    const [mainDoc, setMainDoc] = useState<File | null>(null);
    const [supportDoc, setSupportDoc] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [smartReviewing, setSmartReviewing] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
    const [forceEditMode, setForceEditMode] = useState(false);
    const [declarationValues, setDeclarationValues] = useState<Record<string, boolean>>({});

    const allDeclarationsChecked =
        !props.declarations ||
        props.declarations.length === 0 ||
        props.declarations.every((d) => declarationValues[d.key] === true);

    const detail = props.currentDetail;
    const currentStatus = detail?.displayStatus ?? props.currentItem?.displayStatus ?? "NOT_STARTED";
    const latestSubmissionId = detail?.submissionId ?? props.currentItem?.latestSubmissionId;
    const busy = submitting || smartReviewing;

    const snapshotMode = shouldRenderSnapshot(detail, forceEditMode);
    const formMode = shouldRenderForm(detail, forceEditMode);
    const canRetrySmart = Boolean(latestSubmissionId && props.currentItem?.canRetrySmart && currentStatus === "FAILED");
    const canRequestManual = Boolean(latestSubmissionId && props.currentItem?.canRequestManual && currentStatus === "FAILED");
    const snapshotActionCopy = getSnapshotActionCopy(currentStatus);

    const resetDraft = () => {
        setFormValues({});
        setNotes("");
        setMainDoc(null);
        setSupportDoc(null);
        setError("");
        setSuccess("");
    };

    const handleFieldChange = (key: string, value: string) => {
        setFormValues((current) => ({
            ...current,
            [key]: value,
        }));
        setError("");
    };

    const validateDraft = (): string | null => {
        for (const field of props.primaryFields) {
            if (!formValues[field.key]?.trim()) {
                return `請先填寫「${field.label}」`;
            }
        }
        if (!allDeclarationsChecked) {
            return "請確認並勾選所有物件聲明";
        }
        if ((props.mainDocRequired !== false) && !mainDoc) {
            return "請先上傳主要文件";
        }
        return null;
    };

    const openConfirm = (action: Exclude<ConfirmAction, "STOP_REVIEW" | "ACTIVATE" | null>) => {
        const validationError = validateDraft();
        if (validationError) {
            setError(validationError);
            setSuccess("");
            return;
        }

        setError("");
        setSuccess("");
        setConfirmAction(action);
    };

    const handleSmartSubmit = (event: FormEvent) => {
        event.preventDefault();
        openConfirm("SMART_SUBMIT");
    };

    const handleManualSubmitClick = () => {
        openConfirm("MANUAL_SUBMIT");
    };

    const doSmartSubmit = async () => {
        const validationError = validateDraft();
        if (validationError || ((props.mainDocRequired !== false) && !mainDoc)) {
            setError(validationError ?? "請先上傳主要文件");
            setSuccess("");
            setConfirmAction(null);
            return;
        }

        setSubmitting(true);
        setSmartReviewing(true);
        setError("");
        setSuccess("");

        try {
            const created = await createCredentialSubmission(props.credentialType, {
                route: "SMART",
                formPayload: formValues,
                notes,
            });

            await uploadCredentialFiles(props.credentialType, created.submissionId, mainDoc ?? undefined, supportDoc ?? undefined);
            await analyzeCredentialSubmission(props.credentialType, created.submissionId);

            setForceEditMode(false);
            setSuccess("智能審核已完成，請查看結果。");
            await props.onRefresh();
        } catch (submissionError) {
            setError(getErrorMessage(submissionError, "智能審核送出失敗"));
        } finally {
            setSmartReviewing(false);
            setSubmitting(false);
            setConfirmAction(null);
        }
    };

    const doManualSubmit = async () => {
        const validationError = validateDraft();
        if (validationError || ((props.mainDocRequired !== false) && !mainDoc)) {
            setError(validationError ?? "請先上傳主要文件");
            setSuccess("");
            setConfirmAction(null);
            return;
        }

        setSubmitting(true);
        setError("");
        setSuccess("");

        try {
            const created = await createCredentialSubmission(props.credentialType, {
                route: "MANUAL",
                formPayload: formValues,
                notes,
            });

            await uploadCredentialFiles(props.credentialType, created.submissionId, mainDoc ?? undefined, supportDoc ?? undefined);
            await requestManualCredentialReview(props.credentialType, created.submissionId);

            setForceEditMode(false);
            setSuccess("已送出人工審核，請等待審核結果。");
            await props.onRefresh();
        } catch (submissionError) {
            setError(getErrorMessage(submissionError, "人工審核送出失敗"));
        } finally {
            setSubmitting(false);
            setConfirmAction(null);
        }
    };

    const doStopReview = async () => {
        if (!detail) return;

        setSubmitting(true);
        setError("");
        setSuccess("");

        try {
            await stopCredentialSubmission(props.credentialType, detail.submissionId);
            setSuccess("已停止人工審核。");
            await props.onRefresh();
        } catch (submissionError) {
            setError(getErrorMessage(submissionError, "停止審核失敗"));
        } finally {
            setSubmitting(false);
            setConfirmAction(null);
        }
    };

    const doActivate = async () => {
        if (!detail) return;

        setSubmitting(true);
        setError("");
        setSuccess("");

        try {
            await activateCredentialSubmission(props.credentialType, detail.submissionId);
            setSuccess("身份已啟用，NFT 憑證已送出。");
            await props.onRefresh();
        } catch (submissionError) {
            setError(getErrorMessage(submissionError, "啟用身份失敗"));
        } finally {
            setSubmitting(false);
            setConfirmAction(null);
        }
    };

    const handleConfirm = async () => {
        if (confirmAction === "SMART_SUBMIT") {
            await doSmartSubmit();
            return;
        }
        if (confirmAction === "MANUAL_SUBMIT") {
            await doManualSubmit();
            return;
        }
        if (confirmAction === "STOP_REVIEW") {
            await doStopReview();
            return;
        }
        if (confirmAction === "ACTIVATE") {
            await doActivate();
        }
    };

    const handleRestart = () => {
        resetDraft();
        setForceEditMode(true);
        setSuccess("已開啟新的送審表單，請重新填寫資料與文件。");
    };

    const handleRetrySmart = async () => {
        if (!latestSubmissionId) return;

        setSubmitting(true);
        setSmartReviewing(true);
        setError("");
        setSuccess("");

        try {
            await analyzeCredentialSubmission(props.credentialType, latestSubmissionId);
            setSuccess("已重新完成智能審核，請查看結果。");
            await props.onRefresh();
        } catch (submissionError) {
            setError(getErrorMessage(submissionError, "重新智能審核失敗"));
        } finally {
            setSmartReviewing(false);
            setSubmitting(false);
        }
    };

    const handleSwitchToManual = async () => {
        if (!latestSubmissionId) return;

        setSubmitting(true);
        setError("");
        setSuccess("");

        try {
            await requestManualCredentialReview(props.credentialType, latestSubmissionId);
            setSuccess("已改送人工審核。");
            await props.onRefresh();
        } catch (submissionError) {
            setError(getErrorMessage(submissionError, "改送人工審核失敗"));
        } finally {
            setSubmitting(false);
        }
    };

    const dialogConfig: Record<NonNullable<ConfirmAction>, { title: string; description: string; confirmLabel: string }> = {
        SMART_SUBMIT: {
            title: "送出智能審核",
            description: "系統將依照你填寫的資料與上傳文件進行智能判定。送出後會立即開始處理，完成後再由你決定是否採用結果。",
            confirmLabel: "確認送出智能審核",
        },
        MANUAL_SUBMIT: {
            title: "送出人工審核",
            description: "送出後會進入人工審核流程，時間通常較長。審核期間你可以查看成品，也可以選擇停止審核。",
            confirmLabel: "確認送出人工審核",
        },
        STOP_REVIEW: {
            title: "停止人工審核",
            description: "停止後，本次人工審核會結束，狀態將改為「已停止審核」。若要再送件，需要重新開啟一份新的申請。",
            confirmLabel: "確認停止審核",
        },
        ACTIVATE: {
            title: "啟用身份 NFT",
            description: "啟用後會正式鑄造身份 NFT 憑證。完成後身份中心會顯示為已啟用，請確認你要現在啟用。",
            confirmLabel: "確認啟用身份",
        },
    };

    return (
        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-8">
            <LoadingOverlay isVisible={smartReviewing} message="智能審核中，請稍候..." />

            <section className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8 md:p-10">
                <div className="space-y-3">
                    <div className="inline-flex rounded-full border border-outline-variant/20 bg-surface-container-low px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                        {props.credentialType} Credential
                    </div>
                    <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">
                        {props.title}
                    </h1>
                    <p className="max-w-3xl text-sm leading-[1.85] text-on-surface-variant">{props.description}</p>
                </div>
            </section>

            <CredentialStatusPanel item={props.currentItem} />

            {error ? (
                <div className="rounded-2xl border border-error/20 bg-error-container px-5 py-4 text-sm text-on-error-container">
                    {error}
                </div>
            ) : null}

            {success ? (
                <div className="rounded-2xl border border-tertiary/20 bg-tertiary/10 px-5 py-4 text-sm text-tertiary">
                    {success}
                </div>
            ) : null}

            {snapshotMode && detail ? (
                <>
                    <CredentialSubmissionSnapshot
                        fields={props.primaryFields.map((field) => ({ key: field.key, label: field.label }))}
                        values={detail.formPayload}
                        notes={detail.notes}
                        checks={detail.checks}
                        mainFileUrl={
                            detail.mainFileUrl
                                ? getCredentialSubmissionFileUrl(props.credentialType, detail.submissionId, "main")
                                : undefined
                        }
                        supportFileUrl={
                            detail.supportFileUrl
                                ? getCredentialSubmissionFileUrl(props.credentialType, detail.submissionId, "support")
                                : undefined
                        }
                    />

                    <section className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <h2 className="text-2xl font-bold text-on-surface">{snapshotActionCopy.title}</h2>
                                <p className="text-sm leading-[1.8] text-on-surface-variant">{snapshotActionCopy.description}</p>
                            </div>

                            <div className="space-y-3">
                                {detail.canActivate ? (
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => setConfirmAction("ACTIVATE")}
                                        className="w-full rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {busy ? "處理中..." : "確認啟用身份"}
                                    </button>
                                ) : null}

                                {canRetrySmart ? (
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={handleRetrySmart}
                                        className="w-full rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {busy ? "處理中..." : "重新跑智能審核"}
                                    </button>
                                ) : null}

                                {canRequestManual ? (
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={handleSwitchToManual}
                                        className="w-full rounded-xl border border-outline-variant/20 bg-surface-container px-5 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        改送人工審核
                                    </button>
                                ) : null}

                                {detail.canStopReview ? (
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => setConfirmAction("STOP_REVIEW")}
                                        className="w-full rounded-xl border border-outline-variant/20 bg-surface-container px-5 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {busy ? "處理中..." : "停止審核"}
                                    </button>
                                ) : null}

                                {detail.canRestartReview ? (
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={handleRestart}
                                        className="w-full rounded-xl border border-outline-variant/20 bg-surface-container px-5 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        重新審核
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    </section>
                </>
            ) : null}

            {formMode ? (
                <section className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <form onSubmit={handleSmartSubmit} className="space-y-6">
                        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">KYC 姓名</div>
                            <div className="mt-2 text-sm font-bold text-on-surface">{props.kycDisplayName?.trim() || "尚未取得 KYC 姓名"}</div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            {props.primaryFields.map((field) => (
                                <label key={field.key} className="space-y-2">
                                    <span className="text-sm font-semibold text-on-surface">{field.label}</span>
                                    <input
                                        value={formValues[field.key] ?? ""}
                                        onChange={(event) => handleFieldChange(field.key, event.target.value)}
                                        placeholder={field.placeholder}
                                        className="w-full rounded-xl border border-outline-variant/15 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-colors focus:border-primary-container"
                                    />
                                </label>
                            ))}
                        </div>

                        {props.declarations && props.declarations.length > 0 ? (
                            <div className="space-y-3 rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5">
                                <p className="text-sm font-bold text-on-surface">物件聲明（必填）</p>
                                <p className="text-xs text-on-surface-variant">以下三項均需勾選方可提交申請</p>
                                <div className="space-y-2">
                                    {props.declarations.map((d) => (
                                        <label key={d.key} className="flex cursor-pointer items-start gap-3">
                                            <input
                                                type="checkbox"
                                                checked={declarationValues[d.key] ?? false}
                                                onChange={(e) =>
                                                    setDeclarationValues((prev) => ({ ...prev, [d.key]: e.target.checked }))
                                                }
                                                className="mt-0.5 h-4 w-4 accent-primary-container"
                                            />
                                            <span className="text-sm text-on-surface">{d.text}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        <CredentialDocumentUploader
                            label={props.mainDocRequired !== false ? "主要文件" : "附件（選填）"}
                            helperText={
                                props.mainDocRequired !== false
                                    ? "請上傳本次身份申請最主要的證明文件。"
                                    : "可上傳權狀或所有權證明；上傳後可送出智能審核比對物件資料。"
                            }
                            file={mainDoc}
                            onChange={(file) => {
                                setMainDoc(file);
                                setError("");
                            }}
                            required={props.mainDocRequired !== false}
                        />

                        <CredentialDocumentUploader
                            label="補充文件"
                            helperText="如有補充證明、來源資料或補件說明，可一併附上。"
                            file={supportDoc}
                            onChange={(file) => {
                                setSupportDoc(file);
                                setError("");
                            }}
                        />

                        <label className="space-y-2">
                            <span className="text-sm font-semibold text-on-surface">審核備註（選填）</span>
                            <textarea
                                value={notes}
                                onChange={(event) => {
                                    setNotes(event.target.value);
                                    setError("");
                                }}
                                placeholder="主要補充資料請用上方補充文件上傳；這裡只填人工審核需要看的備註。"
                                rows={5}
                                className="w-full rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-colors focus:border-primary-container"
                            />
                        </label>

                        <div className="space-y-4">
                            <button
                                type="submit"
                                disabled={busy}
                                className="w-full rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {busy ? "處理中..." : "送出智能審核"}
                            </button>

                            <div className="flex justify-end">
                                <p className="text-right text-sm leading-[1.8] text-on-surface-variant">
                                    可以選擇
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={handleManualSubmitClick}
                                        className="mx-1 rounded-none bg-transparent p-0 font-semibold text-on-surface underline underline-offset-4 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        [人工審核]
                                    </button>
                                    ，將會耗時較久
                                </p>
                            </div>
                        </div>
                    </form>
                </section>
            ) : null}

            {confirmAction ? (
                <CredentialConfirmDialog
                    open={Boolean(confirmAction)}
                    title={dialogConfig[confirmAction].title}
                    description={dialogConfig[confirmAction].description}
                    confirmLabel={dialogConfig[confirmAction].confirmLabel}
                    onConfirm={() => void handleConfirm()}
                    onCancel={() => setConfirmAction(null)}
                    busy={busy}
                />
            ) : null}
        </div>
    );
}
