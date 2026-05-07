# Property Listing Frontend — Part 2 Implementation Plan
# (PropertyEditPage + RentalListingPage + SaleListingPage + Public List/Detail Pages)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Prerequisite:** Part 1 must be fully implemented before starting Part 2.

**Goal:** Build the full property edit form with completeness bar, the rental/sale listing condition forms, and the four public-facing list/detail pages.

**Architecture:** All pages follow the same pattern: `SiteLayout` + `useEffect` for load + `useState` for form state. The completeness bar is computed client-side from the four READY conditions (title + address + buildingType + ≥1 PHOTO). Public pages show listing data with embedded property summary.

**Tech Stack:** React 19, TypeScript strict, React Router v7, Tailwind, native fetch via API clients from Part 1.

---

## File Map

| Action | Path |
|---|---|
| Replace placeholder | `react-service/src/pages/PropertyEditPage.tsx` |
| Replace placeholder | `react-service/src/pages/RentalListingPage.tsx` |
| Replace placeholder | `react-service/src/pages/SaleListingPage.tsx` |
| Replace placeholder | `react-service/src/pages/RentListPage.tsx` |
| Replace placeholder | `react-service/src/pages/RentDetailPage.tsx` |
| Replace placeholder | `react-service/src/pages/SaleListPage.tsx` |
| Replace placeholder | `react-service/src/pages/SaleDetailPage.tsx` |

---

### Task 7: PropertyEditPage

Full edit form (Section A + B), attachment management, completeness bar, and listing launch buttons.

**Completeness gate logic (client-side, mirrors backend `computeSetupStatus`):**
- `title` non-empty → +25%
- `address` non-empty → +25%
- `building_type` non-empty → +25%
- `attachments` has ≥1 item with `type === "PHOTO"` → +25%
- Total 100% = `setup_status: "READY"` — listing buttons appear

**Files:**
- Replace placeholder: `react-service/src/pages/PropertyEditPage.tsx`

- [ ] **Step 1: Implement PropertyEditPage.tsx**

