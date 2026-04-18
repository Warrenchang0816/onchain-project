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
    type Appointment,
    type UpdateListingPayload,
} from "../api/listingApi";
import { getAuthMe } from "../api/authApi";
import AppButton from "../components/common/AppButton";
import AppModal from "../components/common/AppModal";
import ConfirmDialog from "../components/common/ConfirmDialog";
import PageLoading from "../components/common/PageLoading";
import SiteLayout from "../layouts/SiteLayout";

// ── Status labels ──────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
    DRAFT:       "草稿",
    ACTIVE:      "上架中",
    NEGOTIATING: "洽談中",
    LOCKED:      "已鎖定",
    SIGNING:     "簽約中",
    CLOSED:      "已結案",
    EXPIRED:     "已到期",
    REMOVED:     "已下架",
    SUSPENDED:   "已停權",
};

const APPT_STATUS_LABEL: Record<string, string> = {
    PENDING:    "待確認",
    CONFIRMED:  "已確認",
    VIEWED:     "已看房",
    INTERESTED: "有意願",
    CANCELLED:  "已取消",
};

// ── Publish form ───────────────────────────────────────────────────────────────

interface PublishFormProps {
    onSubmit: (days: number) => void;
    onCancel: () => void;
}

function PublishForm({ onSubmit, onCancel }: PublishFormProps) {
    const [days, setDays] = useState(30);
    return (
        <div className="form-body">
            <div className="form-field">
                <label className="form-label">上架天數</label>
                <input
                    type="number"
                    className="form-input"
                    min={7}
                    max={180}
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                />
                <p className="form-hint">費用：NT$ {(days * 40).toLocaleString()}（NT$40 / 天）</p>
            </div>
            <div className="form-actions">
                <AppButton type="button" variant="secondary" onClick={onCancel}>取消</AppButton>
                <AppButton type="button" onClick={() => onSubmit(days)}>確認上架</AppButton>
            </div>
        </div>
    );
}

// ── Booking form ───────────────────────────────────────────────────────────────

interface BookingFormProps {
    onSubmit: (preferredTime: string, note: string) => void;
    onCancel: () => void;
}

function BookingForm({ onSubmit, onCancel }: BookingFormProps) {
    const [preferredTime, setPreferredTime] = useState("");
    const [note, setNote] = useState("");
    return (
        <div className="form-body">
            <div className="form-field">
                <label className="form-label">希望看房時間</label>
                <input
                    type="datetime-local"
                    className="form-input"
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                />
            </div>
            <div className="form-field">
                <label className="form-label">備註（選填）</label>
                <input
                    type="text"
                    className="form-input"
                    placeholder="例：下午方便，請確認可行"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                />
            </div>
            <div className="form-actions">
                <AppButton type="button" variant="secondary" onClick={onCancel}>取消</AppButton>
                <AppButton
                    type="button"
                    onClick={() => onSubmit(new Date(preferredTime).toISOString(), note)}
                    disabled={!preferredTime}
                >
                    送出預約
                </AppButton>
            </div>
        </div>
    );
}

// ── Edit form (inline) ─────────────────────────────────────────────────────────

interface EditFormProps {
    listing: Listing;
    onSubmit: (payload: UpdateListingPayload) => void;
    onCancel: () => void;
}

