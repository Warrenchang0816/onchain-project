import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
    addAttachment,
    deleteAttachment,
    getProperty,
    updateProperty,
    type AttachmentType,
    type Property,
    type UpdatePropertyPayload,
} from "../api/propertyApi";
import SiteLayout from "../layouts/SiteLayout";
import PropertyPhotoUploader from "@/components/property/PropertyPhotoUploader";

const inputCls =
    "block w-full px-4 py-3 bg-surface-container-low text-on-surface rounded-lg border-0 " +
    "focus:ring-2 focus:ring-primary-container transition-colors text-sm outline-none placeholder:text-outline";

const selectCls = inputCls;

function numVal(s: string): number | undefined {
    const n = parseFloat(s);
    return isFinite(n) ? n : undefined;
}
function intVal(s: string): number | undefined {
    const n = parseInt(s, 10);
    return isFinite(n) ? n : undefined;
}

function computeProgress(p: Property): number {
    let score = 0;
    if (p.title) score += 25;
    if (p.address) score += 25;
    if (p.building_type) score += 25;
    if (p.attachments.some((a) => a.type === "PHOTO")) score += 25;
    return score;
}

type FormState = {
    title: string; address: string; building_type: string;
    floor: string; total_floors: string;
    main_area: string; auxiliary_area: string; balcony_area: string;
    shared_area: string; awning_area: string; land_area: string;
    rooms: string; living_rooms: string; bathrooms: string;
    building_age: string; parking_type: string; management_fee: string;
    is_corner_unit: boolean; has_dark_room: boolean;
    building_structure: string; exterior_material: string;
    building_orientation: string; window_orientation: string;
    security_type: string; building_usage: string; zoning: string;
    units_on_floor: string;
};

function propertyToForm(p: Property): FormState {
    return {
        title: p.title, address: p.address, building_type: p.building_type ?? "",
        floor: p.floor != null ? String(p.floor) : "",
        total_floors: p.total_floors != null ? String(p.total_floors) : "",
        main_area: p.main_area != null ? String(p.main_area) : "",
        auxiliary_area: p.auxiliary_area != null ? String(p.auxiliary_area) : "",
        balcony_area: p.balcony_area != null ? String(p.balcony_area) : "",
        shared_area: p.shared_area != null ? String(p.shared_area) : "",
        awning_area: p.awning_area != null ? String(p.awning_area) : "",
        land_area: p.land_area != null ? String(p.land_area) : "",
        rooms: p.rooms != null ? String(p.rooms) : "",
        living_rooms: p.living_rooms != null ? String(p.living_rooms) : "",
        bathrooms: p.bathrooms != null ? String(p.bathrooms) : "",
        building_age: p.building_age != null ? String(p.building_age) : "",
        parking_type: p.parking_type ?? "NONE",
        management_fee: p.management_fee != null ? String(p.management_fee) : "",
        is_corner_unit: p.is_corner_unit,
        has_dark_room: p.has_dark_room,
        building_structure: p.building_structure ?? "",
        exterior_material: p.exterior_material ?? "",
        building_orientation: p.building_orientation ?? "",
        window_orientation: p.window_orientation ?? "",
        security_type: p.security_type ?? "NONE",
        building_usage: p.building_usage ?? "",
        zoning: p.zoning ?? "",
        units_on_floor: p.units_on_floor != null ? String(p.units_on_floor) : "",
    };
}

function formToPayload(f: FormState): UpdatePropertyPayload {
    return {
        title: f.title || undefined, address: f.address || undefined,
        building_type: f.building_type || undefined,
        floor: intVal(f.floor), total_floors: intVal(f.total_floors),
        main_area: numVal(f.main_area), auxiliary_area: numVal(f.auxiliary_area),
        balcony_area: numVal(f.balcony_area), shared_area: numVal(f.shared_area),
        awning_area: numVal(f.awning_area), land_area: numVal(f.land_area),
        rooms: intVal(f.rooms), living_rooms: intVal(f.living_rooms), bathrooms: intVal(f.bathrooms),
        building_age: intVal(f.building_age),
        parking_type: f.parking_type || undefined,
        management_fee: numVal(f.management_fee),
        is_corner_unit: f.is_corner_unit, has_dark_room: f.has_dark_room,
        building_structure: f.building_structure || undefined,
        exterior_material: f.exterior_material || undefined,
        building_orientation: f.building_orientation || undefined,
        window_orientation: f.window_orientation || undefined,
        security_type: f.security_type || undefined,
        building_usage: f.building_usage || undefined,
        zoning: f.zoning || undefined,
        units_on_floor: intVal(f.units_on_floor),
    };
}

