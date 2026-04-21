import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    getListing,
    updateListing,
    publishListing,
    removeListing,
    closeListing,
    lockNegotiation,
    unlockNegotiation,
    bookAppointment,
    confirmAppointment,
    updateAppointmentStatus,
    cancelAppointment,
    type Listing,
    type UpdateListingPayload,
} from "../api/listingApi";
import { getAuthMe } from "../api/authApi";
import SiteLayout from "../layouts/SiteLayout";

// ── DEV: Placeholder detail data — remove once API returns real listings ───────

const PLACEHOLDER_DETAIL: Listing = {
    id: -1, owner_user_id: 0,
    title: "光影交織 頂層公寓",
    description: "位於市中心靜巷，擁有大面積採光與通風極佳的開放式格局，感受城市中的寧靜綠洲。採用日式侘寂美學，以清水模牆面與溫潤木質元素交織，打造出獨一無二的居住體驗。",
    address: "台北市信義區松智路 1 號", district: "信義區",
    list_type: "RENT", price: 28500,
    area_ping: 35, floor: 12, total_floors: 15, room_count: 2, bathroom_count: 1,
    is_pet_allowed: false, is_parking_included: false, status: "ACTIVE",
    daily_fee_ntd: 0, is_owner: false,
    appointments: [],
    image_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuAvnwn6liX077rFOLI29BcZXNIzvYrzHCqPpY3lw0kNafinlaI8fUFY9urZSbhFtdDQHr_fVIym5enkBV35AgfyydepDMhVZcI-pnrQEqlEAqZNLp9L5fLmGEVODD9gLOiienWNRArOw55WkXx0ItTeDdxQGTdS-_Y5P5la7ueGQH_oFw2XZZSQCK0gO2-Q48gEAe3MVWYeTzs5MIQFVCwlxblvL_aaRWAgO7e2jBSdZRcaE8OyMSNrByas2KU3V4Dy7KItc-kPj3CM", // DEV
    created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
};

// DEV: gallery thumbnail images for placeholder detail page
const PLACEHOLDER_THUMBS = [
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBvjIGvZiYNYunDSI7W6iA4lxF4XRXBm1G1Dn55liKeN2ZgvKonIqmGthpCJAsQiHsvnKwp-4SFc2vWniEdRm2gCrjuO6EkQe84ro7StMIGGWKazVWNFEdKJd53BcjRuOZbykFNENNkZt-hHVsPZhEFLyvdvxOfy3TYY1nhbdmiBvuuGQW5X8ITwL8hdDBBGmKBX100n49NdR4rIsygoFdIR2yKs2bk461ube2yNOXoJ0vin9NYw43mgx8offPhZtWqwv-VfOJfwdWE",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCs0FimIIqw1Sn3Ql8AoWXwp9dByEvqLCb8iQqJ4przjtWNlFuuIM1m1TA-Jex1Ef2R4ZBSIk9_fvEQVmNwKSSZm26htxBOB-SfDKO2hNVe_tnD9DBEz5waUNWtQ9xVVL1Zf8kuCt036m32hmSkwn161fMTPmnKBi-jSPFVwrEoo6tUKlWQITIR1ApJfY_aKsbkM7CV7fagZBAjGN0TRaxooWDx5K3FEk7O-GJF04rdkex0nAbQhNKWFCT4PMKfci-2eUcZUeJ0t3G6",
];

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
    DRAFT:       "DRAFT",
    ACTIVE:      "ACTIVE",
    NEGOTIATING: "NEGOTIATING",
    LOCKED:      "LOCKED",
    SIGNING:     "SIGNING",
    CLOSED:      "CLOSED",
    EXPIRED:     "EXPIRED",
    REMOVED:     "REMOVED",
    SUSPENDED:   "SUSPENDED",
};

const APPT_STATUS_LABEL: Record<string, string> = {
    PENDING:    "待確認",
    CONFIRMED:  "已確認",
    VIEWED:     "已看房",
    INTERESTED: "有意願",
    CANCELLED:  "已取消",
};

// ── Input style ────────────────────────────────────────────────────────────────

const inputCls =
    "block w-full px-4 py-3 bg-surface-container-low text-on-surface rounded-lg border-0 " +
    "focus:ring-2 focus:ring-primary-container transition-colors text-sm outline-none placeholder:text-outline";

// ── Form helpers ───────────────────────────────────────────────────────────────

