import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getListings, type Listing, type ListingType } from "../api/listingApi";
import SiteLayout from "../layouts/SiteLayout";

const DISTRICT_SUGGESTIONS = [
    { name: "Xinyi", description: "Business district and high-rise inventory" },
    { name: "Da'an", description: "Owner-first rentals and family homes" },
    { name: "Zhongshan", description: "Compact city living and mixed-use supply" },
    { name: "Neihu", description: "Tech corridor commuting options" },
];

const VALUE_CARDS = [
    {
        icon: "verified_user",
        title: "KYC first baseline",
        description:
            "Gate 0 mainline is honest about current capability: verified users can create listings and book viewings before formal role credentials arrive.",
    },
    {
        icon: "home_work",
        title: "Owner-first flow",
        description:
            "The platform already supports owner self-listing. Listing creation, publishing, and appointment management are the first live housing flows we protect and verify.",
    },
    {
        icon: "timeline",
        title: "Traceability, staged",
        description:
            "Property, Agency, Case, and Stake will move on-chain by later gates. Gate 0 stays explicit about what is live today and what is still roadmap work.",
    },
];

function formatPrice(listing: Listing): string {
    if (listing.list_type === "RENT") return `NT$ ${listing.price.toLocaleString()} / month`;
    return `NT$ ${listing.price.toLocaleString()}`;
}

function formatMeta(listing: Listing): string[] {
    const items: string[] = [];
    if (listing.room_count !== undefined) items.push(`${listing.room_count} room${listing.room_count === 1 ? "" : "s"}`);
    if (listing.bathroom_count !== undefined) items.push(`${listing.bathroom_count} bath`);
    if (listing.area_ping !== undefined) items.push(`${listing.area_ping} ping`);
    return items;
}

