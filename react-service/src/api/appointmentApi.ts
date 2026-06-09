const API = import.meta.env.VITE_API_GO_SERVICE_URL || "http://localhost:8081/api";

export type AppointmentStatus = "PENDING" | "CONFIRMED" | "VIEWED" | "INTERESTED" | "CANCELLED";

export type Appointment = {
    id: number;
    property_id: number;
    visitor_user_id: number;
    queue_position: number;
    preferred_time: string;
    confirmed_time?: string;
    status: AppointmentStatus;
    note?: string;
};

async function parse<T>(res: Response): Promise<T> {
    const raw = await res.text();
    const data = raw ? (JSON.parse(raw) as T & { error?: string; message?: string }) : ({} as T & { error?: string; message?: string });
    if (!res.ok) throw new Error((data as { message?: string }).message ?? raw ?? `Request failed: ${res.status}`);
    return data;
}

export async function bookAppointment(rentalListingId: number, preferredTime: string, note?: string): Promise<{ id: number }> {
    const res = await fetch(`${API}/rental-listing/${rentalListingId}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ preferred_time: preferredTime, note }),
    });
    const data = await parse<{ data: { id: number } }>(res);
    return data.data;
}

export async function listPropertyAppointments(propertyId: number): Promise<Appointment[]> {
    const res = await fetch(`${API}/property/${propertyId}/appointments`, { credentials: "include" });
    const data = await parse<{ data: Appointment[] }>(res);
    return data.data ?? [];
}

export async function confirmAppointment(id: number, confirmedTime: string): Promise<void> {
    const res = await fetch(`${API}/appointments/${id}/confirm`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ confirmed_time: confirmedTime }),
    });
    await parse<unknown>(res);
}

export async function cancelAppointment(id: number): Promise<void> {
    const res = await fetch(`${API}/appointments/${id}/cancel`, { method: "PUT", credentials: "include" });
    await parse<unknown>(res);
}
