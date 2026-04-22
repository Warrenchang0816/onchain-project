import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getAuthMe } from "../api/authApi";
import { getListings, getMyListings, type Listing, type ListingType } from "../api/listingApi";
import SiteLayout from "../layouts/SiteLayout";

type TypeFilter = "ALL" | ListingType;

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

function formatPrice(listing: Listing): string {
    if (listing.list_type === "RENT") return `NT$ ${listing.price.toLocaleString()} / month`;
    return `NT$ ${listing.price.toLocaleString()}`;
}

function statusBadgeClass(status: string): string {
    if (status === "ACTIVE") return "bg-tertiary/10 text-tertiary border-tertiary/20";
    if (status === "NEGOTIATING") return "bg-amber-700/10 text-amber-700 border-amber-700/20";
    if (status === "DRAFT") return "bg-surface-container text-on-surface-variant border-outline-variant/20";
    return "bg-surface-container text-on-surface-variant border-outline-variant/20";
}

function ListingCard(props: { listing: Listing; onClick: () => void }) {
    const { listing, onClick } = props;

    return (
        <article
            onClick={onClick}
            className="flex cursor-pointer flex-col overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-lowest transition-transform duration-300 hover:-translate-y-1"
        >
            <div className="relative h-64 w-full overflow-hidden bg-surface-variant">
                {listing.image_url ? (
                    <img src={listing.image_url} alt={listing.title} className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center">
                        <span
                            className="material-symbols-outlined text-7xl text-on-surface-variant/20"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                            home
                        </span>
                    </div>
                )}
                <div className={`absolute left-4 top-4 rounded-full border px-3 py-1 text-xs font-bold tracking-wider ${statusBadgeClass(listing.status)}`}>
                    {STATUS_LABEL[listing.status] ?? listing.status}
                </div>
            </div>
            <div className="flex flex-grow flex-col p-6">
                <div className="mb-2 flex items-start justify-between gap-4">
                    <h3 className="text-xl font-bold leading-tight text-on-surface">{listing.title}</h3>
                    <div className="shrink-0 text-xl font-bold text-[#E8B800]">{formatPrice(listing)}</div>
                </div>
                <p className="mb-6 text-sm leading-[1.75] text-on-surface-variant">
                    {listing.district ? `${listing.district} · ` : ""}
                    {listing.address}
                </p>
                <div className="mt-auto flex flex-wrap gap-2">
                    {listing.area_ping !== undefined ? (
                        <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs text-on-surface-variant">
                            {listing.area_ping} ping
                        </span>
                    ) : null}
                    {listing.room_count !== undefined ? (
                        <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs text-on-surface-variant">
                            {listing.room_count} room{listing.room_count === 1 ? "" : "s"}
                            {listing.bathroom_count !== undefined ? ` / ${listing.bathroom_count} bath` : ""}
                        </span>
                    ) : null}
                    {listing.floor !== undefined && listing.total_floors !== undefined ? (
                        <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs text-on-surface-variant">
                            {listing.floor}F / {listing.total_floors}F
                        </span>
                    ) : null}
                </div>
            </div>
        </article>
    );
}