```tsx
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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

const ORIENTATIONS = ["東", "西", "南", "北", "東南", "西南", "東北", "西北"];

export default function PropertyEditPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const propertyId = id ? parseInt(id, 10) : NaN;

    const [property, setProperty] = useState<Property | null>(null);
    const [form, setForm] = useState<FormState | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");
    const [saveOk, setSaveOk] = useState(false);

    // Attachment upload state
    const [attachType, setAttachType] = useState<AttachmentType>("PHOTO");
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
    const isReady = property.setup_status === "READY";

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-6 py-12 md:px-12">
                {/* Header */}
                <div className="flex flex-col gap-2">
                    <Link to="/my/properties" className="text-sm text-on-surface-variant hover:text-primary-container">← 返回我的物件</Link>
                    <h1 className="text-4xl font-extrabold text-on-surface">{property.title || "未命名物件"}</h1>
                    <p className="text-sm text-on-surface-variant">{property.address}</p>
                </div>

                {/* Completeness bar */}
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

                {/* Form */}
                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <h2 className="mb-6 text-lg font-bold text-on-surface">Section A — 基本資料</h2>
                    <div className="grid gap-5 md:grid-cols-2">
                        {/* Title */}
                        <div className="flex flex-col gap-1.5 md:col-span-2">
                            <label className="text-xs font-semibold text-on-surface-variant">物件名稱 *</label>
                            <input type="text" value={form.title} onChange={(e) => setField("title", e.target.value)} className={inputCls} />
                        </div>
                        {/* Address */}
                        <div className="flex flex-col gap-1.5 md:col-span-2">
                            <label className="text-xs font-semibold text-on-surface-variant">地址 *</label>
                            <input type="text" value={form.address} onChange={(e) => setField("address", e.target.value)} className={inputCls} />
                        </div>
                        {/* Building type */}
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
                        {/* Parking type */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-on-surface-variant">車位類型</label>
                            <select value={form.parking_type} onChange={(e) => setField("parking_type", e.target.value)} className={selectCls}>
                                <option value="NONE">無</option>
                                <option value="RAMP">坡道平面</option>
                                <option value="MECHANICAL">機械</option>
                                <option value="TOWER">塔式</option>
                            </select>
                        </div>
                        {/* Floor / Total floors */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-on-surface-variant">樓層</label>
                            <input type="number" value={form.floor} onChange={(e) => setField("floor", e.target.value)} className={inputCls} placeholder="例：3" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-on-surface-variant">總樓層</label>
                            <input type="number" value={form.total_floors} onChange={(e) => setField("total_floors", e.target.value)} className={inputCls} placeholder="例：12" />
                        </div>
                        {/* Areas */}
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
                        {/* Layout */}
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
                        {/* Building age + management fee */}
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
                        {/* Checkboxes */}
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

                    {/* Save button */}
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

                {/* Attachments */}
                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <h2 className="mb-4 text-lg font-bold text-on-surface">Section C — 可信附件</h2>
                    <p className="mb-6 text-xs text-on-surface-variant">至少上傳一張照片後，物件才會變成 READY 狀態並可上架。</p>

                    {/* Existing attachments */}
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

                    {/* Add attachment */}
                    <div className="flex flex-col gap-3 md:flex-row">
                        <select value={attachType} onChange={(e) => setAttachType(e.target.value as AttachmentType)} className={`${selectCls} md:w-44`}>
                            <option value="PHOTO">照片</option>
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

                {/* Listing launch buttons */}
                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <h2 className="mb-2 text-lg font-bold text-on-surface">上架刊登</h2>
                    {isReady ? (
                        <div className="flex flex-col gap-3 md:flex-row">
                            <button
                                type="button"
                                onClick={() => navigate(`/my/properties/${propertyId}/rent`)}
                                className="flex-1 rounded-xl bg-[#E8A000] px-6 py-3 font-bold text-white transition-opacity hover:opacity-90"
                            >
                                上架出租
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate(`/my/properties/${propertyId}/sale`)}
                                className="flex-1 rounded-xl bg-[#2196F3] px-6 py-3 font-bold text-white transition-opacity hover:opacity-90"
                            >
                                上架出售
                            </button>
                        </div>
                    ) : (
                        <p className="text-sm text-on-surface-variant">物件完成度達 100%（名稱＋地址＋建物類型＋照片）後，上架按鈕才會出現。</p>
                    )}
                </section>
            </main>
        </SiteLayout>
    );
}
```

- [ ] **Step 2: Lint check**

```bash
cd react-service && npm run lint
```

Expected: 0 errors.

- [ ] **Step 3: Verify in browser**

Log in as OWNER, create a property (Part 1 Task 6). Navigate to `/my/properties/:id`.
- Completeness bar shows 50% (title + address filled, no building_type, no photo).
- Fill in building_type → bar updates to 75%.
- Add a PHOTO attachment URL → bar updates to 100%, "上架出租"/"上架出售" buttons appear.
- Save form → refreshes with saved values.

- [ ] **Step 4: Commit**

```bash
git add react-service/src/pages/PropertyEditPage.tsx
git commit -m "feat: implement PropertyEditPage with completeness bar and attachment management"
```

---

### Task 8: RentalListingPage

Create or edit rental listing conditions for a property. Shows existing listing (if any) with publish/close actions.

**Files:**
- Replace placeholder: `react-service/src/pages/RentalListingPage.tsx`

- [ ] **Step 1: Implement RentalListingPage.tsx**

```tsx
import { useEffect, useState } from "react";
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

    const reload = async () => {
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
    };

    useEffect(() => { if (!isNaN(propertyId)) void reload(); }, [propertyId]);

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
```

- [ ] **Step 2: Lint check**

```bash
cd react-service && npm run lint
```

Expected: 0 errors.

- [ ] **Step 3: Verify in browser**

