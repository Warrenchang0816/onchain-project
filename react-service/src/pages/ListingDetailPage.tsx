import { type ReactNode, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAuthMe } from "../api/authApi";
import { useIdentity } from "../hooks/useIdentity";
import {
    bookAppointment,
    closeListing,
    getListing,
    publishListing,
    removeListing,
    type Listing,
    type UpdateListingPayload,
    updateListing,
} from "../api/listingApi";
import ListingEditorForm from "../components/listing/ListingEditorForm";
import { listingToEditorValues } from "../components/listing/listingEditorValues";
import SiteLayout from "../layouts/SiteLayout";

const STATUS_LABEL: Record<string, string> = {
    DRAFT: "草稿",
    ACTIVE: "上架中",
    NEGOTIATING: "媒合中",
    LOCKED: "已鎖定",
    SIGNING: "簽約中",
    CLOSED: "已結案",
    EXPIRED: "已到期",
    REMOVED: "已下架",
    SUSPENDED: "已暫停",
};

type ModalType = "publish" | "edit" | "book" | null;

function ActionButton(props: { children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "danger"; disabled?: boolean }) {
    const cls = {
        primary: "w-full rounded-xl bg-primary-container px-4 py-3 font-bold text-on-primary-container transition-opacity hover:opacity-90 disabled:opacity-50",
        secondary: "w-full rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-4 py-3 font-medium text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-50",
        danger: "w-full rounded-xl border border-error/20 bg-surface-container-lowest px-4 py-3 font-medium text-error transition-colors hover:bg-error-container disabled:opacity-50",
    }[props.variant ?? "secondary"];

    return (
        <button type="button" onClick={props.onClick} disabled={props.disabled} className={cls}>
            {props.children}
        </button>
    );
}

function Modal(props: { isOpen: boolean; title: string; onClose: () => void; children: ReactNode }) {
    if (!props.isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button type="button" aria-label="關閉視窗" className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={props.onClose} />
            <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-outline-variant/10 bg-surface-container-lowest shadow-[0_24px_64px_rgba(28,25,23,0.18)]">
                <div className="flex items-center justify-between border-b border-surface-container px-6 py-4">
                    <h2 className="text-base font-bold text-on-surface">{props.title}</h2>
                    <button type="button" onClick={props.onClose} className="bg-transparent text-on-surface-variant hover:text-on-surface">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div className="px-6 py-5">{props.children}</div>
            </div>
        </div>
    );
}

function formatPrice(listing: Listing): string {
    if (listing.price <= 0) return "價格未設定";
    if (listing.list_type === "RENT") return `NT$ ${listing.price.toLocaleString()} / 月`;
    if (listing.list_type === "SALE") return `NT$ ${listing.price.toLocaleString()}`;
    return "尚未選擇出租或出售";
}

