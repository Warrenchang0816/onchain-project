const API_BASE_URL =
    import.meta.env.VITE_API_GO_SERVICE_URL ?? "http://localhost:8081/api";

export type ListingType = "SALE" | "RENT";

export interface Favorite {
    id: number;
    listing_type: ListingType;
    listing_id: number;
}

async function parse<T>(res: Response): Promise<T> {
    const raw = await res.text();
    const data = raw ? (JSON.parse(raw) as T & { error?: string; message?: string }) : ({} as T);
    if (!res.ok) throw new Error((data as { error?: string; message?: string }).error ?? (data as { message?: string }).message ?? raw);
    return data;
}

export async function getFavorites(type: ListingType): Promise<Favorite[]> {
    const res = await fetch(`${API_BASE_URL}/favorites?type=${type}`, { credentials: "include" });
    const data = await parse<{ data: Favorite[] }>(res);
    return data.data;
}

export async function checkFavorite(type: ListingType, id: number): Promise<boolean> {
    const res = await fetch(`${API_BASE_URL}/favorites/${type}/${id}/check`, { credentials: "include" });
    const data = await parse<{ data: { favorited: boolean } }>(res);
    return data.data.favorited;
}

export async function addFavorite(type: ListingType, id: number): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/favorites`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_type: type, listing_id: id }),
    });
    await parse<unknown>(res);
}

export async function removeFavorite(type: ListingType, id: number): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/favorites/${type}/${id}`, {
        method: "DELETE",
        credentials: "include",
    });
    await parse<unknown>(res);
}