export default function PropertyEditPage() {
    const { id } = useParams<{ id: string }>();
    const propertyId = id ? parseInt(id, 10) : NaN;

    const [property, setProperty] = useState<Property | null>(null);
    const [form, setForm] = useState<FormState | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");
    const [saveOk, setSaveOk] = useState(false);

    const [attachType, setAttachType] = useState<AttachmentType>("FLOOR_PLAN");
    const [attachUrl, setAttachUrl] = useState("");
    const [attaching, setAttaching] = useState(false);
    const [attachError, setAttachError] = useState("");

    const reload = () => {
        setLoading(true);
        getProperty(propertyId)
            .then((p) => { setProperty(p); setForm(propertyToForm(p)); })
            .catch((err: unknown) => setSaveError(err instanceof Error ? err.message : "載入失敗"))
            .finally(() => setLoading(false));
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (!isNaN(propertyId)) reload(); }, [propertyId]);

    const setField = <K extends keyof FormState>(key: K, val: FormState[K]) =>
        setForm((f) => f ? { ...f, [key]: val } : f);

    const handleSave = async () => {
        if (!form) return;
        setSaving(true); setSaveError(""); setSaveOk(false);
        try {
            await updateProperty(propertyId, formToPayload(form));
            setSaveOk(true);
            reload();
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : "儲存失敗");
        } finally {
            setSaving(false);
        }
    };

    const handleAddAttachment = async () => {
        if (!attachUrl.trim()) return;
        setAttaching(true); setAttachError("");
        try {
            await addAttachment(propertyId, attachType, attachUrl.trim());
            setAttachUrl("");
            reload();
        } catch (err) {
            setAttachError(err instanceof Error ? err.message : "上傳失敗");
        } finally {
            setAttaching(false);
        }
    };

    const handleDeleteAttachment = async (attachId: number) => {
        try {
            await deleteAttachment(propertyId, attachId);
            reload();
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : "刪除附件失敗");
        }
    };

    if (loading) {
        return <SiteLayout><div className="p-12 text-sm text-on-surface-variant">載入中...</div></SiteLayout>;
    }
    if (!property || !form) {
        return <SiteLayout><div className="p-12 text-sm text-error">物件不存在或無權限</div></SiteLayout>;
    }

    const progress = computeProgress(property);

    const photoAttachments = property.attachments.filter((a) => a.type === "PHOTO");
    const photoUrls = photoAttachments.map((a) => a.url);
    const photoAttachmentIds = photoAttachments.map((a) => a.id);

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-6 py-12 md:px-12">
                <div className="flex flex-col gap-2">
                    <Link to="/my/properties" className="text-sm text-on-surface-variant hover:text-primary-container">← 返回我的物件</Link>
                    <h1 className="text-4xl font-extrabold text-on-surface">{property.title || "未命名物件"}</h1>
                    <p className="text-sm text-on-surface-variant">{property.address}</p>
                </div>

                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-on-surface">物件完成度</span>
                        <span className="text-sm font-bold text-primary-container">{progress}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-surface-container-low overflow-hidden">
                        <div
                            className="h-full rounded-full bg-primary-container transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-on-surface-variant">
                        {[
                            ["名稱", Boolean(property.title)],
                            ["地址", Boolean(property.address)],
                            ["建物類型", Boolean(property.building_type)],
                            ["照片附件", property.attachments.some((a) => a.type === "PHOTO")],
                        ].map(([label, done]) => (
                            <span key={label as string} className={`flex items-center gap-1 ${done ? "text-[#2E7D32]" : "text-on-surface-variant"}`}>
                                <span className="material-symbols-outlined text-sm">{done ? "check_circle" : "radio_button_unchecked"}</span>
                                {label}
                            </span>
                        ))}
                    </div>
                </section>

                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <h2 className="mb-6 text-lg font-bold text-on-surface">Section A — 基本資料</h2>
                    <div className="grid gap-5 md:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-on-surface-variant">建物類型 *</label>
                            <select value={form.building_type} onChange={(e) => setField("building_type", e.target.value)} className={selectCls}>
                                <option value="">請選擇</option>
                                <option value="APARTMENT">公寓</option>
                                <option value="BUILDING">大樓</option>
                                <option value="TOWNHOUSE">透天</option>
                                <option value="STUDIO">套房</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-on-surface-variant">車位類型</label>
                            <select value={form.parking_type} onChange={(e) => setField("parking_type", e.target.value)} className={selectCls}>
                                <option value="NONE">無</option>
                                <option value="RAMP">坡道平面</option>
                                <option value="MECHANICAL">機械</option>
                                <option value="TOWER">塔式</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-on-surface-variant">樓層</label>
                            <input type="number" value={form.floor} onChange={(e) => setField("floor", e.target.value)} className={inputCls} placeholder="例：3" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-on-surface-variant">總樓層</label>
                            <input type="number" value={form.total_floors} onChange={(e) => setField("total_floors", e.target.value)} className={inputCls} placeholder="例：12" />
                        </div>
                        {[
                            ["主建物坪", "main_area"],
                            ["附屬建物坪", "auxiliary_area"],
                            ["陽台坪", "balcony_area"],
                            ["共有部份坪", "shared_area"],
                            ["雨遮坪", "awning_area"],
                            ["土地坪", "land_area"],
                        ].map(([label, key]) => (
                            <div key={key} className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-on-surface-variant">{label}</label>
                                <input
                                    type="number" step="0.01"
                                    value={form[key as keyof FormState] as string}
                                    onChange={(e) => setField(key as keyof FormState, e.target.value)}
                                    className={inputCls} placeholder="坪"
                                />
                            </div>
                        ))}
                        {[["房", "rooms"], ["廳", "living_rooms"], ["衛", "bathrooms"]].map(([label, key]) => (
                            <div key={key} className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-on-surface-variant">格局 — {label}</label>
                                <input
                                    type="number"
                                    value={form[key as keyof FormState] as string}
                                    onChange={(e) => setField(key as keyof FormState, e.target.value)}
                                    className={inputCls}
                                />
                            </div>
                        ))}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-on-surface-variant">屋齡（年）</label>
                            <input type="number" value={form.building_age} onChange={(e) => setField("building_age", e.target.value)} className={inputCls} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-on-surface-variant">管理費（月）</label>
                            <input type="number" value={form.management_fee} onChange={(e) => setField("management_fee", e.target.value)} className={inputCls} placeholder="0 = 無" />
                        </div>
                    </div>

                    <h2 className="mb-6 mt-10 text-lg font-bold text-on-surface">Section B — 物件詳情</h2>
                    <div className="grid gap-5 md:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-on-surface-variant">建物結構</label>
                            <select value={form.building_structure} onChange={(e) => setField("building_structure", e.target.value)} className={selectCls}>
                                <option value="">請選擇</option>
                                <option value="加強磚造">加強磚造</option>
                                <option value="鋼筋混凝土">鋼筋混凝土</option>
                                <option value="鋼骨">鋼骨</option>
                                <option value="木造">木造</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-on-surface-variant">外牆建材</label>
                            <input type="text" value={form.exterior_material} onChange={(e) => setField("exterior_material", e.target.value)} className={inputCls} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-on-surface-variant">建物朝向</label>
                            <select value={form.building_orientation} onChange={(e) => setField("building_orientation", e.target.value)} className={selectCls}>
                                <option value="">請選擇</option>
                                {["東","西","南","北","東南","西南","東北","西北"].map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-on-surface-variant">落地窗朝向</label>
                            <select value={form.window_orientation} onChange={(e) => setField("window_orientation", e.target.value)} className={selectCls}>
                                <option value="">請選擇</option>
                                {["東","西","南","北","東南","西南","東北","西北"].map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-on-surface-variant">警衛管理</label>
                            <select value={form.security_type} onChange={(e) => setField("security_type", e.target.value)} className={selectCls}>
                                <option value="NONE">無</option>
                                <option value="FULLTIME">全天候</option>
                                <option value="PARTTIME">部分時段</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-on-surface-variant">謄本用途</label>
                            <input type="text" value={form.building_usage} onChange={(e) => setField("building_usage", e.target.value)} className={inputCls} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-on-surface-variant">使用分區</label>
                            <input type="text" value={form.zoning} onChange={(e) => setField("zoning", e.target.value)} className={inputCls} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-on-surface-variant">該層戶數</label>
                            <input type="number" value={form.units_on_floor} onChange={(e) => setField("units_on_floor", e.target.value)} className={inputCls} />
                        </div>
                        <div className="flex items-center gap-6 md:col-span-2">
                            <label className="flex cursor-pointer items-center gap-2 text-sm text-on-surface-variant">
                                <input type="checkbox" checked={form.is_corner_unit} onChange={(e) => setField("is_corner_unit", e.target.checked)} className="h-4 w-4 rounded accent-primary-container" />
                                邊間
                            </label>
                            <label className="flex cursor-pointer items-center gap-2 text-sm text-on-surface-variant">
                                <input type="checkbox" checked={form.has_dark_room} onChange={(e) => setField("has_dark_room", e.target.checked)} className="h-4 w-4 rounded accent-primary-container" />
                                暗房
                            </label>
                        </div>
                    </div>

                    <div className="mt-8 flex flex-col gap-3">
                        {saveOk ? <p className="text-sm text-[#2E7D32]">✓ 已儲存</p> : null}
                        {saveError ? <p className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{saveError}</p> : null}
                        <button
                            type="button"
                            onClick={() => void handleSave()}
                            disabled={saving}
                            className="w-full rounded-xl bg-primary-container px-6 py-3 font-bold text-on-primary-container transition-opacity hover:opacity-90 disabled:opacity-40"
                        >
                            {saving ? "儲存中..." : "儲存物件資料"}
                        </button>
                    </div>
                </section>

                {/* Section C1 — 物件照片 */}
                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <h2 className="mb-1 text-lg font-bold text-on-surface">Section C1 — 物件照片</h2>
                    <p className="mb-6 text-xs text-on-surface-variant">最多 10 張。至少上傳一張後物件才會進入 READY 狀態可上架。</p>
                    <PropertyPhotoUploader
                        propertyId={propertyId}
                        photos={photoUrls}
                        attachmentIds={photoAttachmentIds}
                        onUploaded={reload}
                    />
                </section>

                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <h2 className="mb-4 text-lg font-bold text-on-surface">Section C2 — 其他附件</h2>
                    <p className="mb-6 text-xs text-on-surface-variant">格局圖、謄本、揭露文件等非照片附件請在此新增（以 URL 形式）。</p>

                    {property.attachments.length > 0 ? (
                        <div className="mb-6 flex flex-col gap-3">
                            {property.attachments.map((att) => (
                                <div key={att.id} className="flex items-center justify-between rounded-lg bg-surface-container-low px-4 py-3">
                                    <div>
                                        <span className="rounded-full bg-surface-container px-2 py-0.5 text-xs font-semibold text-on-surface-variant">{att.type}</span>
                                        <span className="ml-3 truncate text-sm text-on-surface">{att.url}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => void handleDeleteAttachment(att.id)}
                                        className="ml-4 bg-transparent text-sm text-error hover:underline"
                                    >
                                        刪除
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    <div className="flex flex-col gap-3 md:flex-row">
                        <select value={attachType} onChange={(e) => setAttachType(e.target.value as AttachmentType)} className={`${selectCls} md:w-44`}>
                            <option value="FLOOR_PLAN">格局圖</option>
                            <option value="DEED">謄本</option>
                            <option value="DISCLOSURE">揭露文件</option>
                        </select>
                        <input
                            type="url"
                            value={attachUrl}
                            onChange={(e) => setAttachUrl(e.target.value)}
                            placeholder="輸入附件 URL"
                            className={`${inputCls} flex-1`}
                        />
                        <button
                            type="button"
                            onClick={() => void handleAddAttachment()}
                            disabled={!attachUrl.trim() || attaching}
                            className="rounded-xl bg-primary-container px-5 py-3 font-bold text-on-primary-container transition-opacity hover:opacity-90 disabled:opacity-40 whitespace-nowrap"
                        >
                            {attaching ? "上傳中..." : "新增附件"}
                        </button>
                    </div>
                    {attachError ? <p className="mt-2 text-sm text-error">{attachError}</p> : null}
                </section>
            </main>
        </SiteLayout>
    );
}