Navigate to `/my/properties/:id/rent` (must be a READY property).
- Empty form shown if no listing exists.
- Fill in monthly_rent (e.g. 20000), deposit_months (2), click "建立出租刊登" → listing created.
- Page reloads showing status "草稿" and "上架" button.
- Click "上架" → status changes to "上架中", "下架" button appears.

- [ ] **Step 4: Commit**

```bash
git add react-service/src/pages/RentalListingPage.tsx
git commit -m "feat: implement RentalListingPage"
```

---

### Task 9: SaleListingPage

Same structure as RentalListingPage but for sale conditions.

**Files:**
- Replace placeholder: `react-service/src/pages/SaleListingPage.tsx`

- [ ] **Step 1: Implement SaleListingPage.tsx**

```tsx
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
    closeSaleListing,
    createSaleListing,
    getSaleListingForProperty,
    publishSaleListing,
    updateSaleListing,
    type CreateSaleListingPayload,
    type SaleListing,
} from "../api/saleListingApi";
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

export default function SaleListingPage() {
    const { id } = useParams<{ id: string }>();
    const propertyId = id ? parseInt(id, 10) : NaN;

    const [property, setProperty] = useState<Property | null>(null);
    const [listing, setListing] = useState<SaleListing | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState({ ok: "", err: "" });

    const reload = async () => {
        setLoading(true);
        try {
            const [prop, sl] = await Promise.all([
                getProperty(propertyId),
                getSaleListingForProperty(propertyId),
            ]);
            setProperty(prop);
            setListing(sl);
            setForm(sl ? listingToForm(sl) : EMPTY_FORM);
        } catch (err) {
            setMsg({ ok: "", err: err instanceof Error ? err.message : "載入失敗" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { if (!isNaN(propertyId)) void reload(); }, [propertyId]);

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

    if (loading) return <SiteLayout><div className="p-12 text-sm text-on-surface-variant">載入中...</div></SiteLayout>;

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[720px] flex-col gap-8 px-6 py-12 md:px-12">
                <div className="flex flex-col gap-2">
                    <Link to={`/my/properties/${propertyId}`} className="text-sm text-on-surface-variant hover:text-primary-container">
                        ← 返回物件編輯
                    </Link>
                    <h1 className="text-4xl font-extrabold text-on-surface">出售條件</h1>
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
            </main>
        </SiteLayout>
    );
}
```

- [ ] **Step 2: Lint + browser verify**

```bash
cd react-service && npm run lint
```

Navigate to `/my/properties/:id/sale`. Create a sale listing, publish it.

- [ ] **Step 3: Commit**

```bash
git add react-service/src/pages/SaleListingPage.tsx
git commit -m "feat: implement SaleListingPage"
```

---

### Task 10: RentListPage + RentDetailPage

**Files:**
- Replace placeholder: `react-service/src/pages/RentListPage.tsx`
- Replace placeholder: `react-service/src/pages/RentDetailPage.tsx`

- [ ] **Step 1: Implement RentListPage.tsx**

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRentalListings, type RentalListing } from "../api/rentalListingApi";
import SiteLayout from "../layouts/SiteLayout";

function formatLayout(rl: RentalListing): string {
    const p = rl.property;
    if (!p) return "";
    const parts = [];
    if (p.rooms != null) parts.push(`${p.rooms}房`);
    if (p.living_rooms != null) parts.push(`${p.living_rooms}廳`);
    if (p.bathrooms != null) parts.push(`${p.bathrooms}衛`);
    return parts.join("");
}

