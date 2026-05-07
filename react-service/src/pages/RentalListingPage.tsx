import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
    closeRentalListing,
    createRentalListing,
    getRentalListingForProperty,
    publishRentalListing,
    updateRentalListing,
    type CreateRentalListingPayload,
    type ManagementFeePayer,
    type RentalListing,
} from "../api/rentalListingApi";
import { getProperty, type Property } from "../api/propertyApi";
import SiteLayout from "../layouts/SiteLayout";

const inputCls =
    "block w-full px-4 py-3 bg-surface-container-low text-on-surface rounded-lg border-0 " +
    "focus:ring-2 focus:ring-primary-container transition-colors text-sm outline-none placeholder:text-outline";

const STATUS_LABEL: Record<string, string> = {
    DRAFT: "草稿", ACTIVE: "上架中", NEGOTIATING: "洽談中",
    LOCKED: "已鎖定", CLOSED: "已下架", EXPIRED: "已過期",
};

type FormState = {
    monthly_rent: string; deposit_months: string;
    management_fee_payer: ManagementFeePayer;
    min_lease_months: string; allow_pets: boolean;
    allow_cooking: boolean; gender_restriction: string;
    notes: string; duration_days: string;
};

const EMPTY_FORM: FormState = {
    monthly_rent: "", deposit_months: "2",
    management_fee_payer: "TENANT", min_lease_months: "12",
    allow_pets: false, allow_cooking: true,
    gender_restriction: "", notes: "", duration_days: "30",
};

function listingToForm(rl: RentalListing): FormState {
    return {
        monthly_rent: String(rl.monthly_rent),
        deposit_months: String(rl.deposit_months),
        management_fee_payer: rl.management_fee_payer,
        min_lease_months: String(rl.min_lease_months),
        allow_pets: rl.allow_pets, allow_cooking: rl.allow_cooking,
        gender_restriction: rl.gender_restriction ?? "",
        notes: rl.notes ?? "", duration_days: String(rl.duration_days),
    };
}

function formToPayload(f: FormState): CreateRentalListingPayload {
    return {
        monthly_rent: parseFloat(f.monthly_rent) || 0,
        deposit_months: parseFloat(f.deposit_months) || 0,
        management_fee_payer: f.management_fee_payer,
        min_lease_months: parseInt(f.min_lease_months, 10) || 0,
        allow_pets: f.allow_pets, allow_cooking: f.allow_cooking,
        gender_restriction: f.gender_restriction || undefined,
        notes: f.notes || undefined,
        duration_days: parseInt(f.duration_days, 10) || 30,
    };
}

