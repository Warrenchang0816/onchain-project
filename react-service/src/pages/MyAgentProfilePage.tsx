import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyAgentProfile, updateMyAgentProfile, type UpsertMyAgentProfileRequest } from "@/api/agentApi";
import SiteLayout from "@/layouts/SiteLayout";

const emptyProfile: UpsertMyAgentProfileRequest = {
    headline: "",
    bio: "",
    serviceAreas: [],
    licenseNote: "",
    contactPreferences: "",
};

const inputCls = "rounded-lg border-0 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary-container";

function validateProfile(form: UpsertMyAgentProfileRequest): string | null {
    if (!form.headline.trim()) return "請填寫專頁標語";
    if (!form.bio.trim()) return "請填寫服務介紹";
    if (!form.licenseNote.trim()) return "請填寫證照或經歷備註";
    if (!form.contactPreferences.trim()) return "請填寫聯絡偏好";
    if (form.serviceAreas.length === 0) return "請至少加入一個服務區域";
    return null;
}

export default function MyAgentProfilePage() {
    const navigate = useNavigate();
    const [form, setForm] = useState(emptyProfile);
    const [areaInput, setAreaInput] = useState("");
    const [complete, setComplete] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        getMyAgentProfile()
            .then((profile) => {
                setForm({
                    headline: profile.headline ?? "",
                    bio: profile.bio ?? "",
                    serviceAreas: profile.serviceAreas ?? [],
                    licenseNote: profile.licenseNote ?? "",
                    contactPreferences: "",
                });
                setComplete(profile.isProfileComplete);
            })
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "讀取仲介專頁失敗"))
            .finally(() => setLoading(false));
    }, []);

    const setField = <K extends keyof UpsertMyAgentProfileRequest>(key: K, value: UpsertMyAgentProfileRequest[K]) => {
        setForm((current) => ({ ...current, [key]: value }));
        setError("");
    };

    const addArea = () => {
        const next = areaInput.trim();
        if (!next || form.serviceAreas.includes(next)) return;
        setField("serviceAreas", [...form.serviceAreas, next]);
        setAreaInput("");
    };

    const removeArea = (area: string) => {
        setField("serviceAreas", form.serviceAreas.filter((item) => item !== area));
    };

    const handleSave = async () => {
        const validationError = validateProfile(form);
        if (validationError) {
            setError(validationError);
            setMessage("");
            return;
        }

        setSaving(true);
        setError("");
        setMessage("");
        try {
            const saved = await updateMyAgentProfile(form);
            setComplete(saved.isProfileComplete);
            setMessage("仲介專頁已儲存");
        } catch (err) {
            setError(err instanceof Error ? err.message : "儲存仲介專頁失敗");
        } finally {
            setSaving(false);
        }
    };

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-8 px-6 py-12 md:px-12">
                <header className="space-y-3">
                    <h1 className="text-4xl font-extrabold text-on-surface">我的仲介專頁</h1>
                    <p className="max-w-3xl text-sm leading-[1.8] text-on-surface-variant">
                        這些資料會顯示在公開仲介詳細頁，只有本人可以編輯。請完整填寫服務內容、區域、證照備註與聯絡偏好。
                    </p>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${complete ? "bg-tertiary/10 text-tertiary" : "bg-surface-container-low text-on-surface-variant"}`}>
                        {complete ? "專頁資料完整" : "專頁尚未完成"}
                    </span>
                </header>

                {loading ? (
                    <div className="py-20 text-center text-sm text-on-surface-variant">讀取中...</div>
                ) : (
                    <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
                        <div className="grid gap-4">
                            <label className="flex flex-col gap-2 text-xs font-semibold text-on-surface-variant">
                                專頁標語
                                <input className={inputCls} value={form.headline} onChange={(e) => setField("headline", e.target.value)} placeholder="例如：雙北租賃媒合與屋況整理顧問" />
                            </label>
                            <label className="flex flex-col gap-2 text-xs font-semibold text-on-surface-variant">
                                服務介紹
                                <textarea className={inputCls} rows={6} value={form.bio} onChange={(e) => setField("bio", e.target.value)} />
                            </label>
                            <label className="flex flex-col gap-2 text-xs font-semibold text-on-surface-variant">
                                證照或經歷備註
                                <input className={inputCls} value={form.licenseNote} onChange={(e) => setField("licenseNote", e.target.value)} />
                            </label>
                            <label className="flex flex-col gap-2 text-xs font-semibold text-on-surface-variant">
                                聯絡偏好
                                <input className={inputCls} value={form.contactPreferences} onChange={(e) => setField("contactPreferences", e.target.value)} placeholder="例如：站內預約後再交換聯絡方式" />
                            </label>
                        </div>

                        <div className="mt-5">
                            <label className="text-xs font-semibold text-on-surface-variant">服務區域</label>
                            <div className="mt-2 flex gap-2">
                                <input className={`${inputCls} flex-1`} value={areaInput} onChange={(e) => setAreaInput(e.target.value)} placeholder="例如：台北市、新北市" />
                                <button type="button" onClick={addArea} className="rounded-lg bg-surface-container-low px-4 py-3 text-sm font-bold text-on-surface">加入</button>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {form.serviceAreas.map((area) => (
                                    <button key={area} type="button" onClick={() => removeArea(area)} className="rounded-full bg-primary-container/15 px-3 py-1 text-xs font-bold text-primary-container">
                                        {area} ×
                                    </button>
                                ))}
                            </div>
                        </div>

                        {error ? <p className="mt-4 text-sm text-error">{error}</p> : null}
                        {message ? <p className="mt-4 text-sm text-tertiary">{message}</p> : null}

                        <div className="mt-6 flex flex-wrap gap-3">
                            <button
                                type="button"
                                disabled={saving}
                                onClick={() => void handleSave()}
                                className="rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90 disabled:opacity-60"
                            >
                                {saving ? "儲存中..." : "儲存仲介專頁"}
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate("/member")}
                                className="rounded-xl border border-outline-variant/25 bg-surface-container-low px-5 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container"
                            >
                                返回身分中心
                            </button>
                        </div>
                    </section>
                )}
            </main>
        </SiteLayout>
    );
}