export default function RentListPage() {
    const navigate = useNavigate();
    const [items, setItems] = useState<RentalListing[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        getRentalListings()
            .then(setItems)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "讀取租屋列表失敗"))
            .finally(() => setLoading(false));
    }, []);

    return (
        <SiteLayout>
            <section className="w-full bg-gradient-to-r from-surface to-surface-container-low py-12 md:py-16">
                <div className="mx-auto max-w-[1440px] px-6 md:px-12">
                    <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">出租物件</h1>
                    <p className="max-w-2xl text-base leading-[1.75] text-on-surface-variant md:text-lg">
                        瀏覽平台上已公開的出租房源，快速找到合適物件。
                    </p>
                </div>
            </section>

            <section className="w-full bg-surface py-12">
                <div className="mx-auto max-w-[1440px] px-6 md:px-12">
                    {loading ? (
                        <div className="flex items-center justify-center py-32">
                            <span className="animate-pulse text-sm text-on-surface-variant">讀取租屋中...</span>
                        </div>
                    ) : error ? (
                        <div className="rounded-xl border border-error/20 bg-error-container p-8 text-sm text-on-error-container">{error}</div>
                    ) : items.length === 0 ? (
                        <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center">
                            <h2 className="text-2xl font-bold text-on-surface">目前沒有公開的租屋物件</h2>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-5">
                            {items.map((item) => (
                                <article
                                    key={item.id}
                                    className="cursor-pointer rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 transition-transform hover:-translate-y-0.5"
                                    onClick={() => navigate(`/rent/${item.id}`)}
                                >
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div className="flex-1">
                                            <div className="mb-2 flex flex-wrap gap-2">
                                                {item.property?.building_type ? (
                                                    <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
                                                        {item.property.building_type}
                                                    </span>
                                                ) : null}
                                                {formatLayout(item) ? (
                                                    <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">{formatLayout(item)}</span>
                                                ) : null}
                                                {item.allow_pets ? <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">可養寵物</span> : null}
                                            </div>
                                            <h2 className="text-lg font-bold text-on-surface">
                                                {item.property?.title ?? `出租 #${item.id}`}
                                            </h2>
                                            <p className="mt-1 text-sm text-on-surface-variant">
                                                {item.property?.address ?? "地址未提供"}
                                            </p>
                                            {item.property?.main_area ? (
                                                <p className="mt-1 text-xs text-on-surface-variant">{item.property.main_area} 坪</p>
                                            ) : null}
                                        </div>
                                        <div className="text-left md:text-right">
                                            <p className="text-2xl font-extrabold text-on-surface">
                                                NT$ {item.monthly_rent.toLocaleString()}
                                                <span className="ml-1 text-base font-normal text-on-surface-variant">/ 月</span>
                                            </p>
                                            <p className="mt-1 text-xs text-on-surface-variant">押金 {item.deposit_months} 個月</p>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </SiteLayout>
    );
}
```

- [ ] **Step 2: Implement RentDetailPage.tsx**

```tsx
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getRentalListing, type RentalListing } from "../api/rentalListingApi";
import SiteLayout from "../layouts/SiteLayout";

const FEE_PAYER_LABEL: Record<string, string> = { TENANT: "租客負擔", OWNER: "房東負擔", SPLIT: "各半" };

export default function RentDetailPage() {
    const { id } = useParams<{ id: string }>();
    const listingId = id ? parseInt(id, 10) : NaN;
    const [listing, setListing] = useState<RentalListing | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (isNaN(listingId)) return;
        getRentalListing(listingId)
            .then(setListing)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "讀取失敗"))
            .finally(() => setLoading(false));
    }, [listingId]);

    if (loading) return <SiteLayout><div className="p-12 text-sm text-on-surface-variant">載入中...</div></SiteLayout>;
    if (error || !listing) return <SiteLayout><div className="p-12 text-sm text-error">{error || "找不到此刊登"}</div></SiteLayout>;

    const p = listing.property;

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-6 py-12 md:px-12">
                <Link to="/rent" className="text-sm text-on-surface-variant hover:text-primary-container">← 出租物件列表</Link>

                {/* Property summary */}
                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <h1 className="text-3xl font-extrabold text-on-surface">{p?.title ?? `出租 #${listing.id}`}</h1>
                    <p className="mt-2 text-sm text-on-surface-variant">{p?.address ?? ""}</p>
                    {p ? (
                        <div className="mt-4 flex flex-wrap gap-4 text-sm text-on-surface-variant">
                            {p.building_type ? <span>{p.building_type}</span> : null}
                            {p.floor != null ? <span>{p.floor}F / {p.total_floors}F</span> : null}
                            {p.main_area != null ? <span>主建物 {p.main_area} 坪</span> : null}
                            {p.rooms != null ? <span>{p.rooms}房{p.living_rooms}廳{p.bathrooms}衛</span> : null}
                            {p.building_age != null ? <span>屋齡 {p.building_age} 年</span> : null}
                            {p.building_orientation ? <span>朝向 {p.building_orientation}</span> : null}
                        </div>
                    ) : null}
                </section>

                {/* Rental conditions */}
                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <h2 className="mb-6 text-xl font-bold text-on-surface">出租條件</h2>
                    <dl className="grid gap-4 md:grid-cols-2">
                        {[
                            ["月租金", `NT$ ${listing.monthly_rent.toLocaleString()} / 月`],
                            ["押金", `${listing.deposit_months} 個月`],
                            ["管理費", FEE_PAYER_LABEL[listing.management_fee_payer] ?? listing.management_fee_payer],
                            ["最短租期", `${listing.min_lease_months} 個月`],
                            ["可養寵物", listing.allow_pets ? "是" : "否"],
                            ["可炊煮", listing.allow_cooking ? "是" : "否"],
                            ...(listing.gender_restriction ? [["性別限制", listing.gender_restriction]] : []),
                            ...(listing.expires_at ? [["刊登到期", new Date(listing.expires_at).toLocaleDateString("zh-TW")]] : []),
                        ].map(([label, value]) => (
                            <div key={label as string} className="flex flex-col gap-1 rounded-lg bg-surface-container-low p-4">
                                <dt className="text-xs font-semibold text-on-surface-variant">{label}</dt>
                                <dd className="text-sm font-bold text-on-surface">{value}</dd>
                            </div>
                        ))}
                    </dl>
                    {listing.notes ? (
                        <div className="mt-4 rounded-lg bg-surface-container-low p-4">
                            <p className="text-xs font-semibold text-on-surface-variant">備注</p>
                            <p className="mt-1 text-sm text-on-surface">{listing.notes}</p>
                        </div>
                    ) : null}
                </section>
            </main>
        </SiteLayout>
    );
}
```

- [ ] **Step 3: Lint check**

```bash
cd react-service && npm run lint
```

Expected: 0 errors.

- [ ] **Step 4: Verify in browser**

Navigate to `http://localhost:5173/rent`. If no ACTIVE rental listings exist, publish one from `/my/properties/:id/rent` first.
- List shows property address, layout, monthly rent.
- Click a card → `/rent/:id` shows full detail with property summary and rental conditions.

