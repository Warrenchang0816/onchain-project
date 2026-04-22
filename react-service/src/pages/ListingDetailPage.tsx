import { type ReactNode, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAuthMe } from "../api/authApi";
import {
    bookAppointment,
    cancelAppointment,
    closeListing,
    confirmAppointment,
    getListing,
    lockNegotiation,
    publishListing,
    removeListing,
    type Appointment,
    type Listing,
    type UpdateListingPayload,
    unlockNegotiation,
    updateAppointmentStatus,
    updateListing,
} from "../api/listingApi";
import ListingEditorForm from "../components/listing/ListingEditorForm";
import { listingToEditorValues } from "../components/listing/listingEditorValues";
import SiteLayout from "../layouts/SiteLayout";

const STATUS_LABEL: Record<string, string> = {
    DRAFT: "Draft",
    ACTIVE: "Active",
    NEGOTIATING: "Negotiating",
    LOCKED: "Locked",
    SIGNING: "Signing",
    CLOSED: "Closed",
    EXPIRED: "Expired",
    REMOVED: "Removed",
    SUSPENDED: "Suspended",
};

const APPOINTMENT_STATUS_LABEL: Record<string, string> = {
    PENDING: "Pending",
    CONFIRMED: "Confirmed",
    VIEWED: "Viewed",
    INTERESTED: "Interested",
    CANCELLED: "Cancelled",
};

const inputCls =
    "block w-full px-4 py-3 bg-surface-container-low text-on-surface rounded-lg border-0 " +
    "focus:ring-2 focus:ring-primary-container transition-colors text-sm outline-none placeholder:text-outline";

type ModalType = "publish" | "edit" | "book" | "confirm-appt" | null;
type ConfirmType = "remove" | "close" | "unlock" | null;

function ActionButton(props: {
    children: ReactNode;
    onClick?: () => void;
    variant?: "primary" | "secondary" | "danger";
    disabled?: boolean;
}) {
    const cls = {
        primary:
            "w-full bg-[#E8B800] text-[#1C1917] font-bold py-3 px-4 rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] " +
            "hover:brightness-105 transition-all duration-200 active:scale-[0.98] disabled:opacity-50",
        secondary:
            "w-full bg-surface-container-lowest text-on-surface font-medium py-3 px-4 rounded-xl border border-outline-variant/20 " +
            "hover:bg-surface-container-low transition-all duration-200 active:scale-[0.98] disabled:opacity-50",
        danger:
            "w-full bg-surface-container-lowest text-error font-medium py-3 px-4 rounded-xl border border-error/20 " +
            "hover:bg-error-container transition-all duration-200 active:scale-[0.98] disabled:opacity-50",
    }[props.variant ?? "secondary"];

    return (
        <button type="button" onClick={props.onClick} disabled={props.disabled} className={cls}>
            {props.children}
        </button>
    );
}

function Field(props: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface-variant">{props.label}</label>
            {props.children}
        </div>
    );
}

function Modal(props: { isOpen: boolean; title: string; onClose: () => void; children: ReactNode }) {
    if (!props.isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={props.onClose} />
            <div className="relative bg-surface-container-lowest rounded-xl shadow-[0_24px_64px_rgba(28,25,23,0.18)] w-full max-w-lg max-h-[90vh] overflow-y-auto border border-outline-variant/10">
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-container">
                    <h2 className="text-base font-bold text-on-surface">{props.title}</h2>
                    <button type="button" onClick={props.onClose} className="text-on-surface-variant hover:text-on-surface transition-colors bg-transparent">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div className="px-6 py-5">{props.children}</div>
            </div>
        </div>
    );
}

