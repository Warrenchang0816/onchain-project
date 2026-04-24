import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    activateCredentialSubmission,
    createCredentialSubmission,
    getCredentialCenter,
    getLatestCredentialSubmission,
    type CredentialCenterItem,
    type CredentialSubmissionDetail,
} from "@/api/credentialApi";
import { CREDENTIAL_STATUS_LABEL } from "@/components/credential/credentialStatusLabels";
import SiteLayout from "@/layouts/SiteLayout";

const inputCls = "rounded-lg border-0 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary-container";

export default function TenantCredentialPage() {
    const [form, setForm] = useState({ holderName: "", occupationType: "", orgName: "", incomeRange: "", notes: "" });
    const [detail, setDetail] = useState<CredentialSubmissionDetail | null>(null);
    const [item, setItem] = useState<CredentialCenterItem | undefined>();
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const refresh = async () => {
        const [center, latest] = await Promise.all([getCredentialCenter(), getLatestCredentialSubmission("TENANT")]);
        setItem(center.items.find((entry) => entry.credentialType === "TENANT"));
        setDetail(latest);
    };

    useEffect(() => {
        refresh()
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "讀取租客申請狀態失敗。"))
            .finally(() => setLoading(false));
    }, []);

    const submit = async () => {
        setBusy(true);
        setError("");
        try {
            await createCredentialSubmission("TENANT", {
                route: "PROFILE",
                formPayload: {
                    holderName: form.holderName,
                    occupationType: form.occupationType,
                    orgName: form.orgName,
                    incomeRange: form.incomeRange,
                },
                notes: form.notes,
            });
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "送出租客身份申請失敗。");
        } finally {
            setBusy(false);
        }
    };

    const activate = async () => {
        if (!detail) return;
        setBusy(true);
        setError("");
        try {
            await activateCredentialSubmission("TENANT", detail.submissionId);
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "啟用租客身份失敗。");
        } finally {
            setBusy(false);
        }
    };

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-6 py-12 md:px-12">
                <Link to="/member" className="text-sm text-on-surface-variant hover:text-primary-container">返回身份中心</Link>
                <header className="space-y-3">
                    <h1 className="text-4xl font-extrabold text-on-surface">租客身份申請</h1>
                    <p className="text-sm leading-[1.8] text-on-surface-variant">
                        租客身份採用輕量資料申請，不需要 OCR 文件流程。平台只記錄你自行填寫的基本資訊，後續租客資料完整度可在身份中心另外補強。
                    </p>
                </header>

                {loading ? (
                    <div className="py-20 text-center text-sm text-on-surface-variant">讀取中...</div>
                ) : (
                    <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
                        <div className="mb-6 rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                            目前狀態：<strong className="text-on-surface">{item ? CREDENTIAL_STATUS_LABEL[item.displayStatus] : "尚未申請"}</strong>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <input className={inputCls} value={form.holderName} onChange={(e) => setForm((current) => ({ ...current, holderName: e.target.value }))} placeholder="申請人姓名" />
                            <input className={inputCls} value={form.occupationType} onChange={(e) => setForm((current) => ({ ...current, occupationType: e.target.value }))} placeholder="職業類型" />
                            <input className={inputCls} value={form.orgName} onChange={(e) => setForm((current) => ({ ...current, orgName: e.target.value }))} placeholder="公司、學校或任職單位" />
                            <input className={inputCls} value={form.incomeRange} onChange={(e) => setForm((current) => ({ ...current, incomeRange: e.target.value }))} placeholder="收入區間" />
                            <textarea className={`${inputCls} md:col-span-2`} rows={4} value={form.notes} onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))} placeholder="補充說明" />
                        </div>

                        {error ? <p className="mt-4 text-sm text-error">{error}</p> : null}

                        <div className="mt-6 flex flex-wrap gap-3">
                            <button type="button" disabled={busy} onClick={() => void submit()} className="rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container disabled:opacity-60">
                                {busy ? "處理中..." : "送出申請"}
                            </button>
                            {item?.displayStatus === "PASSED_READY" && detail ? (
                                <button type="button" disabled={busy} onClick={() => void activate()} className="rounded-xl border border-outline-variant/25 bg-surface-container-low px-5 py-3 text-sm font-bold text-on-surface disabled:opacity-60">
                                    啟用租客身份 NFT
                                </button>
                            ) : null}
                        </div>
                    </section>
                )}
            </main>
        </SiteLayout>
    );
}
