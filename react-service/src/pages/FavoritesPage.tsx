import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteLayout from "@/layouts/SiteLayout";
import HeartButton from "@/components/common/HeartButton";
import { getFavorites, type Favorite } from "@/api/favoritesApi";
import { getSaleListing, type SaleListing } from "@/api/saleListingApi";
import { getRentalListing, type RentalListing } from "@/api/rentalListingApi";

type Tab = "SALE" | "RENT";

// ── Sale card ────────────────────────────────────────────────────────────────

function SaleFavoriteCard({ listingId }: { listingId: number }) {
    const navigate = useNavigate();
    const [listing, setListing] = useState<SaleListing | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        getSaleListing(listingId)
            .then((data) => { if (!cancelled) setListing(data); })
            .catch((err: unknown) => {
                if (!cancelled) setError(err instanceof Error ? err.message : "載入失敗");
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [listingId]);

    if (loading) {
        return (
            <div className="animate-pulse rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5">
                <div className="mb-3 h-5 w-2/3 rounded bg-surface-container-high" />
                <div className="mb-2 h-4 w-1/2 rounded bg-surface-container-high" />
                <div className="h-4 w-1/4 rounded bg-surface-container-high" />
            </div>
        );
    }

    if (error || !listing) {
        return (
            <div className="rounded-2xl border border-error/30 bg-error-container/20 p-5 text-sm text-on-error-container">
                {error ?? "無法載入物件資料"}
            </div>
        );
    }

    const title = listing.property?.title ?? `出售物件 #${listing.id}`;
    const address = listing.property?.address ?? "—";
    const price = listing.total_price.toLocaleString();

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/sale/${listing.id}`)}
            onKeyDown={(e) => { if (e.key === "Enter") navigate(`/sale/${listing.id}`); }}
            className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 transition-shadow hover:shadow-md"
        >
            <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-on-surface">{title}</p>
                <p className="mt-1 truncate text-sm text-on-surface-variant">{address}</p>
                <p className="mt-2 text-sm font-bold text-primary-container">NT$ {price} 萬</p>
            </div>
            <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                <HeartButton listingType="SALE" listingId={listing.id} authenticated={true} />
            </div>
        </div>
    );
}

// ── Rental card ──────────────────────────────────────────────────────────────

function RentFavoriteCard({ listingId }: { listingId: number }) {
    const navigate = useNavigate();
    const [listing, setListing] = useState<RentalListing | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        getRentalListing(listingId)
            .then((data) => { if (!cancelled) setListing(data); })
            .catch((err: unknown) => {
                if (!cancelled) setError(err instanceof Error ? err.message : "載入失敗");
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [listingId]);

    if (loading) {
        return (
            <div className="animate-pulse rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5">
                <div className="mb-3 h-5 w-2/3 rounded bg-surface-container-high" />
                <div className="mb-2 h-4 w-1/2 rounded bg-surface-container-high" />
                <div className="h-4 w-1/4 rounded bg-surface-container-high" />
            </div>
        );
    }

    if (error || !listing) {
        return (
            <div className="rounded-2xl border border-error/30 bg-error-container/20 p-5 text-sm text-on-error-container">
                {error ?? "無法載入物件資料"}
            </div>
        );
    }

    const title = listing.property?.title ?? `出租物件 #${listing.id}`;
    const address = listing.property?.address ?? "—";
    const rent = listing.monthly_rent.toLocaleString();

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/rent/${listing.id}`)}
            onKeyDown={(e) => { if (e.key === "Enter") navigate(`/rent/${listing.id}`); }}
            className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 transition-shadow hover:shadow-md"
        >
            <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-on-surface">{title}</p>
                <p className="mt-1 truncate text-sm text-on-surface-variant">{address}</p>
                <p className="mt-2 text-sm font-bold text-primary-container">NT$ {rent} / 月</p>
            </div>
            <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                <HeartButton listingType="RENT" listingId={listing.id} authenticated={true} />
            </div>
        </div>
    );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FavoritesPage() {
    const [tab, setTab] = useState<Tab>("SALE");
    const [favorites, setFavorites] = useState<Favorite[]>([]);
    const [favLoading, setFavLoading] = useState(true);
    const [favError, setFavError] = useState<string | null>(null);

    const tabCls = (t: Tab) =>
        t === tab
            ? "border-b-2 border-primary-container pb-2 text-sm font-bold text-primary-container"
            : "pb-2 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface";

    const handleTabChange = (newTab: Tab) => {
        if (newTab === tab) return;
        setFavorites([]);
        setFavError(null);
        setFavLoading(true);
        setTab(newTab);
    };

    useEffect(() => {
        let cancelled = false;
        getFavorites(tab)
            .then((data) => { if (!cancelled) setFavorites(data); })
            .catch((err: unknown) => {
                if (!cancelled) setFavError(err instanceof Error ? err.message : "載入收藏失敗");
            })
            .finally(() => { if (!cancelled) setFavLoading(false); });
        return () => { cancelled = true; };
    }, [tab]);

    const emptyLabel: Record<Tab, string> = {
        SALE: "尚無收藏的出售物件",
        RENT: "尚無收藏的出租物件",
    };

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-6 py-16 md:px-12">
                {/* Header */}
                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-10">
                    <h1 className="text-3xl font-extrabold text-on-surface">我的最愛</h1>
                    <p className="mt-3 text-sm leading-[1.8] text-on-surface-variant">
                        已收藏的出售與出租物件會顯示在這裡。
                    </p>
                </section>

                {/* Tabs */}
                <div className="flex gap-6 border-b border-outline-variant/20">
                    <button type="button" className={tabCls("SALE")} onClick={() => handleTabChange("SALE")}>
                        出售物件
                    </button>
                    <button type="button" className={tabCls("RENT")} onClick={() => handleTabChange("RENT")}>
                        出租物件
                    </button>
                </div>

                {/* Content */}
                {favError ? (
                    <div className="rounded-2xl border border-error/30 bg-error-container/20 p-6 text-sm text-on-error-container">
                        {favError}
                    </div>
                ) : favLoading ? (
                    <div className="grid grid-cols-1 gap-4">
                        {[1, 2, 3].map((n) => (
                            <div
                                key={n}
                                className="animate-pulse rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5"
                            >
                                <div className="mb-3 h-5 w-2/3 rounded bg-surface-container-high" />
                                <div className="mb-2 h-4 w-1/2 rounded bg-surface-container-high" />
                                <div className="h-4 w-1/4 rounded bg-surface-container-high" />
                            </div>
                        ))}
                    </div>
                ) : favorites.length === 0 ? (
                    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center text-sm text-on-surface-variant">
                        {emptyLabel[tab]}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {tab === "SALE"
                            ? favorites.map((fav) => (
                                <SaleFavoriteCard key={fav.id} listingId={fav.listing_id} />
                            ))
                            : favorites.map((fav) => (
                                <RentFavoriteCard key={fav.id} listingId={fav.listing_id} />
                            ))}
                    </div>
                )}
            </main>
        </SiteLayout>
    );
}