export default function RentalListingPage() {
    const { id } = useParams<{ id: string }>();
    const propertyId = id ? parseInt(id, 10) : NaN;

    const [property, setProperty] = useState<Property | null>(null);
    const [listing, setListing] = useState<RentalListing | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState({ ok: "", err: "" });

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const [prop, rl] = await Promise.all([
                getProperty(propertyId),
                getRentalListingForProperty(propertyId),
            ]);
            setProperty(prop);
            setListing(rl);
            setForm(rl ? listingToForm(rl) : EMPTY_FORM);
        } catch (err) {
            setMsg({ ok: "", err: err instanceof Error ? err.message : "載入失敗" });
        } finally {
            setLoading(false);
        }
    }, [propertyId]);

    useEffect(() => { if (!isNaN(propertyId)) void reload(); }, [propertyId, reload]);

    const setField = <K extends keyof FormState>(key: K, val: FormState[K]) =>
        setForm((f) => ({ ...f, [key]: val }));

    const handleSave = async () => {
        setSaving(true); setMsg({ ok: "", err: "" });
        try {
            const payload = formToPayload(form);
            if (listing) {
                await updateRentalListing(listing.id, payload);
            } else {
                await createRentalListing(propertyId, payload);
            }
            setMsg({ ok: "已儲存", err: "" });
            await reload();
        } catch (err) {
            setMsg({ ok: "", err: err instanceof Error ? err.message : "儲存失敗" });
        } finally {
            setSaving(false);
        }
    };

    const handlePublish = async () => {
        if (!listing) return;
        setSaving(true); setMsg({ ok: "", err: "" });
        try {
            await publishRentalListing(listing.id, parseInt(form.duration_days, 10) || 30);
            setMsg({ ok: "已上架", err: "" });
            await reload();
        } catch (err) {
            setMsg({ ok: "", err: err instanceof Error ? err.message : "上架失敗" });
        } finally {
            setSaving(false);
        }
    };

    const handleClose = async () => {
        if (!listing) return;
        setSaving(true); setMsg({ ok: "", err: "" });
        try {
            await closeRentalListing(listing.id);
            setMsg({ ok: "已下架", err: "" });
            await reload();
        } catch (err) {
            setMsg({ ok: "", err: err instanceof Error ? err.message : "下架失敗" });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <SiteLayout><div className="p-12 text-sm text-on-surface-variant">載入中...</div></SiteLayout>;

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[720px] flex-col gap-8 px-6 py-12 md:px-12">
                <div className="flex flex-col gap-2">
                    <Link to={`/my/properties/${propertyId}`} className="text-sm text-on-surface-variant hover:text-primary-container">
                        ← 返回物件編輯
                    </Link>
                    <h1 className="text-4xl font-extrabold text-on-surface">出租條件</h1>
                    <p className="text-sm text-on-surface-variant">{property?.address ?? ""}</p>
                    {listing ? (
                        <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${listing.status === "ACTIVE" ? "bg-[#E8F5E9] text-[#2E7D32]" : "bg-surface-container-low text-on-surface-variant"}`}>
                            {STATUS_LABEL[listing.status] ?? listing.status}
                        </span>
                    ) : null}
                </div>

                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <div className="grid gap-5 md:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-on-surface-variant">月租金（NTD）*</label>
                            <input type="number" value={form.monthly_rent} onChange={(e) => setField("monthly_rent", e.target.value)} className={inputCls} placeholder="例：20000" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-on-surface-variant">押金月數</label>
                            <input type="number" value={form.deposit_months} onChange={(e) => setField("deposit_months", e.target.value)} className={inputCls} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-on-surface-variant">管理費負擔方</label>
                            <select value={form.management_fee_payer} onChange={(e) => setField("management_fee_payer", e.target.value as ManagementFeePayer)} className={inputCls}>
                                <option value="TENANT">租客</option>
                                <option value="OWNER">房東</option>
                                <option value="SPLIT">各半</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-on-surface-variant">最短租期（月）</label>
                            <input type="number" value={form.min_lease_months} onChange={(e) => setField("min_lease_months", e.target.value)} className={inputCls} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-on-surface-variant">性別限制</label>
                            <select value={form.gender_restriction} onChange={(e) => setField("gender_restriction", e.target.value)} className={inputCls}>
                                <option value="">不限</option>
                                <option value="MALE">限男</option>
                                <option value="FEMALE">限女</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-on-surface-variant">刊登天數（上架時生效）</label>
                            <input type="number" value={form.duration_days} onChange={(e) => setField("duration_days", e.target.value)} className={inputCls} min="7" />
                        </div>
                        <div className="flex items-center gap-6 md:col-span-2">
                            {([["allow_pets", "可養寵物"], ["allow_cooking", "可炊煮"]] as const).map(([key, label]) => (
                                <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-on-surface-variant">
                                    <input type="checkbox" checked={form[key]} onChange={(e) => setField(key, e.target.checked)} className="h-4 w-4 rounded accent-primary-container" />
                                    {label}
                                </label>
                            ))}
                        </div>
                        <div className="flex flex-col gap-1.5 md:col-span-2">
                            <label className="text-xs font-semibold text-on-surface-variant">備注</label>
                            <textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)} rows={3} className={inputCls} />
                        </div>
                    </div>

                    {msg.ok ? <p className="mt-4 text-sm text-[#2E7D32]">✓ {msg.ok}</p> : null}
                    {msg.err ? <p className="mt-4 rounded-lg bg-error-container p-3 text-sm text-on-error-container">{msg.err}</p> : null}

                    <div className="mt-6 flex flex-col gap-3">
                        <button type="button" onClick={() => void handleSave()} disabled={saving}
                            className="w-full rounded-xl bg-primary-container px-6 py-3 font-bold text-on-primary-container disabled:opacity-40 hover:opacity-90 transition-opacity">
                            {saving ? "處理中..." : listing ? "更新條件" : "建立出租刊登"}
                        </button>
                        {listing?.status === "DRAFT" ? (
                            <button type="button" onClick={() => void handlePublish()} disabled={saving}
                                className="w-full rounded-xl bg-[#E8A000] px-6 py-3 font-bold text-white disabled:opacity-40 hover:opacity-90 transition-opacity">
                                上架（刊登 {form.duration_days} 天）
                            </button>
                        ) : null}
                        {listing?.status === "ACTIVE" ? (
                            <button type="button" onClick={() => void handleClose()} disabled={saving}
                                className="w-full rounded-xl border border-error/30 bg-surface-container-lowest px-6 py-3 font-medium text-error disabled:opacity-40 hover:bg-error-container transition-colors">
                                下架
                            </button>
                        ) : null}
                    </div>
                </section>
            </main>
        </SiteLayout>
    );
}