function ConfirmDialog(props: {
    isOpen: boolean;
    title: string;
    description: string;
    isLoading: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    if (!props.isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={props.onCancel} />
            <div className="relative bg-surface-container-lowest rounded-xl shadow-[0_24px_64px_rgba(28,25,23,0.18)] w-full max-w-sm p-6 border border-outline-variant/10">
                <h2 className="text-base font-bold text-on-surface mb-2">{props.title}</h2>
                <p className="text-sm text-on-surface-variant mb-6">{props.description}</p>
                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        className="px-5 py-2.5 rounded-lg text-sm font-medium text-on-surface border border-outline-variant/50 bg-transparent hover:bg-surface-container transition-colors"
                        onClick={props.onCancel}
                        disabled={props.isLoading}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="px-5 py-2.5 rounded-lg text-sm font-bold text-error bg-transparent hover:bg-error-container transition-colors disabled:opacity-50"
                        onClick={props.onConfirm}
                        disabled={props.isLoading}
                    >
                        {props.isLoading ? "Working..." : "Confirm"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function PublishForm(props: { onSubmit: (days: number) => void; onCancel: () => void }) {
    const [days, setDays] = useState(30);

    return (
        <div className="flex flex-col gap-5">
            <Field label="Publish duration (days)">
                <input type="number" min={7} max={180} className={inputCls} value={days} onChange={(e) => setDays(Number(e.target.value))} />
                <p className="text-xs text-on-surface-variant mt-1">Platform fee preview: NT$ {(days * 40).toLocaleString()}</p>
            </Field>
            <div className="flex justify-end gap-3">
                <button
                    type="button"
                    className="px-5 py-2.5 rounded-lg text-sm font-medium text-on-surface border border-outline-variant/50 bg-transparent hover:bg-surface-container transition-colors"
                    onClick={props.onCancel}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    className="px-5 py-2.5 rounded-lg text-sm font-bold bg-primary-container text-on-surface hover:bg-inverse-primary transition-colors"
                    onClick={() => props.onSubmit(days)}
                >
                    Publish
                </button>
            </div>
        </div>
    );
}

function BookingForm(props: { onSubmit: (time: string, note: string) => void; onCancel: () => void }) {
    const [preferredTime, setPreferredTime] = useState("");
    const [note, setNote] = useState("");

    return (
        <div className="flex flex-col gap-5">
            <Field label="Preferred viewing time">
                <input type="datetime-local" className={inputCls} value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} />
            </Field>
            <Field label="Note">
                <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the owner should know?" />
            </Field>
            <div className="flex justify-end gap-3">
                <button
                    type="button"
                    className="px-5 py-2.5 rounded-lg text-sm font-medium text-on-surface border border-outline-variant/50 bg-transparent hover:bg-surface-container transition-colors"
                    onClick={props.onCancel}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={!preferredTime}
                    className="px-5 py-2.5 rounded-lg text-sm font-bold bg-primary-container text-on-surface hover:bg-inverse-primary transition-colors disabled:opacity-50"
                    onClick={() => props.onSubmit(new Date(preferredTime).toISOString(), note)}
                >
                    Book viewing
                </button>
            </div>
        </div>
    );
}

function ConfirmAppointmentForm(props: { onSubmit: (time: string) => void; onCancel: () => void }) {
    const [time, setTime] = useState("");

    return (
        <div className="flex flex-col gap-5">
            <Field label="Confirmed time">
                <input type="datetime-local" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
            <div className="flex justify-end gap-3">
                <button
                    type="button"
                    className="px-5 py-2.5 rounded-lg text-sm font-medium text-on-surface border border-outline-variant/50 bg-transparent hover:bg-surface-container transition-colors"
                    onClick={props.onCancel}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={!time}
                    className="px-5 py-2.5 rounded-lg text-sm font-bold bg-primary-container text-on-surface hover:bg-inverse-primary transition-colors disabled:opacity-50"
                    onClick={() => props.onSubmit(new Date(time).toISOString())}
                >
                    Confirm
                </button>
            </div>
        </div>
    );
}

function formatPrice(listing: Listing): string {
    if (listing.list_type === "RENT") return `NT$ ${listing.price.toLocaleString()} / month`;
    return `NT$ ${listing.price.toLocaleString()}`;
}

function formatAppointmentTime(value?: string): string {
    if (!value) return "Not set";
    return new Date(value).toLocaleString("zh-TW");
}

function badgeClass(status: string): string {
    if (status === "ACTIVE") return "bg-tertiary/10 text-tertiary";
    if (status === "NEGOTIATING") return "bg-amber-700/10 text-amber-700";
    if (status === "DRAFT") return "bg-surface-container text-on-surface-variant";
    return "bg-surface-container text-on-surface-variant";
}

export default function ListingDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [listing, setListing] = useState<Listing | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
    const [modal, setModal] = useState<ModalType>(null);
    const [confirmAction, setConfirmAction] = useState<ConfirmType>(null);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [confirmApptId, setConfirmApptId] = useState<number | null>(null);

    const listingId = id ? parseInt(id, 10) : Number.NaN;

    const load = async () => {
        if (Number.isNaN(listingId)) {
            setErrorMsg("Invalid listing id.");
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            setErrorMsg("");
            setListing(await getListing(listingId));
        } catch (err) {
            setListing(null);
            setErrorMsg(err instanceof Error ? err.message : "Failed to load listing.");
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
            setErrorMsg(err instanceof Error ? err.message : "Action failed.");
        } finally {
            setIsActionLoading(false);
            setConfirmAction(null);
            setModal(null);
        }
    };

    if (isLoading) {
        return (
            <SiteLayout>
                <div className="flex items-center justify-center py-32">
                    <span className="text-sm text-on-surface-variant animate-pulse">Loading listing...</span>
                </div>
            </SiteLayout>
        );
    }

    if (!listing) {
        return (
            <SiteLayout>
                <main className="w-full max-w-[960px] mx-auto px-6 md:px-12 py-20">
                    <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-10 flex flex-col gap-4">
                        <h1 className="text-3xl font-extrabold text-on-background">Listing not available</h1>
                        <p className="text-sm text-on-surface-variant">{errorMsg || "This listing was removed or does not exist."}</p>
                        <div>
                            <button
                                type="button"
                                className="px-5 py-2.5 rounded-lg text-sm font-bold bg-primary-container text-on-surface hover:bg-inverse-primary transition-colors"
                                onClick={() => navigate("/listings")}
                            >
                                Back to listings
                            </button>
                        </div>
                    </div>
                </main>
            </SiteLayout>
        );
    }

    const isOwner = listing.is_owner;
    const appointments = listing.appointments ?? [];
    const canBook = isAuthenticated && !isOwner && listing.status === "ACTIVE";
    const confirmedAppointment = appointments.find((item) => item.status === "CONFIRMED");

    const handlePublish = (days: number) =>
        runAction(() => publishListing(listingId, days), `Listing published for ${days} days.`);
    const handleEdit = (payload: UpdateListingPayload) =>
        runAction(() => updateListing(listingId, payload), "Listing updated.");
    const handleRemove = () => runAction(() => removeListing(listingId), "Listing removed.");
    const handleClose = () => runAction(() => closeListing(listingId), "Listing closed.");
    const handleUnlock = () => runAction(() => unlockNegotiation(listingId), "Negotiation unlocked.");
    const handleLock = (appointmentId: number) =>
        runAction(() => lockNegotiation(listingId, appointmentId), "Negotiation locked to this queue.");
    const handleBook = (time: string, note: string) =>
        runAction(() => bookAppointment(listingId, time, note).then(() => undefined), "Viewing request submitted.");
    const handleConfirmAppointment = (appointmentId: number, time: string) =>
        runAction(() => confirmAppointment(listingId, appointmentId, time), "Viewing time confirmed.");
    const handleCancelAppointment = (appointmentId: number) =>
        runAction(() => cancelAppointment(listingId, appointmentId), "Appointment cancelled.");
    const handleViewed = () => {
        const target = appointments.find((item) => item.status !== "CANCELLED");
        return target
            ? runAction(() => updateAppointmentStatus(listingId, target.id, "VIEWED"), "Marked as viewed.")
            : undefined;
    };
    const handleInterested = () => {
        const target = appointments.find((item) => item.status !== "CANCELLED");
        return target
            ? runAction(() => updateAppointmentStatus(listingId, target.id, "INTERESTED"), "Marked as interested.")
            : undefined;
    };

    const confirmTitle: Record<NonNullable<ConfirmType>, string> = {
        remove: "Remove listing",
        close: "Close listing",
        unlock: "Unlock negotiation",
    };

    const confirmDescription: Record<NonNullable<ConfirmType>, string> = {
        remove: "This removes the listing from the active marketplace.",
        close: "This marks the listing as closed and stops further progress.",
        unlock: "This sends the listing back to the active queue.",
    };

    const handleConfirmOk = () => {
        if (confirmAction === "remove") void handleRemove();
        if (confirmAction === "close") void handleClose();
        if (confirmAction === "unlock") void handleUnlock();
    };

    const queueSummary = listing.negotiating_appointment
        ? `Locked to queue #${listing.negotiating_appointment.queue_position}`
        : `${appointments.length} appointment(s)`;

    return (
        <SiteLayout>
            <main className="flex-grow w-full max-w-[1440px] mx-auto px-6 md:px-12 py-8 flex flex-col gap-8">
                <div>
                    <button
                        type="button"
                        onClick={() => navigate("/listings")}
                        className="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary-container transition-colors duration-200 text-sm font-medium bg-transparent"
                    >
                        <span className="material-symbols-outlined text-sm">arrow_back</span>
                        Back to listings
                    </button>
                </div>

                {successMsg ? (
                    <div className="bg-tertiary/10 border border-tertiary/20 rounded-xl p-4 flex items-center gap-3">
                        <span className="material-symbols-outlined text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                        <p className="text-tertiary font-medium text-sm">{successMsg}</p>
                    </div>
                ) : null}

                {errorMsg ? (
                    <div className="bg-error-container border border-error/20 rounded-xl p-4">
                        <p className="text-on-error-container text-sm">{errorMsg}</p>
                    </div>
                ) : null}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-8 flex flex-col gap-8">
                        <div className="grid grid-cols-4 grid-rows-2 gap-4 h-[400px] md:h-[500px]">
                            <div className="col-span-4 md:col-span-3 row-span-2 rounded-xl overflow-hidden relative group bg-surface-variant">
                                {listing.image_url ? (
                                    <img
                                        src={listing.image_url}
                                        alt={listing.title}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-8xl text-on-surface-variant/20" style={{ fontVariationSettings: "'FILL' 1" }}>
                                            home
                                        </span>
                                    </div>
                                )}
                                <div className="absolute top-4 left-4 flex gap-2">
                                    <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-sm ${badgeClass(listing.status)}`}>
                                        {STATUS_LABEL[listing.status] ?? listing.status}
                                    </span>
                                </div>
                            </div>
                            <div className="hidden md:flex col-span-1 row-span-1 rounded-xl overflow-hidden relative bg-surface-container-high p-4 flex-col justify-between">
                                <span className="text-xs uppercase tracking-wider text-on-surface-variant">District</span>
                                <span className="text-lg font-bold text-on-surface">{listing.district ?? "N/A"}</span>
                                <span className="text-xs text-on-surface-variant">{listing.list_type}</span>
                            </div>
                            <div className="hidden md:flex col-span-1 row-span-1 rounded-xl overflow-hidden relative bg-surface-container p-4 flex-col justify-between">
                                <span className="text-xs uppercase tracking-wider text-on-surface-variant">Queue</span>
                                <span className="text-lg font-bold text-on-surface">{appointments.length}</span>
                                <span className="text-xs text-on-surface-variant">{queueSummary}</span>
                            </div>
                        </div>

                        <div className="bg-surface-container-lowest rounded-xl p-8 shadow-[0_4px_32px_rgba(28,25,23,0.02)] border border-outline-variant/15 flex flex-col gap-6">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-surface-container-highest pb-6">
                                <div className="flex flex-col gap-2">
                                    <h1 className="text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight leading-tight font-headline">
                                        {listing.title}
                                    </h1>
                                    <p className="text-on-surface-variant text-sm flex items-center gap-1">
                                        <span className="material-symbols-outlined text-base">location_on</span>
                                        {listing.district ? `${listing.district} ` : ""}
                                        {listing.address}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-on-surface-variant mb-1">{listing.list_type === "RENT" ? "Rental price" : "Sale price"}</p>
                                    <p className="text-3xl md:text-4xl font-bold text-[#E8B800] tracking-tight font-headline">{formatPrice(listing)}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-4">
                                {listing.room_count !== undefined ? (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm text-on-surface-variant font-medium">Rooms</span>
                                        <span className="text-lg font-bold text-on-surface">{listing.room_count}</span>
                                    </div>
                                ) : null}
                                {listing.bathroom_count !== undefined ? (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm text-on-surface-variant font-medium">Bathrooms</span>
                                        <span className="text-lg font-bold text-on-surface">{listing.bathroom_count}</span>
                                    </div>
                                ) : null}
                                {listing.area_ping !== undefined ? (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm text-on-surface-variant font-medium">Area</span>
                                        <span className="text-lg font-bold text-on-surface">{listing.area_ping} ping</span>
                                    </div>
                                ) : null}
                                {(listing.floor !== undefined || listing.total_floors !== undefined) ? (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm text-on-surface-variant font-medium">Floor</span>
                                        <span className="text-lg font-bold text-on-surface">
                                            {listing.floor ?? "?"}{listing.total_floors !== undefined ? ` / ${listing.total_floors}` : ""}
                                        </span>
                                    </div>
                                ) : null}
                                <div className="flex flex-col gap-1">
                                    <span className="text-sm text-on-surface-variant font-medium">Pet friendly</span>
                                    <span className="text-lg font-bold text-on-surface">{listing.is_pet_allowed ? "Yes" : "No"}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-sm text-on-surface-variant font-medium">Parking</span>
                                    <span className="text-lg font-bold text-on-surface">{listing.is_parking_included ? "Included" : "Not included"}</span>
                                </div>
                            </div>

                            {listing.description ? (
                                <div className="prose max-w-none text-on-surface-variant leading-[1.75]">
                                    <p className="whitespace-pre-wrap">{listing.description}</p>
                                </div>
                            ) : null}
                        </div>

                        <div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/15 flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-tertiary/10 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-tertiary">contract</span>
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-on-surface mb-1">On-chain roadmap note</h3>
                                <p className="text-sm text-on-surface-variant leading-[1.75]">
                                    This page is still using the off-chain Gate 0 listing workflow. Property, Agency, Case, and Stake proof surfaces will arrive in later gates.
                                </p>
                            </div>
                        </div>

                        {isOwner && isAuthenticated && appointments.length > 0 ? (
                            <div className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_4px_32px_rgba(28,25,23,0.02)] border border-outline-variant/15 flex flex-col gap-4">
                                <h3 className="text-lg font-bold text-on-surface font-headline border-b border-surface-container-highest pb-3">
                                    Viewing queue
                                </h3>
                                <div className="flex flex-col gap-4">
                                    {appointments.map((appointment) => {
                                        const isNegotiating = appointment.id === listing.negotiating_appointment?.id;
                                        const canLockQueue = listing.status === "ACTIVE" && appointment.status !== "CANCELLED";
                                        const canUnlockQueue = isNegotiating && listing.status === "NEGOTIATING";

                                        return (
                                            <div key={appointment.id} className="flex items-center justify-between gap-4 p-3 rounded-lg bg-surface-container-low border border-outline-variant/10">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center">
                                                        <span className="material-symbols-outlined text-on-surface-variant">person</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-on-surface">
                                                            Queue #{appointment.queue_position}
                                                            <span className="ml-2 text-xs font-normal text-on-surface-variant">
                                                                {APPOINTMENT_STATUS_LABEL[appointment.status] ?? appointment.status}
                                                            </span>
                                                            {isNegotiating ? <span className="ml-2 text-xs font-bold text-primary-container">Negotiating</span> : null}
                                                        </p>
                                                        <p className="text-xs text-on-surface-variant">
                                                            Requested: {formatAppointmentTime(appointment.preferred_time)}
                                                        </p>
                                                        {appointment.confirmed_time ? (
                                                            <p className="text-xs text-on-surface-variant">
                                                                Confirmed: {formatAppointmentTime(appointment.confirmed_time)}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-2 justify-end">
                                                    {appointment.status === "PENDING" ? (
                                                        <button
                                                            type="button"
                                                            className="text-xs font-medium bg-surface-container-lowest border border-outline-variant/20 text-on-surface px-3 py-1.5 rounded-lg hover:bg-surface-variant transition-colors"
                                                            onClick={() => {
                                                                setConfirmApptId(appointment.id);
                                                                setModal("confirm-appt");
                                                            }}
                                                        >
                                                            Confirm time
                                                        </button>
                                                    ) : null}
                                                    {canLockQueue ? (
                                                        <button
                                                            type="button"
                                                            className="text-xs font-medium bg-surface-container-lowest border border-outline-variant/20 text-on-surface px-3 py-1.5 rounded-lg hover:bg-surface-variant transition-colors"
                                                            onClick={() => void handleLock(appointment.id)}
                                                        >
                                                            Lock negotiation
                                                        </button>
                                                    ) : null}
                                                    {canUnlockQueue ? (
                                                        <button
                                                            type="button"
                                                            className="text-xs font-medium bg-[#E8B800] text-[#1C1917] px-3 py-1.5 rounded-lg hover:brightness-105 transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
                                                            onClick={() => setConfirmAction("unlock")}
                                                        >
                                                            Unlock
                                                        </button>
                                                    ) : null}
                                                    {appointment.status !== "CANCELLED" ? (
                                                        <button
                                                            type="button"
                                                            className="text-xs font-medium text-error bg-transparent hover:bg-error-container px-3 py-1.5 rounded-lg transition-colors"
                                                            onClick={() => void handleCancelAppointment(appointment.id)}
                                                        >
                                                            Cancel
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : null}
                    </div>

                    <div className="lg:col-span-4 flex flex-col gap-6">
                        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_4px_32px_rgba(28,25,23,0.02)] border border-outline-variant/15 sticky top-[88px] flex flex-col gap-6">
                            <div className="flex items-center gap-4 border-b border-surface-container-highest pb-4">
                                <div className="w-12 h-12 rounded-full bg-surface-container-high overflow-hidden flex items-center justify-center">
                                    <span className="material-symbols-outlined text-on-surface-variant">person</span>
                                </div>
                                <div>
                                    <p className="text-sm text-on-surface-variant">Owner</p>
                                    <p className="text-base font-bold text-on-surface">{isOwner ? "You" : "Verified member"}</p>
                                </div>
                            </div>

                            {listing.status === "NEGOTIATING" ? (
                                <div className="bg-[#FEF3C7] rounded-lg p-3 border border-[#F59E0B]/20 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[#B45309] text-sm">info</span>
                                    <p className="text-sm text-[#B45309] font-medium">{queueSummary}</p>
                                </div>
                            ) : null}

                            <div className="flex flex-col gap-3">
                                {isOwner ? (
                                    <>
                                        {listing.status === "DRAFT" ? (
                                            <ActionButton variant="primary" onClick={() => setModal("publish")}>
                                                Publish listing
                                            </ActionButton>
                                        ) : null}
                                        {(listing.status === "DRAFT" || listing.status === "ACTIVE") ? (
                                            <ActionButton variant="secondary" onClick={() => setModal("edit")}>
                                                Edit listing
                                            </ActionButton>
                                        ) : null}
                                        {listing.status === "ACTIVE" ? (
                                            <ActionButton variant="secondary" onClick={() => setConfirmAction("remove")}>
                                                Remove listing
                                            </ActionButton>
                                        ) : null}
                                        {(listing.status === "ACTIVE" || listing.status === "NEGOTIATING") ? (
                                            <ActionButton variant="secondary" onClick={() => setConfirmAction("close")}>
                                                Close listing
                                            </ActionButton>
                                        ) : null}
                                        {listing.status === "NEGOTIATING" ? (
                                            <ActionButton variant="secondary" onClick={() => setConfirmAction("unlock")}>
                                                Unlock negotiation
                                            </ActionButton>
                                        ) : null}
                                    </>
                                ) : isAuthenticated ? (
                                    <>
                                        {canBook ? (
                                            <ActionButton variant="primary" onClick={() => setModal("book")}>
                                                Book viewing
                                            </ActionButton>
                                        ) : null}
                                        <ActionButton variant="secondary">Contact owner</ActionButton>
                                        {confirmedAppointment ? (
                                            <>
                                                <ActionButton variant="secondary" onClick={() => void handleViewed()}>
                                                    Mark viewed
                                                </ActionButton>
                                                <ActionButton variant="secondary" onClick={() => void handleInterested()}>
                                                    Mark interested
                                                </ActionButton>
                                            </>
                                        ) : null}
                                        {!canBook && listing.status !== "ACTIVE" ? (
                                            <p className="text-xs text-on-surface-variant text-center py-2">
                                                This listing is not open for new appointments right now.
                                            </p>
                                        ) : null}
                                    </>
                                ) : (
                                    <>
                                        <ActionButton variant="primary" onClick={() => navigate("/login")}>
                                            Login to book viewing
                                        </ActionButton>
                                        <ActionButton variant="secondary">Contact owner</ActionButton>
                                    </>
                                )}
                            </div>
                        </div>

                        {isAuthenticated && !isOwner && appointments.length > 0 ? (
                            <div className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_4px_32px_rgba(28,25,23,0.02)] border border-outline-variant/15 flex flex-col gap-4">
                                <h3 className="text-lg font-bold text-on-surface font-headline border-b border-surface-container-highest pb-3">
                                    Your queue status
                                </h3>
                                <div className="flex flex-col gap-3">
                                    {appointments.map((appointment: Appointment) => (
                                        <div key={appointment.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low border border-outline-variant/10">
                                            <div>
                                                <p className="text-sm font-bold text-on-surface">Queue #{appointment.queue_position}</p>
                                                <p className="text-xs text-on-surface-variant">
                                                    {APPOINTMENT_STATUS_LABEL[appointment.status] ?? appointment.status}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            </main>

            <Modal isOpen={modal === "publish"} title="Publish listing" onClose={() => setModal(null)}>
                <PublishForm onSubmit={handlePublish} onCancel={() => setModal(null)} />
            </Modal>
            <Modal isOpen={modal === "edit"} title="Edit listing" onClose={() => setModal(null)}>
                <ListingEditorForm
                    mode="edit"
                    initialValues={listingToEditorValues(listing)}
                    submitting={isActionLoading}
                    submitLabel="Save changes"
                    onSubmit={(payload) => handleEdit(payload as UpdateListingPayload)}
                    onCancel={() => setModal(null)}
                />
            </Modal>
            <Modal isOpen={modal === "book"} title="Book viewing" onClose={() => setModal(null)}>
                <BookingForm onSubmit={handleBook} onCancel={() => setModal(null)} />
            </Modal>
            <Modal
                isOpen={modal === "confirm-appt"}
                title="Confirm viewing time"
                onClose={() => {
                    setModal(null);
                    setConfirmApptId(null);
                }}
            >
                <ConfirmAppointmentForm
                    onSubmit={(time) => {
                        if (confirmApptId) void handleConfirmAppointment(confirmApptId, time);
                    }}
                    onCancel={() => {
                        setModal(null);
                        setConfirmApptId(null);
                    }}
                />
            </Modal>
            <ConfirmDialog
                isOpen={confirmAction !== null}
                title={confirmAction ? confirmTitle[confirmAction] : ""}
                description={confirmAction ? confirmDescription[confirmAction] : ""}
                isLoading={isActionLoading}
                onConfirm={handleConfirmOk}
                onCancel={() => setConfirmAction(null)}
            />
        </SiteLayout>
    );
}
