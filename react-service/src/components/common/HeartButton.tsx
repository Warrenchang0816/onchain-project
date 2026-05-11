import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addFavorite, checkFavorite, removeFavorite, type ListingType } from "@/api/favoritesApi";

type Props = {
    listingType: ListingType;
    listingId: number;
    authenticated: boolean;
};

export default function HeartButton({ listingType, listingId, authenticated }: Props) {
    const navigate = useNavigate();
    const [favorited, setFavorited] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!authenticated) return;
        let cancelled = false;
        checkFavorite(listingType, listingId)
            .then((v) => { if (!cancelled) setFavorited(v); })
            .catch(() => undefined);
        return () => { cancelled = true; };
    }, [authenticated, listingType, listingId]);

    const handleClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!authenticated) {
            navigate("/login");
            return;
        }
        if (busy) return;
        setBusy(true);
        try {
            if (favorited) {
                await removeFavorite(listingType, listingId);
                setFavorited(false);
            } else {
                await addFavorite(listingType, listingId);
                setFavorited(true);
            }
        } catch {
            // silent fail — state stays unchanged
        } finally {
            setBusy(false);
        }
    };

    return (
        <button
            type="button"
            aria-label={favorited ? "移除收藏" : "加入收藏"}
            onClick={(e) => void handleClick(e)}
            disabled={busy}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container transition-colors hover:bg-surface-container-high disabled:opacity-50"
        >
            <span
                className="material-symbols-outlined text-xl"
                style={{
                    fontVariationSettings: favorited ? "'FILL' 1" : "'FILL' 0",
                    color: favorited ? "#e53e3e" : undefined,
                }}
            >
                favorite
            </span>
        </button>
    );
}
