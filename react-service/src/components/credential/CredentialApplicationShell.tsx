import { useState } from "react";
import type { FormEvent } from "react";
import type { CredentialCenterItem, CredentialSubmissionDetail, CredentialType } from "@/api/credentialApi";
import {
    activateCredentialSubmission,
    analyzeCredentialSubmission,
    createCredentialSubmission,
    requestManualCredentialReview,
    stopCredentialSubmission,
    uploadCredentialFiles,
    getCredentialSubmissionFileUrl,
} from "@/api/credentialApi";
import CredentialDocumentUploader from "./CredentialDocumentUploader";
import CredentialStatusPanel from "./CredentialStatusPanel";
import CredentialConfirmDialog from "./CredentialConfirmDialog";
import CredentialSubmissionSnapshot from "./CredentialSubmissionSnapshot";

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
    currentItem?: CredentialCenterItem;
    currentDetail?: CredentialSubmissionDetail;
    onRefresh: () => Promise<void>;
};

type ConfirmAction = "SMART_SUBMIT" | "MANUAL_SUBMIT" | "STOP_REVIEW" | "ACTIVATE" | null;

export default function CredentialApplicationShell(props: Props) {
    const [formValues, setFormValues] = useState<Record<string, string>>({});
    const [notes, setNotes] = useState("");
    const [mainDoc, setMainDoc] = useState<File | null>(null);
    const [supportDoc, setSupportDoc] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
    const [forceEditMode, setForceEditMode] = useState(false);

    const detail = props.currentDetail;
    const status = props.currentItem?.displayStatus;
    const latestSubmissionId = props.currentItem?.latestSubmissionId;

    const snapshotMode =
        !forceEditMode &&
        Boolean(detail && detail.displayStatus !== "NOT_STARTED" && detail.displayStatus !== "SMART_REVIEWING");

    const resetDraft = () => {
        setFormValues({});
        setNotes("");
        setMainDoc(null);
        setSupportDoc(null);
        setError("");
        setSuccess("");
    };

    const ensureMainDoc = (): File => {
        if (!mainDoc) {
            throw new Error("請先上傳主要文件");
        }
        return mainDoc;
    };

    const handleSmartSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setConfirmAction("SMART_SUBMIT");
    };

    const handleManualSubmitClick = () => {
        setConfirmAction("MANUAL_SUBMIT");
    };

    const doSmartSubmit = async () => {
        setSubmitting(true);
        setError("");
        setSuccess("");
        try {
            const created = await createCredentialSubmission(props.credentialType, {
                route: "SMART",
                formPayload: formValues,
                notes,
            });
            await uploadCredentialFiles(props.credentialType, created.submissionId, ensureMainDoc(), supportDoc ?? undefined);
            await analyzeCredentialSubmission(props.credentialType, created.submissionId);
            setSuccess("智能審核結果已更新。");
            setForceEditMode(false);
            await props.onRefresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "智能審核失敗");
        } finally {
            setSubmitting(false);
            setConfirmAction(null);
        }
    };

    const doManualSubmit = async () => {
        setSubmitting(true);
        setError("");
        setSuccess("");
        try {
            const created = await createCredentialSubmission(props.credentialType, {
                route: "MANUAL",
                formPayload: formValues,
                notes,
            });
            await uploadCredentialFiles(props.credentialType, created.submissionId, ensureMainDoc(), supportDoc ?? undefined);
            await requestManualCredentialReview(props.credentialType, created.submissionId);
            setSuccess("案件已送交人工審核。");
            setForceEditMode(false);
            await props.onRefresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "人工審核送件失敗");
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
            setSuccess("人工審核已停止。");
            await props.onRefresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "停止審核失敗");
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
            setSuccess("身份 NFT 憑證已啟用。");
            await props.onRefresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "啟用失敗");
        } finally {
            setSubmitting(false);
            setConfirmAction(null);
        }
    };

    const handleConfirm = async () => {
        if (confirmAction === "SMART_SUBMIT") await doSmartSubmit();
        else if (confirmAction === "MANUAL_SUBMIT") await doManualSubmit();
        else if (confirmAction === "STOP_REVIEW") await doStopReview();
        else if (confirmAction === "ACTIVATE") await doActivate();
    };

    const handleRestart = () => {
        resetDraft();
        setForceEditMode(true);
    };

    // Legacy handlers for FAILED status (retry smart / switch to manual using existing submissionId)
    const handleRetrySmart = async () => {
        if (!latestSubmissionId) return;
        setSubmitting(true);
        setError("");
        setSuccess("");
        try {
            await analyzeCredentialSubmission(props.credentialType, latestSubmissionId);
            setSuccess("已重新執行智能審核。");
            await props.onRefresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "重新執行智能審核失敗");
        } finally {
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
            setSuccess("案件已改送人工審核。");
            await props.onRefresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "改送人工審核失敗");
        } finally {
            setSubmitting(false);
        }
    };

    const canActivateLegacy = Boolean(latestSubmissionId && props.currentItem?.canActivate);
    const canRetrySmart = props.currentItem ? props.currentItem.canRetrySmart : true;
    const canRequestManual = props.currentItem ? props.currentItem.canRequestManual : true;
    const hideForm =
        status === "ACTIVATED" ||
        status === "MANUAL_REVIEWING" ||
        status === "SMART_REVIEWING" ||
        status === "PASSED_READY" ||
        status === "FAILED";

    const dialogConfig: Record<NonNullable<ConfirmAction>, { title: string; description: string; confirmLabel: string }> = {
        SMART_SUBMIT: {
            title: "送出智能審核",
            description: "確認後系統將上傳文件並執行智能審核，結果出來後你可以決定是否採用。",
            confirmLabel: "送出智能審核",
        },
        MANUAL_SUBMIT: {
            title: "送出人工審核",
            description: "確認後將送交人工審核，審核人員會在一段時間後回覆結果，耗時較久。",
            confirmLabel: "送出人工審核",
        },
        STOP_REVIEW: {
            title: "停止人工審核",
            description: "確認後此次人工審核將被停止。如需繼續，需重新發起一筆新的申請。",
            confirmLabel: "確認停止",
        },
        ACTIVATE: {
            title: "啟用身份 NFT",
            description: "確認後系統將為你鑄造對應的身份 NFT 憑證，此動作無法還原。",
            confirmLabel: "確認啟用",
        },
    };

    return (
        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-8">
            {/* Header */}
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

            {/* Snapshot mode */}
            {snapshotMode && detail ? (
                <>
                    <CredentialSubmissionSnapshot
                        fields={props.primaryFields.map((f) => ({ key: f.key, label: f.label }))}
                        values={detail.formPayload}
                        notes={detail.notes}
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
                        <div className="space-y-3">
                            {detail.canActivate ? (
                                <button
                                    type="button"
                                    disabled={submitting}
                                    onClick={() => setConfirmAction("ACTIVATE")}
                                    className="w-full rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {submitting ? "處理中..." : "啟用身份 NFT"}
                                </button>
                            ) : null}
                            {detail.canStopReview ? (
                                <button
                                    type="button"
                                    disabled={submitting}
                                    onClick={() => setConfirmAction("STOP_REVIEW")}
                                    className="w-full rounded-xl border border-outline-variant/20 bg-surface-container px-5 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {submitting ? "處理中..." : "停止審核"}
                                </button>
                            ) : null}
                            {detail.canRestartReview ? (
                                <button
                                    type="button"
                                    disabled={submitting}
                                    onClick={handleRestart}
                                    className="w-full rounded-xl border border-outline-variant/20 bg-surface-container px-5 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    重新審核
                                </button>
                            ) : null}
                        </div>
                    </section>
                </>
            ) : null}

            {/* SMART_REVIEWING waiting message */}
            {!snapshotMode && status === "SMART_REVIEWING" ? (
                <section className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8 text-sm leading-[1.8] text-on-surface-variant">
                    智能審核已建立，請先等待結果回寫。結果出來後，你可以決定是否採用結果，或在未通過時改送人工審核。
                </section>
            ) : null}

            {/* Legacy: activate button when not in snapshot mode */}
            {!snapshotMode && canActivateLegacy ? (
                <section className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold text-on-surface">是否啟用身份 NFT</h2>
                        <p className="text-sm leading-[1.8] text-on-surface-variant">
                            此次審核結果已通過，但是否採用結果由你自行決定。點擊啟用後，系統才會為你鑄造對應的身份 NFT 憑證。
                        </p>
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={() => setConfirmAction("ACTIVATE")}
                            className="w-full rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {submitting ? "啟用中..." : "啟用 NFT 憑證"}
                        </button>
                    </div>
                </section>
            ) : null}

            {/* Legacy: FAILED retry section (non-snapshot mode) */}
            {!snapshotMode && status === "FAILED" && latestSubmissionId ? (
                <section className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold text-on-surface">重新處理本次申請</h2>
                        <p className="text-sm leading-[1.8] text-on-surface-variant">
                            這筆申請目前未通過。你可以直接重新跑一次智能審核，或改送人工審核，系統會沿用這筆申請已上傳的資料。
                        </p>
                        <div className="space-y-3">
                            {canRetrySmart ? (
                                <button
                                    type="button"
                                    disabled={submitting}
                                    onClick={handleRetrySmart}
                                    className="w-full rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {submitting ? "處理中..." : "重新跑智能審核"}
                                </button>
                            ) : null}
                            {canRequestManual ? (
                                <button
                                    type="button"
                                    disabled={submitting}
                                    onClick={handleSwitchToManual}
                                    className="w-full rounded-xl border border-outline-variant/20 bg-surface-container px-5 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    改送人工審核
                                </button>
                            ) : null}
                        </div>
                    </div>
                </section>
            ) : null}

            {/* Edit mode form */}
            {!snapshotMode && !hideForm ? (
                <section className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <form onSubmit={handleSmartSubmit} className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-2">
                            {props.primaryFields.map((field) => (
                                <label key={field.key} className="space-y-2">
                                    <span className="text-sm font-semibold text-on-surface">{field.label}</span>
                                    <input
                                        value={formValues[field.key] ?? ""}
                                        onChange={(event) =>
                                            setFormValues((current) => ({
                                                ...current,
                                                [field.key]: event.target.value,
                                            }))
                                        }
                                        placeholder={field.placeholder}
                                        className="w-full rounded-xl border border-outline-variant/15 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-colors focus:border-primary-container"
                                    />
                                </label>
                            ))}
                        </div>

                        <CredentialDocumentUploader
                            label="主要文件"
                            helperText="請上傳本次身份申請最主要的證明文件。"
                            file={mainDoc}
                            onChange={setMainDoc}
                            required
                        />

                        <CredentialDocumentUploader
                            label="輔助文件"
                            helperText="若你有補充資料，可一起上傳讓審核依據更完整。"
                            file={supportDoc}
                            onChange={setSupportDoc}
                        />

                        <label className="space-y-2">
                            <span className="text-sm font-semibold text-on-surface">補充說明</span>
                            <textarea
                                value={notes}
                                onChange={(event) => setNotes(event.target.value)}
                                placeholder="如有需要，可補充說明文件來源、身份情境或人工審核重點。"
                                rows={5}
                                className="w-full rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-colors focus:border-primary-container"
                            />
                        </label>

                        <div className="space-y-3">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {submitting ? "送出中..." : "送出智能審核"}
                            </button>
                            <p className="text-right text-sm leading-[1.8] text-on-surface-variant">
                                可以選擇
                                <button
                                    type="button"
                                    onClick={handleManualSubmitClick}
                                    className="mx-1 font-semibold text-on-surface underline underline-offset-4"
                                >
                                    人工審核
                                </button>
                                ，將會耗時較久
                            </p>
                        </div>
                    </form>
                </section>
            ) : null}

            {/* MANUAL_REVIEWING waiting message (non-snapshot) */}
            {!snapshotMode && status === "MANUAL_REVIEWING" ? (
                <section className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8 text-sm leading-[1.8] text-on-surface-variant">
                    你的案件目前正在人工審核中，這段期間不需要重複送件。若後續未通過，可再重新跑一次智能審核或改送人工審核。
                </section>
            ) : null}

            {/* Confirm dialog */}
            {confirmAction ? (
                <CredentialConfirmDialog
                    open={Boolean(confirmAction)}
                    title={dialogConfig[confirmAction].title}
                    description={dialogConfig[confirmAction].description}
                    confirmLabel={dialogConfig[confirmAction].confirmLabel}
                    onConfirm={() => void handleConfirm()}
                    onCancel={() => setConfirmAction(null)}
                    busy={submitting}
                />
            ) : null}
        </div>
    );
}
