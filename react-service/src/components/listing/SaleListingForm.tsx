import { useCallback, useEffect, useState } from "react";
import {
    closeSaleListing,
    createSaleListing,
    getSaleListingForProperty,
    publishSaleListing,
    updateSaleListing,
    type CreateSaleListingPayload,
    type SaleListing,
} from "../../api/saleListingApi";
import type { Property } from "../../api/propertyApi";

const inputCls =
    "block w-full px-4 py-3 bg-surface-container-low text-on-surface rounded-lg border-0 " +
    "focus:ring-2 focus:ring-primary-container transition-colors text-sm outline-none placeholder:text-outline";

const STATUS_LABEL: Record<string, string> = {
    DRAFT: "草稿", ACTIVE: "上架中", NEGOTIATING: "洽談中",
    LOCKED: "已鎖定", CLOSED: "已下架", EXPIRED: "已過期",
};

type FormState = {
    total_price: string; unit_price_per_ping: string;
    parking_type: string; parking_price: string;
    notes: string; duration_days: string;
};

const EMPTY_FORM: FormState = {
    total_price: "", unit_price_per_ping: "",
    parking_type: "", parking_price: "",
    notes: "", duration_days: "30",
};

function listingToForm(sl: SaleListing): FormState {
    return {
        total_price: String(sl.total_price),
        unit_price_per_ping: sl.unit_price_per_ping != null ? String(sl.unit_price_per_ping) : "",
        parking_type: sl.parking_type ?? "",
        parking_price: sl.parking_price != null ? String(sl.parking_price) : "",
        notes: sl.notes ?? "",
        duration_days: String(sl.duration_days),
    };
}

function formToPayload(f: FormState): CreateSaleListingPayload {
    const unit = parseFloat(f.unit_price_per_ping);
    const pprice = parseFloat(f.parking_price);
    return {
        total_price: parseFloat(f.total_price) || 0,
        unit_price_per_ping: isFinite(unit) ? unit : undefined,
        parking_type: f.parking_type || undefined,
        parking_price: isFinite(pprice) ? pprice : undefined,
        notes: f.notes || undefined,
        duration_days: parseInt(f.duration_days, 10) || 30,
    };
}

type Props = {
    propertyId: number;
    property: Property;
};

export default function SaleListingForm({ propertyId, property }: Props) {
    const [listing, setListing] = useState<SaleListing | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState({ ok: "", err: "" });

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const sl = await getSaleListingForProperty(propertyId);
            setListing(sl);
            setForm(sl ? listingToForm(sl) : EMPTY_FORM);
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
                await updateSaleListing(listing.id, payload);
            } else {
                await createSaleListing(propertyId, payload);
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
            await publishSaleListing(listing.id, parseInt(form.duration_days, 10) || 30);
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
            await closeSaleListing(listing.id);
            setMsg({ ok: "已下架", err: "" });
            await reload();
        } catch (err) {
            setMsg({ ok: "", err: err instanceof Error ? err.message : "下架失敗" });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="py-20 text-center text-sm text-on-surface-variant">載入中...</div>;

    return (
        <>
            <div className="flex flex-col gap-2">
                <h1 className="text-4xl font-extrabold text-on-surface">出售條件</h1>
                <p className="text-sm text-on-surface-variant">{property.address}</p>
                {listing ? (
                    <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${listing.status === "ACTIVE" ? "bg-[#E8F5E9] text-[#2E7D32]" : "bg-surface-container-low text-on-surface-variant"}`}>
                        {STATUS_LABEL[listing.status] ?? listing.status}
                    </span>
                ) : null}
            </div>

            <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                <div className="grid gap-5 md:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-on-surface-variant">總價（NTD）*</label>
                        <input type="number" value={form.total_price} onChange={(e) => setField("total_price", e.target.value)} className={inputCls} placeholder="例：12000000" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-on-surface-variant">單坪價（NTD）</label>
                        <input type="number" value={form.unit_price_per_ping} onChange={(e) => setField("unit_price_per_ping", e.target.value)} className={inputCls} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-on-surface-variant">車位類型</label>
                        <select value={form.parking_type} onChange={(e) => setField("parking_type", e.target.value)} className={inputCls}>
                            <option value="">無</option>
                            <option value="RAMP">坡道平面</option>
                            <option value="MECHANICAL">機械</option>
                            <option value="TOWER">塔式</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-on-surface-variant">車位價格（NTD）</label>
                        <input type="number" value={form.parking_price} onChange={(e) => setField("parking_price", e.target.value)} className={inputCls} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-on-surface-variant">刊登天數</label>
                        <input type="number" value={form.duration_days} onChange={(e) => setField("duration_days", e.target.value)} className={inputCls} min="7" />
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
                        {saving ? "處理中..." : listing ? "更新條件" : "建立出售刊登"}
                    </button>
                    {listing?.status === "DRAFT" ? (
                        <button type="button" onClick={() => void handlePublish()} disabled={saving}
                            className="w-full rounded-xl bg-[#2196F3] px-6 py-3 font-bold text-white disabled:opacity-40 hover:opacity-90 transition-opacity">
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
        </>
    );
}