- [ ] **Step 5: Commit**

```bash
git add react-service/src/pages/RentListPage.tsx react-service/src/pages/RentDetailPage.tsx
git commit -m "feat: implement RentListPage and RentDetailPage"
```

---

### Task 11: SaleListPage + SaleDetailPage

**Files:**
- Replace placeholder: `react-service/src/pages/SaleListPage.tsx`
- Replace placeholder: `react-service/src/pages/SaleDetailPage.tsx`

- [ ] **Step 1: Implement SaleListPage.tsx**

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSaleListings, type SaleListing } from "../api/saleListingApi";
import SiteLayout from "../layouts/SiteLayout";

function formatLayout(sl: SaleListing): string {
    const p = sl.property;
    if (!p) return "";
    const parts = [];
    if (p.rooms != null) parts.push(`${p.rooms}房`);
    if (p.living_rooms != null) parts.push(`${p.living_rooms}廳`);
    if (p.bathrooms != null) parts.push(`${p.bathrooms}衛`);
    return parts.join("");
}

export default function SaleListPage() {
    const navigate = useNavigate();
    const [items, setItems] = useState<SaleListing[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        getSaleListings()
            .then(setItems)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "讀取售屋列表失敗"))
            .finally(() => setLoading(false));
    }, []);

    return (
        <SiteLayout>
            <section className="w-full bg-gradient-to-r from-surface to-surface-container-low py-12 md:py-16">
                <div className="mx-auto max-w-[1440px] px-6 md:px-12">
                    <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">出售物件</h1>
                    <p className="max-w-2xl text-base leading-[1.75] text-on-surface-variant md:text-lg">
                        瀏覽平台上已公開的出售房源，依行政區、總價快速找到合適物件。
                    </p>
                </div>
            </section>

            <section className="w-full bg-surface py-12">
                <div className="mx-auto max-w-[1440px] px-6 md:px-12">
                    {loading ? (
                        <div className="flex items-center justify-center py-32">
                            <span className="animate-pulse text-sm text-on-surface-variant">讀取售屋中...</span>
                        </div>
                    ) : error ? (
                        <div className="rounded-xl border border-error/20 bg-error-container p-8 text-sm text-on-error-container">{error}</div>
                    ) : items.length === 0 ? (
                        <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center">
                            <h2 className="text-2xl font-bold text-on-surface">目前沒有公開的出售物件</h2>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-5">
                            {items.map((item) => (
                                <article
                                    key={item.id}
                                    className="cursor-pointer rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 transition-transform hover:-translate-y-0.5"
                                    onClick={() => navigate(`/sale/${item.id}`)}
                                >
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div className="flex-1">
                                            <div className="mb-2 flex flex-wrap gap-2">
                                                {item.property?.building_type ? (
                                                    <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">{item.property.building_type}</span>
                                                ) : null}
                                                {formatLayout(item) ? (
                                                    <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">{formatLayout(item)}</span>
                                                ) : null}
                                            </div>
                                            <h2 className="text-lg font-bold text-on-surface">
                                                {item.property?.title ?? `出售 #${item.id}`}
                                            </h2>
                                            <p className="mt-1 text-sm text-on-surface-variant">{item.property?.address ?? "地址未提供"}</p>
                                            {item.property?.main_area ? (
                                                <p className="mt-1 text-xs text-on-surface-variant">{item.property.main_area} 坪</p>
                                            ) : null}
                                        </div>
                                        <div className="text-left md:text-right">
                                            <p className="text-2xl font-extrabold text-on-surface">
                                                NT$ {item.total_price.toLocaleString()}
                                            </p>
                                            {item.unit_price_per_ping != null ? (
                                                <p className="mt-1 text-xs text-on-surface-variant">單坪 NT$ {item.unit_price_per_ping.toLocaleString()}</p>
                                            ) : null}
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </SiteLayout>
    );
}
```

- [ ] **Step 2: Implement SaleDetailPage.tsx**

```tsx
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getSaleListing, type SaleListing } from "../api/saleListingApi";
import SiteLayout from "../layouts/SiteLayout";

export default function SaleDetailPage() {
    const { id } = useParams<{ id: string }>();
    const listingId = id ? parseInt(id, 10) : NaN;
    const [listing, setListing] = useState<SaleListing | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (isNaN(listingId)) return;
        getSaleListing(listingId)
            .then(setListing)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "讀取失敗"))
            .finally(() => setLoading(false));
    }, [listingId]);

    if (loading) return <SiteLayout><div className="p-12 text-sm text-on-surface-variant">載入中...</div></SiteLayout>;
    if (error || !listing) return <SiteLayout><div className="p-12 text-sm text-error">{error || "找不到此刊登"}</div></SiteLayout>;

    const p = listing.property;

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-6 py-12 md:px-12">
                <Link to="/sale" className="text-sm text-on-surface-variant hover:text-primary-container">← 出售物件列表</Link>

                {/* Property summary */}
                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <h1 className="text-3xl font-extrabold text-on-surface">{p?.title ?? `出售 #${listing.id}`}</h1>
                    <p className="mt-2 text-sm text-on-surface-variant">{p?.address ?? ""}</p>
                    {p ? (
                        <div className="mt-4 flex flex-wrap gap-4 text-sm text-on-surface-variant">
                            {p.building_type ? <span>{p.building_type}</span> : null}
                            {p.floor != null ? <span>{p.floor}F / {p.total_floors}F</span> : null}
                            {p.main_area != null ? <span>主建物 {p.main_area} 坪</span> : null}
                            {p.rooms != null ? <span>{p.rooms}房{p.living_rooms}廳{p.bathrooms}衛</span> : null}
                            {p.building_age != null ? <span>屋齡 {p.building_age} 年</span> : null}
                            {p.building_orientation ? <span>朝向 {p.building_orientation}</span> : null}
                        </div>
                    ) : null}
                </section>

                {/* Sale conditions */}
                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <h2 className="mb-6 text-xl font-bold text-on-surface">出售條件</h2>
                    <dl className="grid gap-4 md:grid-cols-2">
                        {[
                            ["總價", `NT$ ${listing.total_price.toLocaleString()}`],
                            ...(listing.unit_price_per_ping != null ? [["單坪價", `NT$ ${listing.unit_price_per_ping.toLocaleString()}`]] : []),
                            ...(listing.parking_type ? [["車位類型", listing.parking_type]] : []),
                            ...(listing.parking_price != null ? [["車位價格", `NT$ ${listing.parking_price.toLocaleString()}`]] : []),
                            ...(listing.expires_at ? [["刊登到期", new Date(listing.expires_at).toLocaleDateString("zh-TW")]] : []),
                        ].map(([label, value]) => (
                            <div key={label as string} className="flex flex-col gap-1 rounded-lg bg-surface-container-low p-4">
                                <dt className="text-xs font-semibold text-on-surface-variant">{label}</dt>
                                <dd className="text-sm font-bold text-on-surface">{value}</dd>
                            </div>
                        ))}
                    </dl>
                    {listing.notes ? (
                        <div className="mt-4 rounded-lg bg-surface-container-low p-4">
                            <p className="text-xs font-semibold text-on-surface-variant">備注</p>
                            <p className="mt-1 text-sm text-on-surface">{listing.notes}</p>
                        </div>
                    ) : null}
                </section>
            </main>
        </SiteLayout>
    );
}
```

- [ ] **Step 3: Lint check**

```bash
cd react-service && npm run lint
```

Expected: 0 errors.

- [ ] **Step 4: Verify in browser**

Navigate to `http://localhost:5173/sale`. Publish a sale listing from `/my/properties/:id/sale` if needed.
- List shows property address, layout, total price.
- Click a card → `/sale/:id` shows full detail.