export default function ListingListPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [listings, setListings] = useState<Listing[]>([]);
    const [myListings, setMyListings] = useState<Listing[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    const typeParam = searchParams.get("type");
    const typeFilter: TypeFilter = typeParam === "RENT" || typeParam === "SALE" ? typeParam : "ALL";
    const districtFilter = searchParams.get("district")?.trim() ?? "";

    useEffect(() => {
        const load = async () => {
            try {
                setIsLoading(true);
                setLoadError("");

                const params = {
                    ...(typeFilter !== "ALL" ? { type: typeFilter } : {}),
                    ...(districtFilter ? { district: districtFilter } : {}),
                };

                const [publicListings, auth] = await Promise.all([
                    getListings(Object.keys(params).length > 0 ? params : undefined),
                    getAuthMe().catch(() => ({ authenticated: false })),
                ]);

                setListings(publicListings);
                setIsAuthenticated(auth.authenticated);

                if (auth.authenticated) {
                    const mine = await getMyListings().catch(() => [] as Listing[]);
                    setMyListings(mine);
                } else {
                    setMyListings([]);
                }
            } catch (err) {
                setLoadError(err instanceof Error ? err.message : "Failed to load listings.");
            } finally {
                setIsLoading(false);
            }
        };

        void load();
    }, [districtFilter, typeFilter]);

    const setType = (next: TypeFilter) => {
        const nextParams = new URLSearchParams(searchParams);
        if (next === "ALL") {
            nextParams.delete("type");
        } else {
            nextParams.set("type", next);
        }
        setSearchParams(nextParams);
    };

    const myActiveCount = myListings.filter((listing) => listing.status === "ACTIVE").length;
    const myNegotiatingCount = myListings.filter((listing) => listing.status === "NEGOTIATING").length;
    const myDraftCount = myListings.filter((listing) => listing.status === "DRAFT").length;
    const featureListing = myListings[0] ?? null;

    const tabCls = (active: boolean) =>
        active
            ? "bg-transparent pb-1 text-lg font-bold text-[#E8B800] border-b-2 border-[#E8B800] transition-colors"
            : "bg-transparent pb-1 text-lg font-medium text-on-surface-variant hover:text-on-surface transition-colors";

    return (
        <SiteLayout>
            <section className="relative w-full overflow-hidden bg-gradient-to-r from-surface to-surface-container-low py-12 md:py-16">
                <div className="relative z-10 mx-auto max-w-[1440px] px-6 md:px-12">
                    <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">
                        Browse verified housing listings
                    </h1>
                    <p className="max-w-2xl text-base leading-[1.75] text-on-surface-variant md:text-lg">
                        Gate 0 uses the live listings API only. This page no longer fills itself with placeholder inventory when there is no data.
                    </p>
                    {districtFilter ? (
                        <div className="mt-5 inline-flex items-center gap-3 rounded-full border border-outline-variant/20 bg-surface-container-lowest px-4 py-2 text-sm text-on-surface">
                            <span>District filter: {districtFilter}</span>
                            <button
                                type="button"
                                onClick={() => {
                                    const nextParams = new URLSearchParams(searchParams);
                                    nextParams.delete("district");
                                    setSearchParams(nextParams);
                                }}
                                className="text-on-surface-variant transition-colors hover:text-on-surface"
                            >
                                Clear
                            </button>
                        </div>
                    ) : null}
                </div>
                <div className="absolute right-0 top-0 -z-0 h-full w-1/3 translate-x-1/2 rounded-full bg-primary-fixed-dim/20 blur-[80px]" />
            </section>

            <section className="sticky top-[64px] z-40 w-full bg-surface-container-lowest">
                <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-4 px-6 py-4 md:flex-row md:items-center md:px-12">
                    <div className="flex items-center gap-6">
                        <button type="button" onClick={() => setType("ALL")} className={tabCls(typeFilter === "ALL")}>All</button>
                        <button type="button" onClick={() => setType("RENT")} className={tabCls(typeFilter === "RENT")}>Rent</button>
                        <button type="button" onClick={() => setType("SALE")} className={tabCls(typeFilter === "SALE")}>Sale</button>
                    </div>
                    {isAuthenticated ? (
                        <button
                            type="button"
                            onClick={() => navigate("/listings/new")}
                            className="flex items-center gap-2 rounded-lg bg-primary-container px-4 py-2 text-on-surface transition-colors hover:bg-inverse-primary"
                        >
                            <span className="material-symbols-outlined text-sm">add</span>
                            <span className="text-sm font-medium">Create draft listing</span>
                        </button>
                    ) : null}
                </div>
            </section>

            <section className="w-full bg-surface py-12">
                <div className="mx-auto max-w-[1440px] px-6 md:px-12">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-32">
                            <span className="animate-pulse text-sm text-on-surface-variant">Loading listings...</span>
                        </div>
                    ) : loadError ? (
                        <div className="rounded-xl border border-error/20 bg-error-container p-8 text-sm text-on-error-container">
                            {loadError}
                        </div>
                    ) : listings.length === 0 ? (
                        <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center">
                            <h2 className="text-2xl font-bold text-on-surface">No listings match this filter yet</h2>
                            <p className="mt-2 text-sm text-on-surface-variant">
                                Verified users can still create a draft listing from the owner flow.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 md:gap-12">
                            {listings.map((listing) => (
                                <ListingCard key={listing.id} listing={listing} onClick={() => navigate(`/listings/${listing.id}`)} />
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {isAuthenticated ? (
                <section className="w-full bg-surface-container-low py-16">
                    <div className="mx-auto max-w-[1440px] px-6 md:px-12">
                        <div className="mb-8 flex justify-between items-end">
                            <div>
                                <h2 className="mb-2 text-2xl font-extrabold text-on-surface md:text-3xl">My listings</h2>
                                <p className="text-sm text-on-surface-variant md:text-base">
                                    This section reflects only your real listings from `/api/listings/mine`.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                            <div className="lg:col-span-8">
                                {featureListing ? (
                                    <div
                                        className="flex cursor-pointer flex-col items-center gap-8 rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-6 md:flex-row md:p-8"
                                        onClick={() => navigate(`/listings/${featureListing.id}`)}
                                    >
                                        <div className="min-h-[200px] h-48 w-full overflow-hidden rounded-lg bg-surface-variant md:h-full md:w-1/2">
                                            {featureListing.image_url ? (
                                                <img src={featureListing.image_url} alt={featureListing.title} className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center">
                                                    <span
                                                        className="material-symbols-outlined text-7xl text-on-surface-variant/20"
                                                        style={{ fontVariationSettings: "'FILL' 1" }}
                                                    >
                                                        home
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex w-full flex-col justify-center md:w-1/2">
                                            <div className={`mb-4 inline-flex self-start rounded-full border px-3 py-1 text-xs font-bold tracking-wider ${statusBadgeClass(featureListing.status)}`}>
                                                {STATUS_LABEL[featureListing.status] ?? featureListing.status}
                                            </div>
                                            <h3 className="mb-2 text-2xl font-bold text-on-surface">{featureListing.title}</h3>
                                            <p className="mb-6 text-sm leading-[1.75] text-on-surface-variant">
                                                {featureListing.description ?? featureListing.address}
                                            </p>
                                            <div className="mt-auto flex gap-4">
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        navigate(`/listings/${featureListing.id}`);
                                                    }}
                                                    className="rounded-lg bg-primary-container px-6 py-2 text-sm font-bold text-on-surface transition-colors hover:bg-inverse-primary"
                                                >
                                                    Open listing
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        navigate("/listings/new");
                                                    }}
                                                    className="rounded-lg border border-outline-variant/50 bg-transparent px-6 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
                                                >
                                                    New draft
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-4 rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                                        <h3 className="text-2xl font-bold text-on-surface">You do not have any listings yet</h3>
                                        <p className="text-sm text-on-surface-variant">
                                            Complete KYC, then create a draft listing to start the owner flow.
                                        </p>
                                        <div>
                                            <button
                                                type="button"
                                                onClick={() => navigate("/listings/new")}
                                                className="rounded-lg bg-primary-container px-6 py-3 font-bold text-on-surface transition-colors hover:bg-inverse-primary"
                                            >
                                                Create draft listing
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col justify-between rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-6 md:p-8 lg:col-span-4">
                                <div>
                                    <h4 className="mb-1 text-lg font-bold text-on-surface">Listing stats</h4>
                                    <p className="mb-6 text-sm text-on-surface-variant">Counts are computed only from live `/mine` data.</p>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between border-b border-surface-variant/50 pb-4">
                                            <span className="text-on-surface-variant">Active</span>
                                            <span className="font-bold text-on-surface">{myActiveCount}</span>
                                        </div>
                                        <div className="flex items-center justify-between border-b border-surface-variant/50 pb-4">
                                            <span className="text-on-surface-variant">Negotiating</span>
                                            <span className="font-bold text-on-surface">{myNegotiatingCount}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-on-surface-variant">Draft</span>
                                            <span className="font-bold text-on-surface">{myDraftCount}</span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => navigate("/member")}
                                    className="mt-8 w-full text-center text-sm font-bold text-tertiary underline decoration-tertiary transition-colors hover:text-on-tertiary-container"
                                >
                                    Go to identity center
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            ) : null}
        </SiteLayout>
    );
}
