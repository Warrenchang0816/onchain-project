import { useEffect, useState } from "react";
import {
    listPropertyAppointments,
    confirmAppointment,
    cancelAppointment,
    type Appointment,
    type AppointmentStatus,
} from "../../api/appointmentApi";

const STATUS_LABEL: Record<AppointmentStatus, string> = {
    PENDING: "待確認",
    CONFIRMED: "已確認",
    VIEWED: "已看房",
    INTERESTED: "有意願",
    CANCELLED: "已取消",
};

const STATUS_BADGE_CLS: Record<AppointmentStatus, string> = {
    PENDING: "bg-amber-100 text-amber-800",
    CONFIRMED: "bg-[#E8F5E9] text-[#2E7D32]",
    VIEWED: "bg-surface-container text-on-surface-variant",
    INTERESTED: "bg-primary-container text-on-primary-container",
    CANCELLED: "bg-surface-container text-on-surface-variant",
};

type ConfirmState = { appointmentId: number; value: string } | null;

function formatTime(iso: string): string {
    return new Date(iso).toLocaleString("zh-TW", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
    });
}

// Convert ISO/local string to datetime-local input value (YYYY-MM-DDTHH:mm)
function toDatetimeLocal(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PropertyAppointments({ propertyId }: { propertyId: number }) {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [confirmState, setConfirmState] = useState<ConfirmState>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState("");

    const loadAppointments = () => {
        setLoading(true);
        setError("");
        listPropertyAppointments(propertyId)
            .then(setAppointments)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "讀取預約失敗"))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [propertyId]);

    const handleConfirm = async (appointmentId: number, confirmedTime: string) => {
        setActionLoading(true);
        setActionError("");
        try {
            await confirmAppointment(appointmentId, new Date(confirmedTime).toISOString());
            setConfirmState(null);
            loadAppointments();
        } catch (e) {
            setActionError(e instanceof Error ? e.message : "確認失敗");
        } finally {
            setActionLoading(false);
        }
    };

    const handleCancel = async (appointmentId: number) => {
        setActionLoading(true);
        setActionError("");
        try {
            await cancelAppointment(appointmentId);
            loadAppointments();
        } catch (e) {
            setActionError(e instanceof Error ? e.message : "取消失敗");
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div
            className="mt-4 rounded-xl border border-outline-variant/15 bg-surface-container-low p-4"
            onClick={(e) => e.stopPropagation()}
        >
            <h3 className="mb-3 text-sm font-bold text-on-surface">看房預約</h3>

            {loading ? (
                <p className="text-xs text-on-surface-variant">讀取中...</p>
            ) : error ? (
                <p className="rounded-lg bg-error-container p-2 text-xs text-on-error-container">{error}</p>
            ) : appointments.length === 0 ? (
                <p className="text-xs text-on-surface-variant">尚無預約</p>
            ) : (
                <div className="flex flex-col gap-3">
                    {actionError && (
                        <p className="rounded-lg bg-error-container p-2 text-xs text-on-error-container">{actionError}</p>
                    )}
                    {appointments.map((a) => (
                        <div
                            key={a.id}
                            className="flex flex-col gap-2 rounded-lg bg-surface-container-lowest p-3 md:flex-row md:items-start md:justify-between"
                        >
                            <div className="flex flex-col gap-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-semibold text-on-surface-variant">
                                        #{a.queue_position} 號
                                    </span>
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE_CLS[a.status]}`}>
                                        {STATUS_LABEL[a.status]}
                                    </span>
                                </div>
                                <p className="text-xs text-on-surface-variant">
                                    希望看房時間：<span className="font-medium text-on-surface">{formatTime(a.preferred_time)}</span>
                                </p>
                                {a.confirmed_time && (
                                    <p className="text-xs text-on-surface-variant">
                                        確認時間：<span className="font-medium text-on-surface">{formatTime(a.confirmed_time)}</span>
                                    </p>
                                )}
                                {a.note && (
                                    <p className="text-xs text-on-surface-variant">備註：{a.note}</p>
                                )}
                            </div>

                            {a.status === "PENDING" && (
                                <div className="flex flex-col gap-2">
                                    {confirmState?.appointmentId === a.id ? (
                                        <div className="flex flex-col gap-2">
                                            <input
                                                type="datetime-local"
                                                value={confirmState.value}
                                                onChange={(e) =>
                                                    setConfirmState({ appointmentId: a.id, value: e.target.value })
                                                }
                                                className="rounded-lg border border-outline-variant/30 bg-surface px-2 py-1 text-xs text-on-surface"
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    disabled={actionLoading}
                                                    onClick={() => void handleConfirm(a.id, confirmState.value)}
                                                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-40"
                                                >
                                                    {actionLoading ? "處理中..." : "送出確認"}
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={actionLoading}
                                                    onClick={() => setConfirmState(null)}
                                                    className="rounded-lg bg-surface-container-high px-3 py-1.5 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container disabled:opacity-40"
                                                >
                                                    返回
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                disabled={actionLoading}
                                                onClick={() =>
                                                    setConfirmState({
                                                        appointmentId: a.id,
                                                        value: toDatetimeLocal(a.preferred_time),
                                                    })
                                                }
                                                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-40"
                                            >
                                                確認
                                            </button>
                                            <button
                                                type="button"
                                                disabled={actionLoading}
                                                onClick={() => void handleCancel(a.id)}
                                                className="rounded-lg bg-surface-container-high px-3 py-1.5 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container disabled:opacity-40"
                                            >
                                                取消
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