function EditForm({ listing, onSubmit, onCancel }: EditFormProps) {
    const [form, setForm] = useState<UpdateListingPayload>({
        title: listing.title,
        description: listing.description ?? "",
        address: listing.address,
        district: listing.district ?? "",
        price: listing.price,
        area_ping: listing.area_ping,
        floor: listing.floor,
        total_floors: listing.total_floors,
        room_count: listing.room_count,
        bathroom_count: listing.bathroom_count,
        is_pet_allowed: listing.is_pet_allowed,
        is_parking_included: listing.is_parking_included,
    });

    const set = <K extends keyof UpdateListingPayload>(k: K, v: UpdateListingPayload[K]) =>
        setForm((prev) => ({ ...prev, [k]: v }));

    return (
        <div className="form-body">
            <div className="form-field">
                <label className="form-label">標題</label>
                <input className="form-input" value={form.title} onChange={(e) => set("title", e.target.value)} />
            </div>
            <div className="form-field">
                <label className="form-label">地址</label>
                <input className="form-input" value={form.address} onChange={(e) => set("address", e.target.value)} />
            </div>
            <div className="form-field">
                <label className="form-label">行政區</label>
                <input className="form-input" value={form.district ?? ""} onChange={(e) => set("district", e.target.value)} />
            </div>
            <div className="form-field">
                <label className="form-label">價格（NT$）</label>
                <input type="number" className="form-input" value={form.price} onChange={(e) => set("price", Number(e.target.value))} />
            </div>
            <div className="form-field">
                <label className="form-label">坪數</label>
                <input type="number" className="form-input" value={form.area_ping ?? ""} onChange={(e) => set("area_ping", e.target.value ? Number(e.target.value) : undefined)} />
            </div>
            <div className="form-field">
                <label className="form-label">樓層 / 總樓層</label>
                <div style={{ display: "flex", gap: "8px" }}>
                    <input type="number" className="form-input" placeholder="樓層" value={form.floor ?? ""} onChange={(e) => set("floor", e.target.value ? Number(e.target.value) : undefined)} />
                    <input type="number" className="form-input" placeholder="總樓層" value={form.total_floors ?? ""} onChange={(e) => set("total_floors", e.target.value ? Number(e.target.value) : undefined)} />
                </div>
            </div>
            <div className="form-field">
                <label className="form-label">房數 / 衛浴</label>
                <div style={{ display: "flex", gap: "8px" }}>
                    <input type="number" className="form-input" placeholder="房數" value={form.room_count ?? ""} onChange={(e) => set("room_count", e.target.value ? Number(e.target.value) : undefined)} />
                    <input type="number" className="form-input" placeholder="衛浴" value={form.bathroom_count ?? ""} onChange={(e) => set("bathroom_count", e.target.value ? Number(e.target.value) : undefined)} />
                </div>
            </div>
            <div className="form-field">
                <label style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                    <span className="form-label" style={{ margin: 0 }}>可養寵物</span>
                    <input type="checkbox" checked={form.is_pet_allowed} onChange={(e) => set("is_pet_allowed", e.target.checked)} />
                </label>
            </div>
            <div className="form-field">
                <label style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                    <span className="form-label" style={{ margin: 0 }}>含車位</span>
                    <input type="checkbox" checked={form.is_parking_included} onChange={(e) => set("is_parking_included", e.target.checked)} />
                </label>
            </div>
            <div className="form-field">
                <label className="form-label">描述</label>
                <textarea className="form-input" rows={4} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
            </div>
            <div className="form-actions">
                <AppButton type="button" variant="secondary" onClick={onCancel}>取消</AppButton>
                <AppButton type="button" onClick={() => onSubmit(form)}>儲存</AppButton>
            </div>
        </div>
    );
}

// ── Appointment row (owner view) ───────────────────────────────────────────────

interface ApptRowProps {
    appt: Appointment;
    negotiatingId?: number;
    onConfirm: (apptId: number) => void;
    onLock: (apptId: number) => void;
    onUnlock: () => void;
    onCancel: (apptId: number) => void;
    listingStatus: string;
}

function ApptRow({ appt, negotiatingId, onConfirm, onLock, onUnlock, onCancel, listingStatus }: ApptRowProps) {
    const isNegotiating = appt.id === negotiatingId;
    const isActive = listingStatus === "ACTIVE";
    const isNegotiatingStatus = listingStatus === "NEGOTIATING";
    const canLock = isActive && appt.status !== "CANCELLED";
    const canUnlock = isNegotiating && isNegotiatingStatus;

    return (
        <div className={`appt-row${isNegotiating ? " appt-row--negotiating" : ""}`}>
            <div className="appt-row-meta">
                <span className="appt-row-queue">第 {appt.queue_position} 組</span>
                <span className={`appt-row-status appt-status--${appt.status.toLowerCase()}`}>
                    {APPT_STATUS_LABEL[appt.status] ?? appt.status}
                </span>
                {isNegotiating && <span className="appt-row-negotiating-tag">洽談中</span>}
            </div>
            <div className="appt-row-time">
                希望時間：{new Date(appt.preferred_time).toLocaleString("zh-TW")}
                {appt.confirmed_time && (
                    <span>　確認時間：{new Date(appt.confirmed_time).toLocaleString("zh-TW")}</span>
                )}
            </div>
            {appt.note && <div className="appt-row-note">備註：{appt.note}</div>}
            <div className="appt-row-actions">
                {appt.status === "PENDING" && (
                    <AppButton type="button" variant="secondary" onClick={() => onConfirm(appt.id)}>
                        確認時間
                    </AppButton>
                )}
                {canLock && (
                    <AppButton type="button" onClick={() => onLock(appt.id)}>
                        鎖定洽談
                    </AppButton>
                )}
                {canUnlock && (
                    <AppButton type="button" variant="secondary" onClick={onUnlock}>
                        解除鎖定
                    </AppButton>
                )}
                {appt.status !== "CANCELLED" && (
                    <AppButton type="button" variant="secondary" onClick={() => onCancel(appt.id)}>
                        取消
                    </AppButton>
                )}
            </div>
        </div>
    );
}