- [ ] **Step 5: Commit**

```bash
git add react-service/src/pages/SaleListPage.tsx react-service/src/pages/SaleDetailPage.tsx
git commit -m "feat: implement SaleListPage and SaleDetailPage"
```

---

## End of Part 2

### 完整驗證清單

After all tasks complete, do a full end-to-end smoke test:

1. **Header nav**: `/sale` and `/rent` links appear, "房源列表" is gone
2. **Legacy redirects**: `/listings` → `/sale`, `/my/listings` → `/my/properties`
3. **MyPropertiesPage** (`/my/properties`): lists existing properties, "新增物件" navigates to create
4. **PropertyCreatePage** (`/my/properties/new`): creates property, redirects to edit
5. **PropertyEditPage** (`/my/properties/:id`): completeness bar updates correctly, save works, attachment upload shows READY gate
6. **RentalListingPage** (`/my/properties/:id/rent`): create → publish flow works, status badge updates
7. **SaleListingPage** (`/my/properties/:id/sale`): same flow as rental
8. **RentListPage** (`/rent`): shows ACTIVE rental listings with property data
9. **RentDetailPage** (`/rent/:id`): shows full rental + property detail
10. **SaleListPage** (`/sale`): shows ACTIVE sale listings with property data
11. **SaleDetailPage** (`/sale/:id`): shows full sale + property detail

Then invoke `superpowers:finishing-a-development-branch`.
