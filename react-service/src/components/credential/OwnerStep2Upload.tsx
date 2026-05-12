import { useState } from "react";
import {
    analyzeCredentialSubmission,
    requestManualCredentialReview,
    uploadCredentialFiles,
} from "@/api/credentialApi";
import CredentialDocumentUploader from "./CredentialDocumentUploader";

type Props = {
    submissionId: number;
    onDone: () => void;
};

export default function OwnerStep2Upload(props: Props) {
    const [mainDoc, setMainDoc] = useState<File | null>(null);
    const [supportDoc, setSupportDoc] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const canSubmit = mainDoc !== null && !submitting;

    const handleSmartReview = async () => {
        if (!mainDoc) return;
        setSubmitting(true);
        setError("");
        setSuccess("");
        try {
            await uploadCredentialFiles("OWNER", props.submissionId, mainDoc, supportDoc ?? undefined);
            await analyzeCredentialSubmission("OWNER", props.submissionId);
            setSuccess("智能審核已完成，請查看結果。物件已建立成功。");
        } catch (e) {
            setError(e instanceof Error ? e.message : "送出失敗，請重試");
        } finally {
            setSubmitting(false);
        }
    };

    const handleManualReview = async () => {
        if (!mainDoc) return;
        setSubmitting(true);
        setError("");
        setSuccess("");
        try {
            await uploadCredentialFiles("OWNER", props.submissionId, mainDoc, supportDoc ?? undefined);
            await requestManualCredentialReview("OWNER", props.submissionId);
            setSuccess("已送出人工審核，物件已建立成功。");
        } catch (e) {
            setError(e instanceof Error ? e.message : "送出失敗，請重試");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <section className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8">
                <h2 className="text-2xl font-bold text-on-surface mb-2">提供證明文件（選填）</h2>
                <p className="text-sm leading-[1.8] text-on-surface-variant">
                    上傳權狀或所有權證明，可提升物件可信度。上傳後送出智能審核，系統將比對附件內容與填寫的物件資料。
                </p>
            </section>

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

            <section className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8 space-y-4">
                <CredentialDocumentUploader
                    label="附件（選填）"
                    helperText="可上傳權狀或所有權證明；上傳後可送出智能審核比對物件資料。"
                    file={mainDoc}
                    onChange={(file) => { setMainDoc(file); setError(""); }}
                />
                <CredentialDocumentUploader
                    label="補充文件（選填）"
                    helperText="如有補充證明、來源資料或補件說明，可一併附上。"
                    file={supportDoc}
                    onChange={(file) => { setSupportDoc(file); setError(""); }}
                />

                <div className="space-y-4 pt-2">
                    <button
                        type="button"
                        onClick={() => void handleSmartReview()}
                        disabled={!canSubmit}
                        className="w-full rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {submitting ? "處理中..." : "送出智能審核"}
                    </button>

                    <div className="flex justify-end">
                        <p className="text-right text-sm leading-[1.8] text-on-surface-variant">
                            可以選擇
                            <button
                                type="button"
                                disabled={!canSubmit}
                                onClick={() => void handleManualReview()}
                                className="mx-1 rounded-none bg-surface-container-lowest p-0 font-semibold text-on-surface underline underline-offset-4 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                [人工審核]
                            </button>
                            ，將會耗時較久
                        </p>
                    </div>
                </div>
            </section>

            <button
                type="button"
                onClick={props.onDone}
                disabled={submitting}
                className="w-full rounded-xl border border-outline-variant/20 bg-surface-container px-5 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
            >
                稍後再說，前往我的物件
            </button>
        </div>
    );
}
