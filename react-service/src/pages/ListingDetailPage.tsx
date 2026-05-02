import { type ReactNode, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getAuthMe } from "../api/authApi";
import { useIdentity } from "../hooks/useIdentity";
import {
    bookAppointment,
    closeListing,
    getListing,
    publishListing,
    removeListing,
    setListingIntent,
    type Listing,
    type ListingType,
    type UpdateListingPayload,
    type UpdateRentDetailsPayload,
    type UpdateSaleDetailsPayload,
    updateListing,
    updateRentDetails,
    updateSaleDetails,
} from "../api/listingApi";
import ListingDetailShell from "../components/listing/ListingDetailShell";
import ListingDetailsForm from "../components/listing/ListingDetailsForm";
import ListingEditorForm from "../components/listing/ListingEditorForm";
import { listingToEditorValues } from "../components/listing/listingEditorValues";
import { buildListingDisplayModel } from "../components/listing/listingDisplayModel";
import SiteLayout from "../layouts/SiteLayout";

type ModalType = "publish" | "edit" | "book" | "rentDetails" | "saleDetails" | null;

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

export default function ListingDetailPage() {
    const { id } = useParams<{ id: string }>();
    const location = useLocation();
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
            setErrorMsg("物件編號不正確");
            setIsLoading(false);
            return;
        }
        try {
            setIsLoading(true);
            setErrorMsg("");
            setListing(await getListing(listingId));
        } catch (err) {
            setListing(null);
            setErrorMsg(err instanceof Error ? err.message : "讀取物件失敗");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void load();
        void getAuthMe()
            .then((auth) => setIsAuthenticated(auth.authenticated))
            .catch(() => undefined);
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
            setErrorMsg(err instanceof Error ? err.message : "操作失敗");
        } finally {
            setIsActionLoading(false);
            setModal(null);
        }
    };

    if (isLoading) {
        return (
            <SiteLayout>
                <div className="flex items-center justify-center py-32">
                    <span className="animate-pulse text-sm text-on-surface-variant">讀取物件中...</span>
                </div>
            </SiteLayout>
        );
    }

    if (!listing) {
        return (
            <SiteLayout>
                <main className="mx-auto w-full max-w-[960px] px-6 py-20 md:px-12">
                    <div className="flex flex-col gap-4 rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-10">
                        <h1 className="text-3xl font-extrabold text-on-background">找不到物件</h1>
                        <p className="text-sm text-on-surface-variant">{errorMsg || "這筆物件可能不存在或已無法瀏覽。"}</p>
                        <button
                            type="button"
                            className="self-start rounded-lg bg-primary-container px-5 py-2.5 text-sm font-bold text-on-primary-container"
                            onClick={() => navigate("/listings")}
                        >
                            返回房源列表
                        </button>
                    </div>
                </main>
            </SiteLayout>
        );
    }

    const isOwner = listing.is_owner || location.pathname.startsWith("/my/listings/");
    const backPath = isOwner ? "/my/listings" : "/listings";
    const backLabel = isOwner ? "返回我的刊登" : "返回房源列表";
    const canBook = hasRole("TENANT") && !isOwner && listing.status === "ACTIVE";
    const appointments = listing.appointments ?? [];
    const propertyReady =
        listing.property?.verification_status === "VERIFIED" &&
        listing.property?.completeness_status === "READY_FOR_LISTING" &&
        Boolean(listing.property?.disclosure_hash);
    const needsIntent = listing.status === "DRAFT" && listing.list_type === "UNSET";
    const canPublish = listing.status === "DRAFT" && listing.setup_status === "READY" && propertyReady && listing.list_type !== "UNSET";
    const displayModel = buildListingDisplayModel(listing);

    const handlePublish = () => runAction(() => publishListing(listingId, publishDays), `物件已發布 ${publishDays} 天`);
    const handleEdit = (payload: UpdateListingPayload) => runAction(() => updateListing(listingId, payload), "刊登資料已更新");
    const handleSetIntent = (listType: Exclude<ListingType, "UNSET">) =>
        runAction(() => setListingIntent(listingId, listType), listType === "RENT" ? "已設定為出租刊登" : "已設定為出售刊登");
    const handleRentDetails = (payload: UpdateRentDetailsPayload) => runAction(() => updateRentDetails(listingId, payload), "出租資料已更新");
    const handleSaleDetails = (payload: UpdateSaleDetailsPayload) => runAction(() => updateSaleDetails(listingId, payload), "賣屋資料已更新");
    const handleRemove = () => runAction(() => removeListing(listingId), "物件已下架");
    const handleClose = () => runAction(() => closeListing(listingId), "物件已結案");
    const handleBook = () => {
        if (!preferredTime) return;
        return runAction(() => bookAppointment(listingId, new Date(preferredTime).toISOString(), bookingNote).then(() => undefined), "預約已送出");
    };

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-6 py-8 md:px-12">
                <button type="button" onClick={() => navigate(backPath)} className="self-start bg-transparent text-sm text-on-surface-variant hover:text-primary-container">
                    {backLabel}
                </button>

                {successMsg ? <div className="rounded-xl border border-tertiary/20 bg-tertiary/10 p-4 text-sm font-medium text-tertiary">{successMsg}</div> : null}
                {errorMsg ? <div className="rounded-xl border border-error/20 bg-error-container p-4 text-sm text-on-error-container">{errorMsg}</div> : null}

                {listing.status === "DRAFT" && listing.setup_status === "INCOMPLETE" ? (
                    <div className="rounded-xl border border-amber-700/20 bg-amber-700/10 p-4 text-sm text-amber-700">
                        這筆刊登資料尚未完整，請補齊必要欄位後再發布。
                    </div>
                ) : null}

                <ListingDetailShell
                    model={displayModel}
                    mode={isOwner ? "ownerPreview" : "public"}
                    actions={
                        <>
                            {isOwner ? (
                                <>
                                    {propertyReady && needsIntent ? (
                                        <>
                                            <ActionButton variant="primary" disabled={isActionLoading} onClick={() => void handleSetIntent("RENT")}>
                                                刊登出租
                                            </ActionButton>
                                            <ActionButton disabled={isActionLoading} onClick={() => void handleSetIntent("SALE")}>
                                                刊登出售
                                            </ActionButton>
                                        </>
                                    ) : null}
                                    {listing.status === "DRAFT" && !propertyReady ? (
                                        <p className="rounded-xl bg-surface-container-low p-4 text-sm leading-[1.7] text-on-surface-variant">
                                            物件驗證資料尚未完成，請先完成揭露與產權確認後再刊登。
                                        </p>
                                    ) : null}
                                    {canPublish ? (
                                        <ActionButton variant="primary" onClick={() => setModal("publish")}>
                                            發布物件
                                        </ActionButton>
                                    ) : null}
                                    {listing.status === "DRAFT" && propertyReady && listing.list_type === "RENT" ? (
                                        <ActionButton variant={listing.rent_details ? "secondary" : "primary"} disabled={isActionLoading} onClick={() => setModal("rentDetails")}>
                                            {listing.rent_details ? "編輯出租資料" : "補齊出租資料"}
                                        </ActionButton>
                                    ) : null}
                                    {listing.status === "DRAFT" && propertyReady && listing.list_type === "SALE" ? (
                                        <ActionButton variant={listing.sale_details ? "secondary" : "primary"} disabled={isActionLoading} onClick={() => setModal("saleDetails")}>
                                            {listing.sale_details ? "編輯賣屋資料" : "補齊賣屋資料"}
                                        </ActionButton>
                                    ) : null}
                                    {listing.status === "DRAFT" && !needsIntent && !canPublish ? (
                                        <p className="rounded-xl bg-surface-container-low p-4 text-sm leading-[1.7] text-on-surface-variant">
                                            已選擇{listing.list_type === "RENT" ? "出租" : "出售"}，請補齊刊登資料後再發布。
                                        </p>
                                    ) : null}
                                    {listing.status === "DRAFT" || listing.status === "ACTIVE" ? (
                                        <ActionButton onClick={() => setModal("edit")}>編輯刊登</ActionButton>
                                    ) : null}
                                    <ActionButton onClick={() => navigate(`/my/listings/${listing.id}/print`)}>預覽刊登書</ActionButton>
                                    {listing.status === "ACTIVE" ? (
                                        <ActionButton variant="danger" onClick={() => void handleRemove()}>
                                            下架物件
                                        </ActionButton>
                                    ) : null}
                                    {listing.status === "ACTIVE" || listing.status === "NEGOTIATING" ? (
                                        <ActionButton onClick={() => void handleClose()}>結案</ActionButton>
                                    ) : null}
                                </>
                            ) : isAuthenticated ? (
                                <>
                                    {canBook ? (
                                        <ActionButton variant="primary" onClick={() => setModal("book")}>
                                            預約看屋
                                        </ActionButton>
                                    ) : null}
                                    {!canBook ? <p className="text-center text-sm text-on-surface-variant">目前無法預約此物件。</p> : null}
                                </>
                            ) : (
                                <ActionButton variant="primary" onClick={() => navigate("/login")}>
                                    登入後聯絡
                                </ActionButton>
                            )}

                            {appointments.length > 0 ? (
                                <div className="mt-4 border-t border-surface-container pt-4">
                                    <h2 className="text-sm font-bold text-on-surface">預約紀錄</h2>
                                    <p className="mt-2 text-sm text-on-surface-variant">目前共有 {appointments.length} 筆預約。</p>
                                </div>
                            ) : null}
                        </>
                    }
                />
            </main>

            <Modal isOpen={modal === "publish"} title="發布物件" onClose={() => setModal(null)}>
                <div className="flex flex-col gap-4">
                    <label className="text-xs font-semibold text-on-surface-variant">
                        發布天數
                        <input
                            className="mt-2 w-full rounded-lg border-0 bg-surface-container-low px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-container"
                            type="number"
                            min={7}
                            max={180}
                            value={publishDays}
                            onChange={(e) => setPublishDays(Number(e.target.value))}
                        />
                    </label>
                    <ActionButton variant="primary" disabled={isActionLoading} onClick={() => void handlePublish()}>
                        確認發布
                    </ActionButton>
                </div>
            </Modal>
            <Modal isOpen={modal === "edit"} title="編輯刊登" onClose={() => setModal(null)}>
                <ListingEditorForm
                    mode="edit"
                    initialValues={listingToEditorValues(listing)}
                    submitting={isActionLoading}
                    submitLabel="儲存變更"
                    onSubmit={(payload) => handleEdit(payload as UpdateListingPayload)}
                    onCancel={() => setModal(null)}
                />
            </Modal>
            <Modal isOpen={modal === "rentDetails"} title="出租刊登資料" onClose={() => setModal(null)}>
                <ListingDetailsForm mode="rent" listing={listing} submitting={isActionLoading} onSubmit={handleRentDetails} onCancel={() => setModal(null)} />
            </Modal>
            <Modal isOpen={modal === "saleDetails"} title="賣屋刊登資料" onClose={() => setModal(null)}>
                <ListingDetailsForm mode="sale" listing={listing} submitting={isActionLoading} onSubmit={handleSaleDetails} onCancel={() => setModal(null)} />
            </Modal>
            <Modal isOpen={modal === "book"} title="預約看屋" onClose={() => setModal(null)}>
                <div className="flex flex-col gap-4">
                    <input
                        className="rounded-lg border-0 bg-surface-container-low px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-container"
                        type="datetime-local"
                        value={preferredTime}
                        onChange={(e) => setPreferredTime(e.target.value)}
                    />
                    <input
                        className="rounded-lg border-0 bg-surface-container-low px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-container"
                        value={bookingNote}
                        onChange={(e) => setBookingNote(e.target.value)}
                        placeholder="補充說明"
                    />
                    <ActionButton variant="primary" disabled={!preferredTime || isActionLoading} onClick={() => void handleBook()}>
                        送出預約
                    </ActionButton>
                </div>
            </Modal>
        </SiteLayout>
    );
}