const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-on-surface-variant">{label}</label>
        {children}
    </div>
);

const Btn = ({
    children, onClick, variant = "primary", disabled = false,
}: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: "primary" | "secondary" | "danger";
    disabled?: boolean;
}) => {
    const cls = {
        primary:   "px-5 py-2.5 rounded-lg text-sm font-bold bg-primary-container text-on-surface hover:bg-inverse-primary transition-colors disabled:opacity-50",
        secondary: "px-5 py-2.5 rounded-lg text-sm font-medium text-on-surface border border-outline-variant/50 bg-transparent hover:bg-surface-container transition-colors disabled:opacity-50",
        danger:    "px-5 py-2.5 rounded-lg text-sm font-bold text-error bg-transparent hover:bg-error-container transition-colors disabled:opacity-50",
    }[variant];
    return <button type="button" className={cls} onClick={onClick} disabled={disabled}>{children}</button>;
};

// ── Publish form ───────────────────────────────────────────────────────────────

function PublishForm({ onSubmit, onCancel }: { onSubmit: (d: number) => void; onCancel: () => void }) {
    const [days, setDays] = useState(30);
    return (
        <div className="flex flex-col gap-5">
            <FormField label="上架天數">
                <input type="number" className={inputCls} min={7} max={180} value={days}
                    onChange={(e) => setDays(Number(e.target.value))} />
                <p className="text-xs text-on-surface-variant mt-1">費用：NT$ {(days * 40).toLocaleString()}（NT$40 / 天）</p>
            </FormField>
            <div className="flex justify-end gap-3">
                <Btn variant="secondary" onClick={onCancel}>取消</Btn>
                <Btn onClick={() => onSubmit(days)}>確認上架</Btn>
            </div>
        </div>
    );
}

// ── Booking form ───────────────────────────────────────────────────────────────

function BookingForm({ onSubmit, onCancel }: { onSubmit: (t: string, n: string) => void; onCancel: () => void }) {
    const [preferredTime, setPreferredTime] = useState("");
    const [note, setNote] = useState("");
    return (
        <div className="flex flex-col gap-5">
            <FormField label="希望看房時間">
                <input type="datetime-local" className={inputCls} value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)} />
            </FormField>
            <FormField label="備註（選填）">
                <input type="text" className={inputCls} placeholder="例：下午方便，請確認可行"
                    value={note} onChange={(e) => setNote(e.target.value)} />
            </FormField>
            <div className="flex justify-end gap-3">
                <Btn variant="secondary" onClick={onCancel}>取消</Btn>
                <Btn disabled={!preferredTime} onClick={() => onSubmit(new Date(preferredTime).toISOString(), note)}>
                    送出預約
                </Btn>
            </div>
        </div>
    );
}

// ── Edit form ──────────────────────────────────────────────────────────────────

