import { useEffect, useState } from "react";
import {
    getMyTenantProfile,
    updateMyTenantProfile,
    uploadMyTenantDocument,
    type TenantDocumentType,
    type TenantProfile,
    type TenantProfilePayload,
} from "@/api/tenantApi";
import SiteLayout from "@/layouts/SiteLayout";

const emptyProfile: TenantProfilePayload = {
    occupationType: "",
    orgName: "",
    incomeRange: "",
    householdSize: 0,
    coResidentNote: "",
    moveInTimeline: "",
    additionalNote: "",
};

const docLabels: Record<TenantDocumentType, string> = {
    INCOME_PROOF: "收入證明",
    HOUSEHOLD_DOC: "戶籍或同住資料",
    OTHER: "其他補充文件",
};

const inputCls = "rounded-lg border-0 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary-container";

export default function TenantProfilePage() {
    const [profile, setProfile] = useState<TenantProfile | null>(null);
    const [form, setForm] = useState<TenantProfilePayload>(emptyProfile);
    const [docType, setDocType] = useState<TenantDocumentType>("INCOME_PROOF");
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const refresh = async () => {
        const next = await getMyTenantProfile();
        setProfile(next);
        setForm({
            occupationType: next.occupationType,
            orgName: next.orgName,
            incomeRange: next.incomeRange,
            householdSize: next.householdSize,
            coResidentNote: next.coResidentNote,
            moveInTimeline: next.moveInTimeline,
            additionalNote: next.additionalNote,
        });
    };

    useEffect(() => {
        refresh()
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "讀取租客資料失敗"))
            .finally(() => setLoading(false));
    }, []);

    const setField = <K extends keyof TenantProfilePayload>(key: K, value: TenantProfilePayload[K]) => {
        setForm((current) => ({ ...current, [key]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        setError("");
        setMessage("");
        try {
            const saved = await updateMyTenantProfile(form);
            setProfile(saved);
            setMessage("租客資料已儲存。");
        } catch (err) {
            setError(err instanceof Error ? err.message : "儲存租客資料失敗");
        } finally {
            setSaving(false);
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setSaving(true);
        setError("");
        setMessage("");
        try {
            const saved = await uploadMyTenantDocument(docType, file);
            setProfile(saved);
            setFile(null);
            setMessage("文件已上傳。");
        } catch (err) {
            setError(err instanceof Error ? err.message : "上傳文件失敗");
        } finally {
            setSaving(false);
        }
    };

    const isAdvanced = profile?.advancedDataStatus === "ADVANCED";

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-8 px-6 py-12 md:px-12">
                <header className="space-y-3">
                    <h1 className="text-4xl font-extrabold text-on-surface">租客資料</h1>
                    <p className="max-w-3xl text-sm leading-[1.8] text-on-surface-variant">
                        補充職業、收入、同住成員與入住時程，讓房東與仲介在瀏覽需求時能更快判斷你的租屋條件與可信度。
                    </p>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${isAdvanced ? "bg-tertiary/10 text-tertiary" : "bg-surface-container-low text-on-surface-variant"}`}>
                        {isAdvanced ? "進階資料已完成" : "基本資料"}
                    </span>
                </header>

                {loading ? (
                    <div className="py-20 text-center text-sm text-on-surface-variant">讀取中...</div>
                ) : (
                    <section className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
                        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="flex flex-col gap-2 text-xs font-semibold text-on-surface-variant">
                                    職業類型
                                    <input className={inputCls} value={form.occupationType} onChange={(e) => setField("occupationType", e.target.value)} placeholder="例如：上班族、自由工作者" />
                                </label>
                                <label className="flex flex-col gap-2 text-xs font-semibold text-on-surface-variant">
                                    公司或組織
                                    <input className={inputCls} value={form.orgName} onChange={(e) => setField("orgName", e.target.value)} placeholder="可填公司、學校或自營狀態" />
                                </label>
                                <label className="flex flex-col gap-2 text-xs font-semibold text-on-surface-variant">
                                    收入範圍
                                    <input className={inputCls} value={form.incomeRange} onChange={(e) => setField("incomeRange", e.target.value)} placeholder="例如：60,000 - 80,000" />
                                </label>
                                <label className="flex flex-col gap-2 text-xs font-semibold text-on-surface-variant">
                                    家庭人數
                                    <input className={inputCls} type="number" min={0} value={form.householdSize} onChange={(e) => setField("householdSize", Number(e.target.value))} />
                                </label>
                                <label className="flex flex-col gap-2 text-xs font-semibold text-on-surface-variant md:col-span-2">
                                    同住備註
                                    <input className={inputCls} value={form.coResidentNote} onChange={(e) => setField("coResidentNote", e.target.value)} placeholder="例如：伴侶、家人、寵物或無同住者" />
                                </label>
                                <label className="flex flex-col gap-2 text-xs font-semibold text-on-surface-variant md:col-span-2">
                                    入住時程
                                    <input className={inputCls} value={form.moveInTimeline} onChange={(e) => setField("moveInTimeline", e.target.value)} placeholder="例如：一個月內、可配合房東" />
                                </label>
                                <label className="flex flex-col gap-2 text-xs font-semibold text-on-surface-variant md:col-span-2">
                                    補充說明
                                    <textarea className={inputCls} rows={4} value={form.additionalNote} onChange={(e) => setField("additionalNote", e.target.value)} />
                                </label>
                            </div>
                            {error ? <p className="mt-4 text-sm text-error">{error}</p> : null}
                            {message ? <p className="mt-4 text-sm text-tertiary">{message}</p> : null}
                            <button type="button" disabled={saving} onClick={() => void handleSave()} className="mt-6 rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90 disabled:opacity-60">
                                {saving ? "儲存中..." : "儲存租客資料"}
                            </button>
                        </div>

                        <aside className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
                            <h2 className="text-xl font-bold text-on-surface">補充文件</h2>
                            <p className="mt-2 text-sm leading-[1.8] text-on-surface-variant">
                                文件可補強租客資料完整度。後續需求媒合時，系統會依照授權規則顯示可公開的摘要，不會直接公開原始文件。
                            </p>
                            <div className="mt-5 flex flex-col gap-3">
                                <select className={inputCls} value={docType} onChange={(e) => setDocType(e.target.value as TenantDocumentType)}>
                                    {Object.entries(docLabels).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                                <input className={inputCls} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                                <button type="button" disabled={!file || saving} onClick={() => void handleUpload()} className="rounded-xl border border-outline-variant/25 bg-surface-container-low px-5 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container disabled:opacity-60">
                                    上傳文件
                                </button>
                            </div>
                            <div className="mt-6 space-y-2">
                                {(profile?.documents ?? []).map((doc) => (
                                    <div key={doc.id} className="rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface">
                                        {docLabels[doc.docType] ?? doc.docType} #{doc.id}
                                    </div>
                                ))}
                                {(profile?.documents ?? []).length === 0 ? <p className="text-sm text-on-surface-variant">尚未上傳文件。</p> : null}
                            </div>
                        </aside>
                    </section>
                )}
            </main>
        </SiteLayout>
    );
}