export default function ListingDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { hasRole } = useIdentity();
    const [listing, setListing] = useState<Listing | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
    const [modal, setModal] = useState<ModalType>(null);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [publishDays, setPublishDays] = useState(30);
    const [preferredTime, setPreferredTime] = useState("");
    const [bookingNote, setBookingNote] = useState("");

    const listingId = id ? parseInt(id, 10) : Number.NaN;

    const load = async () => {
        if (Number.isNaN(listingId)) {
            setErrorMsg("房源編號不正確。");
            setIsLoading(false);
            return;
        }
        try {
            setIsLoading(true);
            setErrorMsg("");
            setListing(await getListing(listingId));
        } catch (err) {
            setListing(null);
            setErrorMsg(err instanceof Error ? err.message : "讀取房源失敗。");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void load();
        void getAuthMe().then((auth) => setIsAuthenticated(auth.authenticated)).catch(() => undefined);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listingId]);

    const runAction = async (action: () => Promise<void>, successMessage: string) => {
        try {
            setIsActionLoading(true);
            setErrorMsg("");
            setSuccessMsg("");
            await action();
            setSuccessMsg(successMessage);
            await load();
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : "操作失敗。");
        } finally {
            setIsActionLoading(false);
            setModal(null);
        }
    };

    if (isLoading) {
        return (
            <SiteLayout>
                <div className="flex items-center justify-center py-32">
                    <span className="animate-pulse text-sm text-on-surface-variant">讀取房源中...</span>
                </div>
            </SiteLayout>
        );
    }

    if (!listing) {
        return (
            <SiteLayout>
                <main className="mx-auto w-full max-w-[960px] px-6 py-20 md:px-12">
                    <div className="flex flex-col gap-4 rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-10">
                        <h1 className="text-3xl font-extrabold text-on-background">找不到房源</h1>
                        <p className="text-sm text-on-surface-variant">{errorMsg || "此房源可能已下架或不存在。"}</p>
                        <button type="button" className="self-start rounded-lg bg-primary-container px-5 py-2.5 text-sm font-bold text-on-primary-container" onClick={() => navigate("/listings")}>
                            返回房源列表
                        </button>
                    </div>
                </main>
            </SiteLayout>
        );
    }

    const isOwner = listing.is_owner;
    const canBook = hasRole("TENANT") && !isOwner && listing.status === "ACTIVE";
    const appointments = listing.appointments ?? [];

    const handlePublish = () => runAction(() => publishListing(listingId, publishDays), `房源已上架 ${publishDays} 天。`);
    const handleEdit = (payload: UpdateListingPayload) => runAction(() => updateListing(listingId, payload), "房源已更新。");
    const handleRemove = () => runAction(() => removeListing(listingId), "房源已下架。");
    const handleClose = () => runAction(() => closeListing(listingId), "房源已結案。");
    const handleBook = () => {
        if (!preferredTime) return;
        return runAction(() => bookAppointment(listingId, new Date(preferredTime).toISOString(), bookingNote).then(() => undefined), "看房預約已送出。");
    };

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-6 py-8 md:px-12">
                <button type="button" onClick={() => navigate("/listings")} className="self-start bg-transparent text-sm text-on-surface-variant hover:text-primary-container">
                    返回房源列表
                </button>

                {successMsg ? <div className="rounded-xl border border-tertiary/20 bg-tertiary/10 p-4 text-sm font-medium text-tertiary">{successMsg}</div> : null}
                {errorMsg ? <div className="rounded-xl border border-error/20 bg-error-container p-4 text-sm text-on-error-container">{errorMsg}</div> : null}

                {listing.status === "DRAFT" && listing.setup_status === "INCOMPLETE" ? (
                    <div className="rounded-xl border border-amber-700/20 bg-amber-700/10 p-4 text-sm text-amber-700">
                        這筆房源仍是未完善草稿，不會出現在公開列表。請補齊出租/出售類型、價格、坪數、房間數與衛浴數後再上架。
                    </div>
                ) : null}

                <section className="grid gap-8 lg:grid-cols-[1fr_360px]">
                    <article className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                        <div className="mb-5 flex flex-wrap gap-2">
                            <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-bold text-on-surface-variant">{STATUS_LABEL[listing.status] ?? listing.status}</span>
                            <span className="rounded-full bg-primary-container/15 px-3 py-1 text-xs font-bold text-primary-container">
                                {listing.setup_status === "READY" ? "資料可上架" : "尚未完善"}
                            </span>
                            {listing.draft_origin === "OWNER_ACTIVATION" ? (
                                <span className="rounded-full bg-tertiary/10 px-3 py-1 text-xs font-bold text-tertiary">屋主認證草稿</span>
                            ) : null}
                        </div>
                        <h1 className="text-4xl font-extrabold text-on-surface">{listing.title || "未命名房源"}</h1>
                        <p className="mt-3 text-sm leading-[1.8] text-on-surface-variant">{listing.address || "尚未填寫地址"}</p>
                        <p className="mt-6 text-3xl font-extrabold text-primary-container">{formatPrice(listing)}</p>

                        <div className="mt-8 grid gap-4 md:grid-cols-3">
                            <div className="rounded-xl bg-surface-container-low p-4">
                                <p className="text-sm text-on-surface-variant">坪數</p>
                                <p className="mt-1 text-lg font-bold text-on-surface">{listing.area_ping !== undefined ? `${listing.area_ping} 坪` : "未填寫"}</p>
                            </div>
                            <div className="rounded-xl bg-surface-container-low p-4">
                                <p className="text-sm text-on-surface-variant">格局</p>
                                <p className="mt-1 text-lg font-bold text-on-surface">
                                    {listing.room_count !== undefined ? `${listing.room_count} 房` : "未填寫"}
                                    {listing.bathroom_count !== undefined ? ` / ${listing.bathroom_count} 衛` : ""}
                                </p>
                            </div>
                            <div className="rounded-xl bg-surface-container-low p-4">
                                <p className="text-sm text-on-surface-variant">樓層</p>
                                <p className="mt-1 text-lg font-bold text-on-surface">
                                    {listing.floor ?? "?"}{listing.total_floors !== undefined ? ` / ${listing.total_floors}` : ""}
                                </p>
                            </div>
                        </div>

                        {listing.description ? <p className="mt-8 whitespace-pre-wrap text-sm leading-[1.9] text-on-surface-variant">{listing.description}</p> : null}
                    </article>

                    <aside className="flex flex-col gap-4 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
                        {isOwner ? (
                            <>
                                {listing.status === "DRAFT" ? <ActionButton variant="primary" onClick={() => setModal("publish")}>上架房源</ActionButton> : null}
                                {(listing.status === "DRAFT" || listing.status === "ACTIVE") ? <ActionButton onClick={() => setModal("edit")}>編輯房源</ActionButton> : null}
                                {listing.status === "ACTIVE" ? <ActionButton variant="danger" onClick={() => void handleRemove()}>下架房源</ActionButton> : null}
                                {(listing.status === "ACTIVE" || listing.status === "NEGOTIATING") ? <ActionButton onClick={() => void handleClose()}>結案</ActionButton> : null}
                            </>
                        ) : isAuthenticated ? (
                            <>
                                {canBook ? <ActionButton variant="primary" onClick={() => setModal("book")}>預約看房</ActionButton> : null}
                                {!canBook ? <p className="text-center text-sm text-on-surface-variant">目前不可預約此房源。</p> : null}
                            </>
                        ) : (
                            <ActionButton variant="primary" onClick={() => navigate("/login")}>登入後預約看房</ActionButton>
                        )}

                        {appointments.length > 0 ? (
                            <div className="mt-4 border-t border-surface-container pt-4">
                                <h2 className="text-sm font-bold text-on-surface">預約紀錄</h2>
                                <p className="mt-2 text-sm text-on-surface-variant">目前共有 {appointments.length} 筆預約。</p>
                            </div>
                        ) : null}
                    </aside>
                </section>
            </main>

            <Modal isOpen={modal === "publish"} title="上架房源" onClose={() => setModal(null)}>
                <div className="flex flex-col gap-4">
                    <label className="text-xs font-semibold text-on-surface-variant">
                        上架天數
                        <input className="mt-2 w-full rounded-lg border-0 bg-surface-container-low px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-container" type="number" min={7} max={180} value={publishDays} onChange={(e) => setPublishDays(Number(e.target.value))} />
                    </label>
                    <ActionButton variant="primary" disabled={isActionLoading} onClick={() => void handlePublish()}>確認上架</ActionButton>
                </div>
            </Modal>
            <Modal isOpen={modal === "edit"} title="編輯房源" onClose={() => setModal(null)}>
                <ListingEditorForm
                    mode="edit"
                    initialValues={listingToEditorValues(listing)}
                    submitting={isActionLoading}
                    submitLabel="儲存變更"
                    onSubmit={(payload) => handleEdit(payload as UpdateListingPayload)}
                    onCancel={() => setModal(null)}
                />
            </Modal>
            <Modal isOpen={modal === "book"} title="預約看房" onClose={() => setModal(null)}>
                <div className="flex flex-col gap-4">
                    <input className="rounded-lg border-0 bg-surface-container-low px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-container" type="datetime-local" value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} />
                    <input className="rounded-lg border-0 bg-surface-container-low px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-container" value={bookingNote} onChange={(e) => setBookingNote(e.target.value)} placeholder="補充說明" />
                    <ActionButton variant="primary" disabled={!preferredTime || isActionLoading} onClick={() => void handleBook()}>送出預約</ActionButton>
                </div>
            </Modal>
        </SiteLayout>
    );
}
