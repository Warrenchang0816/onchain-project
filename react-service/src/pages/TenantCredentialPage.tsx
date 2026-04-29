import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    activateCredentialSubmission,
    createCredentialSubmission,
    getCredentialCenter,
    getLatestCredentialSubmission,
    uploadCredentialFiles,
    type CredentialCenterItem,
    type CredentialSubmissionDetail,
} from "@/api/credentialApi";
import { getUserProfile, type UserProfile } from "@/api/userApi";
import { CREDENTIAL_STATUS_LABEL } from "@/components/credential/credentialStatusLabels";
import CredentialDocumentUploader from "@/components/credential/CredentialDocumentUploader";
import SiteLayout from "@/layouts/SiteLayout";

const inputCls = "rounded-lg border-0 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary-container";

export default function TenantCredentialPage() {
    const [form, setForm] = useState({ occupationType: "", orgName: "", incomeRange: "" });
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [detail, setDetail] = useState<CredentialSubmissionDetail | null>(null);
    const [item, setItem] = useState<CredentialCenterItem | undefined>();
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const refresh = async () => {
        const [center, latest, userProfile] = await Promise.all([
            getCredentialCenter(),
            getLatestCredentialSubmission("TENANT"),
            getUserProfile(),
        ]);
        setItem(center.items.find((entry) => entry.credentialType === "TENANT"));
        setDetail(latest);
        setProfile(userProfile);
    };

    useEffect(() => {
        refresh()
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "讀取租客身分申請狀態失敗"))
            .finally(() => setLoading(false));
    }, []);

    const validate = (): string | null => {
        if (!form.occupationType.trim()) return "請填寫職業類型";
        if (!form.orgName.trim()) return "請填寫公司、學校或任職單位";
        if (!form.incomeRange.trim()) return "請填寫工作薪資或收入區間";
        return null;
    };

    const submit = async () => {
        const validationError = validate();
        if (validationError) {
            setError(validationError);
            setSuccess("");
            return;
        }

        setBusy(true);
        setError("");
        setSuccess("");
        try {
            const created = await createCredentialSubmission("TENANT", {
                route: "PROFILE",
                formPayload: {
                    occupationType: form.occupationType.trim(),
                    orgName: form.orgName.trim(),
                    incomeRange: form.incomeRange.trim(),
                    incomeProofAttached: proofFile ? "true" : "false",
                },
                notes: proofFile ? "已上傳完整證明" : "",
            });

            if (proofFile) {
                await uploadCredentialFiles("TENANT", created.submissionId, proofFile);
            }

            await activateCredentialSubmission("TENANT", created.submissionId);
            setSuccess("租客身分已送出並啟用 NFT 認證");
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "送出租客身分申請失敗");
        } finally {
            setBusy(false);
        }
    };

    const currentStatus = item ? CREDENTIAL_STATUS_LABEL[item.displayStatus] : "尚未申請";

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-6 py-12 md:px-12">
                <Link to="/member" className="text-sm text-on-surface-variant hover:text-primary-container">
                    返回身分中心
                </Link>

                <header className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8 md:p-10">
                    <div className="space-y-3">
                        <div className="inline-flex rounded-full border border-outline-variant/20 bg-surface-container-low px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                            Tenant Credential
                        </div>
                        <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">
                            租客身分申請
                        </h1>
                        <p className="max-w-3xl text-sm leading-[1.85] text-on-surface-variant">
                            租客身分不用智能審核。填寫工作薪資資料後確認送出，平台會直接啟用租客 NFT 認證；薪資證明或收入證明可選擇上傳。
                        </p>
                    </div>
                </header>

                {loading ? (
                    <div className="py-20 text-center text-sm text-on-surface-variant">讀取中...</div>
                ) : (
                    <section className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8">
                        <div className="mb-6 rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                            目前狀態：<strong className="text-on-surface">{currentStatus}</strong>
                            {detail?.activationTxHash ? <span className="ml-2">已啟用</span> : null}
                        </div>

                        <div className="mb-6 rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">KYC 姓名</div>
                            <div className="mt-2 text-sm font-bold text-on-surface">{profile?.displayName || "尚未取得 KYC 姓名"}</div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="flex flex-col gap-2 text-xs font-semibold text-on-surface-variant">
                                職業類型
                                <input className={inputCls} value={form.occupationType} onChange={(e) => setForm((current) => ({ ...current, occupationType: e.target.value }))} placeholder="例如：上班族、自由業、學生" />
                            </label>
                            <label className="flex flex-col gap-2 text-xs font-semibold text-on-surface-variant">
                                公司、學校或任職單位
                                <input className={inputCls} value={form.orgName} onChange={(e) => setForm((current) => ({ ...current, orgName: e.target.value }))} placeholder="請填寫目前主要任職或就學單位" />
                            </label>
                            <label className="flex flex-col gap-2 text-xs font-semibold text-on-surface-variant md:col-span-2">
                                工作薪資或收入區間
                                <input className={inputCls} value={form.incomeRange} onChange={(e) => setForm((current) => ({ ...current, incomeRange: e.target.value }))} placeholder="例如：每月固定薪資 60,000 元" />
                            </label>
                        </div>

                        <div className="mt-6">
                            <CredentialDocumentUploader
                                label="薪資證明或收入證明"
                                helperText="選填。若有上傳，送出時會標記為已上傳完整證明。"
                                file={proofFile}
                                onChange={(file) => {
                                    setProofFile(file);
                                    setError("");
                                }}
                            />
                            {proofFile ? <p className="mt-3 text-sm font-semibold text-tertiary">已上傳完整證明</p> : null}
                        </div>

                        {error ? <p className="mt-4 text-sm text-error">{error}</p> : null}
                        {success ? <p className="mt-4 text-sm text-tertiary">{success}</p> : null}

                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => void submit()}
                            className="mt-6 rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90 disabled:opacity-60"
                        >
                            {busy ? "處理中..." : "確認送出並啟用租客認證"}
                        </button>
                    </section>
                )}
            </main>
        </SiteLayout>
    );
}
