import { useEffect, useMemo, useState } from "react";
import {
    createRequirement,
    getMyRequirements,
    updateRequirement,
    updateRequirementStatus,
    type TenantRequirement,
    type TenantRequirementPayload,
    type TenantRequirementStatus,
} from "@/api/tenantApi";
import SiteLayout from "@/layouts/SiteLayout";

const emptyRequirement = {
    targetDistrict: "",
    budgetMin: "",
    budgetMax: "",
    layoutNote: "",
    moveInDate: "",
    petFriendlyNeeded: false,
    parkingNeeded: false,
};

const statusLabel: Record<TenantRequirementStatus, string> = {
    OPEN: "開放中",
    PAUSED: "暫停",
    CLOSED: "已關閉",
};

const inputCls = "rounded-lg border-0 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary-container";

function toPayload(form: typeof emptyRequirement): TenantRequirementPayload {
    return {
        targetDistrict: form.targetDistrict.trim(),
        districts: [],
        budgetMin: Number(form.budgetMin || 0),
        budgetMax: Number(form.budgetMax || 0),
        roomMin: 0,
        bathroomMin: 0,
        layoutNote: form.layoutNote.trim(),
        moveInDate: form.moveInDate || null,
        moveInTimeline: "",
        minimumLeaseMonths: 0,
        petFriendlyNeeded: form.petFriendlyNeeded,
        parkingNeeded: form.parkingNeeded,
        canCookNeeded: false,
        canRegisterHouseholdNeeded: false,
        lifestyleNote: "",
        mustHaveNote: "",
    };
}