// ── Main page ──────────────────────────────────────────────────────────────────

type ModalType = "publish" | "edit" | "book" | "confirm-appt" | null;
type ConfirmActionType = "remove" | "close" | "unlock" | null;

const ListingDetailPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [listing, setListing] = useState<Listing | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [modal, setModal] = useState<ModalType>(null);
    const [confirmAction, setConfirmAction] = useState<ConfirmActionType>(null);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [confirmingApptId, setConfirmingApptId] = useState<number | null>(null);

    const listingId = id ? parseInt(id, 10) : NaN;

    const load = async () => {
        if (isNaN(listingId)) {
            setErrorMessage("房源 ID 無效");
            setIsLoading(false);
            return;
        }
        try {
            setIsLoading(true);
            setErrorMessage("");
            const data = await getListing(listingId);
            setListing(data);
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : "載入房源失敗");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void load();
        void getAuthMe()
            .then((auth) => setIsAuthenticated(auth.authenticated))
            .catch(() => setIsAuthenticated(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listingId]);

    const withAction = async (action: () => Promise<void>, successMsg: string) => {
        try {
            setIsActionLoading(true);
            setErrorMessage("");
            await action();
            setSuccessMessage(successMsg);
            await load();
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : "操作失敗");
        } finally {
            setIsActionLoading(false);
            setConfirmAction(null);
            setModal(null);
        }
    };

    // ── Owner handlers ────────────────────────────────────────────────────────

    const handlePublish = (days: number) =>
        withAction(() => publishListing(listingId, days), `已上架，有效期 ${days} 天`);

    const handleEdit = (payload: UpdateListingPayload) =>
        withAction(() => updateListing(listingId, payload), "房源資料已更新");

    const handleRemove = () =>
        withAction(() => removeListing(listingId), "已下架");

    const handleClose = () =>
        withAction(() => closeListing(listingId), "已結案");

    const handleLock = (apptId: number) =>
        withAction(() => lockNegotiation(listingId, apptId), "已鎖定洽談，狀態切換為洽談中");

    const handleUnlock = () =>
        withAction(() => unlockNegotiation(listingId), "已解除鎖定");

    const handleConfirmAppt = (apptId: number, confirmedTime: string) =>
        withAction(() => confirmAppointment(listingId, apptId, confirmedTime), "已確認預約時間");

    const handleCancelAppt = (apptId: number) =>
        withAction(() => cancelAppointment(listingId, apptId), "預約已取消");

    // ── Visitor handlers ──────────────────────────────────────────────────────

    const handleBook = (preferredTime: string, note: string) =>
        withAction(() => bookAppointment(listingId, preferredTime, note).then(() => undefined), "預約送出成功");

    const handleSetViewed = () =>
        withAction(() => {
            const myAppt = listing?.appointments?.find((a) => a.status !== "CANCELLED");
            if (!myAppt) return Promise.resolve();
            return updateAppointmentStatus(listingId, myAppt.id, "VIEWED");
        }, "已標記為已看房");

    const handleSetInterested = () =>
        withAction(() => {
            const myAppt = listing?.appointments?.find((a) => a.status !== "CANCELLED");
            if (!myAppt) return Promise.resolve();
            return updateAppointmentStatus(listingId, myAppt.id, "INTERESTED");
        }, "已標記有意願");

    // ── Confirm dialog helpers ────────────────────────────────────────────────

    const CONFIRM_TITLE: Record<NonNullable<ConfirmActionType>, string> = {
        remove: "下架房源",
        close:  "結案",
        unlock: "解除洽談鎖定",
    };

    const CONFIRM_DESC: Record<NonNullable<ConfirmActionType>, string> = {
        remove: "確定要下架這筆房源？下架後訪客將看不到此物件。",
        close:  "確定要結案？此操作無法復原。",
        unlock: "確定要解除洽談鎖定？房源狀態將回到上架中。",
    };

    const handleConfirmDialogOk = () => {
        if (confirmAction === "remove") void handleRemove();
        else if (confirmAction === "close") void handleClose();
        else if (confirmAction === "unlock") void handleUnlock();
    };

    // ── Render helpers ────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <SiteLayout>
                <section className="page-section">
                    <PageLoading message="載入房源中..." />
                </section>
            </SiteLayout>
        );
    }

    if (!listing) {
        return (
            <SiteLayout>
                <section className="page-section">
                    <div className="page-state">
                        {errorMessage && <p className="text-danger">{errorMessage}</p>}
                        <p>找不到這筆房源資料。</p>
                        <AppButton type="button" variant="secondary" onClick={() => navigate("/listings")}>
                            返回列表
                        </AppButton>
                    </div>
                </section>
            </SiteLayout>
        );
    }

    const isOwner = listing.is_owner;
    const canBook = isAuthenticated && !isOwner && listing.status === "ACTIVE";
    const appointments = listing.appointments ?? [];
    const priceLabel = listing.list_type === "RENT"
        ? `NT$ ${listing.price.toLocaleString()} / 月`
        : `NT$ ${listing.price.toLocaleString()}`;

    return (
        <SiteLayout>
            <section className="page-section">
                <div className="page-heading page-heading-row">
                    <AppButton type="button" variant="secondary" onClick={() => navigate("/listings")}>
                        ← 返回列表
                    </AppButton>
                </div>

                {successMessage && (
                    <div className="feedback-banner success-banner"><p>{successMessage}</p></div>
                )}
                {errorMessage && (
                    <div className="feedback-banner error-banner"><p>{errorMessage}</p></div>
                )}

                {/* ── Listing detail ── */}
                <div className="listing-detail">
                    <div className="listing-detail-header">
                        <div className="listing-detail-badges">
                            <span className="status-badge">
                                {STATUS_LABEL[listing.status] ?? listing.status}
                            </span>
                            <span className="listing-type-chip">
                                {listing.list_type === "RENT" ? "租屋" : "售屋"}
                            </span>
                        </div>
                        <h1 className="listing-detail-title">{listing.title}</h1>
                        <div className="listing-detail-price">{priceLabel}</div>
                    </div>

                    <dl className="listing-detail-meta">
                        <dt>地址</dt>
                        <dd>{listing.district ? `${listing.district}　` : ""}{listing.address}</dd>
                        {listing.area_ping && <><dt>坪數</dt><dd>{listing.area_ping} 坪</dd></>}
                        {listing.floor && (
                            <>
                                <dt>樓層</dt>
                                <dd>{listing.floor}{listing.total_floors ? ` / ${listing.total_floors}F` : ""}樓</dd>
                            </>
                        )}
                        {listing.room_count && <><dt>格局</dt><dd>{listing.room_count} 房{listing.bathroom_count ? ` ${listing.bathroom_count} 衛` : ""}</dd></>}
                        <dt>寵物</dt>
                        <dd>{listing.is_pet_allowed ? "可養寵" : "不可養寵"}</dd>
                        <dt>車位</dt>
                        <dd>{listing.is_parking_included ? "含車位" : "無車位"}</dd>
                        {listing.published_at && <><dt>上架時間</dt><dd>{new Date(listing.published_at).toLocaleDateString("zh-TW")}</dd></>}
                        {listing.expires_at && <><dt>到期時間</dt><dd>{new Date(listing.expires_at).toLocaleDateString("zh-TW")}</dd></>}
                        <dt>建立時間</dt>
                        <dd>{new Date(listing.created_at).toLocaleString("zh-TW")}</dd>
                    </dl>

                    {listing.description && (
                        <div className="listing-detail-description">
                            <h3>物件描述</h3>
                            <p>{listing.description}</p>
                        </div>
                    )}

                    {listing.negotiating_appointment && (
                        <div className="listing-negotiating-banner">
                            洽談中：第 {listing.negotiating_appointment.queue_position} 組（
                            {new Date(listing.negotiating_appointment.preferred_time).toLocaleDateString("zh-TW")}）
                        </div>
                    )}

                    {/* ── Owner actions ── */}
                    {isOwner && (
                        <div className="listing-detail-actions">
                            {listing.status === "DRAFT" && (
                                <AppButton type="button" onClick={() => setModal("publish")}>上架房源</AppButton>
                            )}
                            {(listing.status === "DRAFT" || listing.status === "ACTIVE") && (
                                <AppButton type="button" variant="secondary" onClick={() => setModal("edit")}>編輯資料</AppButton>
                            )}
                            {listing.status === "ACTIVE" && (
                                <AppButton type="button" variant="secondary" onClick={() => setConfirmAction("remove")}>下架</AppButton>
                            )}
                            {(listing.status === "ACTIVE" || listing.status === "NEGOTIATING") && (
                                <AppButton type="button" variant="secondary" onClick={() => setConfirmAction("close")}>結案</AppButton>
                            )}
                            {listing.status === "NEGOTIATING" && (
                                <AppButton type="button" variant="secondary" onClick={() => setConfirmAction("unlock")}>解除洽談</AppButton>
                            )}
                        </div>
                    )}

                    {/* ── Visitor actions ── */}
                    {!isOwner && isAuthenticated && (
                        <div className="listing-detail-actions">
                            {canBook && (
                                <AppButton type="button" onClick={() => setModal("book")}>預約看房</AppButton>
                            )}
                            {appointments.some((a) => a.status === "CONFIRMED") && (
                                <>
                                    <AppButton type="button" variant="secondary" onClick={handleSetViewed}>標記已看房</AppButton>
                                    <AppButton type="button" variant="secondary" onClick={handleSetInterested}>標記有意願</AppButton>
                                </>
                            )}
                        </div>
                    )}

                    {!isAuthenticated && (
                        <div className="listing-detail-actions">
                            <p className="text-muted">請先登入並完成 KYC 驗證，才能預約看房。</p>
                        </div>
                    )}
                </div>

                {/* ── Appointments section ── */}
                {isAuthenticated && appointments.length > 0 && (
                    <div className="listing-appointments">
                        <h2>{isOwner ? "預約列表" : "看房隊列"}</h2>
                        <div className="appt-list">
                            {appointments.map((appt) =>
                                isOwner ? (
                                    <ApptRow
                                        key={appt.id}
                                        appt={appt}
                                        negotiatingId={listing.negotiating_appointment?.id}
                                        listingStatus={listing.status}
                                        onConfirm={(apptId) => {
                                            setConfirmingApptId(apptId);
                                            setModal("confirm-appt");
                                        }}
                                        onLock={handleLock}
                                        onUnlock={() => setConfirmAction("unlock")}
                                        onCancel={handleCancelAppt}
                                    />
                                ) : (
                                    <div key={appt.id} className="appt-row">
                                        <div className="appt-row-meta">
                                            <span className="appt-row-queue">第 {appt.queue_position} 組</span>
                                            <span className={`appt-row-status appt-status--${appt.status.toLowerCase()}`}>
                                                {APPT_STATUS_LABEL[appt.status] ?? appt.status}
                                            </span>
                                        </div>
                                        <div className="appt-row-time">
                                            希望時間：{new Date(appt.preferred_time).toLocaleString("zh-TW")}
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                )}
            </section>

            {/* ── Modals ── */}
            <AppModal isOpen={modal === "publish"} title="上架房源" onClose={() => setModal(null)}>
                <PublishForm onSubmit={handlePublish} onCancel={() => setModal(null)} />
            </AppModal>

            <AppModal isOpen={modal === "edit"} title="編輯房源資料" onClose={() => setModal(null)}>
                {listing && (
                    <EditForm listing={listing} onSubmit={handleEdit} onCancel={() => setModal(null)} />
                )}
            </AppModal>

            <AppModal isOpen={modal === "book"} title="預約看房" onClose={() => setModal(null)}>
                <BookingForm onSubmit={handleBook} onCancel={() => setModal(null)} />
            </AppModal>

            <AppModal isOpen={modal === "confirm-appt"} title="確認預約時間" onClose={() => setModal(null)}>
                <ConfirmApptForm
                    onSubmit={(time) => {
                        if (confirmingApptId) void handleConfirmAppt(confirmingApptId, time);
                    }}
                    onCancel={() => { setModal(null); setConfirmingApptId(null); }}
                />
            </AppModal>

            <ConfirmDialog
                isOpen={confirmAction !== null}
                title={confirmAction ? CONFIRM_TITLE[confirmAction] : ""}
                description={confirmAction ? CONFIRM_DESC[confirmAction] : ""}
                confirmText="確定"
                cancelText="取消"
                isLoading={isActionLoading}
                onConfirm={handleConfirmDialogOk}
                onCancel={() => setConfirmAction(null)}
            />
        </SiteLayout>
    );
};

// ── Confirm appointment time form ─────────────────────────────────────────────

interface ConfirmApptFormProps {
    onSubmit: (confirmedTime: string) => void;
    onCancel: () => void;
}

function ConfirmApptForm({ onSubmit, onCancel }: ConfirmApptFormProps) {
    const [time, setTime] = useState("");
    return (
        <div className="form-body">
            <div className="form-field">
                <label className="form-label">確認看房時間</label>
                <input
                    type="datetime-local"
                    className="form-input"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                />
            </div>
            <div className="form-actions">
                <AppButton type="button" variant="secondary" onClick={onCancel}>取消</AppButton>
                <AppButton
                    type="button"
                    onClick={() => onSubmit(new Date(time).toISOString())}
                    disabled={!time}
                >
                    確認
                </AppButton>
            </div>
        </div>
    );
}

export default ListingDetailPage;