function EditForm({ listing, onSubmit, onCancel }: {
    listing: Listing; onSubmit: (p: UpdateListingPayload) => void; onCancel: () => void;
}) {
    const [form, setForm] = useState<UpdateListingPayload>({
        title: listing.title, description: listing.description ?? "",
        address: listing.address, district: listing.district ?? "",
        price: listing.price, area_ping: listing.area_ping, floor: listing.floor,
        total_floors: listing.total_floors, room_count: listing.room_count,
        bathroom_count: listing.bathroom_count,
        is_pet_allowed: listing.is_pet_allowed, is_parking_included: listing.is_parking_included,
    });
    const set = <K extends keyof UpdateListingPayload>(k: K, v: UpdateListingPayload[K]) =>
        setForm((p) => ({ ...p, [k]: v }));
    return (
        <div className="flex flex-col gap-4">
            <FormField label="標題"><input className={inputCls} value={form.title} onChange={(e) => set("title", e.target.value)} /></FormField>
            <FormField label="地址"><input className={inputCls} value={form.address} onChange={(e) => set("address", e.target.value)} /></FormField>
            <FormField label="行政區"><input className={inputCls} value={form.district ?? ""} onChange={(e) => set("district", e.target.value)} /></FormField>
            <div className="grid grid-cols-2 gap-3">
                <FormField label="價格（NT$）">
                    <input type="number" className={inputCls} value={form.price} onChange={(e) => set("price", Number(e.target.value))} />
                </FormField>
                <FormField label="坪數">
                    <input type="number" className={inputCls} value={form.area_ping ?? ""}
                        onChange={(e) => set("area_ping", e.target.value ? Number(e.target.value) : undefined)} />
                </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <FormField label="樓層">
                    <input type="number" className={inputCls} value={form.floor ?? ""}
                        onChange={(e) => set("floor", e.target.value ? Number(e.target.value) : undefined)} />
                </FormField>
                <FormField label="總樓層">
                    <input type="number" className={inputCls} value={form.total_floors ?? ""}
                        onChange={(e) => set("total_floors", e.target.value ? Number(e.target.value) : undefined)} />
                </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <FormField label="房數">
                    <input type="number" className={inputCls} value={form.room_count ?? ""}
                        onChange={(e) => set("room_count", e.target.value ? Number(e.target.value) : undefined)} />
                </FormField>
                <FormField label="衛浴">
                    <input type="number" className={inputCls} value={form.bathroom_count ?? ""}
                        onChange={(e) => set("bathroom_count", e.target.value ? Number(e.target.value) : undefined)} />
                </FormField>
            </div>
            <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
                    <input type="checkbox" checked={form.is_pet_allowed} onChange={(e) => set("is_pet_allowed", e.target.checked)} /> 可養寵物
                </label>
                <label className="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
                    <input type="checkbox" checked={form.is_parking_included} onChange={(e) => set("is_parking_included", e.target.checked)} /> 含車位
                </label>
            </div>
            <FormField label="描述">
                <textarea className={inputCls} rows={4} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
            </FormField>
            <div className="flex justify-end gap-3">
                <Btn variant="secondary" onClick={onCancel}>取消</Btn>
                <Btn onClick={() => onSubmit(form)}>儲存</Btn>
            </div>
        </div>
    );
}

// ── Confirm appt time form ─────────────────────────────────────────────────────

function ConfirmApptForm({ onSubmit, onCancel }: { onSubmit: (t: string) => void; onCancel: () => void }) {
    const [time, setTime] = useState("");
    return (
        <div className="flex flex-col gap-5">
            <FormField label="確認看房時間">
                <input type="datetime-local" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} />
            </FormField>
            <div className="flex justify-end gap-3">
                <Btn variant="secondary" onClick={onCancel}>取消</Btn>
                <Btn disabled={!time} onClick={() => onSubmit(new Date(time).toISOString())}>確認</Btn>
            </div>
        </div>
    );
}

// ── Modal ──────────────────────────────────────────────────────────────────────

function Modal({ isOpen, title, onClose, children }: {
    isOpen: boolean; title: string; onClose: () => void; children: React.ReactNode;
}) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-surface-container-lowest rounded-xl shadow-[0_24px_64px_rgba(28,25,23,0.18)] w-full max-w-lg max-h-[90vh] overflow-y-auto border border-outline-variant/10">
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-container">
                    <h2 className="text-base font-bold text-on-surface">{title}</h2>
                    <button type="button" onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors bg-transparent">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div className="px-6 py-5">{children}</div>
            </div>
        </div>
    );
}

// ── Confirm dialog ─────────────────────────────────────────────────────────────

function ConfirmDialog({ isOpen, title, description, onConfirm, onCancel, isLoading }: {
    isOpen: boolean; title: string; description: string;
    onConfirm: () => void; onCancel: () => void; isLoading: boolean;
}) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onCancel} />
            <div className="relative bg-surface-container-lowest rounded-xl shadow-[0_24px_64px_rgba(28,25,23,0.18)] w-full max-w-sm p-6 border border-outline-variant/10">
                <h2 className="text-base font-bold text-on-surface mb-2">{title}</h2>
                <p className="text-sm text-on-surface-variant mb-6">{description}</p>
                <div className="flex justify-end gap-3">
                    <Btn variant="secondary" onClick={onCancel} disabled={isLoading}>取消</Btn>
                    <Btn variant="danger" onClick={onConfirm} disabled={isLoading}>{isLoading ? "處理中…" : "確定"}</Btn>
                </div>
            </div>
        </div>
    );
}

// ── Main page ──────────────────────────────────────────────────────────────────

type ModalType    = "publish" | "edit" | "book" | "confirm-appt" | null;
type ConfirmType  = "remove" | "close" | "unlock" | null;

const ListingDetailPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [listing, setListing]               = useState<Listing | null>(null);
    const [isLoading, setIsLoading]           = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [successMsg, setSuccessMsg]         = useState("");
    const [errorMsg, setErrorMsg]             = useState("");
    const [modal, setModal]                   = useState<ModalType>(null);
    const [confirmAction, setConfirmAction]   = useState<ConfirmType>(null);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [confirmApptId, setConfirmApptId]   = useState<number | null>(null);

    const listingId = id ? parseInt(id, 10) : NaN;

    const load = async () => {
        if (isNaN(listingId)) { setErrorMsg("房源 ID 無效"); setIsLoading(false); return; }
        // DEV: negative IDs are placeholder listings — skip API call
        if (listingId < 0) { setListing({ ...PLACEHOLDER_DETAIL, id: listingId }); setIsLoading(false); return; }
        try {
            setIsLoading(true);
            setErrorMsg("");
            setListing(await getListing(listingId));
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : "載入失敗");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void load();
        void getAuthMe().then((a) => setIsAuthenticated(a.authenticated)).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listingId]);

    const act = async (fn: () => Promise<void>, msg: string) => {
        try {
            setIsActionLoading(true); setErrorMsg(""); setSuccessMsg("");
            await fn(); setSuccessMsg(msg); await load();
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : "操作失敗");
        } finally {
            setIsActionLoading(false); setConfirmAction(null); setModal(null);
        }
    };

    const handlePublish     = (d: number) => act(() => publishListing(listingId, d), `已上架，有效期 ${d} 天`);
    const handleEdit        = (p: UpdateListingPayload) => act(() => updateListing(listingId, p), "資料已更新");
    const handleRemove      = () => act(() => removeListing(listingId), "已下架");
    const handleClose       = () => act(() => closeListing(listingId), "已結案");
    const handleLock        = (apptId: number) => act(() => lockNegotiation(listingId, apptId), "已鎖定洽談");
    const handleUnlock      = () => act(() => unlockNegotiation(listingId), "已解除鎖定");
    const handleConfirmAppt = (apptId: number, t: string) => act(() => confirmAppointment(listingId, apptId, t), "已確認時間");
    const handleCancelAppt  = (apptId: number) => act(() => cancelAppointment(listingId, apptId), "預約已取消");
    const handleBook        = (t: string, n: string) => act(() => bookAppointment(listingId, t, n).then(() => undefined), "預約送出成功");
    const handleSetViewed   = () => act(() => {
        const a = listing?.appointments?.find((x) => x.status !== "CANCELLED");
        return a ? updateAppointmentStatus(listingId, a.id, "VIEWED") : Promise.resolve();
    }, "已標記已看房");
    const handleSetInterested = () => act(() => {
        const a = listing?.appointments?.find((x) => x.status !== "CANCELLED");
        return a ? updateAppointmentStatus(listingId, a.id, "INTERESTED") : Promise.resolve();
    }, "已標記有意願");

    const CONFIRM_TITLE: Record<NonNullable<ConfirmType>, string> = { remove: "下架房源", close: "結案", unlock: "解除洽談" };
    const CONFIRM_DESC:  Record<NonNullable<ConfirmType>, string> = {
        remove: "確定要下架？下架後訪客將看不到此物件。",
        close:  "確定要結案？此操作無法復原。",
        unlock: "確定解除洽談鎖定？房源狀態將回到上架中。",
    };
    const handleConfirmOk = () => {
        if (confirmAction === "remove") void handleRemove();
        else if (confirmAction === "close") void handleClose();
        else if (confirmAction === "unlock") void handleUnlock();
    };

    // Loading
    if (isLoading) {
        return (
            <SiteLayout>
                <div className="flex items-center justify-center py-32">
                    <span className="text-sm text-on-surface-variant animate-pulse">載入房源中…</span>
                </div>
            </SiteLayout>
        );
    }
    if (!listing) {
        return (
            <SiteLayout>
                <div className="w-full max-w-[1440px] mx-auto px-6 md:px-12 py-16 flex flex-col items-center gap-4">
                    {errorMsg && <div className="px-4 py-3 bg-error-container text-on-error-container rounded-xl text-sm">{errorMsg}</div>}
                    <p className="text-sm text-on-surface-variant">找不到這筆房源。</p>
                    <Btn variant="secondary" onClick={() => navigate("/listings")}>返回列表</Btn>
                </div>
            </SiteLayout>
        );
    }

    const isOwner     = listing.is_owner;
    const canBook     = isAuthenticated && !isOwner && listing.status === "ACTIVE";
    const appointments = listing.appointments ?? [];
    const priceLabel  = listing.list_type === "RENT"
        ? `NT$ ${listing.price.toLocaleString()}`
        : `NT$ ${listing.price.toLocaleString()}`;
    const priceSubLabel = listing.list_type === "RENT" ? "月租" : "售價";

    const metaItems = [
        listing.room_count ? { label: "格局", value: `${listing.room_count}房${listing.bathroom_count ? ` ${listing.bathroom_count}廳` : ""} ${listing.bathroom_count ? `${listing.bathroom_count}衛` : ""}` } : null,
        listing.area_ping  ? { label: "坪數", value: `${listing.area_ping} 坪` } : null,
        (listing.floor || listing.total_floors) ? { label: "樓層", value: `${listing.floor ?? "?"}F${listing.total_floors ? ` / ${listing.total_floors}F` : ""}` } : null,
        { label: "型態", value: listing.list_type === "RENT" ? "出租" : "出售" },
    ].filter(Boolean) as { label: string; value: string }[];

    return (
        <SiteLayout>
            <main className="flex-grow w-full max-w-[1440px] mx-auto px-6 md:px-12 py-8 flex flex-col gap-8">
                {/* Back Link */}
                <div>
                    <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); navigate("/listings"); }}
                        className="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary-container transition-colors duration-200 text-sm font-medium"
                    >
                        <span className="material-symbols-outlined text-sm">arrow_back</span>
                        ← 返回列表
                    </a>
                </div>

                {/* Success Banner */}
                {successMsg && (
                    <div className="bg-tertiary/10 border border-tertiary/20 rounded-xl p-4 flex items-center gap-3">
                        <span className="material-symbols-outlined text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                        <p className="text-tertiary font-medium text-sm">{successMsg}</p>
                    </div>
                )}
                {errorMsg && (
                    <div className="bg-error-container border border-error/20 rounded-xl p-4">
                        <p className="text-on-error-container text-sm">{errorMsg}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column: Images & Main Info */}
                    <div className="lg:col-span-8 flex flex-col gap-8">
                        {/* Image Gallery (Bento Style) */}
                        <div className="grid grid-cols-4 grid-rows-2 gap-4 h-[400px] md:h-[500px]">
                            <div className="col-span-4 md:col-span-3 row-span-2 rounded-xl overflow-hidden relative group bg-surface-variant">
                                {listing.image_url
                                    ? <img src={listing.image_url} alt={listing.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                    : <span className="material-symbols-outlined text-8xl text-on-surface-variant/15 absolute inset-0 flex items-center justify-center" style={{ fontVariationSettings: "'FILL' 1" }}>home</span>
                                }
                                <div className="absolute top-4 left-4 flex gap-2">
                                    <span className="bg-surface-container-lowest/80 backdrop-blur-md text-tertiary text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shadow-[0_4px_32px_rgba(28,25,23,0.06)] border border-outline-variant/15 flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
                                        {STATUS_LABEL[listing.status] ?? listing.status}
                                    </span>
                                </div>
                            </div>
                            <div className="hidden md:block col-span-1 row-span-1 rounded-xl overflow-hidden relative bg-surface-container-high">
                                {PLACEHOLDER_THUMBS[0] && <img src={PLACEHOLDER_THUMBS[0]} alt="" className="w-full h-full object-cover" />}
                            </div>
                            <div className="hidden md:block col-span-1 row-span-1 rounded-xl overflow-hidden relative bg-surface-container">
                                {PLACEHOLDER_THUMBS[1] && <img src={PLACEHOLDER_THUMBS[1]} alt="" className="w-full h-full object-cover" />}
                            </div>
                        </div>

                        {/* Main Content Card */}
                        <div className="bg-surface-container-lowest rounded-xl p-8 shadow-[0_4px_32px_rgba(28,25,23,0.02)] border border-outline-variant/15 flex flex-col gap-6">
                            {/* Title + Price */}
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-surface-container-highest pb-6">
                                <div className="flex flex-col gap-2">
                                    <h1 className="text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight leading-tight font-headline">
                                        {listing.title}
                                    </h1>
                                    <p className="text-on-surface-variant text-sm flex items-center gap-1">
                                        <span className="material-symbols-outlined text-base">location_on</span>
                                        {listing.district ? `${listing.district} ` : ""}{listing.address}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-on-surface-variant mb-1">{priceSubLabel}</p>
                                    <p className="text-3xl md:text-4xl font-bold text-[#E8B800] tracking-tight font-headline">{priceLabel}</p>
                                </div>
                            </div>

                            {/* Meta Definition List */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-4">
                                {metaItems.map((item) => (
                                    <div key={item.label} className="flex flex-col gap-1">
                                        <span className="text-sm text-on-surface-variant font-medium">{item.label}</span>
                                        <span className="text-lg font-bold text-on-surface">{item.value}</span>
                                    </div>
                                ))}
                                {listing.is_pet_allowed !== undefined && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm text-on-surface-variant font-medium">寵物</span>
                                        <span className="text-lg font-bold text-on-surface">{listing.is_pet_allowed ? "可養寵" : "不可養寵"}</span>
                                    </div>
                                )}
                                {listing.is_parking_included !== undefined && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm text-on-surface-variant font-medium">車位</span>
                                        <span className="text-lg font-bold text-on-surface">{listing.is_parking_included ? "含車位" : "無車位"}</span>
                                    </div>
                                )}
                            </div>

                            {/* Description */}
                            {listing.description && (
                                <div className="prose max-w-none text-on-surface-variant leading-[1.75]">
                                    <p className="whitespace-pre-wrap">{listing.description}</p>
                                </div>
                            )}
                        </div>

                        {/* Web3 Status / Smart Contract */}
                        <div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/15 flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-tertiary/10 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-tertiary">contract</span>
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-on-surface mb-1">智能合約驗證通過</h3>
                                <p className="text-sm text-on-surface-variant leading-[1.75]">
                                    此房源產權已透過區塊鏈驗證，確保交易透明與安全。交易紀錄即時上鏈，防篡改。
                                </p>
                                <div className="mt-3 flex items-center gap-2">
                                    <span className="text-xs font-mono bg-surface-container-lowest px-2 py-1 rounded text-on-surface-variant border border-outline-variant/15">
                                        0x1234...5678
                                    </span>
                                    <a
                                        href="#"
                                        className="text-tertiary text-xs hover:underline decoration-tertiary"
                                        onClick={(e) => e.preventDefault()}
                                    >
                                        查看鏈上紀錄
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* Appointments (owner view) */}
                        {isOwner && isAuthenticated && appointments.length > 0 && (
                            <div className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_4px_32px_rgba(28,25,23,0.02)] border border-outline-variant/15 flex flex-col gap-4">
                                <h3 className="text-lg font-bold text-on-surface font-headline border-b border-surface-container-highest pb-3">
                                    預約列表 (屋主視角)
                                </h3>
                                <div className="flex flex-col gap-4">
                                    {appointments.map((appt) => {
                                        const isNeg = appt.id === listing.negotiating_appointment?.id;
                                        const canLock = listing.status === "ACTIVE" && appt.status !== "CANCELLED";
                                        const canUnlock = isNeg && listing.status === "NEGOTIATING";
                                        return (
                                            <div key={appt.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low border border-outline-variant/10">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center">
                                                        <span className="material-symbols-outlined text-on-surface-variant">person</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-on-surface">
                                                            第 {appt.queue_position} 組
                                                            <span className="ml-2 text-xs font-normal text-on-surface-variant">
                                                                {APPT_STATUS_LABEL[appt.status] ?? appt.status}
                                                            </span>
                                                            {isNeg && <span className="ml-1 text-xs font-bold text-primary-container">洽談中</span>}
                                                        </p>
                                                        <p className="text-xs text-on-surface-variant">
                                                            預約: {new Date(appt.preferred_time).toLocaleString("zh-TW")}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    {appt.status === "PENDING" && (
                                                        <button
                                                            type="button"
                                                            className="text-xs font-medium bg-surface-container-lowest border border-outline-variant/20 text-on-surface px-3 py-1.5 rounded-lg hover:bg-surface-variant transition-colors"
                                                            onClick={() => { setConfirmApptId(appt.id); setModal("confirm-appt"); }}
                                                        >
                                                            確認時間
                                                        </button>
                                                    )}
                                                    {canLock && (
                                                        <button
                                                            type="button"
                                                            className="text-xs font-medium bg-surface-container-lowest border border-outline-variant/20 text-on-surface px-3 py-1.5 rounded-lg hover:bg-surface-variant transition-colors"
                                                            onClick={() => void handleLock(appt.id)}
                                                        >
                                                            鎖定洽談
                                                        </button>
                                                    )}
                                                    {canUnlock && (
                                                        <button
                                                            type="button"
                                                            className="text-xs font-medium bg-[#E8B800] text-[#1C1917] px-3 py-1.5 rounded-lg hover:brightness-105 transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
                                                            onClick={() => setConfirmAction("unlock")}
                                                        >
                                                            解除鎖定
                                                        </button>
                                                    )}
                                                    {appt.status !== "CANCELLED" && (
                                                        <button
                                                            type="button"
                                                            className="text-xs font-medium text-error bg-transparent hover:bg-error-container px-3 py-1.5 rounded-lg transition-colors"
                                                            onClick={() => void handleCancelAppt(appt.id)}
                                                        >
                                                            取消
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Sidebar */}
                    <div className="lg:col-span-4 flex flex-col gap-6">
                        {/* Action Card */}
                        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_4px_32px_rgba(28,25,23,0.02)] border border-outline-variant/15 sticky top-[88px] flex flex-col gap-6">
                            {/* Owner info */}
                            <div className="flex items-center gap-4 border-b border-surface-container-highest pb-4">
                                <div className="w-12 h-12 rounded-full bg-surface-container-high overflow-hidden flex items-center justify-center">
                                    <span className="material-symbols-outlined text-on-surface-variant">person</span>
                                </div>
                                <div>
                                    <p className="text-sm text-on-surface-variant">屋主</p>
                                    <p className="text-base font-bold text-on-surface">房源擁有者</p>
                                </div>
                            </div>

                            {/* Negotiating banner */}
                            {listing.status === "NEGOTIATING" && (
                                <div className="bg-[#FEF3C7] rounded-lg p-3 border border-[#F59E0B]/20 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[#B45309] text-sm">info</span>
                                    <p className="text-sm text-[#B45309] font-medium">
                                        目前已有 {appointments.filter((a) => a.status !== "CANCELLED").length} 組看房洽談中
                                    </p>
                                </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex flex-col gap-3">
                                {isOwner ? (
                                    <>
                                        {listing.status === "DRAFT" && (
                                            <button type="button" onClick={() => setModal("publish")}
                                                className="w-full bg-[#E8B800] text-[#1C1917] font-bold py-3 px-4 rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] hover:brightness-105 transition-all duration-200 active:scale-[0.98] flex justify-center items-center gap-2">
                                                <span className="material-symbols-outlined text-sm">publish</span>上架房源
                                            </button>
                                        )}
                                        {(listing.status === "DRAFT" || listing.status === "ACTIVE") && (
                                            <button type="button" onClick={() => setModal("edit")}
                                                className="w-full bg-surface-container-lowest text-on-surface font-medium py-3 px-4 rounded-xl border border-outline-variant/20 hover:bg-surface-container-low transition-all duration-200 active:scale-[0.98] flex justify-center items-center gap-2">
                                                <span className="material-symbols-outlined text-sm">edit</span>編輯資料
                                            </button>
                                        )}
                                        {listing.status === "ACTIVE" && (
                                            <button type="button" onClick={() => setConfirmAction("remove")}
                                                className="w-full bg-surface-container-lowest text-on-surface-variant font-medium py-2.5 px-4 rounded-xl border border-outline-variant/15 hover:bg-surface-container-low transition-all duration-200">
                                                下架
                                            </button>
                                        )}
                                        {(listing.status === "ACTIVE" || listing.status === "NEGOTIATING") && (
                                            <button type="button" onClick={() => setConfirmAction("close")}
                                                className="w-full bg-surface-container-lowest text-on-surface-variant font-medium py-2.5 px-4 rounded-xl border border-outline-variant/15 hover:bg-surface-container-low transition-all duration-200">
                                                結案
                                            </button>
                                        )}
                                        {listing.status === "NEGOTIATING" && (
                                            <button type="button" onClick={() => setConfirmAction("unlock")}
                                                className="w-full bg-surface-container-lowest text-on-surface-variant font-medium py-2.5 px-4 rounded-xl border border-outline-variant/15 hover:bg-surface-container-low transition-all duration-200">
                                                解除洽談
                                            </button>
                                        )}
                                    </>
                                ) : isAuthenticated ? (
                                    <>
                                        {canBook && (
                                            <button type="button" onClick={() => setModal("book")}
                                                className="w-full bg-[#E8B800] text-[#1C1917] font-bold py-3 px-4 rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] hover:brightness-105 transition-all duration-200 active:scale-[0.98] flex justify-center items-center gap-2">
                                                <span className="material-symbols-outlined text-sm">calendar_month</span>預約看房
                                            </button>
                                        )}
                                        <button type="button"
                                            className="w-full bg-surface-container-lowest text-on-surface font-medium py-3 px-4 rounded-xl border border-outline-variant/20 hover:bg-surface-container-low transition-all duration-200 active:scale-[0.98] flex justify-center items-center gap-2">
                                            <span className="material-symbols-outlined text-sm">chat</span>聯絡屋主
                                        </button>
                                        {appointments.some((a) => a.status === "CONFIRMED") && (
                                            <>
                                                <button type="button" onClick={() => void handleSetViewed()}
                                                    className="w-full py-2.5 rounded-xl text-sm font-medium text-on-surface bg-transparent border border-outline-variant/50 hover:bg-surface-container transition-colors">
                                                    標記已看房
                                                </button>
                                                <button type="button" onClick={() => void handleSetInterested()}
                                                    className="w-full py-2.5 rounded-xl text-sm font-medium text-on-surface bg-transparent border border-outline-variant/50 hover:bg-surface-container transition-colors">
                                                    標記有意願
                                                </button>
                                            </>
                                        )}
                                        {!canBook && listing.status !== "ACTIVE" && (
                                            <p className="text-xs text-on-surface-variant text-center py-2">此房源目前不開放預約。</p>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <button type="button" onClick={() => navigate("/login")}
                                            className="w-full bg-[#E8B800] text-[#1C1917] font-bold py-3 px-4 rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] hover:brightness-105 transition-all duration-200 active:scale-[0.98] flex justify-center items-center gap-2">
                                            <span className="material-symbols-outlined text-sm">calendar_month</span>預約看房
                                        </button>
                                        <button type="button"
                                            className="w-full bg-surface-container-lowest text-on-surface font-medium py-3 px-4 rounded-xl border border-outline-variant/20 hover:bg-surface-container-low transition-all duration-200 active:scale-[0.98] flex justify-center items-center gap-2">
                                            <span className="material-symbols-outlined text-sm">chat</span>聯絡屋主
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Visitor appointments (non-owner) */}
                        {isAuthenticated && !isOwner && appointments.length > 0 && (
                            <div className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_4px_32px_rgba(28,25,23,0.02)] border border-outline-variant/15 flex flex-col gap-4">
                                <h3 className="text-lg font-bold text-on-surface font-headline border-b border-surface-container-highest pb-3">看房隊列</h3>
                                <div className="flex flex-col gap-3">
                                    {appointments.map((appt) => (
                                        <div key={appt.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low border border-outline-variant/10">
                                            <div>
                                                <p className="text-sm font-bold text-on-surface">第 {appt.queue_position} 組</p>
                                                <p className="text-xs text-on-surface-variant">
                                                    {APPT_STATUS_LABEL[appt.status] ?? appt.status}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Modals */}
            <Modal isOpen={modal === "publish"} title="上架房源" onClose={() => setModal(null)}>
                <PublishForm onSubmit={handlePublish} onCancel={() => setModal(null)} />
            </Modal>
            <Modal isOpen={modal === "edit"} title="編輯房源資料" onClose={() => setModal(null)}>
                {listing && <EditForm listing={listing} onSubmit={handleEdit} onCancel={() => setModal(null)} />}
            </Modal>
            <Modal isOpen={modal === "book"} title="預約看房" onClose={() => setModal(null)}>
                <BookingForm onSubmit={handleBook} onCancel={() => setModal(null)} />
            </Modal>
            <Modal isOpen={modal === "confirm-appt"} title="確認預約時間" onClose={() => { setModal(null); setConfirmApptId(null); }}>
                <ConfirmApptForm
                    onSubmit={(t) => { if (confirmApptId) void handleConfirmAppt(confirmApptId, t); }}
                    onCancel={() => { setModal(null); setConfirmApptId(null); }}
                />
            </Modal>
            <ConfirmDialog
                isOpen={confirmAction !== null}
                title={confirmAction ? CONFIRM_TITLE[confirmAction] : ""}
                description={confirmAction ? CONFIRM_DESC[confirmAction] : ""}
                isLoading={isActionLoading}
                onConfirm={handleConfirmOk}
                onCancel={() => setConfirmAction(null)}
            />
        </SiteLayout>
    );
};

export default ListingDetailPage;