export default function MyRequirementsPage() {
    const [items, setItems] = useState<TenantRequirement[]>([]);
    const [form, setForm] = useState(emptyRequirement);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const refresh = async () => setItems(await getMyRequirements());

    useEffect(() => {
        refresh()
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "讀取租屋需求失敗"))
            .finally(() => setLoading(false));
    }, []);

    const counts = useMemo(() => ({
        open: items.filter((item) => item.status === "OPEN").length,
        paused: items.filter((item) => item.status === "PAUSED").length,
        closed: items.filter((item) => item.status === "CLOSED").length,
    }), [items]);

    const setField = <K extends keyof typeof emptyRequirement>(key: K, value: (typeof emptyRequirement)[K]) => {
        setForm((current) => ({ ...current, [key]: value }));
    };

    const resetForm = () => {
        setForm(emptyRequirement);
        setEditingId(null);
    };

    const startEdit = (item: TenantRequirement) => {
        setEditingId(item.id);
        setForm({
            targetDistrict: item.targetDistrict,
            budgetMin: String(item.budgetMin),
            budgetMax: String(item.budgetMax),
            layoutNote: item.layoutNote,
            moveInDate: item.moveInDate ?? "",
            petFriendlyNeeded: item.petFriendlyNeeded,
            parkingNeeded: item.parkingNeeded,
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleSubmit = async () => {
        setSaving(true);
        setError("");
        try {
            if (editingId) {
                await updateRequirement(editingId, toPayload(form));
            } else {
                await createRequirement(toPayload(form));
            }
            resetForm();
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "儲存租屋需求失敗");
        } finally {
            setSaving(false);
        }
    };

    const handleStatus = async (id: number, status: TenantRequirementStatus) => {
        setSaving(true);
        setError("");
        try {
            await updateRequirementStatus(id, status);
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "更新需求狀態失敗");
        } finally {
            setSaving(false);
        }
    };

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 px-6 py-12 md:px-12">
                <header className="space-y-3">
                    <h1 className="text-4xl font-extrabold text-on-surface">我的租屋需求</h1>
                    <p className="max-w-3xl text-sm leading-[1.8] text-on-surface-variant">
                        建立並管理你的租屋需求。開放中的需求會出現在房東與仲介可瀏覽的需求列表中，後續媒合流程也會從這裡接上。
                    </p>
                </header>

                <section className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl bg-surface-container-lowest p-5">開放中 <strong className="ml-2 text-2xl">{counts.open}</strong></div>
                    <div className="rounded-2xl bg-surface-container-lowest p-5">暫停 <strong className="ml-2 text-2xl">{counts.paused}</strong></div>
                    <div className="rounded-2xl bg-surface-container-lowest p-5">已關閉 <strong className="ml-2 text-2xl">{counts.closed}</strong></div>
                </section>

                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
                    <h2 className="text-xl font-bold text-on-surface">{editingId ? "編輯需求" : "新增需求"}</h2>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <input className={inputCls} value={form.targetDistrict} onChange={(e) => setField("targetDistrict", e.target.value)} placeholder="行政區，例如：信義區" />
                        <input className={inputCls} type="date" value={form.moveInDate} onChange={(e) => setField("moveInDate", e.target.value)} />
                        <input className={inputCls} type="number" min={0} value={form.budgetMin} onChange={(e) => setField("budgetMin", e.target.value)} placeholder="最低預算" />
                        <input className={inputCls} type="number" min={0} value={form.budgetMax} onChange={(e) => setField("budgetMax", e.target.value)} placeholder="最高預算" />
                        <textarea className={`${inputCls} md:col-span-2`} rows={4} value={form.layoutNote} onChange={(e) => setField("layoutNote", e.target.value)} placeholder="格局、生活需求、交通或其他條件" />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-6 text-sm text-on-surface-variant">
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={form.petFriendlyNeeded} onChange={(e) => setField("petFriendlyNeeded", e.target.checked)} />
                            需要可養寵物
                        </label>
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={form.parkingNeeded} onChange={(e) => setField("parkingNeeded", e.target.checked)} />
                            需要車位
                        </label>
                    </div>
                    {error ? <p className="mt-4 text-sm text-error">{error}</p> : null}
                    <div className="mt-6 flex gap-3">
                        <button type="button" disabled={saving} onClick={() => void handleSubmit()} className="rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container disabled:opacity-60">
                            {saving ? "儲存中..." : editingId ? "儲存需求" : "新增需求"}
                        </button>
                        {editingId ? (
                            <button type="button" onClick={resetForm} className="rounded-xl border border-outline-variant/25 bg-surface-container-low px-5 py-3 text-sm font-medium text-on-surface">
                                取消編輯
                            </button>
                        ) : null}
                    </div>
                </section>

                {loading ? (
                    <div className="py-20 text-center text-sm text-on-surface-variant">讀取中...</div>
                ) : (
                    <section className="grid gap-4">
                        {items.map((item) => (
                            <article key={item.id} className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
                                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-bold text-on-surface-variant">{statusLabel[item.status]}</span>
                                        <h2 className="mt-3 text-xl font-bold text-on-surface">{item.targetDistrict || "未設定行政區"}</h2>
                                        <p className="mt-1 text-sm text-on-surface-variant">
                                            NT$ {item.budgetMin.toLocaleString()} - {item.budgetMax.toLocaleString()}，{item.layoutNote || "尚未填寫需求說明"}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <button type="button" onClick={() => startEdit(item)} className="rounded-lg border border-outline-variant/25 bg-surface-container-low px-4 py-2 text-sm text-on-surface">編輯</button>
                                        <button type="button" onClick={() => void handleStatus(item.id, "OPEN")} className="rounded-lg bg-tertiary/10 px-4 py-2 text-sm font-bold text-tertiary">開放</button>
                                        <button type="button" onClick={() => void handleStatus(item.id, "PAUSED")} className="rounded-lg bg-surface-container-low px-4 py-2 text-sm text-on-surface">暫停</button>
                                        <button type="button" onClick={() => void handleStatus(item.id, "CLOSED")} className="rounded-lg bg-error-container px-4 py-2 text-sm text-on-error-container">關閉</button>
                                    </div>
                                </div>
                            </article>
                        ))}
                        {items.length === 0 ? (
                            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center text-sm text-on-surface-variant">
                                尚未建立租屋需求。
                            </div>
                        ) : null}
                    </section>
                )}
            </main>
        </SiteLayout>
    );
}