export default function HomePage() {
    const navigate = useNavigate();
    const [listings, setListings] = useState<Listing[]>([]);
    const [searchType, setSearchType] = useState<ListingType>("SALE");
    const [searchText, setSearchText] = useState("");
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                setLoadError("");
                setListings(await getListings());
            } catch (err) {
                setLoadError(err instanceof Error ? err.message : "Failed to load listings.");
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, []);

    const recentListings = listings.filter((listing) => listing.status === "ACTIVE").slice(0, 3);

    const handleSearch = () => {
        const params = new URLSearchParams();
        params.set("type", searchType);
        if (searchText.trim()) params.set("district", searchText.trim());
        navigate(`/listings?${params.toString()}`);
    };

    return (
        <SiteLayout>
            <section className="relative overflow-hidden bg-gradient-to-b from-background to-surface-container-low px-6 pb-28 pt-24 md:px-12">
                <div className="mx-auto grid max-w-[1440px] gap-16 md:grid-cols-2 md:items-center">
                    <div className="relative z-10 flex flex-col gap-8">
                        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-lowest px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                            Gate 0 live baseline
                        </div>
                        <div className="space-y-5">
                            <h1 className="font-headline text-4xl font-extrabold leading-tight text-on-surface md:text-5xl lg:text-6xl">
                                Trusted housing,
                                <br />
                                honest rollout.
                            </h1>
                            <p className="max-w-xl text-lg leading-[1.8] text-on-surface-variant">
                                The current platform is already live for KYC, listing drafts, publishing, and viewing appointments.
                                This landing page now shows only real listing data and real Gate 0 capability.
                            </p>
                        </div>

                        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest/90 p-6 shadow-[0_16px_48px_rgba(28,25,23,0.08)] backdrop-blur-xl">
                            <div className="mb-5 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setSearchType("SALE")}
                                    className={`rounded-full px-5 py-2 text-sm font-bold transition-colors ${
                                        searchType === "SALE"
                                            ? "bg-primary-container text-on-primary-container"
                                            : "bg-surface-container-low text-on-surface hover:bg-surface-container"
                                    }`}
                                >
                                    Buy
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSearchType("RENT")}
                                    className={`rounded-full px-5 py-2 text-sm font-bold transition-colors ${
                                        searchType === "RENT"
                                            ? "bg-primary-container text-on-primary-container"
                                            : "bg-surface-container-low text-on-surface hover:bg-surface-container"
                                    }`}
                                >
                                    Rent
                                </button>
                            </div>

                            <div className="flex flex-col gap-4 sm:flex-row">
                                <div className="flex flex-1 items-center gap-3 rounded-xl bg-surface-container-low px-4 py-3">
                                    <span className="material-symbols-outlined text-outline">search</span>
                                    <input
                                        type="text"
                                        value={searchText}
                                        onChange={(event) => setSearchText(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") handleSearch();
                                        }}
                                        placeholder="District or neighborhood"
                                        className="w-full bg-transparent text-on-surface outline-none placeholder:text-on-surface-variant"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleSearch}
                                    className="rounded-xl bg-primary-container px-8 py-3 text-sm font-bold text-on-primary-container hover:opacity-90 transition-opacity"
                                >
                                    Search listings
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={() => navigate("/listings")}
                                className="rounded-xl bg-primary-container px-6 py-3 text-sm font-bold text-on-primary-container hover:opacity-90 transition-opacity"
                            >
                                Browse all listings
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate("/kyc")}
                                className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-6 py-3 text-sm font-medium text-on-surface hover:bg-surface-container-low transition-colors"
                            >
                                Complete KYC
                            </button>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="overflow-hidden rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest shadow-[0_24px_80px_rgba(28,25,23,0.08)]">
                            <div className="grid gap-0 border-b border-outline-variant/10 bg-surface-container-low p-6 md:grid-cols-[1.1fr_0.9fr]">
                                <div className="space-y-3">
                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Current scope</div>
                                    <div className="text-2xl font-bold text-on-surface">Draft to appointment</div>
                                    <p className="text-sm leading-[1.8] text-on-surface-variant">
                                        Verified users can already publish housing listings and start real viewing queues.
                                    </p>
                                </div>
                                <div className="mt-6 rounded-2xl bg-primary-container/15 p-5 md:mt-0">
                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Later gates</div>
                                    <div className="mt-2 text-lg font-bold text-on-surface">Property, Agency, Case, Stake</div>
                                    <p className="mt-2 text-sm leading-[1.7] text-on-surface-variant">
                                        Formal on-chain proof surfaces stay out of Gate 0 until the baseline is stable.
                                    </p>
                                </div>
                            </div>
                            <div className="grid gap-4 p-6 md:grid-cols-2">
                                {VALUE_CARDS.map((card) => (
                                    <div key={card.title} className="rounded-2xl bg-surface-container-low p-5 md:last:col-span-2">
                                        <span
                                            className="material-symbols-outlined mb-4 text-3xl text-primary-container"
                                            style={{ fontVariationSettings: "'FILL' 1" }}
                                        >
                                            {card.icon}
                                        </span>
                                        <h2 className="mb-2 text-lg font-bold text-on-surface">{card.title}</h2>
                                        <p className="text-sm leading-[1.75] text-on-surface-variant">{card.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="absolute -bottom-6 -left-6 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest px-5 py-4 shadow-[0_12px_32px_rgba(28,25,23,0.08)]">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Integrity note</div>
                            <div className="mt-2 text-sm font-medium text-on-surface">No placeholder listings are shown on this page anymore.</div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="bg-surface-container-low px-6 py-24 md:px-12">
                <div className="mx-auto max-w-[1440px]">
                    <div className="mb-12">
                        <h2 className="font-headline text-3xl font-extrabold text-on-surface">Start from a district</h2>
                        <p className="mt-3 max-w-2xl text-sm leading-[1.8] text-on-surface-variant">
                            Quick entry points still route to the real listing page with live query parameters.
                        </p>
                    </div>
                    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                        {DISTRICT_SUGGESTIONS.map((district) => (
                            <button
                                key={district.name}
                                type="button"
                                onClick={() => navigate(`/listings?district=${encodeURIComponent(district.name)}`)}
                                className="group rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 text-left transition-colors hover:bg-surface-container"
                            >
                                <div className="mb-3 flex items-center justify-between">
                                    <h3 className="text-xl font-bold text-on-surface">{district.name}</h3>
                                    <span className="material-symbols-outlined text-on-surface-variant transition-transform group-hover:translate-x-1">
                                        arrow_forward
                                    </span>
                                </div>
                                <p className="text-sm leading-[1.75] text-on-surface-variant">{district.description}</p>
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <section className="bg-surface-container-lowest px-6 py-24 md:px-12">
                <div className="mx-auto max-w-[1440px]">
                    <div className="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div>
                            <h2 className="font-headline text-3xl font-extrabold text-on-surface">Recent active listings</h2>
                            <p className="mt-3 max-w-2xl text-sm leading-[1.8] text-on-surface-variant">
                                This section reflects only live `ACTIVE` listings from the backend.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate("/listings")}
                            className="w-fit rounded-xl border border-outline-variant/20 px-5 py-3 text-sm font-medium text-on-surface hover:bg-surface-container-low transition-colors"
                        >
                            Open listing index
                        </button>
                    </div>

                    {loading ? (
                        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-10 text-sm text-on-surface-variant">
                            Loading recent listings...
                        </div>
                    ) : loadError ? (
                        <div className="rounded-2xl border border-error/20 bg-error-container p-10 text-sm text-on-error-container">
                            {loadError}
                        </div>
                    ) : recentListings.length === 0 ? (
                        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-10">
                            <h3 className="text-2xl font-bold text-on-surface">No active listings yet</h3>
                            <p className="mt-3 max-w-2xl text-sm leading-[1.8] text-on-surface-variant">
                                Once a verified owner publishes a listing, it will appear here. Until then, this page stays empty on purpose instead of filling with mock data.
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
                            {recentListings.map((listing) => (
                                <article
                                    key={listing.id}
                                    onClick={() => navigate(`/listings/${listing.id}`)}
                                    className="cursor-pointer overflow-hidden rounded-2xl border border-outline-variant/10 bg-surface transition-transform duration-300 hover:-translate-y-1"
                                >
                                    <div className="relative h-64 bg-surface-variant">
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
                                        <div className="absolute left-4 top-4 rounded-full border border-outline-variant/10 bg-surface-container-lowest/90 px-3 py-1 text-xs font-bold text-on-surface">
                                            {listing.list_type}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-4 p-6">
                                        <div className="flex items-start justify-between gap-4">
                                            <h3 className="text-xl font-bold text-on-surface">{listing.title}</h3>
                                            <div className="text-lg font-bold text-primary-container">{formatPrice(listing)}</div>
                                        </div>
                                        <p className="text-sm leading-[1.75] text-on-surface-variant">
                                            {listing.district ? `${listing.district} · ` : ""}
                                            {listing.address}
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {formatMeta(listing).map((item) => (
                                                <span key={item} className="rounded-full bg-surface-container-low px-3 py-1 text-xs text-on-surface-variant">
                                                    {item}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            <section className="bg-background px-6 py-24 md:px-12">
                <div className="mx-auto flex max-w-[1080px] flex-col items-center rounded-[32px] bg-gradient-to-br from-primary-container/20 to-surface-container-low p-12 text-center md:p-16">
                    <h2 className="font-headline text-3xl font-extrabold text-on-surface md:text-4xl">
                        Ready to enter the live owner flow?
                    </h2>
                    <p className="mt-5 max-w-2xl text-base leading-[1.8] text-on-surface-variant">
                        Finish KYC, create a draft listing, and publish when the details are ready. Gate 1 will layer formal role credentials on top of this baseline rather than replacing it.
                    </p>
                    <div className="mt-8 flex flex-wrap justify-center gap-3">
                        <button
                            type="button"
                            onClick={() => navigate("/kyc")}
                            className="rounded-xl bg-primary-container px-6 py-3 text-sm font-bold text-on-primary-container hover:opacity-90 transition-opacity"
                        >
                            Start KYC
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate("/member")}
                            className="rounded-xl border border-outline-variant/25 bg-surface-container-lowest px-6 py-3 text-sm font-medium text-on-surface hover:bg-surface-container-low transition-colors"
                        >
                            Open identity center
                        </button>
                    </div>
                </div>
            </section>
        </SiteLayout>
    );
}
